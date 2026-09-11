# Budget vs. Inflation

For a chosen US federal agency: did its budget actually grow faster than
inflation, and how much of what it was given did it spend? Neither question
is answerable by looking at USAspending.gov's raw per-year numbers directly —
you'd have to pull every year's budget authority yourself and cross it
against inflation data by hand.

## What it does

- Lets you pick any top-tier US federal agency
- For each fiscal year, shows:
  - **Real growth** — budget growth *after* adjusting for CPI inflation over
    the same period. Positive = grew faster than prices; negative = fell
    behind inflation even if the dollar amount rose.
  - **Spent %** — obligated amount ÷ budget authority for that year

## Data sources

- [USAspending.gov API](https://api.usaspending.gov) — agency budget/obligation data. No auth required.
- [BLS Public Data API](https://www.bls.gov/developers/) — CPI-U (series `CUUR0000SA0`) for inflation adjustment.

## Running it locally

Requires Node.js 18+ (for built-in `fetch`).

```bash
cd backend
npm install
cp ../.env.example .env
npm start
```

Open `http://localhost:3000`.

The `.env` file is optional but recommended — without `BLS_API_KEY`, BLS
limits you to 25 requests/day and a 10-year lookback. A free key
(2-minute signup at [data.bls.gov/registrationEngine](https://data.bls.gov/registrationEngine))
raises that to 500/day and 20 years. The app caches CPI data on disk after
first fetch, so this mostly matters during initial development, not normal use.

## Handling a slow/failing source

- USAspending and BLS calls both use an 8s timeout and retry with backoff
  (3 attempts) before giving up.
- Agency budget data is cached to disk for 24 hours. If a live fetch fails,
  the app falls back to the most recent cached copy and shows a banner
  telling you the data may be stale, rather than failing outright.
- CPI data is cached indefinitely once fetched, since historical CPI values
  don't change.

## What this data does and doesn't support

- **US federal agencies only.** No state, local, or non-US government data.
- **"Underspend" isn't the same as inefficiency.** A department obligating
  less than its budget authority in a given year can reflect legally
  deferred or reallocated spending, multi-year appropriations, or normal
  end-of-year timing — not necessarily waste or mismanagement. This tool
  surfaces the pattern; it doesn't explain the cause.
- **CPI is a national basket average**, not specific to what any one agency
  actually purchases. "Real growth" here is a general purchasing-power
  approximation, not an exact adjustment for that agency's actual cost
  inflation (e.g. defense procurement costs and healthcare costs don't
  move with the general CPI at the same rate).
- **Figures can be revised** after a fiscal year closes. Numbers pulled
  today may not exactly match a pull made next month.
- This tool shows correlation between budget growth and inflation, not
  causation, policy intent, or program performance.

## Project structure

```
backend/
  server.js      — Express app, two endpoints
  usaspending.js — USAspending fetch, retry/backoff, cache fallback
  bls.js         — BLS CPI fetch, cached indefinitely per year range
  cache.js       — shared disk-cache helper
frontend/
  index.html, app.js, styles.css — no build step, no framework
```
## Author
Built by [Muhammad Ali](https://github.com/muhammadaliafzal205)
