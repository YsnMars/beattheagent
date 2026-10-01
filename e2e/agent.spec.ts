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
  await page.getByRole("button", { name: "Start", exact: true }).click();
  // The race status says who's ahead, not just where the agent is.
  await expect(page.locator(".ghost")).toHaveText(/^(Agent (\d stages? ahead|also on \w+|finished · \d:\d\d\.\d)|You're \d stages? ahead)$/);
  await solveShopping(page, run.seed);
  // Clearing a stage shows your gap to the agent at that point.
  await expect(page.locator(".task-cleared")).toContainText(/(behind|ahead of|level with) the agent/);
  await solveCalendar(page, run.seed);
  await solveSheet(page, run.seed);
  // The headline is the result; both sides show a time; the agent's API cost is listed.
  await expect(page.getByTestId("takeaway")).toContainText(/agent/);
  await expect(page.locator(".side.agent")).toContainText(/\d:\d\d\.\d/);
  await expect(page.getByTestId("agent-cost")).toContainText(/\$\d|not reported/);
  await expect(page.locator(".osplit")).toHaveCount(3);
  await page.getByTestId("watch-agent").click();
  await expect(page.getByRole("heading", { name: `${run.modelLabel} replay` })).toBeVisible();
});

test("giving up shows where you stopped, next to the agent's full run", async ({ page }) => {
  await page.goto(`#/play/${run.seed}`);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await solveShopping(page, run.seed);
  await expect(page.locator('.stage-track [aria-current="step"]', { hasText: "Calendar" })).toBeVisible();
  await page.locator('[data-trace="hud:giveup"]').click();
  await page.getByRole("dialog", { name: "Give up this run?" }).getByRole("button", { name: "Give up" }).click();
  await expect(page.getByTestId("takeaway")).toContainText(/^You stopped on Calendar at \d:\d\d\.\d\. The agent (had finished by|finished in) \d:\d\d\.\d\.$/);
  // Your time, not a stage count.
  await expect(page.getByTestId("final-time")).toHaveText(/^\d:\d\d\.\d$/);
  await expect(page.locator(".side").first()).toContainText("1 of 3 done");
  await expect(page.getByTestId("split-shopping")).not.toContainText("—");
  await expect(page.getByTestId("split-calendar")).toContainText(/stopped at \d+\.\ds/);
  await expect(page.getByTestId("split-sheet")).toContainText("—");
});

test("replay rebuilds the agent's run from its recorded log at the viewer's size", async ({ page }, info) => {
  await page.goto(`#/replay/${run.seed}`);
  await expect(page.getByRole("heading", { name: new RegExp(run.modelLabel) })).toBeVisible();
  // The real game UI, not a scaled-down frame: it fills the viewer's own viewport.
  await expect(page.locator('.stage-track [aria-current="step"]', { hasText: "Shopping" })).toBeVisible();
  const width = await page.locator(".replay-stage .game").evaluate((el) => el.getBoundingClientRect().width);
  expect(width).toBe(page.viewportSize()!.width);
  // The agent's current step is shown next to its cursor.
  await expect(page.locator(".agent-step.pos-0")).toBeVisible();
  await page.screenshot({ path: `test-results/shots/${info.project.name}-replay-mid.png` });
  // Autoplays in real time; speed it up and let it reach the end.
  await page.getByRole("button", { name: "4×" }).click();
  await expect(page.getByRole("dialog", { name: "Replay finished" })).toContainText(`${run.modelLabel} finished in`, { timeout: 20_000 });
  await page.screenshot({ path: `test-results/shots/${info.project.name}-replay.png`, fullPage: true });
});
