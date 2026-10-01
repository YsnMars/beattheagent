/**
 * Renders the social preview card (public/og.png, 1200×630) from HTML in the site's own look.
 * Run with `npm run og` after changing the copy or the brand.
 */
import { chromium } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../public/og.png", import.meta.url));
const executablePath = process.env.CHROMIUM_PATH ?? (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
const font = (path: string) => `data:font/woff2;base64,${readFileSync(fileURLToPath(new URL(`../node_modules/${path}`, import.meta.url))).toString("base64")}`;
const archivo = font("@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2");
const serif = font("@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2");

const icon = (d: string) =>
  `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const tasks = [
  ["Shopping", "#ffa463", "rgba(249,115,22,.16)", icon('<path d="M5 8h14l-1 12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>')],
  ["Calendar", "#93b8ff", "rgba(59,130,246,.18)", icon('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>')],
  ["Spreadsheet", "#74dd9c", "rgba(34,197,94,.16)", icon('<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M3.5 15h17M9.5 4v16"/>')],
];

const html = `<!doctype html>
<html><head><style>
  @font-face { font-family: Archivo; src: url(${archivo}) format("woff2-variations"); font-weight: 100 900; font-stretch: 62% 125%; }
  @font-face { font-family: "Instrument Serif"; src: url(${serif}) format("woff2"); font-style: italic; }
  * { box-sizing: border-box; margin: 0; }
  body {
    position: relative; overflow: hidden;
    width: 1200px; height: 630px; padding: 56px 72px;
    background: radial-gradient(60% 70% at 100% 0%, rgba(134,108,255,.32), transparent 70%),
                radial-gradient(45% 55% at 0% 100%, rgba(190,235,30,.14), transparent 70%), #0b0b10;
    color: #f4f3f8; font-family: Archivo, system-ui, sans-serif; -webkit-font-smoothing: antialiased;
    display: flex; flex-direction: column;
  }
  body::before {
    content: ""; position: absolute; inset: 0;
    background-image: linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px);
    background-size: 48px 48px; -webkit-mask-image: radial-gradient(80% 80% at 80% 0%, #000, transparent 75%);
  }
  header, main, footer { position: relative; }
  header { display: flex; justify-content: space-between; align-items: center; }
  .brand { display: flex; align-items: center; gap: 12px; font-size: 26px; font-weight: 850; font-stretch: 118%; letter-spacing: -.02em; }
  .url { font-size: 20px; font-weight: 600; color: #8f8d9c; }
  main { margin-top: 30px; display: grid; grid-template-columns: auto 1fr; column-gap: 40px; align-items: end; }
  .kicker { grid-column: 1 / -1; display: flex; align-items: center; gap: 12px; font-size: 17px; font-weight: 700; font-stretch: 115%; letter-spacing: .14em; text-transform: uppercase; color: #8f8d9c; }
  .kicker i { width: 12px; height: 12px; border-radius: 50%; background: #7a5cff; box-shadow: 0 0 0 6px rgba(122,92,255,.2); }
  .figure { font-size: 228px; font-weight: 900; font-stretch: 112%; letter-spacing: -.065em; line-height: .8; margin: 18px 0 0 -8px; }
  .figure small { font-size: .5em; letter-spacing: -.04em; }
  .copy { padding-bottom: 8px; }
  .claim { font-size: 30px; font-weight: 600; line-height: 1.25; color: #cbcad4; max-width: 15em; }
  .dare { margin-top: 10px; font-family: "Instrument Serif", Georgia, serif; font-style: italic; font-size: 64px; line-height: 1; letter-spacing: -.02em; }
  footer { margin-top: auto; display: flex; gap: 14px; align-items: center; }
  .task { display: flex; align-items: center; gap: 14px; padding: 12px 22px 12px 12px; border-radius: 20px; background: #15151c; border: 1px solid rgba(255,255,255,.08); font-size: 22px; font-weight: 800; font-stretch: 110%; }
  .task span { display: grid; place-items: center; width: 46px; height: 46px; border-radius: 14px; }
  .go { margin-left: auto; padding: 18px 34px; border-radius: 20px; background: #d4ff3a; color: #141a00; font-size: 26px; font-weight: 850; font-stretch: 115%; box-shadow: 0 16px 40px -14px rgba(170,220,0,.8); }
</style></head><body>
  <header>
    <div class="brand">
      <svg width="30" height="30" viewBox="0 0 24 24"><path d="M9 8l5.1 13.9 1.8-5.6 5.6-1.7z" fill="#fff" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><path d="M8.5 1.8v2.6M1.8 8.5h2.6M3.4 3.4l1.9 1.9" stroke="#8e74ff" stroke-width="2" stroke-linecap="round"/></svg>
      Beat the Agent
    </div>
    <div class="url">beattheagent.ysnmars.com</div>
  </header>
  <main>
    <div class="kicker"><i></i>An AI agent's time to beat</div>
    <div class="figure">&lt;30<small>s</small></div>
    <div class="copy">
      <p class="claim">for three everyday browser tasks. Same tasks, same page, one clock.</p>
      <p class="dare">Can you do them faster?</p>
    </div>
  </main>
  <footer>
    ${tasks.map(([name, color, bg, svg]) => `<div class="task"><span style="color:${color};background:${bg}">${svg}</span>${name}</div>`).join("")}
    <div class="go">Start →</div>
  </footer>
</body></html>`;

const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out });
await browser.close();
console.log(`Wrote ${out}`);
