/**
 * Talaan payroll engine (prototype). Pure functions: the engine calculates,
 * nothing else does maths. Rates below are 2026 values as researched; every
 * table must be signed off by the CPA adviser before real use.
 */
export type Freq = 'semi' | 'monthly';

export interface Employee {
  id: string; clientId: string; name: string; position: string;
  monthlyRate: number; workdays: 261 | 313;
  tin: string; sss: string; philhealth: string; pagibig: string;
  bankAccount: string; active: boolean;
  payout?: 'bank' | 'gcash' | 'maya'; mobile?: string;
  hireDate?: string; birthDate?: string; separationDate?: string;
  /** Year-to-date amounts from the previous payroll system, for firms joining Talaan mid-year. */
  opening?: { year: number; gross: number; taxable: number; withheld: number };
}
export interface Hours {
  absentDays: number; otHours: number; ndHours: number;
  regHolidayDays: number; specialDays: number; restDays: number;
  taxableAllowance: number; deMinimis: number;
  sssLoan: number; pagibigLoan: number; otherDeduction: number;
  /** Year-end tax adjustment for the last pay run of the year: positive = collect more tax, negative = refund. */
  taxAdjustment?: number;
}
export const EMPTY_HOURS: Hours = { absentDays: 0, otHours: 0, ndHours: 0, regHolidayDays: 0, specialDays: 0, restDays: 0, taxableAllowance: 0, deMinimis: 0, sssLoan: 0, pagibigLoan: 0, otherDeduction: 0, taxAdjustment: 0 };

export interface Line {
  empId: string; daily: number; hourly: number; mwe: boolean;
  basic: number; absences: number; ot: number; nd: number; holiday: number; special: number; restDay: number;
  taxableAllowance: number; deMinimis: number; gross: number;
  msc: number; sssEE: number; sssER: number; ec: number; phEE: number; phER: number; piEE: number; piER: number;
  taxable: number; wht: number; taxAdjustment: number; sssLoan: number; pagibigLoan: number; otherDeduction: number; net: number;
}

export const RATES = {
  version: '2026-01 (prototype — confirm with CPA adviser)',
  sss: { rate: 0.15, ee: 0.05, er: 0.10, mscMin: 5000, mscMax: 35000, step: 500, ecLow: 10, ecHigh: 30, ecThreshold: 15000 },
  philhealth: { rate: 0.05, floor: 10000, ceiling: 100000 },
  pagibig: { eeLow: 0.01, ee: 0.02, er: 0.02, lowThreshold: 1500, fundCap: 10000 },
  // BIR withholding tax tables (TRAIN law, 2023 onwards): [lower, base tax, rate over lower]
  wht: {
    semi: [[0, 0, 0], [10417, 0, 0.15], [16667, 937.5, 0.2], [33333, 4270.7, 0.25], [83333, 16770.7, 0.3], [333333, 91770.7, 0.35]],
    monthly: [[0, 0, 0], [20833, 0, 0.15], [33333, 1875, 0.2], [66667, 8541.8, 0.25], [166667, 33541.8, 0.3], [666667, 183541.8, 0.35]],
  } as Record<Freq, number[][]>,
  // Annual income tax table (TRAIN law, 2023 onwards), used for the year-end adjustment
  annual: [[0, 0, 0], [250000, 0, 0.15], [400000, 22500, 0.2], [800000, 102500, 0.25], [2000000, 402500, 0.3], [8000000, 2202500, 0.35]],
  premiums: { ot: 1.25, nd: 0.10, regHolidayExtra: 1.0, specialExtra: 0.30, restDay: 1.30 },
};

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function contributionsMonthly(monthly: number) {
  const s = RATES.sss, p = RATES.philhealth, g = RATES.pagibig;
  const msc = clamp(Math.round(monthly / s.step) * s.step, s.mscMin, s.mscMax);
  const phTotal = clamp(monthly, p.floor, p.ceiling) * p.rate;
  const fund = Math.min(monthly, g.fundCap);
  return {
    msc, sssEE: msc * s.ee, sssER: msc * s.er, ec: msc < s.ecThreshold ? s.ecLow : s.ecHigh,
    phEE: phTotal / 2, phER: phTotal / 2,
    piEE: fund * (monthly <= g.lowThreshold ? g.eeLow : g.ee), piER: fund * g.er,
  };
}

export function withholding(taxable: number, freq: Freq) {
  if (taxable <= 0) return 0;
  const rows = RATES.wht[freq];
  let row = rows[0];
  for (const r of rows) if (taxable > r[0]) row = r;
  return r2(row[1] + (taxable - row[0]) * row[2]);
}

export function annualTax(taxable: number) {
  if (taxable <= 0) return 0;
  let row = RATES.annual[0];
  for (const r of RATES.annual) if (taxable > r[0]) row = r;
  return r2(row[1] + (taxable - row[0]) * row[2]);
}

export function computeLine(e: Employee, h: Hours, freq: Freq, minWage: number): Line {
  const per = freq === 'semi' ? 2 : 1;
  const daily = (e.monthlyRate * 12) / e.workdays, hourly = daily / 8;
  const P = RATES.premiums;
  const basic = e.monthlyRate / per;
  const absences = h.absentDays * daily;
  const ot = h.otHours * hourly * P.ot;
  const nd = h.ndHours * hourly * P.nd;
  const holiday = h.regHolidayDays * daily * P.regHolidayExtra;
  const special = h.specialDays * daily * P.specialExtra;
  const restDay = h.restDays * daily * P.restDay;
  const gross = basic - absences + ot + nd + holiday + special + restDay + h.taxableAllowance + h.deMinimis;
  const c = contributionsMonthly(e.monthlyRate);
  const sssEE = r2(c.sssEE / per), phEE = r2(c.phEE / per), piEE = r2(c.piEE / per);
  const mwe = daily <= minWage + 0.005;
  const taxable = mwe ? h.taxableAllowance : Math.max(0, gross - h.deMinimis - sssEE - phEE - piEE);
  const adj = r2(h.taxAdjustment ?? 0);
  const wht = r2(Math.max(0, withholding(taxable, freq) + adj));
  const net = gross - sssEE - phEE - piEE - wht - h.sssLoan - h.pagibigLoan - h.otherDeduction;
  return {
    empId: e.id, daily: r2(daily), hourly: r2(hourly), mwe,
    basic: r2(basic), absences: r2(absences), ot: r2(ot), nd: r2(nd), holiday: r2(holiday), special: r2(special), restDay: r2(restDay),
    taxableAllowance: r2(h.taxableAllowance), deMinimis: r2(h.deMinimis), gross: r2(gross),
    msc: c.msc, sssEE, sssER: r2(c.sssER / per), ec: r2(c.ec / per), phEE, phER: r2(c.phER / per), piEE, piER: r2(c.piER / per),
    taxable: r2(taxable), wht, taxAdjustment: adj, sssLoan: h.sssLoan, pagibigLoan: h.pagibigLoan, otherDeduction: h.otherDeduction, net: r2(net),
  };
}

/* ---------- Checks: red blocks, amber needs a reason, green passes ---------- */
export type Level = 'red' | 'amber' | 'green';
export interface Check { empId?: string; level: Level; code: string; vars?: Record<string, string | number> }

const digits = (s: string) => (s || '').replace(/\D/g, '');
export const idRules = {
  tin: (s: string) => [9, 12, 14].includes(digits(s).length),
  sss: (s: string) => digits(s).length === 10,
  philhealth: (s: string) => digits(s).length === 12,
  pagibig: (s: string) => digits(s).length === 12,
  bankAccount: (s: string) => digits(s).length >= 10 && digits(s).length <= 16,
  mobile: (s: string) => /^09\d{9}$/.test(digits(s)) || /^639\d{9}$/.test(digits(s)),
};

export function runChecks(emps: Employee[], lines: Line[], hours: Record<string, Hours>, freq: Freq, minWage: number, prevNet: Record<string, number>): Check[] {
  const out: Check[] = [];
  const tins = new Map<string, number>();
  emps.forEach(e => { const d = digits(e.tin); if (d) tins.set(d, (tins.get(d) ?? 0) + 1); });
  for (const e of emps) {
    const l = lines.find(x => x.empId === e.id); if (!l) continue; const h = hours[e.id] ?? EMPTY_HOURS;
    const n = e.name;
    if (!idRules.tin(e.tin)) out.push({ empId: e.id, level: 'red', code: 'badTin', vars: { name: n, got: digits(e.tin).length } });
    if (!idRules.sss(e.sss)) out.push({ empId: e.id, level: 'red', code: 'badSss', vars: { name: n, got: digits(e.sss).length } });
    if (!idRules.philhealth(e.philhealth)) out.push({ empId: e.id, level: 'red', code: 'badPh', vars: { name: n, got: digits(e.philhealth).length } });
    if (!idRules.pagibig(e.pagibig)) out.push({ empId: e.id, level: 'red', code: 'badPi', vars: { name: n, got: digits(e.pagibig).length } });
    const pay = e.payout ?? 'bank';
    if (pay === 'bank' && !idRules.bankAccount(e.bankAccount)) out.push({ empId: e.id, level: 'red', code: 'badBank', vars: { name: n } });
    if (pay !== 'bank' && !idRules.mobile(e.mobile ?? '')) out.push({ empId: e.id, level: 'red', code: 'badMobile', vars: { name: n } });
    if (l.daily < minWage - 0.005) out.push({ empId: e.id, level: 'red', code: 'belowMin', vars: { name: n, daily: l.daily.toFixed(2), min: minWage.toFixed(2) } });
    if (l.net < 0) out.push({ empId: e.id, level: 'red', code: 'negNet', vars: { name: n } });
    if ((tins.get(digits(e.tin)) ?? 0) > 1) out.push({ empId: e.id, level: 'amber', code: 'dupTin', vars: { name: n } });
    const prev = prevNet[e.id];
    if (prev && Math.abs(l.net - prev) / prev > 0.2) out.push({ empId: e.id, level: 'amber', code: 'bigChange', vars: { name: n, pct: Math.round(((l.net - prev) / prev) * 100) } });
    if (h.otHours > (freq === 'semi' ? 40 : 80)) out.push({ empId: e.id, level: 'amber', code: 'manyOt', vars: { name: n, hours: h.otHours } });
    if (h.absentDays > 5) out.push({ empId: e.id, level: 'amber', code: 'manyAbsent', vars: { name: n, days: h.absentDays } });
  }
  if (!out.some(c => c.code === 'belowMin')) out.push({ level: 'green', code: 'minOk', vars: { min: minWage.toFixed(2) } });
  out.push({ level: 'green', code: 'tablesOk', vars: { v: RATES.version.slice(0, 7) } });
  return out;
}

/* ---------- Totals and journal ---------- */
export function totals(lines: Line[]) {
  const s = (k: keyof Line) => r2(lines.reduce((a, l) => a + (l[k] as number), 0));
  return {
    gross: s('gross'), net: s('net'), wht: s('wht'), sssEE: s('sssEE'), sssER: s('sssER'), ec: s('ec'), phEE: s('phEE'), phER: s('phER'), piEE: s('piEE'), piER: s('piER'),
    sssLoan: s('sssLoan'), pagibigLoan: s('pagibigLoan'), other: s('otherDeduction'), deMinimis: s('deMinimis'), taxable: s('taxable'),
  };
}
export function journal(lines: Line[]) {
  const t = totals(lines);
  const employer = r2(t.sssER + t.ec + t.phER + t.piER);
  const rows: [string, number, number][] = [
    ['accSalaries', t.gross, 0], ['accEmployer', employer, 0],
    ['accSSS', 0, r2(t.sssEE + t.sssER + t.ec + t.sssLoan)], ['accPH', 0, r2(t.phEE + t.phER)], ['accPI', 0, r2(t.piEE + t.piER + t.pagibigLoan)],
    ['accWHT', 0, t.wht], ['accOther', 0, t.other], ['accNet', 0, t.net],
  ];
  return rows.filter(r => r[1] || r[2]);
}

/* ---------- Year-end adjustment (annualization) ---------- */
export interface YearEnd { empId: string; gross: number; nonTaxable: number; taxable: number; taxDue: number; withheld: number; difference: number; mwe: boolean; thirteenthExcess: number }
/**
 * Compares tax due on the whole year's taxable pay with tax already withheld.
 * difference > 0: collect in the last pay run; < 0: refund. Lines are all of one employee's pay runs in the year.
 * thirteenth: 13th month pay and other benefits paid in the year; only the part above ₱90,000 is taxable.
 */
export function yearEnd(empId: string, lines: Line[], thirteenth = 0, openingTaxable = 0, openingWithheld = 0, openingGross = 0): YearEnd {
  const sum = (k: keyof Line) => lines.reduce((a, l) => a + (l[k] as number), 0);
  const mwe = lines.length > 0 && lines.every(l => l.mwe);
  const excess = Math.max(0, thirteenth - 90000);
  const taxable = r2(sum('taxable') + excess + openingTaxable);
  const gross = r2(sum('gross') + thirteenth + openingGross);
  const withheld = r2(sum('wht') + openingWithheld);
  const taxDue = mwe ? 0 : annualTax(taxable);
  return { empId, gross, nonTaxable: r2(gross - taxable), taxable, taxDue, withheld, difference: r2(taxDue - withheld), mwe, thirteenthExcess: r2(excess) };
}
