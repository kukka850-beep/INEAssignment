# Ledger — INE Price Tracker

A small full-stack app that tracks the price and stock of products on INE's
hosted mock store (`https://demo.inelabteamdev.com`) on a fixed 2-hour
schedule, with an honest scrape log and CSV export.

## Stack

- **Frontend:** React (Vite) → Vercel
- **Backend:** Node.js / Express → Render
- **Database:** Supabase (PostgreSQL)
- **Scraper:** HTTP reachability probe first, then Playwright (headless
  Chromium) for the mock store's JavaScript-rendered, interaction-gated quote —
  see `backend/src/scraper/scraper.js`
- **Scheduling:** external cron via [cron-job.org](https://cron-job.org), hitting
  `POST /api/cron/run-scrapes` every 2 hours (Render free tier sleeps, so an
  always-on in-process loop won't work reliably)

## ⚠️ Before you run anything

The selectors in `backend/src/scraper/selectors.js` match the current mock-store
DOM, including its option chips and visible selling-price node. If the store
changes its markup, update that file and verify a headed scrape; missing
required content is recorded as a failed scrape rather than guessed data.

## Project layout

```
backend/    Express API + scraper + cron endpoint
frontend/   React dashboard
supabase/   schema.sql — run this in the Supabase SQL editor first
```

## Setup

### 1. Database (Supabase)

1. Create a project at supabase.com.
2. Open the SQL editor and run `supabase/schema.sql`.
3. Copy your project URL and **service role key** (Project Settings → API).

If you already created the tables earlier, run the updated schema again so
the `latest_attempt` view is created and `latest_price` continues to expose
the last valid reading when a newer scrape fails.

### 2. Backend

```bash
cd backend
cp .env.example .env    # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET
npm install
npx playwright install chromium   # only needed once, for the browser fallback
npm run dev
```

Runs on `http://localhost:4000`. Health check: `GET /api/health`.

If Supabase credentials are missing or use the example placeholders, the backend
uses its persistent local JSON adapter for development. Local/sample history is
not evidence of unattended production scrapes. A live submission still needs
real Supabase credentials, an active external cron job, and history collected
from actual unattended runs.

To record the required headed-mode demo:

```bash
npm run scrape:headed -- https://demo.inelabteamdev.com/item/<id> "<option label>"
```

This opens a real (visible) Chromium window, so you can screen-record it
handling the store's slow/async loading and any retry/failure.

### 3. Frontend

```bash
cd frontend
cp .env.example .env    # set VITE_API_BASE_URL to your backend URL
npm install
npm run dev
```

Runs on `http://localhost:5173`.

### 4. Deploy

- **Backend → Render:** new Web Service from the repo, root directory
  `backend`, build command `npm install && npx playwright install --with-deps chromium`,
  start command `npm start`. Add the same env vars as `.env`.
- **Frontend → Vercel:** import the repo, root directory `frontend`, set
  `VITE_API_BASE_URL` to the Render URL.
- **Cron → cron-job.org:** create a job that sends
  `POST https://<your-backend>.onrender.com/api/cron/run-scrapes?secret=<CRON_SECRET>`
  every 2 hours. This also keeps the free Render instance from staying
  asleep through the whole window.

## Scraping schedule

- Fixed at **every 2 hours**, triggered externally (not an in-process
  timer, since Render's free tier sleeps when idle).
- Each tracked product also stores `scrape_interval_minutes` (defaults to
  120) so a per-product custom cadence works even though the external
  trigger itself fires on a fixed 2-hour cycle — the cron route only
  scrapes products whose interval has actually elapsed.

## How reliability works (short version — see DESIGN_NOTE.md for the full story)

- Up to 3 attempts per scrape, exponential backoff between them.
- Every individual attempt is logged (`success` / `retried` / `failed`),
  not just the final result — failures are never hidden.
- On failure, price/stock are stored as `null`, never a guess.
- HTTP+cheerio is tried first (cheap); if the price isn't in the static
  HTML, the scraper automatically falls back to a headless browser and
  waits for the specific element that signals async content has finished
  loading, instead of a fixed sleep.
- Required structural selectors are checked after the quote loads so a store
  markup change shows up as `page_structure_ok = false` in the log rather
  than silently returning wrong data.

## Bonus features implemented

- **Price-drop / back-in-stock alerts** — shown in-app on the dashboard and
  the per-product scrape log (`price_drop` / `back_in_stock` flags on each
  scrape row, computed against the previous successful reading). Also
  optionally emailed via SendGrid if `SENDGRID_API_KEY`, `ALERT_EMAIL_TO`
  and `ALERT_EMAIL_FROM` are set — leave them blank to keep alerts in-app only.
- **Change detection** — every scrape checks a fingerprint of required
  selectors (`selectors.structuralFingerprint`). If any required selector
  is missing, the scraper **fails closed** (logs `failed`, stores no price)
  rather than trusting a page that looks structurally different, and the
  dashboard shows a "⚠ store layout changed" tag.
- **Configurable scrape frequency per product** — set when adding a
  product (`scrape_interval_minutes`); the cron route only re-scrapes a
  product once its own interval has elapsed, even though the external
  trigger itself fires on a fixed 2-hour cycle.
- **Multiple options scraped in one run** — `POST /api/cron/run-scrapes`
  groups due products by store URL and, when a product has more than one
  tracked option, loads the page once and reads every option off it
  (`scraper/scraper.js#scrapeMultipleOptions`) instead of one page load
  per option. Falls back to per-option scraping automatically if the
  batch load fails.
- **CI/CD** — `.github/workflows/ci.yml` syntax-checks the backend and
  builds the frontend on every push/PR.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `SUPABASE_URL` | backend | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | backend | server-side DB access |
| `STORE_BASE_URL` | backend | mock store base URL |
| `CRON_SECRET` | backend | protects the cron trigger endpoint |
| `SCRAPER_MODE` | backend | `auto` \| `http` \| `browser` |
| `SCRAPER_MAX_RETRIES` | backend | default 3 |
| `SCRAPER_TIMEOUT_MS` | backend | default 20000 |
| `FRONTEND_ORIGIN` | backend | CORS allow-list |
| `SENDGRID_API_KEY` | backend | optional, enables email alerts |
| `ALERT_EMAIL_TO` | backend | optional, alert recipient |
| `ALERT_EMAIL_FROM` | backend | optional, verified SendGrid sender |
| `VITE_API_BASE_URL` | frontend | backend base URL |

## CSV export

`GET /api/export/csv` (also a button on the dashboard) — one row per scrape
attempt: store product ID, product name, option, ISO 8601 UTC timestamp,
price, stock, outcome. Failed rows keep price/stock empty rather than
omitting the row.
