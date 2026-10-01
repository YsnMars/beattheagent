import { formatClock, formatDay, formatMoney } from "../lib/format";
import {
  CAL_SLOTS,
  CAL_START,
  SHEET_COLUMNS,
  SLOT_MIN,
  type CalendarChallenge,
  type SheetChallenge,
  type SheetColumn,
  type SheetRow,
  type SheetSortRule,
  type ShoppingChallenge,
} from "./types";

/**
 * A condition from the task text that a submission can break. A rejection names the ones it broke so
 * the task can mark them.
 */
export type Req =
  | "shop:one"
  | "shop:budget"
  | "shop:rating"
  | "shop:deadline"
  | "cal:week"
  | "cal:free"
  | "cal:hours"
  | "cal:slot"
  | "sheet:dups"
  | "sheet:keep"
  | "sheet:sort";

export type Problem = { text: string; req: Req };

/** `message` is the one-line form kept in the run log; a rejection also explains itself point by point. */
export type Verdict = { ok: true; message: string } | { ok: false; message: string; title: string; problems: string[]; reqs: Req[] };

function reject(title: string, problems: Problem[] = [], reqs: Req[] = []): Verdict {
  const texts = problems.map((p) => p.text);
  return {
    ok: false,
    message: texts.length ? `${title}: ${texts.join("; ")}.` : `${title}.`,
    title,
    problems: texts,
    reqs: [...new Set([...reqs, ...problems.map((p) => p.req)])],
  };
}

// ---------------------------------------------------------------- Shopping

export function productProblems(ch: ShoppingChallenge, productId: string): Problem[] {
  const p = ch.products.find((x) => x.id === productId)!;
  const problems: Problem[] = [];
  if (p.priceCents > ch.budgetCents)
    problems.push({ text: `Costs ${formatMoney(p.priceCents)}, over the ${formatMoney(ch.budgetCents)} budget`, req: "shop:budget" });
  if (p.rating < ch.minRating) problems.push({ text: `Rated ${p.rating.toFixed(1)}★, below ${ch.minRating.toFixed(1)}★`, req: "shop:rating" });
  if (p.deliveryDay > ch.deadline)
    problems.push({ text: `Arrives ${formatDay(p.deliveryDay)}, after ${formatDay(ch.deadline)}`, req: "shop:deadline" });
  return problems;
}

export function checkShopping(ch: ShoppingChallenge, cart: string[]): Verdict {
  if (cart.length === 0) return reject("Your cart is empty", [], ["shop:one"]);
  if (cart.length > 1) return reject("Order exactly one pair", [{ text: `Your cart has ${cart.length} items`, req: "shop:one" }]);
  const p = ch.products.find((x) => x.id === cart[0])!;
  const problems = productProblems(ch, p.id);
  if (problems.length) return reject(`${p.brand} ${p.model} doesn't qualify`, problems);
  return { ok: true, message: `Order placed: ${p.brand} ${p.model}.` };
}

// ---------------------------------------------------------------- Calendar

export function calendarProblems(ch: CalendarChallenge, dayIndex: number, startMin: number): Problem[] {
  const end = startMin + ch.durationMin;
  const problems: Problem[] = [];
  if (dayIndex < 0 || dayIndex > 4) return [{ text: "Pick a weekday this week", req: "cal:week" }];
  if (startMin < CAL_START || end > CAL_START + CAL_SLOTS * SLOT_MIN) return [{ text: "That time is outside the calendar", req: "cal:hours" }];
  if (startMin % SLOT_MIN !== 0) return [{ text: "Meetings start on the hour or half hour", req: "cal:slot" }];
  for (const a of ch.attendees) {
    const you = a.name === "You";
    const who = a.name.split(" ")[0];
    if (startMin < a.startMin || end > a.endMin) {
      problems.push({ text: `Outside ${you ? "your" : who + "'s"} working hours (${formatClock(a.startMin)}–${formatClock(a.endMin)})`, req: "cal:hours" });
      continue;
    }
    const clash = ch.events.find((e) => e.attendeeId === a.id && e.dayIndex === dayIndex && e.startMin < end && e.endMin > startMin);
    if (clash) {
      problems.push({ text: `${you ? "You're" : who + " is"} busy ${formatClock(clash.startMin)}–${formatClock(clash.endMin)} (${clash.title})`, req: "cal:free" });
    }
  }
  return problems;
}

export function checkCalendar(ch: CalendarChallenge, pick: { dayIndex: number; startMin: number } | null): Verdict {
  if (!pick) return reject("Pick a new time first");
  if (pick.dayIndex === ch.current.dayIndex && pick.startMin === ch.current.startMin) {
    return reject("That's the meeting's current time", [{ text: "It clashes with someone's calendar. Choose a new time.", req: "cal:free" }]);
  }
  const problems = calendarProblems(ch, pick.dayIndex, pick.startMin);
  const when = `${formatDay(ch.weekStart + pick.dayIndex)}, ${formatClock(pick.startMin)}–${formatClock(pick.startMin + ch.durationMin)}`;
  if (problems.length) return reject(`Can't book ${when}`, problems);
  return { ok: true, message: `Rescheduled to ${when}.` };
}

// ---------------------------------------------------------------- Spreadsheet

export function normalizeCell(value: string | number): string {
  return String(value).trim().toLowerCase();
}

export function dupKey(row: SheetRow, columns: SheetColumn[]): string {
  return columns.map((c) => normalizeCell(row[c])).join("\u0000");
}

export function compareCells(column: SheetColumn, a: SheetRow, b: SheetRow): number {
  const kind = SHEET_COLUMNS.find((c) => c.key === column)!.kind;
  if (kind === "number") return (a[column] as number) - (b[column] as number);
  if (kind === "date") return String(a[column]).localeCompare(String(b[column]));
  return String(a[column]).localeCompare(String(b[column]), "en", { sensitivity: "base" });
}

/** Stable sort, like a spreadsheet's Data → Sort. */
export function sortRows(rows: SheetRow[], rule: SheetSortRule): SheetRow[] {
  const sign = rule.dir === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((x, y) => sign * compareCells(rule.column, x.row, y.row) || x.index - y.index)
    .map((x) => x.row);
}

/** Spreadsheet-style "Remove duplicates": keeps the first (top-most) row of each group. */
export function removeDuplicates(rows: SheetRow[], columns: SheetColumn[]): SheetRow[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = dupKey(r, columns);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function expectedSheet(ch: SheetChallenge): SheetRow[] {
  const best = new Map<string, SheetRow>();
  for (const r of ch.rows) {
    const k = dupKey(r, ch.dupColumns);
    const cur = best.get(k);
    if (!cur || r.updated > cur.updated) best.set(k, r);
  }
  return sortRows([...best.values()], ch.sort);
}

export function sortLabel(rule: SheetSortRule): string {
  const col = SHEET_COLUMNS.find((c) => c.key === rule.column)!;
  if (col.kind === "number") return `${col.label} (${rule.dir === "desc" ? "highest first" : "lowest first"})`;
  if (col.kind === "date") return `${col.label} (${rule.dir === "desc" ? "newest first" : "oldest first"})`;
  return `${col.label} (${rule.dir === "asc" ? "A → Z" : "Z → A"})`;
}

export function checkSheet(ch: SheetChallenge, rowIds: string[]): Verdict {
  const byId = new Map(ch.rows.map((r) => [r.id, r]));
  const rows = rowIds.map((id) => byId.get(id)!);
  const expected = expectedSheet(ch);
  const expectedIds = new Set(expected.map((r) => r.id));

  const groups = new Map<string, number>();
  rows.forEach((r) => groups.set(dupKey(r, ch.dupColumns), (groups.get(dupKey(r, ch.dupColumns)) ?? 0) + 1));
  const dupRows = [...groups.values()].filter((n) => n > 1).reduce((s, n) => s + n, 0);
  if (dupRows > 0) return reject("Duplicates remain", [{ text: `${dupRows} rows still share the same ${colList(ch.dupColumns)}`, req: "sheet:dups" }]);

  const allKeys = new Set(ch.rows.map((r) => dupKey(r, ch.dupColumns)));
  const missingGroups = allKeys.size - groups.size;
  if (missingGroups > 0) {
    const missing = `${missingGroups} ${missingGroups === 1 ? "record is" : "records are"} missing entirely. Use Undo or Reset`;
    return reject("Too many rows deleted", [{ text: missing, req: "sheet:keep" }]);
  }
  const wrongKept = rows.filter((r) => !expectedIds.has(r.id)).length;
  if (wrongKept > 0) {
    const where = `${wrongKept} duplicate group${wrongKept > 1 ? "s" : ""}`;
    return reject("Wrong row kept", [{ text: `In ${where}, keep the ${ch.keepRule.label} row`, req: "sheet:keep" }]);
  }
  const inOrder = expected.every((r, i) => rows[i].id === r.id);
  if (!inOrder) return reject("Right rows, wrong order", [{ text: `Sort by ${sortLabel(ch.sort)}`, req: "sheet:sort" }]);
  return { ok: true, message: `Sheet cleaned: ${rows.length} rows.` };
}

export function colList(columns: SheetColumn[]): string {
  const labels = columns.map((c) => SHEET_COLUMNS.find((x) => x.key === c)!.label);
  return labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}
