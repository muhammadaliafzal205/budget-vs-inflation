// server.js — thin proxy + cache layer. No database: USAspending and BLS
// already are the database. This just adds retry/backoff and a disk cache
// so the frontend gets a fast, resilient response even when either source
// is slow or down.

require("dotenv").config();
const path = require("path");
const express = require("express");
const { getBudgetaryResources, getAgencyList } = require("./usaspending");
const { getAnnualCPI } = require("./bls");

const app = express();
app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/api/agencies", async (req, res) => {
  try {
    const data = await getAgencyList();
    res.json(data);
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

app.get("/api/agency/:code/budget-vs-inflation", async (req, res) => {
  try {
    const { code } = req.params;
    const budget = await getBudgetaryResources(code);

    const years = budget.data.agency_data_by_year.map((y) => y.fiscal_year);
    const startYear = Math.min(...years);
    const endYear = Math.max(...years);
    const cpi = await getAnnualCPI(startYear, endYear);

    res.json({
      agencyCode: code,
      budgetaryResources: budget.data,
      dataStale: budget.stale,      // frontend shows a banner if true
      fetchedAt: budget.fetchedAt,
      cpi,
    });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
