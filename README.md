# Token Radar

Pre-token protocols, ranked by what a launch would be worth.

## What it does

`main.ts` reads the sealed DefiLlama snapshot (`/input/snapshot.json`),
scores every pre-token protocol, and writes the ranked board, the
dashboard's data, and the judge's dossier to the output directory:

```
node main.ts [--input <snapshot.json>] [--output <dir>]
```

Output defaults to `$MAKEFUN_OUTPUT_DIR`, else `/output`.

## The model

```
implied value = TVL × sector multiple × growth × maturity × breadth × size
```

- **Sector multiple**: the median market-cap/TVL of the tokenised
  protocols in the same category, taken from the same snapshot
  (fallback: the whole market's median). Clamped to [0.05, 0.60].
- **Growth**: the 7-day TVL change at half weight, winsorised to
  [-30%, +60%].
- **Maturity**: track record, capped at two years.
- **Breadth**: multi-chain reach, capped at six chains.
- **Size**: sublinear — doubling TVL lifts implied value by less
  than double.

The board covers the whole 40-protocol watchlist plus every pre-token
protocol below the $50M floor that passes the exclusion rules —
178 rows. Exchanges, bridges, liquid-staking products and wrapped or
staked products are left off on purpose (they are not launch
candidates) and listed separately in the dashboard with reasons.

## Files

- `main.ts` — entrypoint: reads the snapshot, writes the outputs.
- `lib/model.ts` — comps calibration, scoring, board assembly.
- `lib/farm.ts` — six-step farm plan per protocol, category-aware.
- `dashboard/` — the static page (index.html, app.css, app.js).
- `vendor/makefun-board.ts` — the kit's dossier builder.
- `screenshots/` — the board, a protocol detail, and a filtered view.
