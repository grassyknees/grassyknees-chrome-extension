// Regenerates extension/metros.js from the main app's metro list (read-only).
// Usage: node scripts/sync-metros.mjs [path/to/little-weekend/app/cities.ts]
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = process.argv[2] || "../little-weekend/app/cities.ts";
const text = readFileSync(src, "utf8");
const re = /\{id:"([^"]+)",name:"([^"]+)",metro:"[^"]*",states:"([^"]*)",rank:\d+,population:\d+,timeZone:"([^"]+)",timeLabel:"[^"]*",lat:([-\d.]+),lng:([-\d.]+)/g;
const rows = [...text.matchAll(re)].map(([, id, name, states, timeZone, lat, lng]) => ({ id, name, states, timeZone, lat: +lat, lng: +lng }));
if (rows.length < 40) throw new Error(`only ${rows.length} metros parsed from ${src}`);
const lines = rows.map(m => `  {id:${JSON.stringify(m.id)},name:${JSON.stringify(m.name)},states:${JSON.stringify(m.states)},timeZone:${JSON.stringify(m.timeZone)},lat:${m.lat},lng:${m.lng}},`);
writeFileSync(path.join(root, "extension/metros.js"), `// The ${rows.length} Grassy Knees metros, in population order (copied from little-weekend app/cities.ts on ${new Date().toISOString().slice(0, 10)}).\n// Run \`node scripts/sync-metros.mjs\` to refresh when the site adds metros.\nexport const METROS=[\n${lines.join("\n")}\n];\n`);
console.log(`${rows.length} metros written`);
