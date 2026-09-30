// Calendar dates are plain day numbers (days since 1970-01-01, UTC) so rendering never depends
// on the viewer's time zone.

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dayFromIso(iso: string): number {
  return Math.round(Date.parse(iso + "T00:00:00Z") / DAY_MS);
}

export function isoFromDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** "Thu, Oct 15" */
export function formatDay(day: number): string {
  const d = new Date(day * DAY_MS);
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "Thursday" */
export function weekdayLong(day: number): string {
  return WEEKDAYS_LONG[new Date(day * DAY_MS).getUTCDay()];
}

export function weekdayShort(day: number): string {
  return WEEKDAYS[new Date(day * DAY_MS).getUTCDay()];
}

export function monthDay(day: number): string {
  const d = new Date(day * DAY_MS);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Minutes after midnight → "13:30" */
export function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** 83_456 ms → "1:23.4" */
export function formatDuration(ms: number, decimals = 1): string {
  const safe = Math.max(0, ms);
  const totalSeconds = safe / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  const secText = seconds.toFixed(decimals).padStart(decimals ? 3 + decimals : 2, "0");
  return `${minutes}:${secText}`;
}

/** Signed difference, e.g. "+12.3s" / "−4.0s" / "+1:02.5" */
export function formatDelta(ms: number): string {
  const sign = ms < 0 ? "−" : "+";
  const abs = Math.abs(ms);
  return abs < 60_000 ? `${sign}${(abs / 1000).toFixed(1)}s` : `${sign}${formatDuration(abs)}`;
}

export function formatUsd(amount: number): string {
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(amount < 1 ? 3 : 2)}`;
}

export function formatInt(n: number): string {
  return n.toLocaleString("en-US");
}
