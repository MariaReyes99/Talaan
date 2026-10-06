# Talaan Phase 1 prototype

Needs Node.js 20 or newer (https://nodejs.org). Then, in this folder:

    npm install        # once, installs React, esbuild and TypeScript
    npm test           # payroll engine tests
    npm run build      # creates dist/index.html
    npm start          # builds and serves it at http://localhost:3000
    npm run check:corpus   # checks the FAQ/Ask Tala corpus (languages, sources, retrieval)
    npm run export:corpus  # writes RAG-ready Markdown to corpus/md

You can also just double-click dist/index.html after `npm run build`.
Data is saved in your browser only. Use "Reset demo data" in the footer to start over.

Files: src/engine.ts (payroll maths + checks), src/model.ts (clients, runs, deadlines, sample data),
src/files.ts (agency and bank CSVs), src/kb.ts (Ask Tala search), corpus/ (45 cited FAQs in EN/TL/ZH, see corpus/README.md), src/i18n.ts (EN/TL/ZH), src/App.tsx (screens), src/App.tsx Connections page (apps, import and export, team activity), src/tour/ (the guided tour, shown on first visit and from the "Guided tour" button; same message files as the published tour).

## Compliance files and controls (this version)

- `src/layouts.ts` — SSS R-3, ML-2, R-1A; PhilHealth RF-1, ER2; Pag-IBIG MCRF, STLRF, new members; BIR alphalist schedules;
  plus the layout registry (status: follows the published form / official upload spec needed / verified) and the
  sample comparison check.
- `src/bank.ts` — bank and e-wallet payout files built from each client's template (CSV, tab, pipe or fixed width).
- `src/pdf2316.ts` — employee 2316 summary as a PDF. `src/continuity.ts` — continuity pack ZIP.
- Remit and pay: file → upload → payment reference → amount → receipt, with shortfall and overpayment checks.
- Year-end: annual tax vs withheld, applied to the December pay run; opening balances for firms joining mid-year.
- Connections → Partner checks (funds segregation, BSP licence, continuity plan, data export, fallback) and Continuity.

No layout is marked verified yet. Verify each against the agency's own tool and a pilot upload before production.

## Batch pay runs and file protection (this version)

- Pay runs: filter by company, status and cutoff (choose one or more of each), tick several rows, then start, review,
  approve or download bank files together. Approval is still checked per company (no red checks, reasons given,
  approver is not the preparer and is allowed for that company), needs the number of pay runs typed to confirm,
  and skips anything not eligible. Bank files stay one per employer, bundled in a ZIP with a manifest.
- `src/secure.ts`: optional password protection for downloads (AES-256-GCM, PBKDF2-SHA256, 310,000 iterations),
  using the browser's Web Crypto. Protected files are `.talaan.json`; open them in Connections → Import and export.
  Portals and banks need the original file, so decrypt before uploading. `npm test` includes encryption tests.

## Admin, documents and help (this version)

- Admin (firm owner only): Users (add, edit, roles, deactivate; at least one firm owner always stays active),
  Clients (add, deactivate), Master data (banks, regions and minimum wages with "apply to clients", holidays,
  document types), Corpus (add and edit entries in three languages, review cycle, in-app corpus check), and
  Source watch (official sources, review queue, record a change).
- Add client from the Clients page or Admin. Supporting documents (src/docs.ts, stored in the browser's IndexedDB)
  can be attached to clients, employees, pay runs, remittances, bank templates and corpus entries.
- Help on every page (How this page works), ⓘ tips on key fields, and a Getting started checklist on Home.
- Automatic source checks run on the server in the Next.js kit (/api/corpus/watch, daily via Vercel Cron).

## Approvals, notifications, email and billing (this version)

- Pay runs: searchable multi-select dropdowns (company, status, cutoff) plus a search box over the whole list. Only "Not started" pay runs can be ticked; the batch action is Start pay runs.
- Approval workflow: the preparer submits; approvers (client owner and firm owner) get a notification (bell) and
  an email; they approve or return with a reason; the preparer is notified. Hours are locked while waiting.
  Batch approval only includes submitted pay runs. Home shows pay runs waiting for you.
- Client contacts and notification settings; emails for processed pay runs, recorded government payments and
  statements. In this prototype emails are queued in Connections → Email (open in your email app); the Next.js
  kit sends them for real through /api/notify.
- Billing: rate card (firm and per client), monthly count of processed work per client, statement of account PDF
  and CSV, email, mark paid. Issue the official invoice from your BIR-registered invoicing system.
- Fix: employees are only paid in cutoffs they were employed for (hire and separation dates).
