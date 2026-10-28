import test from "node:test";
import assert from "node:assert/strict";
import { weekendRange, weekendItems, spread, fitsAge, townOf, slugify, metroForTimeZone, priceLabel } from "../extension/weekend.js";
import { METROS } from "../extension/metros.js";

const now = new Date("2026-10-28T18:00:00Z"); // a Wednesday
const ev = (o) => ({ id: "listing-x", cityId: "denver", kind: "event", title: "Thing", venue: "V", address: "1 Main St, Lakewood, CO 80226", date: null, endDate: null, time: null, minAge: null, maxAge: null, price: null, costType: "unknown", availability: "unknown", ...o });

test("weekend is Friday to Sunday in the metro's zone", () => {
  assert.deepEqual(weekendRange("America/Denver", now), { today: "2026-10-28", friday: "2026-10-30", start: "2026-10-30", end: "2026-11-01" });
  assert.equal(weekendRange("America/Denver", new Date("2026-10-31T18:00:00Z")).start, "2026-10-31");
});

test("only this weekend's events, not places, cancelled or other weeks", () => {
  const { items } = weekendItems([
    ev({ id: "a", date: "2026-10-31", time: "10:00", costType: "free" }),
    ev({ id: "b", date: "2026-11-07" }),
    ev({ id: "c", kind: "place", date: "2026-10-31" }),
    ev({ id: "d", date: "2026-10-31", availability: "cancelled" }),
    ev({ id: "e", date: "2026-10-01", endDate: "2026-11-08" }),
  ], "denver", "America/Denver", now);
  assert.deepEqual(items.map(i => i.id), ["e", "a"]);
  assert.equal(items[1].when, "Sat · 10 AM");
  assert.equal(items[1].town, "Lakewood");
  assert.equal(items[1].free, true);
  assert.equal(items[0].group, "all");
  assert.match(items[1].url, /^https:\/\/grassyknees\.com\/denver\/activities\/thing--a\?utm_source=chrome-extension$/);
});

test("spread keeps every day represented", () => {
  const items = [...Array(30)].map((_, i) => ({ group: "2026-10-30", i })).concat([...Array(5)].map(() => ({ group: "2026-10-31" })), [{ group: "2026-11-01" }]);
  const out = spread(items, 20);
  assert.equal(out.length, 20);
  assert.ok(out.some(i => i.group === "2026-11-01"));
});

test("filters and helpers", () => {
  assert.equal(fitsAge({ minAge: 0, maxAge: 5 }, "6-9"), false);
  assert.equal(fitsAge({ minAge: null, maxAge: null }, "13-17"), true);
  assert.equal(townOf("1501 S. Logan St., Denver, CO 80210"), "Denver");
  assert.equal(slugify("School's Out! Day: Pumpkins & Potions"), "school-s-out-day-pumpkins-and-potions");
  assert.equal(priceLabel({ costType: "paid", price: 10, curated: true }), "From $10");
  assert.equal(metroForTimeZone(METROS, "America/Denver").id, "denver");
  assert.equal(metroForTimeZone(METROS, "Europe/Paris"), null);
  assert.equal(METROS.length, 42);
});
