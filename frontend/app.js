// app.js — no framework, no build step. Fetches from our own backend
// (which handles caching/retry), computes the two metrics, renders a table.

const agencySelect = document.getElementById("agency-select");
const staleBanner = document.getElementById("stale-banner");
const errorBanner = document.getElementById("error-banner");
const loading = document.getElementById("loading");
const table = document.getElementById("results-table");
const tbody = table.querySelector("tbody");
const emptyState = document.getElementById("empty-state");

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.classList.remove("hidden");
}
function hideError() {
  errorBanner.classList.add("hidden");
}

async function loadAgencies() {
  try {
    const res = await fetch("/api/agencies");
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const json = await res.json();

    // Only agencies with a nonzero budget — filters out inactive/defunct entries.
    const agencies = json.results
      .filter((a) => a.current_total_budget_authority_amount > 0)
      .sort((a, b) => a.agency_name.localeCompare(b.agency_name));

    agencySelect.innerHTML = '<option value="">Select an agency…</option>';
    for (const a of agencies) {
      const opt = document.createElement("option");
      opt.value = a.toptier_code;
      opt.textContent = a.agency_name;
      agencySelect.appendChild(opt);
    }
  } catch (err) {
    agencySelect.innerHTML = '<option value="">Failed to load agencies</option>';
    showError(`Could not load the agency list: ${err.message}. Try reloading the page.`);
  }
}

function formatMoney(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

function formatPct(n) {
  return `${(n * 100).toFixed(1)}%`;
}

// Real growth = nominal budget growth, deflated by CPI growth over the same span.
// Positive means the budget grew faster than prices did; negative means it didn't
// keep pace with inflation, even if the raw dollar figure went up.
function computeRows(budgetaryData, cpi) {
  const years = [...budgetaryData.agency_data_by_year].sort(
    (a, b) => a.fiscal_year - b.fiscal_year
  );

  return years.map((y, i) => {
    const prev = years[i - 1];
    let realGrowth = null;

    if (prev && cpi[y.fiscal_year] && cpi[prev.fiscal_year]) {
      const nominalGrowth = y.agency_budgetary_resources / prev.agency_budgetary_resources;
      const inflationFactor = cpi[y.fiscal_year] / cpi[prev.fiscal_year];
      realGrowth = nominalGrowth / inflationFactor - 1;
    }

    return {
      fiscalYear: y.fiscal_year,
      budget: y.agency_budgetary_resources,
      obligated: y.agency_total_obligated,
      spentPct: y.agency_total_obligated / y.agency_budgetary_resources,
      realGrowth,
    };
  });
}

function render(rows) {
  tbody.innerHTML = "";
  for (const r of [...rows].reverse()) {
    // most recent year first
    const tr = document.createElement("tr");

    const growthCell =
      r.realGrowth === null
        ? "—"
        : `<span class="${r.realGrowth >= 0 ? "positive" : "negative"}">${formatPct(r.realGrowth)}</span>`;

    tr.innerHTML = `
      <td>${r.fiscalYear}</td>
      <td>${formatMoney(r.budget)}</td>
      <td>${formatMoney(r.obligated)}</td>
      <td>${formatPct(r.spentPct)}</td>
      <td>${growthCell}</td>
    `;
    tbody.appendChild(tr);
  }
  table.classList.remove("hidden");
  emptyState.classList.add("hidden");
}

async function loadAgencyData(code) {
  hideError();
  staleBanner.classList.add("hidden");
  table.classList.add("hidden");
  emptyState.classList.add("hidden");
  loading.classList.remove("hidden");

  try {
    const res = await fetch(`/api/agency/${code}/budget-vs-inflation`);
    const json = await res.json();

    if (!res.ok) throw new Error(json.error || `Server returned ${res.status}`);

    if (json.dataStale) {
      const asOf = new Date(json.fetchedAt).toLocaleString();
      staleBanner.textContent = `Live data source was unreachable — showing cached data from ${asOf}.`;
      staleBanner.classList.remove("hidden");
    }

    const rows = computeRows(json.budgetaryResources, json.cpi);
    render(rows);
  } catch (err) {
    showError(`Could not load data for this agency: ${err.message}`);
  } finally {
    loading.classList.add("hidden");
  }
}

agencySelect.addEventListener("change", (e) => {
  if (e.target.value) loadAgencyData(e.target.value);
});

loadAgencies();
