/**
 * Government files laid out in the structure of each agency's published form, plus a registry that
 * says, honestly, how far each layout is verified. A layout is only "verified" after Talaan's file has
 * been compared with a sample from the agency's own tool (SSS R3 File Generator, BIR Alphalist module,
 * Pag-IBIG / PhilHealth templates) AND accepted by the portal in a pilot upload.
 */
import type { Employee, Line, YearEnd } from './engine';
import { r2 } from './engine';
import { parseTable } from './files';
import type { EmployerIds } from './model';

export type LayoutStatus = 'form' | 'official-spec-needed' | 'verified';
export interface LayoutInfo { id: string; agency: 'SSS' | 'PhilHealth' | 'Pag-IBIG' | 'BIR' | 'Bank' | 'E-wallet'; name: string; form: string; portal: string; status: LayoutStatus; source: string; howToVerify: string }

export const LAYOUTS: LayoutInfo[] = [
  { id: 'sss-r3', agency: 'SSS', name: 'Contribution Collection List', form: 'R-3', portal: 'My.SSS → Submit Contribution Collection List (R3), then generate PRN', status: 'official-spec-needed',
    source: 'Fields follow the published R-3 form (SS number, member name, SS and EC per month, separation date). The upload text file must follow SSS\'s "SSS File Format Requirement" used by the R3 File Generator.',
    howToVerify: 'Create the same month in SSS\'s R3 File Generator, then compare its text file here; upload one month in My.SSS for a pilot client.' },
  { id: 'sss-ml2', agency: 'SSS', name: 'Loan Collection List', form: 'ML-2', portal: 'My.SSS → Submit Loan Collection List (ML2)', status: 'official-spec-needed',
    source: 'Fields: SS number, member name, loan type, amortisation, applicable month.', howToVerify: 'Compare with a loan list exported from My.SSS for a pilot client.' },
  { id: 'sss-r1a', agency: 'SSS', name: 'Employment Report (new hires)', form: 'R-1A', portal: 'My.SSS → Employment Report', status: 'form',
    source: 'Fields follow the published R-1A form.', howToVerify: 'Enter one new hire in My.SSS and check every field is available here.' },
  { id: 'ph-rf1', agency: 'PhilHealth', name: 'Employer Remittance Report', form: 'RF-1', portal: 'PhilHealth EPRS', status: 'official-spec-needed',
    source: 'Fields follow the RF-1 report. The EPRS upload template is issued to registered employers.', howToVerify: 'Download the EPRS upload template for a pilot client and compare it here.' },
  { id: 'ph-er2', agency: 'PhilHealth', name: 'Report of Employee-Members (new hires)', form: 'ER2', portal: 'PhilHealth EPRS / branch', status: 'form',
    source: 'Fields follow the published ER2 form.', howToVerify: 'Check against the current ER2 form from PhilHealth.' },
  { id: 'pi-mcrf', agency: 'Pag-IBIG', name: 'Member\'s Contribution Remittance Form', form: 'MCRF (HQP-PFF-053)', portal: 'Virtual Pag-IBIG for Employers', status: 'form',
    source: 'Columns follow the MCRF instructions: MID/RTN, account no., membership program, last/first/extension/middle name, period covered (YYYYMM), monthly compensation, employee and employer shares, remarks.',
    howToVerify: 'Upload one month in Virtual Pag-IBIG for a pilot client and confirm it is accepted.' },
  { id: 'pi-stlrf', agency: 'Pag-IBIG', name: 'Short-Term Loan Remittance Form', form: 'STLRF', portal: 'Virtual Pag-IBIG for Employers', status: 'official-spec-needed',
    source: 'Fields: MID, member name, loan type, amortisation, period covered.', howToVerify: 'Compare with the STLRF template from Virtual Pag-IBIG.' },
  { id: 'bir-1601c', agency: 'BIR', name: 'Monthly Remittance Return of Income Taxes Withheld on Compensation', form: '1601-C', portal: 'eBIRForms or eFPS (form is keyed in, not uploaded)', status: 'form',
    source: 'Figures arranged by 1601-C line items.', howToVerify: 'Key the figures into eBIRForms for a pilot client and confirm totals match.' },
  { id: 'bir-alpha', agency: 'BIR', name: 'Alphalist of Employees', form: '1604-C schedules', portal: 'BIR Alphalist Data Entry and Validation Module → DAT file → eSubmission', status: 'official-spec-needed',
    source: 'Columns follow the 1604-C alphalist schedules (with and without minimum wage earners). The DAT file is produced by BIR\'s own module.',
    howToVerify: 'Import this CSV into BIR\'s Alphalist module (or compare with its DAT output) and run its validation.' },
  { id: 'bir-2316', agency: 'BIR', name: 'Certificate of Compensation Payment / Tax Withheld', form: '2316', portal: 'Given to each employee; copies submitted to BIR', status: 'form',
    source: 'PDF summary with the 2316 amounts. Final signed certificates use the official BIR Form 2316.', howToVerify: 'Compare one employee\'s figures with the official form filled in manually.' },
];

/* ---------- helpers ---------- */
const csv = (rows: (string | number)[][]) => '\uFEFF' + rows.map(r => r.map(c => { const s = String(c ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\r\n');
export function splitName(full: string) {
  const parts = full.replace(/^(Dr|Engr|Atty)\.?\s+/i, '').trim().split(/\s+/);
  const ext = /^(Jr\.?|Sr\.?|II|III|IV)$/i.test(parts[parts.length - 1] ?? '') ? parts.pop()! : '';
  const last = parts.pop() ?? ''; return { last: last.toUpperCase(), first: parts.join(' ').toUpperCase(), middle: '', ext: ext.toUpperCase() };
}
const digits = (s: string) => (s || '').replace(/\D/g, '');
const ym = (month: string) => month.replace('-', '');
const mmyyyy = (month: string) => month.slice(5, 7) + month.slice(0, 4);
const byEmp = (lines: Line[]) => { const m = new Map<string, Line[]>(); lines.forEach(l => m.set(l.empId, [...(m.get(l.empId) ?? []), l])); return m; };
const add = (ls: Line[], f: (l: Line) => number) => r2(ls.reduce((a, l) => a + f(l), 0));
const emp = (emps: Employee[], id: string) => emps.find(e => e.id === id)!;

/* ---------- SSS ---------- */
export function sssR3(lines: Line[], emps: Employee[], month: string, ids: EmployerIds, employerName: string) {
  const rows: (string | number)[][] = [['Employer ID number', digits(ids.sss)], ['Registered employer name', employerName], ['Type of employer', 'Regular'], ['Applicable month (MMYYYY)', mmyyyy(month)], [],
    ['SS number', 'Surname', 'Given name', 'Middle initial', 'Social security (EE+ER)', 'EC', 'Total', 'Separation date (MMDDYYYY)']];
  let tSs = 0, tEc = 0;
  for (const [id, ls] of byEmp(lines)) { const e = emp(emps, id); const n = splitName(e.name); const ss = add(ls, l => l.sssEE + l.sssER), ec = add(ls, l => l.ec); tSs += ss; tEc += ec;
    rows.push([digits(e.sss), n.last, n.first, n.middle, ss.toFixed(2), ec.toFixed(2), r2(ss + ec).toFixed(2), e.separationDate ? e.separationDate.slice(5, 7) + e.separationDate.slice(8, 10) + e.separationDate.slice(0, 4) : '']); }
  rows.push([], ['Totals', '', '', '', r2(tSs).toFixed(2), r2(tEc).toFixed(2), r2(tSs + tEc).toFixed(2), '']);
  return csv(rows);
}
export function sssMl2(lines: Line[], emps: Employee[], month: string, ids: EmployerIds) {
  const rows: (string | number)[][] = [['Employer ID number', digits(ids.sss)], ['Applicable month (MMYYYY)', mmyyyy(month)], [], ['SS number', 'Surname', 'Given name', 'Loan type', 'Amount paid']];
  for (const [id, ls] of byEmp(lines)) { const amt = add(ls, l => l.sssLoan); if (!amt) continue; const e = emp(emps, id); const n = splitName(e.name); rows.push([digits(e.sss), n.last, n.first, 'Salary loan', amt.toFixed(2)]); }
  return csv(rows);
}
export function sssR1a(newHires: Employee[], ids: EmployerIds, employerName: string) {
  return csv([['Employer ID number', digits(ids.sss)], ['Employer name', employerName], [], ['SS number', 'Surname', 'Given name', 'Middle name', 'Date of birth', 'Date of employment', 'Position', 'Monthly salary'],
    ...newHires.map(e => { const n = splitName(e.name); return [digits(e.sss), n.last, n.first, n.middle, e.birthDate ?? '', e.hireDate ?? '', e.position, e.monthlyRate.toFixed(2)]; })]);
}
/* ---------- PhilHealth ---------- */
export function phRf1(lines: Line[], emps: Employee[], month: string, ids: EmployerIds, employerName: string, isNew: (e: Employee) => boolean) {
  const rows: (string | number)[][] = [['PhilHealth employer number', digits(ids.philhealth)], ['Employer name', employerName], ['Applicable period (MMYYYY)', mmyyyy(month)], [],
    ['PhilHealth number', 'Surname', 'Given name', 'Middle name', 'Date of birth', 'Monthly basic salary', 'Personal share (PS)', 'Employer share (ES)', 'Total', 'Status']];
  for (const [id, ls] of byEmp(lines)) { const e = emp(emps, id); const n = splitName(e.name); const ps = add(ls, l => l.phEE), es = add(ls, l => l.phER);
    rows.push([digits(e.philhealth), n.last, n.first, n.middle, e.birthDate ?? '', e.monthlyRate.toFixed(2), ps.toFixed(2), es.toFixed(2), r2(ps + es).toFixed(2), e.separationDate ? 'S' : isNew(e) ? 'NH' : 'A']); }
  return csv(rows);
}
export function phEr2(newHires: Employee[], ids: EmployerIds, employerName: string) {
  return csv([['PhilHealth employer number', digits(ids.philhealth)], ['Employer name', employerName], [], ['PhilHealth number', 'Surname', 'Given name', 'Middle name', 'Position', 'Monthly salary', 'Date of employment', 'Previous employer'],
    ...newHires.map(e => { const n = splitName(e.name); return [digits(e.philhealth), n.last, n.first, n.middle, e.position, e.monthlyRate.toFixed(2), e.hireDate ?? '', '']; })]);
}
/* ---------- Pag-IBIG ---------- */
export function piMcrf(lines: Line[], emps: Employee[], month: string, ids: EmployerIds, employerName: string) {
  const rows: (string | number)[][] = [["Pag-IBIG employer's ID number", digits(ids.pagibig)], ['Employer/business name', employerName], ['Employer/business address', ids.address], ['Type of employer', 'Private'], ['Membership program', 'Pag-IBIG I'], [],
    ['Pag-IBIG MID No./RTN', 'Account no.', 'Membership program', 'Last name', 'First name', 'Name extension', 'Middle name', 'Period covered (YYYYMM)', 'Monthly compensation (basic + COLA)', 'Employee share', 'Employer share', 'Total', 'Remarks']];
  let t = 0;
  for (const [id, ls] of byEmp(lines)) { const e = emp(emps, id); const n = splitName(e.name); const ee = add(ls, l => l.piEE), er = add(ls, l => l.piER); t += ee + er;
    rows.push([digits(e.pagibig), '', 'Pag-IBIG I', n.last, n.first, n.ext, n.middle, ym(month), e.monthlyRate.toFixed(2), ee.toFixed(2), er.toFixed(2), r2(ee + er).toFixed(2), e.separationDate ? 'Separated' : '']); }
  rows.push([], ['Total', '', '', '', '', '', '', '', '', '', '', r2(t).toFixed(2), '']);
  return csv(rows);
}
export function piStlrf(lines: Line[], emps: Employee[], month: string, ids: EmployerIds) {
  const rows: (string | number)[][] = [["Pag-IBIG employer's ID number", digits(ids.pagibig)], ['Period covered (YYYYMM)', ym(month)], [], ['Pag-IBIG MID No.', 'Last name', 'First name', 'Loan type', 'Amortisation']];
  for (const [id, ls] of byEmp(lines)) { const amt = add(ls, l => l.pagibigLoan); if (!amt) continue; const e = emp(emps, id); const n = splitName(e.name); rows.push([digits(e.pagibig), n.last, n.first, 'Multi-Purpose Loan', amt.toFixed(2)]); }
  return csv(rows);
}
export function piNewMembers(newHires: Employee[], ids: EmployerIds) {
  return csv([["Pag-IBIG employer's ID number", digits(ids.pagibig)], [], ['Pag-IBIG MID No. (or "For registration")', 'Last name', 'First name', 'Date of birth', 'Date of employment', 'Monthly compensation'],
    ...newHires.map(e => { const n = splitName(e.name); return [digits(e.pagibig) || 'For registration', n.last, n.first, e.birthDate ?? '', e.hireDate ?? '', e.monthlyRate.toFixed(2)]; })]);
}
/* ---------- BIR ---------- */
export function birAlphalist(rows: { e: Employee; y: YearEnd }[], year: number, ids: EmployerIds, employerName: string) {
  const head = ['Seq', 'TIN', 'Last name', 'First name', 'Middle name', 'Gross compensation', 'Non-taxable: 13th month and other benefits', 'Non-taxable: de minimis', 'Non-taxable: SSS, PhilHealth, Pag-IBIG (EE)', 'Non-taxable: total',
    'Taxable compensation', 'Tax due', 'Tax withheld (Jan–Nov and Dec)', 'Over-withheld refunded / (under-withheld collected)', 'Substituted filing (Y/N)'];
  const out: (string | number)[][] = [['Employer TIN', ids.tin], ['RDO', ids.rdo], ['Employer name', employerName], ['Year', year], []];
  const sched = (title: string, list: typeof rows) => { out.push([title], head); list.forEach(({ e, y }, i) => { const n = splitName(e.name);
    out.push([i + 1, e.tin, n.last, n.first, n.middle, y.gross.toFixed(2), '', '', '', y.nonTaxable.toFixed(2), y.taxable.toFixed(2), y.taxDue.toFixed(2), y.withheld.toFixed(2), (-y.difference).toFixed(2), 'Y']); }); out.push([]); };
  sched('Schedule: employees other than minimum wage earners', rows.filter(r => !r.y.mwe));
  sched('Schedule: minimum wage earners', rows.filter(r => r.y.mwe));
  return csv(out);
}

/* ---------- Layout check: compare Talaan's file with a sample from the official tool ---------- */
export function compareWithSample(ours: string, sample: string) {
  const lines = (t: string) => t.replace(/^\uFEFF/, '').split(/\r?\n/).filter(x => x.trim());
  const b = lines(sample);
  const isCsv = (l: string[]) => l.some(x => x.includes(',') || x.includes('\t'));
  if (!isCsv(b)) {
    const lens = [...new Set(b.map(x => x.length))];
    return { kind: 'fixed-width' as const, sampleLineLengths: lens.slice(0, 5), match: false,
      notes: [`The sample is a fixed-width text file (line lengths: ${lens.slice(0, 5).join(', ')}). Copy its field positions into Talaan's layout registry; Talaan currently produces a CSV in the form's structure.`] };
  }
  // The header is the first row with the most columns (handles quoted commas such as addresses).
  const header = (t: string) => { const rows = parseTable(t).slice(0, 30); const max = Math.max(...rows.map(r => r.length));
    return (rows.find(r => r.length === max) ?? []).map(h => h.trim().toLowerCase()); };
  const ha = header(ours), hb = header(sample);
  const missing = hb.filter(h => h && !ha.includes(h)), extra = ha.filter(h => h && !hb.includes(h));
  return { kind: 'csv' as const, sampleLineLengths: [], match: !missing.length && !extra.length && ha.join() === hb.join(),
    notes: [missing.length ? `Columns in the official sample but not in Talaan's file: ${missing.join(', ')}` : 'All official columns are present.',
      extra.length ? `Columns only in Talaan's file: ${extra.join(', ')}` : 'No extra columns.', ha.join() === hb.join() ? 'Column order matches.' : 'Column order differs.'] };
}
