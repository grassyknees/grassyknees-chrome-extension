import { METROS } from "./metros.js";
import { ORIGIN, AGE_BUCKETS, weekendItems, weekendRange, weekendUrl, withUtm, fitsAge, spread, metroForTimeZone, prettyDate, shortDate } from "./weekend.js";

const MAX_ITEMS = 20;              // the popup is a teaser; the full list is one click away on the site
const TTL = 30 * 60 * 1000;        // reuse a metro's weekend list for 30 minutes
const TIMEOUT = 25000;             // the API answers in a few seconds; give slow networks room
const KEEP_METROS = 4;             // cached metros kept in chrome.storage.local

const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const metroById = id => METROS.find(m => m.id === id);

let prefs = { metro: null, free: false, age: "" };
let current = null; // { metro, data } last rendered

async function getSync(defaults) { try { return await chrome.storage.sync.get(defaults); } catch { return defaults; } }
async function setSync(values) { try { await chrome.storage.sync.set(values); } catch {} }
async function getLocal(key) { try { return (await chrome.storage.local.get(key))[key] ?? null; } catch { return null; } }
async function setLocal(values) { try { await chrome.storage.local.set(values); } catch {} }

function hint(text) { const h = $("hint"); h.textContent = text || ""; h.hidden = !text; }

// ---- data ----

// One metro's weekend list: cached for TTL, revalidated with the API's ETag (a 304 costs a few bytes), and the
// cached copy is shown if the network fails. Only the trimmed weekend items are stored, never the whole payload.
async function loadWeekend(metro, { force = false } = {}) {
  const key = "wk:" + metro.id, cached = await getLocal(key);
  const { start } = weekendRange(metro.timeZone);
  const sameWeekend = cached && cached.start === start;
  if (!force && sameWeekend && Date.now() - cached.at < TTL) return { ...cached, from: "cache" };

  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const headers = sameWeekend && cached.etag ? { "If-None-Match": cached.etag } : {};
    const res = await fetch(`${ORIGIN}/api/activities?city=${encodeURIComponent(metro.id)}&fields=list`, { headers, credentials: "omit", signal: ctrl.signal });
    if (res.status === 304 && sameWeekend) { const fresh = { ...cached, at: Date.now() }; await store(key, fresh); return { ...fresh, from: "network" }; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!Array.isArray(body.activities)) throw new Error("Unexpected reply");
    const w = weekendItems(body.activities, metro.id, metro.timeZone);
    const data = { at: Date.now(), etag: res.headers.get("ETag"), start: w.start, end: w.end, items: w.items, lastChecked: body.catalog?.lastChecked || null };
    await store(key, data);
    return { ...data, from: "network" };
  } catch (err) {
    if (sameWeekend) return { ...cached, from: "stale", error: String(err.message || err) };
    throw err;
  } finally { clearTimeout(timer); }
}

async function store(key, data) {
  await setLocal({ [key]: data });
  try { // keep only the few most recently used metros
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter(k => k.startsWith("wk:")).sort((a, b) => (all[b].at || 0) - (all[a].at || 0));
    if (keys.length > KEEP_METROS) await chrome.storage.local.remove(keys.slice(KEEP_METROS));
  } catch {}
}

// "Detect": the site's homepage carries <meta name="gk-near" content="<metro>"> when Cloudflare places the
// visitor's IP within 120 miles of a metro (nothing is stored). Only the <head> is read. Falls back to the time zone.
async function detectMetro() {
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(ORIGIN + "/", { credentials: "omit", signal: ctrl.signal, cache: "no-store" });
    if (res.ok && res.body) {
      const reader = res.body.getReader(), dec = new TextDecoder(); let head = "";
      while (head.length < 400000) { const { value, done } = await reader.read(); if (done) break; head += dec.decode(value, { stream: true }); if (head.includes("</head>")) break; }
      reader.cancel().catch(() => {});
      const m = head.match(/<meta name="gk-near" content="([a-z-]+)"/);
      if (m && metroById(m[1])) return { metro: metroById(m[1]), how: "your approximate location" };
    }
  } catch {} finally { clearTimeout(timer); }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const byZone = metroForTimeZone(METROS, tz);
  if (byZone) return { metro: byZone, how: "your time zone" };
  return null;
}

// ---- render ----

function rangeText(start, end) {
  const a = shortDate(start), b = shortDate(end);
  return a.split(" ")[0] === b.split(" ")[0] ? `${a}–${b.split(" ")[1]}` : `${a} – ${b}`;
}
function dayHeading(group, start, end) {
  if (group === "all") return `All weekend · ${rangeText(start, end)}`;
  return prettyDate(group).replace(",", " ·");
}

function itemNode(it) {
  const a = el("a", "item"); a.href = it.url; a.target = "_blank"; a.rel = "noopener";
  a.append(el("div", "when", it.when), el("div", "title", it.title));
  const where = [it.venue, it.town && !it.venue.includes(it.town) ? it.town : null].filter(Boolean).join(" · ");
  if (where) { const w = el("div", "where", where); w.title = where; a.append(w); }
  const tags = el("div", "tags");
  if (it.price) tags.append(el("span", it.free ? "tag free" : "tag", it.price));
  if (it.age) tags.append(el("span", "tag", it.age));
  if (it.soldOut) tags.append(el("span", "tag warn", "Sold out"));
  if (it.checked) { const c = el("span", "checked", "checked " + shortDate(it.checked)); c.title = "Last checked against the organizer's own page"; tags.append(c); }
  a.append(tags);
  return a;
}

function render() {
  if (!current) return;
  const { metro, data } = current, list = $("list");
  const matches = data.items.filter(i => (!prefs.free || i.free) && fitsAge(i, prefs.age));
  const shown = spread(matches, MAX_ITEMS);
  $("range").textContent = "This weekend · " + rangeText(data.start, data.end);
  const all = $("all");
  all.href = weekendUrl(metro.id);
  // The site's weekend page lists every event (no filters), so the count is the whole weekend's.
  all.textContent = data.items.length > shown.length ? `See all ${data.items.length} in ${metro.name} →` : `See all in ${metro.name} →`;
  list.replaceChildren();
  if (!data.items.length) {
    const e = el("div", "empty"); e.append(el("strong", null, "Nothing listed for this weekend yet"), document.createTextNode(`New ${metro.name} events are added daily. The site also has places and classes you can visit any time.`));
    list.append(e);
  } else if (!matches.length) {
    const e = el("div", "empty"); e.append(el("strong", null, "No matches"), document.createTextNode(`None of the ${data.items.length} events this weekend fit these filters.`));
    list.append(e);
  } else {
    const count = el("p", "count"); const n = el("strong", null, String(matches.length));
    count.append(n, document.createTextNode(` ${matches.length === 1 ? "event" : "events"}${prefs.free ? " free" : ""} this weekend in ${metro.name}${shown.length < matches.length ? `, showing ${shown.length}` : ""}`));
    list.append(count);
    let group = null;
    for (const it of shown) {
      if (it.group !== group) { group = it.group; list.append(el("h2", "day", dayHeading(group, data.start, data.end))); }
      list.append(itemNode(it));
    }
  }
  const mins = Math.max(0, Math.round((Date.now() - data.at) / 60000));
  $("status").textContent = (data.from === "stale" ? "Offline copy from " : "Updated ") + (mins < 1 ? "just now" : `${mins} min ago`) + " ·";
}

function renderLoading() {
  const list = $("list"); list.replaceChildren();
  for (let i = 0; i < 4; i++) list.append(el("div", "skeleton"));
  $("status").textContent = "Loading…";
}
function renderError(metro, err) {
  const list = $("list"), e = el("div", "error");
  e.append(el("strong", null, "Couldn’t load this weekend"), document.createTextNode("Check your connection and try Refresh, or open the list on grassyknees.com."));
  list.replaceChildren(e);
  $("all").href = weekendUrl(metro.id); $("all").textContent = `Open ${metro.name} on Grassy Knees →`;
  $("status").textContent = "Not loaded ·";
  console.warn("Grassy Knees: load failed", err);
}

let loadSeq = 0;
async function show(metro, opts) {
  const seq = ++loadSeq;
  $("all").href = weekendUrl(metro.id);
  renderLoading();
  try { const data = await loadWeekend(metro, opts); if (seq !== loadSeq) return; current = { metro, data }; render(); }
  catch (err) { if (seq === loadSeq) renderError(metro, err); }
}

// ---- wiring ----

async function init() {
  const sel = $("metro");
  for (const m of [...METROS].sort((a, b) => a.name.localeCompare(b.name))) { const o = el("option", null, `${m.name}, ${m.states}`); o.value = m.id; sel.append(o); }
  const age = $("age");
  for (const b of AGE_BUCKETS) { const o = el("option", null, b.label); o.value = b.id; age.append(o); }

  prefs = await getSync({ metro: null, free: false, age: "" });
  let metro = metroById(prefs.metro);
  if (!metro) { // first run: a guess from the time zone (no network), easy to change
    const guess = metroForTimeZone(METROS, Intl.DateTimeFormat().resolvedOptions().timeZone);
    metro = guess || metroById("new-york");
    hint(guess ? `Showing ${metro.name}, a guess from your time zone. Pick your metro or tap Detect.` : "Pick your metro area, or tap Detect.");
  }
  sel.value = metro.id; $("free").checked = !!prefs.free; age.value = AGE_BUCKETS.some(b => b.id === prefs.age) ? prefs.age : "";

  sel.addEventListener("change", async () => { const m = metroById(sel.value); prefs.metro = m.id; hint(""); await setSync({ metro: m.id }); show(m); });
  $("free").addEventListener("change", e => { prefs.free = e.target.checked; setSync({ free: prefs.free }); render(); });
  age.addEventListener("change", () => { prefs.age = age.value; setSync({ age: prefs.age }); render(); });
  $("refresh").addEventListener("click", () => show(metroById(sel.value), { force: true }));
  $("detect").addEventListener("click", async () => {
    const btn = $("detect"); btn.setAttribute("aria-busy", "true"); btn.disabled = true;
    try {
      const found = await detectMetro();
      if (!found) { hint("Couldn’t tell where you are. Pick your metro from the list."); return; }
      sel.value = found.metro.id; prefs.metro = found.metro.id; await setSync({ metro: found.metro.id });
      hint(`${found.metro.name} is the closest metro to ${found.how}.`);
      show(found.metro);
    } finally { btn.removeAttribute("aria-busy"); btn.disabled = false; }
  });
  $("home").href = withUtm("/");
  show(metro);
}

init();
