// Token-launch valuation model.
//
// The question this board answers: if a pre-token protocol launched a
// token tomorrow, what would it be worth? The answer is built from the
// snapshot itself, not from a magic number:
//
//   implied value = TVL x sector multiple x growth x maturity x breadth x size
//
// The sector multiple is the median market-cap-to-TVL of the tokenised
// protocols in the SAME category, taken from the same snapshot. A category
// with fewer than four priced comps falls back to the whole market's
// median. Multiples are clamped to [0.05, 0.60]: the snapshot's own
// medians run 0.04-0.75, and the clamp keeps one wild category from
// deciding the board. Market cap here is circulating cap, not FDV, so
// the read is conservative: a launch's fully diluted value would be
// higher than the number shown.
//
// The other factors are dampened on purpose. A one-week TVL spike is
// worth half its face value. Age helps, but only up to two years. Being
// on more chains helps, but only up to six. And the size factor is
// sublinear: doubling TVL does not double implied value, because the
// biggest protocols are the hardest to re-rate.
//
// What the board does NOT rank: exchanges, bridges, liquid-staking and
// restaking products, and anything whose name says wrapped, staked or
// staking. Those are not protocols waiting on a launch; they are a
// product of a token that already trades, or a business that will never
// issue one. The dashboard lists them separately, with reasons.

import { farmPlan } from "./farm.ts";

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export interface ModelBreakdown {
  sector: string;
  sector_multiple: number;
  comps_used: number;
  comp_median: number;
  growth_pct: number | null;
  growth_factor: number;
  maturity_factor: number;
  breadth_factor: number;
  size_factor: number;
  age_days: number | null;
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: string;
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  model: ModelBreakdown;
  farm_steps: string[];
}

export interface ExcludedEntry {
  slug: string;
  name: string;
  category: string;
  tvl_usd: number;
  reason: string;
}

export interface CompRow {
  category: string;
  comps: number;
  median: number;
}

const EXCLUDED_CATEGORIES = new Set([
  "Bridge",
  "Canonical Bridge",
  "Liquid Staking",
  "Liquid Restaking",
  "Restaked BTC",
  "CEX",
]);

const EXCHANGE_PREFIXES = [
  "Binance",
  "Coinbase",
  "Bybit",
  "Kraken",
  "Bitget",
  "OKX",
  "Bitfinex",
  "Gemini",
];

const VERSION_SUFFIX = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

export function isPreToken(p: SnapshotProtocol): boolean {
  return p.gecko_id === null && p.symbol === null;
}

// Why a protocol is left off the ranked board, or null when it belongs.
export function exclusionReason(p: SnapshotProtocol): string | null {
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) {
    if (p.category === "CEX") return "Centralised exchange: it will never issue a protocol token";
    if (p.category === "Liquid Staking" || p.category === "Liquid Restaking" || p.category === "Restaked BTC")
      return "Staked product of a token that already trades";
    return "Bridge product: it moves another chain's assets, it is not a launch candidate";
  }
  if (WRAPPED_WORD.test(p.name)) return "Wrapped or staked product of a token that already trades";
  if (EXCHANGE_PREFIXES.some((x) => p.name.startsWith(x))) return "Exchange-branded product, not a protocol launch";
  if (VERSION_SUFFIX.test(p.name)) return "Versioned fork of another protocol";
  return null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

// Median market-cap/TVL for every category with at least four priced
// comps, plus the whole-market median as the fallback.
export function calibrateComps(protocols: SnapshotProtocol[]): {
  byCategory: Map<string, { median: number; n: number }>;
  overall: number;
  rows: CompRow[];
} {
  const byCategory = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of protocols) {
    if (p.mcap_usd === null || p.tvl_usd <= 0) continue;
    if (p.gecko_id === null && p.symbol === null) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    all.push(ratio);
    const cat = p.category ?? "Uncategorised";
    const list = byCategory.get(cat) ?? [];
    list.push(ratio);
    byCategory.set(cat, list);
  }
  const overall = all.length > 0 ? median(all) : 0.2;
  const out = new Map<string, { median: number; n: number }>();
  const rows: CompRow[] = [];
  for (const [cat, values] of [...byCategory.entries()].sort()) {
    if (values.length >= 4) {
      const m = clamp(median(values), 0.05, 0.6);
      out.set(cat, { median: m, n: values.length });
      rows.push({ category: cat, comps: values.length, median: m });
    }
  }
  return { byCategory: out, overall: clamp(overall, 0.05, 0.6), rows };
}

function ageDays(listedAt: string | null, asOf: string): number | null {
  if (listedAt === null) return null;
  const start = Date.parse(`${listedAt}T00:00:00Z`);
  const end = Date.parse(`${asOf}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.floor((end - start) / 86_400_000);
}

// Growth is worth half its face value, winsorised to [-30%, +60%] so a
// one-week spike or crash cannot decide the board.
function growthFactor(change7d: number | null): { pct: number | null; factor: number } {
  if (change7d === null || !Number.isFinite(change7d)) return { pct: null, factor: 1 };
  const g = clamp(change7d, -30, 60);
  return { pct: change7d, factor: 1 + 0.4 * (g / 100) };
}

// Maturity rewards durability, capped at two years of track record.
function maturityFactor(age: number | null): number {
  if (age === null) return 0.85;
  return 0.75 + 0.25 * Math.min(1, age / 730);
}

// Breadth rewards multi-chain reach, capped at six chains.
function breadthFactor(chains: string[]): number {
  return 1 + 0.02 * Math.min(Math.max(chains.length - 1, 0), 5);
}

// Sublinear size: doubling TVL lifts implied value by less than double.
function sizeFactor(tvlUsd: number): number {
  const f = Math.pow(Math.max(tvlUsd, 1) / 100_000_000, -0.06);
  return clamp(f, 0.75, 1.12);
}

export interface BuiltBoard {
  rows: BoardRow[];
  excluded: ExcludedEntry[];
  comps: CompRow[];
  counts: {
    protocols: number;
    watchlist: number;
    preToken: number;
    boardRows: number;
    excludedAboveFloor: number;
  };
}

// Build the board: every watchlist protocol, plus every pre-token
// protocol below the floor that passes the exclusion rules. Ranked by
// implied value, highest first.
export function buildBoard(snapshot: Snapshot): BuiltBoard {
  const watchlist = new Set(snapshot.watchlist);
  const { byCategory, overall, rows: compRows } = calibrateComps(snapshot.protocols);

  const scored: BoardRow[] = [];
  const excluded: ExcludedEntry[] = [];
  let preToken = 0;

  for (const p of snapshot.protocols) {
    if (!isPreToken(p)) continue;
    preToken++;
    const onWatchlist = watchlist.has(p.slug);
    const reason = exclusionReason(p);
    if (reason !== null) {
      if (p.tvl_usd >= snapshot.floor_usd) {
        excluded.push({
          slug: p.slug,
          name: p.name,
          category: p.category ?? "Uncategorised",
          tvl_usd: p.tvl_usd,
          reason,
        });
      }
      continue;
    }
    // Above the floor, only the watchlist ranks. The house verified
    // parent-protocol status for those forty; for other large names the
    // snapshot cannot show whether they are a sub-product of another
    // protocol, so they are left off rather than ranked on a guess.
    if (!onWatchlist && p.tvl_usd >= snapshot.floor_usd) {
      excluded.push({
        slug: p.slug,
        name: p.name,
        category: p.category ?? "Uncategorised",
        tvl_usd: p.tvl_usd,
        reason: "Not on the watchlist: parent status cannot be verified from the snapshot",
      });
      continue;
    }

    const age = ageDays(p.listed_at, snapshot.as_of);
    const sector = p.category ?? "Uncategorised";
    const comp = byCategory.get(sector);
    const sectorMultiple = comp ? comp.median : overall;
    const growth = growthFactor(p.change_7d);
    const maturity = maturityFactor(age);
    const breadth = breadthFactor(p.chains);
    const size = sizeFactor(p.tvl_usd);
    const implied = Math.max(
      1,
      Math.round(p.tvl_usd * sectorMultiple * growth.factor * maturity * breadth * size),
    );

    scored.push({
      rank: 0,
      slug: p.slug,
      name: p.name,
      category: sector,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      mcap_usd: p.mcap_usd,
      listed_at: p.listed_at,
      gecko_id: p.gecko_id,
      symbol: p.symbol,
      token_status: "pre-token",
      watchlist: onWatchlist,
      age_days: age,
      implied_value_usd: implied,
      model: {
        sector,
        sector_multiple: sectorMultiple,
        comps_used: comp ? comp.n : 0,
        comp_median: comp ? comp.median : overall,
        growth_pct: growth.pct,
        growth_factor: growth.factor,
        maturity_factor: maturity,
        breadth_factor: breadth,
        size_factor: size,
        age_days: age,
      },
      farm_steps: farmPlan({
        name: p.name,
        slug: p.slug,
        category: p.category,
        chains: p.chains,
        tvlUsd: p.tvl_usd,
      }),
    });
  }

  scored.sort((a, b) => b.implied_value_usd - a.implied_value_usd);
  scored.forEach((row, i) => {
    row.rank = i + 1;
  });
  excluded.sort((a, b) => b.tvl_usd - a.tvl_usd);

  return {
    rows: scored,
    excluded,
    comps: compRows,
    counts: {
      protocols: snapshot.protocols.length,
      watchlist: snapshot.watchlist.length,
      preToken,
      boardRows: scored.length,
      excludedAboveFloor: excluded.length,
    },
  };
}
