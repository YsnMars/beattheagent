import { expect, test } from "@playwright/test";
import { solveCalendar, solveSheet, solveShopping } from "./helpers";
import { generateChallenge } from "../src/challenge/generate";
import { solveChallenge } from "../src/challenge/solve";

const SEED = "E2E7Q";

test.beforeEach(async ({ page }, info) => {
  page.on("pageerror", (e) => {
    throw new Error(`page error: ${e.message}`);
  });
  info.annotations.push({ type: "seed", description: SEED });
});

test("home deals a challenge that starts in one click, without exposing the seed", async ({ page }) => {
  await page.goto("#/");
  await expect(page.getByRole("button", { name: "Start challenge" })).toBeVisible();
  const seed = await page.evaluate(() => sessionStorage.getItem("bta:current"));
  expect(seed).toBeTruthy();
  await expect(page.locator("body")).not.toContainText(seed!);
  await page.getByRole("button", { name: "Start challenge" }).click();
  await expect(page.getByText("Stage 1 of 3 · Shopping")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(seed!);
  // A reload resumes the same dealt challenge.
  await page.reload();
  await expect(page.getByText("Stage 1 of 3 · Shopping")).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("bta:current"))).toBe(seed);
});

test("full run: three validated stages, one timer, then a fresh challenge", async ({ page }, info) => {
  await page.goto(`#/play/${SEED}`);
  // Nothing of the stages is visible before Start.
  await expect(page.locator(".appwin")).toHaveCount(0);
  await page.getByRole("button", { name: "Start challenge" }).click();

  await expect(page.getByText("Stage 1 of 3 · Shopping")).toBeVisible();
  // A wrong submission is rejected with a penalty and doesn't advance.
  const ch = generateChallenge(SEED);
  const wrong = ch.shopping.products.find((p) => !solveChallenge(ch).productIds.includes(p.id))!;
  await page.locator(`[data-trace="shop:add:${wrong.id}"]`).click();
  await page.locator('[data-trace="shop:order"]').click();
  await expect(page.getByText(/Rejected \(\+15s\)/)).toBeVisible();
  await expect(page.locator(".timer-pen")).toHaveText("+15s");
  await page.locator(`[data-trace="shop:remove:${wrong.id}"]`).click();
  await page.locator('[data-trace="shop:cart-close"]').click();
  await page.screenshot({ path: `test-results/shots/${info.project.name}-1-shopping.png` });
  await solveShopping(page, SEED);

  await expect(page.getByText("Stage 2 of 3 · Calendar")).toBeVisible();
  await page.screenshot({ path: `test-results/shots/${info.project.name}-2-calendar.png` });
  await solveCalendar(page, SEED);

  await expect(page.getByText("Stage 3 of 3 · Spreadsheet")).toBeVisible();
  await page.screenshot({ path: `test-results/shots/${info.project.name}-3-sheet.png` });
  await solveSheet(page, SEED);

  await expect(page.getByText("Challenge complete")).toBeVisible();
  const finalTime = await page.getByTestId("final-time").textContent();
  // Timer froze: it must not keep running after completion.
  await page.waitForTimeout(600);
  await expect(page.getByTestId("final-time")).toHaveText(finalTime!);
  await page.screenshot({ path: `test-results/shots/${info.project.name}-4-finish.png` });

  // "Try again" deals one of the recorded challenges and starts it straight away (no intro).
  await page.getByTestId("next").click();
  await expect(page.getByText("Stage 1 of 3 · Shopping")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start challenge" })).toHaveCount(0);
  const next = await page.evaluate(() => sessionStorage.getItem("bta:current"));
  expect(next).toBeTruthy();
  expect(next).not.toBe(SEED);
  const recorded = (await (await page.request.get("runs/index.json")).json()).runs.map((r: { seed: string }) => r.seed);
  expect(recorded).toContain(next);
  // The clock is running.
  await page.waitForTimeout(1200);
  expect(await page.getByTestId("timer").textContent()).not.toBe("0:00.0");
});

test("reloading mid-run resumes the same timer and stage", async ({ page }) => {
  await page.goto(`#/play/${SEED}`);
  await page.getByRole("button", { name: "Start challenge" }).click();
  await solveShopping(page, SEED);
  await expect(page.getByText("Stage 2 of 3 · Calendar")).toBeVisible();
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.getByText("Stage 2 of 3 · Calendar")).toBeVisible();
  const t = await page.getByTestId("timer").textContent();
  expect(Number(t!.split(":")[1])).toBeGreaterThanOrEqual(1);
});

test("giving up still reports completed stages", async ({ page }) => {
  await page.goto(`#/play/${SEED}`);
  await page.getByRole("button", { name: "Start challenge" }).click();
  await solveShopping(page, SEED);
  // Asks first; "Keep going" (focused by default) and Escape both back out without ending the run.
  await page.locator('[data-trace="hud:giveup"]').click();
  const confirm = page.getByRole("dialog", { name: "Give up this run?" });
  await expect(confirm).toBeVisible();
  await expect(confirm.getByRole("button", { name: "Keep going" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(confirm).toHaveCount(0);
  await page.locator('[data-trace="hud:giveup"]').click();
  await confirm.getByRole("button", { name: "Keep going" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(page.getByText("Stage 2 of 3 · Calendar")).toBeVisible();
  await page.locator('[data-trace="hud:giveup"]').click();
  await confirm.getByRole("button", { name: "Give up" }).click();
  await expect(page.getByText("Run ended")).toBeVisible();
  await expect(page.getByText("1/3 stages")).toBeVisible();
});
