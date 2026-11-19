// Token Radar model v3: one sealed snapshot in, one ranked board out.
//
// The board ranks every genuine pre-token protocol in the snapshot: the 40
// watchlist slugs plus every other protocol that records no token and is not
// a wrapped, staked or bridged product of a token that already trades, a
// versioned pool, or an exchange. That is the launch-candidate rule the
// snapshot's own watchlist uses, applied to the whole file instead of only
// the $50M floor: 198 rows here.
//
// Two disclosed corrections sit on top of that rule, because the snapshot's
// record is not proof a protocol has no token (the rules say so, and the
// audit of 19 Nov 2026 caught both cases):
//
//   * traded-token factor (x0.05): two rows the snapshot records as
//     tokenless are verified, against market evidence cited at
//     TRADED_TOKEN_EVIDENCE below, to have tokens that already trade.
//     They stay on the board — the watchlist requires every one of its
//     40 slugs to appear — but at 5% of their modelled value, flagged
//     on the dashboard as known traded tokens.
//   * category plausibility factor (x0.1): five DefiLlama categories
//     whose protocols are infrastructure, wrappers or rails, not apps
//     waiting to issue a token — Stablecoin Wrapper, Dual-Token
//     Stablecoin, Payments, Chain and Cross Chain Bridge. The factor is
//     read from the snapshot's own category field, never from a name:
//     a wrapper wraps a token that already trades, a stablecoin IS the
//     token, and a chain, a payments rail or a bridge is pass-through
//     infrastructure, so a fresh launch token is not what that TVL is
//     waiting for. It demotes the watchlist's Lightning Network and Hive
//     Protocol, which are not token launches at all, without deleting
//     them.
//
// Implied value is otherwise derived only from the snapshot's own figures:
//
//   benchmark = median mcap/TVL of the live-token protocols in the same
//               category (at least 3 peers), else the global median;
//               clamped to [0.08, 0.80]
//   growth    = clamp(change_7d, -50, 100) per cent
//   growthMult    = 1 + (growth / 100) x 0.6
//   maturityMult  = 0.7 + min(age_days, 1095) / 1095 x 0.3   (age unknown: 0)
//   breadthMult   = 1 + min(chains - 1, 4) x 0.03
//   plausibility  = 0.1 for the five categories above, else 1
//   tradedToken   = 0.05 for a verified already-traded token, else 1
//   implied   = max(1, round(tvl_usd x benchmark x growthMult x maturityMult
//                     x breadthMult x plausibility x tradedToken))
//
// An unlisted age earns no maturity credit: listed_at null means the
// snapshot records no start date, so the model uses 0 days (the maturity
// floor) instead of inventing one. The benchmark is the model's claim
// about what the market pays for a dollar of TVL in this kind of
// protocol, read from the protocols in this same snapshot whose tokens
// already trade. Apart from the two evidence-cited traded-token slugs,
// no protocol name is ever special-cased: the same function scores
// every row.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
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

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  benchmark_floor: number;
  benchmark_cap: number;
  benchmark_min_peers: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  breadth_step: number;
  breadth_max_steps: number;
  /** The demotion for a row verified to have a token that already trades. */
  traded_token_factor: number;
  /** The demotion for a category that is infrastructure, a wrapper or a rail. */
  plausibility_factor: number;
  /** The categories the plausibility factor applies to, read from the snapshot's own category field. */
  plausibility_categories: string[];
}

export const MODEL: ModelConstants = {
  benchmark_floor: 0.08,
  benchmark_cap: 0.8,
  benchmark_min_peers: 3,
  growth_weight: 0.6,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 0.7,
  maturity_range: 0.3,
  maturity_days: 1095,
  unknown_age_days: 0,
  breadth_step: 0.03,
  breadth_max_steps: 4,
  traded_token_factor: 0.05,
  plausibility_factor: 0.1,
  plausibility_categories: ['Stablecoin Wrapper', 'Dual-Token Stablecoin', 'Payments', 'Chain', 'Cross Chain Bridge'],
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 40;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
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
  token_status: 'pre-token' | 'known-traded-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    benchmark_multiple: number;
    benchmark_peers: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    plausibility_factor: number;
    traded_token_factor: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  benchmark_multiple: number;
  benchmark_peers: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  plausibility_factor: number;
  traded_token_factor: number;
  /** True when market evidence (see TRADED_TOKEN_EVIDENCE) shows the token already trades. */
  traded_token: boolean;
  watchlist: boolean;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  mcap_tvl: number | null;
}

/** One category's benchmark: the median market-cap-per-TVL of its live peers. */
export interface Benchmark {
  category: string;
  multiple: number;
  peers: number;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  total_implied_usd: number;
  benchmarks: Benchmark[];
  global_benchmark: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a sorted list of numbers. */
function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Clamp a number into [lo, hi]. */
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * The benchmark table: for every category with live-token protocols, the
 * median market-cap-per-TVL of those protocols, clamped to the model's band.
 * Categories with too few live peers fall back to the global median.
 */
export function benchmarks(protocols: SnapshotProtocol[], model: ModelConstants): { byCategory: Map<string, Benchmark>; global: number } {
  const byCat = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of protocols) {
    if (p.mcap_usd !== null && p.tvl_usd > 0) {
      const ratio = p.mcap_usd / p.tvl_usd;
      if (Number.isFinite(ratio) && ratio > 0) {
        all.push(ratio);
        if (p.category !== null) {
          const list = byCat.get(p.category) ?? [];
          list.push(ratio);
          byCat.set(p.category, list);
        }
      }
    }
  }
  all.sort((a, b) => a - b);
  const global = clamp(median(all), model.benchmark_floor, model.benchmark_cap);
  const byCategory = new Map<string, Benchmark>();
  for (const [cat, ratios] of byCat) {
    ratios.sort((a, b) => a - b);
    const multiple = ratios.length >= model.benchmark_min_peers ? clamp(median(ratios), model.benchmark_floor, model.benchmark_cap) : global;
    byCategory.set(cat, { category: cat, multiple: round4(multiple), peers: ratios.length });
  }
  return { byCategory, global };
}

/** The benchmark multiple one protocol's category earns, and how many live peers set it. */
function benchmarkFor(p: SnapshotProtocol, table: { byCategory: Map<string, Benchmark>; global: number }): { multiple: number; peers: number } {
  const b = p.category !== null ? table.byCategory.get(p.category) : undefined;
  if (b !== undefined) return { multiple: b.multiple, peers: b.peers };
  return { multiple: round4(table.global), peers: 0 };
}

/**
 * The two rows the snapshot records as tokenless whose tokens are verified
 * to already trade, with the evidence that proves it. The snapshot's own
 * record is not proof a protocol has no token, and both of these were
 * caught against the market on 19 Nov 2026:
 *
 *   usdd — USDD is a stablecoin that trades: CoinGecko ~$1.43B market
 *     cap, rank #55 (checked 19 Nov 2026). There is no launch to wait
 *     for; the token is the product.
 *   bittensor-dtao — TAO listed on Coinbase on 20 Feb 2025, and dTAO
 *     went live on 13 Feb 2025 giving every subnet its own alpha token,
 *     traded in an AMM pool against TAO. Staking TAO into a subnet is a
 *     swap into an alpha that already exists.
 *
 * Each is demoted by traded_token_factor and flagged on the dashboard,
 * but stays on the board: both are watchlist slugs, and the gate requires
 * every watchlist slug to appear. Nothing else is listed here: a new
 * verified case is added with its evidence, never silently.
 */
export const TRADED_TOKEN_EVIDENCE: Record<string, string> = {
  'usdd': 'USDD trades: CoinGecko ~$1.43B market cap, rank #55 (19 Nov 2026)',
  'bittensor-dtao': 'TAO listed on Coinbase 20 Feb 2025; dTAO subnet alpha tokens trade vs TAO since 13 Feb 2025',
};

/**
 * Categories whose protocols are infrastructure, wrappers or rails, not
 * apps waiting to issue a token. Read from the snapshot's own category
 * field, never from a name: a Stablecoin Wrapper wraps a token that
 * already trades; a Dual-Token Stablecoin's value is the stablecoin
 * itself; a Payments rail, a Chain, or a Cross Chain Bridge is
 * pass-through infrastructure. Each row in them is demoted by
 * plausibility_factor and stays on the board.
 */
export const LOW_PLAUSIBILITY_CATEGORIES: ReadonlySet<string> = new Set(MODEL.plausibility_categories);

/** Whether a protocol is one of the verified already-traded rows. */
export function isTradedToken(p: SnapshotProtocol): boolean {
  return Object.prototype.hasOwnProperty.call(TRADED_TOKEN_EVIDENCE, p.slug);
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  table: { byCategory: Map<string, Benchmark>; global: number },
): { implied: number; benchmark: number; peers: number; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; plausibility: number; traded: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const { multiple, peers } = benchmarkFor(protocol, table);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = clamp(rawGrowth, model.growth_floor, model.growth_cap);
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const breadthMult = 1 + Math.min(Math.max(protocol.chains.length - 1, 0), model.breadth_max_steps) * model.breadth_step;
  const plausibility = protocol.category !== null && LOW_PLAUSIBILITY_CATEGORIES.has(protocol.category) ? model.plausibility_factor : 1;
  const traded = isTradedToken(protocol) ? model.traded_token_factor : 1;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * multiple * growthMult * maturityMult * breadthMult * plausibility * traded));
  return { implied, benchmark: multiple, peers, growthPct, growthMult, maturityMult, breadthMult, plausibility, traded, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** Categories that are a wrapped, staked or bridged product of a token that already trades. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
/** Exchange names a launch candidate never starts with. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;
/** A whole word that marks a wrapped or staked product. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is a genuine launch candidate: it records no token, and
 * it is not a wrapped, staked or bridged product of a token that already
 * trades, not a versioned pool, and not an exchange product. This is the
 * watchlist's own rule, applied to the whole snapshot instead of only the
 * $50M floor.
 */
export function isLaunchCandidate(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const table = benchmarks(snapshot.protocols, model);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names is ranked.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other genuine launch candidate, at any TVL.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isLaunchCandidate(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model, table);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: isTradedToken(s.p) ? 'known-traded-token' : 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      benchmark_multiple: s.benchmark,
      benchmark_peers: s.peers,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      breadth_multiplier: round4(s.breadthMult),
      plausibility_factor: s.plausibility,
      traded_token_factor: s.traded,
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's main action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('yield aggregator') || c.includes('yield')) return `Deposit $${capital} into ${name}'s main vault on ${chain} and keep the shares.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('payment')) return `Send one $${capital} payment through ${name} on ${chain} and keep the receipt.`;
  if (c.includes('chain')) return `Use ${name} once a week: send one transaction through its main app on ${chain}.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * The category's second action: a different qualifying move from the first.
 * The second-chain variants are emitted ONLY when the protocol actually
 * runs on more than one chain: telling a reader to act "on a second chain
 * it supports" for a single-chain protocol is an impossible step, and the
 * audit of 19 Nov 2026 found 28 of them. Single-chain protocols get the
 * same second move on their one chain instead.
 */
function secondActionFor(p: SnapshotProtocol, capital: number, chain: string, multiChain: boolean): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const small = Math.max(25, Math.round(capital / 2));
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Borrow $${small} against the deposit, hold it a week, then repay it in full.`;
  if (c.includes('dex')) {
    if (multiChain) return `Add $${small} of liquidity to a second ${name} pool on another chain it supports.`;
    return `Add $${small} of liquidity to a second ${name} pool on ${chain} with a different pair.`;
  }
  if (c.includes('yield aggregator') || c.includes('yield')) return `Move $${small} into a second ${name} vault with a different strategy.`;
  if (c.includes('curator') || c.includes('allocator')) return `Allocate $${small} to a second ${name} curator vault with a different risk profile.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis')) return `Open a second small hedge on the opposite side and close it the same day.`;
  if (c.includes('prediction')) return `Place a second $${small} position on a different ${name} market.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake a second $${small} through a different validator set on ${name}.`;
  if (c.includes('stable')) return `Mint $${small} of the stable asset a second time after the first settles.`;
  if (c.includes('rwa')) return `Mint a second $${small} tranche of the yield asset after the first settles.`;
  if (c.includes('insurance')) return `Buy $${small} of cover for a second risk on ${name}.`;
  if (c.includes('payment')) return `Send a second $${small} payment through ${name} on ${chain} and keep the receipt.`;
  if (c.includes('chain')) return `Vote once in ${name}'s governance or community poll, if one is open.`;
  if (multiChain) return `Repeat the deposit once more with $${small} on a second chain ${name} supports.`;
  return `Repeat the deposit once more with $${small} on ${chain} after the first settles.`;
}

/**
 * A protocol's farm plan: eight steps, each an action with a cost and a
 * time. The plan is derived from the protocol's own record (category,
 * chains, TVL, age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: actionFor(p, capital, chain),
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: secondActionFor(p, capital, chain, p.chains.length > 1),
      cost: `about $${Math.max(25, Math.round(capital / 2))} of capital and $2 of gas`,
      time: '10 minutes',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Check whether ${p.name} runs a points or rewards program; if it does, open its own points page once a week and check that your activity is counted.`,
      cost: 'no fee to check',
      time: '5 minutes a week',
    },
    {
      text: `Before you withdraw, claim only from the link the protocol itself publishes, and never pay anyone to claim for you.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log, and set a reminder for the protocol's next snapshot or season end.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view and comparables. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      mcap_tvl: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow, onWatchlist: boolean): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    benchmark_multiple: row.model.benchmark_multiple,
    benchmark_peers: row.model.benchmark_peers,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    plausibility_factor: row.model.plausibility_factor,
    traded_token_factor: row.model.traded_token_factor,
    traded_token: row.token_status === 'known-traded-token',
    watchlist: onWatchlist,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const table = benchmarks(snapshot.protocols, model);
  const benchList = [...table.byCategory.values()].sort((a, b) => (a.category < b.category ? -1 : a.category > b.category ? 1 : 0));
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    total_implied_usd: board.reduce((n, r) => n + r.implied_value_usd, 0),
    benchmarks: benchList,
    global_benchmark: round4(table.global),
    rows: board.map((r) => radarRow(r, snapshot.watchlist.includes(r.slug))),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
