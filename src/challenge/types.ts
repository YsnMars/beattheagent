export type StageId = "shopping" | "calendar" | "sheet";

export const STAGES: { id: StageId; title: string; app: string; blurb: string }[] = [
  { id: "shopping", title: "Shopping", app: "SoundMarket", blurb: "Buy headphones that fit a budget, rating, and delivery deadline." },
  { id: "calendar", title: "Calendar", app: "Cadence", blurb: "Reschedule a meeting around everyone's calendars and working hours." },
  { id: "sheet", title: "Spreadsheet", app: "Gridly", blurb: "Remove duplicates, keep the right rows, and sort what's left." },
];

// ---------- Shopping ----------

export type Product = {
  id: string;
  brand: string;
  model: string;
  style: "Over-ear" | "On-ear" | "In-ear" | "Open-ear";
  priceCents: number;
  listPriceCents: number | null; // struck-through original price, if on sale
  rating: number; // one decimal
  reviews: number;
  deliveryDay: number;
  hue: number; // for the generated product art
  badge: string | null;
};

export type ShoppingChallenge = {
  today: number;
  budgetCents: number;
  minRating: number;
  deadline: number;
  products: Product[];
};

// ---------- Calendar ----------

export const CAL_START = 8 * 60; // grid starts 08:00
export const CAL_SLOTS = 22; // 30-minute slots → 08:00–19:00
export const SLOT_MIN = 30;

export type Attendee = {
  id: string;
  name: string;
  initials: string;
  color: string;
  startMin: number; // working hours, minutes after midnight
  endMin: number;
};

export type CalEvent = {
  id: string;
  attendeeId: string;
  dayIndex: number; // 0..4 (Mon..Fri)
  startMin: number;
  endMin: number;
  title: string;
};

export type CalendarChallenge = {
  weekStart: number; // Monday
  meetingTitle: string;
  durationMin: number;
  attendees: Attendee[];
  events: CalEvent[];
  current: { dayIndex: number; startMin: number };
  clashEventId: string | null; // the newly booked event that forces the reschedule
};

// ---------- Spreadsheet ----------

export type SheetColumn = "name" | "email" | "company" | "plan" | "seats" | "updated";

export const SHEET_COLUMNS: { key: SheetColumn; label: string; kind: "text" | "number" | "date" }[] = [
  { key: "name", label: "Name", kind: "text" },
  { key: "email", label: "Email", kind: "text" },
  { key: "company", label: "Company", kind: "text" },
  { key: "plan", label: "Plan", kind: "text" },
  { key: "seats", label: "Seats", kind: "number" },
  { key: "updated", label: "Updated", kind: "date" },
];

export type SheetRow = {
  id: string;
  name: string;
  email: string;
  company: string;
  plan: string;
  seats: number;
  updated: string; // ISO date
};

export type SheetSortRule = { column: SheetColumn; dir: "asc" | "desc" };

export type SheetChallenge = {
  rows: SheetRow[]; // initial order
  dupColumns: SheetColumn[];
  keepRule: { column: "updated"; label: string };
  sort: SheetSortRule;
};

export type Challenge = {
  seed: string;
  version: number;
  shopping: ShoppingChallenge;
  calendar: CalendarChallenge;
  sheet: SheetChallenge;
};

export const CHALLENGE_VERSION = 1;
