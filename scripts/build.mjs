// Packages extension/ into dist/grassyknees-weekend-<version>.zip for the Chrome Web Store upload.
// Checks the manifest first: version, the 132-character description limit, the permission set, and that every
// icon and file the popup references exists.
import { readFileSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ext = path.join(root, "extension");
const manifest = JSON.parse(readFileSync(path.join(ext, "manifest.json"), "utf8"));
const fail = msg => { console.error("build: " + msg); process.exit(1); };

if (manifest.manifest_version !== 3) fail("manifest_version must be 3");
if (!/^\d+(\.\d+){0,3}$/.test(manifest.version)) fail("bad version " + manifest.version);
if (manifest.description.length > 132) fail(`description is ${manifest.description.length} chars (max 132)`);
if (manifest.name.length > 75) fail("name over 75 chars");
if (JSON.stringify(manifest.permissions) !== '["storage"]') fail("permissions changed: " + JSON.stringify(manifest.permissions));
if (JSON.stringify(manifest.host_permissions) !== '["https://grassyknees.com/*"]') fail("host_permissions changed");
if (manifest.content_scripts || manifest.background) fail("no content scripts or background worker expected");
for (const f of [...Object.values(manifest.icons), manifest.action.default_popup, "popup.js", "popup.css", "weekend.js", "metros.js", "fonts/manrope.woff2", "fonts/OFL.txt"])
  if (!existsSync(path.join(ext, f))) fail("missing " + f);

const dist = path.join(root, "dist"); mkdirSync(dist, { recursive: true });
const zip = path.join(dist, `grassyknees-weekend-${manifest.version}.zip`);
rmSync(zip, { force: true });
// -X: no extra file attributes; exclude macOS litter.
execFileSync("zip", ["-r", "-X", "-q", zip, ".", "-x", "*.DS_Store", "-x", "__MACOSX/*", "-x", "._*"], { cwd: ext, stdio: "inherit" });
console.log(`${path.relative(root, zip)} (${(statSync(zip).size / 1024).toFixed(1)} KB)`);
console.log(execFileSync("unzip", ["-l", zip], { encoding: "utf8" }));
