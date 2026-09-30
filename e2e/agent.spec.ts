import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { solveCalendar, solveSheet, solveShopping } from "./helpers";

// Uses whichever recorded agent runs are committed in public/runs.
const index = JSON.parse(readFileSync("public/runs/index.json", "utf8")) as { runs: { seed: string; totalMs: number; modelLabel: string }[] };
const run = index.runs[0];

test.skip(!run, "no recorded agent runs");

test("racing a recorded agent: ghost in the HUD, then a you-vs-agent summary", async ({ page }) => {
  await page.goto(`#/play/${run.seed}`);
  await expect(page.locator(".intro")).toContainText(run.modelLabel);
  await page.getByRole("button", { name: "Start challenge" }).click();
  await expect(page.locator(".ghost")).toBeVisible();
  await solveShopping(page, run.seed);
  await solveCalendar(page, run.seed);
  await solveSheet(page, run.seed);
  await expect(page.getByText("Challenge complete")).toBeVisible();
  await expect(page.getByTestId("takeaway")).toContainText(/agent/);
  await expect(page.locator(".osplit")).toHaveCount(3);
  await page.getByTestId("watch-agent").click();
  await expect(page.getByRole("heading", { name: `How ${run.modelLabel} did it` })).toBeVisible();
});

test("replay rebuilds the agent's run from its recorded log", async ({ page }, info) => {
  await page.goto(`#/replay/${run.seed}`);
  await expect(page.getByRole("heading", { name: new RegExp(run.modelLabel) })).toBeVisible();
  // Autoplays in real time; speed it up and let it reach the end.
  await page.getByRole("button", { name: "4×" }).click();
  await expect(page.locator(".frame-viewport").getByText("Challenge complete")).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: `test-results/shots/${info.project.name}-replay.png`, fullPage: true });
});
