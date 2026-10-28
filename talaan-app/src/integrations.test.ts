/** Integration log, human-in-the-loop file rules, failure alerts and Xero file format. Run: npx tsx src/integrations.test.ts */
import assert from 'node:assert';
import { createHash } from 'node:crypto';
import { sha256, appendEvent, verifyChain, board, outcome, releaseState, canAuthorise, integrationAlerts, failureSummary, eventsCsv, type IntegrationEvent, type NewEvent, type Obligation } from './integrations';
import { applyAlerts, alertsDue } from './alerts';
import { sampleState, migrate, obligationsFor, filingsFor, fmtCsvDate, type State } from './model';
import { xeroJournalCsv } from './files';

let n = 0; const ok = (c: unknown, m: string) => { assert.ok(c, m); n++; };

// ---------- SHA-256 matches Node's ----------
for (const s of ['', 'abc', 'Talaan ₱ 中文 ñ', 'x'.repeat(1000), 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64)]) ok(sha256(s) === createHash('sha256').update(s).digest('hex'), `sha256 ${s.length}`);

// ---------- append-only chain ----------
const E = (p: Partial<NewEvent>): NewEvent => ({ system: 'sss', status: 'prepared', doc: 'R-3', subject: 'lim|2026-09|sss', clientId: 'lim', period: '2026-09', by: 'jun', ...p });
let log: IntegrationEvent[] = [];
log = appendEvent(log, E({ at: '2026-10-01T01:00:00.000Z', fileName: 'r3.csv', fileHash: sha256('v1') }));
log = appendEvent(log, E({ at: '2026-10-02T01:00:00.000Z', status: 'rejected', message: 'Invalid SS number row 4' }));
log = appendEvent(log, E({ at: '2026-10-02T05:00:00.000Z', fileHash: sha256('v2'), retryOf: log[1].id }));
log = appendEvent(log, E({ at: '2026-10-03T01:00:00.000Z', status: 'accepted', ref: 'PRN-1' }));
ok(verifyChain(log).ok && verifyChain(log).checked === 4, 'chain verifies');
ok(!verifyChain(log.map((e, i) => i === 1 ? { ...e, message: 'edited' } : e)).ok, 'edited entry detected');
ok(verifyChain(log.map((e, i) => i === 1 ? { ...e, message: 'edited' } : e)).brokenAt === 2, 'points at the edited entry');
ok(!verifyChain([log[0], log[2], log[3]]).ok, 'deleted entry detected');
ok(!verifyChain([log[0], log[2], log[1], log[3]]).ok, 'reordered entries detected');
ok(verifyChain(log.slice(2)).ok, 'an archived (trimmed) log still verifies from where it starts');
ok(log[2].prev === log[1].hash && log[0].prev === '0'.repeat(64), 'each entry links to the one before');
const row = board(log)[0];
ok(row.status === 'accepted' && row.attempts === 2 && row.failures === 1 && outcome(row.status) === 'pass', 'board: corrected rejection ends as a pass with 2 attempts, 1 failure');
const csv = eventsCsv(log, id => id === 'lim' ? 'Lim Trading' : '', verifyChain(log));
ok(csv.includes('chain verified') && csv.includes('Lim Trading') && csv.includes('Invalid SS number row 4') && csv.split('\r\n').length === 7, 'audit CSV has every entry and the chain result');

// ---------- human in the loop: outgoing files ----------
const R = (p: Partial<NewEvent>): NewEvent => ({ system: 'bank', doc: 'Payout file', subject: 'run1', clientId: 'lim', status: 'requested', by: 'jun', ...p });
const h1 = sha256('bank file v1'), h2 = sha256('bank file v2');
let g: IntegrationEvent[] = [];
ok(releaseState(g, 'bank', 'Payout file', 'run1', h1).state === 'none', 'nothing requested yet');
g = appendEvent(g, R({ fileHash: h1 })); const req = g[g.length - 1];
ok(releaseState(g, 'bank', 'Payout file', 'run1', h1).state === 'requested', 'requested');
g = appendEvent(g, R({ status: 'authorised', fileHash: h1, ofRequest: req.id, by: 'jun' }));
ok(releaseState(g, 'bank', 'Payout file', 'run1', h1).state === 'requested', 'the requester cannot authorise their own file');
g = appendEvent(g, R({ status: 'authorised', fileHash: h1, ofRequest: req.id, by: 'maricel' }));
ok(releaseState(g, 'bank', 'Payout file', 'run1', h1).state === 'authorised', 'a second person authorises');
ok(releaseState(g, 'bank', 'Payout file', 'run1', h2).state === 'changed', 'changed data voids the authorisation');
ok(releaseState(g, 'bank', 'Payout file', 'run2', h1).state === 'none', 'an authorisation covers only its own subject');
g = appendEvent(g, R({ status: 'rejected', message: 'Bank: invalid account', by: 'jun' }));
ok(releaseState(g, 'bank', 'Payout file', 'run1', h1).state === 'none', 'after a bank rejection the corrected file needs a new authorisation');
g = appendEvent(g, R({ fileHash: h2 })); const req2 = g[g.length - 1];
g = appendEvent(g, R({ status: 'declined', fileHash: h2, ofRequest: req2.id, message: 'Wrong pay date', by: 'teresita' }));
ok(releaseState(g, 'bank', 'Payout file', 'run1', h2).state === 'declined', 'declined');
ok(canAuthorise({ id: 'maricel', role: 'firmOwner' }, 'jun', 'lim'), 'firm owner can authorise');
ok(canAuthorise({ id: 'teresita', role: 'client', clientId: 'lim' }, 'jun', 'lim'), "client's approver can authorise their own company's file");
ok(!canAuthorise({ id: 'teresita', role: 'client', clientId: 'lim' }, 'jun', 'santos'), "client approver cannot authorise another company's file");
ok(!canAuthorise({ id: 'jun', role: 'preparer' }, 'maricel', 'lim'), 'preparers do not authorise releases');
ok(!canAuthorise({ id: 'maricel', role: 'firmOwner' }, 'maricel', 'lim'), 'nobody authorises their own request');
ok(!canAuthorise({ id: 'x', role: 'firmOwner', active: false }, 'jun', 'lim'), 'inactive users cannot authorise');

// ---------- alerts ----------
const people = [{ id: 'jun', role: 'preparer' }, { id: 'maricel', role: 'firmOwner' }, { id: 'teresita', role: 'client', clientId: 'lim' }];
const clients = [{ id: 'lim', assignee: 'jun' }];
const ob = (due: string, p: Partial<Obligation> = {}): Obligation => ({ key: `lim|2026-09|bir|${due}`, clientId: 'lim', system: 'bir', doc: '1601-C', period: '2026-09', due, done: false, ...p });
const at = (due: string, today: string) => integrationAlerts([ob(due)], [], clients, people, today)[0];
ok(at('2026-10-31', '2026-10-28')?.kind === 'due3', '3 days before');
ok(at('2026-10-28', '2026-10-28')?.kind === 'due', 'due today');
ok(integrationAlerts([ob('2026-10-29')], [], clients, people, '2026-10-28').length === 0, 'no alert 1 day before');
const late1 = at('2026-10-27', '2026-10-28'), late2 = at('2026-10-26', '2026-10-28');
ok(late1.kind === 'overdue' && !late1.escalated && late1.recipients.join() === 'jun,maricel', 'overdue goes to preparer and firm owner');
ok(late2.escalated && late2.recipients.includes('teresita') && late2.id !== late1.id, 'after 2 days it escalates to the client (a new alert)');
ok(integrationAlerts([ob('2026-10-20', { done: true })], [], clients, people, '2026-10-28').length === 0, 'done filings never alert');
const mm = integrationAlerts([ob('2026-11-10', { expected: 1000, paid: 990 })], [], clients, people, '2026-10-28');
ok(mm.length === 1 && mm[0].kind === 'mismatch' && /990.00/.test(mm[0].message ?? ''), 'amount mismatch');
ok(integrationAlerts([ob('2026-11-10', { expected: 1000, paid: 990, mismatchNote: 'penalty credited' })], [], clients, people, '2026-10-28').length === 0, 'explained mismatch does not alert');
const rj = appendEvent([], E({ at: '2026-10-27T03:00:00.000Z', status: 'rejected', message: 'PIN not found' }));
const ra = integrationAlerts([], rj, clients, people, '2026-10-28');
ok(ra.length === 1 && ra[0].kind === 'rejected' && ra[0].message === 'PIN not found' && !ra[0].escalated, 'rejection alerts the firm');
ok(integrationAlerts([], rj, clients, people, '2026-10-30')[0].escalated, 'unfixed rejection escalates');
ok(integrationAlerts([], appendEvent(rj, E({ status: 'uploaded' })), clients, people, '2026-10-30').length === 0, 'a corrected upload clears the rejection alert');
const sync = appendEvent([], { system: 'xero', status: 'failed', doc: 'Manual journal', subject: 'run1', clientId: 'lim', message: 'Account code 6100 not found', by: 'talaan', at: '2026-10-28T01:00:00.000Z' });
ok(integrationAlerts([], sync, clients, people, '2026-10-28')[0].kind === 'failed', 'sync failure alerts');
ok(integrationAlerts([], appendEvent([], { system: 'email', status: 'failed', doc: 'Alert email', subject: 'a|jun', clientId: 'lim', by: 'talaan' }), clients, people, '2026-10-28').length === 0, 'a failed alert email does not raise another alert');
const wait = appendEvent([], R({ at: '2026-10-26T01:00:00.000Z', fileHash: h1 }));
const wa = integrationAlerts([], wait, clients, people, '2026-10-28');
ok(wa.length === 1 && wa[0].kind === 'awaiting' && wa[0].escalated, 'a file waiting 2 days for authorisation is escalated');
const fs = failureSummary([...log, ...sync, ...rj], '2026-09-01');
ok(fs.total === 3 && fs.bySystem.sss === 2 && fs.repeats.some(r => r.system === 'sss' && r.n === 2), 'HQ failure summary finds repeats');

// ---------- alerts in the app: once per stage ----------
const s0 = sampleState();
ok(verifyChain(s0.integrationLog ?? []).ok && (s0.integrationLog ?? []).length >= 8, 'seeded log verifies');
const due = alertsDue(s0, '2026-10-28'); const tr = (k: string, v: Record<string, string | number> = {}) => k + JSON.stringify(v);
const s1 = applyAlerts(s0, due, tr, m => m);
ok(due.length > 0 && s1.notices.length > s0.notices.length && s1.outbox.some(m => m.kind === 'alert'), 'alerts become notices and emails');
ok(alertsDue(s1, '2026-10-28').length === 0 && applyAlerts(s1, due, tr, m => m) === s1, 'each alert is sent only once');
ok(s1.outbox.filter(m => m.kind === 'alert').every(m => !/\b\d{2}-\d{7}-\d\b/.test(m.body)), 'alert emails carry no ID numbers');

// ---------- received files: receipts need a second check ----------
const f = filingsFor(s0).find(x => !x.filed)!; const recv = (st: State, check?: { by: string; at: string }): State => ({ ...st, remits: { ...st.remits, [f.key]: { reference: 'REF-1234', amountPaid: f.expected, paidAt: '2026-10-20', receipt: { name: 'r.pdf', size: 10, by: 'jun' }, receiptCheck: check } } });
ok(!filingsFor(recv(s0)).find(x => x.key === f.key)!.filed, 'receipt without a second check: not filed');
ok(!!filingsFor(recv(s0, { by: 'maricel', at: '2026-10-21' })).find(x => x.key === f.key)!.filed, 'receipt checked by a second person: filed');
ok(obligationsFor(recv(s0)).find(o => o.key === f.key)!.done === false, 'unchecked receipt still counts as an open obligation');
const old = migrate({ ...recv(s0), integrationLog: undefined, alertsSent: undefined, v: 9 } as unknown as State);
ok(old.remits[f.key].receiptCheck?.by === 'before-v10' && Array.isArray(old.integrationLog), 'older receipts stay filed after the update, marked as recorded before the check existed');

// ---------- Xero file format ----------
ok(fmtCsvDate('2026-10-30') === '30/10/2026' && fmtCsvDate('2026-10-30', 'MM/DD/YYYY') === '10/30/2026' && fmtCsvDate('2026-10-30', 'YYYY-MM-DD') === '2026-10-30', 'CSV date formats');
const xc = xeroJournalCsv([{ narration: 'Payroll', date: '30/10/2026', taxRate: 'No VAT', lines: [['accSalaries', 100, 0], ['accNet', 0, 100]], codes: k => k === 'accSalaries' ? '6100' : '2200' }], k => k);
ok(xc.includes('30/10/2026') && xc.includes('No VAT') && xc.includes('-100.00') && !xc.includes('Tax Exempt'), 'Xero CSV uses the client date format and tax rate');

console.log(`integrations: ${n} checks passed`);
