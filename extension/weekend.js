// This weekend's events for one metro, from GET https://grassyknees.com/api/activities?city=<id>&fields=list.
// Mirrors the site's own weekend page (little-weekend app/newsletter.server.ts weekendListings + app/data.ts):
// Friday through Sunday in the metro's time zone, from today on once the weekend has started; events only (not
// places or programs), not cancelled, not already over. Pure functions, so node can test them too.

export const ORIGIN = "https://grassyknees.com";
export const UTM = "utm_source=chrome-extension";

export function addDays(date, n) { const d = new Date(date + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const dow = d => new Date(d + "T12:00:00Z").getUTCDay();

// YYYY-MM-DD in the metro's time zone.
export function metroToday(timeZone, now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

export function weekendRange(timeZone, now = new Date()) {
  const today = metroToday(timeZone, now), day = dow(today);
  // Saturday and Sunday still belong to the weekend that started on Friday. (The site's weekendRange in
  // little-weekend app/newsletter.server.ts maps Saturday to the following Friday, as of 2026-10-28.)
  const friday = day === 0 ? addDays(today, -2) : day === 6 ? addDays(today, -1) : addDays(today, 5 - day);
  return { today, friday, start: today > friday ? today : friday, end: addDays(friday, 2) };
}

const lastDate = a => a.occurrenceDates?.at(-1) || a.endDate || a.date || null;
const onDay = (a, d) => !a.excludedDates?.includes(d) && !(a.daysOfWeek && !a.daysOfWeek.includes(dow(d)));

export function overlaps(a, start, end) {
  if (a.kind === "place" || a.kind === "program" || (!a.date && !a.endDate)) return false;
  if (a.occurrenceDates) return a.occurrenceDates.some(d => d >= start && d <= end);
  const from = a.date && a.date > start ? a.date : start, to = a.endDate || a.date || end;
  for (let d = from; d <= end && d <= to; d = addDays(d, 1)) if (onDay(a, d)) return true;
  return false;
}
function nextDate(a, today) {
  if (a.occurrenceDates) return a.occurrenceDates.find(d => d >= today) ?? null;
  if (a.endDate && a.endDate >= today && (!a.date || a.date <= today)) return today;
  return a.date;
}
function weekendDays(a, start, end) {
  const days = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (a.occurrenceDates ? !a.occurrenceDates.includes(d) : a.endDate ? !(a.date && a.date <= d && d <= a.endDate) : d !== a.date) continue;
    if (onDay(a, d)) days.push(d);
  }
  return days;
}

const dayFormat = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const dateFormat = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const shortFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
export const weekday = d => dayFormat.format(new Date(d + "T12:00:00Z"));
export const prettyDate = d => dateFormat.format(new Date(d + "T12:00:00Z"));
export const shortDate = d => shortFormat.format(new Date(d + "T12:00:00Z"));
export function prettyTime(t) { const [h, m] = t.split(":"); const hh = Number(h); return `${hh % 12 || 12}${m === "00" ? "" : ":" + m} ${hh >= 12 ? "PM" : "AM"}`; }

// "Sat · 10:30 AM", "Sat & Sun · 2 PM", "Fri – Sun", "Through Nov 1"
export function whenLabel(a, start, end) {
  const time = a.time ? prettyTime(a.time) + (a.endTime ? " – " + prettyTime(a.endTime) : "") : "";
  if (a.endDate && !a.occurrenceDates && a.date && a.date < start) return `Through ${a.endDate <= end ? weekday(a.endDate) : shortDate(a.endDate)}${time ? " · " + time : ""}`;
  const days = weekendDays(a, start, end);
  if (!days.length) return time || "This weekend";
  const label = days.length === 3 ? `${weekday(days[0])} – ${weekday(days[2])}` : days.map(weekday).join(" & ");
  return time ? `${label} · ${time}` : label;
}

// The site's price chip (app/data.ts shortPrice).
export function priceLabel(a) {
  const money = n => "$" + (Number.isInteger(n) ? n : n.toFixed(2));
  if (a.costType === "free" || (!a.costType && a.price === 0)) return "Free";
  if (a.costType === "conditional") return "With admission";
  if (a.price !== null && a.price > 0) return a.curated ? `From ${money(a.price)}` : money(a.price);
  if (a.costType === "paid") return "Paid";
  return null;
}
export function ageLabel(a) {
  const lo = a.minAge, hi = a.maxAge;
  if ((lo === null || lo === 0) && (hi === null || hi >= 18)) return "All ages";
  if (lo !== null && hi !== null && hi < 18) return `Ages ${lo}–${hi}`;
  if (lo !== null && lo > 0) return `Ages ${lo}+`;
  return hi !== null ? `Up to ${hi}` : null;
}

// The town in a US street address (app/seo.ts townOf): "…, Lakewood, CO 80226" → "Lakewood".
const STATE = /^(?:[A-Z]{2}|[A-Z][a-z]+(?: [A-Z][a-z]+)?)?\s*(?:\d{5}(?:-\d{4})?)?$/;
const STREETISH = /\b(and|at)\b|\b(st|street|ave|avenue|dr|drive|rd|road|blvd|boulevard|way|lane|ln|pkwy|parkway|stadium|school)\.?$/i;
const isTown = t => /^[A-Za-z][A-Za-z .'-]{1,30}$/.test(t) && !/^(suite|ste|unit|floor|room|bldg)\b/i.test(t) && !STREETISH.test(t);
export function townOf(address) {
  const parts = (address || "").split(",").map(p => p.trim()).filter(Boolean);
  for (let i = parts.length - 1; i > 0; i--) {
    const joined = parts[i].match(/^([A-Za-z][A-Za-z .'-]+?)\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?$/);
    if (joined) return isTown(joined[1]) ? joined[1] : null;
    if (!STATE.test(parts[i])) continue;
    return isTown(parts[i - 1]) ? parts[i - 1] : null;
  }
  return null;
}

// The listing's page (app/activity-path.ts).
export function slugify(s) { return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70).replace(/-+$/, ""); }
export const withUtm = path => `${ORIGIN}${path}${path.includes("?") ? "&" : "?"}${UTM}`;
export const listingUrl = a => withUtm(`/${a.cityId}/activities/${slugify(a.title) || "activity"}--${a.id}`);
export const weekendUrl = cityId => withUtm(`/${cityId}/this-weekend`);

// Which weekend section a listing goes under: its first day this weekend, or "all" when it runs every day of it
// (festivals, pumpkin patches, exhibits), as on the site's weekend page.
function groupOf(a, start, end) {
  const days = weekendDays(a, start, end), all = [];
  for (let d = start; d <= end; d = addDays(d, 1)) all.push(d);
  return days.length > 1 && days.length === all.length ? "all" : days[0] || start;
}

// At most `max` items spread over the weekend's sections in proportion to their size (at least one each),
// so a Friday full of storytimes doesn't push Saturday and Sunday out. Each section stays in time order.
export function spread(items, max) {
  if (items.length <= max) return items;
  const keys = [...new Set(items.map(i => i.group))].sort((a, b) => (a === "all") - (b === "all") || a.localeCompare(b));
  const by = new Map(keys.map(k => [k, items.filter(i => i.group === k)]));
  const quota = new Map(keys.map(k => [k, Math.min(by.get(k).length, Math.max(1, Math.floor(by.get(k).length / items.length * max)))]));
  let left = max - [...quota.values()].reduce((s, n) => s + n, 0);
  while (left > 0) { const k = keys.filter(k => quota.get(k) < by.get(k).length).sort((a, b) => (by.get(b).length - quota.get(b)) - (by.get(a).length - quota.get(a)))[0]; if (!k) break; quota.set(k, quota.get(k) + 1); left--; }
  while (left < 0) { const k = keys.filter(k => quota.get(k) > 1).sort((a, b) => quota.get(b) - quota.get(a))[0]; if (!k) break; quota.set(k, quota.get(k) - 1); left++; }
  return keys.flatMap(k => by.get(k).slice(0, quota.get(k)));
}

// The small record the popup keeps and caches (a few hundred bytes each, not the whole metro payload).
export function weekendItems(activities, cityId, timeZone, now = new Date()) {
  const { start, end, friday } = weekendRange(timeZone, now);
  const list = activities.filter(a => (a.cityId || cityId) === cityId && a.kind === "event" && a.availability !== "cancelled" && !a.mine
    && !((lastDate(a) || "9999") < start) && overlaps(a, start, end));
  list.sort((a, b) => (nextDate(a, start) || "").localeCompare(nextDate(b, start) || "") || (a.time || "99").localeCompare(b.time || "99") || a.title.localeCompare(b.title));
  return {
    start, end, friday,
    items: list.map(a => ({
      group: groupOf(a, start, end),
      id: a.id, title: a.title, url: listingUrl({ ...a, cityId: a.cityId || cityId }),
      when: whenLabel(a, start, end), venue: a.venue || "", town: townOf(a.address),
      price: priceLabel(a), free: priceLabel(a) === "Free", age: ageLabel(a),
      minAge: a.minAge ?? null, maxAge: a.maxAge ?? null, checked: a.verifiedAt || null,
      soldOut: a.availability === "sold_out",
    })),
  };
}

// Age filter buckets: a listing fits when its age range overlaps the bucket (no bound = open-ended).
export const AGE_BUCKETS = [
  { id: "", label: "Any age" }, { id: "0-2", label: "Babies & toddlers (0–2)", lo: 0, hi: 2 },
  { id: "3-5", label: "Preschool (3–5)", lo: 3, hi: 5 }, { id: "6-9", label: "Ages 6–9", lo: 6, hi: 9 },
  { id: "10-12", label: "Ages 10–12", lo: 10, hi: 12 }, { id: "13-17", label: "Teens (13–17)", lo: 13, hi: 17 },
];
export function fitsAge(item, bucketId) {
  const b = AGE_BUCKETS.find(x => x.id === bucketId);
  if (!b || b.lo === undefined) return true;
  return (item.minAge ?? 0) <= b.hi && (item.maxAge ?? 99) >= b.lo;
}

// Nearest metro to a point, and the coarse time-zone guess used when the site can't place the visitor.
export function nearestMetro(metros, lat, lng) {
  const r = Math.PI / 180, dist = m => { const h = Math.sin((m.lat - lat) * r / 2) ** 2 + Math.cos(lat * r) * Math.cos(m.lat * r) * Math.sin((m.lng - lng) * r / 2) ** 2; return 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)); };
  return metros.reduce((best, m) => dist(m) < dist(best) ? m : best);
}
// The biggest metro in the browser's time zone (METROS is in population order), else one for the zone's region.
const ZONE_FALLBACK = { "America/Anchorage": "seattle", "Pacific/Honolulu": "los-angeles", "America/Boise": "denver", "America/Edmonton": "denver", "America/Kentucky/Louisville": "cincinnati", "America/Puerto_Rico": "miami" };
export function metroForTimeZone(metros, timeZone) {
  const exact = metros.find(m => m.timeZone === timeZone);
  if (exact) return exact;
  const fallback = metros.find(m => m.id === ZONE_FALLBACK[timeZone]);
  if (fallback) return fallback;
  if (/^America\/(Indiana|Kentucky)\//.test(timeZone)) return metros.find(m => m.timeZone === "America/New_York");
  if (/^America\/North_Dakota\//.test(timeZone)) return metros.find(m => m.timeZone === "America/Chicago");
  return null;
}
