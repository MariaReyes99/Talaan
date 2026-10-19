# Talaan

**Every payslip. Every deadline.**

Philippine payroll and compliance for bookkeeping firms. Phase 1 prototype.

Modules: Talaan Payroll, Compliance, Books, HR, AI and Analytics, plus Talaan HQ (staff-only: firms, billing, support, releases).

Live demo: https://talaan-ivory.vercel.app

## What is in this repo

| Folder | What it is |
|---|---|
| `talaan-app/` | The payroll app prototype (React + TypeScript, builds to one HTML file) |
| `talaan-kit/` | Guided tour and server routes (Next.js): Stripe, Xero, email, source watch |
| `brand/` | Talaan 3D logos (with and without slogan), the app icon, and `brand/modules/` lockups for each module (Payroll, Compliance, Books, HR, AI, Analytics, HQ) |

## Run locally

```
cd talaan-app
npm install
npm start        # http://localhost:3000
npm test         # payroll engine, model, encryption and voice tests
npm run check:ui # every screen's text exists in English, Tagalog and Chinese
npm run check:corpus   # Ask Tala corpus: translations, sources, retrieval
npm run build:tour     # the published guided tour as one HTML file
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
