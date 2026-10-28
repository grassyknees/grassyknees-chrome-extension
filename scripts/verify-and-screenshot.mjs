// Loads the unpacked extension in Playwright's Chromium, opens its popup page against the live site for a few
// metros (one at a time, so the network stays light), fails on console errors, and writes:
//   store/verify/<metro>[-dark].png        the popup itself, 380 px wide
//   store/screenshots/<n>-<name>.png       1280x800 Chrome Web Store screenshots built around those captures
// Usage: node scripts/verify-and-screenshot.mjs [metro ...]   (default: denver chicago houston)
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ext = path.join(root, "extension");
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.PLAYWRIGHT_DIR || "node_modules", "playwright"));

// An unpacked extension's id is derived from its absolute path.
const extId = [...createHash("sha256").update(ext).digest("hex").slice(0, 32)].map(c => String.fromCharCode(97 + parseInt(c, 16))).join("");
const metros = process.argv.slice(2).length ? process.argv.slice(2) : ["denver", "chicago", "houston"];
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;

mkdirSync(path.join(root, "store/verify"), { recursive: true });
mkdirSync(path.join(root, "store/screenshots"), { recursive: true });
const profile = mkdtempSync(path.join(tmpdir(), "gk-ext-"));
const ctx = await chromium.launchPersistentContext(profile, {
  channel: "chromium", headless: true, viewport: { width: 380, height: 600 }, deviceScaleFactor: 2,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  ...(proxy ? { proxy: { server: proxy } } : {}),
});

const problems = [], captures = {};
const page = ctx.pages()[0] || await ctx.newPage();
page.on("console", m => { if (m.type() === "error") problems.push(`console: ${m.text()}`); });
page.on("pageerror", e => problems.push(`pageerror: ${e.message}`));
// Detect reads only the homepage <head> and then cancels the body, which shows up as ERR_ABORTED for "/".
page.on("requestfailed", r => { if (!(r.url() === "https://grassyknees.com/" && /ABORTED/.test(r.failure()?.errorText || "")) && !r.url().startsWith("chrome-extension:")) problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
const requests = [];
page.on("request", r => { if (!r.url().startsWith("chrome-extension:")) requests.push(r.url()); });

const popup = `chrome-extension://${extId}/popup.html`;
for (const [i, metro] of metros.entries()) {
  await page.emulateMedia({ colorScheme: i === 1 ? "dark" : "light" });
  await page.goto(popup);
  await page.evaluate(async m => { await chrome.storage.sync.set({ metro: m, free: false, age: "" }); }, metro);
  const t0 = Date.now();
  await page.reload();
  await page.waitForSelector(".item, .empty, .error", { timeout: 60000 });
  const info = await page.evaluate(() => ({ items: document.querySelectorAll(".item").length, count: document.querySelector(".count")?.textContent, range: document.getElementById("range").textContent, all: document.getElementById("all").href, error: !!document.querySelector(".error"), first: document.querySelector(".item")?.href }));
  console.log(metro, `${Date.now() - t0} ms`, JSON.stringify(info));
  if (info.error) problems.push(`${metro}: popup showed the load error`);
  const name = `${metro}${i === 1 ? "-dark" : ""}`;
  await page.screenshot({ path: path.join(root, `store/verify/${name}.png`) });
  captures[name] = path.join(root, `store/verify/${name}.png`);

  if (i === 0) { // cached reload must not hit the network; then the Free + age filters
    const before = requests.length;
    await page.reload(); await page.waitForSelector(".item");
    if (requests.length !== before) problems.push(`cache: reload fetched ${requests.slice(before).join(", ")}`);
    await page.check("#free"); await page.selectOption("#age", "3-5"); await page.waitForTimeout(400); // toggle transition
    const filtered = await page.evaluate(() => ({ items: document.querySelectorAll(".item").length, count: document.querySelector(".count")?.textContent, tags: [...document.querySelectorAll(".item .tag.free")].length }));
    console.log(metro, "free + 3-5:", JSON.stringify(filtered));
    if (filtered.items && filtered.tags !== filtered.items) problems.push("free filter showed a non-free item");
    await page.screenshot({ path: path.join(root, `store/verify/${metro}-free-3-5.png`) });
    captures[`${metro}-free`] = path.join(root, `store/verify/${metro}-free-3-5.png`);
    await page.uncheck("#free"); await page.selectOption("#age", "");
  }
}

// Detect: one homepage request, then the hint names the metro (the result depends on where the IP is).
await page.click("#detect");
await page.waitForFunction(() => !document.getElementById("hint").hidden, null, { timeout: 30000 });
console.log("detect:", await page.textContent("#hint"));
await page.waitForSelector(".item, .empty, .error", { timeout: 60000 });

// The "See all" target must exist.
const allUrl = await page.evaluate(() => document.getElementById("all").href);
const check = await ctx.request.get(allUrl, { maxRedirects: 0 }).catch(e => ({ status: () => String(e) }));
console.log("see-all", allUrl, check.status());
if (check.status() !== 200) problems.push(`see-all link returned ${check.status()}`);

// Store screenshots: the real popup capture on a branded 1280x800 canvas.
const b64 = f => "data:image/png;base64," + readFileSync(f).toString("base64");
const font = readFileSync(path.join(ext, "fonts/manrope.woff2")).toString("base64");
const logo = b64(path.join(ext, "icons/icon128.png"));
const shot = await ctx.newPage();
await shot.setViewportSize({ width: 1280, height: 800 });
const frames = [
  { file: "1-this-weekend.png", img: captures[metros[0]], dark: false, title: "What’s on with the kids <em>this weekend</em>", body: "One click shows Friday-to-Sunday family events in your metro, with day and time, venue, town and price.", foot: "42 US metro areas · every listing checked against the organizer’s own page" },
  { file: "2-free-and-age.png", img: captures[`${metros[0]}-free`], dark: false, title: "<em>Free only</em>, and the right age", body: "Filter to free events and to your child’s age. Each card opens the full listing on grassyknees.com.", foot: "No account · no tracking · your metro is remembered" },
  { file: "3-dark-mode.png", img: captures[`${metros[1]}-dark`], dark: true, title: "Light or dark, <em>it follows Chrome</em>", body: "Pick any of 42 metros, or tap Detect to jump to the nearest one. The list refreshes every 30 minutes.", foot: "Free directory · grassyknees.com" },
].filter(f => f.img);
for (const f of frames) {
  const bg = f.dark ? "#14211b" : "#f3edce", ink = f.dark ? "#eef0e6" : "#243d32", soft = f.dark ? "#a6b0a2" : "#5d6a5c", em = f.dark ? "#f9d95e" : "#647844";
  await shot.setContent(`<html><head><style>@font-face{font-family:Manrope;src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:200 800}
    body{margin:0;width:1280px;height:800px;overflow:hidden;background:${bg};color:${ink};font-family:Manrope,Arial,sans-serif;display:flex;align-items:center;gap:70px;padding:0 90px;box-sizing:border-box}
    .copy{flex:1}.brand{display:flex;align-items:center;gap:12px;font-weight:800;font-size:26px;letter-spacing:-1px}.brand img{width:44px;height:44px}.brand i{color:#c79a28;font-style:normal}
    h1{font-size:54px;line-height:1.1;letter-spacing:-2.4px;margin:34px 0 22px;font-weight:800}h1 em{font-style:normal;color:${em}}
    p{font-size:21px;line-height:1.6;color:${soft};margin:0;max-width:520px}.foot{margin-top:34px;font-size:15px;font-weight:700}
    .pop{width:380px;height:600px;border-radius:14px;overflow:hidden;box-shadow:0 24px 70px #0f1f1733,0 0 0 1px #00000014;flex-shrink:0}.pop img{width:380px;height:600px;display:block}</style></head>
    <body><div class="copy"><div class="brand"><img src="${logo}"><span>Grassy Knees<i>.</i></span></div><h1>${f.title}</h1><p>${f.body}</p><p class="foot">${f.foot}</p></div>
    <div class="pop"><img src="${b64(f.img)}"></div></body></html>`);
  await shot.waitForTimeout(150);
  await shot.screenshot({ path: path.join(root, "store/screenshots", f.file), scale: "css" });
}

await ctx.close();
rmSync(profile, { recursive: true, force: true });
console.log(`network requests (${requests.length}):\n  ` + requests.join("\n  "));
if (problems.length) { console.error("PROBLEMS:\n  " + problems.join("\n  ")); process.exit(1); }
console.log("OK: no console errors");
