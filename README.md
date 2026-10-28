# Grassy Knees for Chrome

A Manifest V3 toolbar popup that shows this weekend's kids' events for one of the 42 Grassy Knees metros, with links to grassyknees.com.

- `extension/` is the unpacked extension (no build step, plain ES modules). You can load it from chrome://extensions → Load unpacked.
- Data: `GET https://grassyknees.com/api/activities?city=<metro>&fields=list`, filtered to Friday–Sunday in the metro's time zone (`extension/weekend.js`). Cached 30 min in `chrome.storage.local` and revalidated with the API's ETag.
- Permissions: `storage` + `https://grassyknees.com/*`. No content scripts, no background worker, no analytics.
- CSP: `style-src` also allows grassyknees.com only because the homepage response (fetched by Detect) carries a `Link: rel=preload` header for the site's CSS, which Chrome preloads; without it the popup logs a CSP error. The CSS is never applied.

```
npm test                 # unit tests for the weekend logic (offline)
npm run sync-metros      # refresh extension/metros.js from little-weekend app/cities.ts
npm run assets           # icons + 440x280 promo tile (Playwright)
npm run verify           # live check for denver/chicago/houston + store screenshots (Playwright, loads the unpacked extension)
npm run build            # dist/grassyknees-weekend-<version>.zip
```

Store listing text, permission justifications and privacy answers: `store/listing.md`. Privacy page text: `store/privacy-policy.md`.
Manrope is bundled under the SIL Open Font License (`extension/fonts/OFL.txt`).
