import { expect, test } from "@playwright/test";
import { ready, solveCalendar, solveSheet, solveShopping } from "./helpers";
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
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  const seed = await page.evaluate(() => sessionStorage.getItem("bta:current"));
  expect(seed).toBeTruthy();
  await expect(page.locator("body")).not.toContainText(seed!);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await ready(page);
  await expect(page.locator('.stage-track [aria-current="step"]', { hasText: "Shopping" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(seed!);
  // A reload resumes the same dealt challenge.
  await page.reload();
  await expect(page.locator('.stage-track [aria-current="step"]', { hasText: "Shopping" })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("bta:current"))).toBe(seed);
});

test("full run: three validated stages, each its own race, then a fresh challenge", async ({ page, isMobile }, info) => {
  await page.goto(`#/play/${SEED}`);
  // Nothing of the stages is visible before Start.
  await expect(page.locator(".appwin")).toHaveCount(0);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  // Each stage opens with its task on its own, the clock stopped, then a countdown.
  const brief = page.getByRole("dialog", { name: "Shopping briefing" });
  await expect(brief).toContainText("Race 1 of 3");
  await expect(brief.locator(".task p b").first()).toBeVisible();
  await page.screenshot({ path: `test-results/shots/${info.project.name}-0-briefing.png` });
  await ready(page);

  await expect(page.locator('.stage-track [aria-current="step"]', { hasText: "Shopping" })).toBeVisible();
  // A wrong submission is rejected with a penalty and doesn't advance.
  const ch = generateChallenge(SEED);
  const wrong = ch.shopping.products.find((p) => !solveChallenge(ch).productIds.includes(p.id))!;
  await page.locator(`[data-trace="shop:add:${wrong.id}"]`).click();
  await page.locator('[data-trace="shop:order"]').click();
  const note = page.locator(".inline-error");
  await expect(note).toContainText("doesn't qualify");
  await expect(note).toContainText("+15s");
  // The broken conditions are marked in the task text (the full sentence, or the collapsed header's chips).
  await expect(page.locator(".task p b.failed:visible").first()).toBeVisible();
  await expect(page.locator(".timer-pen")).toHaveText("+15s");
  await page.locator(`[data-trace="shop:remove:${wrong.id}"]`).click();
  await page.locator('[data-trace="shop:cart-close"]').click();
  await page.screenshot({ path: `test-results/shots/${info.project.name}-1-shopping.png` });
  await solveShopping(page, SEED);

  // The clock stays stopped through the next briefing. Each stage is a race on its own clock (the next
  // one hasn't started), with the total so far beside it on wide screens.
  const calBrief = page.getByRole("dialog", { name: "Calendar briefing" });
  await expect(calBrief.getByTestId("brief-cleared")).toContainText("Shopping");
  await expect(calBrief.locator(".brief-verdict")).toHaveText(/^Cleared in \d+\.\ds$/);
  await expect(page.getByTestId("timer")).toHaveText("0:00.0");
  const total = isMobile ? null : await page.getByTestId("total").textContent();
  await page.waitForTimeout(600);
  await expect(page.getByTestId("timer")).toHaveText("0:00.0");
  if (total) await expect(page.getByTestId("total")).toHaveText(total);
  await ready(page);
  await expect(page.locator('.stage-track [aria-current="step"]', { hasText: "Calendar" })).toBeVisible();
  await page.screenshot({ path: `test-results/shots/${info.project.name}-2-calendar.png` });
  await solveCalendar(page, SEED);

  await ready(page);
  await expect(page.locator('.stage-track [aria-current="step"]', { hasText: "Spreadsheet" })).toBeVisible();
  await page.screenshot({ path: `test-results/shots/${info.project.name}-3-sheet.png` });
  await solveSheet(page, SEED);

  await expect(page.getByText("Challenge complete")).toBeVisible();
  const finalTime = await page.getByTestId("final-time").textContent();
  // Timer froze: it must not keep running after completion.
  await page.waitForTimeout(600);
  await expect(page.getByTestId("final-time")).toHaveText(finalTime!);
  await page.screenshot({ path: `test-results/shots/${info.project.name}-4-finish.png` });

  // "Try again" deals one of the recorded challenges and goes straight to its first briefing (no intro).
  await page.getByTestId("next").click();
  await expect(page.getByRole("dialog", { name: "Shopping briefing" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start", exact: true })).toHaveCount(0);
  const next = await page.evaluate(() => sessionStorage.getItem("bta:current"));
  expect(next).toBeTruthy();
  expect(next).not.toBe(SEED);
  const recorded = (await (await page.request.get("runs/index.json")).json()).runs.map((r: { seed: string }) => r.seed);
  expect(recorded).toContain(next);
  // The clock runs once you're ready.
  await ready(page);
  await page.waitForTimeout(1200);
  expect(await page.getByTestId("timer").textContent()).not.toBe("0:00.0");
});

test("Enter starts the challenge, and a finished run becomes the personal best shown on the intro", async ({ page, isMobile }) => {
  await page.goto(`#/play/${SEED}`);
  await expect(page.getByTestId("best")).toHaveCount(0);
  if (!isMobile) await expect(page.locator(".intro-kbd")).toBeVisible();
  await page.keyboard.press("Enter");
  // Enter gets through a briefing too.
  await expect(page.getByRole("dialog", { name: "Shopping briefing" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator(".race-overlay")).toHaveCount(0);
  await expect(page.locator('.stage-track [aria-current="step"]', { hasText: "Shopping" })).toBeVisible();
  await solveShopping(page, SEED);
  await ready(page);
  await solveCalendar(page, SEED);
  await ready(page);
  await solveSheet(page, SEED);
  const finalTime = await page.getByTestId("final-time").textContent();
  // Come back to the same challenge fresh: the intro shows the best time.
  await page.evaluate((seed) => sessionStorage.removeItem(`bta:run:v1:${seed}`), SEED);
  await page.reload();
  // Shown like the per-task times ("18.3s"); the bot finishes well under a minute.
  const seconds = Number(finalTime!.split(":")[1]).toFixed(1);
  await expect(page.getByTestId("best")).toHaveText(`Your best on this challenge: ${seconds}s`);
});

test("the header leads back to the start page, asking first while a run is going", async ({ page }) => {
  await page.goto("#/");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await ready(page);
  await expect(page.locator('.stage-track [aria-current="step"]', { hasText: "Shopping" })).toBeVisible();
  const home = page.locator('[data-trace="hud:home"]');
  await expect(home).toBeVisible();
  // "Stay" keeps the run going.
  await home.click();
  const ask = page.getByRole("dialog", { name: "Leave this run?" });
  await expect(ask.getByRole("button", { name: "Stay" })).toBeFocused();
  await ask.getByRole("button", { name: "Stay" }).click();
  await expect(page.locator('.stage-track [aria-current="step"]', { hasText: "Shopping" })).toBeVisible();
  // "Leave" goes back to the landing page, with the clock not running.
  await home.click();
  await ask.getByRole("button", { name: "Leave" }).click();
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  await expect(page.getByTestId("timer")).toHaveCount(0);
  // And a reload stays there instead of resuming the abandoned run.
  await page.reload();
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
});

test("the results card has a way back to the start page", async ({ page }) => {
  await page.goto(`#/play/${SEED}`);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await ready(page);
  page.on("dialog", () => {
    throw new Error("unexpected native dialog");
  });
  await page.locator('[data-trace="hud:giveup"]').click();
  await page.getByRole("dialog", { name: "Give up this run?" }).getByRole("button", { name: "Give up" }).click();
  await page.getByTestId("home").click();
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  expect(await page.evaluate(() => location.hash)).toBe("#/");
});

test("reloading mid-run resumes the same timer and stage", async ({ page }) => {
  await page.goto(`#/play/${SEED}`);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await ready(page);
  await solveShopping(page, SEED);
  // Mid-briefing, a reload comes back to the same briefing.
  await page.reload();
  await ready(page);
  await expect(page.locator('.stage-track [aria-current="step"]', { hasText: "Calendar" })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.locator('.stage-track [aria-current="step"]', { hasText: "Calendar" })).toBeVisible();
  const t = await page.getByTestId("timer").textContent();
  expect(Number(t!.split(":")[1])).toBeGreaterThanOrEqual(1);
});

test("giving up still reports completed stages", async ({ page }) => {
  await page.goto(`#/play/${SEED}`);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await ready(page);
  await solveShopping(page, SEED);
  await ready(page);
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
  await expect(page.locator('.stage-track [aria-current="step"]', { hasText: "Calendar" })).toBeVisible();
  await page.locator('[data-trace="hud:giveup"]').click();
  await confirm.getByRole("button", { name: "Give up" }).click();
  await expect(page.getByText("Run ended")).toBeVisible();
  await expect(page.getByText("1/3 stages")).toBeVisible();
});
