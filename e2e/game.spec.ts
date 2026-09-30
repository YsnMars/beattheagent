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

test("landing page renders and links into a challenge", async ({ page }) => {
  await page.goto("#/");
  await expect(page.getByRole("heading", { name: /Beat the Agent/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How it works" })).toBeVisible();
  const cta = page.locator(".hero-actions a").first();
  await cta.click();
  await expect(page.getByRole("button", { name: "Start challenge" })).toBeVisible();
});

test("full run: three validated stages, one timer, results, and a shareable scorecard", async ({ page }, info) => {
  await page.goto(`#/play/${SEED}`);
  await expect(page.getByText(`Challenge #${SEED}`)).toBeVisible();
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
  await expect(page.getByText("+15s pen.")).toBeVisible();
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
  await expect(page.locator(".finish-splits li")).toHaveCount(3);
  await page.screenshot({ path: `test-results/shots/${info.project.name}-4-finish.png` });

  await page.getByLabel("Name on your scorecard").fill("Robin");
  await page.getByTestId("see-results").click();
  await expect(page.getByTestId("results-time")).toHaveText(finalTime!);
  await expect(page.getByText("Per-stage splits")).toBeVisible();
  await page.screenshot({ path: `test-results/shots/${info.project.name}-5-results.png`, fullPage: true });

  // The share link opens a scorecard that starts the identical challenge.
  const link = await page.getByTestId("share-link").inputValue();
  expect(link).toContain("#/c/");
  await page.goto(link);
  await expect(page.getByTestId("scorecard")).toContainText("Robin");
  await expect(page.getByTestId("scorecard")).toContainText(finalTime!);
  await page.screenshot({ path: `test-results/shots/${info.project.name}-6-card.png`, fullPage: true });
  await page.getByTestId("take-challenge").click();
  await expect(page.getByRole("heading", { name: "Three tasks. One clock." })).toBeVisible();
  await page.getByRole("button", { name: "Start challenge" }).click();
  await expect(page.getByText("Stage 1 of 3 · Shopping")).toBeVisible();
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
  page.once("dialog", (d) => d.accept());
  await page.locator('[data-trace="hud:giveup"]').click();
  await expect(page.getByText("Run ended")).toBeVisible();
  await expect(page.getByText("1/3 stages")).toBeVisible();
});
