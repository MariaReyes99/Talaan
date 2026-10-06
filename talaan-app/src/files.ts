import type { Employee, Line } from './engine';
import { totals, r2 } from './engine';
/**
 * Talaan export files. Columns follow each agency's data, but the exact upload
 * layout must be mapped to the current official template before real use.
 */
const csv = (rows: (string | number)[][]) => '\uFEFF' + rows.map(r => r.map(c => {
  const s = String(c); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}).join(',')).join('\r\n');
const sumBy = (lines: Line[]) => {
  const m = new Map<string, Line[]>(); lines.forEach(l => m.set(l.empId, [...(m.get(l.empId) ?? []), l])); return m;
};
const add = (ls: Line[], k: keyof Line) => r2(ls.reduce((a, l) => a + (l[k] as number), 0));
const split = (n: string) => { const p = n.trim().split(/\s+/); return { last: p.slice(-1)[0], first: p.slice(0, -1).join(' ') }; };

export function sssFile(lines: Line[], emps: Employee[], month: string) {
  const rows: (string | number)[][] = [['Applicable month', 'SSS number', 'Last name', 'First name', 'Monthly salary credit', 'Employee share', 'Employer share', 'EC', 'Total']];
  for (const [id, ls] of sumBy(lines)) { const e = emps.find(x => x.id === id)!; const n = split(e.name);
    const ee = add(ls, 'sssEE'), er = add(ls, 'sssER'), ec = add(ls, 'ec');
    rows.push([month, e.sss, n.last, n.first, ls[0].msc, ee, er, ec, r2(ee + er + ec)]); }
  return csv(rows);
}
export function phFile(lines: Line[], emps: Employee[], month: string) {
  const rows: (string | number)[][] = [['Applicable month', 'PhilHealth number', 'Last name', 'First name', 'Monthly basic salary', 'Employee share', 'Employer share', 'Total']];
  for (const [id, ls] of sumBy(lines)) { const e = emps.find(x => x.id === id)!; const n = split(e.name); const ee = add(ls, 'phEE'), er = add(ls, 'phER');
    rows.push([month, e.philhealth, n.last, n.first, e.monthlyRate, ee, er, r2(ee + er)]); }
  return csv(rows);
}
export function piFile(lines: Line[], emps: Employee[], month: string) {
  const rows: (string | number)[][] = [['Applicable month', 'Pag-IBIG MID', 'Last name', 'First name', 'Monthly compensation', 'Employee share', 'Employer share', 'Loan amortisation', 'Total']];
  for (const [id, ls] of sumBy(lines)) { const e = emps.find(x => x.id === id)!; const n = split(e.name); const ee = add(ls, 'piEE'), er = add(ls, 'piER'), ln = add(ls, 'pagibigLoan');
    rows.push([month, e.pagibig, n.last, n.first, e.monthlyRate, ee, er, ln, r2(ee + er + ln)]); }
  return csv(rows);
}
export function birFile(lines: Line[], month: string, clientName: string) {
  const t = totals(lines);
  const mweComp = r2(lines.filter(l => l.mwe).reduce((a, l) => a + l.gross - l.taxableAllowance, 0));
  const contrib = r2(t.sssEE + t.phEE + t.piEE);
  return csv([
    ['BIR Form 1601-C data (prototype)', clientName, month], [],
    ['Line', 'Description', 'Amount (PHP)'],
    ['14', 'Total amount of compensation', t.gross],
    ['16A', 'Statutory minimum wage (MWEs)', mweComp],
    ['16B', 'Holiday, overtime, night differential and hazard pay (MWEs)', 0],
    ['18', 'De minimis benefits', t.deMinimis],
    ['19', 'SSS, GSIS, PHIC, HDMF and union dues (employee share)', contrib],
    ['21', 'Total non-taxable compensation', r2(mweComp + t.deMinimis + contrib)],
    ['22', 'Total taxable compensation', t.taxable],
    ['25', 'Total taxes withheld', t.wht],
    [], ['Note', 'Line numbers follow the 1601-C layout as understood; confirm against the current form before filing.'],
  ]);
}
export function bankFile(lines: Line[], emps: Employee[], payDate: string, bank: string) {
  const ls = lines.filter(l => (emps.find(x => x.id === l.empId)?.payout ?? 'bank') === 'bank');
  return csv([['Bank', bank], ['Credit date', payDate], [], ['Account number', 'Employee name', 'Amount'],
    ...ls.map(l => { const e = emps.find(x => x.id === l.empId)!; return [e.bankAccount.replace(/\D/g, ''), e.name, l.net.toFixed(2)]; }),
    [], ['Total', '', r2(ls.reduce((a, l) => a + l.net, 0)).toFixed(2)]]);
}
/** E-wallet bulk payout list (GCash or Maya business portals). Map to the portal's template before upload. */
export function payoutFile(lines: Line[], emps: Employee[], wallet: 'gcash' | 'maya', note: string) {
  const ls = lines.filter(l => emps.find(x => x.id === l.empId)?.payout === wallet);
  return csv([['Mobile number', 'Recipient name', 'Amount', 'Note'], ...ls.map(l => { const e = emps.find(x => x.id === l.empId)!;
    return [e.mobile!.replace(/\D/g, ''), e.name, l.net.toFixed(2), note]; })]);
}
/** Xero manual journal import file: debits positive, credits negative. Imports as a draft in Xero. */
export function xeroJournalCsv(rows: { narration: string; date: string; lines: [string, number, number][]; codes: (k: string) => string }[], label: (k: string) => string) {
  const out: (string | number)[][] = [['*Narration', '*Date', 'Description', '*AccountCode', '*TaxRate', '*Amount']];
  for (const j of rows) for (const [k, dr, cr] of j.lines) out.push([j.narration, j.date, label(k), j.codes(k), 'Tax Exempt', r2(dr - cr).toFixed(2)]);
  return csv(out);
}
/** Generic journal file for QuickBooks Online, Juan or other accounting apps (debit and credit columns). */
export function genericJournalCsv(rows: { no: string; narration: string; date: string; lines: [string, number, number][]; codes: (k: string) => string }[], label: (k: string) => string) {
  const out: (string | number)[][] = [['Journal No', 'Journal Date', 'Account Code', 'Account Name', 'Debit', 'Credit', 'Description']];
  for (const j of rows) for (const [k, dr, cr] of j.lines) out.push([j.no, j.date, j.codes(k), label(k), dr ? dr.toFixed(2) : '', cr ? cr.toFixed(2) : '', j.narration]);
  return csv(out);
}
export const EMP_COLUMNS = ['Client', 'Name', 'Position', 'Monthly rate', 'TIN', 'SSS', 'PhilHealth', 'Pag-IBIG', 'Bank account', 'Pay by', 'Mobile'];
export function employeesCsv(emps: Employee[], clientName: (id: string) => string) {
  return csv([EMP_COLUMNS, ...emps.map(e => [clientName(e.clientId), e.name, e.position, e.monthlyRate.toFixed(2), e.tin, e.sss, e.philhealth, e.pagibig, e.bankAccount, e.payout ?? 'bank', e.mobile ?? ''])]);
}
export function registerCsv(rows: { client: string; period: string; lines: Line[] }[], emps: Employee[]) {
  const head = ['Client', 'Cutoff', 'Employee', 'Basic', 'Absences', 'Overtime', 'Night differential', 'Holiday', 'Special day', 'Rest day', 'Taxable allowance', 'De minimis', 'Gross',
    'SSS EE', 'PhilHealth EE', 'Pag-IBIG EE', 'Withholding tax', 'SSS loan', 'Pag-IBIG loan', 'Other deduction', 'Net pay', 'SSS ER', 'EC', 'PhilHealth ER', 'Pag-IBIG ER'];
  const out: (string | number)[][] = [head];
  for (const r of rows) for (const l of r.lines) out.push([r.client, r.period, emps.find(e => e.id === l.empId)?.name ?? l.empId, l.basic, l.absences, l.ot, l.nd, l.holiday, l.special, l.restDay,
    l.taxableAllowance, l.deMinimis, l.gross, l.sssEE, l.phEE, l.piEE, l.wht, l.sssLoan, l.pagibigLoan, l.otherDeduction, l.net, l.sssER, l.ec, l.phER, l.piER]);
  return csv(out);
}
/** Google Calendar and Outlook both import this CSV layout. */
export function calendarCsv(items: { subject: string; date: Date; description: string }[]) {
  const d = (x: Date) => `${String(x.getMonth() + 1).padStart(2, '0')}/${String(x.getDate()).padStart(2, '0')}/${x.getFullYear()}`;
  return csv([['Subject', 'Start Date', 'All Day Event', 'Description'], ...items.map(i => [i.subject, d(i.date), 'True', i.description])]);
}
/** Minimal CSV/TSV parser for pasted or uploaded spreadsheets (handles quotes). */
export function parseTable(text: string): string[][] {
  const t = text.replace(/^\uFEFF/, ''); const delim = (t.split(/\r?\n/)[0].match(/\t/g)?.length ?? 0) > 0 ? '\t' : ',';
  const rows: string[][] = []; let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < t.length; i++) { const ch = t[i];
    if (q) { if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; continue; }
    if (ch === '"') q = true; else if (ch === delim) { row.push(cell.trim()); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(cell.trim()); if (row.some(c => c)) rows.push(row); row = []; cell = ''; }
    else cell += ch; }
  row.push(cell.trim()); if (row.some(c => c)) rows.push(row);
  return rows;
}
