# Fieldmark Land Marketplace

## Run locally

Requires Node.js 22.5 or newer. Node 24 is recommended because the server uses the built-in `node:sqlite` module.

```powershell
npm start
```

Open `http://localhost:3000` for the Transformer Dashboard. Sign in with the existing operations account; use the application tabs to switch between the dashboard and the embedded Field Mark marketplace. Both sections use the same server, authentication endpoints, and database.

The first run seeds 100 varied sample properties across Andhra Pradesh, Telangana, Karnataka, Tamil Nadu and Kerala, with three property images each. Sample owner contact details are illustrative. Remote image failures fall back to a local inline landscape illustration.

Marketplace listings, image data, favorites, exchange requests, messages, users and sessions are stored in `rural-dashboard.sqlite`. New owner-uploaded photos are resized in the browser and stored with their listing. Passwords continue to use the existing `scrypt` authentication and `HttpOnly` session cookies.

To use a separate database file (for example, while testing), set `DATABASE_PATH` before starting the server:

```powershell
$env:DATABASE_PATH = "$env:TEMP\fieldmark-test.sqlite"
$env:PORT = 3001
npm start
```

Public JSON endpoints include `GET /api/land/listings`, `GET /api/land/listings/:id`, and `GET /api/land/listings/filters`. Signed-in users can create, edit and delete their own listings, manage favorites, send exchange proposals and message owners. The existing rural dashboard and its management APIs remain available.

## Nearby equipment sharing

Open **Equipment Share** from the rural dashboard or go directly to `http://localhost:3000/equipment.html`. The feature uses the existing sign-in cookie and SQLite database. Its tables are created automatically when the server starts; set `DATABASE_PATH` as above to use a separate database while testing.

Equipment owners can post photos, a category, condition, hourly/daily rate, village, coordinates and a UTC-backed availability window. Nearby search requires GPS permission or a manually searched place/entered latitude and longitude. It shows real coordinates on Leaflet with OpenStreetMap tiles, calculates distance on the server, and supports 1, 5, 10 and 20 km radii. Browser geolocation requires HTTPS in deployed environments (localhost is allowed).

No map API key is required. The page uses the public OpenStreetMap tile service and Nominatim place lookup, with visible map attribution. Follow the providers' usage policies; for a production deployment with higher traffic, configure an approved tile/geocoding provider or host the services yourself. No provider secret is stored in browser code.

The server expires listings using its UTC clock every 15 seconds and also synchronizes status during equipment API requests. Booking requests and owner acceptance use SQLite write transactions and reject overlapping pending or confirmed reservations. Owner contact numbers are withheld from nearby search and shown to a renter only after acceptance. Expiration changes listing status without deleting booking or notification history.

Run the end-to-end checks with Node.js 22.5 or newer:

```powershell
npm test
```

The test starts an isolated server and database, exercises item posting, 1 km search, booking and overlap rejection, contact privacy, notifications, automatic expiration, re-listing, and preservation of the existing land marketplace pages and API.