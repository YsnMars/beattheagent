import { calendarProblems, expectedSheet, productProblems } from "./validate";
import { CAL_SLOTS, CAL_START, SLOT_MIN, type Challenge } from "./types";

/** Reference solutions, used by tests and the e2e "perfect human" run. */
export function solveChallenge(ch: Challenge) {
  const product = ch.shopping.products.filter((p) => productProblems(ch.shopping, p.id).length === 0);
  const slots: { dayIndex: number; startMin: number }[] = [];
  for (let d = 0; d < 5; d++) {
    for (let s = CAL_START; s + ch.calendar.durationMin <= CAL_START + CAL_SLOTS * SLOT_MIN; s += SLOT_MIN) {
      if (calendarProblems(ch.calendar, d, s).length === 0) slots.push({ dayIndex: d, startMin: s });
    }
  }
  return {
    productIds: product.map((p) => p.id),
    slots,
    sheetIds: expectedSheet(ch.sheet).map((r) => r.id),
  };
}
