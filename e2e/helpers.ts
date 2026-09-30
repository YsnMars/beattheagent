import { expect, type Page } from "@playwright/test";
import { generateChallenge } from "../src/challenge/generate";
import { solveChallenge } from "../src/challenge/solve";
import { formatDay } from "../src/lib/format";

/** Plays a stage the way a person would: through the visible controls only. */
export async function solveShopping(page: Page, seed: string) {
  const ch = generateChallenge(seed);
  const s = ch.shopping;
  await page.getByPlaceholder("Any").fill(String(s.budgetCents / 100));
  await page.locator(`[data-trace="shop:rating:${s.minRating}"]`).click();
  await page.locator('[data-trace="shop:arriveby"]').selectOption({ label: formatDay(s.deadline) });
  await expect(page.getByText("1 result", { exact: true })).toBeVisible();
  const [id] = solveChallenge(ch).productIds;
  await page.locator(`[data-trace="shop:add:${id}"]`).click();
  await page.locator('[data-trace="shop:order"]').click();
}

export async function solveCalendar(page: Page, seed: string) {
  const ch = generateChallenge(seed);
  const [slot] = solveChallenge(ch).slots;
  await page.locator('[data-trace="cal:form-day"]').selectOption(String(slot.dayIndex));
  await page.locator('[data-trace="cal:form-start"]').selectOption(String(slot.startMin));
  await page.locator('[data-trace="cal:save"]').click();
}

export async function solveSheet(page: Page, seed: string) {
  const { sheet } = generateChallenge(seed);
  // Newest first, remove duplicates (keeps the top row = most recent), then the requested sort.
  await page.locator('[data-trace="sheet:sort:updated:desc"]').click();
  await page.locator('[data-trace="sheet:dedupe"]').click();
  for (const c of sheet.dupColumns) await page.locator(`[data-trace="sheet:dcol:${c}"]`).check();
  await page.locator('[data-trace="sheet:dapply"]').click();
  await page.locator(`[data-trace="sheet:sort:${sheet.sort.column}:${sheet.sort.dir}"]`).click();
  await page.locator('[data-trace="sheet:submit"]').click();
}
