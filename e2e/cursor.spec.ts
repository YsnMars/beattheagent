import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { AgentRun } from "../src/game/agentRuns";
import type { RunEvent } from "../src/game/run";
import { generateChallenge } from "../src/challenge/generate";

const recording = JSON.parse(readFileSync("public/runs/K7M2Q/run.json", "utf8")) as AgentRun;
const start = new Date("2026-09-30T12:00:00Z").getTime();

/** A recorded race with enough time between clicks to scroll while the pointer is idle. */
async function cursorRace(page: Page, next = "shop:maxprice") {
  const events: RunEvent[] = [
    { k: "start", at: start },
    ...["shop:search", next, "shop:search"].map((tgt, i): RunEvent => ({
      k: "ptr", at: start + 5000 + i * 4000, tgt, fx: 0.5, fy: 0.5,
      x: 0, y: 0, vw: 1280, vh: 800, sy: 0,
    })),
  ];
  await page.clock.install({ time: start - 10_000 });
  await page.route(`**/runs/${recording.seed}/run.json`, (route) => route.fulfill({
    json: { ...recording, events, splits: [60_000], totalMs: 60_000 },
  }));
  // Resume a running human race without a briefing or countdown.
  await page.addInitScript(({ seed, at }) => {
    sessionStorage.setItem(`bta:run:v1:${seed}`, JSON.stringify([{ k: "start", at, brief: true }]));
  }, { seed: recording.seed, at: start });
  await page.goto(`#/play/${recording.seed}`);
  await expect(page.locator(".ghost-race .agent-cursor")).toBeAttached();
  await page.clock.pauseAt(start);
  await page.clock.runFor(5300);
}

async function point(page: Page) {
  return page.locator(".ghost-race .agent-cursor").evaluate((el) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return { x: matrix.m41, y: matrix.m42 };
  });
}

async function targetPoint(page: Page, trace: string) {
  return page.locator(`[data-trace="${trace}"]`).evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
}

test("an idle agent cursor stays still when the player scrolls or its target disappears", async ({ page }) => {
  await cursorRace(page);
  const before = await point(page);
  const targetBefore = await targetPoint(page, "shop:search");
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.clock.runFor(100);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  expect(await targetPoint(page, "shop:search")).not.toEqual(targetBefore);
  expect(await point(page)).toEqual(before);

  await page.locator('[data-trace="shop:search"]').evaluate((el) => el.remove());
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.clock.runFor(100);
  expect(await point(page)).toEqual(before);
});

test("the agent can glide above the viewport and return on its next move", async ({ page }) => {
  await cursorRace(page);
  await page.evaluate(() => window.scrollTo(0, 1000));
  await page.clock.runFor(100);
  const target = await targetPoint(page, "shop:maxprice");
  expect(target.y).toBeLessThan(-24);
  const scroll = await page.evaluate(() => window.scrollY);
  await page.clock.runFor(4000);
  const offscreen = await point(page);
  expect(offscreen.x).toBeCloseTo(target.x, 2);
  expect(offscreen.y).toBeCloseTo(target.y, 2);
  await expect(page.locator(".ghost-race .agent-cursor")).not.toBeInViewport();
  await expect(page.locator(".ghost-race .agent-bubble")).toBeHidden();
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);

  // Scrolling the old target back into view doesn't move the idle pointer.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.clock.runFor(100);
  expect(await point(page)).toEqual(offscreen);
  await page.clock.runFor(4000);
  const returned = await point(page);
  const search = await targetPoint(page, "shop:search");
  expect(returned.x).toBeCloseTo(search.x, 2);
  expect(returned.y).toBeCloseTo(search.y, 2);
  await expect(page.locator(".ghost-race .agent-cursor")).toBeInViewport();
  await expect(page.locator(".ghost-race .agent-bubble")).toBeVisible();
});

test("a cursor below the viewport hides its label without extending the page", async ({ page }) => {
  const product = generateChallenge(recording.seed).shopping.products.at(-1)!;
  const trace = `shop:add:${product.id}`;
  await cursorRace(page, trace);
  const target = await targetPoint(page, trace);
  expect(target.y).toBeGreaterThan(page.viewportSize()!.height);
  const size = () => page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }));
  const before = await size();
  await page.clock.runFor(4000);
  const cursor = await point(page);
  expect(cursor.x).toBeCloseTo(target.x, 2);
  expect(cursor.y).toBeCloseTo(target.y, 2);
  await expect(page.locator(".ghost-race .agent-cursor")).not.toBeInViewport();
  await expect(page.locator(".ghost-race .agent-bubble")).toBeHidden();
  expect(await size()).toEqual(before);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("a missing next target leaves the cursor at its last screen position", async ({ page }) => {
  await cursorRace(page, "shop:missing");
  const before = await point(page);
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.clock.runFor(4000);
  expect(await point(page)).toEqual(before);
});
