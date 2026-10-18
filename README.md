# Talaan

Philippine payroll and compliance for bookkeeping firms. Phase 1 prototype.

Live demo: https://talaan-ivory.vercel.app

## What is in this repo

| Folder | What it is |
|---|---|
| `talaan-app/` | The payroll app prototype (React + TypeScript, builds to one HTML file) |
| `talaan-kit/` | Guided tour and server routes (Next.js): Stripe, Xero, email, source watch |

## Run locally

```
cd talaan-app
npm install
npm start        # http://localhost:3000
```

```
cd talaan-kit
npm install
npm run dev      # http://localhost:3000/en/tour
```

## Status

This is a prototype with demo data. Nothing is sent to Xero, banks or government
agencies. Contribution and tax rates must be checked by a CPA before live use.

## Secrets

Keys go in `.env.local` (never committed) and in Vercel environment variables.
See `talaan-kit/.env.example` for the names. Talaan keeps its own keys and data,
separate from any other project.
