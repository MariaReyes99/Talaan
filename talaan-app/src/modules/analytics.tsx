/** Talaan Analytics: firm and client dashboards, and downloadable reports. */
import { useState, type ReactNode } from 'react';
import { totals, r2, type Line } from '../engine';
import { filingsFor, leaveBalance, loanBalance, hasModule, iso, periodInfo, AI_INCLUDED, type Run } from '../model';
import { Chip, Why, peso, today, saveFile, visibleClients, type Ctx } from '../App';
import { ModuleBadge, BRAND_MARK } from './shell';

const monthsBack = (n: number) => Array.from({ length: n }, (_, i) => iso(new Date(today().getFullYear(), today().getMonth() - (n - 1 - i), 1)).slice(0, 7));
const cost = (ls: Line[]) => { const t = totals(ls); return r2(t.gross + t.sssER + t.ec + t.phER + t.piER); };
const compact = (n: number) => n >= 1e6 ? `₱${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `₱${Math.round(n / 1e3)}k` : `₱${Math.round(n)}`;
function csv(rows: (string | number)[][]) { return rows.map(r => r.map(v => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\r\n'); }

export function Analytics({ c, tab }: { c: Ctx; tab?: string }) {
  const { t } = c; const cur = tab ?? 'dashboard';
  return (<><ModuleBadge c={c} m="analytics" /><div className="head"><div><h1>{t('navAnalytics')}</h1><p className="muted">{t('analyticsSub')}</p></div></div>
    <div className="pills tabs" role="tablist">{([['dashboard', 'tabDashboard'], ['reports', 'tabReports']] as [string, string][]).map(([k, l]) => <button key={k} role="tab" aria-selected={cur === k} aria-pressed={cur === k} onClick={() => c.go({ page: 'analytics', id: k })}>{t(l)}</button>)}</div>
    {cur === 'dashboard' ? <Dashboard c={c} /> : <Reports c={c} />}</>);
}

/* ---------- Dashboard ---------- */
const pctChange = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 1000) / 10 : null);
const pctText = (p: number) => `${p > 0 ? '+' : ''}${p}%`;
const initialsOf = (name: string) => name.split(/\s+/).filter(w => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join('');
const TINTS = ['blue', 'mango', 'green', 'ube', 'red'] as const;
const tintOf = (id: string) => TINTS[[...id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % TINTS.length];

/** Icons */
function Icon({ name, size = 18 }: { name: 'arrow' | 'calendar' | 'download' | 'people' | 'shield' | 'chart' | 'clock' | 'spark'; size?: number }) {
  const d = {
    arrow: 'M7 17 17 7M9 7h8v8',
    calendar: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 3v4M16 3v4',
    download: 'M12 4v11m0 0-4-4m4 4 4-4M5 20h14',
    people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6.5 6.5 0 0 1 3.5 6',
    shield: 'M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6zM9 12l2 2 4-4',
    chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
    spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  }[name];
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}
const Delta = ({ p, invert }: { p: number | null; invert?: boolean }) => p === null ? null : <span className={`dpill ${(invert ? p > 0 : p < 0) ? 'down' : ''}`}>{pctText(p)}</span>;
const Corner = ({ label, onClick }: { label: string; onClick: () => void }) => <button className="dcorner" aria-label={label} title={label} onClick={onClick}><Icon name="arrow" /></button>;

/** Pill bar chart */
function PillBars({ data, focus, label }: { data: { k: string; v: number; tip: string }[]; focus: number; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const on = hover ?? focus;
  const W = 480, H = 290, pad = { l: 38, r: 4, t: 42, b: 28 };
  const top = Math.max(1, ...data.map(d => d.v)); const step = Math.pow(10, Math.floor(Math.log10(top))) * (top / Math.pow(10, Math.floor(Math.log10(top))) > 5 ? 2 : top / Math.pow(10, Math.floor(Math.log10(top))) > 2 ? 1 : 0.5);
  const max = Math.ceil(top / step) * step; const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const ih = H - pad.t - pad.b, bw = (W - pad.l - pad.r) / data.length, w = Math.min(46, bw * 0.62);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const p = on > 0 ? pctChange(data[on].v, data[on - 1].v) : null;
  return (<figure className="chart pillbars" aria-label={label}><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
    <defs><pattern id="tl-stripes" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" className="pb-base" /><line x1="0" y1="0" x2="0" y2="7" className="pb-line" strokeWidth="2.4" /></pattern></defs>
    {ticks.map(v => <g key={v}><line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="pb-grid" /><text x={pad.l - 8} y={y(v) + 4} textAnchor="end" className="tlabel">{compact(v).replace('₱', '')}</text></g>)}
    {data.map((d, i) => { const cx = pad.l + i * bw + bw / 2, hh = Math.max(d.v > 0 ? w : 0, (d.v / max) * ih), hot = i === on; return (<g key={d.k} onMouseEnter={() => setHover(i)}>
      <rect x={pad.l + i * bw} y={pad.t - 30} width={bw} height={ih + 30} fill="transparent" />
      {d.v > 0 ? <rect x={cx - w / 2} y={pad.t + ih - hh} width={w} height={hh} rx={w / 2} className={hot ? 'pb-hot' : ''} fill={hot ? undefined : 'url(#tl-stripes)'} /> : <rect x={cx - w / 2} y={pad.t + ih - 6} width={w} height={6} rx={3} className="pb-empty" />}
      {hot && d.v > 0 && <><circle cx={cx} cy={pad.t + ih - hh + w / 2} r={7} className="pb-dot" />
        <g transform={`translate(${cx},${pad.t + ih - hh - 14})`}><rect x={-34} y={-20} width={68} height={22} rx={11} className="pb-bubble" /><text y={-5} textAnchor="middle" className="pb-btext">{p !== null ? pctText(p) : compact(d.v)}</text></g></>}
      <text x={cx} y={H - 8} textAnchor="middle" className={`tlabel ${hot ? 'on' : ''}`}>{d.k}</text>
      <title>{d.tip}</title></g>); })}</svg>
    <figcaption className="pb-cap" role="status">{data[on]?.tip}</figcaption></figure>);
}

/** Area chart */
function Area({ values, label }: { values: number[]; label: string }) {
  const W = 320, H = 120, max = Math.max(1, ...values), n = values.length;
  const pts = values.map((v, i) => [n === 1 ? W / 2 : (i / (n - 1)) * W, H - 10 - (v / max) * (H - 30)] as const);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`; }
  return (<svg className="area" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
    <defs><linearGradient id="tl-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="ar-top" /><stop offset="1" className="ar-bottom" /></linearGradient></defs>
    {[0.25, 0.5, 0.75].map(f => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} className="pb-grid" />)}
    <path d={`${d} L${W},${H} L0,${H} Z`} fill="url(#tl-area)" /><path d={d} className="ar-line" fill="none" vectorEffect="non-scaling-stroke" /></svg>);
}

/** Horizontal bars for a part-to-whole by category (departments), sorted largest first. */
function HBars({ data }: { data: { k: string; v: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.v)); const total = data.reduce((a, d) => a + d.v, 0);
  return (<ul className="hbars">{data.map(d => <li key={d.k} title={`${d.k}: ${peso(d.v)} (${Math.round((d.v / total) * 100)}%)`}><span className="hk">{d.k}</span><span className="htrack"><span className="hfill" style={{ width: `${(d.v / max) * 100}%` }} /></span><span className="hv">{compact(d.v)} <span className="muted">{Math.round((d.v / total) * 100)}%</span></span></li>)}</ul>);
}

export function Dashboard({ c, actions }: { c: Ctx; actions?: ReactNode }) {
  const { t } = c; const all = visibleClients(c).filter(x => hasModule(x, 'analytics')); const [scope, setScope] = useState('all'); const [table, setTable] = useState(false); const [span, setSpan] = useState<6 | 12>(6);
  const clients = scope === 'all' ? all : all.filter(x => x.id === scope); const ids = new Set(clients.map(x => x.id));
  const runs = c.s.runs.filter(r => ids.has(r.clientId) && r.status === 'approved');
  const months = monthsBack(span); const byMonth = (m: string) => runs.filter(r => r.period.startsWith(m)).flatMap(r => r.lines ?? []);
  const lastFull = months[months.length - 2], prevFull = months[months.length - 3]; const lm = byMonth(lastFull), pm = byMonth(prevFull); const lt = totals(lm);
  const govt = (ls: Line[]) => { const x = totals(ls); return r2(x.sssEE + x.sssER + x.ec + x.phEE + x.phER + x.piEE + x.piER + x.wht); };
  const filings = filingsFor(c.s).filter(f => ids.has(f.clientId)); const pastDue = filings.filter(f => f.due < today());
  const onTime = pastDue.filter(f => f.filed && f.remit?.paidAt && f.remit.paidAt <= iso(f.due)).length; const rate = pastDue.length ? Math.round((onTime / pastDue.length) * 100) : 100;
  const waiting = c.s.runs.filter(r => ids.has(r.clientId) && r.status === 'draft' && r.submitted);
  const waitingClients = [...new Set(waiting.map(r => r.clientId))].map(id => c.s.clients.find(x => x.id === id)!).filter(Boolean);
  const ai = c.s.aiUsage?.[iso(today()).slice(0, 7)] ?? 0;
  const emps = c.s.employees.filter(e => ids.has(e.clientId) && e.active && !e.separationDate).length;
  const paidNow = new Set(lm.map(l => l.empId)).size, paidBefore = new Set(pm.map(l => l.empId)).size;
  const deptMap = new Map<string, number>(); for (const r of runs.filter(r => r.period.startsWith(lastFull))) for (const l of r.lines ?? []) { const d = c.s.employees.find(e => e.id === l.empId)?.department ?? '—'; deptMap.set(d, r2((deptMap.get(d) ?? 0) + cost([l]))); }
  const depts = [...deptMap].map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v).slice(0, 8);
  const locale = c.lang === 'zh' ? 'zh-CN' : c.lang === 'tl' ? 'fil-PH' : 'en-PH';
  const series = months.map(m => { const ls = byMonth(m); return { k: new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1).toLocaleDateString(locale, { month: 'short' }), v: cost(ls), tip: `${c.monthLabel(m)}: ${peso(cost(ls))} (${t('employerCost')}), ${t('employeesCount', { n: new Set(ls.map(l => l.empId)).size })}` }; });
  const govSeries = months.map(m => govt(byMonth(m)));
  const first = c.user.name.split(' ')[0];
  return (<div className="dash">
    <div className="dhead"><h2 className="dhello">{t('dashHello')} <span>{first}</span></h2>
      <div className="row">{actions}<label className="dpillsel"><Icon name="calendar" /><span className="sr">{t('scope')}</span><select value={scope} onChange={e => setScope(e.target.value)} aria-label={t('scope')}><option value="all">{t('allClients')} ({all.length})</option>{all.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <button className="dbtn" onClick={() => c.go({ page: 'analytics', id: 'reports' })}><Icon name="download" /> {t('dashDownload')}</button></div></div>

    <div className="dgrid">
      {/* Payroll cost */}
      <section className="dcard d-hero"><div className="dtitle"><div><h3>{t('kpiCost', { month: c.monthLabel(lastFull) })}</h3><p>{t('employerCost')}</p></div><Corner label={t('tabReports')} onClick={() => c.go({ page: 'analytics', id: 'reports' })} /></div>
        <div className="herocard"><div className="row between"><span className="herobrand"><img src={BRAND_MARK} alt="" /> TALAAN</span><Delta p={pctChange(cost(lm), cost(pm))} /></div>
          <span className="herolbl">{t('dashPayrollCost')}</span><b className="heroamt">{peso(cost(lm))}</b>
          <div className="row between herofoot"><span>{t('netPay')} {peso(lt.net)}</span><span>{t('kpiClients', { n: clients.length })}</span></div></div></section>

      {/* Employees */}
      <section className="dcard d-emp"><div className="row between"><span className="dlabel"><Icon name="people" /> {t('kpiEmployees')}</span>{paidBefore ? <span className={`dpill ${paidNow < paidBefore ? 'down' : ''}`}>{paidNow - paidBefore >= 0 ? '+' : ''}{paidNow - paidBefore}</span> : null}</div>
        <b className="dbig">{emps}</b><span className="muted small">{t('dashPaidIn', { n: paidNow, month: c.monthLabel(lastFull) })}</span></section>

      {/* Cost by month */}
      <section className="dcard d-chart"><div className="dtitle"><span className="dicon"><Icon name="chart" /></span><h3 className="grow">{t('chartCost')}</h3>
          <div className="dseg" role="group" aria-label={t('dashRange')}>{([6, 12] as const).map(n => <button key={n} aria-pressed={span === n} onClick={() => setSpan(n)}>{t(n === 6 ? 'range6' : 'range12')}</button>)}</div>
          <Corner label={table ? t('showChart') : t('showTable')} onClick={() => setTable(!table)} /></div>
        {table ? <table className="tbl small"><tbody>{series.map(d => <tr key={d.k + d.tip}><td>{d.tip.split(':')[0]}</td><td className="num">{peso(d.v)}</td></tr>)}</tbody></table> : <PillBars data={series} focus={series.length - 2} label={t('chartCost')} />}
        <p className="muted small dnote">{t('chartCostNote')}</p></section>

      {/* Government and tax */}
      <section className="dcard d-gov"><div className="dtitle"><div><h3>{t('kpiGovt')}</h3><p>{t('dashGovtSub', { month: c.monthLabel(lastFull) })}</p></div><Corner label={t('navCompliance')} onClick={() => c.go({ page: 'files' })} /></div>
        <div className="govtotal"><span className="muted small">{t('dashTotal')}</span><b className="dbig">{peso(govt(lm))}</b><Delta p={pctChange(govt(lm), govt(pm))} /></div>
        <Area values={govSeries.slice(0, -1)} label={t('kpiGovt')} />
        <div className="dseg wide"><button aria-pressed="true" onClick={() => c.go({ page: 'files' })}>{t('navCompliance')} <Icon name="arrow" size={15} /></button><button onClick={() => c.go({ page: 'analytics', id: 'reports' })}>{t('tabReports')} <Icon name="download" size={15} /></button></div></section>

      {/* Compliance by client */}
      <section className="dcard d-table"><div className="dtitle"><div><h3>{t('complianceHealth')}</h3><p>{t('dashHealthSub')}</p></div><Corner label={t('navCompliance')} onClick={() => c.go({ page: 'files' })} /></div>
        <div className="scroll"><table className="dtbl"><thead><tr><th>{t('colClient')}</th><th>{t('payrollSource')}</th><th>{t('nextDeadline')}</th><th>{t('colStatus')}</th><th className="num">{t('dashCostCol', { month: c.monthLabel(lastFull) })}</th></tr></thead>
          <tbody>{clients.map(cl => { const fs = filings.filter(f => f.clientId === cl.id); const late = fs.filter(f => !f.filed && f.due < today()).length; const next = fs.filter(f => !f.filed && f.due >= today())[0]; return (
            <tr key={cl.id} className="clickable" onClick={() => c.go({ page: 'client', id: cl.id })}>
              <td><span className="dwho"><span className={`dav ${tintOf(cl.id)}`}>{initialsOf(cl.name)}</span><span><b>{cl.name}</b><small>{t('employeesCount', { n: c.s.employees.filter(e => e.clientId === cl.id && e.active).length })}</small></span></span></td>
              <td>{cl.payrollSource === 'external' ? cl.externalSystem || t('otherSystem') : 'Talaan'}</td>
              <td>{next ? <>{c.fmt(next.due)}<small className="muted"> {next.kind.toUpperCase()}</small></> : '—'}</td>
              <td>{late ? <span className="dstat late">{t('lateN', { n: late })}</span> : <span className="dstat ok">{t('onTrack')}</span>}</td>
              <td className="num"><b>{peso(cost(lm.filter(l => c.s.employees.find(e => e.id === l.empId)?.clientId === cl.id)))}</b></td></tr>); })}</tbody></table></div></section>

      {/* Filed on time */}
      <section className="dcard d-ontime"><div className="row between"><span className="dicon"><Icon name="shield" /></span><span className="grow"><h3>{t('kpiOnTime')}</h3><p className="muted small dsub">{t('kpiOnTimeOf', { n: onTime, m: pastDue.length })}</p></span></div>
        <div className="row"><b className="dhuge">{rate}<span>%</span></b><span className={`dpill ${rate < 90 ? 'warn' : ''}`}>{rate < 90 ? t('dashBelowTarget') : t('onTrack')}</span></div>
        <ul className="dagency">{(['bir', 'sss', 'ph', 'pi'] as const).map(k => { const due = pastDue.filter(f => f.kind === k); const ok = due.filter(f => f.filed && f.remit?.paidAt && f.remit.paidAt <= iso(f.due)).length; const r = due.length ? Math.round((ok / due.length) * 100) : 100; return (
          <li key={k}><span>{({ bir: 'BIR', sss: 'SSS', ph: 'PhilHealth', pi: 'Pag-IBIG' })[k]}</span><span className="dmeter"><span className={r < 90 ? 'low' : ''} style={{ width: `${Math.max(3, r)}%` }} /></span><b>{r}%</b></li>); })}</ul>
        <div className="dinner"><div className="row between"><span><h3>{t('kpiApprovals')}</h3><p className="muted small dsub">{t('kpiApprovalsSub')}</p></span><Corner label={t('kpiApprovals')} onClick={() => c.go({ page: 'payruns' })} /></div>
          {waitingClients.length ? <div className="davs">{waitingClients.slice(0, 4).map(cl => <span key={cl.id} className={`dav big ${tintOf(cl.id)}`} title={cl.name}>{initialsOf(cl.name)}</span>)}{waiting.length > 4 && <span className="dav big more">+{waiting.length - 4}</span>}</div>
            : <p className="dclear"><Icon name="spark" size={16} /> {t('dashNoneWaiting')}</p>}</div></section>

      {/* Cost by department */}
      <section className="dcard d-dept"><div className="dtitle"><div><h3>{t('chartDept', { month: c.monthLabel(lastFull) })}</h3></div></div>{depts.length ? <HBars data={depts} /> : <p className="muted">{t('noData')}</p>}</section>

      {/* Ask Tala usage */}
      <section className="dcard d-ai"><div className="row between"><span className="dlabel"><Icon name="spark" /> {t('kpiAi')}</span><Corner label={t('kpiAi')} onClick={() => c.go({ page: 'ask' })} /></div>
        <b className="dbig">{ai} <span className="muted">/ {AI_INCLUDED}</span></b><span className="dmeter" aria-hidden="true"><span style={{ width: `${Math.min(100, (ai / AI_INCLUDED) * 100)}%` }} /></span>
        <span className="muted small">{t('dashAiLeft', { n: Math.max(0, AI_INCLUDED - ai) })}</span>
        <div className="dseg wide"><button aria-pressed="true" onClick={() => c.go({ page: 'ask' })}><Icon name="spark" size={15} /> {t('ask')}</button></div></section>
    </div></div>);
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
