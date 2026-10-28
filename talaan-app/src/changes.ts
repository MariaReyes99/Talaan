/**
 * Applying an approved change request (approvals.ts). A change is applied only if the record still looks exactly as it did
 * when the change was requested; otherwise it is marked stale and must be requested again, so nobody approves one
 * thing and gets another.
 */
import type { ChangeRequest } from './approvals';
import { fingerprint } from './integrations';
import type { Employee } from './engine';
import { migrate, sampleState, type EmpChange, type Holiday, type Region, type State, type User } from './model';

export type EmpFields = Partial<Pick<Employee, 'monthlyRate' | 'bankAccount' | 'payout' | 'mobile' | 'template'>>;
export interface EmpPayload { empId: string; set: EmpFields; before: EmpFields }
export interface RatesPayload { regions?: Region[]; holidays?: Holiday[]; clientWages?: Record<string, number>; beforeHash: string }
export interface RolesPayload { user?: User; before?: User | null; controls?: State['controls']; beforeControls?: State['controls'] }

export const refsHash = (s: State) => fingerprint(JSON.stringify({ r: s.refs.regions, h: s.refs.holidays, w: s.clients.map(c => [c.id, c.minWage]) }));
const mask = (k: string, v: unknown) => k === 'bankAccount' && v ? `•••${String(v).replace(/\D/g, '').slice(-4)}` : k === 'template' ? (Array.isArray(v) ? v.map((x: { itemId: string; amount: number }) => `${x.itemId} ${x.amount}`).join(', ') : '') : String(v ?? '');
const val = (v: unknown) => JSON.stringify(v ?? '');
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Returns the new state, or null when the record changed since the request (stale). */
export function applyChange(s: State, r: ChangeRequest): State | null {
  const at = new Date().toISOString(); const who = r.approvals.map(a => s.users.find(u => u.id === a.by)?.name ?? a.by).join(' + ');
  if (r.control === 'salary' || r.control === 'bank') {
    const p = r.payload as EmpPayload; const e = s.employees.find(x => x.id === p.empId); if (!e) return null;
    for (const k of Object.keys(p.before) as (keyof EmpFields)[]) if (val(e[k] ?? (k === 'template' ? [] : '')) !== val(p.before[k] ?? (k === 'template' ? [] : ''))) return null;
    const after = { ...e, ...p.set } as Employee;
    const hist: EmpChange[] = (Object.keys(p.set) as (keyof EmpFields)[]).filter(k => val(e[k]) !== val(after[k]))
      .map(k => ({ at, user: r.requestedBy, field: k, from: mask(k, e[k]), to: mask(k, after[k]), reason: `${r.reason ?? ''} (approved by ${who})`.trim() }));
    return { ...s, employees: s.employees.map(x => x.id === e.id ? after : x), empHistory: { ...s.empHistory, [e.id]: [...hist, ...(s.empHistory[e.id] ?? [])].slice(0, 100) } };
  }
  if (r.control === 'rates') {
    const p = r.payload as RatesPayload; if (refsHash(s) !== p.beforeHash) return null;
    return { ...s, refs: { ...s.refs, ...(p.regions ? { regions: p.regions } : {}), ...(p.holidays ? { holidays: p.holidays } : {}) },
      clients: p.clientWages ? s.clients.map(c => p.clientWages![c.id] !== undefined ? { ...c, minWage: p.clientWages![c.id] } : c) : s.clients };
  }
  if (r.control === 'roles') {
    const p = r.payload as RolesPayload;
    if (p.controls) { if (!same(s.controls, p.beforeControls)) return null; return { ...s, controls: { ...s.controls, ...p.controls } }; }
    if (!p.user) return null; const cur = s.users.find(u => u.id === p.user!.id) ?? null;
    if (!same(cur, p.before)) return null;
    // Never leave the firm without an active owner.
    const users = cur ? s.users.map(u => u.id === p.user!.id ? p.user! : u) : [...s.users, p.user];
    if (!users.some(u => u.role === 'firmOwner' && u.active !== false)) return null;
    return { ...s, users };
  }
  return null;
}

/**
 * Restore from a backup (after two approvals): employees, bank details, pay runs and settings come from the file. Users,
 * approval duties, controls and the audit history (integration log, approvals, received files) never do, so a backup
 * cannot grant access or rewrite the audit trail.
 */
export function restoreState(s: State, d: State): State {
  const base = sampleState();
  const m = migrate({ ...base, ...d, v: 7, activity: d.activity ?? [], notes: d.notes ?? {}, filings: d.filings ?? {}, askLog: d.askLog ?? [], remits: d.remits ?? {}, partners: d.partners ?? {}, refs: d.refs ?? base.refs, corpus: d.corpus ?? base.corpus, watch: d.watch ?? base.watch } as State);
  return { ...m, users: s.users, controls: s.controls, integrationLog: s.integrationLog, alertsSent: s.alertsSent, changes: s.changes, inbound: s.inbound, notices: s.notices, outbox: s.outbox };
}
