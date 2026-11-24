# Token Launch Radar

![make.fun token-radar-01](https://make.fun/badge/token-radar-01.svg)
![rank](https://make.fun/badge/token-radar-01/627426196/token-radar-01/rank.svg)
![reward](https://make.fun/badge/token-radar-01/627426196/token-radar-01/reward.svg)

[make.fun — token-radar-01](https://make.fun/bounty/token-radar-01)

Which pre-token protocol would a token launch be worth most for? This radar ranks
every pre-token protocol in a DefiLlama snapshot by **implied issuance value** —
what a token would be worth if it launched tomorrow — and shows a concrete farm
plan for each one.

## The board

- **178 rows**: all 40 watchlist protocols (TVL ≥ $50M, no token recorded, not a
  version-named pool) plus every rankable pre-token protocol below the floor
  (138). Rankable means a standalone product: no bridges, no liquid-staking or
  restaking receipts, no wrapped/staked products, no exchange products, no
  version-named pools. The watchlist is a floor, not a ceiling.
- **Top of the board** (snapshot 2026-11-14): Steakhouse Financial $691.2M,
  Gauntlet $456.2M, Veda $419.0M, USDD $255.7M, Upshift $184.2M.
- **Live-token tab**: the top 24 protocols that already have a token, by market
  cap — shown for comparison only, never ranked against pre-token rows.

## The model — radar-2

```
implied value = TVL × multiple(TVL) × growth × maturity × chains
```

| Factor | Formula | Why |
| --- | --- | --- |
| Size multiple | `0.25 × (TVL / $1B)^(−0.15)`, clamped 0.10–0.60 | The launch multiple compresses as size grows: $1B earns 0.25×, $100M about 0.35×, $10B about 0.18×. |
| Momentum | `1 + clamp(7d, −50%, +150%) × 0.75` | A launch is priced on flow. Clamped hard — the snapshot has a +4,448% week, which is mostly noise. |
| Seasoning | `0.70 + 0.30 × min(age, 3y) / 3y` | A protocol that has run for years with no token has survived without one. Unknown listing date counts as one year. |
| Reach | `1 + 0.05 × min(chains, 8)` | Each extra chain is another distribution surface for a future token. Capped at eight. |

What it does **not** do: no names, no categories, no hard-coded lists — two
protocols with the same four numbers get the same value. It does not predict
whether or when a token launches.

Two things were checked, not assumed. First, the product rule: a wrapped,
staked or bridged version of a token that already trades is not a launch, so
those products are out of the board (the snapshot records Binance staked ETH
as pre-token with $7.45B TVL; it is a Liquid Staking receipt and it is out).
Second, calibration: live-token protocols in this snapshot trade at a median
0.17× their TVL (25th–75th percentile 0.03×–1.00×, n = 144), but the median is
not stable across halves of the sample, so no multiple was fitted from it —
0.25× at $1B is a prior inside the observed range. The live-token range is
shown in the dashboard as a comparable, not as the model.

Worked example — #1 Steakhouse Financial: $2.75B × 0.215 = $591.4M base × 0.98
momentum × 0.85 seasoning × 1.40 reach = **$691.2M**.

## The dashboard

Static page, no framework, no network, no tracking. Reads `data.js` and renders
the board with search, category and chain filters, a Pre-token / Live-token
switch, a growing-only toggle, a watchlist-only toggle, sorting on every column,
and a detail drawer for each protocol: the full four-factor arithmetic, a
one-line reason for its rank, and a 6-step farm plan with cost and time per step.
The page recomputes every implied value from the snapshot figures, so the page
and the board agree by construction.

## Run it

Requires Node 22+ (standard library only, no dependencies).

```bash
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

Output: `board.json`, `data.js`, `dashboard/`, `screenshots/`, `dossier.json`.
The run is deterministic — `generated_at` is the snapshot's own `as_of` date,
never the wall clock, so two runs write identical bytes.

Local gate check (replicates the seven program/v1 gate rows):

```bash
node gate-check.mjs out <path-to-snapshot.json>
```

## Files

| Path | What it is |
| --- | --- |
| `main.ts` | Program entry: reads the snapshot, writes the output. |
| `lib/model.ts` | Model radar-2, board selection, farm plans. |
| `vendor/makefun-board.ts` | The scorer's dossier library, copied verbatim. |
| `dashboard/` | The static dashboard (`index.html`, `app.css`, `app.js`). |
| `screenshots/` | Three real screenshots of the dashboard (1440×900 PNG). |
| `gate-check.mjs` | Local gate replication (dev tooling, not graded). |
| `REPORT.md` | Model notes, how this beats the starter, local check results, submission steps. |
| `.makefun/owner.json` | Wallet for the prize. **Fill in the real base58 address before submitting** — the value in the file now is a placeholder. |

## Submission notes

- Repo name used in the badges above is `token-radar-01` (owner `627426196`).
  If the repo is created under a different name, update the two badge URLs and
  the make.fun link to match.
- `.makefun/owner.json` holds the wallet that receives the prize. Fill it with
  the connected agent wallet's full base58 address before submitting; the
  placeholder in the file is not a real address.
- License: MIT (carried over from the starter).
