# Talaan guided tour and language kit (Next.js)

"Meet Tala", Talaan's guided tour:
captions always on, optional voice from the device, nothing downloaded or sent. Every word lives in
`messages/` (English, Tagalog, Simplified Chinese), and a checker catches translation mistakes you can't read.

Tested with Next.js 15.5 (App Router), React 19, next-intl 4: `npm run build` prerenders /en/tour, /tl/tour, /zh/tour.

## Files
- `messages/en.json`, `tl.json`, `zh-Hans.json` — every word on screen; English is the source.
- `lib/i18n/glossary.json` — locked terms (SSS, BIR, PhilHealth, form numbers, Xero) that are never translated.
- `scripts/check-i18n.ts` — automatic translation checks; fails CI on errors.
- `scripts/back-translate.ts` — CSV for a native reviewer: each translation turned back into English with a verdict.
- `i18n/`, `middleware.ts`, `next.config.mjs` — next-intl setup, language in the URL.
- `app/[locale]/tour/page.tsx`, `components/tour/` — the tour (player, 11 scenes, Tala, scoped CSS).
- `standalone/` — the single-file published version, rebuilt from the same message files (`python3 scripts/build-tour-html.py`).

## Run
    npm install
    npm run check:i18n
    npm run dev        # http://localhost:3000/en/tour

## Add to Talaan's own Next.js app

Use this in Talaan's own repository and Vercel project, with Talaan's own environment variables.
Do not add it to another product's app.

1. `npm i next-intl`; copy `i18n/`, `messages/`, `lib/i18n/`, `components/tour/`, `scripts/`.
2. Wrap `next.config.mjs` with `createNextIntlPlugin('./i18n/request.ts')`.
3. Move pages under `app/[locale]/`; put `<html>`/`<body>` in `app/[locale]/layout.tsx`.
4. With Clerk: `export default clerkMiddleware((auth, req) => createMiddleware(routing)(req));`
5. Run `npm run check:i18n` in CI before `next build`.

## Checking Chinese and Tagalog you can't read
1. Automatic checks: missing keys, ICU syntax, placeholders, locked terms, Traditional vs Simplified, untranslated text, length.
2. Back-translation by a different model, flagging meaning changes.
3. Native reviewer (ideally a Chinese-Filipino bookkeeper) signs off each release using screenshots, starting with flagged rows. Tax and compliance wording never ships on machine checks alone.
4. "Report a translation" button for pilot firms.

## Server routes (Stripe and Xero)

| File | Address | What it does |
| --- | --- | --- |
| `app/api/stripe/webhook/route.ts` | `/api/stripe/webhook` | Checks Stripe's signature, handles each event once, saves the firm's plan status |
| `app/api/xero/connect/route.ts` | `/api/xero/connect?org=<firm ID>` | Sends the user to Xero sign-in with a one-time state cookie |
| `app/api/xero/callback/route.ts` | `/api/xero/callback` | Checks the state, swaps the code for tokens, saves them encrypted |
| `lib/env.ts` | none | Refuses to run unless `APP_ID=talaan` and `VECTOR_NAMESPACE=talaan-ph-payroll` |
| `lib/store.ts` | none | Talaan's own Upstash Redis; every key starts with `talaan:` |
| `lib/crypto.ts` | none | Encrypts Xero tokens with `TALAAN_TOKEN_KEY` (AES-256-GCM) |
| `lib/xero.ts` | none | Token exchange and refresh, tenant list, and posting payroll as a draft manual journal |

Setup: copy `.env.example` to `.env.local`, fill in Talaan's own values, and add the same values to the
`talaan` project in Vercel. Xero apps created after 2 March 2026 must use granular scopes, so Talaan asks for
`accounting.manualjournals` and `accounting.settings.read`, not the retired `accounting.transactions`.

Before going live: replace `?org=` in the Xero connect route with the signed-in firm from Clerk, and pass
the same firm ID as `client_reference_id` when creating Stripe Checkout sessions.

## Source watch (automatic checks of official sources)

`app/api/corpus/watch/route.ts` runs daily at 06:00 Manila time through Vercel Cron (`vercel.json`). It fetches each
source in `lib/watch-sources.ts` when due, compares the visible text with the last check (SHA-256), and adds any
change to the review queue (`GET /api/corpus/watch?view=queue`). It never edits the corpus: a person reviews each
change in Admin → Source watch and updates the entry. Set `CRON_SECRET` in Vercel. Test: `npx tsx scripts/test-watch.mts`.
Agency pages are checked with one request per source per schedule, a clear user agent and a 15-second timeout.

## Email notifications

`lib/email.ts` and `POST /api/notify` send Talaan's emails through Resend with Talaan's own `RESEND_API_KEY` and a
verified sending domain (`EMAIL_FROM`). The route is server-to-server only (`NOTIFY_SECRET`). A privacy guard
refuses any email containing government ID or bank account numbers: emails carry totals and a prompt to open
Talaan, never payslip details. Test: `npx tsx scripts/test-email.mts`.
