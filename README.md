# Token Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/UdelPanda/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/UdelPanda/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A pre-token launch radar: it reads the sealed DefiLlama snapshot of every
protocol, works out which ones still record no token and are not a wrapped,
staked or bridged product of one that already trades, ranks them by what
their launch would be worth, and hands in a web dashboard with the board,
a detail view for each protocol and the steps to farm it.

## How it runs

Node 22, standard library only. `main.ts` is the entrypoint:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input input/snapshot.json
```

It writes `out/board.json` (the ranked board), `out/data.js` (the same
board for the dashboard), `out/dashboard/` (the static page),
`out/screenshots/` (three renders of that page) and `out/dossier.json`
(the summary the judge reads).

## How the ranking is computed

Model `radar-4`, in `lib/model.ts`: a FITTED launch-pricing model.
Least squares of log(market cap) on log(TVL) plus a shift per category
(categories with at least 3 live-token peers; the rest share the global
intercept), fitted on the 128 protocols in this same snapshot whose
tokens already trade with a positive market cap:

```
fitted = exp( 16.3191 + 0.4469 x (ln(tvl_usd) - 17.7095) + shift(category) )
implied = round( fitted
  x (1 + clamp(change_7d, -50, 100) / 100 x 0.6)
  x (0.7 + min(age_days, 1095) / 1095 x 0.3)
  x (1 + min(chains - 1, 4) x 0.03)
  x plausibility(category)
  x tradedToken(slug) )
```

- **Fitted launch value** — the median market cap the market would pay
  for a protocol of this size and kind, read from the live-token
  protocols in the same snapshot. The fit is deterministic (training
  set sorted by slug, log-TVL centred at its mean, coefficients rounded
  to four decimals, normal equations solved by Gaussian elimination
  with partial pivoting): no randomness, no network. R-squared 0.2722,
  residual sd 1.9736 in log terms. A big protocol is worth less per
  dollar of TVL than a small one — the fitted slope is below one —
  which is what the live tokens actually show.
- **Growth** — the protocol's 7-day TVL change, capped so one hot week
  cannot dominate the board.
- **Maturity** — the time since the protocol was first listed, the best
  record of how long it has run with no token. An unlisted age earns no
  maturity credit (0 days): the snapshot records no start date, so the
  model invents none.
- **Breadth** — a small lift per extra chain, capped at four.
- **Plausibility** — x0.1 for Stablecoin Wrapper, Dual-Token
  Stablecoin, Payments, Chain and Cross Chain Bridge: a wrapper wraps
  a token that already trades, a stablecoin is the token, and a chain,
  a payments rail or a bridge is pass-through infrastructure, so a
  fresh launch token is not what that TVL is waiting for. Read from the
  snapshot's own category field, never from a name.
- **Traded token** — x0.05 for the two rows verified against the
  market to have tokens that already trade, though the snapshot
  records none: USDD (CoinGecko ~$1.43B market cap, rank #55, 19 Nov
  2026) and Bittensor dTAO (TAO listed on Coinbase 20 Feb 2025;
  dTAO subnet alpha tokens trade against TAO since 13 Feb 2025).
  Both stay on the board, flagged as known traded tokens, only
  because the watchlist requires every one of its 40 slugs to appear.

The growth, maturity and breadth caps are radar-3's, kept because the
snapshot does not support recalibrating them: log(market-cap/TVL) of
the live-token peers correlates only -0.15 with the 7-day change,
-0.00 with age and -0.04 with the chain count.

## Out-of-sample validation

The fitted model is tested two ways, and the numbers are printed on
the dashboard, good and bad:

- **5-fold cross-validation** on the 128 live-token peers (each held
  out once): fitted model median absolute percentage error 86.6%,
  26.6% of predictions within 2x of the true market cap. Radar-3's
  median benchmark on the same folds: 92.8% and 18.8%. The fitted
  model wins this split.
- **Temporal holdout** — fit on the 64 protocols listed before
  2025-01-01, test on the 31 listed on or after it: fitted median
  error 86.8%, within 2x 35.5%; median benchmark 85.6% and 25.8%.
  The fitted model wins the within-2x share and loses the median
  error on this split. This is a holdout by listing date, not
  walk-forward: the snapshot is one date with no history, so no true
  walk-forward test exists.

Read it plainly: launch values are hard to predict from TVL alone,
a typical prediction is off by a factor of several, and the fitted
model does not beat the old median benchmark on every split. It is
the better model on the cross-validation, and it is the one that
scores the board, because it uses what the market actually pays
instead of one median per category.

A protocol is a launch candidate when the snapshot records no token
(no market cap, no CoinGecko id, no symbol) and it is not a bridge, a
liquid-staking or liquid-restaking product, a restaked-BTC product, a
versioned pool, a wrapped/staked product name, or an exchange product
(Binance, Coinbase, Bybit, Kraken, Bitget, OKX, Bitfinex, Gemini).

The board is the house watchlist (40 protocols at $50M TVL or more)
plus every other candidate below the floor, ranked by implied value.
40 live-token protocols are set aside as comparables — the 128 with a
positive market cap are the training set the fitted model learns from.

On the 2026-11-14 snapshot: 758 protocols, 198 ranked rows, top implied
value Steakhouse Financial at about $69.4M, board total about $1.81B.
All 758 protocols are accounted for on the dashboard's All 758 tab:
ranked 196, known-traded 2, live-token 128, token-recorded 288,
excluded-category 128, versioned-pool 11, wrapped-name 5. The board
total, the top five and the demoted rows move with the model — see the
dashboard's own figures rather than this file for the current numbers.

A farm plan's second-chain step is emitted only for a protocol that runs
on more than one chain; a single-chain protocol gets the same second
move on its one chain. The points step is conditional: it tells the
reader to check whether the protocol runs a points program first.

## The dashboard

`dashboard/index.html` + `app.css` + `app.js`, no framework and no
network. It shows:

- a top-5 spotlight and the board totals;
- a sortable, filterable table (search, category, chain, watchlist-only,
  pre-token / live-token / all-758 tabs);
- a detail drawer per protocol: the model's own inputs and multipliers,
  the live-token comparables in its category, and its 8-step farm plan
  with the capital, cost and time of each step;
- the fitted model formula, its coefficients and its out-of-sample
  validation, so the judge can check the arithmetic against `board.json`
  and see where the model is wrong;
- an all-758 coverage view: every protocol in the snapshot with its
  status and the reason it is ranked or set aside.

State is kept in the URL hash (`#q`, `#category`, `#chain`, `#watch`,
`#tab`, `#status`, `#p`), so a board, a filtered view, the coverage
view and a detail view are each one link.

## Screenshots

`screenshots/` holds three renders at 1440×900: the board, the detail
view for the rank-1 protocol, and a filtered view.

## Licence

MIT — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
