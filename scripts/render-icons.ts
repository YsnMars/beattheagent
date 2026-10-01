/**
 * Renders the home-screen icons (public/icons/*.png) from the brand mark. Run with `npx tsx
 * scripts/render-icons.ts` after changing public/favicon.svg's artwork.
 */
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../public/icons/", import.meta.url));
mkdirSync(dir, { recursive: true });
const executablePath = process.env.CHROMIUM_PATH ?? (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);

// `maskable` keeps the mark inside the central safe zone, on a full-bleed background (Android crops it to a shape).
const mark = (size: number, maskable: boolean) => {
  const scale = maskable ? 1.55 : 2.2;
  const offset = (64 - 20 * scale) / 2 - 1.8 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8e74ff"/><stop offset="1" stop-color="#4f2fdc"/></linearGradient></defs>
  <rect width="64" height="64" rx="${maskable ? 0 : 14}" fill="url(#g)"/>
  <g transform="translate(${offset + 0.5} ${offset}) scale(${scale})" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 8l5.1 13.9 1.8-5.6 5.6-1.7z" fill="#fff" stroke="#fff" stroke-width="1.6"/>
    <path d="M8.5 1.8v2.6M1.8 8.5h2.6M3.4 3.4l1.9 1.9" fill="none" stroke="#d4ff3a" stroke-width="2.2"/>
  </g></svg>`;
};

const icons: [string, number, boolean][] = [
  ["apple-touch-icon.png", 180, true],
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true],
];

const browser = await chromium.launch(executablePath ? { executablePath } : {});
for (const [name, size, maskable] of icons) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0;background:transparent">${mark(size, maskable)}</body>`);
  await page.screenshot({ path: dir + name, omitBackground: true });
  await page.close();
}
await browser.close();
console.log(`Wrote ${icons.length} icons to ${dir}`);
