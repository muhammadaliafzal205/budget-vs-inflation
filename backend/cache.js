// cache.js — tiny disk cache. No DB, no Redis: just JSON files.
// Good enough for a handful of agencies/series that change once a day at most.

const fs = require("fs");
const path = require("path");

const CACHE_DIR = path.join(__dirname, "cache");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

function cachePath(key) {
  // key is something like "budgetary_resources_012" or "cpi_CUUR0000SA0"
  return path.join(CACHE_DIR, `${key}.json`);
}

function readCache(key, maxAgeMs) {
  const file = cachePath(key);
  if (!fs.existsSync(file)) return null;

  const stat = fs.statSync(file);
  const age = Date.now() - stat.mtimeMs;
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));

  return {
    data: raw,
    fresh: age <= maxAgeMs,
    ageMs: age,
  };
}

function writeCache(key, data) {
  fs.writeFileSync(cachePath(key), JSON.stringify(data), "utf8");
}

module.exports = { readCache, writeCache };
