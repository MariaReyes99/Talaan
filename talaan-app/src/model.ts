import { computeLine, runChecks, yearEnd, EMPTY_HOURS, totals, r2, type Employee, type Freq, type Hours, type Line } from './engine';
import type { Payment, PaymentClaim } from './receivables';
export { r2 };

export type Role = 'firmOwner' | 'preparer' | 'client' | 'employee' | 'talaanAdmin';
export interface User { id: string; name: string; role: Role; clientId?: string; empId?: string; email?: string; active?: boolean }
export type AccountKey = 'accSalaries' | 'accBonus' | 'accEmployer' | 'accReimb' | 'accSSS' | 'accPH' | 'accPI' | 'accWHT' | 'accOther' | 'accNet';
export const DEFAULT_CODES: Record<AccountKey, string> = { accSalaries: '6100', accBonus: '6105', accEmployer: '6110', accReimb: '6120', accSSS: '2210', accPH: '2220', accPI: '2230', accWHT: '2240', accOther: '2250', accNet: '2200' };

/* ---------- Talaan modules (see the Talaan Product Bundle) ---------- */
export type ModuleKey = 'payroll' | 'compliance' | 'books' | 'hr' | 'ai' | 'analytics';
export const MODULES: ModuleKey[] = ['payroll', 'compliance', 'books', 'hr', 'ai', 'analytics'];
/** Draft list prices per active employee per month (₱, before VAT). To be tested with pilot firms. */
export const MODULE_PRICE: Record<ModuleKey, number> = { payroll: 79, compliance: 39, books: 19, hr: 29, ai: 15, analytics: 15 };
export const AI_INCLUDED = 200; // Ask Tala questions included per firm per month
export interface EmployerIds { sss: string; philhealth: string; pagibig: string; tin: string; rdo: string; address: string }
export type BankField = 'account' | 'name' | 'amount' | 'date' | 'reference' | 'literal';
export interface BankColumn { field: BankField; label: string; width?: number; literal?: string }
export interface BankTemplate { name: string; delimiter: ',' | '\t' | '|' | 'fixed'; header: boolean; amount: 'decimal' | 'centavos'; date: 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'MMDDYYYY'; trailer: boolean; columns: BankColumn[]; verified?: string }
export interface Contact { name: string; email: string; billing?: boolean }
export interface Rates { perRun: number; perPayslip: number; perFiling: number; perNewHire: number; per2316: number }
export interface Client { trackDepts?: boolean; modules?: ModuleKey[]; payrollSource?: 'talaan' | 'external'; externalSystem?: string; departments?: string[]; contacts?: Contact[]; notify?: { approved: boolean; remitted: boolean; invoice: boolean }; rates?: Partial<Rates>; region?: string; active?: boolean; ids?: EmployerIds; bankTemplate?: BankTemplate; id: string; name: string; freq: Freq; minWage: number; workdays: 261 | 313; bank: string; xero: boolean; dueDays: { bir: number; sss: number; ph: number; pi: number }; importMap?: Record<string, string>; assignee?: string; codes?: Record<AccountKey, string> }
export interface Activity { at: string; user: string; clientId?: string; action: string; detail?: Record<string, string | number> }
export interface Note { at: string; user: string; text: string }
export interface Run {
  id: string; clientId: string; period: string; status: 'draft' | 'approved';
  hours: Record<string, Hours>; reasons: Record<string, string>; preparedBy: string;
  approvedBy?: string; approvedAt?: string; lines?: Line[]; xeroSentAt?: string;
  /** Approval workflow: submitted for approval, or returned to the preparer with a reason. */
  submitted?: { at: string; by: string; to: string[] }; returned?: { at: string; by: string; reason: string };
  /** regular = the normal cutoff; bonus and reimbursement = off-cycle runs; final = final pay for leavers; imported = results from another payroll system. */
  kind?: RunKind; label?: string; empIds?: string[];
  /** What was filled in from loans and approved leave when the run was started or refreshed. */
  loanApplied?: Record<string, number>; leaveApplied?: string[]; tplDeduction?: Record<string, number>; source?: string;
}
export type RunKind = 'regular' | 'bonus' | 'reimbursement' | 'final' | 'imported';
export const runKind = (r: Run): RunKind => r.kind ?? 'regular';
export const isRegular = (r: Run) => runKind(r) === 'regular';

/* ---------- Pay items, loans, leave, history ---------- */
export type PayItemKind = 'allowance' | 'deMinimis' | 'deduction' | 'reimbursement';
export interface PayItem { id: string; name: string; kind: PayItemKind; account?: string; active?: boolean }
export type LoanKind = 'sss' | 'pagibig' | 'company' | 'cashAdvance';
export interface Loan { id: string; empId: string; kind: LoanKind; principal: number; perPeriod: number; start: string; note?: string; createdAt: string; closed?: boolean }
export interface LeaveType { id: string; name: string; days: number; paid: boolean; convertible: boolean; active?: boolean }
export interface LeaveRequest { id: string; empId: string; typeId: string; from: string; to: string; days: number; reason?: string; status: 'pending' | 'approved' | 'rejected'; requestedBy: string; requestedAt: string; decidedBy?: string; decidedAt?: string }
export interface EmpChange { at: string; user: string; field: string; from: string; to: string; reason?: string }

/* ---------- Talaan HQ: the business behind Talaan ---------- */
export interface HqInvoice { no: string; month: string; amount: number; status: 'draft' | 'sent' | 'paid' | 'overdue'; due: string; sentAt?: string; paidAt?: string; inXero?: boolean; payments?: Payment[]; lines?: { module: string; employees: number; rate: number; amount: number }[]; vat?: number }
export interface Firm { /** 'firm' = accounting firm serving many employers; 'employer' = a company subscribing directly. */ kind?: 'firm' | 'employer'; billingEmail?: string; id: string; name: string; city: string; plan: 'trial' | 'active' | 'paused'; modules: ModuleKey[]; clients: number; employees: number; users: number; lastActive: string; ai: number; since: string; trialEnds?: string; invoices: HqInvoice[]; live?: boolean; errors7d: number; lateFilings: number }
export interface TicketReply { at: string; by: string; text: string; staff?: boolean }
export interface Ticket { id: string; firmId: string; user: string; userName: string; at: string; subject: string; body: string; category: 'problem' | 'question' | 'request'; priority: 'normal' | 'high'; page: string; clientId?: string; version: string; status: 'open' | 'waiting' | 'solved'; replies: TicketReply[] }
export interface Release { id: string; version: string; date: string; title: string; notes: string; by: string }
export interface Hq { firms: Firm[]; tickets: Ticket[]; releases: Release[]; nextTicket: number; nextInvoice: number }
export const APP_VERSION = '0.9.0';
export type Agency = 'sss' | 'ph' | 'pi' | 'bir';
export interface Remit { generatedAt?: string; uploadedAt?: string; reference?: string; channel?: string; amountPaid?: number; paidAt?: string; receipt?: { name: string; size: number }; note?: string }
export type CheckKey = 'funds' | 'licence' | 'bcp' | 'export' | 'continuity';
export type CheckValue = 'yes' | 'no' | 'unknown';
export interface PartnerCheck { checks: Record<CheckKey, CheckValue>; licence: string; evidence: string; reviewed?: string }
export interface Region { id: string; name: string; nonAgri: number; other: number; wageOrder: string; effective: string; checked?: string; note?: string }
export interface Holiday { date: string; name: string; type: 'regular' | 'special' }
export interface Refs { banks: string[]; regions: Region[]; holidays: Holiday[]; docTypes: string[] }
export interface WatchSource { id: string; agency: string; name: string; url: string; watches: string; every: 'daily' | 'weekly' | 'monthly'; lastChecked?: string; lastChange?: string }
export interface ReviewItem { id: string; sourceId: string; detectedAt: string; summary: string; status: 'open' | 'accepted' | 'dismissed'; entryId?: string; by?: string }
export interface CorpusAdmin { custom: Record<string, unknown>[]; removed: string[]; reviewEveryDays: number; lastCheck?: { at: string; errors: number; warnings: number; user: string } }
export interface Notice { id: string; to: string; at: string; key: string; vars: Record<string, string | number>; route: { page: string; id?: string; step?: number }; read?: boolean }
export interface Email { id: string; at: string; to: string[]; subject: string; body: string; kind: string; clientId?: string; status: 'queued' | 'sent' | 'failed'; by: string }
export interface InvoiceLine { label: string; qty: number; rate: number; amount: number }
export interface Invoice { no: string; clientId: string; month: string; lines: InvoiceLine[]; subtotal: number; vat: number; total: number; issuedAt: string; dueAt: string; status: 'issued' | 'paid'; paidAt?: string; by: string; payments?: Payment[] }
export interface Billing { firmName: string; vatRegistered: boolean; termsDays: number; rates: Rates; invoices: Invoice[]; nextNo: number }
/** A question Ask Tala could not answer from a source, or refused: a person answers it (human in the loop). */
export interface Handoff { id: string; at: string; user: string; question: string; lang: 'en' | 'tl' | 'zh'; reason: string; status: 'open' | 'answered'; answer?: string; answeredBy?: string; answeredAt?: string; forCorpus?: boolean }
export interface State { /** Ask Tala questions handed to a person. */ handoffs?: Handoff[]; /** Payments customers say they made outside Talaan, waiting for staff to confirm. */ claims?: PaymentClaim[]; payItems: PayItem[]; loans: Loan[]; leaveTypes: LeaveType[]; leaveRequests: LeaveRequest[]; empHistory: Record<string, EmpChange[]>; hq: Hq; aiUsage: Record<string, number>; seenRelease?: string; notices: Notice[]; outbox: Email[]; billing: Billing; users: User[]; refs: Refs; corpus: CorpusAdmin; watch: { sources: WatchSource[]; queue: ReviewItem[] }; prefs?: { protect?: boolean; help?: boolean }; remits: Record<string, Remit>; partners: Record<string, PartnerCheck>; v: number; clients: Client[]; employees: Employee[]; runs: Run[]; filings: Record<string, { ref: string; date: string }>; askLog: string[]; activity: Activity[]; notes: Record<string, Note[]> }

export const USERS: User[] = [
  { id: 'maricel', name: 'Maricel Santos', role: 'firmOwner' },
  { id: 'jun', name: 'Jun dela Cruz', role: 'preparer' },
  { id: 'teresita', name: 'Teresita Lim', role: 'client', clientId: 'lim' },
  { id: 'rico', name: 'Rico Santos', role: 'employee', clientId: 'lim', empId: 'lim-3' },
  { id: 'lisa', name: 'Lisa (Talaan HQ)', role: 'talaanAdmin' },
];
export const SEED_REFS: Refs = {
  banks: ['BDO', 'BPI', 'Metrobank', 'UnionBank', 'Landbank', 'PNB', 'Security Bank', 'RCBC', 'China Bank', 'EastWest'],
  // Highest daily non-agriculture floor per region ("other" = lowest tier: agriculture, small retail/service or lower area class).
  // Checked 28 October 2026 against NWPC listings as summarised by SweldoPH (secondary source): confirm each with the RTWPB before live use.
  regions: [
    { id: 'ncr', name: 'NCR (Metro Manila)', nonAgri: 755, other: 718, wageOrder: 'NCR-28', effective: '2026-09-26', checked: '2026-10-28', note: 'NCR-27 (₱25 second tranche) is enjoined; floor before 26 Sep 2026 is contested.' },
    { id: 'car', name: 'CAR (Cordillera)', nonAgri: 505, other: 505, wageOrder: 'CAR-24', effective: '2025-12-30', checked: '2026-10-28' },
    { id: 'r1', name: 'Region I (Ilocos)', nonAgri: 505, other: 505, wageOrder: 'RB 1-24', effective: '2025-11-19', checked: '2026-10-28' },
    { id: 'r2', name: 'Region II (Cagayan Valley)', nonAgri: 500, other: 500, wageOrder: 'RTWPB 2-24', effective: '2025-11-05', checked: '2026-10-28' },
    { id: 'r3', name: 'Region III (Central Luzon)', nonAgri: 600, other: 600, wageOrder: 'RBIII-26', effective: '2026-04-16', checked: '2026-10-28' },
    { id: 'r4a', name: 'Region IV-A (CALABARZON)', nonAgri: 645, other: 550, wageOrder: 'IVA-23', effective: '2026-10-26', checked: '2026-10-28', note: '₱550–₱645 by area and sector.' },
    { id: 'r4b', name: 'Region IV-B (MIMAROPA)', nonAgri: 455, other: 455, wageOrder: 'RB-MIMAROPA-13', effective: '2026-01-01', checked: '2026-10-28' },
    { id: 'r5', name: 'Region V (Bicol)', nonAgri: 455, other: 455, wageOrder: 'RBV-23', effective: '2026-04-08', checked: '2026-10-28' },
    { id: 'r6', name: 'Region VI (Western Visayas)', nonAgri: 550, other: 550, wageOrder: 'RBVI-29', effective: '2025-11-19', checked: '2026-10-28' },
    { id: 'r7', name: 'Region VII (Central Visayas)', nonAgri: 582, other: 542, wageOrder: 'ROVII-27', effective: '2026-10-14', checked: '2026-10-28', note: 'Class A ₱582, Class B ₱542.' },
    { id: 'r8', name: 'Region VIII (Eastern Visayas)', nonAgri: 470, other: 470, wageOrder: 'RB VIII-25', effective: '2026-06-01', checked: '2026-10-28' },
    { id: 'r9', name: 'Region IX (Zamboanga Peninsula)', nonAgri: 464, other: 464, wageOrder: 'RIX-24', effective: '2026-06-01', checked: '2026-10-28' },
    { id: 'r10', name: 'Region X (Northern Mindanao)', nonAgri: 500, other: 500, wageOrder: 'RX-24', effective: '2026-05-01', checked: '2026-10-28' },
    { id: 'r11', name: 'Region XI (Davao)', nonAgri: 540, other: 540, wageOrder: 'RB XI-24', effective: '2026-09-01', checked: '2026-10-28' },
    { id: 'r12', name: 'Region XII (SOCCSKSARGEN)', nonAgri: 460, other: 460, wageOrder: 'RB XII-25', effective: '2025-12-15', checked: '2026-10-28' },
    { id: 'r13', name: 'Region XIII (Caraga)', nonAgri: 475, other: 475, wageOrder: 'RXIII-20', effective: '2026-05-01', checked: '2026-10-28' },
    { id: 'barmm', name: 'BARMM', nonAgri: 436, other: 436, wageOrder: 'BARMM-05', effective: '2026-08-06', checked: '2026-10-28', note: 'Rises to ₱461 on 1 December 2026. Sulu stays under BARMM-04.' },
  ],
  // Proclamation No. 1006 (2026 holidays), checked 19 October 2026. Eid holidays are proclaimed separately.
  holidays: [
    { date: '2026-01-01', name: 'New Year’s Day', type: 'regular' }, { date: '2026-02-17', name: 'Chinese New Year', type: 'special' }, { date: '2026-04-02', name: 'Maundy Thursday', type: 'regular' },
    { date: '2026-04-03', name: 'Good Friday', type: 'regular' }, { date: '2026-04-04', name: 'Black Saturday', type: 'special' },
    { date: '2026-04-09', name: 'Araw ng Kagitingan', type: 'regular' }, { date: '2026-05-01', name: 'Labor Day', type: 'regular' },
    { date: '2026-06-12', name: 'Independence Day', type: 'regular' }, { date: '2026-08-21', name: 'Ninoy Aquino Day', type: 'special' },
    { date: '2026-08-31', name: 'National Heroes Day', type: 'regular' }, { date: '2026-11-01', name: 'All Saints’ Day', type: 'special' }, { date: '2026-11-02', name: 'All Souls’ Day', type: 'special' },
    { date: '2026-11-30', name: 'Bonifacio Day', type: 'regular' }, { date: '2026-12-08', name: 'Feast of the Immaculate Conception', type: 'special' },
    { date: '2026-12-24', name: 'Christmas Eve', type: 'special' }, { date: '2026-12-25', name: 'Christmas Day', type: 'regular' }, { date: '2026-12-30', name: 'Rizal Day', type: 'regular' }, { date: '2026-12-31', name: 'Last day of the year', type: 'special' },
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
    { id: 'cebu', name: 'Cebu Family Clinic', freq: 'monthly', minWage: 582, region: 'r7', workdays: 261, bank: 'UnionBank', xero: true, dueDays: { bir: 10, sss: 28, ph: 15, pi: 20 }, assignee: 'maricel' },
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
  const st: State = { ...seedExtras(today), v: 10, notices: [], outbox: [], billing: { firmName: 'Santos Bookkeeping Services', vatRegistered: true, termsDays: 15, rates: { perRun: 500, perPayslip: 60, perFiling: 250, perNewHire: 150, per2316: 100 }, invoices: [], nextNo: 1 }, clients, employees, runs, filings: {}, askLog: [], activity, notes, remits: {}, partners: {}, users: USERS.map(u => ({ ...u, active: true, email: u.id === 'teresita' ? 'teresita@limtrading.ph' : u.id === 'rico' ? '' : u.id === 'lisa' ? 'lisa@talaan.example' : `${u.id}@santosbookkeeping.ph` })), refs: JSON.parse(JSON.stringify(SEED_REFS)), corpus: { custom: [], removed: [], reviewEveryDays: 30 }, watch: { sources: SEED_SOURCES.map(x => ({ ...x })), queue: [{ id: 'q1', sourceId: 'nwpc', detectedAt: iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2)), summary: 'Wage order page changed (example): check whether any region issued a new wage order.', status: 'open' }] } };
  const prevMonth = iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)).slice(0, 7);
  for (const f of filingsFor(st)) if (f.month < prevMonth) {
    const ref = `${f.kind.toUpperCase()}-${f.month.replace('-', '')}-${f.clientId.slice(0, 3).toUpperCase()}`;
    st.filings[f.key] = { ref, date: iso(f.due) };
    st.remits[f.key] = { generatedAt: iso(f.due), uploadedAt: iso(f.due), reference: ref, channel: 'Bank online', amountPaid: f.expected, paidAt: iso(f.due), receipt: { name: `${ref}.pdf`, size: 48211 } };
  }
  seedPeople(st, today);
  seedFirmInvoices(st, today);
  return st;
}

/* ---------- Seed data for the Talaan modules ---------- */
export const DEFAULT_PAY_ITEMS: PayItem[] = [
  { id: 'rice', name: 'Rice subsidy', kind: 'deMinimis' }, { id: 'uniform', name: 'Uniform and clothing allowance', kind: 'deMinimis' },
  { id: 'meal', name: 'Meal allowance', kind: 'allowance' }, { id: 'transpo', name: 'Transportation allowance', kind: 'allowance' },
  { id: 'hmo', name: 'HMO dependant share', kind: 'deduction' }, { id: 'coop', name: 'Cooperative savings', kind: 'deduction' },
  { id: 'fuel', name: 'Fuel reimbursement', kind: 'reimbursement' }, { id: 'training', name: 'Training reimbursement', kind: 'reimbursement' },
];
export const DEFAULT_LEAVE_TYPES: LeaveType[] = [
  { id: 'vl', name: 'Vacation leave (includes 5-day service incentive leave)', days: 10, paid: true, convertible: true },
  { id: 'sl', name: 'Sick leave', days: 5, paid: true, convertible: false },
  { id: 'lwop', name: 'Leave without pay', days: 0, paid: false, convertible: false },
  { id: 'pat', name: 'Paternity leave', days: 7, paid: true, convertible: false },
  { id: 'solo', name: 'Solo parent leave', days: 7, paid: true, convertible: false },
  { id: 'mat', name: 'Maternity leave (RA 11210: 105 days; solo mother 120; SSS benefit plus salary differential)', days: 105, paid: true, convertible: false },
  { id: 'women', name: 'Special leave for women after gynaecological surgery (RA 9710: up to 2 months)', days: 60, paid: true, convertible: false },
  { id: 'vawc', name: 'Leave for victims of violence against women and children (RA 9262: 10 days)', days: 10, paid: true, convertible: false },
];
function seedExtras(today: Date): Pick<State, 'payItems' | 'loans' | 'leaveTypes' | 'leaveRequests' | 'empHistory' | 'hq' | 'aiUsage'> {
  const d = (n: number) => iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + n));
  const m = (n: number) => iso(new Date(today.getFullYear(), today.getMonth() + n, 1)).slice(0, 7);
  const inv = (no: string, month: string, amount: number, status: HqInvoice['status'], dueIn: number, part = 0): HqInvoice => ({ no, month, amount, status, due: d(dueIn), ...(status !== 'draft' ? { sentAt: d(dueIn - 15), inXero: true } : {}),
    ...(status === 'paid' ? { paidAt: d(Math.min(0, dueIn - 3)), payments: [{ id: `p-${no}`, date: d(Math.min(0, dueIn - 3)), amount, method: 'bank', reference: `BDO-${no.slice(4)}`, by: 'lisa' }] } : part ? { payments: [{ id: `p-${no}`, date: d(Math.min(0, dueIn - 10)), amount: part, method: 'gcash', reference: `GC-${no.slice(4)}`, by: 'lisa' }] } : {}) });
  return {
    payItems: DEFAULT_PAY_ITEMS.map(x => ({ ...x, active: true })), loans: [], leaveTypes: DEFAULT_LEAVE_TYPES.map(x => ({ ...x, active: true })), leaveRequests: [], empHistory: {},
    aiUsage: { [m(0)]: 23, [m(-1)]: 61 },
    hq: { nextTicket: 1027, nextInvoice: 241, releases: [
      { id: 'r090', version: '0.9.0', date: d(0), title: 'New look and modules', notes: 'New gold-and-navy look and logo. Modules: Payroll, Compliance, Books, HR, AI and Analytics. New: leave, loans, pay templates, bonus and final pay runs, deadline calendar, dashboards and in-app support.', by: 'lisa' },
      { id: 'r084', version: '0.8.4', date: d(-12), title: 'Approval workflow and billing', notes: 'Send pay runs for approval, statements of account for clients, email notices.', by: 'lisa' },
    ], tickets: [
      { id: 't1026', firmId: 'santos', user: 'jun', userName: 'Jun dela Cruz', at: new Date(today.getTime() - 26 * 36e5).toISOString(), subject: 'Metrobank says the bank file has the wrong date format', body: 'Uploaded the payroll file for Santos Hardware and Metrobank rejected it: date must be MMDDYYYY.', category: 'problem', priority: 'high', page: 'run', clientId: 'santos', version: '0.8.4', status: 'waiting',
        replies: [{ at: new Date(today.getTime() - 20 * 36e5).toISOString(), by: 'Lisa (Talaan HQ)', text: 'Thanks Jun. In the client settings, Bank file format → Date, choose MMDDYYYY and download again. Can you send the bank’s sample file so we can mark the layout as verified?', staff: true }] },
      { id: 't1019', firmId: 'vhub', user: 'x', userName: 'Grace Tan (Visayas Accounting Hub)', at: new Date(today.getTime() - 8 * 864e5).toISOString(), subject: 'Can we import the Sprout payroll register?', body: 'Most of our clients stay on Sprout. We only need the government files.', category: 'question', priority: 'normal', page: 'files', version: '0.8.4', status: 'solved',
        replies: [{ at: new Date(today.getTime() - 7 * 864e5).toISOString(), by: 'Lisa (Talaan HQ)', text: 'Yes: Compliance → Import payroll. Download the register from Sprout as CSV and upload it there.', staff: true }] },
    ], firms: [
      { id: 'santos', kind: 'firm', name: 'Santos Bookkeeping Services', city: 'Quezon City', plan: 'active', modules: [...MODULES], clients: 0, employees: 0, users: 0, lastActive: d(0), ai: 0, since: d(-120), live: true, errors7d: 1, lateFilings: 0,
        invoices: [inv('TAL-0231', m(-2), 3270, 'paid', -32), inv('TAL-0236', m(-1), 3410, 'sent', 6)] },
      { id: 'dva', kind: 'firm', name: 'Dela Vega and Partners (sample)', city: 'Makati', plan: 'active', modules: [...MODULES], clients: 12, employees: 214, users: 6, lastActive: d(-1), ai: 182, since: d(-300), errors7d: 0, lateFilings: 1,
        invoices: [inv('TAL-0229', m(-2), 41088, 'paid', -32), inv('TAL-0234', m(-1), 41088, 'paid', 6)] },
      { id: 'vhub', kind: 'firm', name: 'Visayas Accounting Hub (sample)', city: 'Cebu City', plan: 'active', modules: ['compliance', 'books', 'analytics'], clients: 30, employees: 640, users: 9, lastActive: d(-9), ai: 0, since: d(-200), errors7d: 4, lateFilings: 3,
        invoices: [inv('TAL-0230', m(-2), 46720, 'paid', -32), inv('TAL-0235', m(-1), 46720, 'overdue', -4)] },
      { id: 'mcl', kind: 'employer', name: 'Magsaysay Cold Chain Inc. (sample, direct employer)', city: 'Pasig', plan: 'active', modules: ['payroll', 'compliance', 'hr'], clients: 1, employees: 58, users: 3, lastActive: d(0), ai: 0, since: d(-75), errors7d: 0, lateFilings: 0,
        invoices: [inv('TAL-0232', m(-2), 8526, 'paid', -32), inv('TAL-0237', m(-1), 8526, 'sent', 6, 4000)] },
      { id: 'npb', kind: 'firm', name: 'Northpoint Bookkeepers (trial)', city: 'Baguio', plan: 'trial', modules: ['payroll', 'compliance'], clients: 2, employees: 19, users: 2, lastActive: d(-2), ai: 14, since: d(-16), trialEnds: d(14), errors7d: 0, lateFilings: 0, invoices: [] },
    ] },
  };
}
/** Sample invoices from the firm to its client employers, with full, part and no payment, so Billing and the client's Invoices page have something to show. */
function seedFirmInvoices(st: State, today: Date) {
  const d = (n: number) => iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + n));
  const mo = (n: number) => iso(new Date(today.getFullYear(), today.getMonth() + n, 1)).slice(0, 7);
  const R = st.billing.rates;
  const mk = (no: number, clientId: string, month: string, runs: number, payslips: number, filings: number, issued: number, payments: Payment[] = []): Invoice => {
    const lines = [{ label: 'Pay runs processed', qty: runs, rate: R.perRun, amount: runs * R.perRun }, { label: 'Payslips', qty: payslips, rate: R.perPayslip, amount: payslips * R.perPayslip }, { label: 'Government filings', qty: filings, rate: R.perFiling, amount: filings * R.perFiling }];
    const subtotal = lines.reduce((a, l) => a + l.amount, 0); const vat = r2(subtotal * 0.12); const total = r2(subtotal + vat);
    const paid = payments.reduce((a, p) => a + p.amount + (p.cwt ?? 0), 0) >= total - 0.005;
    return { no: `SOA-${month.replace('-', '')}-${String(no).padStart(4, '0')}`, clientId, month, lines, subtotal, vat, total, issuedAt: d(issued), dueAt: d(issued + st.billing.termsDays), status: paid ? 'paid' : 'issued', ...(paid ? { paidAt: payments[payments.length - 1].date } : {}), by: 'maricel', payments };
  };
  const lim = mk(1, 'lim', mo(-2), 2, 14, 4, -50); lim.payments = [{ id: 'sp1', date: d(-38), amount: r2(lim.total - lim.subtotal * 0.02), cwt: r2(lim.subtotal * 0.02), method: 'bank', reference: 'BDO-778120', by: 'maricel' }]; lim.status = 'paid'; lim.paidAt = d(-38);
  const santos = mk(2, 'santos', mo(-1), 2, 6, 4, -20); santos.payments = [{ id: 'sp2', date: d(-6), amount: 2000, method: 'gcash', reference: 'GC-5521904', by: 'jun' }];
  const mabuhay = mk(3, 'mabuhay', mo(-1), 2, 8, 4, -18);
  const cebu = mk(4, 'cebu', mo(-2), 1, 4, 4, -64);
  const lim2 = mk(5, 'lim', mo(-1), 2, 14, 4, -12);
  st.billing.invoices = [lim2, santos, mabuhay, lim, cebu]; st.billing.nextNo = 6;
}
function seedPeople(st: State, today: Date) {
  const emp = (id: string) => st.employees.find(e => e.id === id)!;
  const dept: Record<string, string> = { 'mabuhay-1': 'Bakery', 'mabuhay-2': 'Bakery', 'mabuhay-3': 'Store', 'mabuhay-4': 'Delivery', 'santos-1': 'Store', 'santos-2': 'Store', 'santos-3': 'Warehouse',
    'lim-1': 'Admin', 'lim-2': 'Logistics', 'lim-3': 'Logistics', 'lim-4': 'Admin', 'lim-5': 'Sales', 'lim-6': 'Admin', 'lim-7': 'Admin', 'cebu-1': 'Clinical', 'cebu-2': 'Clinical', 'cebu-3': 'Clinical', 'cebu-4': 'Front office' };
  st.employees.forEach(e => { e.department = dept[e.id] ?? 'Admin'; });
  st.clients.forEach(c => { c.departments = [...new Set(st.employees.filter(e => e.clientId === c.id).map(e => e.department!))]; c.modules = [...MODULES]; c.payrollSource = 'talaan'; });
  const per = st.clients.find(c => c.id === 'lim')!.freq === 'semi';
  st.employees.filter(e => e.clientId === 'lim').forEach(e => { e.template = [{ itemId: 'rice', amount: per ? 1000 : 2000 }]; });
  emp('lim-4').template!.push({ itemId: 'transpo', amount: 1500 }); emp('lim-5').template!.push({ itemId: 'transpo', amount: 2000 }, { itemId: 'hmo', amount: 450 });
  emp('mabuhay-4').template = [{ itemId: 'fuel', amount: 800 }];
  const limCur = currentPeriod('semi', today), limPrev = shiftPeriod(limCur, 'semi', -1);
  st.loans = [
    { id: 'ln1', empId: 'lim-2', kind: 'sss', principal: 20000, perPeriod: 916.5, start: limPrev, note: 'SSS salary loan', createdAt: iso(today) },
    { id: 'ln2', empId: 'lim-6', kind: 'cashAdvance', principal: 5000, perPeriod: 1000, start: limPrev, note: 'Cash advance for school fees', createdAt: iso(today) },
    { id: 'ln3', empId: 'mabuhay-2', kind: 'pagibig', principal: 15000, perPeriod: 600, start: shiftPeriod(currentPeriod('semi', today), 'semi', 0), note: 'Pag-IBIG multi-purpose loan', createdAt: iso(today) },
  ];
  const pp = periodInfo(limPrev); const lwopDay = iso(new Date(pp.start.getFullYear(), pp.start.getMonth(), pp.start.getDate() + 3));
  const slDay = iso(new Date(pp.start.getFullYear(), pp.start.getMonth(), pp.start.getDate() + 6));
  const next = iso(new Date(today.getFullYear(), today.getMonth() + 1, 9)), next2 = iso(new Date(today.getFullYear(), today.getMonth() + 1, 10));
  const at = new Date(today.getTime() - 3 * 864e5).toISOString();
  st.leaveRequests = [
    { id: 'lv1', empId: 'lim-6', typeId: 'lwop', from: lwopDay, to: lwopDay, days: 1, reason: 'Family matter', status: 'approved', requestedBy: 'jun', requestedAt: at, decidedBy: 'teresita', decidedAt: at },
    { id: 'lv2', empId: 'lim-1', typeId: 'sl', from: slDay, to: slDay, days: 1, reason: 'Fever', status: 'approved', requestedBy: 'jun', requestedAt: at, decidedBy: 'teresita', decidedAt: at },
    { id: 'lv3', empId: 'lim-3', typeId: 'vl', from: next, to: next2, days: 2, reason: 'Province trip', status: 'pending', requestedBy: 'rico', requestedAt: new Date(today.getTime() - 864e5).toISOString() },
  ];
  st.empHistory = { 'lim-5': [{ at: new Date(today.getFullYear(), today.getMonth() - 2, 1, 10).toISOString(), user: 'maricel', field: 'monthlyRate', from: '42000', to: '45000', reason: 'Annual increase approved by Ms. Lim' }] };
  // A client that keeps its own payroll system and uses Talaan only for government filings (bring your own payroll).
  const dv: Client = { id: 'davao', name: 'Davao Fresh Logistics', freq: 'monthly', minWage: 540, workdays: 313, bank: 'Metrobank', xero: false, dueDays: { bir: 10, sss: 28, ph: 15, pi: 15 }, assignee: 'jun',
    ids: { sss: '03-9876543-2', philhealth: '20-765432109-8', pagibig: '2011-4455-6677', tin: '007-654-321-000', rdo: '113', address: 'Davao City' }, region: 'r11', active: true,
    contacts: [{ name: 'Ramil Dizon', email: 'ramil@davaofresh.example.ph', billing: true }], notify: { approved: true, remitted: true, invoice: true },
    modules: ['compliance', 'books', 'analytics'], payrollSource: 'external', externalSystem: 'Sprout Solutions', departments: ['Warehouse', 'Drivers', 'Office'] };
  st.clients.push(dv);
  const dEmps = [E('davao', 1, 'Ramil Dizon', 'Operations manager', 42000, 313, { department: 'Office' }), E('davao', 2, 'Nestor Abad', 'Driver', 16500, 313, { department: 'Drivers' }),
    E('davao', 3, 'Marites Lagman', 'Warehouse lead', 19000, 313, { department: 'Warehouse' }), E('davao', 4, 'Jomar Villareal', 'Helper', 14500, 313, { department: 'Warehouse' })];
  dEmps.forEach((e, i) => { e.hireDate = `202${i}-03-01`; e.birthDate = `199${i}-06-1${i}`; }); st.employees.push(...dEmps);
  const lm = iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)).slice(0, 7);
  st.runs.push({ id: `davao-${lm}-M-imported`, clientId: 'davao', period: `${lm}-M`, status: 'approved', kind: 'imported', source: 'Sprout Solutions', label: 'Imported from Sprout Solutions', hours: {}, reasons: {}, preparedBy: 'jun', approvedBy: 'jun', approvedAt: iso(today),
    lines: dEmps.map(e => computeLine(e, EMPTY_HOURS, 'monthly', 540)) });
  // The seeded Lim Trading draft: apply templates, loans and the approved leave, as Talaan does when a run is started.
  const draft = st.runs.find(r => r.clientId === 'lim' && r.status === 'draft');
  if (draft) { draft.hours['lim-6'] = { ...draft.hours['lim-6'], absentDays: 0 }; Object.assign(draft, refreshRun(st, draft)); }
}

/** Fills in a regular run from pay templates, loan schedules and approved unpaid leave. Manual entries stay; template items are recalculated. */
export function refreshRun(s: State, run: Run): Pick<Run, 'hours' | 'loanApplied' | 'leaveApplied' | 'tplDeduction'> {
  const c = s.clients.find(x => x.id === run.clientId)!; const { start, end } = periodInfo(run.period);
  const hours: Record<string, Hours> = {}; const loanApplied: Record<string, number> = {}; const leaveApplied: string[] = []; const tplDeduction: Record<string, number> = {};
  const prevLoan = run.loanApplied ?? {}; const prevLeave = new Set(run.leaveApplied ?? []);
  for (const e of s.employees.filter(x => x.clientId === run.clientId && inPeriod(x, run.period))) {
    const h: Hours = { ...EMPTY_HOURS, ...(run.hours[e.id] ?? {}) };
    // take back what an earlier refresh added, so refreshing twice does not double up
    for (const l of s.loans.filter(l => l.empId === e.id && prevLoan[l.id])) { const k = l.kind === 'sss' ? 'sssLoan' : l.kind === 'pagibig' ? 'pagibigLoan' : 'otherDeduction'; h[k] = r2(Math.max(0, h[k] - prevLoan[l.id])); }
    for (const q of s.leaveRequests.filter(q => q.empId === e.id && prevLeave.has(q.id))) h.absentDays = r2(Math.max(0, h.absentDays - leaveDaysIn(q, start, end)));
    const tpl = (k: PayItemKind) => r2((e.template ?? []).filter(t => s.payItems.find(p => p.id === t.itemId && p.active !== false)?.kind === k).reduce((a, t) => a + t.amount, 0));
    h.taxableAllowance = tpl('allowance'); h.deMinimis = tpl('deMinimis'); h.reimbursement = tpl('reimbursement');
    h.otherDeduction = r2(Math.max(0, h.otherDeduction - (run.tplDeduction?.[e.id] ?? 0)) + tpl('deduction')); tplDeduction[e.id] = tpl('deduction');
    for (const l of s.loans.filter(l => l.empId === e.id && !l.closed && l.start <= run.period)) {
      const amt = r2(Math.min(l.perPeriod, loanBalance(s, l, run.id))); if (amt <= 0) continue;
      const k = l.kind === 'sss' ? 'sssLoan' : l.kind === 'pagibig' ? 'pagibigLoan' : 'otherDeduction'; h[k] = r2(h[k] + amt); loanApplied[l.id] = amt;
    }
    for (const q of s.leaveRequests.filter(q => q.empId === e.id && q.status === 'approved')) {
      const lt = s.leaveTypes.find(t => t.id === q.typeId); const n = leaveDaysIn(q, start, end); if (!n) continue;
      leaveApplied.push(q.id); if (lt && !lt.paid) h.absentDays = r2(h.absentDays + n);
    }
    hours[e.id] = h;
  }
  void c;
  return { hours, loanApplied, leaveApplied, tplDeduction };
}
/** Days of a leave request that fall inside a cutoff (calendar days, capped at the days requested). */
export function leaveDaysIn(q: LeaveRequest, start: Date, end: Date) {
  const a = q.from > iso(start) ? q.from : iso(start), b = q.to < iso(end) ? q.to : iso(end); if (a > b) return 0;
  const span = daysBetween(new Date(q.from + 'T00:00'), new Date(q.to + 'T00:00')) + 1;
  return r2(Math.min(q.days, (daysBetween(new Date(a + 'T00:00'), new Date(b + 'T00:00')) + 1) * (q.days / span)));
}
export function loanBalance(s: State, l: Loan, excludeRun?: string) {
  const paid = s.runs.filter(r => r.status === 'approved' && r.id !== excludeRun).reduce((a, r) => a + (r.loanApplied?.[l.id] ?? 0), 0);
  return r2(Math.max(0, l.principal - paid));
}
export function leaveBalance(s: State, empId: string, typeId: string, year: number) {
  const lt = s.leaveTypes.find(t => t.id === typeId); const used = s.leaveRequests.filter(q => q.empId === empId && q.typeId === typeId && q.status === 'approved' && q.from.startsWith(String(year))).reduce((a, q) => a + q.days, 0);
  const pending = s.leaveRequests.filter(q => q.empId === empId && q.typeId === typeId && q.status === 'pending' && q.from.startsWith(String(year))).reduce((a, q) => a + q.days, 0);
  return { entitled: lt?.days ?? 0, used: r2(used), pending: r2(pending), left: r2(Math.max(0, (lt?.days ?? 0) - used)) };
}
export const modulesOf = (c: Client): ModuleKey[] => c.modules ?? (c.payrollSource === 'external' ? ['compliance', 'books', 'analytics'] : [...MODULES]);
export const hasModule = (c: Client, m: ModuleKey) => modulesOf(c).includes(m) && (m !== 'payroll' || c.payrollSource !== 'external');
/** 13th month and other benefits already paid to an employee this year (for the ₱90,000 limit). */
export function ytdBenefits(s: State, empId: string, year: string, excludeRun?: string) {
  return r2(s.runs.filter(r => r.status === 'approved' && r.id !== excludeRun && r.period.startsWith(year)).reduce((a, r) => a + (r.lines ?? []).filter(l => l.empId === empId).reduce((b, l) => b + (l.bonus ?? 0), 0), 0));
}
/** Pro-rated 13th month pay: basic pay earned this year ÷ 12, less 13th month already paid. */
export function thirteenthDue(s: State, e: Employee, year: string, upto?: string) {
  const runs = s.runs.filter(r => r.status === 'approved' && r.period.startsWith(year) && (!upto || r.period <= upto));
  const basic = runs.reduce((a, r) => a + (r.lines ?? []).filter(l => l.empId === e.id).reduce((b, l) => b + l.basic - l.absences, 0), 0);
  return { basicEarned: r2(basic), due: r2(Math.max(0, basic / 12 - ytdBenefits(s, e.id, year))) };
}
export function yearToDate(s: State, empId: string, year: string, excludeRun?: string) {
  return s.runs.filter(r => r.status === 'approved' && r.id !== excludeRun && r.period.startsWith(year)).flatMap(r => (r.lines ?? []).filter(l => l.empId === empId));
}
export { yearEnd };

/** Brings data saved by an earlier version (v8) up to date without losing it. */
export function migrate(old: State): State {
  const x = seedExtras(new Date());
  const s: State = { ...x, ...old, v: 10 };
  if (!s.hq) s.hq = x.hq;
  // Customers default to accounting firms. Existing invoice numbers are kept as issued (they are in Xero and with customers); new ones use TAL-.
  s.hq = { ...s.hq, firms: s.hq.firms.map(f => ({ ...f, kind: f.kind ?? 'firm' })) };
  // New statutory leave types (Oct 2026) are added for firms that started with the older list.
  if (s.leaveTypes) for (const lt of DEFAULT_LEAVE_TYPES) if (!s.leaveTypes.some(x => x.id === lt.id)) s.leaveTypes = [...s.leaveTypes, { ...lt, active: true }];
  // Wage table refreshed 28 Oct 2026: replace regions still marked "To confirm" and add missing ones; firm edits are kept.
  if (s.refs?.regions) { const mine = new Map(s.refs.regions.filter(r => !/to confirm/i.test(r.wageOrder)).map(r => [r.id, r]));
    const seedIds = new Set(SEED_REFS.regions.map(r => r.id));
    s.refs = { ...s.refs, regions: [...SEED_REFS.regions.map(r => mine.get(r.id) && (mine.get(r.id)!.effective >= r.effective) ? mine.get(r.id)! : r), ...s.refs.regions.filter(r => !seedIds.has(r.id))] }; }
  s.clients = s.clients.map(c => ({ ...c, modules: c.modules ?? [...MODULES], payrollSource: c.payrollSource ?? 'talaan', departments: c.departments ?? ['Operations', 'Admin'] }));
  // A client below its region's lowest new floor moves up to that floor (never down); a higher tier stays the firm's call,
  // so the firm owner gets a review task (see wageReviewClients) instead of an automatic change.
  s.clients = s.clients.map(c => { const r = s.refs?.regions?.find(x => x.id === c.region); return r && c.minWage < r.other ? { ...c, minWage: r.other } : c; });
  if (!s.users.some(u => u.role === 'talaanAdmin')) s.users = [...s.users, { id: 'lisa', name: 'Lisa (Talaan HQ)', role: 'talaanAdmin', active: true, email: 'lisa@talaan.example' }];
  return s;
}

/** Clients whose minimum wage is below their region's highest current floor: the firm owner confirms the right tier. */
export function wageReviewClients(s: State) {
  return s.clients.filter(c => c.active !== false).map(c => ({ c, r: s.refs.regions.find(x => x.id === c.region) })).filter(x => x.r && x.c.minWage < x.r.nonAgri);
}

/* ---------- Derived data ---------- */
/** An employee belongs in a cutoff only if hired on or before its last day and not separated before its first day. */
export function inPeriod(e: Employee, period: string) {
  const { start, end } = periodInfo(period);
  return e.active && (!e.hireDate || e.hireDate <= iso(end)) && (!e.separationDate || e.separationDate >= iso(start));
}
export function linesFor(s: State, run: Run) {
  if ((run.status === 'approved' || runKind(run) === 'imported') && run.lines) return run.lines;
  const c = s.clients.find(x => x.id === run.clientId)!; const kind = runKind(run); const year = run.period.slice(0, 4);
  // An employee with a final pay run in this cutoff is paid there, not in the regular run.
  const leavers = new Set(kind === 'regular' ? s.runs.filter(r => r.clientId === run.clientId && r.period === run.period && runKind(r) === 'final').flatMap(r => r.empIds ?? []) : []);
  const emps = run.empIds ? s.employees.filter(e => run.empIds!.includes(e.id)) : s.employees.filter(e => e.clientId === run.clientId && inPeriod(e, run.period) && !leavers.has(e.id));
  return emps.map(e => computeLine(e, run.hours[e.id] ?? EMPTY_HOURS, c.freq, c.minWage, { offCycle: kind === 'bonus' || kind === 'reimbursement', ytdBenefits: ytdBenefits(s, e.id, year, run.id) }));
}
export { totals as totalsOf };
export function prevNetFor(s: State, run: Run) {
  if (!isRegular(run)) return {} as Record<string, number>;
  const prev = s.runs.filter(r => r.clientId === run.clientId && r.status === 'approved' && isRegular(r) && r.period < run.period).sort((a, b) => b.period.localeCompare(a.period))[0];
  return Object.fromEntries((prev?.lines ?? []).map(l => [l.empId, l.net]));
}
export function checksFor(s: State, run: Run) {
  const c = s.clients.find(x => x.id === run.clientId)!;
  const lines = linesFor(s, run);
  const emps = s.employees.filter(e => e.clientId === run.clientId && (run.status === 'approved' || run.empIds ? lines.some(l => l.empId === e.id) : inPeriod(e, run.period)));
  return runChecks(emps, linesFor(s, run), run.hours, c.freq, c.minWage, prevNetFor(s, run));
}

export type FilingKind = 'bir' | 'sss' | 'ph' | 'pi';
/**
 * Suggested monthly due days from each agency's published schedule (checked 28 Oct 2026; confirm in each portal):
 * BIR 1601-C manual/eBIRForms by the 10th (eFPS 11th–15th by group); SSS by the last day of the following month;
 * PhilHealth EPRS 11th–15th if the PEN ends in 0–4, 16th–20th if 5–9; Pag-IBIG by employer name: A–D 10th–14th,
 * E–L 15th–19th, M–Q 20th–24th, R–Z and numbers 25th to month end. 31 means the last day of the month.
 */
export function agencyDueDays(ids: Partial<EmployerIds> | undefined, employerName: string): Client['dueDays'] {
  const pen = (ids?.philhealth ?? '').replace(/\D/g, ''); const last = pen ? Number(pen[pen.length - 1]) : 0;
  const first = employerName.trim().toUpperCase()[0] ?? 'Z';
  const pi = /[A-D]/.test(first) ? 14 : /[E-L]/.test(first) ? 19 : /[M-Q]/.test(first) ? 24 : 31;
  return { bir: 10, sss: 31, ph: last <= 4 ? 15 : 20, pi };
}
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
    for (const r of s.runs.filter(r => r.clientId === c.id && r.status === 'draft' && runKind(r) !== 'imported')) {
      const due = periodInfo(r.period).payDate; tasks.push({ clientId: c.id, urgency: urg(due), due, kind: 'approve', runId: r.id, period: r.period });
    }
    const cur = currentPeriod(c.freq, today);
    if (hasModule(c, 'payroll') && !s.runs.some(r => r.clientId === c.id && r.period === cur && isRegular(r))) {
      const due = periodInfo(cur).payDate; tasks.push({ clientId: c.id, urgency: urg(due), due, kind: 'start', period: cur });
    }
  }
  for (const f of filingsFor(s).filter(f => !f.filed)) tasks.push({ clientId: f.clientId, urgency: urg(f.due), due: f.due, kind: 'file', filing: f });
  return tasks.sort((a, b) => a.due.getTime() - b.due.getTime());
}

export { totals };
