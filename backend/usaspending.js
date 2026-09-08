// usaspending.js — talks to api.usaspending.gov, no auth needed.
// Handles the "slow or failing source" requirement: timeout + retry + stale-cache fallback.

const { readCache, writeCache } = require("./cache");

const BASE_URL = "https://api.usaspending.gov";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Simple fetch with a timeout, since USAspending can hang under load.
async function fetchWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Retry with exponential backoff: 3 attempts, 500ms/1s/2s between them.
async function fetchWithRetry(url, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchWithTimeout(url);
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** i));
      }
    }
  }
  throw lastErr;
}

// Returns budgetary resources for an agency across all available fiscal years.
// { data, stale, fetchedAt } — stale=true means live fetch failed and we're
// serving whatever's on disk, however old it is.
async function getBudgetaryResources(agencyCode) {
  const cacheKey = `budgetary_resources_${agencyCode}`;
  const cached = readCache(cacheKey, ONE_DAY_MS);

  if (cached && cached.fresh) {
    return { data: cached.data, stale: false, fetchedAt: Date.now() - cached.ageMs };
  }

  try {
    const data = await fetchWithRetry(
      `${BASE_URL}/api/v2/agency/${agencyCode}/budgetary_resources/`
    );
    writeCache(cacheKey, data);
    return { data, stale: false, fetchedAt: Date.now() };
  } catch (err) {
    // Live fetch failed. Fall back to whatever cache we have, even if stale.
    if (cached) {
      return { data: cached.data, stale: true, fetchedAt: Date.now() - cached.ageMs };
    }
    // No cache at all and the source is down — nothing we can do but say so.
    throw new Error(`USAspending unreachable and no cached data for agency ${agencyCode}: ${err.message}`);
  }
}

// List of top-tier agencies, for the picker. Changes rarely — cache for a week.
async function getAgencyList() {
  const cacheKey = "toptier_agencies";
  const cached = readCache(cacheKey, 7 * ONE_DAY_MS);

  if (cached && cached.fresh) return cached.data;

  try {
    const data = await fetchWithRetry(`${BASE_URL}/api/v2/references/toptier_agencies/`);
    writeCache(cacheKey, data);
    return data;
  } catch (err) {
    if (cached) return cached.data; // stale is fine for a picker list
    throw new Error(`Could not load agency list: ${err.message}`);
  }
}

module.exports = { getBudgetaryResources, getAgencyList };
