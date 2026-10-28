/** Talaan Analytics: firm and client dashboards, and downloadable reports. */
import { useState } from 'react';
import { totals, r2, type Line } from '../engine';
import { filingsFor, leaveBalance, loanBalance, hasModule, iso, periodInfo, AI_INCLUDED, type Run } from '../model';
import { Chip, Why, peso, today, saveFile, visibleClients, type Ctx } from '../App';
import { ModuleBadge } from './shell';

const monthsBack = (n: number) => Array.from({ length: n }, (_, i) => iso(new Date(today().getFullYear(), today().getMonth() - (n - 1 - i), 1)).slice(0, 7));
const cost = (ls: Line[]) => { const t = totals(ls); return r2(t.gross + t.sssER + t.ec + t.phER + t.piER); };
const compact = (n: number) => n >= 1e6 ? `₱${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `₱${Math.round(n / 1e3)}k` : `₱${Math.round(n)}`;
function csv(rows: (string | number)[][]) { return rows.map(r => r.map(v => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\r\n'); }

/** One-series vertical bars with a hover tooltip on every bar and labels on the first and last bar only. */
function Bars({ data, label }: { data: { k: string; v: number; tip: string }[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560, H = 190, pad = { l: 8, r: 8, t: 22, b: 26 }; const max = Math.max(1, ...data.map(d => d.v));
  const bw = (W - pad.l - pad.r) / data.length; const h = (v: number) => (v / max) * (H - pad.t - pad.b);
  return (<figure className="chart" aria-label={label}><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
    <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} className="axis" />
    {data.map((d, i) => { const x = pad.l + i * bw + bw * 0.22, w = bw * 0.56, y = H - pad.b - h(d.v); const show = i === 0 || i === data.length - 1 || hover === i; return (<g key={d.k} onMouseEnter={() => setHover(i)}>
      <rect x={pad.l + i * bw} y={pad.t - 10} width={bw} height={H - pad.t - pad.b + 10} fill="transparent" />
      {d.v > 0 && <path className={`barmark ${hover === i ? 'hot' : ''}`} d={`M${x},${H - pad.b} V${y + 4} a4,4 0 0 1 4,-4 h${w - 8} a4,4 0 0 1 4,4 V${H - pad.b} Z`} />}
      {show && d.v > 0 && <text x={x + w / 2} y={y - 6} textAnchor="middle" className="vlabel">{compact(d.v)}</text>}
      <text x={x + w / 2} y={H - 8} textAnchor="middle" className="tlabel">{d.k}</text>
      <title>{d.tip}</title></g>); })}</svg>
    {hover !== null && <figcaption className="charttip" role="status">{data[hover].tip}</figcaption>}</figure>);
}
/** Horizontal bars for a part-to-whole by category (departments), sorted largest first. */
function HBars({ data }: { data: { k: string; v: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.v)); const total = data.reduce((a, d) => a + d.v, 0);
  return (<ul className="hbars">{data.map(d => <li key={d.k} title={`${d.k}: ${peso(d.v)} (${Math.round((d.v / total) * 100)}%)`}><span className="hk">{d.k}</span><span className="htrack"><span className="hfill" style={{ width: `${(d.v / max) * 100}%` }} /></span><span className="hv">{compact(d.v)} <span className="muted">{Math.round((d.v / total) * 100)}%</span></span></li>)}</ul>);
}

export function Analytics({ c, tab }: { c: Ctx; tab?: string }) {
  const { t } = c; const cur = tab ?? 'dashboard';
  return (<><ModuleBadge c={c} m="analytics" /><div className="head"><div><h1>{t('navAnalytics')}</h1><p className="muted">{t('analyticsSub')}</p></div></div>
    <div className="pills tabs" role="tablist">{([['dashboard', 'tabDashboard'], ['reports', 'tabReports']] as [string, string][]).map(([k, l]) => <button key={k} role="tab" aria-selected={cur === k} aria-pressed={cur === k} onClick={() => c.go({ page: 'analytics', id: k })}>{t(l)}</button>)}</div>
    {cur === 'dashboard' ? <Dashboard c={c} /> : <Reports c={c} />}</>);
}

function Dashboard({ c }: { c: Ctx }) {
  const { t } = c; const all = visibleClients(c).filter(x => hasModule(x, 'analytics')); const [scope, setScope] = useState('all'); const [table, setTable] = useState(false);
  const clients = scope === 'all' ? all : all.filter(x => x.id === scope); const ids = new Set(clients.map(x => x.id));
  const runs = c.s.runs.filter(r => ids.has(r.clientId) && r.status === 'approved');
  const months = monthsBack(6); const byMonth = (m: string) => runs.filter(r => r.period.startsWith(m)).flatMap(r => r.lines ?? []);
  const lastFull = months[months.length - 2]; const lm = byMonth(lastFull); const lt = totals(lm);
  const filings = filingsFor(c.s).filter(f => ids.has(f.clientId)); const pastDue = filings.filter(f => f.due < today());
  const onTime = pastDue.filter(f => f.filed && f.remit?.paidAt && f.remit.paidAt <= iso(f.due)).length; const rate = pastDue.length ? Math.round((onTime / pastDue.length) * 100) : 100;
  const pending = c.s.runs.filter(r => ids.has(r.clientId) && r.status === 'draft' && r.submitted).length;
  const ai = c.s.aiUsage?.[iso(today()).slice(0, 7)] ?? 0;
  const emps = c.s.employees.filter(e => ids.has(e.clientId) && e.active && !e.separationDate).length;
  const deptMap = new Map<string, number>(); for (const r of runs.filter(r => r.period.startsWith(lastFull))) for (const l of r.lines ?? []) { const d = c.s.employees.find(e => e.id === l.empId)?.department ?? '—'; deptMap.set(d, r2((deptMap.get(d) ?? 0) + cost([l]))); }
  const depts = [...deptMap].map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v).slice(0, 8);
  const series = months.map(m => { const ls = byMonth(m); return { k: new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1).toLocaleDateString(c.lang === 'zh' ? 'zh-CN' : c.lang === 'tl' ? 'fil-PH' : 'en-PH', { month: 'short' }), v: cost(ls), tip: `${c.monthLabel(m)}: ${peso(cost(ls))} (${t('employerCost')}), ${t('employeesCount', { n: new Set(ls.map(l => l.empId)).size })}` }; });
  return (<><div className="filterbar"><label className="row small">{t('scope')}<select value={scope} onChange={e => setScope(e.target.value)}><option value="all">{t('allClients')} ({all.length})</option>{all.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div>
    <div className="stats kpis">
      <div><span>{t('kpiEmployees')}</span><b>{emps}</b><small className="muted">{t('kpiClients', { n: clients.length })}</small></div>
      <div><span>{t('kpiCost', { month: c.monthLabel(lastFull) })}</span><b>{peso(cost(lm))}</b><small className="muted">{t('netPay')} {peso(lt.net)}</small></div>
      <div><span>{t('kpiGovt')}</span><b>{peso(r2(lt.sssEE + lt.sssER + lt.ec + lt.phEE + lt.phER + lt.piEE + lt.piER + lt.wht))}</b><small className="muted">SSS, PhilHealth, Pag-IBIG, BIR</small></div>
      <div className={rate < 90 ? 'warnk' : ''}><span>{t('kpiOnTime')}</span><b>{rate}%</b><small className="muted">{t('kpiOnTimeOf', { n: onTime, m: pastDue.length })}</small></div>
      <div><span>{t('kpiApprovals')}</span><b>{pending}</b><small className="muted">{t('kpiApprovalsSub')}</small></div>
      <div><span>{t('kpiAi')}</span><b>{ai} <small className="muted">/ {AI_INCLUDED}</small></b><span className="meter" aria-hidden="true"><span style={{ width: `${Math.min(100, (ai / AI_INCLUDED) * 100)}%` }} /></span></div>
    </div>
    <div className="split2">
      <section className="card"><div className="row between"><h2>{t('chartCost')}</h2><button className="link" onClick={() => setTable(!table)}>{table ? t('showChart') : t('showTable')}</button></div>
        {table ? <table className="tbl small"><tbody>{series.map(d => <tr key={d.k}><td>{d.tip.split(':')[0]}</td><td className="num">{peso(d.v)}</td></tr>)}</tbody></table> : <Bars data={series} label={t('chartCost')} />}
        <p className="muted small">{t('chartCostNote')}</p></section>
      <section className="card"><h2>{t('chartDept', { month: c.monthLabel(lastFull) })}</h2>{depts.length ? <HBars data={depts} /> : <p className="muted">{t('noData')}</p>}</section>
    </div>
    <section className="card"><h2>{t('complianceHealth')}</h2><div className="scroll"><table className="tbl"><thead><tr><th>{t('colClient')}</th><th className="num">{t('kpiEmployees')}</th><th>{t('payrollSource')}</th><th>{t('nextDeadline')}</th><th>{t('colStatus')}</th></tr></thead>
      <tbody>{clients.map(cl => { const fs = filings.filter(f => f.clientId === cl.id); const late = fs.filter(f => !f.filed && f.due < today()).length; const next = fs.filter(f => !f.filed && f.due >= today())[0]; return (
        <tr key={cl.id} className="clickable" onClick={() => c.go({ page: 'client', id: cl.id })}><td><b>{cl.name}</b></td><td className="num">{c.s.employees.filter(e => e.clientId === cl.id && e.active).length}</td>
          <td>{cl.payrollSource === 'external' ? cl.externalSystem || t('otherSystem') : 'Talaan'}</td><td>{next ? <>{c.fmt(next.due)} <span className="muted small">{next.kind.toUpperCase()}</span></> : '—'}</td>
          <td>{late ? <Chip u="late">{t('lateN', { n: late })}</Chip> : <Chip u="ok">{t('onTrack')}</Chip>}</td></tr>); })}</tbody></table></div></section></>);
}

function Reports({ c }: { c: Ctx }) {
  const { t } = c; const clients = visibleClients(c); const ids = new Set(clients.map(x => x.id)); const year = String(today().getFullYear());
  const name = (id: string) => c.s.employees.find(e => e.id === id)?.name ?? id; const cname = (id: string) => c.s.clients.find(x => x.id === id)?.name ?? id;
  const approved = c.s.runs.filter(r => ids.has(r.clientId) && r.status === 'approved');
  const kindOf = (r: Run) => r.kind ?? 'regular';
  const reports: [string, string, () => string][] = [
    ['rp_summary', 'rpd_summary', () => csv([['Client', 'Cutoff', 'Pay date', 'Type', 'Employees', 'Gross', 'Employer contributions', 'Withholding tax', 'Net pay'], ...approved.sort((a, b) => a.period.localeCompare(b.period)).map(r => { const x = totals(r.lines ?? []); return [cname(r.clientId), r.period, iso(periodInfo(r.period).payDate), kindOf(r), (r.lines ?? []).length, x.gross, r2(x.sssER + x.ec + x.phER + x.piER), x.wht, x.net]; })])],
    ['rp_ytd', 'rpd_ytd', () => { const rows = new Map<string, number[]>(); for (const r of approved.filter(r => r.period.startsWith(year))) for (const l of r.lines ?? []) { const v = rows.get(l.empId) ?? [0, 0, 0, 0, 0, 0]; rows.set(l.empId, [v[0] + l.gross, v[1] + l.taxable, v[2] + l.wht, v[3] + (l.bonus ?? 0), v[4] + l.sssEE + l.phEE + l.piEE, v[5] + l.net]); }
      return csv([['Client', 'Employee', 'Gross', 'Taxable', 'Tax withheld', '13th month and bonuses', 'Employee contributions', 'Net pay'], ...[...rows].map(([id, v]) => [cname(c.s.employees.find(e => e.id === id)?.clientId ?? ''), name(id), ...v.map(r2)])]); }],
    ['rp_remit', 'rpd_remit', () => csv([['Client', 'Month', 'Agency', 'Due', 'Expected', 'Paid', 'Reference', 'Status'], ...filingsFor(c.s).filter(f => ids.has(f.clientId)).map(f => [cname(f.clientId), f.month, f.kind.toUpperCase(), iso(f.due), f.expected, f.remit?.amountPaid ?? '', f.remit?.reference ?? '', f.filed ? 'Filed' : f.due < today() ? 'Late' : 'Open'])])],
    ['rp_dept', 'rpd_dept', () => { const m = new Map<string, number[]>(); for (const r of approved) for (const l of r.lines ?? []) { const e = c.s.employees.find(x => x.id === l.empId); const k = `${cname(r.clientId)}|${r.period.slice(0, 7)}|${e?.department ?? '—'}`; const v = m.get(k) ?? [0, 0]; m.set(k, [v[0] + l.gross, v[1] + l.sssER + l.ec + l.phER + l.piER]); }
      return csv([['Client', 'Month', 'Department', 'Gross', 'Employer contributions', 'Total cost'], ...[...m].sort().map(([k, v]) => [...k.split('|'), r2(v[0]), r2(v[1]), r2(v[0] + v[1])])]); }],
    ['rp_leave', 'rpd_leave', () => { const types = c.s.leaveTypes.filter(x => x.active !== false && x.days > 0 && x.days < 60);
      return csv([['Client', 'Employee', ...types.flatMap(x => [`${x.name.split(' (')[0]} entitled`, 'used', 'left'])], ...c.s.employees.filter(e => ids.has(e.clientId) && e.active).map(e => [cname(e.clientId), e.name, ...types.flatMap(x => { const b = leaveBalance(c.s, e.id, x.id, Number(year)); return [b.entitled, b.used, b.left]; })])]); }],
    ['rp_loans', 'rpd_loans', () => csv([['Client', 'Employee', 'Loan', 'Principal', 'Per cutoff', 'Balance', 'Note'], ...c.s.loans.filter(l => ids.has(c.s.employees.find(e => e.id === l.empId)?.clientId ?? '')).map(l => [cname(c.s.employees.find(e => e.id === l.empId)!.clientId), name(l.empId), l.kind, l.principal, l.perPeriod, loanBalance(c.s, l), l.note ?? ''])])],
  ];
  return (<><Why>{t('reportsIntro')}</Why><div className="grid">{reports.map(([k, d, make]) => <section key={k} className="card"><h2>{t(k)}</h2><p className="muted small">{t(d)}</p>
    <button className="btn small" onClick={() => saveFile(c, `talaan_${k.slice(3)}_${iso(today())}.csv`, make())}>{t('downloadCsv')}</button></section>)}</div></>);
}
