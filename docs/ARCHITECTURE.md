# Talaan architecture: scale, speed, security and cost

Goal: state of the art but minimal; highest security that stays easy to use; fast at hundreds of thousands of
companies and millions of employees filing timesheets and leave.

## What "microseconds" means here

Talaan's own work per request runs in microseconds. The trip across the internet cannot: a phone in Manila reaching
any server takes 10–60 ms. So the design does two things: it keeps the server's work in microseconds, and it hides the
network from the user (the screen updates instantly, the save finishes in the background).

Measured in-process (`npm run bench`, Node 22):

| Operation | Median | 99th percentile | Per CPU core |
|---|---|---|---|
| Payroll line (one employee, one cutoff) | 0.3 µs | 3 µs | ~3.2 million/s |
| Leave or timesheet check + access rule | 0.7 µs | 1.3 µs | ~1.4 million/s |
| Invoice balance and status | 0.3 µs | 1 µs | ~3.4 million/s |
| Ask Tala guardrails | 11 µs | 50 µs | ~90,000/s |
| Ask Tala retrieval (65 entries, 3 languages) | 127 µs | 390 µs | ~7,900/s |

At one million employees on semi-monthly payroll, a full payroll for everyone is 1,000,000 × 0.3 µs ≈ 0.3 seconds of
CPU. Timesheet and leave validation at the busiest hour (say 1 million entries in an hour, about 280 a second) uses
less than 0.1% of one core. The engine is not the bottleneck; the database and network are, and the plan below is for those.

## The plan (minimal set of services)

```
 Phone / browser (installable web app)
   │  instant UI: entries saved on the device first, synced in the background (offline-first)
   ▼
 Vercel (Next.js) ── edge: static app, sign-in check, rate limits (Upstash Redis)
   │                 functions: API routes (same TypeScript engine, guardrails, retriever)
   ▼
 Postgres (Neon or Supabase, Singapore region) ── one database, row-level security by organisation
   │   timesheets/leave: append-only, partitioned by month; payroll runs: one row per run, lines as JSON
   ▼
 Queue (Upstash QStash) ── payroll for large clients, government files, emails, Xero, PayMongo reconciliation
 Object storage (Vercel Blob / S3, encrypted) ── proofs of payment, receipts, payslip PDFs (signed links only)
 Talaan HQ ── same app, staff-only area, reads across organisations through a separate read-only role
```

Six managed services, all pay-per-use and scale-to-zero: Vercel, Postgres, Redis, a queue, object storage, and PayMongo
for payments. No servers to patch, no Kubernetes. The NeMo Guardrails service (Python) is optional: only needed when
answers are phrased by a language model.

## How it stays fast as it grows

1. **Offline-first entry.** A timesheet or leave request is written to the device (IndexedDB) and shown at once
   (under 1 ms), then sent with an idempotency key. Retries never duplicate. The user never waits on the network.
2. **Append-only writes.** Timesheet and leave entries are inserted, never updated in place, into tables partitioned by
   month and indexed by `(org_id, employee_id, date)`. Inserts stay fast at billions of rows; old partitions are archived.
3. **Tenant isolation without many databases.** One Postgres with row-level security (`org_id = current_setting('talaan.org')`).
   Hot tenants can later move to their own database without code changes (the org id is in every key).
4. **Reads from cache.** Rates, wage orders, holidays, the corpus and each org's entitlements are small and read-heavy:
   kept in memory in each function and in Redis, refreshed when the source watch or Admin changes them.
5. **Heavy work on the queue.** Payroll for a 5,000-employee client, alphalists, bank files and Xero journals run as
   queued jobs in chunks of 500 employees, so the API answers in milliseconds and the job reports progress.
6. **Precomputed retrieval.** Ask Tala's index is built once per deploy; keyword rules are compiled at load (6× faster
   than before this update). When the corpus grows past a few thousand entries, add an inverted index (only score
   entries that share a word with the question) and keep the same API.
7. **Region.** Database and functions in Singapore (closest to the Philippines); static files from the edge.

## Security, made easy for users

| Control | How it works | What the user does |
|---|---|---|
| Sign-in | Passkeys (Face ID, fingerprint, Windows Hello) with email link as fallback; SSO for larger firms | Taps once; no passwords to remember |
| Approvals | Step-up passkey prompt when approving a pay run, confirming a payment or changing bank details | One extra tap at the moments that move money |
| Who can see what | Persona and module checks on every screen and API (`entitlements.ts`), record checks per client, row-level security in the database | Nothing: menus simply show what they can use |
| Personal data | TIN, SSS, PhilHealth, Pag-IBIG and bank numbers encrypted per field (AES-256-GCM); masked in history; removed from Ask Tala questions before search or logging | Nothing |
| Two-person rule | The preparer cannot approve; the person who sends a payment proof cannot confirm it; HQ confirms firms' proofs | Nothing extra |
| Payments | PayMongo hosted checkout (GCash, Maya, cards, QR Ph): Talaan never sees card numbers. Webhooks signature-checked, idempotent | Pays on a familiar page |
| AI safety | Guardrails (injection, data requests, tax evasion, other products), grounded answers with citations, human handoff; red-teamed with PyRIT on every release | Gets an answer or a person |
| Secrets | Talaan's own keys only, in Vercel as Sensitive; never shared with the Investment Research Library | – |
| Audit | Every change to pay, bank details, payments and approvals logged with who, when and why | Can see the history |
| Data Privacy Act | Data in-region, breach runbook (NPC within 72 hours), retention rules per record type | – |

## Cost at scale (rough, list prices, Oct 2026)

| Scale | Monthly infrastructure | Per active employee |
|---|---|---|
| Pilot: 50 firms, 5,000 employees | US$70–150 (Vercel Pro, Neon/Supabase starter, Upstash pay-as-you-go) | ~US$0.02 |
| 5,000 companies, 250,000 employees | US$600–1,500 | ~US$0.004 |
| 100,000+ companies, 2–5 million employees | US$6,000–15,000 (larger Postgres, read replicas, more function time) | under US$0.004 |

The cheapest module is ₱15 per employee per month (about US$0.26), so infrastructure stays a small fraction of revenue
at every stage. The biggest cost risk is language-model use in Ask Tala: keep answers extractive by default
(no model cost), turn on model phrasing per plan, and keep the daily limits in `/api/ask`.

## Next steps to go live (in order)

1. Move the app's state from the browser to Postgres with row-level security; keep the same TypeScript models.
2. Add passkey sign-in and issue the organisation token used by `/api/ask` (lib/auth.ts).
3. Switch "Pay now" from the prototype demo to PayMongo checkout (`/api/pay/checkout`) and read confirmed payments from the webhook.
4. Load-test the timesheet and leave API at 1,000 requests per second with k6 before onboarding the first large client.
5. Have the CPA adviser sign off rates, wage orders and the corpus; run the RAGAS LLM judge (`--llm`) monthly.
