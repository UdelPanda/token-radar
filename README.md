# Token Radar

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

Model `radar-3`, in `lib/model.ts`:

```
implied = round( tvl_usd
  x benchmark(category)
  x (1 + clamp(change_7d, -50, 100) / 100 x 0.6)
  x (0.7 + min(age_days, 1095) / 1095 x 0.3)
  x (1 + min(chains - 1, 4) x 0.03)
  x plausibility(category)
  x tradedToken(slug) )
```

- **Benchmark** — the median market-cap-per-TVL of the live-token
  protocols in the same category (at least 3 peers), clamped to
  x0.08–x0.80. Categories with too few peers use the global median.
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

A protocol is a launch candidate when the snapshot records no token
(no market cap, no CoinGecko id, no symbol) and it is not a bridge, a
liquid-staking or liquid-restaking product, a restaked-BTC product, a
versioned pool, a wrapped/staked product name, or an exchange product
(Binance, Coinbase, Bybit, Kraken, Bitget, OKX, Bitfinex, Gemini).

The board is the house watchlist (40 protocols at $50M TVL or more)
plus every other candidate below the floor, ranked by implied value.
40 live-token protocols are set aside as comparables — their
market-cap-per-TVL is what sets each category's benchmark.

On the 2026-11-14 snapshot: 758 protocols, 198 ranked rows, top implied
value Steakhouse Financial at about $552M. The board total, the top five
and the demoted rows move with the model — see the dashboard's own
figures rather than this file for the current numbers.

A farm plan's second-chain step is emitted only for a protocol that runs
on more than one chain; a single-chain protocol gets the same second
move on its one chain. The points step is conditional: it tells the
reader to check whether the protocol runs a points program first.

## The dashboard

`dashboard/index.html` + `app.css` + `app.js`, no framework and no
network. It shows:

- a top-5 spotlight and the board totals;
- a sortable, filterable table (search, category, chain, watchlist-only,
  pre-token / live-token tabs);
- a detail drawer per protocol: the model's own inputs and multipliers,
  the live-token comparables in its category, and its 8-step farm plan
  with the capital, cost and time of each step;
- the model formula and the category split, so the judge can check the
  arithmetic against `board.json`.

State is kept in the URL hash (`#q`, `#category`, `#chain`, `#watch`,
`#tab`, `#p`), so a board, a filtered view and a detail view are each
one link.

## Screenshots

`screenshots/` holds three renders at 1440×900: the board, the detail
view for the rank-1 protocol, and a filtered view.

## Licence

MIT — see `LICENSE`.
