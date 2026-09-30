import { createRng, type Rng } from "../lib/rng";
import { dayFromIso } from "../lib/format";
import {
  CAL_SLOTS,
  CAL_START,
  CHALLENGE_VERSION,
  SLOT_MIN,
  type Attendee,
  type CalEvent,
  type CalendarChallenge,
  type Challenge,
  type Product,
  type SheetChallenge,
  type SheetColumn,
  type SheetRow,
  type ShoppingChallenge,
} from "./types";
import { calendarProblems } from "./validate";

const cache = new Map<string, Challenge>();

export function generateChallenge(seed: string): Challenge {
  const hit = cache.get(seed);
  if (hit) return hit;
  const base = createRng(`${seed}:v${CHALLENGE_VERSION}:base`);
  // In-game "today" is a Monday between Oct 5 and Dec 7, 2026.
  const today = dayFromIso("2026-10-05") + 7 * base.int(0, 9);
  const challenge: Challenge = {
    seed,
    version: CHALLENGE_VERSION,
    shopping: generateShopping(createRng(`${seed}:v${CHALLENGE_VERSION}:shop`), today),
    calendar: generateCalendar(createRng(`${seed}:v${CHALLENGE_VERSION}:cal`), today),
    sheet: generateSheet(createRng(`${seed}:v${CHALLENGE_VERSION}:sheet`)),
  };
  cache.set(seed, challenge);
  return challenge;
}

// ---------------------------------------------------------------- Shopping

const BRANDS = ["Auralis", "Nordvik", "Sonora", "Kestrel", "Halcyon", "Vanta", "Lumen", "Polaris", "Echoline", "Trident", "Mistral", "Oakwave"];
const MODELS = ["Q35", "Pulse ANC", "Studio 2", "Air Pro", "Nimbus", "Drift", "Arc 700", "Wave Lite", "Flux", "Core X", "Sprint", "Ember", "Aria 4", "Tempo", "Halo S", "Vector", "Solace", "Loop Mini"];
const STYLES: Product["style"][] = ["Over-ear", "Over-ear", "On-ear", "In-ear", "Open-ear"];

function generateShopping(rng: Rng, today: number): ShoppingChallenge {
  const budget = rng.pick([90, 100, 120, 150, 180, 200, 250]);
  const budgetCents = budget * 100;
  const minRating = rng.pick([4.2, 4.3, 4.4, 4.5]);
  const deadline = today + rng.pick([2, 3, 4]);

  const priceOk = (edge: boolean) =>
    edge ? budgetCents - rng.pick([0, 1, 1]) : budgetCents - rng.int(2, Math.min(60, budget - 25)) * 100 - rng.pick([1, 1, 51, 5]);
  const priceBad = (near: boolean) =>
    near ? budgetCents + rng.int(0, 12) * 100 + rng.pick([99, 99, 49]) : budgetCents + rng.int(25, 160) * 100 - 1;
  const round1 = (x: number) => Math.round(x * 10) / 10;
  const ratingOk = (edge: boolean) => round1(Math.min(4.9, minRating + (edge ? 0 : rng.pick([0.1, 0.2, 0.3, 0.4]))));
  const ratingBad = (near: boolean) => round1(minRating - (near ? rng.pick([0.1, 0.1, 0.2]) : rng.pick([0.4, 0.6, 0.9, 1.2])));
  const deliveryOk = (edge: boolean) => (edge ? deadline : rng.int(today + 1, deadline));
  const deliveryBad = (near: boolean) => deadline + (near ? 1 : rng.int(2, 6));

  // Failure masks: 1 = price, 2 = rating, 4 = delivery. Exactly one product passes everything.
  const masks = [0, 1, 1, 1, 2, 2, 2, 4, 4, 4, 3, 3, 5, 5, 6, 7];
  const names = new Set<string>();
  const products: Product[] = masks.map((mask, i) => {
    let brand = "";
    let model = "";
    do {
      brand = rng.pick(BRANDS);
      model = rng.pick(MODELS);
    } while (names.has(`${brand} ${model}`));
    names.add(`${brand} ${model}`);
    const near = rng.chance(0.75);
    const edge = rng.chance(0.35);
    const priceCents = mask & 1 ? priceBad(near) : priceOk(edge);
    const onSale = rng.chance(0.4);
    return {
      id: `p${i + 1}`,
      brand,
      model,
      style: rng.pick(STYLES),
      priceCents,
      listPriceCents: onSale ? Math.round((priceCents * (1.15 + rng.next() * 0.45)) / 100) * 100 - 1 : null,
      rating: mask & 2 ? ratingBad(near) : ratingOk(rng.chance(0.3)),
      reviews: rng.int(38, 9800),
      deliveryDay: mask & 4 ? deliveryBad(near) : deliveryOk(rng.chance(0.4)),
      hue: rng.int(0, 359),
      badge: null,
    };
  });
  // Lures: "Best seller" and "Limited deal" badges only land on products that fail a constraint.
  const failing = rng.shuffle(products.filter((_, i) => masks[i] !== 0));
  failing[0].badge = "Best seller";
  failing[1].badge = "Limited deal";
  if (rng.chance(0.5)) failing[2].badge = "New";

  const shuffled = rng.shuffle(products).map((p, i) => ({ ...p, id: `p${i + 1}` }));
  return { today, budgetCents, minRating, deadline, products: shuffled };
}

// ---------------------------------------------------------------- Calendar

const PEOPLE = [
  "Priya Nair", "Marco Rossi", "Aiko Tanaka", "Sam Okafor", "Lena Fischer", "Diego Alvarez", "Noor Haddad", "Tom Becker", "Grace Kim", "Omar Farouk",
];
const COLORS = ["#7c9cff", "#ff8fab", "#ffc15e", "#5fe3c0", "#c69cff", "#6fd3ff"];
const HOURS: [number, number][] = [
  [480, 960], [510, 1020], [540, 1020], [540, 1080], [570, 1050], [600, 1080], [600, 1140], [480, 900], [630, 1140], [510, 990],
];
const MEETINGS = ["Q4 Roadmap Sync", "Launch Readiness Review", "Pricing Deep-Dive", "Partner Kickoff", "Hiring Calibration", "Quarterly Planning"];
const EVENT_TITLES = [
  "Design review", "1:1", "Customer call", "Focus time", "Standup", "Hiring panel", "Lunch", "Planning", "Vendor sync", "Interview",
  "Offsite prep", "Budget review", "Demo prep", "Team lunch", "Workshop", "Office hours", "Board prep", "Sprint retro",
];

function initialsOf(name: string) {
  return name.split(" ").map((p) => p[0]).join("");
}

function generateCalendar(rng: Rng, weekStart: number): CalendarChallenge {
  const durationMin = rng.pick([45, 60, 90]);
  let hours: [number, number][] = [];
  let lo = 0;
  let hi = 0;
  do {
    hours = [0, 1, 2, 3].map(() => rng.pick(HOURS));
    lo = Math.max(...hours.map((h) => h[0]));
    hi = Math.min(...hours.map((h) => h[1]));
  } while (hi - lo < durationMin + 150);

  const names = ["You", ...rng.shuffle(PEOPLE).slice(0, 3)];
  const attendees: Attendee[] = names.map((name, i) => ({
    id: `a${i}`,
    name,
    initials: name === "You" ? "You" : initialsOf(name),
    color: COLORS[i],
    startMin: hours[i][0],
    endMin: hours[i][1],
  }));

  const slotOf = (min: number) => (min - CAL_START) / SLOT_MIN;
  const startsFor = () => {
    const out: number[] = [];
    for (let s = lo; s + durationMin <= hi; s += SLOT_MIN) out.push(s);
    return out;
  };
  const overlapping = (start: number) => {
    const ks: number[] = [];
    for (let k = Math.floor(slotOf(start)); k < Math.ceil(slotOf(start + durationMin)); k++) ks.push(k);
    return ks;
  };

  const target = { dayIndex: rng.int(0, 4), startMin: rng.pick(startsFor()) };
  let current = target;
  while (current.dayIndex === target.dayIndex && Math.abs(current.startMin - target.startMin) < durationMin + SLOT_MIN) {
    current = { dayIndex: rng.int(0, 4), startMin: rng.pick(startsFor()) };
  }
  const protectedSlots = new Set(overlapping(target.startMin).map((k) => `${target.dayIndex}:${k}`));
  const isProtected = (d: number, k: number) => protectedSlots.has(`${d}:${k}`);

  // busy[attendee][day][slot]
  const busy = attendees.map(() => Array.from({ length: 5 }, () => new Array<boolean>(CAL_SLOTS).fill(false)));
  attendees.forEach((a, ai) => {
    for (let d = 0; d < 5; d++) {
      const count = rng.int(1, 3);
      for (let n = 0; n < count; n++) {
        const len = rng.int(1, 4);
        const minK = Math.max(0, slotOf(a.startMin));
        const maxK = Math.min(CAL_SLOTS, slotOf(a.endMin)) - len;
        if (maxK < minK) continue;
        const k0 = rng.int(minK, maxK);
        const ks = Array.from({ length: len }, (_, i) => k0 + i);
        if (ks.some((k) => isProtected(d, k))) continue;
        ks.forEach((k) => (busy[ai][d][k] = true));
      }
    }
  });

  // The meeting's current time now clashes with a newly booked event for someone else.
  const clashWho = rng.int(1, 3);
  const clashSlots = overlapping(current.startMin);
  busy[clashWho][current.dayIndex][rng.pick(clashSlots)] = true;

  const buildEvents = (): CalEvent[] => {
    const events: CalEvent[] = [];
    let id = 0;
    attendees.forEach((a, ai) => {
      for (let d = 0; d < 5; d++) {
        let k = 0;
        while (k < CAL_SLOTS) {
          if (!busy[ai][d][k]) {
            k++;
            continue;
          }
          let end = k;
          while (end < CAL_SLOTS && busy[ai][d][end]) end++;
          // split long runs into realistic 30–120 min events
          let s = k;
          while (s < end) {
            const len = Math.min(end - s, end - s > 4 ? rng.int(2, 4) : end - s);
            events.push({
              id: `e${++id}`,
              attendeeId: a.id,
              dayIndex: d,
              startMin: CAL_START + s * SLOT_MIN,
              endMin: CAL_START + (s + len) * SLOT_MIN,
              title: rng.pick(EVENT_TITLES),
            });
            s += len;
          }
          k = end;
        }
      }
    });
    return events;
  };

  const draft = (): CalendarChallenge => ({
    weekStart,
    meetingTitle: rng.pick(MEETINGS),
    durationMin,
    attendees,
    events: buildEvents(),
    current,
    clashEventId: null,
  });

  // Close every other valid opening so exactly one start time works.
  for (let guard = 0; guard < 400; guard++) {
    const probe = draft();
    const open: { d: number; s: number }[] = [];
    for (let d = 0; d < 5; d++) {
      for (let s = CAL_START; s + durationMin <= CAL_START + CAL_SLOTS * SLOT_MIN; s += SLOT_MIN) {
        if (d === target.dayIndex && s === target.startMin) continue;
        if (calendarProblems(probe, d, s).length === 0) open.push({ d, s });
      }
    }
    if (open.length === 0) break;
    const pick = rng.pick(open);
    const ks = overlapping(pick.s).filter((k) => !isProtected(pick.d, k));
    const k = rng.pick(ks);
    const who = rng.int(0, 3);
    busy[who][pick.d][k] = true;
    if (k + 1 < CAL_SLOTS && !isProtected(pick.d, k + 1) && rng.chance(0.5)) busy[who][pick.d][k + 1] = true;
  }

  const final = draft();
  const clash = final.events.find(
    (e) => e.attendeeId === attendees[clashWho].id && e.dayIndex === current.dayIndex && e.startMin < current.startMin + durationMin && e.endMin > current.startMin,
  );
  if (clash) {
    clash.title = rng.pick(["Customer escalation", "Dentist appointment", "Exec briefing", "Flight to Berlin"]);
    final.clashEventId = clash.id;
  }
  return final;
}

// ---------------------------------------------------------------- Spreadsheet

const FIRST = ["Maya", "Jonah", "Ines", "Rafael", "Chloe", "Victor", "Hana", "Luca", "Amara", "Felix", "Nadia", "Oscar", "Zoe", "Mateo", "Leila", "Kai", "Elena", "Theo", "Sofia", "Ravi"];
const LAST = ["Chen", "Park", "Silva", "Moreau", "Kowalski", "Haddad", "Ibarra", "Lindqvist", "Osei", "Varga", "Nakamura", "Duarte", "Brennan", "Ahmed", "Petrov", "Laurent", "Quinn", "Adeyemi"];
const COMPANIES = [
  ["Acme Robotics", "acmerobotics.com"], ["Bluefin Labs", "bluefinlabs.io"], ["Cobalt Health", "cobalthealth.com"], ["Driftwood Co", "driftwood.co"],
  ["Evergreen Bank", "evergreenbank.com"], ["Foxglove Media", "foxglove.media"], ["Granite Logistics", "granitelogistics.com"], ["Harbor Analytics", "harbor.ai"],
  ["Ironleaf Studio", "ironleaf.studio"], ["Juniper Retail", "juniperretail.com"], ["Kinetic Foods", "kineticfoods.com"], ["Lighthouse Legal", "lighthouselegal.com"],
] as const;
const PLANS = ["Starter", "Team", "Business", "Enterprise"];
const NICK: Record<string, string> = { Jonah: "Jon", Rafael: "Rafa", Victor: "Vic", Amara: "Ama", Felix: "Fe", Nadia: "Nadi", Mateo: "Teo", Elena: "Lena", Theo: "Teddy", Sofia: "Sofi", Maya: "May", Chloe: "Clo", Luca: "Luke", Oscar: "Ozzy", Leila: "Lei", Ravi: "Rav", Ines: "Nessa", Hana: "Hanna", Zoe: "Zo", Kai: "Kaiden" };

function generateSheet(rng: Rng): SheetChallenge {
  const dupColumns: SheetColumn[] = rng.chance(0.6) ? ["email", "company"] : ["email"];
  const sort = rng.pick([
    { column: "seats", dir: "desc" },
    { column: "name", dir: "asc" },
    { column: "updated", dir: "desc" },
    { column: "company", dir: "asc" },
  ] as const);

  const firsts = rng.shuffle(FIRST);
  const lasts = rng.shuffle(LAST);
  const companies = rng.shuffle(COMPANIES);
  type Entity = { first: string; last: string; email: string; company: string };
  const entities: Entity[] = [];
  for (let i = 0; i < 11; i++) {
    const [company, domain] = companies[i];
    const first = firsts[i];
    const last = lasts[i];
    const personal = rng.chance(0.25);
    const email = personal ? `${first.toLowerCase()}${last.toLowerCase()}@mailbox.io` : `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`;
    entities.push({ first, last, email, company });
  }
  // Trap: the same personal email appears under two different companies (not a duplicate when
  // Company is one of the duplicate columns; a duplicate when only Email is).
  const trap = entities[10];
  const trapSource = entities[9];
  trap.first = trapSource.first;
  trap.last = trapSource.last;
  trap.email = `${trapSource.first.toLowerCase()}${trapSource.last.toLowerCase()}@mailbox.io`;
  trapSource.email = trap.email;

  // Unique dates and seat counts across the whole sheet so sort orders are unambiguous.
  const dayPool = rng.shuffle(Array.from({ length: 600 }, (_, i) => i)).slice(0, 20);
  const seatPool = rng.shuffle(Array.from({ length: 240 }, (_, i) => i + 3)).slice(0, 20);
  const isoFor = (offset: number) => new Date(Date.UTC(2025, 0, 1) + offset * 86_400_000).toISOString().slice(0, 10);

  const rows: SheetRow[] = [];
  let n = 0;
  const makeRow = (e: Entity, variant: number): SheetRow => {
    const i = n++;
    let name = `${e.first} ${e.last}`;
    let email = e.email;
    let company = e.company;
    if (variant === 1) name = `${NICK[e.first] ?? e.first[0] + "."} ${e.last}`;
    if (variant >= 1 && rng.chance(0.6)) email = email[0].toUpperCase() + email.slice(1).replace(/@(.)/, (_m, c: string) => "@" + c.toUpperCase());
    if (variant === 2) {
      name = `${e.first[0]}. ${e.last}`;
      company = company.toLowerCase();
    }
    return {
      id: `r${i + 1}`,
      name,
      email,
      company,
      plan: rng.pick(PLANS),
      seats: seatPool[i],
      updated: isoFor(dayPool[i]),
    };
  };
  entities.forEach((e) => rows.push(makeRow(e, 0)));
  // 4 duplicate groups: three with one extra row, one with two extra rows (16 rows total).
  const dupTargets = rng.shuffle(entities.slice(0, 9)).slice(0, 4);
  dupTargets.forEach((e, gi) => {
    rows.push(makeRow(e, 1));
    if (gi === 0) rows.push(makeRow(e, 2));
  });
  // Trap rows share a name; give the second a middle initial so Name sorting stays unambiguous.
  const trapRow = rows.find((r) => r.company === trap.company && r.email === trap.email);
  if (trapRow) trapRow.name = `${trap.first} ${rng.pick(["J.", "M.", "R.", "T."])} ${trap.last}`;

  // Shuffle while keeping ids tied to display row order.
  const shuffled = rng.shuffle(rows).map((r, i) => ({ ...r, id: `r${i + 1}` }));
  return {
    rows: shuffled,
    dupColumns,
    keepRule: { column: "updated", label: "most recently updated" },
    sort: { ...sort },
  };
}
