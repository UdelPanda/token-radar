# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/UdelPanda/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/UdelPanda/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A pre-token launch radar: it reads the sealed DefiLlama snapshot of every protocol, works out which ones still record no token and are not a wrapped, staked or bridged product of one that already trades, ranks them by what their launch would be worth, and hands in a web dashboard with the board, a detail view for each protocol and the steps to farm it.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input input/snapshot.json
```

Node 22, standard library only. `main.ts` is the entrypoint. It writes `out/board.json` (the ranked board), `out/data.js` (the same board for the dashboard), `out/dashboard/` (the static page), `out/screenshots/` (three renders of that page) and `out/dossier.json` (the summary the judge reads).

## How the ranking is computed

Model `radar-2`, in `lib/model.ts`: implied value = TVL x category benchmark (median market-cap-per-TVL of live-token peers, clamped x0.08–x0.80) x growth (7-day TVL change, capped) x maturity (age, up to 3 years) x breadth (extra chains, capped at four). On the 2026-11-14 snapshot: 758 protocols, 198 ranked rows, top implied value Steakhouse Financial at about $552M, board total about $4.14B.

## The dashboard

`dashboard/index.html` + `app.css` + `app.js`, no framework and no network. Top-5 spotlight and board totals, a sortable and filterable table (search, category, chain, watchlist-only, pre-token / live-token tabs), a detail drawer per protocol with the model's inputs, live-token comparables and its 8-step farm plan, and the model formula so the judge can check the arithmetic against `board.json`.

## Licence

MIT — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
