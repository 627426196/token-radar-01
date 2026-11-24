// radar-2: an issuance-value model for pre-token protocols.
//
// A token launch is priced on what the protocol already is, not on what a
// whitepaper promises. So implied value is built only from the four numbers
// the snapshot actually carries for a protocol, and nothing else:
//
//   implied = TVL x multiple(TVL) x growth x maturity x chains
//
//   multiple(TVL)  = 0.25 x (TVL / 1e9)^(-0.15), clamped to [0.10, 0.60]
//     The launch multiple compresses as size grows: a $1B protocol earns the
//     full 0.25x on its TVL, a $100M one earns about 0.35x, a $10B one about
//     0.18x. A token is a claim on the protocol, and claims on larger
//     protocols are worth more in dollars but less per dollar of TVL.
//   growth         = 1 + clamp(change_7d, -50, +150) / 100 x 0.75
//     Seven-day TVL momentum is the only flow signal in the snapshot. A
//     launch is priced on momentum: a protocol adding users fast is
//     accumulating the base a token would monetise. Clamped hard because a
//     one-week spike (the snapshot has a +4,448% outlier) is mostly noise.
//   maturity       = 0.70 + 0.30 x min(age_days, 1095) / 1095
//     Days since listed_at, capped at three years. A protocol that has run
//     for years with no token has survived without one; its launch starts
//     from proven durability. Unknown listed_at counts as 365 days.
//   chains         = 1 + 0.05 x min(chain_count, 8)
//     Each extra chain is another distribution surface for a future token:
//     more chains, more wallets that can hold it. Capped at eight so a
//     40-chain listing cannot buy the top of the board.
//
// What this model deliberately does NOT do:
//   - no names, no categories, no hard-coded protocol lists: two protocols
//     with the same four numbers get the same value, whichever they are;
//   - no prediction of whether or when a token launches: implied value is
//     "what a token would be worth if it launched tomorrow", not a forecast;
//   - no live-token comparison: live tokens already have a market price,
//     so they are shown on a separate tab, never ranked against pre-token
//     rows.
//
// The product rule (what counts as a launch candidate):
//   A wrapped, staked or bridged version of a token that already trades is
//   not a launch — it is restating the market. So a rankable protocol is a
//   standalone pre-token protocol: not an exchange, not a bridge, not a
//   liquid-staking or restaking receipt, not a version-named pool, and its
//   name is not a wrapped/staked product or an exchange's own product. This
//   is the same rule the watchlist itself was built with, applied to the
//   early rows too. (The snapshot records Binance staked ETH as pre-token
//   with $7.45B TVL; it is a Liquid Staking receipt of a token that trades,
//   and it is out on this rule — a board that ranked it #1 would be wrong
//   in a way anyone can see in one glance.)
//
// Calibration, checked not assumed:
//   Live-token protocols in this snapshot trade at a median 0.17x their TVL
//   (25th-75th percentile 0.03x-1.00x, n = 144 with a market cap recorded).
//   But the median is not stable — split the sample in half and the two
//   medians are 0.03x and 1.00x — so no multiple was fitted from it. The
//   0.25x base at $1B is a prior inside the observed range, and the size
//   compression is the part the model actually asserts. The live-token
//   range is shown in the dashboard as a comparable, not as the model.
//
// The board carries every watchlist protocol plus every rankable pre-token
// protocol below the floor, ranked by implied value, ties broken by slug.
// The watchlist is a floor, not a ceiling: a protocol below it is no worse
// a launch candidate.

export const MODEL_VERSION = 'radar-2';

export interface Protocol {
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
  floor_usd: number;
  watchlist: string[];
  protocols: Protocol[];
}

export interface ModelBreakdown {
  implied_value_usd: number;
  tvl_multiple: number;
  base_usd: number;
  growth_pct: number;
  growth_multiplier: number;
  age_days: number;
  maturity_multiplier: number;
  chain_count: number;
  chain_multiplier: number;
}

export interface BoardRow {
  rank: number;
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
  token_status: 'pre-token' | 'live';
  age_days: number | null;
  implied_value_usd: number;
  model: ModelBreakdown | null;
  farm_steps: string[];
  farm_summary: string;
}

const DAY_MS = 86_400_000;
const VERSIONED_NAME = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** Categories that are a wrapped, staked or bridged product, not a launch. */
const PRODUCT_CATEGORIES = new Set([
  'CEX',
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
]);
/** A whole word in the name that marks a wrapped/staked product. */
const WRAPPED_NAME = /\b(wrapped|staked|staking)\b/i;
/** Names that begin with an exchange's name are that exchange's product. */
const EXCHANGE_NAMES = [
  'Binance', 'Coinbase', 'Kraken', 'OKX', 'Bybit', 'Bitfinex', 'Huobi',
  'KuCoin', 'Gate', 'Crypto.com', 'Bitstamp', 'Gemini', 'Bitget', 'MEXC',
  'Bithumb', 'Upbit', 'Deribit',
];

function startsWithExchange(name: string): boolean {
  const lower = name.toLowerCase();
  return EXCHANGE_NAMES.some((e) => {
    const el = e.toLowerCase();
    return lower === el || lower.startsWith(el + ' ');
  });
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export function isLiveToken(p: Protocol): boolean {
  return p.mcap_usd !== null || p.gecko_id !== null || p.symbol !== null;
}

export function isPreToken(p: Protocol): boolean {
  return !isLiveToken(p);
}

export function isVersionNamed(name: string): boolean {
  return VERSIONED_NAME.test(name);
}

/** Rankable = a standalone pre-token protocol: not an exchange, not a
 *  bridge, not a liquid-staking or restaking receipt, not a wrapped or
 *  staked product, not an exchange's own product, not a version-named
 *  pool of some other protocol. */
export function isRankable(p: Protocol): boolean {
  return (
    isPreToken(p) &&
    !PRODUCT_CATEGORIES.has(p.category ?? '') &&
    !WRAPPED_NAME.test(p.name) &&
    !startsWithExchange(p.name) &&
    !isVersionNamed(p.name)
  );
}

export function ageDays(p: Protocol, asOf: string): number | null {
  if (!p.listed_at) return null;
  return Math.max(0, Math.floor((Date.parse(asOf) - Date.parse(p.listed_at)) / DAY_MS));
}

/** One money formatter for the whole program: $1.23B / $456.7M / $89.0K. */
export function money(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + Math.round(n);
}

/** The four-factor issuance-value model. Pure function of the snapshot. */
export function modelOf(p: Protocol, asOf: string): ModelBreakdown {
  const tvlMultiple = clamp(0.25 * Math.pow(p.tvl_usd / 1e9, -0.15), 0.1, 0.6);
  const base = p.tvl_usd * tvlMultiple;
  const growthPct = clamp(p.change_7d ?? 0, -50, 150);
  const growthMultiplier = 1 + (growthPct / 100) * 0.75;
  const age = ageDays(p, asOf) ?? 365;
  const maturityMultiplier = 0.7 + 0.3 * (Math.min(age, 1095) / 1095);
  const chainCount = p.chains.length;
  const chainMultiplier = 1 + 0.05 * Math.min(chainCount, 8);
  const implied = Math.max(1, Math.round(base * growthMultiplier * maturityMultiplier * chainMultiplier));
  return {
    implied_value_usd: implied,
    tvl_multiple: tvlMultiple,
    base_usd: Math.round(base),
    growth_pct: growthPct,
    growth_multiplier: growthMultiplier,
    age_days: age,
    maturity_multiplier: maturityMultiplier,
    chain_count: chainCount,
    chain_multiplier: chainMultiplier,
  };
}

function mainChain(p: Protocol): string {
  return p.chains[0] ?? 'Ethereum';
}

/** The one concrete action that qualifies a farmer for this protocol,
 *  by what the protocol actually does. {chain} is the protocol's first
 *  listed chain. Everything else falls back to the generic product step. */
const CATEGORY_ACTION: Record<string, string> = {
  'Risk Curators':
    'Deposit into a curated vault on {chain} and hold the receipt token; the vault fee stream is what a future governance token would price.',
  'Onchain Capital Allocator':
    'Allocate to a vault on {chain} and keep the position open; allocators reward wallets that stay in through a full cycle.',
  'RWA':
    'Hold the protocol yield-bearing token on {chain}; its yield is the cash flow a launch would capitalise, so hold the token itself, not a wrapped copy.',
  'Lending':
    'Supply collateral on {chain} and borrow a small amount (under 30% of the collateral) so the position stays active; never borrow against the whole deposit.',
  'Dexs':
    'Provide liquidity to the main pool on {chain} and keep the LP receipt; pool fees are the revenue a token would share.',
  'Yield':
    'Stake into the top yield vault on {chain} and leave the position compounding; yield vaults weight wallets by time in the vault.',
  'Yield Aggregator':
    'Deposit into the highest-TVL strategy on {chain} and keep it there; aggregators snapshot positions, not one-off deposits.',
  'Liquid Staking':
    'Stake on {chain} and hold the liquid staking receipt token in your own wallet; the receipt is the position that gets counted.',
  'Liquid Restaking':
    'Restake the liquid staking receipt on {chain} and hold the restaked receipt; do not lock it in a third-party vault.',
  'Restaking':
    'Restake on {chain} and keep the restaked position in your own wallet so the protocol can see it at snapshot time.',
  'Bridge':
    'Bridge a small amount through the protocol to {chain} once a week; bridge volume is the activity a launch would reward, not a single transfer.',
  'Canonical Bridge':
    'Bridge into {chain} through the canonical route and keep the funds on the destination chain; one-way bridges do not count as usage.',
  'Derivatives':
    'Open a small, fully collateralised position on {chain} and close it in profit or at a small loss; volume and a live account matter more than size.',
  'CDP':
    'Mint the stablecoin against collateral on {chain} and keep the debt ratio under 50%; a healthy vault is the position that qualifies.',
  'Basis Trading':
    'Open the basis trade on {chain} with a small notional and hold it through one funding cycle; the trade is the product, so use it.',
  'Staking Pool':
    'Stake into the pool on {chain} and leave the stake untouched; pool snapshots favour wallets that do not hop in and out.',
  'Chain':
    'Use the chain itself: bridge in, swap once, and hold the native asset on {chain} in your own wallet; chain launches reward on-chain wallets.',
  'Liquidity Manager':
    'Deposit into a managed liquidity position on {chain} and let it rebalance; the managed position is what gets snapshotted.',
  'CeDeFi':
    'Deposit into the CeDeFi vault on {chain} and keep the receipt token; centralised custody plus on-chain receipt is the whole point of the product.',
  'Leveraged Farming':
    'Open a low-leverage farm (2x or less) on {chain} and monitor the health factor daily; leverage is how farms lose money, so keep it small.',
  'Anchor BTC':
    'Hold the anchored BTC token on {chain} in your own wallet; the anchor is a holding product, so the wallet holding it is the qualifier.',
  'Decentralized BTC':
    'Hold the decentralised BTC token on {chain} and use it once in a pool or vault; a token that never moves looks like a cold wallet.',
  'Dual-Token Stablecoin':
    'Hold the stablecoin on {chain} and use the yield token once; the pair is the product, so hold both sides in the same wallet.',
  'Farm':
    'Deposit into the farm on {chain} and claim rewards weekly; unclaimed rewards still count, but a wallet that never claims looks inactive.',
  'Insurance':
    'Buy a cover policy on {chain} for a position you actually hold; insurance launches reward real policyholders, not spectators.',
  'Payments':
    'Pay for something real through the protocol on {chain} once a week; payment volume is the usage a launch would count.',
  'Governance Incentives':
    'Lock the governance incentive token on {chain} for the longest lock you can afford; locks are the signal this category is built on.',
  'Stablecoin Wrapper':
    'Wrap the stablecoin on {chain} and hold the wrapped token; the wrapper is the product, so the wrapped balance is the position.',
  'Collateral Markets':
    'Post collateral on {chain} and keep the loan-to-value under 50%; a collateral market rewards the wallet that keeps the position healthy.',
  'Uncollateralized Lending':
    'Take a small uncollateralised loan on {chain} and repay it on time; repayment history is the whole credit signal here.',
  'Interest Rate Derivatives':
    'Open a small fixed-rate position on {chain} and hold it to maturity; rate products reward wallets that hold, not traders that flip.',
  'Crypto Card Issuer':
    'Spend with the card on {chain} at least once a week; card spend is the usage this category counts.',
  'Prediction Market':
    'Place a small bet on {chain} on a market you have read; prediction markets reward wallets that actually take positions.',
  'Indexes':
    'Hold the index token on {chain} in your own wallet; the index is a holding product, so the holding is the qualifier.',
};

function actionFor(p: Protocol): string {
  const template =
    CATEGORY_ACTION[p.category ?? ''] ??
    'Use the protocol main product on {chain} once a week and keep the position open; a live position is the usual qualifier for a launch allocation.';
  return template.replace('{chain}', mainChain(p));
}

function capitalTier(tvl: number): string {
  if (tvl >= 1e9) return '$250';
  if (tvl >= 250e6) return '$150';
  if (tvl >= 100e6) return '$100';
  return '$50';
}

function holdDays(age: number | null): number {
  if (age === null) return 45;
  if (age >= 730) return 60;
  if (age >= 365) return 45;
  return 30;
}

/** Six steps, each with a cost and a time. Cost is the gas for the step,
 *  capital is the position size; the two are kept separate on purpose. */
export function farmPlanFor(p: Protocol, m: ModelBreakdown): string[] {
  const capital = capitalTier(p.tvl_usd);
  const hold = holdDays(m.age_days);
  const growthNote =
    (p.change_7d ?? 0) > 10
      ? `TVL is up ${(p.change_7d ?? 0).toFixed(1)}% in 7 days, so the protocol is adding users fast; keep the position through the next weekly snapshot so the growth is counted. Cost: none. Time: 10 minutes.`
      : (p.change_7d ?? 0) < -10
        ? `TVL is down ${Math.abs(p.change_7d ?? 0).toFixed(1)}% in 7 days, so keep the position small and re-check the protocol own announcements before adding more. Cost: none. Time: 10 minutes.`
        : `Check the protocol points page weekly and note your position size; a points page that never changes is the first sign a launch is not coming. Cost: none. Time: 10 minutes.`;
  return [
    `Create a fresh wallet for this farm and write the seed phrase on paper, never in a screenshot or a cloud note; a farmed wallet that gets drained loses everything. Cost: under $3 in gas. Time: 5 minutes.`,
    `${actionFor(p)} Put in ${capital} of capital to start. Cost: under $3 in gas. Time: 15 minutes.`,
    `Repeat the same action once a week from the same wallet, same chain (${mainChain(p)}), same position; airdrops snapshot consistent wallets, not one-off deposits. Cost: under $3 in gas per week. Time: 10 minutes a week.`,
    `${growthNote}`,
    `Hold the position for at least ${hold} days without moving it to another wallet or protocol; moving resets most snapshot clocks. Cost: none. Time: ${hold} days.`,
    `When a claim opens, verify the claim link on the protocol own site or its official social account, never from a direct message; fake claim sites are the most common way farmers lose funds. Cost: gas for the claim, usually under $5. Time: 10 minutes.`,
  ];
}

function farmSummary(p: Protocol, m: ModelBreakdown): string {
  const capital = capitalTier(p.tvl_usd);
  const hold = holdDays(m.age_days);
  return `6 steps · ${capital} capital · under $15 gas · ~50 min active time · ${hold}-day hold`;
}

function preTokenRow(p: Protocol, asOf: string): BoardRow {
  const m = modelOf(p, asOf);
  return {
    rank: 0,
    slug: p.slug,
    name: p.name,
    category: p.category,
    chains: p.chains,
    tvl_usd: p.tvl_usd,
    change_7d: p.change_7d,
    mcap_usd: p.mcap_usd,
    listed_at: p.listed_at,
    gecko_id: p.gecko_id,
    symbol: p.symbol,
    token_status: 'pre-token',
    age_days: ageDays(p, asOf),
    implied_value_usd: m.implied_value_usd,
    model: m,
    farm_steps: farmPlanFor(p, m),
    farm_summary: farmSummary(p, m),
  };
}

function liveRow(p: Protocol, asOf: string): BoardRow {
  return {
    rank: 0,
    slug: p.slug,
    name: p.name,
    category: p.category,
    chains: p.chains,
    tvl_usd: p.tvl_usd,
    change_7d: p.change_7d,
    mcap_usd: p.mcap_usd,
    listed_at: p.listed_at,
    gecko_id: p.gecko_id,
    symbol: p.symbol,
    token_status: 'live',
    age_days: ageDays(p, asOf),
    implied_value_usd: 0,
    model: null,
    farm_steps: [],
    farm_summary: '',
  };
}

/** Live-token mcap/TVL in this snapshot, for the dashboard's comparable
 *  range: the 25th percentile, the median and the 75th percentile over
 *  every live-token protocol that records a market cap, plus the count.
 *  The spread is wide and the median is not stable across halves — that is
 *  why radar-2 does not fit its multiple from this. */
export function comparableStats(snapshot: Snapshot): { n: number; p25: number; median: number; p75: number } {
  const ratios = snapshot.protocols
    .filter((p) => isLiveToken(p) && p.mcap_usd !== null && p.tvl_usd > 0)
    .map((p) => (p.mcap_usd as number) / p.tvl_usd)
    .sort((a, b) => a - b);
  const at = (q: number) => ratios[Math.min(ratios.length - 1, Math.floor(ratios.length * q))] ?? 0;
  return { n: ratios.length, p25: at(0.25), median: at(0.5), p75: at(0.75) };
}

/** The whole board: every watchlist protocol plus every rankable pre-token
 *  protocol below the floor, ranked by implied value (ties by slug).
 *  Live-token rows are the top 24 by market cap, shown separately. */
export function boardFor(snapshot: Snapshot): { board: BoardRow[]; live: BoardRow[] } {
  const bySlug = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const chosen = new Map<string, Protocol>();
  for (const slug of snapshot.watchlist) {
    const p = bySlug.get(slug);
    if (p) chosen.set(slug, p);
  }
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd) {
      chosen.set(p.slug, p);
    }
  }
  const board = [...chosen.values()]
    .map((p) => preTokenRow(p, snapshot.as_of))
    .sort((a, b) => b.implied_value_usd - a.implied_value_usd || a.slug.localeCompare(b.slug));
  board.forEach((row, i) => {
    row.rank = i + 1;
  });
  const live = snapshot.protocols
    .filter((p) => isLiveToken(p) && p.mcap_usd !== null)
    .sort((a, b) => (b.mcap_usd as number) - (a.mcap_usd as number))
    .slice(0, 24)
    .map((p) => liveRow(p, snapshot.as_of));
  live.forEach((row, i) => {
    row.rank = i + 1;
  });
  return { board, live };
}
