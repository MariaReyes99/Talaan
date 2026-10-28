/**
 * Synthetic payroll data for testing (run: npm run test:synthetic).
 * Generates thousands of realistic, fictional employees and cutoffs (seeded, so results repeat), runs them through the
 * payroll engine and checks properties that must always hold, whatever the inputs. Writes a sample of the cases to
 * talaan-ai/data/synthetic_payroll.jsonl (no real names, IDs or salaries: everything is generated).
 */
import { writeFileSync } from 'node:fs';
import { computeLine, journal, withholding, yearEnd, annualTax, RATES, EMPTY_HOURS, type Employee, type Hours, type Freq } from '../src/engine';

let seed = 20261028; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const int = (a: number, b: number) => Math.floor(a + rnd() * (b - a + 1));
const FIRST = ['Ana', 'Ben', 'Carla', 'Dante', 'Elena', 'Ferdie', 'Gina', 'Hector', 'Iris', 'Jojo', 'Karen', 'Leo', 'Mila', 'Nico', 'Olive', 'Paolo'];
const LAST = ['Reyes', 'Santos', 'Cruz', 'Bautista', 'Garcia', 'Mendoza', 'Torres', 'Flores', 'Villanueva', 'Ramos', 'Aquino', 'Castillo'];
const N = Number(process.argv[2] ?? 3000); const MIN = [755, 645, 600, 582, 540, 505, 470, 436];
type Case = { e: Employee; h: Hours; freq: Freq; minWage: number; offCycle: boolean; ytdBenefits: number };
const cases: Case[] = [];
for (let i = 0; i < N; i++) {
  const minWage = pick(MIN); const workdays = pick([261, 313] as const);
  const band = rnd(); const monthly = Math.round(band < 0.25 ? minWage * workdays / 12 : band < 0.7 ? 15000 + rnd() * 35000 : band < 0.95 ? 50000 + rnd() * 100000 : 150000 + rnd() * 500000);
  const e: Employee = { id: `syn-${i}`, clientId: 'syn', name: `${pick(FIRST)} ${pick(LAST)}`, position: pick(['Staff', 'Cashier', 'Driver', 'Nurse', 'Engineer', 'Manager']), monthlyRate: monthly, workdays,
    tin: '000-000-000-000', sss: '00-0000000-0', philhealth: '00-000000000-0', pagibig: '0000-0000-0000', bankAccount: '0000000000', active: true };
  const offCycle = rnd() < 0.1;
  const h: Hours = { ...EMPTY_HOURS, absentDays: rnd() < 0.3 ? int(0, 3) : 0, otHours: rnd() < 0.4 ? int(0, 30) : 0, otRestHours: rnd() < 0.1 ? int(0, 8) : 0, otHolidayHours: rnd() < 0.05 ? int(0, 8) : 0,
    ndHours: rnd() < 0.2 ? int(0, 40) : 0, regHolidayDays: rnd() < 0.2 ? int(0, 2) : 0, specialDays: rnd() < 0.15 ? int(0, 2) : 0, restDays: rnd() < 0.1 ? int(0, 2) : 0,
    taxableAllowance: rnd() < 0.3 ? int(0, 5000) : 0, deMinimis: rnd() < 0.3 ? int(0, 2500) : 0, sssLoan: rnd() < 0.15 ? int(500, 2000) : 0, pagibigLoan: rnd() < 0.1 ? int(300, 1500) : 0,
    otherDeduction: rnd() < 0.1 ? int(100, 1000) : 0, reimbursement: rnd() < 0.15 ? int(200, 5000) : 0,
    ...(offCycle ? { bonus: int(5000, 150000) } : {}), ...(rnd() < 0.05 ? { leaveConversion: int(1000, 30000), leaveDays: int(1, 20) } : {}) };
  cases.push({ e, h, freq: pick(['semi', 'monthly'] as Freq[]), minWage, offCycle, ytdBenefits: offCycle ? int(0, 120000) : 0 });
}

const fails: string[] = []; const check = (ok: boolean, msg: string) => { if (!ok && fails.length < 20) fails.push(msg); if (!ok) failCount++; }; let failCount = 0;
const near = (a: number, b: number, tol = 0.051) => Math.abs(a - b) <= tol;
const lines = cases.map(c => computeLine(c.e, c.h, c.freq, c.minWage, { offCycle: c.offCycle, ytdBenefits: c.ytdBenefits }));
lines.forEach((l, i) => { const c = cases[i]; const per = c.freq === 'semi' ? 2 : 1; const id = c.e.id;
  const vals = Object.values(l).filter(v => typeof v === 'number') as number[]; check(vals.every(Number.isFinite), `${id}: non-finite number`);
  const g = l.basic - l.absences + l.ot + l.nd + l.holiday + l.special + l.restDay + l.taxableAllowance + l.deMinimis + (l.bonus ?? 0) + (l.leaveConversion ?? 0);
  check(near(l.gross, g, 0.06), `${id}: gross ${l.gross} ≠ parts ${g.toFixed(2)}`);
  const n = l.gross - l.sssEE - l.phEE - l.piEE - l.wht - l.sssLoan - l.pagibigLoan - l.otherDeduction + (l.reimbursement ?? 0);
  check(near(l.net, n, 0.06), `${id}: net ${l.net} ≠ ${n.toFixed(2)}`);
  check(l.sssEE <= RATES.sss.mscMax * RATES.sss.ee / per + 0.01, `${id}: SSS employee share above the cap`);
  check(l.phEE <= RATES.philhealth.ceiling * RATES.philhealth.rate / 2 / per + 0.01, `${id}: PhilHealth above the cap`);
  check(l.piEE <= RATES.pagibig.fundCap * RATES.pagibig.ee / per + 0.01, `${id}: Pag-IBIG above the cap`);
  check(l.msc >= RATES.sss.mscMin && l.msc <= RATES.sss.mscMax && l.msc % RATES.sss.step === 0, `${id}: salary credit ${l.msc} off the schedule`);
  if (c.offCycle) check(l.sssEE === 0 && l.phEE === 0 && l.piEE === 0 && l.basic === 0, `${id}: off-cycle run deducted contributions`);
  // A minimum wage earner is exempt on the minimum wage, holiday, overtime and night pay; taxable allowances, benefits above
  // ₱90,000 and leave converted beyond 10 days stay taxable (found by this test: the engine was right, the first check was not).
  if (l.mwe && !c.h.taxableAllowance && !(l.bonusTaxable ?? 0) && !((c.h.leaveDays ?? 0) > 10)) check(l.wht === 0, `${id}: minimum wage earner taxed ${l.wht}`);
  if ((l.bonus ?? 0) > 0) check(near(l.bonusTaxable ?? 0, Math.max(0, (l.bonus ?? 0) - Math.max(0, 90000 - c.ytdBenefits)), 0.01), `${id}: ₱90,000 benefits limit misapplied`);
  check(l.taxable >= 0 && l.wht >= 0, `${id}: negative tax`);
});
// Withholding never decreases as taxable pay rises.
for (const f of ['semi', 'monthly'] as Freq[]) { let prev = 0; for (let x = 0; x <= 800000; x += 137) { const w = withholding(x, f); check(w >= prev - 0.005, `${f}: withholding falls at ₱${x}`); prev = w; } }
// Journals balance for random batches.
for (let b = 0; b < 50; b++) { const batch = lines.slice(b * 40, b * 40 + 40); if (!batch.length) break; const j = journal(batch); const dr = j.reduce((a, r) => a + r[1], 0), cr = j.reduce((a, r) => a + r[2], 0); check(near(dr, cr, 0.06), `journal batch ${b}: ${dr.toFixed(2)} vs ${cr.toFixed(2)}`); }
// A steady salary withheld every cutoff lands within a few pesos of the annual tax (annualization works).
let ye = 0; for (const c of cases.filter(x => !x.offCycle).slice(0, 300)) { const l = computeLine(c.e, EMPTY_HOURS, 'semi', c.minWage); const y = yearEnd(c.e.id, Array(24).fill(l));
  ye++; check(Math.abs(y.difference) <= Math.max(25, annualTax(y.taxable) * 0.01), `${c.e.id}: year-end difference ${y.difference} too large for a steady salary`); }

const sample = cases.slice(0, 200).map((c, i) => ({ employee: { ...c.e, tin: undefined, sss: undefined, philhealth: undefined, pagibig: undefined, bankAccount: undefined }, freq: c.freq, minWage: c.minWage, offCycle: c.offCycle, hours: c.h, line: lines[i] }));
writeFileSync(new URL('../../talaan-ai/data/synthetic_payroll.jsonl', import.meta.url), sample.map(x => JSON.stringify(x)).join('\n') + '\n');
const checks = N * 9 + 2 * Math.ceil(800000 / 137) + 50 + ye;
console.log(`Synthetic payroll: ${N} employees, ~${checks.toLocaleString()} property checks, ${failCount} failure(s).`); fails.forEach(f => console.log('  FAIL', f));
process.exit(failCount ? 1 : 0);
