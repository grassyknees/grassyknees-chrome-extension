# Chrome Web Store listing: Grassy Knees

## Name (manifest `name`, ≤75)
Grassy Knees: Kids' Events This Weekend

## Summary (manifest `description`, ≤132; this one is 113)
This weekend's kids' events near you: free family events and classes from Grassy Knees in 42 US metro areas.

## Category
Lifestyle → Household (alternative: Lifestyle → Entertainment). The store has no "Family" category; confirm the
name in the dashboard's Category drop-down.

## Language
English (United States)

## Detailed description
What's on with the kids this weekend? Click the Grassy Knees button and see Friday-to-Sunday family events in your metro area.

Grassy Knees (grassyknees.com) is a free directory of kids' events, classes and places across 42 US metro areas, from New York and Los Angeles to Denver, Raleigh and Oklahoma City. Every listing is researched from the organizer's own page and shows the date it was last checked, so you aren't planning around a stale flyer.

What the extension does:
• Shows up to 20 of this weekend's events for your metro, grouped by day
• Each event shows its title, day and time, venue, town, price and ages
• "Free only" switch and a child's-age filter (toddlers, preschool, 6–9, 10–12, teens)
• Click any event to open its full listing on grassyknees.com: description, address, map, registration link
• "See all" opens the complete weekend list for your metro
• Pick your metro once and it's remembered. Or tap Detect: it uses the site's coarse location estimate, then your time zone. No location permission is needed.
• Light and dark mode follow your Chrome settings

Privacy: no account, no analytics, no tracking. The extension reads the public listings from grassyknees.com and keeps a 30-minute copy on your computer so it opens instantly. Your metro and filter choices are stored in Chrome's own storage.

Metros covered: New York, Los Angeles, Chicago, Dallas–Fort Worth, Houston, Atlanta, Washington DC, Miami, Philadelphia, Phoenix, Boston, Riverside, San Francisco, Detroit, Seattle, Minneapolis, Tampa, San Diego, Denver, Orlando, Charlotte, Baltimore, St. Louis, San Antonio, Austin, Portland, Sacramento, Pittsburgh, Las Vegas, Cincinnati, Kansas City, Columbus, Indianapolis, Nashville, Cleveland, San Jose, Virginia Beach, Jacksonville, Providence, Raleigh, Milwaukee and Oklahoma City.

Organizers can list their events for free at grassyknees.com.

## URLs
- Homepage URL: https://grassyknees.com/?utm_source=chrome-web-store
- Support URL: https://grassyknees.com/about
- Privacy policy URL: https://grassyknees.com/privacy (add the extension section below to that page first)

## Single purpose
Show this weekend's kids' and family events from grassyknees.com for the metro area the user picks, with links to each listing on grassyknees.com.

## Permission justifications
- **storage**: Remembers the user's chosen metro area and filters (Free only, age) in chrome.storage.sync, and keeps a 30-minute copy of that metro's weekend list in chrome.storage.local so the popup opens instantly and doesn't refetch on every click.
- **Host permission https://grassyknees.com/***: The popup's only data source. It fetches the public listings for the chosen metro from https://grassyknees.com/api/activities. When the user taps Detect, it also fetches the grassyknees.com homepage, whose header names the metro nearest the visitor. No other site is contacted.
- **Remote code**: No. All JavaScript is packaged in the extension. Only JSON data and HTML (Detect) are fetched, and they are never executed.

## Privacy practices tab
- Data collected: none. Leave every data-type box unchecked (personally identifiable information, health, financial and payment, authentication, personal communications, location, web history, user activity, website content).
- Certifications (tick all three):
  - I do not sell or transfer user data to third parties, outside of the approved use cases
  - I do not use or transfer user data for purposes that are unrelated to my item's single purpose
  - I do not use or transfer user data to determine creditworthiness or for lending purposes
- Note: requests to grassyknees.com are anonymous (credentials omitted). Like any web request, the server sees the IP address. The Detect button relies on Cloudflare's IP-based estimate on the server, and nothing is stored.

## Graphics
- Store icon: store/icon128.png (96 px artwork, 16 px padding)
- Screenshots (1280x800): store/screenshots/1-this-weekend.png, 2-free-and-age.png, 3-dark-mode.png
- Small promo tile (440x280): store/promo-small-440x280.png
- Marquee (1400x560): not made (optional)
