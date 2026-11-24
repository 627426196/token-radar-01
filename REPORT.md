# Token Launch Radar — build report

Entry for make.fun bounty **token-radar-01** ("Build the best token launch
radar"). Prize pool $1,325 (1st $1,000, 2nd–5th $50, 6th–10th $25, USDC on
Solana). Deadline **2026-12-14 18:00 Beijing**. Built 2026-11-25.

## What was built

A complete entry in `~/workspace/makefun/token-radar-01-entry/`:

| Path | What it is |
| --- | --- |
| `main.ts` | Program entry: reads the snapshot, writes the output. Node 22+, standard library only. |
| `lib/model.ts` | Model radar-2, board selection, farm plans. |
| `vendor/makefun-board.ts` | The scorer's dossier library, copied verbatim from the starter. |
| `dashboard/` | The static dashboard (`index.html`, `app.css`, `app.js`; 27,103 bytes total). |
| `screenshots/` | Three real 1440×900 PNG screenshots of the dashboard. |
| `gate-check.mjs` | Local replication of the seven gate rows (dev tooling). |
| `README.md`, `LICENSE` (MIT), `.makefun/owner.json` (wallet placeholder), `.gitignore` | Submission files. |
| `out/` | Local run output (generated, gitignored). |

## The model — radar-2

```
implied value = TVL × multiple(TVL) × growth × maturity × chains
```

- **Size multiple** `0.25 × (TVL/$1B)^(−0.15)`, clamped 0.10–0.60: the launch
  multiple compresses as size grows ($1B → 0.25×, $100M → ~0.35×, $10B → ~0.18×).
- **Momentum** `1 + clamp(7d, −50%, +150%) × 0.75`: a launch is priced on flow;
  clamped hard because the snapshot has a +4,448% week, which is mostly noise.
- **Seasoning** `0.70 + 0.30 × min(age, 3y)/3y`: years run with no token, capped at
  three years; unknown listing date counts as one year.
- **Reach** `1 + 0.05 × min(chains, 8)`: each extra chain is another distribution
  surface for a future token; capped at eight.

Worked example — #1 Steakhouse Financial: $2.75B × 0.215 = $591.4M base × 0.98
× 0.85 × 1.40 = **$691.2M**.

Two things were checked, not assumed:

1. **The product rule.** A wrapped, staked or bridged version of a token that
   already trades is not a launch — it is restating the market. Rankable means
   a standalone pre-token protocol: not an exchange, not a bridge, not a
   liquid-staking or restaking receipt, not a wrapped/staked product, not an
   exchange's own product, not a version-named pool. This is the same rule the
   watchlist itself was built with, applied to the early rows too. It removes
   48 rows the starter's rule would have kept. The snapshot records Binance
   staked ETH as pre-token with $7.45B TVL; it is a Liquid Staking receipt of a
   token that trades, and it is out on this rule.
2. **Calibration.** Live-token protocols in this snapshot trade at a median
   0.17× their TVL (25th–75th percentile 0.03×–1.00×, n = 144 with a market cap
   recorded). But the median is not stable — split the sample in half and the
   two medians are 0.03× and 1.00× — so no multiple was fitted from it. The
   0.25× base at $1B is a prior inside the observed range. The live-token
   range is shown in the dashboard's detail view as a comparable
   ("at those multiples this protocol's TVL alone would be worth $A–$B"), not
   as the model.

## The board

- **178 rows**: all 40 watchlist protocols + 138 rankable early rows below the
  floor. Ranks exactly 1–178, implied values non-increasing, all 178 distinct.
- **Top 5**: Steakhouse Financial $691.2M, Gauntlet $456.2M, Veda $419.0M,
  USDD $255.7M, Upshift $184.2M. Median implied value $7.4M.
- **Live tab**: top 24 live-token protocols by market cap (Rain $2.65B first),
  shown for comparison only, never ranked against pre-token rows.
- Every row carries a 6-step farm plan (149–249 chars per step) with a
  category-specific action, a growth-aware step, a hold period by age, and a
  cost + time per step — plus a one-line farm economics summary
  ("6 steps · $250 capital · under $15 gas · ~50 min active time · 45-day hold").

## How this beats the starter (2-plain anchor)

| | Starter | This entry |
| --- | --- | --- |
| Model | TVL × 0.25, growth weight 0.5, age 0.6–1.0 | Four factors with a size-compressed multiple, stronger momentum (0.75), chain reach; every factor documented with its reason |
| Board | 200 rows: 40 watchlist + top 160 below floor by TVL | 178 rows: 40 watchlist + **every** rankable early protocol (no arbitrary top-160 cut), with the product rule applied (48 wrapped/staked/bridged rows removed) |
| Farm plans | 6 generic steps, category template only | 6 steps with a category-specific action (35 categories), a growth-aware step, cost + time per step, and a farm-economics summary |
| Dashboard | Light theme, search + category + tabs + sort | Dark radar theme, search + category + chain filters, Pre-token/Live tabs, growing-only + watchlist-only toggles, sortable columns, detail drawer with the full four-factor arithmetic, a "why this rank" line, a live-token comparable range, and the page recomputing every implied value from the snapshot figures |
| Calibration | None stated | Live-token mcap/TVL checked (median 0.17×, p25–p75 0.03×–1.00×, split-half instability documented); 0.25× stated as a prior, not a fit |
| Dossier text | ~29 KB | 27,369 bytes — all three dashboard files shown whole, no cut |

## Local check results (2026-11-25)

Run from the entry directory:

```bash
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
node gate-check.mjs out <snapshot.json>
```

- **All 7 gate rows pass** (see `gate-check.mjs` for the replication):
  dashboard_files (3 files, 27,103 bytes, index.html + css + js, no URLs);
  board_file (178 rows, 375,411 bytes, all slugs in snapshot);
  sorted_by_value (ranks 1–178, non-increasing, 178 distinct values);
  coverage (40/40 watchlist); farm_steps (6 per row, 20–600 chars);
  screenshots (3 PNGs, 1440×900, each ≤ 512 KiB); dossier_matches
  (byte-identical to a fresh `buildDossier`, schema `makefun/dossier/v1`,
  text 27,369 bytes, no cut).
- **Determinism**: two runs write byte-identical output (`diff -r` clean).
- **Screenshots are real**: taken with Playwright headless Chromium at
  1440×900 from the built dashboard — 1-board.png (149 KB, full board),
  2-detail.png (241 KB, detail drawer for #1 Steakhouse Financial),
  3-filtered.png (155 KB, category = Risk Curators, 33 of 178 shown).
- **Dashboard behaviour verified in a real browser**: live tab renders 24 rows
  with the Market cap column; search "gauntlet" narrows to 1 row; growing-only
  shows 55 of 178; no JS errors.
- **No local grade exists for this competition** ("There is no local grade of
  this competition: the server grades every entry"). The gate replication +
  determinism check above is the local substitute; there is no `grade-local`
  command in the shipped CLI to run.

## Competitive context (live leaderboard, 2026-11-25)

The leaderboard is already live (unofficial; the final run 10 minutes after the
deadline sets the official ranking). Current leaders:

1. @kiencx — "Launch Radar v4: every value term fitted and tested held-out
   twice, token odds from the peers' record, integrity strip, costed farm verdicts"
2. @kevin — "Firstlight v2: every value term kept or dropped on two blind tests
   (walk-forward x2.26, leave-one-out x2.99), range honesty, costed farm verdicts in $/hour"
3. @nyx77 — "Launch Radar"
8. @sudhan — "fitted launch pricing, 66 farm plans, a KPI strip and every one of 758 protocols accounted for"

What the leaders do that this entry does not: fitted value terms with held-out
tests, a launch-probability ("token odds") estimate, and $/hour farm economics.
What this entry does instead, deliberately: a prior, not a fit, because the
only fit available in the snapshot (live mcap/TVL) is unstable across halves;
no launch-probability number, because the snapshot carries no launch history
to estimate one from — an invented probability would be worse than none. The
product rule, the comparable range, and the farm-economics summary are the
parts of the leaders' playbook this entry does adopt, in forms the snapshot
actually supports. If there is time before the deadline, the highest-value
next step is a held-out test of the model's terms against live-token
comparables (e.g. fit the size exponent on one half of the live set, check it
on the other) — see "Open items".

## Submission steps (not done — waiting on the user's account)

1. **Create the GitHub repo** (owner `627426196`). Proposed name
   `token-radar-01` — the badges in README.md use it; if the repo is created
   under a different name, update the two badge URLs and the make.fun link.
   Repo must be public, created after 2026-11-14T10:00:00Z, OSI licence (MIT
   included), `main.ts` at the root.
2. **Commit everything, including `vendor/makefun-board.ts`.** Do not put
   `vendor/` in `.gitignore` — an entry was already rejected in round 1
   because the grader's clean clone lacked that file. `.gitignore` here only
   ignores `out/`.
3. **Verify from a clean clone**: clone to a fresh directory and run the
   grader's command exactly (`MAKEFUN_OUTPUT_DIR=out node main.ts --input
   <snapshot>`) — do not trust the local run alone.
4. **Fill `.makefun/owner.json`** with the connected agent wallet's full base58
   address. The file now holds the placeholder `REPLACE_WITH_AGENT_WALLET_BASE58`
   — it is not a real address. (Agent wallet known so far only as 2TMPB…WrCqu;
   the full address must come from the parent agent's record. Prize goes to the
   agent wallet first, then transfers to the user's own wallet or a bound
   Phantom at claim time.)
5. **README + About**: README already carries the three make.fun badges and a
   link to the bounty page. Set the GitHub About website to the make.fun page
   and the topic `makefun` (plus `ai-agents`, `bounties`).
6. **Transcripts — no re-recording needed.** This competition is
   **bundle-based, not strict-record**: the live requirements carry no "strict"
   requirement, and deliverables are repo_url + commit_sha + transcript bundle.
   Do not re-run the build through `record`. At submit time, bundle this build
   session with `node cli/makefun.mjs bundle` (include the parent chats — this
   session was spawned by the parent agent, so the run record needs the chain
   up to the user's typed prompt — and `--muse-usage` for the usage rows).
   Never fabricate or edit transcripts.
7. **Pre-submit check + submit**: run the CLI `check` on the repo and the
   transcript bundle, then submit through the make.fun account
   (@bright-pika-25-6631, registered 2026-11-25). Max 5 submissions/day,
   10 total; Force_Last — the last submission before the deadline is final.
   Submission later requires a Solana wallet signature (escrow is funded).
8. **Claim**: if placed, the reward is paid in USDC on Solana to the agent
   wallet; the user is not a US citizen, so the tax-residency clearance goes
   as a non-US tax resident, and the prize is then transferred to his own
   wallet. That step is his decision, not the agent's.

## Open items / possible improvements before the deadline

- Held-out test of the model terms against live-token comparables (fit the size
  exponent on one half, check it on the other); if it holds, the multiple
  becomes a fit instead of a prior.
- A launch-probability signal grounded in something the snapshot supports
  (e.g. age-with-no-token as a hazard: older pre-token protocols that still
  have no token are less likely to launch soon) — only if it can be stated
  honestly as a relative ordering, not a calibrated probability.
- The dashboard's model panel could carry the worked example for a second
  protocol (a fast grower) to show the momentum term doing work.
- `makefun-run.json` (the CLI's run record) is produced at submit time, not
  part of this build.
