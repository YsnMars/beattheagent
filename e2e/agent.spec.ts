import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { solveCalendar, solveSheet, solveShopping } from "./helpers";

// Uses whichever recorded agent runs are committed in public/runs.
const index = JSON.parse(readFileSync("public/runs/index.json", "utf8")) as { runs: { seed: string; totalMs: number; modelLabel: string }[] };
const run = index.runs[0];

test.skip(!run, "no recorded agent runs");

test("racing a recorded agent: ghost in the HUD, head-to-head verdict and splits", async ({ page }) => {
  await page.goto(`#/play/${run.seed}`);
  await expect(page.locator(".intro-ghost")).toContainText(run.modelLabel);
  await page.getByRole("button", { name: "Start challenge" }).click();
  await expect(page.locator(".ghost")).toBeVisible();
  await solveShopping(page, run.seed);
  await solveCalendar(page, run.seed);
  await solveSheet(page, run.seed);
  await expect(page.getByTestId("verdict")).toBeVisible();
  await page.getByTestId("see-results").click();
  await expect(page.getByTestId("verdict")).toContainText(/beat the agent|wins|Dead heat/);
  await expect(page.locator(".split-row")).toHaveCount(3);
  await expect(page.getByText("About the agent's run")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download image" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`beat-the-agent-${run.seed}.png`);
  const { size } = await import("node:fs").then((fs) => file.path().then((p) => fs.statSync(p)));
  expect(size).toBeGreaterThan(10_000);
});

test("replay rebuilds the agent's run from its recorded log", async ({ page }, info) => {
  await page.goto(`#/replay/${run.seed}`);
  await expect(page.getByRole("heading", { name: new RegExp(run.modelLabel) })).toBeVisible();
  await page.getByRole("button", { name: /Spreadsheet clear/ }).click();
  await page.getByRole("button", { name: "8×" }).click();
  await page.getByTestId("replay-play").click();
  await expect(page.locator(".frame-viewport").getByText("Challenge complete")).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: `test-results/shots/${info.project.name}-replay.png`, fullPage: true });
});
