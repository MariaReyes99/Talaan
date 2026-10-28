# Talaan controls: double approval, files and integrations

What Talaan does to stop payroll fraud, filing mistakes and silent integration failures. Each control is enforced
in the app and, where the data reaches the server, again on the server (`talaan-kit`). Tested in
`talaan-app/src/approvals.test.ts`, `src/integrations.test.ts` and `talaan-kit/routes-test.mjs`.

## 1. Double approval (maker-checker)

| Action | Prepared or asked by | Approval 1 | Approval 2 | Where |
|---|---|---|---|---|
| Payroll run | Preparer | Payroll / HR review | Finance approval | Pay run → Approve; Payroll → Approve selected |
| Payroll release (bank and e-wallet files) | Preparer asks | Payroll / HR review | Finance approval | Pay run → Files |
| Salary changes, pay templates (recurring allowances and deductions) | HR or preparer | Payroll / HR review | Finance approval | Employee → Edit; Payroll → Pay templates |
| Retroactive adjustments | Preparer (Retro adjustment run) | Payroll / HR review | Finance approval | Payroll → Off-cycle |
| Final pay | Preparer | HR verifies clearance | Finance approves final pay | Payroll → Final pay |
| Bonus and 13th month | Preparer | Payroll / HR review | Finance approval | Payroll → Off-cycle |
| BIR, SSS, PhilHealth, Pag-IBIG filing (monthly, new hires, year-end 2316 and alphalist) | Preparer generates | Payroll / HR review (validates totals) | Authorised signatory | Compliance |
| Employee bank, e-wallet or payout changes | HR, preparer, or employee list import | Payroll / HR review | Finance approval | Employee → Edit; Connections → Import |
| Imported payroll registers (other payroll systems) | Preparer uploads | Payroll / HR review | Finance approval | Compliance → Import payroll |
| Minimum wage, holiday and pay tables | Rates administrator | Rates administrator (another person) | – | Admin → Master data |
| User roles, approval duties, approver email addresses, strict segregation | Firm owner | Security approval | – | Admin → Users, Approvals |
| Restore from backup | Firm staff | Security approval | Finance approval | Connections → Data |

Single approval stays for everyday work: leave, profile updates (address, phone), attendance corrections,
department transfers, position titles, onboarding records and payslip viewing.

**Approval duties** are given per person (Admin → Users) and changing them is itself approved:
review, finance, authorised signatory, rates administrator, security. Defaults: firm owners hold all five;
preparers can be given review only; a client's approver holds finance and signatory for their own company only.

**Rules that always apply**
- The person who prepared, submitted or asked never approves; nobody approves twice.
- Whoever prepares a payroll, gives its final approval and releases its payout file are three different people.
  Strict mode (Admin → Approvals) also stops anyone who approved the payroll from releasing it (needs four people).
- An approval covers exactly what was approved: a pay run's approvals stop counting if its figures change; a file's
  authorisation covers its SHA-256 fingerprint; a change request is applied only if the record still looks as it did
  when requested (otherwise it is marked "not applied" and must be asked again).
- Revoking access (deactivating a user) is immediate; granting access waits for approval.
- If a step has nobody who can give it, the screen says so; if someone's approval would leave nobody for the next
  step, they are warned first.
- A restore from backup never changes users, approval duties or the audit history.

## 2. Files in and out (human in the loop)

- **Outgoing**: no file leaves Talaan without a second person authorising its exact content: payout files and
  government filings need two (above); payslips, journals, exports, reports, the continuity pack and backups need one.
  The authoriser can preview the file. Changed data voids the authorisation.
- **Incoming**: received files take effect only after review by someone other than the uploader: payroll registers
  and employee lists that change pay or bank details need two approvals; agency receipts need a second-person check
  before a filing counts as done. Employee imports change only the imported columns and skip any employee changed
  after the upload.

## 3. Integration log, failures and alerts

- Every exchange with BIR, SSS, PhilHealth, Pag-IBIG, banks, e-wallets, Xero, PayMongo, Stripe and email is one
  entry: who, when, what file (name and SHA-256), reference or error, and which earlier failure it fixes. Entries are
  append-only and chained by hash, so any change or deletion shows (Compliance → Integration log; audit CSV export).
- Government portals have no public API: Talaan prepares the file, a person uploads it, records the reference and
  receipt, and records a rejection with the portal's error. A corrected upload links to the rejection.
- Alerts go to the assigned preparer and firm owners: 3 days before a deadline, on the day, overdue, amount
  mismatch, rejection, failed sync, and files waiting for a second person. After 2 days unresolved they escalate to
  the client's approver. Each alert is sent once per stage, in the app and by email; the server sends them daily
  (`/api/cron/integrations`) even when nobody is signed in, and logs each email sent or failed.
- Talaan HQ sees failures by firm and system, including repeats.

## 4. Xero

- Each client is linked to one Xero organisation from the firm's connection.
- Before a journal is sent, its account codes are checked against that organisation's chart of accounts; the
  department split goes to the "Department" tracking category; lines carry no tax (`NoTax`); it arrives as a draft.
- A journal is sent only after a second person authorised that exact journal; duplicates are refused; every attempt
  (sent, accepted with Xero's journal ID, or failed with Xero's message) is logged and alerts the firm.
- CSV import: date format and tax rate name per client, matching the Xero organisation's settings.

## Limits to know

- This is a prototype: the app's data is in the browser. The server enforces the file, receipt, import and Xero
  rules from the signed sign-in token (person, role, company, approval duties). The pay-run-level separation
  (preparer, final approver, releaser) is enforced where pay runs live: in the app now, and in Postgres with
  row-level security when the data moves there (ARCHITECTURE.md, step 1).
- Alert emails need Talaan's email service keys (`RESEND_API_KEY`, `EMAIL_FROM`).
- Have the firm's auditor review the matrix and duties before going live.
