import assert from 'node:assert';
import { sampleState, refreshRun, loanBalance, leaveBalance, linesFor, filingsFor, migrate, hasModule, thirteenthDue, type State } from './model';
const s: State = sampleState(new Date());
const draft = s.runs.find(r => r.clientId === 'lim' && r.status === 'draft')!;
// templates, loans and leave are filled in when a run starts
assert.equal(draft.hours['lim-1'].deMinimis, 1000, 'rice subsidy from the pay template');
assert.equal(draft.hours['lim-2'].sssLoan, 916.5, 'SSS loan deduction');
assert.equal(draft.hours['lim-6'].absentDays, 1, 'approved leave without pay becomes an absent day');
assert.equal(draft.hours['lim-6'].otherDeduction, 1000, 'cash advance');
assert.equal(draft.hours['lim-5'].otherDeduction, 450, 'HMO share from the template');
// refreshing twice does not double anything
const again = { ...draft, ...refreshRun(s, draft) }; const twice = refreshRun(s, again);
assert.deepEqual(twice.hours['lim-6'], again.hours['lim-6']); assert.equal(twice.hours['lim-2'].sssLoan, 916.5); assert.equal(twice.hours['lim-5'].otherDeduction, 450);
// manual hours survive a refresh
const typed = { ...again, hours: { ...again.hours, 'lim-6': { ...again.hours['lim-6'], absentDays: 2, otherDeduction: 1200 } } };
const r3 = refreshRun(s, typed); assert.equal(r3.hours['lim-6'].absentDays, 2); assert.equal(r3.hours['lim-6'].otherDeduction, 1200);
// approving reduces the loan balance
const ln1 = s.loans.find(l => l.id === 'ln1')!; assert.equal(loanBalance(s, ln1), 20000);
const approved: State = { ...s, runs: s.runs.map(r => r.id === draft.id ? { ...r, status: 'approved', lines: linesFor(s, r) } : r) };
assert.equal(loanBalance(approved, ln1), 20000 - 916.5);
// leave balances count approved days only
const vl = leaveBalance(s, 'lim-3', 'vl', new Date().getFullYear()); assert.equal(vl.left, 10); assert.equal(vl.pending, 2);
// a final pay run takes the leaver out of the regular run for that cutoff
const fin = { ...draft, id: 'fin', kind: 'final' as const, empIds: ['lim-1'], hours: { 'lim-1': draft.hours['lim-1'] } };
const withFinal: State = { ...s, runs: [...s.runs, fin] };
assert.ok(!linesFor(withFinal, draft).some(l => l.empId === 'lim-1')); assert.ok(linesFor(s, draft).some(l => l.empId === 'lim-1'));
// a client on another payroll system: no payroll module, but its imported register produces filings
const dv = s.clients.find(c => c.id === 'davao')!; assert.ok(!hasModule(dv, 'payroll')); assert.ok(hasModule(dv, 'compliance'));
assert.equal(filingsFor(s).filter(f => f.clientId === 'davao').length, 4);
// 13th month is basic pay earned this year ÷ 12
const e = s.employees.find(x => x.id === 'lim-1')!; const t13 = thirteenthDue(s, e, String(new Date().getFullYear())); assert.ok(Math.abs(t13.due - t13.basicEarned / 12) < 0.01);
// data saved by the previous version loads without losing anything
const old = { ...sampleState(new Date()), v: 8 } as unknown as State; delete (old as Partial<State>).loans; delete (old as Partial<State>).hq;
const m = migrate(old); assert.equal(m.v, 10); assert.ok(Array.isArray(m.loans) && m.hq.firms.length > 0); assert.equal(m.clients.length, old.clients.length);
console.log('model tests passed');
