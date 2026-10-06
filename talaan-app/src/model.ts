import { computeLine, runChecks, EMPTY_HOURS, totals, r2, type Employee, type Freq, type Hours, type Line } from './engine';
export { r2 };

export type Role = 'firmOwner' | 'preparer' | 'client' | 'employee';
export interface User { id: string; name: string; role: Role; clientId?: string; empId?: string; email?: string; active?: boolean }
export type AccountKey = 'accSalaries' | 'accEmployer' | 'accSSS' | 'accPH' | 'accPI' | 'accWHT' | 'accOther' | 'accNet';
export const DEFAULT_CODES: Record<AccountKey, string> = { accSalaries: '6100', accEmployer: '6110', accSSS: '2210', accPH: '2220', accPI: '2230', accWHT: '2240', accOther: '2250', accNet: '2200' };
export interface EmployerIds { sss: string; philhealth: string; pagibig: string; tin: string; rdo: string; address: string }
export type BankField = 'account' | 'name' | 'amount' | 'date' | 'reference' | 'literal';
export interface BankColumn { field: BankField; label: string; width?: number; literal?: string }
export interface BankTemplate { name: string; delimiter: ',' | '\t' | '|' | 'fixed'; header: boolean; amount: 'decimal' | 'centavos'; date: 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'MMDDYYYY'; trailer: boolean; columns: BankColumn[]; verified?: string }
export interface Contact { name: string; email: string; billing?: boolean }
export interface Rates { perRun: number; perPayslip: number; perFiling: number; perNewHire: number; per2316: number }
export interface Client { contacts?: Contact[]; notify?: { approved: boolean; remitted: boolean; invoice: boolean }; rates?: Partial<Rates>; region?: string; active?: boolean; ids?: EmployerIds; bankTemplate?: BankTemplate; id: string; name: string; freq: Freq; minWage: number; workdays: 261 | 313; bank: string; xero: boolean; dueDays: { bir: number; sss: number; ph: number; pi: number }; importMap?: Record<string, string>; assignee?: string; codes?: Record<AccountKey, string> }
export interface Activity { at: string; user: string; clientId?: string; action: string; detail?: Record<string, string | number> }
export interface Note { at: string; user: string; text: string }
export interface Run {
  id: string; clientId: string; period: string; status: 'draft' | 'approved';
  hours: Record<string, Hours>; reasons: Record<string, string>; preparedBy: string;
  approvedBy?: string; approvedAt?: string; lines?: Line[]; xeroSentAt?: string;
  /** Approval workflow: submitted for approval, or returned to the preparer with a reason. */
  submitted?: { at: string; by: string; to: string[] }; returned?: { at: string; by: string; reason: string };
}
export type Agency = 'sss' | 'ph' | 'pi' | 'bir';
export interface Remit { generatedAt?: string; uploadedAt?: string; reference?: string; channel?: string; amountPaid?: number; paidAt?: string; receipt?: { name: string; size: number }; note?: string }
export type CheckKey = 'funds' | 'licence' | 'bcp' | 'export' | 'continuity';
export type CheckValue = 'yes' | 'no' | 'unknown';
export interface PartnerCheck { checks: Record<CheckKey, CheckValue>; licence: string; evidence: string; reviewed?: string }
export interface Region { id: string; name: string; nonAgri: number; other: number; wageOrder: string; effective: string; checked?: string }
export interface Holiday { date: string; name: string; type: 'regular' | 'special' }
export interface Refs { banks: string[]; regions: Region[]; holidays: Holiday[]; docTypes: string[] }
export interface WatchSource { id: string; agency: string; name: string; url: string; watches: string; every: 'daily' | 'weekly' | 'monthly'; lastChecked?: string; lastChange?: string }
export interface ReviewItem { id: string; sourceId: string; detectedAt: string; summary: string; status: 'open' | 'accepted' | 'dismissed'; entryId?: string; by?: string }
export interface CorpusAdmin { custom: Record<string, unknown>[]; removed: string[]; reviewEveryDays: number; lastCheck?: { at: string; errors: number; warnings: number; user: string } }
export interface Notice { id: string; to: string; at: string; key: string; vars: Record<string, string | number>; route: { page: string; id?: string; step?: number }; read?: boolean }
export interface Email { id: string; at: string; to: string[]; subject: string; body: string; kind: string; clientId?: string; status: 'queued' | 'sent' | 'failed'; by: string }
export interface InvoiceLine { label: string; qty: number; rate: number; amount: number }
export interface Invoice { no: string; clientId: string; month: string; lines: InvoiceLine[]; subtotal: number; vat: number; total: number; issuedAt: string; dueAt: string; status: 'issued' | 'paid'; paidAt?: string; by: string }
export interface Billing { firmName: string; vatRegistered: boolean; termsDays: number; rates: Rates; invoices: Invoice[]; nextNo: number }
export interface State { notices: Notice[]; outbox: Email[]; billing: Billing; users: User[]; refs: Refs; corpus: CorpusAdmin; watch: { sources: WatchSource[]; queue: ReviewItem[] }; prefs?: { protect?: boolean; help?: boolean }; remits: Record<string, Remit>; partners: Record<string, PartnerCheck>; v: number; clients: Client[]; employees: Employee[]; runs: Run[]; filings: Record<string, { ref: string; date: string }>; askLog: string[]; activity: Activity[]; notes: Record<string, Note[]> }

export const USERS: User[] = [
  { id: 'maricel', name: 'Maricel Santos', role: 'firmOwner' },
  { id: 'jun', name: 'Jun dela Cruz', role: 'preparer' },
  { id: 'teresita', name: 'Teresita Lim', role: 'client', clientId: 'lim' },
  { id: 'rico', name: 'Rico Santos', role: 'employee', clientId: 'lim', empId: 'lim-3' },
];
export const SEED_REFS: Refs = {
  banks: ['BDO', 'BPI', 'Metrobank', 'UnionBank', 'Landbank', 'PNB', 'Security Bank', 'RCBC', 'China Bank', 'EastWest'],
  regions: [
    { id: 'ncr', name: 'NCR (Metro Manila)', nonAgri: 755, other: 718, wageOrder: 'NCR-28', effective: '2026-09-26', checked: '2026-10-04' },
    { id: 'r7', name: 'Region VII (Central Visayas)', nonAgri: 540, other: 540, wageOrder: 'To confirm with RTWPB VII', effective: '', checked: '' },
  ],
  // Fixed by law; dates for 2026 computed (Holy Week from Easter 5 April 2026). Confirm against the 2026 holiday proclamation.
  holidays: [
    { date: '2026-01-01', name: 'New Year’s Day', type: 'regular' }, { date: '2026-04-02', name: 'Maundy Thursday', type: 'regular' },
    { date: '2026-04-03', name: 'Good Friday', type: 'regular' }, { date: '2026-04-04', name: 'Black Saturday', type: 'special' },
    { date: '2026-04-09', name: 'Araw ng Kagitingan', type: 'regular' }, { date: '2026-05-01', name: 'Labor Day', type: 'regular' },
    { date: '2026-06-12', name: 'Independence Day', type: 'regular' }, { date: '2026-08-21', name: 'Ninoy Aquino Day', type: 'special' },
    { date: '2026-08-31', name: 'National Heroes Day', type: 'regular' }, { date: '2026-11-01', name: 'All Saints’ Day', type: 'special' },
    { date: '2026-11-30', name: 'Bonifacio Day', type: 'regular' }, { date: '2026-12-08', name: 'Feast of the Immaculate Conception', type: 'special' },
    { date: '2026-12-25', name: 'Christmas Day', type: 'regular' }, { date: '2026-12-30', name: 'Rizal Day', type: 'regular' }, { date: '2026-12-31', name: 'Last day of the year', type: 'special' },
  ],
  docTypes: ['Timesheet', 'Approval', 'Bank acknowledgement', 'Agency receipt', 'Employee ID', 'Employment contract', 'Signed BIR 2316', 'Bank file template', 'Registration document', 'Other'],
};
export const SEED_SOURCES: WatchSource[] = [
  { id: 'bir', agency: 'BIR', name: 'BIR revenue issuances', url: 'https://www.bir.gov.ph', watches: 'Revenue regulations, memorandum circulars, withholding tax tables, form updates', every: 'daily' },
  { id: 'sss', agency: 'SSS', name: 'SSS circulars and contribution schedule', url: 'https://www.sss.gov.ph', watches: 'Contribution rates, salary credit range, R-3 file format, payment channels', every: 'weekly' },
  { id: 'philhealth', agency: 'PhilHealth', name: 'PhilHealth circulars', url: 'https://www.philhealth.gov.ph', watches: 'Premium rate, floor and ceiling, EPRS changes', every: 'weekly' },
  { id: 'pagibig', agency: 'Pag-IBIG', name: 'Pag-IBIG Fund circulars', url: 'https://www.pagibigfund.gov.ph', watches: 'Contribution rate, fund salary cap, MCRF and STLRF templates', every: 'weekly' },
  { id: 'nwpc', agency: 'NWPC', name: 'Regional wage orders', url: 'https://nwpc.dole.gov.ph', watches: 'New minimum wage orders by region', every: 'daily' },
  { id: 'dole', agency: 'DOLE', name: 'DOLE labor advisories', url: 'https://www.dole.gov.ph', watches: 'Holiday pay rules, 13th month advisories, leave laws', every: 'weekly' },
  { id: 'bsp', agency: 'BSP', name: 'BSP licensed institutions', url: 'https://www.bsp.gov.ph', watches: 'Bank, e-money issuer and payment system operator status of partners', every: 'monthly' },
  { id: 'banks', agency: 'Banks', name: 'Partner banks: payroll file and cash management notices', url: 'https://www.bdo.com.ph', watches: 'Payroll file template changes, cut-off times, government payment channels', every: 'monthly' },
];

/* ---------- Periods ---------- */
const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const lastDay = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
export function periodInfo(p: string) {
  const [y, m, h] = [Number(p.slice(0, 4)), Number(p.slice(5, 7)) - 1, p.slice(8)];
  const ld = lastDay(y, m);
  const start = new Date(y, m, h === 'B' ? 16 : 1), end = new Date(y, m, h === 'A' ? 15 : ld);
  return { start, end, payDate: end, monthKey: p.slice(0, 7), half: h as 'A' | 'B' | 'M' };
}
export function currentPeriod(freq: Freq, d = new Date()) {
  const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  return freq === 'monthly' ? `${k}-M` : `${k}-${d.getDate() <= 15 ? 'A' : 'B'}`;
}
export function shiftPeriod(p: string, freq: Freq, n: number) {
  let { start } = periodInfo(p);
  for (let i = 0; i < Math.abs(n); i++) {
    if (freq === 'monthly') start = new Date(start.getFullYear(), start.getMonth() + Math.sign(n), 1);
    else start = n > 0 ? (start.getDate() === 1 ? new Date(start.getFullYear(), start.getMonth(), 16) : new Date(start.getFullYear(), start.getMonth() + 1, 1))
      : (start.getDate() === 16 ? new Date(start.getFullYear(), start.getMonth(), 1) : new Date(start.getFullYear(), start.getMonth() - 1, 16));
  }
  return currentPeriod(freq, start);
}
export const daysBetween = (a: Date, b: Date) => Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime() - new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()) / 864e5);

/* ---------- Sample data ---------- */
const E = (clientId: string, n: number, name: string, position: string, monthlyRate: number, workdays: 261 | 313, ids: Partial<Employee> = {}): Employee => {
  let x = clientId.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) * 1000 + n * 7919;
  const dig = (len: number) => { let o = ''; for (let i = 0; i < len; i++) { x = (x * 1103515245 + 12345) % 2147483648; o += String(x % 10); } return o; };
  const t = dig(9), ss = dig(10), ph = dig(12), pi = dig(12), bk = dig(12);
  return {
    id: `${clientId}-${n}`, clientId, name, position, monthlyRate: r2(monthlyRate), workdays,
    tin: `${t.slice(0, 3)}-${t.slice(3, 6)}-${t.slice(6)}`, sss: `${ss.slice(0, 2)}-${ss.slice(2, 9)}-${ss.slice(9)}`,
    philhealth: `${ph.slice(0, 2)}-${ph.slice(2, 11)}-${ph.slice(11)}`, pagibig: `${pi.slice(0, 4)}-${pi.slice(4, 8)}-${pi.slice(8)}`,
    bankAccount: bk, active: true, ...ids,
  };
};
const MIN_NCR = 755; // Wage Order NCR-28, from 26 September 2026
const minMonthly = (wd: number) => (MIN_NCR * wd) / 12;

export function sampleState(today = new Date()): State {
  const clients: Client[] = [
    { id: 'mabuhay', name: 'Mabuhay Bakery', freq: 'semi', minWage: MIN_NCR, workdays: 313, bank: 'BPI', xero: true, dueDays: { bir: 10, sss: 28, ph: 15, pi: 15 }, assignee: 'jun' },
    { id: 'santos', name: 'Santos Hardware', freq: 'semi', minWage: MIN_NCR, workdays: 313, bank: 'BDO', xero: false, dueDays: { bir: 10, sss: Math.min(28, today.getDate() + 1), ph: 15, pi: 15 }, assignee: 'jun' },
    { id: 'lim', name: 'Lim Trading Corp.', freq: 'semi', minWage: MIN_NCR, workdays: 261, bank: 'BDO', xero: true, dueDays: { bir: 10, sss: 28, ph: 15, pi: 15 }, assignee: 'jun' },
    { id: 'cebu', name: 'Cebu Family Clinic', freq: 'monthly', minWage: 540, workdays: 261, bank: 'UnionBank', xero: true, dueDays: { bir: 10, sss: 28, ph: 15, pi: 20 }, assignee: 'maricel' },
  ];
  const ids = (n: number): EmployerIds => ({ sss: `03-${String(1234567 + n * 1111).slice(0, 7)}-0`, philhealth: `20-${String(500000000 + n * 12345).slice(0, 9)}-1`, pagibig: `2010-${String(1000 + n)}-${String(3000 + n * 7)}`, tin: `00${n}-123-45${n}-000`, rdo: n === 4 ? '081' : '039', address: n === 4 ? 'Cebu City' : 'Quezon City, Metro Manila' });
  clients.forEach((c, i) => { c.ids = ids(i + 1); });
  const employees: Employee[] = [
    E('mabuhay', 1, 'Lorna Bautista', 'Head baker', 26000, 313), E('mabuhay', 2, 'Joel Mendoza', 'Baker', minMonthly(313) + 900, 313),
    E('mabuhay', 3, 'Grace Villanueva', 'Cashier', minMonthly(313), 313), E('mabuhay', 4, 'Paolo Ramos', 'Delivery rider', minMonthly(313) + 300, 313, { payout: 'gcash', mobile: '0917 555 0144' }),
    E('santos', 1, 'Eduardo Santos Jr.', 'Store manager', 32000, 313), E('santos', 2, 'Mila Aquino', 'Sales clerk', minMonthly(313), 313),
    E('santos', 3, 'Dante Navarro', 'Warehouse', minMonthly(313) + 500, 313, { payout: 'maya', mobile: '0918 222 7301' }),
    E('lim', 1, 'Ana Cruz', 'Accounts clerk', 24000, 261, { sss: '34-123456-8' }), E('lim', 2, 'Ben Reyes', 'Driver', 21000, 261),
    E('lim', 3, 'Rico Santos', 'Warehouse supervisor', 23500, 261), E('lim', 4, 'Cheryl Tan', 'Purchasing officer', 38000, 261),
    E('lim', 5, 'Vincent Go', 'Sales executive', 45000, 261), E('lim', 6, 'Liza Ocampo', 'Admin assistant', 19500, 261),
    E('cebu', 1, 'Dr. Ramon Uy', 'Clinic physician', 85000, 261), E('cebu', 2, 'Joy Fernandez', 'Nurse', 28000, 261),
    E('cebu', 3, 'Arnel Pacquing', 'Med tech', 26000, 261), E('cebu', 4, 'Kristine Lao', 'Front desk', 18000, 261),
  ];
  employees.forEach((e, i) => { e.hireDate = `20${18 + (i % 7)}-0${1 + (i % 9)}-15`; e.birthDate = `19${80 + (i % 18)}-${String(1 + (i % 12)).padStart(2, '0')}-${String(5 + i).padStart(2, '0')}`; });
  const thisMonth = iso(new Date(today.getFullYear(), today.getMonth(), 1));
  employees.push(E('lim', 7, 'Joanna Sy', 'Accounting assistant', 22000, 261, { hireDate: thisMonth, birthDate: '2001-03-14' }));
  const runs: Run[] = [];
  const mk = (c: Client, period: string, status: Run['status'], hours: Record<string, Hours> = {}, preparedBy = 'jun', approvedBy = 'maricel'): Run => {
    const emps = employees.filter(e => e.clientId === c.id);
    const h: Record<string, Hours> = Object.fromEntries(emps.map(e => [e.id, { ...EMPTY_HOURS, ...(hours[e.id] ?? {}) }]));
    const run: Run = { id: `${c.id}-${period}`, clientId: c.id, period, status, hours: h, reasons: {}, preparedBy };
    if (status === 'approved') {
      run.lines = emps.map(e => computeLine(e, h[e.id], c.freq, c.minWage)); run.approvedBy = approvedBy;
      run.approvedAt = iso(periodInfo(period).payDate); run.xeroSentAt = c.xero ? run.approvedAt : undefined;
    }
    return run;
  };
  for (const c of clients) {
    const cur = currentPeriod(c.freq, today), p1 = shiftPeriod(cur, c.freq, -1), p2 = shiftPeriod(cur, c.freq, -2);
    const nd = (id: string, n: number) => ({ [id]: { ...EMPTY_HOURS, ndHours: n } });
    const base = c.id === 'mabuhay' ? { ...nd('mabuhay-1', 40), ...nd('mabuhay-2', 40) } : {};
    runs.push(mk(c, p2, 'approved', base, 'jun', c.id === 'lim' ? 'teresita' : 'maricel'));
    if (c.id === 'lim') {
      runs.push(mk(c, p1, 'draft', {
        'lim-2': { ...EMPTY_HOURS, otHours: 28, restDays: 2 }, 'lim-3': { ...EMPTY_HOURS, otHours: 6, ndHours: 8 }, 'lim-6': { ...EMPTY_HOURS, absentDays: 1 },
      }));
    } else runs.push(mk(c, p1, 'approved', base));
  }
  const ago = (d: number, h = 9) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - d, h, 15).toISOString();
  const limDraft = runs.find(r => r.clientId === 'lim' && r.status === 'draft')!;
  const activity: Activity[] = ([
    { at: ago(5), user: 'jun', clientId: 'lim', action: 'act_created', detail: { period: limDraft.period } },
    { at: ago(5, 11), user: 'jun', clientId: 'lim', action: 'act_hours', detail: { n: 3 } },
    { at: ago(4), user: 'maricel', clientId: 'mabuhay', action: 'act_xero', detail: {} },
    { at: ago(1), user: 'jun', clientId: 'santos', action: 'act_exported', detail: { file: 'santos_SSS.csv' } },
  ] as Activity[]).reverse();
  const notes: Record<string, Note[]> = { [limDraft.id]: [
    { at: ago(5, 11), user: 'jun', text: 'Ben covered rest days for a sick driver; overtime confirmed by Ma’am Teresita on Viber.' },
    { at: ago(4, 14), user: 'maricel', text: 'Ana’s SSS number on file looks short. Please ask her for her E-1 or UMID.' },
  ] };
  clients.forEach(c => { c.region = c.id === 'cebu' ? 'r7' : 'ncr'; c.active = true; });
    clients.forEach(c => { c.contacts = c.id === 'lim' ? [{ name: 'Teresita Lim', email: 'teresita@limtrading.ph', billing: true }] : [{ name: `${c.name} owner`, email: `owner@${c.id}.example.ph`, billing: true }]; c.notify = { approved: true, remitted: true, invoice: true }; });
  const st: State = { v: 8, notices: [], outbox: [], billing: { firmName: 'Santos Bookkeeping Services', vatRegistered: true, termsDays: 15, rates: { perRun: 500, perPayslip: 60, perFiling: 250, perNewHire: 150, per2316: 100 }, invoices: [], nextNo: 1 }, clients, employees, runs, filings: {}, askLog: [], activity, notes, remits: {}, partners: {}, users: USERS.map(u => ({ ...u, active: true, email: u.id === 'teresita' ? 'teresita@limtrading.ph' : u.id === 'rico' ? '' : `${u.id}@santosbookkeeping.ph` })), refs: JSON.parse(JSON.stringify(SEED_REFS)), corpus: { custom: [], removed: [], reviewEveryDays: 30 }, watch: { sources: SEED_SOURCES.map(x => ({ ...x })), queue: [{ id: 'q1', sourceId: 'nwpc', detectedAt: iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2)), summary: 'Wage order page changed (example): check whether any region issued a new wage order.', status: 'open' }] } };
  const prevMonth = iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)).slice(0, 7);
  for (const f of filingsFor(st)) if (f.month < prevMonth) {
    const ref = `${f.kind.toUpperCase()}-${f.month.replace('-', '')}-${f.clientId.slice(0, 3).toUpperCase()}`;
    st.filings[f.key] = { ref, date: iso(f.due) };
    st.remits[f.key] = { generatedAt: iso(f.due), uploadedAt: iso(f.due), reference: ref, channel: 'Bank online', amountPaid: f.expected, paidAt: iso(f.due), receipt: { name: `${ref}.pdf`, size: 48211 } };
  }
  return st;
}

/* ---------- Derived data ---------- */
/** An employee belongs in a cutoff only if hired on or before its last day and not separated before its first day. */
export function inPeriod(e: Employee, period: string) {
  const { start, end } = periodInfo(period);
  return e.active && (!e.hireDate || e.hireDate <= iso(end)) && (!e.separationDate || e.separationDate >= iso(start));
}
export function linesFor(s: State, run: Run) {
  if (run.status === 'approved' && run.lines) return run.lines;
  const c = s.clients.find(x => x.id === run.clientId)!;
  return s.employees.filter(e => e.clientId === run.clientId && inPeriod(e, run.period)).map(e => computeLine(e, run.hours[e.id] ?? EMPTY_HOURS, c.freq, c.minWage));
}
export function prevNetFor(s: State, run: Run) {
  const prev = s.runs.filter(r => r.clientId === run.clientId && r.status === 'approved' && r.period < run.period).sort((a, b) => b.period.localeCompare(a.period))[0];
  return Object.fromEntries((prev?.lines ?? []).map(l => [l.empId, l.net]));
}
export function checksFor(s: State, run: Run) {
  const c = s.clients.find(x => x.id === run.clientId)!;
  const lines = linesFor(s, run);
  const emps = s.employees.filter(e => e.clientId === run.clientId && (run.status === 'approved' ? lines.some(l => l.empId === e.id) : inPeriod(e, run.period)));
  return runChecks(emps, linesFor(s, run), run.hours, c.freq, c.minWage, prevNetFor(s, run));
}

export type FilingKind = 'bir' | 'sss' | 'ph' | 'pi';
export const PORTAL: Record<FilingKind, string> = { bir: 'BIR eFPS / eBIRForms', sss: 'My.SSS employer portal', ph: 'PhilHealth EPRS', pi: 'Virtual Pag-IBIG' };
export interface Filing { key: string; clientId: string; month: string; kind: FilingKind; due: Date; lines: Line[]; expected: number; filed?: { ref: string; date: string }; remit?: Remit }
export function filingsFor(s: State): Filing[] {
  const out: Filing[] = [];
  const byMonth = new Map<string, Line[]>();
  for (const r of s.runs.filter(r => r.status === 'approved')) {
    const k = `${r.clientId}|${r.period.slice(0, 7)}`; byMonth.set(k, [...(byMonth.get(k) ?? []), ...(r.lines ?? [])]);
  }
  for (const [k, lines] of byMonth) {
    const [clientId, month] = k.split('|'); const c = s.clients.find(x => x.id === clientId)!;
    const y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7));
    for (const kind of ['bir', 'sss', 'ph', 'pi'] as FilingKind[]) {
      const day = Math.min(c.dueDays[kind], lastDay(y, m));
      const key = `${clientId}|${month}|${kind}`;
      const sum = (f: (l: Line) => number) => r2(lines.reduce((a, l) => a + f(l), 0));
      const expected = kind === 'sss' ? sum(l => l.sssEE + l.sssER + l.ec + l.sssLoan) : kind === 'ph' ? sum(l => l.phEE + l.phER) : kind === 'pi' ? sum(l => l.piEE + l.piER + l.pagibigLoan) : sum(l => l.wht);
      const remit = s.remits?.[key];
      const done = remit && remit.amountPaid !== undefined && remit.reference && remit.receipt && Math.abs(remit.amountPaid - expected) < 0.005;
      out.push({ key, clientId, month, kind, due: new Date(y, m, day), lines, expected, remit, filed: done ? { ref: remit!.reference!, date: remit!.paidAt ?? '' } : undefined });
    }
  }
  return out.sort((a, b) => a.due.getTime() - b.due.getTime());
}

export type Urgency = 'late' | 'soon' | 'ok';
export interface Task { clientId: string; urgency: Urgency; due: Date; kind: 'approve' | 'start' | 'file'; runId?: string; period?: string; filing?: Filing }
export function tasksFor(s: State, today = new Date()): Task[] {
  const tasks: Task[] = [];
  const urg = (d: Date): Urgency => { const n = daysBetween(today, d); return n < 0 ? 'late' : n <= 3 ? 'soon' : 'ok'; };
  for (const c of s.clients) {
    for (const r of s.runs.filter(r => r.clientId === c.id && r.status === 'draft')) {
      const due = periodInfo(r.period).payDate; tasks.push({ clientId: c.id, urgency: urg(due), due, kind: 'approve', runId: r.id, period: r.period });
    }
    const cur = currentPeriod(c.freq, today);
    if (!s.runs.some(r => r.clientId === c.id && r.period === cur)) {
      const due = periodInfo(cur).payDate; tasks.push({ clientId: c.id, urgency: urg(due), due, kind: 'start', period: cur });
    }
  }
  for (const f of filingsFor(s).filter(f => !f.filed)) tasks.push({ clientId: f.clientId, urgency: urg(f.due), due: f.due, kind: 'file', filing: f });
  return tasks.sort((a, b) => a.due.getTime() - b.due.getTime());
}

export { totals };
