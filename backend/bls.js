// bls.js — pulls CPI-U (series CUUR0000SA0) from the BLS Public Data API.
// Keyless tier: 25 requests/day, 10-year range. With a free registration key
// (data.bls.gov/registrationEngine): 500/day, 20-year range.
// Since the daily cap is easy to blow through during dev, this caches hard —
// CPI for a past year never changes, so once fetched it's cached indefinitely.

const { readCache, writeCache } = require("./cache");

const BLS_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/";
const CPI_SERIES = "CUUR0000SA0";
const TEN_YEARS_MS = 10 * 365 * 24 * 60 * 60 * 1000; // effectively "forever" for this data

async function fetchWithTimeout(url, options, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Returns { year: annualAverageCPI } for the requested range.
// annual average = mean of the monthly index values BLS returns for that year.
async function getAnnualCPI(startYear, endYear) {
  const cacheKey = `cpi_${CPI_SERIES}_${startYear}_${endYear}`;
  const cached = readCache(cacheKey, TEN_YEARS_MS);
  if (cached) return cached.data; // never goes stale — historical CPI doesn't change

  const body = {
    seriesid: [CPI_SERIES],
    startyear: String(startYear),
    endyear: String(endYear),
    ...(process.env.BLS_API_KEY ? { registrationkey: process.env.BLS_API_KEY } : {}),
  };

  let json;
  try {
    json = await fetchWithTimeout(BLS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`BLS API unreachable: ${err.message}. No cached CPI data available for this range.`);
  }

  if (json.status !== "REQUEST_SUCCEEDED") {
    // Most common cause without a key: daily quota (25/day) exceeded.
    throw new Error(`BLS API error: ${json.message?.join("; ") || json.status}`);
  }

  const monthly = json.Results.series[0].data; // [{year, period, value}, ...]
  const byYear = {};
  for (const point of monthly) {
    const y = point.year;
    if (!byYear[y]) byYear[y] = [];
    byYear[y].push(parseFloat(point.value));
  }

  const annualAverage = {};
  for (const [y, values] of Object.entries(byYear)) {
    annualAverage[y] = values.reduce((a, b) => a + b, 0) / values.length;
  }

  writeCache(cacheKey, annualAverage);
  return annualAverage;
}

module.exports = { getAnnualCPI };
