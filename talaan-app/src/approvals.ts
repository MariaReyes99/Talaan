/**
 * Double approval (maker-checker) for Talaan's high-risk actions.
 *
 * Who may approve depends on the person's approval duties, never only on their job title:
 *   review    – payroll or HR manager: checks the figures, the clearance or the change first
 *   finance   – finance manager, CFO or the client's approver: the final approval that commits money
 *   signatory – authorised officer who submits government filings
 *   config    – administers rates and tables
 *   security  – approves user roles and access rights
 * The person who asked can never approve, nobody approves twice, and the payroll preparer, the final approver and the
 * person who releases the money are always three different people.
 *
 * Single approval (no change here): leave, profile updates (address, phone), attendance, transfers, titles, onboarding.
 */
export type Duty = 'review' | 'finance' | 'signatory' | 'config' | 'security';
export const DUTIES: Duty[] = ['review', 'finance', 'signatory', 'config', 'security'];
export type Control = 'payrun' | 'release' | 'salary' | 'bank' | 'filing' | 'rates' | 'roles' | 'restore';

/** The approval steps after the maker, in order. Rates and roles follow the matrix: administrator (maker) + one approver. */
export const POLICY: Record<Control, Duty[]> = {
  payrun: ['review', 'finance'],     // regular, bonus, retro adjustment and final pay runs, and imported payroll registers
  release: ['review', 'finance'],    // bank and e-wallet payout files
  salary: ['review', 'finance'],     // pay rate increases, adjustments, promotions, demotions
  bank: ['review', 'finance'],       // payroll bank account, e-wallet or payout method changes
  filing: ['review', 'signatory'],   // BIR, SSS, PhilHealth and Pag-IBIG submissions
  rates: ['config'],                 // minimum wage table, holidays and other pay tables
  roles: ['security'],               // user roles, approval duties and access
  restore: ['security', 'finance'],  // restoring a backup replaces employees, bank details, users and pay runs
};
/** The ten controls in the approval matrix and where each is enforced. */
export const MATRIX: { key: string; control: Control }[] = [
  { key: 'payrun', control: 'payrun' }, { key: 'release', control: 'release' }, { key: 'salary', control: 'salary' }, { key: 'retro', control: 'payrun' }, { key: 'finalpay', control: 'payrun' },
  { key: 'bonus', control: 'payrun' }, { key: 'filing', control: 'filing' }, { key: 'bank', control: 'bank' }, { key: 'rates', control: 'rates' }, { key: 'roles', control: 'roles' },
];

export interface Person { id: string; role: string; clientId?: string; active?: boolean; duties?: Duty[] }
/** Duties a person holds for a client (client approvers only for their own company) or firm-wide (no clientId). */
export function dutiesOf(p: Person, clientId?: string): Duty[] {
  if (p.active === false) return [];
  if (p.role === 'firmOwner') return p.duties ?? DUTIES;
  if (p.role === 'preparer') return (p.duties ?? []).filter(d => d === 'review');
  if (p.role === 'client') return clientId && p.clientId === clientId ? (p.duties ?? ['finance', 'signatory']).filter(d => d === 'review' || d === 'finance' || d === 'signatory') : [];
  return [];
}
/** Duties a role may be given at all (Admin shows only these). */
export const ALLOWED_DUTIES: Record<string, Duty[]> = { firmOwner: DUTIES, preparer: ['review'], client: ['review', 'finance', 'signatory'], employee: [], talaanAdmin: [] };

/** hash: fingerprint of what was approved (e.g. the pay run's lines); an approval no longer counts if that changes. */
export interface Approval { by: string; at: string; duty: Duty; hash?: string }
export interface Ctx { requesters: string[]; approvals: Approval[]; clientId?: string; exclude?: string[]; excludeFinal?: string[] }
export const nextDuty = (control: Control, approvals: Approval[]): Duty | null => POLICY[control][approvals.length] ?? null;
export const complete = (control: Control, approvals: Approval[]) => approvals.length >= POLICY[control].length;

/** Whether this person may give the next approval. */
export function canApprove(p: Person, control: Control, x: Ctx): boolean {
  const duty = nextDuty(control, x.approvals); if (!duty) return false;
  if (x.requesters.includes(p.id) || x.approvals.some(a => a.by === p.id) || x.exclude?.includes(p.id)) return false;
  if (x.approvals.length === POLICY[control].length - 1 && x.excludeFinal?.includes(p.id)) return false;
  return dutiesOf(p, x.clientId).includes(duty);
}
export const eligible = <P extends Person>(people: P[], control: Control, x: Ctx) => people.filter(p => canApprove(p, control, x));
/** Steps that cannot be completed with the people available, searching every order of assignment (not just the first fit). */
export function unstaffed(people: Person[], control: Control, x: Ctx): Duty[] {
  const best = { missing: POLICY[control].slice(x.approvals.length) as Duty[] };
  const go = (approvals: Approval[], missing: Duty[]) => {
    if (missing.length >= best.missing.length) return;
    if (complete(control, approvals)) { best.missing = missing; return; }
    const duty = nextDuty(control, approvals)!; const who = people.filter(p => canApprove(p, control, { ...x, approvals }));
    for (const p of who) go([...approvals, { by: p.id, at: '', duty }], missing);
    if (!who.length) go([...approvals, { by: `__missing_${approvals.length}`, at: '', duty }], [...missing, duty]);
  };
  go([...x.approvals], []);
  return best.missing;
}
/** True when this person's approval now would leave a later step with nobody able to give it (warn before they use it up). */
export function strands(people: Person[], control: Control, x: Ctx, personId: string): boolean {
  if (unstaffed(people, control, x).length) return false;
  const duty = nextDuty(control, x.approvals); if (!duty) return false;
  return unstaffed(people, control, { ...x, approvals: [...x.approvals, { by: personId, at: '', duty }] }).length > 0;
}

/** A change waiting for approval: salary, bank details, pay tables or roles. Nothing changes until the last approval. */
export interface ChangeRequest {
  id: string; control: Control; clientId?: string; subject: string; title: string; lines: string[]; payload: unknown; hash: string;
  requestedBy: string; requestedAt: string; reason?: string; approvals: Approval[];
  status: 'pending' | 'approved' | 'returned' | 'withdrawn' | 'stale'; returned?: { by: string; at: string; reason: string }; appliedAt?: string;
}
export function addApproval<T extends { approvals?: Approval[] }>(item: T, control: Control, by: string, at = new Date().toISOString()): { item: T; done: boolean } {
  const approvals = [...(item.approvals ?? []), { by, at, duty: nextDuty(control, item.approvals ?? [])! }];
  return { item: { ...item, approvals }, done: complete(control, approvals) };
}
