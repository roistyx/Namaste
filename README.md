# Namaste

A personal investment dashboard with a built-in market robot that watches your portfolio for unusual activity.

## Features

- **Positions** — live portfolio view across Schwab, Fidelity, and Public with daily P/L, cost basis, and equity breakdown
- **Alerts** — volume spikes and price moves detected automatically, shown in a dismissible feed
- **Dashboard** — most-active stocks with sentiment analysis via Finnhub
- **Fidelity CSV upload** — drag-and-drop CSV export from Fidelity to sync positions

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite |
| Backend | Node.js + Express (HTTPS, local TLS) |
| Database | MongoDB |
| Market data | Yahoo Finance (`yahoo-finance2`) |
| Scheduling | `node-cron` |
| Notifications | Terminal (ANSI) + Discord webhook (optional) |

## Getting started

```bash
# Install dependencies
npm run install:all

# Start both server and client
npm run dev
```

Server runs on `https://127.0.0.1:3001`, client on `http://localhost:5173`.

## Environment variables

Copy `server/.env.example` to `server/.env` and fill in your values:

```env
MONGODB_URI=mongodb://localhost:27017
FINNHUB_API_KEY=...
PUBLIC_API_SECRET=...

# Volume alert (all optional — defaults shown)
=          # leave blank to disable Discord
VOL_SPIKE_RATIO=2.0           # projected daily volume must be 2× avg to alert
PRICE_MOVE_PCT=3.0            # price move % threshold
ALERT_COOLDOWN_HOURS=2        # minimum hours between alerts for same ticker+type
POLL_CRON=*/10 * * * *        # how often to poll during market hours
OHLCV_CRON=15 16 * * 1-5     # end-of-day OHLCV fetch (4:15 PM Mon–Fri)
OUTCOME_CRON=0 * * * *        # hourly outcome tracking
TRAINER_CRON=0 2 * * 1-5     # nightly model training (stub)
```

## Volume alert robot

The robot runs inside the main server process — no separate process needed.

**How it works:**

1. **Poll job** (`POLL_CRON`) — fetches real-time quotes for all tickers in `server/volume-alert/config/tickers.json` during market hours
2. **Alert detection** — compares projected daily volume (`current volume ÷ time elapsed`) against the 10-day average. Fires an alert if the ratio exceeds `VOL_SPIKE_RATIO` or if price moves more than `PRICE_MOVE_PCT`
3. **Cooldown** — suppresses repeat alerts for the same ticker+type within `ALERT_COOLDOWN_HOURS`
4. **Notifier** — prints colour-coded alerts to the terminal; posts to Discord if `DISCORD_WEBHOOK_URL` is set
5. **OHLCV job** — stores daily candles after market close
6. **Outcome job** — tracks price 1h / 1d / 1w after each alert to measure signal quality
7. **Trainer job** — stub for future Prophet ML model that learns which signals matter

**Add/remove tickers:**

Edit `server/volume-alert/config/tickers.json`:

```json
["AAPL", "MSFT", "NVDA", "BRK.B"]
```

**Enable Discord notifications:**

Set `DISCORD_WEBHOOK_URL` in `server/.env` to your Discord channel webhook URL. Until then, all notifications appear only in the terminal.

## Project structure

```
Namaste/
├── client/              # React + Vite frontend
│   └── src/
│       ├── api/         # fetch helpers (schwab, fidelity, alerts, …)
│       └── components/  # PositionsPage, AlertsPage, Dashboard, …
├── server/              # Express HTTPS server (single process)
│   ├── routes/          # stocks, positions, schwab, fidelity, accounts
│   ├── volume-alert/    # market robot (routes, jobs, services, DAOs)
│   ├── db.js            # shared MongoDB connection
│   └── index.js         # entry point
└── package.json         # root scripts (dev, install:all)
```
