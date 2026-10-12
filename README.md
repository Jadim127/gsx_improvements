# RepairDesk

A simplified front desk for independent device repair shops: look up a device by serial or IMEI, check coverage, open a repair, track it through to pickup, and keep on top of parts that need to be sent back.

RepairDesk is an independent demo project. It is not affiliated with, endorsed by, or based on the internal tools of any device manufacturer. All devices, customers, issue codes and prices are made up.

## Run it

Requires Node.js 22.13 or newer (it uses the built-in `node:sqlite` module, so there is no native database driver to compile).

```sh
npm install
npm start          # http://localhost:3000
npm test           # unit + API tests
```

Environment variables: `PORT` (default `3000`) and `DB_PATH` (default `data/repairdesk.db`). The database is created and seeded with demo data on first run; "Reset demo data" on the Help page reseeds it.

## Layout

```
public/            static front end (served by Express)
  app.js           screens; talks to the backend only through the `api` object
  shared/          code used by both the browser and the server
    catalog.js     issue categories, issue codes, parts, repair types, statuses
    pricing.js     coverage and pricing rules (pure functions)
server/
  app.js           Express routes (createApp(db) so tests can use an in-memory DB)
  db.js            SQLite schema, seed data, row mapping
  index.js         entry point
test/
  pricing.test.js  unit tests for coverageOf, priceFor, quote, daysUntil
  api.test.js      REST API tests against an in-memory database
```

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/devices` | All devices |
| GET | `/api/devices/:serialOrImei` | One device (404 if unknown) |
| GET | `/api/repairs` | All repairs, newest first |
| GET | `/api/repairs/:id` | One repair |
| POST | `/api/repairs` | Create a repair |
| POST | `/api/repairs/:id/advance` | Move to the next status |
| POST | `/api/repairs/:id/returned` | Mark replaced parts as sent back |
| POST | `/api/demo/reset` | Reseed demo data |

When creating a repair the client sends only the part *names* it selected. The server looks the parts up in the catalog and prices them with the same `pricing.js` the browser uses, so the stored cost can't be tampered with from the client.

## Pricing rules

- Coverage runs through the end of the coverage end date; after that the customer pays full price.
- Covered defects are free.
- Accidental damage (cracked screen, liquid) is not covered by the limited warranty: full price.
- With a protection plan, accidental damage costs a flat per-device service fee (Mac $99, Watch $69, phone/tablet $49), never more than the part's full price.
- Coverage shows a warning when 60 or fewer days remain.
