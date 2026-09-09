# Decision Record

This covers the three decisions in this project that would be most
expensive to walk back later. It explains *why* the project looks the way
it does. For *how to run it*, see [README.md](./README.md) — that document
isn't repeated here.

---

## 1. Locking the project to USAspending.gov + BLS CPI as a fixed pair

**Decision:** Build the whole app around two specific US government APIs —
USAspending.gov for agency budget data, and the BLS Public Data API for
inflation — rather than designing something more general that could plug
in a different country's budget data.

**Alternatives considered:**
- Pakistan's own civil budget / finance ministry data — this was the
  original instinct, given where the developer is based, but no stable,
  documented, free API for it could be found.
- City-level open-data portals (e.g. Chicago, using the Socrata platform)
  paired with local crime or permit data — considered as a civic-data
  angle that didn't need a second API for inflation adjustment.

**Why this one:** USAspending.gov needs no signup or key, returns a full
multi-year history for an agency in a single call, and is well documented.
BLS's CPI series is the natural, free, keyless partner for the specific
question this project asks — did budgets outpace inflation. Together they
answer the target question with the least amount of glue code.

**What it costs:** Every part of the code — the agency lookup, the cache
keys, the shape of the computed metrics — assumes these two specific APIs
and their specific response formats. The project cannot honestly claim to
generalize to any other country's government spending; doing that would
mean rewriting both data-access files and re-deriving the metrics from
scratch, not swapping a configuration value. This was a deliberate scope
narrowing, and it means the tool only ever answers this question for the
US federal government.

---

## 2. Caching to flat JSON files on disk instead of a real database

**Decision:** Store cached API responses as plain `.json` files in a
folder, instead of using a database or a caching service like Redis.

**Alternatives considered:**
- No caching at all — rejected immediately, since it would mean hitting a
  rate-limited source (BLS allows only 25 requests/day without a key) on
  every single page load.
- Redis — a proper in-memory cache with expiration built in.
- SQLite — a lightweight embedded database, still more structure than raw
  files.

**Why this one:** For a project that's graded on being runnable by a
stranger in a few minutes, adding a database dependency felt like solving
a problem this project doesn't have yet. Flat files needed no setup, no
extra service to install, and were easy to reason about while building.

**What it costs, and where it has already proved awkward:** This choice
does not hold up once the app leaves a single developer's laptop. Most
free hosting platforms (this project's hosting target included) reset
their filesystem on every deploy — so the cache that's supposed to protect
against the BLS rate limit disappears exactly when it matters most, right
after a fresh deploy. There is also no protection against two requests for
the same uncached agency arriving at once and fetching twice. Fixing this
properly means replacing the read/write functions in the cache layer
everywhere they're called, not just swapping out the storage backend
underneath the same interface — the interface itself is too simple to
support real concurrency or expiration policies. This is the decision that
already shows a real, encountered downside, not just a theoretical one.

---

## 3. Defining "real growth" and "spent %" as the entire interpretive lens

**Decision:** Represent an agency's year-over-year situation with exactly
two numbers: growth in its total budget compared to inflation over the
same period, and the ratio of money it actually obligated to the money it
was given.

**Alternatives considered:**
- Showing raw, unadjusted year-over-year dollar growth — rejected, since
  that's just what the raw source already shows; it wouldn't add anything
  a reader couldn't already see themselves.
- Using *outlayed* (actually paid out) amounts instead of *obligated*
  (committed to be spent) amounts for the spending ratio — obligations
  happen earlier in the process than outlays, so this would tell a
  different, later-stage story.
- A multi-year compound growth rate instead of year-over-year — would
  smooth out single-year noise but hide the specific years where something
  changed.

**Why this one:** Year-over-year is the most direct way to answer the
question as originally framed, and it needs no extra explanation for
someone reading the table for the first time — no compounding math to
follow, no separate charts to reconcile.

**What it costs, and where it has already proved awkward:** These two
numbers quietly treat every dollar the same, but government budgets don't
work that way. Some money is legally allowed to carry over across years;
some is committed under multi-year contracts. A department that looks like
it's "underspending" in this tool's numbers might just be following normal
multi-year budgeting rules, not failing to use its funds. This surfaced
directly during the project — it's why the README has to explicitly warn
that "underspend isn't the same as inefficiency." That warning is a patch
on the interface, not a fix to the underlying metric. Actually fixing it
means pulling additional fields from USAspending that distinguish
appropriation types, which aren't currently requested, and reshaping both
the API responses and the on-screen labels around that distinction — in
effect, redesigning what the app measures, not adjusting how it's
displayed.
