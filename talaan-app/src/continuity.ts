/**
 * Continuity pack: everything needed to keep paying people correctly if Talaan (or any vendor)
 * is unavailable. A single ZIP with plain CSV files, a full JSON backup and a readable guide.
 */
import { strToU8, zipSync } from 'fflate';
import type { State } from './model';
import { RATES, totals } from './engine';
import { employeesCsv, registerCsv, calendarCsv } from './files';

export function continuityPack(s: State, o: { today: Date; deadlines: { subject: string; date: Date; description: string }[]; clientName: (id: string) => string }) {
  const approved = s.runs.filter(r => r.status === 'approved').sort((a, b) => a.period.localeCompare(b.period));
  const rates = [['Item', 'Value'], ['Tables version', RATES.version], ['SSS rate (EE / ER)', `${RATES.sss.ee * 100}% / ${RATES.sss.er * 100}%`], ['SSS salary credit range', `${RATES.sss.mscMin} to ${RATES.sss.mscMax}, steps of ${RATES.sss.step}`],
    ['EC (employer only)', `${RATES.sss.ecLow} below ${RATES.sss.ecThreshold}, else ${RATES.sss.ecHigh}`], ['PhilHealth', `${RATES.philhealth.rate * 100}% shared equally; floor ${RATES.philhealth.floor}, ceiling ${RATES.philhealth.ceiling}`],
    ['Pag-IBIG', `EE ${RATES.pagibig.ee * 100}% (${RATES.pagibig.eeLow * 100}% if ${RATES.pagibig.lowThreshold} or less), ER ${RATES.pagibig.er * 100}%, on pay up to ${RATES.pagibig.fundCap}`],
    ...RATES.wht.semi.map(r => [`Withholding (semi-monthly) over ${r[0]}`, `${r[1]} + ${r[2] * 100}% of excess`]),
    ...Object.entries(RATES.premiums).map(([k, v]) => [`Premium: ${k}`, String(v)])].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const ytd = s.clients.map(c => { const t = totals(approved.filter(r => r.clientId === c.id).flatMap(r => r.lines ?? []));
    return `<tr><td>${c.name}</td><td>${t.gross.toFixed(2)}</td><td>${t.wht.toFixed(2)}</td><td>${t.net.toFixed(2)}</td></tr>`; }).join('');
  const guide = `<!doctype html><meta charset="utf-8"><title>Talaan continuity guide</title><style>body{font-family:system-ui,sans-serif;max-width:860px;margin:32px auto;padding:0 16px;line-height:1.5}td,th{border:1px solid #ccc;padding:4px 8px}table{border-collapse:collapse}</style>
<h1>If Talaan is unavailable: how to keep paying people</h1><p>Prepared ${o.today.toISOString().slice(0, 10)}. Keep this pack in a safe place outside Talaan (encrypted drive or the firm's document system). It contains personal data protected by the Data Privacy Act.</p>
<ol><li><b>Employees and rates:</b> employees.csv has every employee's rate, government numbers and payout details.</li>
<li><b>Compute pay:</b> use rates-and-tables.csv with last-pay-register.csv as a worked example for each employee. Most cutoffs repeat the previous register with only absences and overtime changing.</li>
<li><b>Pay salaries:</b> upload a payroll file in your bank's own template through corporate online banking, approved by a second person (maker-checker).</li>
<li><b>Government filings:</b> deadlines.csv lists every due date. File at My.SSS, PhilHealth EPRS, Virtual Pag-IBIG and eBIRForms/eFPS, and pay through the bank with each portal's payment reference.</li>
<li><b>Restore later:</b> talaan-backup.json restores everything into Talaan (Connections → Import and export → Restore).</li></ol>
<h2>Year-to-date by client</h2><table><tr><th>Client</th><th>Gross</th><th>Tax withheld</th><th>Net pay</th></tr>${ytd}</table>
<h2>Contacts to keep outside Talaan</h2><p>Each client's bank relationship manager, SSS/PhilHealth/Pag-IBIG employer portal owners, the CPA adviser, and the payment partner's support line.</p>`;
  const files: Record<string, Uint8Array> = {
    'README-continuity-guide.html': strToU8(guide),
    'employees.csv': strToU8(employeesCsv(s.employees, o.clientName)),
    'pay-register-all.csv': strToU8(registerCsv(approved.map(r => ({ client: o.clientName(r.clientId), period: r.period, lines: r.lines ?? [] })), s.employees)),
    'last-pay-register.csv': strToU8(registerCsv(s.clients.map(c => approved.filter(r => r.clientId === c.id).pop()).filter(Boolean).map(r => ({ client: o.clientName(r!.clientId), period: r!.period, lines: r!.lines ?? [] })), s.employees)),
    'rates-and-tables.csv': strToU8('\uFEFF' + rates),
    'deadlines.csv': strToU8(calendarCsv(o.deadlines)),
    'talaan-backup.json': strToU8(JSON.stringify(s, null, 1)),
  };
  return zipSync(files, { level: 6 });
}
