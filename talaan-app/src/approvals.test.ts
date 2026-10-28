/** Double approval: the ten controls, duties, segregation of duties and applying approved changes. Run: npx tsx src/approvals.test.ts */
import assert from 'node:assert';
import { POLICY, MATRIX, canApprove, eligible, unstaffed, addApproval, dutiesOf, type Person, type ChangeRequest } from './approvals';
import { applyChange, refsHash } from './changes';
import { appendEvent, releaseState, sha256, type IntegrationEvent } from './integrations';
import { sampleState, migrate, type State } from './model';

let n = 0; const ok = (c: unknown, m: string) => { assert.ok(c, m); n++; };
const P: Person[] = [{ id: 'jun', role: 'preparer' }, { id: 'maricel', role: 'firmOwner' }, { id: 'carmela', role: 'firmOwner' }, { id: 'teresita', role: 'client', clientId: 'lim' }, { id: 'rico', role: 'employee', clientId: 'lim' }, { id: 'ana', role: 'preparer', duties: ['review'] }];
const by = (id: string) => P.find(p => p.id === id)!;

// ---------- the matrix ----------
ok(MATRIX.length === 10, 'ten controls in the matrix');
ok(['payrun', 'release', 'salary', 'bank', 'filing'].every(k => POLICY[k as keyof typeof POLICY].length === 2), 'money, pay, bank and filing controls need two approvals');
ok(POLICY.rates.length === 1 && POLICY.roles.length === 1, 'tables and roles: maker plus one approver, as in the matrix');
ok(MATRIX.filter(m => ['retro', 'bonus', 'finalpay'].includes(m.key)).every(m => m.control === 'payrun'), 'retro, bonus and final pay runs follow pay run approval');

// ---------- duties ----------
ok(dutiesOf(by('maricel')).length === 5 && dutiesOf(by('jun')).length === 0 && dutiesOf(by('ana')).join() === 'review', 'default duties by role; preparers can hold review only');
ok(dutiesOf(by('teresita'), 'lim').join() === 'finance,signatory' && dutiesOf(by('teresita'), 'santos').length === 0, "client approver: finance and signatory for their own company only");
ok(dutiesOf({ id: 'x', role: 'preparer', duties: ['finance', 'security'] }).length === 0, 'a preparer cannot be given finance or security');
ok(dutiesOf({ ...by('maricel'), active: false }).length === 0, 'inactive users hold no duties');

// ---------- pay run: review then finance, two different people, never the preparer ----------
const ctx = { requesters: ['jun'], approvals: [] as ReturnType<typeof addApproval>['item']['approvals'] & object, clientId: 'lim' };
ok(!canApprove(by('jun'), 'payrun', ctx), 'preparer cannot approve');
ok(!canApprove(by('teresita'), 'payrun', ctx), 'client approver is not the payroll reviewer (step 1 is review)');
ok(canApprove(by('maricel'), 'payrun', ctx) && canApprove(by('ana'), 'payrun', ctx), 'step 1: a reviewer');
let run: { approvals?: { by: string; at: string; duty: 'review' | 'finance' | 'signatory' | 'config' | 'security' }[] } = {};
let r = addApproval(run, 'payrun', 'maricel'); run = r.item;
ok(!r.done && run.approvals![0].duty === 'review', 'one approval is not enough');
ok(!canApprove(by('maricel'), 'payrun', { ...ctx, approvals: run.approvals! }), 'nobody approves twice');
ok(!canApprove(by('ana'), 'payrun', { ...ctx, approvals: run.approvals! }), 'a reviewer cannot give the finance approval');
ok(canApprove(by('teresita'), 'payrun', { ...ctx, approvals: run.approvals! }) && canApprove(by('carmela'), 'payrun', { ...ctx, approvals: run.approvals! }), 'step 2: finance (client approver or another owner)');
r = addApproval(run, 'payrun', 'teresita'); ok(r.done && r.item.approvals!.map(a => a.duty).join() === 'review,finance', 'two approvals complete the run');
ok(!canApprove(by('carmela'), 'payrun', { ...ctx, approvals: r.item.approvals! }), 'no third approval');
ok(unstaffed([by('jun'), by('maricel')], 'payrun', ctx).join() === 'finance', 'a firm with one owner is told the finance step has nobody');
ok(eligible(P, 'payrun', { requesters: ['jun', 'maricel'], approvals: [], clientId: 'santos' }).map(p => p.id).join() === 'carmela,ana', 'the person who submitted it cannot approve either');

// ---------- release: preparer, final approver and releaser are three different people ----------
const release = { requesters: ['jun'], approvals: [], clientId: 'santos', exclude: ['jun'], excludeFinal: ['carmela'] };
const step2 = { ...release, approvals: [{ by: 'maricel', at: '', duty: 'review' as const }] };
ok(!canApprove(by('carmela'), 'release', step2), "the run's final approver cannot release its payout file");
ok(canApprove(by('carmela'), 'release', release), 'but may review the release');
const step2b = { ...release, approvals: [{ by: 'carmela', at: '', duty: 'review' as const }] };
ok(canApprove(by('maricel'), 'release', step2b), 'another finance person releases');
const strict = { ...release, excludeFinal: ['carmela', 'maricel'] };
ok(unstaffed([by('jun'), by('maricel'), by('carmela')], 'release', strict).length === 1, 'strict mode with only three people: release cannot be completed, and the screen says so');

// ---------- release in the integration log: two different authorisers for the same file ----------
const h = sha256('bank file'); const R = (p: Partial<IntegrationEvent>) => ({ system: 'bank' as const, doc: 'Payout file', subject: 'run1', clientId: 'santos', status: 'requested' as const, by: 'jun', fileHash: h, ...p });
let g = appendEvent([], R({})); const req = g[0];
g = appendEvent(g, R({ status: 'authorised', ofRequest: req.id, by: 'maricel', ref: 'review' }));
ok(releaseState(g, 'bank', 'Payout file', 'run1', h, 2).state === 'partly', 'one of two authorisations: not released');
ok(releaseState(g, 'bank', 'Payout file', 'run1', h, 1).state === 'authorised', 'one is enough for exports');
g = appendEvent(g, R({ status: 'authorised', ofRequest: req.id, by: 'maricel', ref: 'finance' }));
ok(releaseState(g, 'bank', 'Payout file', 'run1', h, 2).state === 'partly', 'the same person twice does not count as two');
g = appendEvent(g, R({ status: 'authorised', ofRequest: req.id, by: 'jun', ref: 'finance' }));
ok(releaseState(g, 'bank', 'Payout file', 'run1', h, 2).state === 'partly', 'the requester never counts');
g = appendEvent(g, R({ status: 'authorised', ofRequest: req.id, by: 'carmela', ref: 'finance' }));
const rs = releaseState(g, 'bank', 'Payout file', 'run1', h, 2);
ok(rs.state === 'authorised' && rs.approvals.map(e => e.by).join() === 'maricel,carmela', 'two different people: released');
ok(releaseState(g, 'bank', 'Payout file', 'run1', sha256('edited file'), 2).state === 'changed', 'an edited file loses both authorisations');

// ---------- change requests: apply only what was approved, only if nothing changed ----------
const s0 = sampleState(); const e = s0.employees.find(x => x.clientId === 'lim')!;
const chg = (control: ChangeRequest['control'], payload: unknown): ChangeRequest => ({ id: 'c1', control, subject: 's', title: 't', lines: [], payload, hash: '', requestedBy: 'jun', requestedAt: '', approvals: [{ by: 'maricel', at: '', duty: 'review' }, { by: 'teresita', at: '', duty: 'finance' }], status: 'pending' });
const sal = applyChange(s0, chg('salary', { empId: e.id, set: { monthlyRate: e.monthlyRate + 1000 }, before: { monthlyRate: e.monthlyRate } }))!;
ok(sal.employees.find(x => x.id === e.id)!.monthlyRate === e.monthlyRate + 1000 && /approved by Maricel Santos \+ Teresita Lim/.test(sal.empHistory[e.id][0].reason ?? ''), 'approved salary change applied with approvers in the history');
const moved: State = { ...s0, employees: s0.employees.map(x => x.id === e.id ? { ...x, monthlyRate: 1 } : x) };
ok(applyChange(moved, chg('salary', { empId: e.id, set: { monthlyRate: 99999 }, before: { monthlyRate: e.monthlyRate } })) === null, 'stale: the rate changed after the request, nothing applied');
const bank = applyChange(s0, chg('bank', { empId: e.id, set: { bankAccount: '009876543210' }, before: { bankAccount: e.bankAccount } }))!;
ok(bank.employees.find(x => x.id === e.id)!.bankAccount === '009876543210' && !JSON.stringify(bank.empHistory[e.id][0]).includes('009876543210'), 'bank change applied; history masks the number');
const regions = s0.refs.regions.map(x => x.id === 'ncr' ? { ...x, nonAgri: 800 } : x);
const rates = applyChange(s0, chg('rates', { regions, beforeHash: refsHash(s0) }))!;
ok(rates.refs.regions.find(x => x.id === 'ncr')!.nonAgri === 800, 'approved wage table applied');
ok(applyChange(rates, chg('rates', { regions, beforeHash: refsHash(s0) })) === null, 'a table approved against an older version is not applied');
const newUser = { id: 'u9', name: 'New Owner', role: 'firmOwner' as const, active: true };
ok(applyChange(s0, chg('roles', { user: newUser, before: null }))!.users.some(u => u.id === 'u9'), 'approved new user added');
const onlyOwnerGone = { ...s0, users: s0.users.filter(u => u.id !== 'carmela') };
ok(applyChange(onlyOwnerGone, chg('roles', { user: { ...onlyOwnerGone.users.find(u => u.id === 'maricel')!, role: 'preparer' }, before: onlyOwnerGone.users.find(u => u.id === 'maricel') })) === null, 'never leaves the firm without an owner');
ok(applyChange(s0, chg('roles', { controls: { strictRelease: true }, beforeControls: s0.controls }))!.controls?.strictRelease === true, 'strict segregation setting applied after approval');

// ---------- seed and migration ----------
ok(s0.users.some(u => u.id === 'carmela' && u.role === 'firmOwner') && (s0.changes ?? []).some(x => x.status === 'pending'), 'demo has a second approver and a pending change');
const old = migrate({ ...s0, users: s0.users.filter(u => u.id !== 'carmela'), changes: undefined, v: 9 } as unknown as State);
ok(old.users.some(u => u.id === 'carmela') && Array.isArray(old.changes), 'the demo firm gets its finance approver after the update');
const other = migrate({ ...s0, billing: { ...s0.billing, firmName: 'Another Firm' }, users: s0.users.filter(u => u.id !== 'carmela'), v: 9 } as unknown as State);
ok(!other.users.some(u => u.id === 'carmela'), 'real firms are not given a demo user');


// ---------- fixes from the independent review ----------
{
  const { validApprovals, linesHash } = await import('./model');
  const { restoreState } = await import('./changes');
  const { strands, unstaffed: uns } = await import('./approvals');
  const s = sampleState(); const run = s.runs.find(r => r.status === 'draft')!;
  const h = linesHash(s, run); const withOne = { ...run, approvals: [{ by: 'maricel', at: '', duty: 'review' as const, hash: h }] };
  ok(validApprovals(s, withOne).length === 1, 'approval counts while the figures are unchanged');
  const e = s.employees.find(x => x.clientId === run.clientId && x.active)!;
  const raised: State = { ...s, employees: s.employees.map(x => x.id === e.id ? { ...x, monthlyRate: x.monthlyRate + 5000 } : x) };
  ok(validApprovals(raised, withOne).length === 0, 'the first approval stops counting when the run figures change before the second');
  ok(canApprove(by('ana'), 'payrun', { requesters: ['jun'], approvals: validApprovals(raised, withOne), clientId: run.clientId }), 'the run needs its review step again');
  const evil: State = { ...s, users: [...s.users.map(u => u.id === 'jun' ? { ...u, role: 'firmOwner' as const } : u)], integrationLog: [], employees: s.employees.map(x => ({ ...x, bankAccount: '000000000001' })) };
  const restored = restoreState(s, evil);
  ok(restored.users.find(u => u.id === 'jun')!.role === 'preparer' && restored.integrationLog === s.integrationLog, 'a restore never changes users or the audit log');
  ok(restored.employees.every(x => x.bankAccount === '000000000001'), 'a restore (after its two approvals) brings back employee data');
  ok(POLICY.restore.join() === 'security,finance', 'restore needs security then finance');
  const P3 = [{ id: 'own', role: 'firmOwner' }, { id: 'rev', role: 'preparer', duties: ['review' as const] }, { id: 'prep', role: 'preparer' }];
  ok(uns(P3, 'payrun', { requesters: ['prep'], approvals: [], clientId: 'x' }).length === 0, 'no false "nobody can approve" when an order of approvals works');
  ok(strands(P3, 'payrun', { requesters: ['prep'], approvals: [], clientId: 'x' }, 'own') && !strands(P3, 'payrun', { requesters: ['prep'], approvals: [], clientId: 'x' }, 'rev'), 'warns the only finance approver before they use up the review step');
  const tplBefore = e.template ?? []; const tplAfter = [...tplBefore, { itemId: s.payItems[0].id, amount: 50000 }];
  const tplChg = applyChange(s, chg('salary', { empId: e.id, set: { template: tplAfter }, before: { template: tplBefore } }))!;
  ok(JSON.stringify(tplChg.employees.find(x => x.id === e.id)!.template) === JSON.stringify(tplAfter), 'approved pay template change applied');
  ok(applyChange(tplChg, chg('salary', { empId: e.id, set: { template: [] }, before: { template: tplBefore } })) === null, 'a template change approved against an older template is not applied');
}
console.log(`approvals: ${n} checks passed`);
