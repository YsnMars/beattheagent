/**
 * Renders the social preview card (public/og.png, 1200×630) from HTML that mirrors the landing page.
 * Run with `npm run og` after changing the copy or the brand colors.
 */
import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../public/og.png", import.meta.url));
const executablePath = process.env.CHROMIUM_PATH ?? (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);

const tasks = [
  ["Shopping", "Buy headphones within budget, rating, and delivery"],
  ["Calendar", "Reschedule a meeting around everyone's calendars"],
  ["Spreadsheet", "Remove duplicates, keep the right rows, and sort"],
];

const html = `<!doctype html>
<html><head><style>
  * { box-sizing: border-box; margin: 0; }
  body {
    width: 1200px; height: 630px; padding: 64px 80px;
    background: radial-gradient(ellipse 70% 90% at 100% 100%, rgba(108, 88, 214, 0.16), transparent 70%), #f5f5f6;
    color: #1d1e21;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    display: flex; flex-direction: column;
  }
  .brand { display: flex; align-items: center; gap: 12px; font-size: 28px; font-weight: 700; }
  h1 { margin-top: 32px; font-size: 60px; line-height: 1.08; letter-spacing: -0.02em; font-weight: 800; }
  h1 em { font-style: normal; color: #5b4bb7; }
  h1 span { color: #6b6e76; }
  ol { list-style: none; padding: 0; margin-top: auto; display: flex; gap: 20px; }
  li { flex: 1; background: #fff; border: 1px solid #dddde2; border-radius: 14px; padding: 18px 22px; }
  li b { display: block; font-size: 24px; }
  li small { display: block; margin-top: 4px; font-size: 18px; line-height: 1.3; color: #6b6e76; }
  .n { color: #5b4bb7; margin-right: 8px; }
  footer { margin-top: 28px; display: flex; justify-content: space-between; font-size: 22px; color: #6b6e76; }
  footer strong { color: #1d1e21; }
</style></head><body>
  <div class="brand">
    <svg width="26" height="26" viewBox="13 9 43 44"><path d="M19 13l13.5 36.5 4.7-14.6 14.6-4.7z" fill="#1d1e21" stroke="#1d1e21" stroke-width="3" stroke-linejoin="round"/></svg>
    Beat the Agent
  </div>
  <h1>An AI agent did three everyday tasks in <em>under 30&nbsp;seconds</em>.<br><span>Can you do them faster?</span></h1>
  <ol>${tasks.map(([name, desc], i) => `<li><b><span class="n">${i + 1}</span>${name}</b><small>${desc}</small></li>`).join("")}</ol>
  <footer><span>Same tasks, same page, one clock.</span><strong>beattheagent.ysnmars.com</strong></footer>
</body></html>`;

const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.screenshot({ path: out });
await browser.close();
console.log(`Wrote ${out}`);
