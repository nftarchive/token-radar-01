// Token Radar dashboard. No network: every byte it shows comes from
// ../data.js, written by main.ts from the sealed snapshot. Filters, sort
// and the detail view are all local. Deep links: #p=<slug> opens a
// protocol's detail, #c=<category> filters by category, #w=1 shows the
// watchlist only.

const DATA = window.TOKEN_RADAR;
const rows = DATA.rows;
const bySlug = new Map(rows.map((r) => [r.slug, r]));

const $ = (id) => document.getElementById(id);
const qEl = $("q");
const categoryEl = $("category");
const chainEl = $("chain");
const sortEl = $("sort");
const watchlistEl = $("watchlistOnly");
const rowsEl = $("rows");
const detailEl = $("detail");

function money(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

function moneyFull(n) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function pct(x) {
  if (x === null || x === undefined) return "—";
  const sign = x > 0 ? "+" : "";
  return `${sign}${x.toFixed(1)}%`;
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fillSelect(el, values, allLabel) {
  el.innerHTML = `<option value="">${esc(allLabel)}</option>` +
    [...values].sort().map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
}

fillSelect(categoryEl, new Set(rows.map((r) => r.category)), "All categories");
fillSelect(chainEl, new Set(rows.flatMap((r) => r.chains)), "All chains");

const state = { q: "", category: "", chain: "", sort: "value", watchlist: false, selected: null };

function filtered() {
  const q = state.q.trim().toLowerCase();
  let out = rows.filter((r) => {
    if (state.watchlist && !r.watchlist) return false;
    if (state.category && r.category !== state.category) return false;
    if (state.chain && !r.chains.includes(state.chain)) return false;
    if (q && !(r.name.toLowerCase().includes(q) || r.slug.includes(q))) return false;
    return true;
  });
  const by = {
    value: (a, b) => b.implied_value_usd - a.implied_value_usd,
    tvl: (a, b) => b.tvl_usd - a.tvl_usd,
    growth: (a, b) => (b.change_7d ?? -1e9) - (a.change_7d ?? -1e9),
    age: (a, b) => (b.age_days ?? -1) - (a.age_days ?? -1),
    name: (a, b) => a.name.localeCompare(b.name),
  }[state.sort];
  return out.sort(by);
}

function renderTable() {
  const list = filtered();
  const max = list.length > 0 ? list[0].implied_value_usd : 1;
  rowsEl.innerHTML = list.map((r) => {
    const share = Math.max(2, Math.round((r.implied_value_usd / max) * 100));
    const g = r.change_7d;
    const gClass = g === null ? "" : g >= 0 ? "pos" : "neg";
    const chains = r.chains.slice(0, 3).join(", ") + (r.chains.length > 3 ? ` +${r.chains.length - 3}` : "");
    return `<tr data-slug="${esc(r.slug)}" class="${state.selected === r.slug ? "selected" : ""}">
      <td class="num">${r.rank}</td>
      <td><span class="name">${esc(r.name)}${r.watchlist ? '<span class="badge">WATCHLIST</span>' : ""}<span class="slug">${esc(r.slug)}</span></span></td>
      <td>${esc(r.category)}</td>
      <td>${esc(chains)}</td>
      <td class="num">${money(r.tvl_usd)}</td>
      <td class="num ${gClass}">${pct(g)}</td>
      <td class="num">${money(r.implied_value_usd)}</td>
      <td><div class="bar"><i style="width:${share}%"></i></div></td>
    </tr>`;
  }).join("");
  $("rowCount").textContent =
    `${list.length} of ${rows.length} protocols shown · sorted by ${sortEl.options[sortEl.selectedIndex].text.replace("Sort: ", "")}`;
}

rowsEl.addEventListener("click", (e) => {
  const tr = e.target.closest("tr[data-slug]");
  if (!tr) return;
  openDetail(tr.dataset.slug, true);
});

function factorRow(label, value, note) {
  return `<tr><td>${esc(label)}</td><td>${esc(note)}</td><td>${esc(value)}</td></tr>`;
}

function openDetail(slug, pushHash) {
  const r = bySlug.get(slug);
  if (!r) return;
  state.selected = slug;
  const m = r.model;
  const flags = [];
  if (r.watchlist) flags.push("On the watchlist");
  if (r.age_days !== null && r.age_days < 180) flags.push(`Young — ${r.age_days} days tracked`);
  if (r.chains.length === 1) flags.push("Single chain");
  if (r.change_7d !== null && r.change_7d < -10) flags.push("TVL down over 10% in 7 days");
  if (r.change_7d !== null && r.change_7d > 20) flags.push("TVL up over 20% in 7 days");
  if (flags.length === 0) flags.push("No risk flags");

  detailEl.hidden = false;
  detailEl.innerHTML = `
    <h2><span class="rank-tag">#${r.rank}</span>${esc(r.name)}</h2>
    <p class="meta">${esc(r.category)} · ${esc(r.chains.join(", "))} · TVL ${money(r.tvl_usd)} · ` +
    `tracked since ${esc(r.listed_at ?? "unknown")} · ${esc(r.slug)}</p>
    <div class="flags">${flags.map((f) => `<span class="flag${/down|Young|Single/.test(f) ? " warn" : ""}">${esc(f)}</span>`).join("")}</div>
    <h3>Why it is worth ${money(r.implied_value_usd)}</h3>
    <table class="factors"><tbody>
      ${factorRow("TVL", moneyFull(r.tvl_usd), "Total value locked in the snapshot")}
      ${factorRow("Sector multiple", `× ${m.sector_multiple.toFixed(3)}`, m.comps_used > 0 ? `${esc(m.sector)} comps: median mcap/TVL of ${m.comps_used} priced protocols` : `No priced ${esc(m.sector)} comps: whole-market median`)}
      ${factorRow("Growth", `× ${m.growth_factor.toFixed(3)}`, `7-day TVL change ${pct(m.growth_pct)} (half weight, capped)`)}
      ${factorRow("Maturity", `× ${m.maturity_factor.toFixed(3)}`, r.age_days === null ? "Age unknown" : `${r.age_days} days tracked (caps at 2 years)`)}
      ${factorRow("Breadth", `× ${m.breadth_factor.toFixed(3)}`, `${r.chains.length} chain${r.chains.length === 1 ? "" : "s"} (caps at 6)`)}
      ${factorRow("Size", `× ${m.size_factor.toFixed(3)}`, "Sublinear: bigger TVL re-rates less")}
      <tr class="total"><td>Implied launch value</td><td></td><td>${moneyFull(r.implied_value_usd)}</td></tr>
    </tbody></table>
    <h3>How to farm it</h3>
    <ol class="farm">${r.farm_steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>`;
  detailEl.scrollIntoView({ behavior: "auto", block: "start" });
  if (pushHash) history.replaceState(null, "", `#p=${encodeURIComponent(slug)}`);
  renderTable();
}

function renderStats() {
  const total = rows.reduce((s, r) => s + r.implied_value_usd, 0);
  const medians = DATA.comps.map((c) => c.median).sort((a, b) => a - b);
  const med = medians.length ? medians[Math.floor(medians.length / 2)] : 0;
  $("snapshotLine").textContent =
    `Snapshot ${DATA.asOf} · DefiLlama protocols · floor ${money(DATA.floorUsd)}`;
  $("statsBar").innerHTML = `
    <div class="stat"><b>${rows.length}</b><span>protocols ranked</span></div>
    <div class="stat"><b>${DATA.counts.watchlist}</b><span>on the watchlist</span></div>
    <div class="stat"><b>${money(total)}</b><span>combined implied value</span></div>
    <div class="stat"><b>× ${med.toFixed(2)}</b><span>median sector multiple</span></div>`;
}

function renderExcluded() {
  const list = DATA.excluded.slice(0, 12);
  $("excludedList").innerHTML = list.map((e) =>
    `<li><b>${esc(e.name)}</b> <span class="tvl">${money(e.tvl_usd)} · ${esc(e.category)}</span>` +
    `<span class="why">${esc(e.reason)}</span></li>`).join("") +
    (DATA.excluded.length > 12
      ? `<li><b>+${DATA.excluded.length - 12} more</b><span class="why">Large pre-token names left off for the same reasons.</span></li>`
      : "");
}

function renderComps() {
  $("compRows").innerHTML = DATA.comps.map((c) =>
    `<tr><td>${esc(c.category)}</td><td class="num">${c.comps}</td><td class="num">× ${c.median.toFixed(3)}</td></tr>`).join("");
}

function applyHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  const cat = h.get("c");
  if (cat) {
    state.category = cat;
    categoryEl.value = cat;
  }
  if (h.get("w") === "1") {
    state.watchlist = true;
    watchlistEl.checked = true;
  }
  const p = h.get("p");
  if (p && bySlug.has(p)) {
    renderTable();
    openDetail(p, false);
    return;
  }
  renderTable();
}

function bind() {
  qEl.addEventListener("input", () => { state.q = qEl.value; renderTable(); });
  categoryEl.addEventListener("change", () => { state.category = categoryEl.value; renderTable(); });
  chainEl.addEventListener("change", () => { state.chain = chainEl.value; renderTable(); });
  sortEl.addEventListener("change", () => { state.sort = sortEl.value; renderTable(); });
  watchlistEl.addEventListener("change", () => { state.watchlist = watchlistEl.checked; renderTable(); });
  $("reset").addEventListener("click", () => {
    Object.assign(state, { q: "", category: "", chain: "", sort: "value", watchlist: false, selected: null });
    qEl.value = "";
    categoryEl.value = "";
    chainEl.value = "";
    sortEl.value = "value";
    watchlistEl.checked = false;
    detailEl.hidden = true;
    history.replaceState(null, "", location.pathname);
    renderTable();
  });
}

renderStats();
renderExcluded();
renderComps();
bind();
applyHash();
