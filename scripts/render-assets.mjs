// Renders the toolbar/store icons (16, 32, 48, 128) from the site's logo mark and the 440x280 small promo tile.
// Usage: node scripts/render-assets.mjs   (needs Playwright; PLAYWRIGHT_DIR defaults to many_sites/node_modules)
import { createRequire } from "node:module";
import { readFileSync, copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.PLAYWRIGHT_DIR || "/Volumes/exernal SSD/MacData/Development/many_sites/node_modules", "playwright"));

const font = readFileSync(path.join(root, "extension/fonts/manrope.woff2")).toString("base64");
const fontCss = `@font-face{font-family:Manrope;src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:200 800}`;

// The site's favicon (little-weekend public/favicon.svg): a yellow disc with an ink sprout. Small sizes get a
// heavier stroke so the sprout survives at 16 px.
const mark = stroke => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="#f9d95e"/><g fill="none" stroke="#243d32" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"><path d="M32 50V30"/><path d="M32 34c0-7-5-12-13-12 0 7 5 12 13 12z"/><path d="M32 30c0-7 5-12 13-12 0 7-5 12-13 12z"/><path d="M22 50h20"/></g></svg>`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
mkdirSync(path.join(root, "extension/icons"), { recursive: true });
mkdirSync(path.join(root, "store"), { recursive: true });

// Chrome Web Store guidance: the 128 icon is 96x96 artwork with 16 px of transparent padding.
for (const [size, art, stroke] of [[16, 16, 5.2], [32, 32, 4.6], [48, 46, 4], [128, 96, 3.6]]) {
  const pad = (size - art) / 2;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px;padding:${pad}px;box-sizing:border-box">${mark(stroke).replace("<svg ", `<svg width="${art}" height="${art}" style="display:block" `)}</div></body></html>`);
  await page.screenshot({ path: path.join(root, `extension/icons/icon${size}.png`), omitBackground: true });
  copyFileSync(path.join(root, `extension/icons/icon${size}.png`), path.join(root, `store/icon${size}.png`));
}

// Small promo tile, 440x280.
await page.setViewportSize({ width: 440, height: 280 });
await page.setContent(`<html><head><style>${fontCss}
 body{margin:0;width:440px;height:280px;overflow:hidden;font-family:Manrope,Arial,sans-serif;background:#243d32;color:#faf9f5;position:relative}
 .brand{position:absolute;left:30px;top:28px;display:flex;align-items:center;gap:10px;font-weight:800;font-size:21px;letter-spacing:-1px}
 .brand .d{color:#c79a28}
 h1{position:absolute;left:30px;top:82px;margin:0;font-size:31px;line-height:1.14;letter-spacing:-1.4px;font-weight:800;width:270px}
 h1 span{color:#f9d95e}
 p{position:absolute;left:30px;bottom:26px;margin:0;font-size:13px;font-weight:600;color:#c9dcb9}
 .big{position:absolute;right:-44px;top:70px;transform:rotate(8deg)}
 .card{position:absolute;right:-30px;top:44px;width:150px;background:#fff;border:1px solid #e6e8e0;border-radius:12px;padding:11px 12px;transform:rotate(6deg);box-shadow:0 8px 24px #243d3214}
 .card b{display:block;font-size:12px;line-height:1.3;margin:3px 0 6px}
 .card i{font-style:normal;font-size:9.5px;font-weight:700;color:#5f7a4e}
 .card u{text-decoration:none;font-size:9px;font-weight:700;background:#e3efd6;color:#3f6332;padding:2px 6px;border-radius:4px}
 .c2{top:150px;right:-6px;transform:rotate(-4deg)}
</style></head><body>
 <div class="brand">${mark(3.6).replace("<svg ", '<svg width="34" height="34" ')}<span>Grassy Knees<span class="d">.</span></span></div>
 <h1>What’s on with the kids <span>this weekend</span></h1>
 <p>Free · 42 US metros · checked at the source</p>
 <div class="big">${mark(3.2).replace("<svg ", '<svg width="170" height="170" ')}</div>
</body></html>`);
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(root, "store/promo-small-440x280.png") });
await browser.close();
console.log("icons and promo tile written");
