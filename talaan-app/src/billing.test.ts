/** Receivables, module entitlements, persona access and agency due dates. Run: npx tsx src/billing.test.ts */
import assert from 'node:assert';
import { arStatus, balanceOf, aging, collections, statementRows, checkPayment, type ArDoc } from './receivables';
import { canOpen, missingDependencies, dependents, apiAllowed, moduleOf, MODULE_MANIFEST, type Page, type Persona } from './entitlements';
import { agencyDueDays, sampleState, migrate, MODULES, type ModuleKey } from './model';
import { yearEnd, computeLine, EMPTY_HOURS, type Employee } from './engine';

const today = '2026-10-28';
const inv = (no: string, total: number, issuedAt: string, dueAt: string, payments: ArDoc['payments'] = []): ArDoc => ({ no, customerId: 'lim', total, issuedAt, dueAt, payments });

// ---------- receivables ----------
const a = inv('A', 10000, '2026-09-01', '2026-09-16');
const b = inv('B', 5000, '2026-10-01', '2026-10-16', [{ id: 'p1', date: '2026-10-10', amount: 2000, method: 'gcash', reference: 'GC1', by: 'x' }]);
const c = inv('C', 3000, '2026-10-20', '2026-11-04', [{ id: 'p2', date: '2026-10-25', amount: 2940, cwt: 60, method: 'bank', reference: 'B1', by: 'x' }]);
const d = inv('D', 4000, '2026-10-25', '2026-11-09');
assert.equal(arStatus(a, today), 'overdue'); assert.equal(arStatus(b, today), 'overdue'); assert.equal(arStatus(c, today), 'paid'); assert.equal(arStatus(d, today), 'sent');
assert.equal(arStatus({ ...d, payments: [{ id: 'p', date: today, amount: 1000, method: 'cash', reference: '', by: 'x' }] }, today), 'partial');
assert.equal(balanceOf(b), 3000); assert.equal(balanceOf(c), 0, '2307 withholding settles the invoice');
assert.equal(arStatus({ ...a, draft: true }, today), 'draft');
assert.equal(balanceOf({ ...a, paidAt: '2026-09-10' }), 0, 'older "marked paid" invoices still count as paid');
const ag = aging([a, b, c, d], today);
assert.equal(ag.total.d31_60, 10000); assert.equal(ag.total.d1_30, 3000); assert.equal(ag.total.current, 4000); assert.equal(ag.outstanding, 17000);
const k = collections([a, b, c, d], today);
assert.equal(k.collected, 5000); assert.ok(k.dso > 0);
const st = statementRows([a, b, c, d], 'lim');
assert.equal(st.closing, 17000); assert.equal(st.rows.length, 6); assert.equal(st.rows[st.rows.length - 1].balance, 17000);
const st2 = statementRows([a, b, c, d], 'lim', '2026-10-01');
assert.equal(st2.opening, 10000, 'opening balance carries invoices before the period');
assert.equal(checkPayment(b, { amount: 5000, date: today, reference: 'x', method: 'bank' }, today), 'payTooMuch');
assert.equal(checkPayment(b, { amount: 1000, date: today, reference: '', method: 'bank' }, today), 'payRefNeeded');
assert.equal(checkPayment(b, { amount: 1000, date: today, reference: '', method: 'cash' }, today), null);
assert.equal(checkPayment(b, { amount: 1000, date: '2026-09-01', reference: 'x', method: 'bank' }, today), 'payBeforeInvoice');
assert.equal(checkPayment(b, { amount: 1000, date: '2026-12-01', reference: 'x', method: 'bank' }, today), 'payDateBad');

// ---------- module entitlements ----------
const on = (...m: ModuleKey[]) => new Set<ModuleKey>(m);
assert.ok(canOpen('preparer', 'payruns', on('payroll')).ok);
assert.deepEqual(canOpen('preparer', 'payruns', on('compliance')), { ok: false, reason: 'module', module: 'payroll' });
assert.ok(canOpen('preparer', 'files', on('compliance')).ok);
assert.equal(canOpen('client', 'ask', on('payroll')).ok, false, 'Ask Tala needs the AI module');
assert.ok(canOpen('firmOwner', 'billing', on()).ok); assert.equal(canOpen('client', 'billing', on(...MODULES)).ok, false);
assert.ok(canOpen('client', 'invoices', on()).ok, 'client owners see their invoices without any module');
assert.equal(canOpen('employee', 'payruns', on(...MODULES)).ok, false); assert.ok(canOpen('employee', 'payslips', on('payroll')).ok);
assert.equal(canOpen('employee', 'myleave', on('payroll')).ok, false, 'My leave comes with HR');
assert.equal(canOpen('preparer', 'admin', on(...MODULES)).ok, false); assert.equal(canOpen('firmOwner', 'hq', on(...MODULES)).ok, false);
assert.ok(canOpen('talaanAdmin', 'hq', on()).ok); assert.equal(canOpen('talaanAdmin', 'payruns', on(...MODULES)).ok, false);
assert.deepEqual(missingDependencies('books', ['hr']), ['payroll', 'compliance']); assert.deepEqual(missingDependencies('books', ['compliance']), []);
assert.deepEqual(dependents('payroll', ['payroll', 'books', 'analytics']), ['books', 'analytics']); assert.deepEqual(dependents('payroll', ['payroll', 'compliance', 'books']), []);
assert.equal(apiAllowed('/api/ask', ['payroll']), false); assert.ok(apiAllowed('/api/ask', ['ai'])); assert.ok(apiAllowed('/api/notify', []));
// every page belongs to at most one module
const pages = Object.values(MODULE_MANIFEST).flatMap(m => m.pages); assert.equal(new Set(pages).size, pages.length);
assert.equal(moduleOf('books' as Page), 'books');
// every persona can reach its landing page with every module on
const landing: Record<Persona, Page> = { firmOwner: 'home', preparer: 'home', client: 'home', employee: 'payslips', talaanAdmin: 'hq' };
for (const [p, page] of Object.entries(landing)) assert.ok(canOpen(p as Persona, page, on(...MODULES)).ok, `${p} → ${page}`);

// ---------- agency due dates ----------
assert.deepEqual(agencyDueDays({ philhealth: '12-345678901-3' }, 'Mabuhay Bakery'), { bir: 10, sss: 31, ph: 15, pi: 24 });
assert.deepEqual(agencyDueDays({ philhealth: '12-345678901-7' }, 'Abaca Co'), { bir: 10, sss: 31, ph: 20, pi: 14 });
assert.equal(agencyDueDays({}, 'Santos Hardware').pi, 31); assert.equal(agencyDueDays({}, 'Echo').pi, 19); assert.equal(agencyDueDays({}, '7-Star').pi, 31);

// ---------- year-end breakdown for the 2316 and alphalist ----------
const e: Employee = { id: 'x', clientId: 'c', name: 'T', position: '', monthlyRate: 30000, workdays: 261, tin: '', sss: '', philhealth: '', pagibig: '', bankAccount: '', active: true };
const ls = [computeLine(e, { ...EMPTY_HOURS, deMinimis: 2000 }, 'monthly', 755), computeLine(e, { ...EMPTY_HOURS, bonus: 30000 }, 'monthly', 755, { offCycle: true })];
const y = yearEnd('x', ls);
assert.equal(y.benefitsExempt, 30000); assert.equal(y.deMinimis, 2000); assert.ok(y.contributions > 0);
assert.ok(Math.abs(y.nonTaxable - (y.benefitsExempt + y.deMinimis + y.contributions + y.mweExempt)) < 0.02, 'non-taxable parts add up');

// ---------- seed data and migration ----------
const s = sampleState();
assert.ok(s.hq.firms.some(f => f.kind === 'employer'), 'HQ bills direct employers as well as firms');
assert.ok(s.hq.firms.flatMap(f => f.invoices).every(i => i.no.startsWith('TAL-')));
assert.ok(s.refs.regions.length >= 17 && s.refs.regions.every(r => r.wageOrder && r.effective), 'every region has a wage order and date');
const old = JSON.parse(JSON.stringify(s)); old.hq.firms[0].invoices[0].no = 'AUR-0001'; delete old.hq.firms[0].kind; old.leaveTypes = old.leaveTypes.filter((x: { id: string }) => x.id !== 'vawc');
old.refs.regions = [{ id: 'r7', name: 'Region VII', nonAgri: 540, other: 540, wageOrder: 'To confirm with RTWPB VII', effective: '', checked: '' }]; old.clients.find((x: { id: string }) => x.id === 'cebu').minWage = 540;
const m = migrate(old);
assert.equal(m.hq.firms[0].invoices[0].no, 'AUR-0001', 'issued invoice numbers are kept'); assert.equal(m.hq.firms[0].kind, 'firm'); assert.equal(m.v, 10); assert.ok(m.leaveTypes.some(x => x.id === 'vawc'));
assert.equal(m.refs.regions.find(r => r.id === 'r7')!.nonAgri, 582); assert.equal(m.clients.find(x => x.id === 'cebu')!.minWage, 542, 'stale floor moves up to the lowest new floor; the higher tier is the firm’s call');
const old2 = JSON.parse(JSON.stringify(s)); old2.refs.regions.push({ id: 'r_custom', name: 'Custom area', nonAgri: 600, other: 600, wageOrder: 'X-1', effective: '2026-01-01' });
assert.ok(migrate(old2).refs.regions.some(r => r.id === 'r_custom'), 'regions the firm added are kept');
console.log('billing, entitlement and compliance tests passed', { outstanding: ag.outstanding, dso: k.dso });
