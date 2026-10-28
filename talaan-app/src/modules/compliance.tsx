/** Talaan Compliance: the deadline calendar across all clients, and "bring your own payroll" import for clients on another payroll system. */
import { InboundQueue, submitInbound } from './integrations';
import { useState } from 'react';
import { contributionsMonthly, withholding, r2, type Employee, type Line } from '../engine';
import { filingsFor, currentPeriod, periodInfo, iso, hasModule, isRegular, daysBetween, type Client, type FilingKind, type Run } from '../model';
import { calendarCsv, parseTable } from '../files';
import { Chip, Why, peso, today, saveFile, visibleClients, fileKey, type Ctx } from '../App';

interface CalEvent { date: string; clientId: string; kind: 'pay' | FilingKind | 'holiday'; label: string; status: 'done' | 'late' | 'soon' | 'planned' }
const lastDay = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

export function eventsFor(c: Ctx, month: string): CalEvent[] {
  const clients = visibleClients(c); const y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7)) - 1; const out: CalEvent[] = []; const now = today();
  const st = (d: Date, done: boolean): CalEvent['status'] => done ? 'done' : daysBetween(now, d) < 0 ? 'late' : daysBetween(now, d) <= 3 ? 'soon' : 'planned';
  const filings = filingsFor(c.s);
  for (const cl of clients) {
    if (hasModule(cl, 'payroll')) for (const p of cl.freq === 'monthly' ? [`${month}-M`] : [`${month}-A`, `${month}-B`]) {
      const run = c.s.runs.find(r => r.clientId === cl.id && r.period === p && isRegular(r)); const d = periodInfo(p).payDate;
      out.push({ date: iso(d), clientId: cl.id, kind: 'pay', label: c.t('calPayday', { period: c.periodLabel(p) }), status: st(d, run?.status === 'approved') });
    }
    if (hasModule(cl, 'compliance')) {
      const prev = iso(new Date(y, m - 1, 1)).slice(0, 7);
      for (const k of ['bir', 'sss', 'ph', 'pi'] as FilingKind[]) {
        const d = new Date(y, m, Math.min(cl.dueDays[k], lastDay(y, m))); const f = filings.find(x => x.clientId === cl.id && x.month === prev && x.kind === k);
        out.push({ date: iso(d), clientId: cl.id, kind: k, label: `${c.t(fileKey(k))}, ${c.monthLabel(prev)}`, status: st(d, !!f?.filed) });
      }
    }
  }
  for (const h of c.s.refs.holidays.filter(h => h.date.startsWith(month))) out.push({ date: h.date, clientId: '', kind: 'holiday', label: h.name, status: 'planned' });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function ComplianceCalendar({ c }: { c: Ctx }) {
  const { t } = c; const [month, setMonth] = useState(iso(today()).slice(0, 7)); const [view, setView] = useState<'month' | 'list'>('month');
  const y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7)) - 1; const ev = eventsFor(c, month);
  const shift = (n: number) => setMonth(iso(new Date(y, m + n, 1)).slice(0, 7));
  const first = new Date(y, m, 1).getDay(); const days = lastDay(y, m); const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const name = (id: string) => c.s.clients.find(x => x.id === id)?.name ?? '';
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2026, 1, 1 + i).toLocaleDateString(c.lang === 'zh' ? 'zh-CN' : c.lang === 'tl' ? 'fil-PH' : 'en-PH', { weekday: 'short' }));
  const exportCsv = () => saveFile(c, `talaan_calendar_${month}.csv`, calendarCsv(ev.filter(e => e.kind !== 'holiday').map(e => ({ subject: `${name(e.clientId)}: ${e.label}`, date: new Date(e.date + 'T00:00'), description: 'Talaan' }))), { plain: true });
  const counts = { late: ev.filter(e => e.status === 'late').length, soon: ev.filter(e => e.status === 'soon').length, done: ev.filter(e => e.status === 'done').length };
  return (<><Why>{t('calIntro')}</Why><section className="card">
    <div className="row between"><div className="row"><button className="btn small ghost" aria-label={t('prevMonth')} onClick={() => shift(-1)}>‹</button><h2 style={{ margin: 0 }}>{c.monthLabel(month)}</h2><button className="btn small ghost" aria-label={t('nextMonth')} onClick={() => shift(1)}>›</button>
      <button className="link" onClick={() => setMonth(iso(today()).slice(0, 7))}>{t('thisMonth')}</button></div>
      <div className="row"><Chip u="late">{t('calLate', { n: counts.late })}</Chip><Chip u="soon">{t('calSoon', { n: counts.soon })}</Chip><Chip u="ok">{t('calDone', { n: counts.done })}</Chip>
        <div className="seg">{(['month', 'list'] as const).map(k => <button key={k} aria-pressed={view === k} onClick={() => setView(k)}>{t('view_' + k)}</button>)}</div>
        <button className="btn small ghost" onClick={exportCsv}>{t('exportCal')}</button></div></div>
    {view === 'month' ? <div className="cal" role="grid" aria-label={c.monthLabel(month)}>{weekdays.map(w => <div key={w} className="calh" role="columnheader">{w}</div>)}
      {cells.map((d, i) => { const ds = d ? `${month}-${String(d).padStart(2, '0')}` : ''; const es = d ? ev.filter(e => e.date === ds) : []; const isToday = ds === iso(today()); return (
        <div key={i} className={`calc ${d ? '' : 'empty'} ${isToday ? 'today' : ''}`} role="gridcell">{d && <span className="calnum">{d}</span>}
          {es.slice(0, 4).map((e, k) => <span key={k} className={`calev ${e.kind} ${e.status}`} title={`${name(e.clientId)} ${e.label}`}>{e.kind === 'holiday' ? '🎌 ' : ''}{e.clientId ? `${name(e.clientId).split(' ')[0]}: ` : ''}{e.kind === 'pay' ? t('calPay') : e.kind === 'holiday' ? e.label : e.kind.toUpperCase()}</span>)}
          {es.length > 4 && <span className="calmore">+{es.length - 4}</span>}</div>); })}</div>
    : <table className="tbl"><tbody>{ev.map((e, i) => <tr key={i}><td className="date">{c.fmt(new Date(e.date + 'T00:00'))}</td><td><b>{name(e.clientId) || t('holiday')}</b><div className="muted small">{e.label}</div></td>
        <td><Chip u={e.status === 'done' ? 'ok' : e.status === 'late' ? 'late' : e.status === 'soon' ? 'soon' : 'info'}>{t('cs2_' + e.status)}</Chip></td></tr>)}</tbody></table>}
    <p className="muted small">{t('calNote')}</p></section></>);
}

/* ---------- Bring your own payroll ---------- */
const COLS: [keyof Row, RegExp][] = [['name', /^name|employee|pangalan/], ['tin', /tin/], ['sssNo', /sss.*(no|number)|sss #/], ['phNo', /philhealth.*(no|number)|pin/], ['piNo', /pag-?ibig.*(no|number)|mid/],
  ['gross', /gross/], ['taxable', /taxable/], ['sssEE', /sss.*(ee|employee)/], ['sssER', /sss.*(er|employer)/], ['ec', /^ec|employees.? comp/], ['phEE', /philhealth.*(ee|employee)|phic.*ee/], ['phER', /philhealth.*(er|employer)|phic.*er/],
  ['piEE', /pag-?ibig.*(ee|employee)|hdmf.*ee/], ['piER', /pag-?ibig.*(er|employer)|hdmf.*er/], ['wht', /tax withheld|withholding|wht/], ['net', /^net/], ['sssLoan', /sss loan/], ['piLoan', /pag-?ibig loan|hdmf loan/]];
interface Row { name: string; tin: string; sssNo: string; phNo: string; piNo: string; gross: number; taxable: number; sssEE: number; sssER: number; ec: number; phEE: number; phER: number; piEE: number; piER: number; wht: number; net: number; sssLoan: number; piLoan: number }
interface Checked { row: Row; emp?: Employee; issues: string[] }
const digits = (s: string) => (s || '').replace(/\D/g, '');

export function sampleRegister(c: Ctx, cl: Client) {
  const emps = c.s.employees.filter(e => e.clientId === cl.id && e.active);
  const head = 'Employee Name,TIN,Gross Pay,Taxable Income,SSS EE,SSS ER,EC,PhilHealth EE,PhilHealth ER,Pag-IBIG EE,Pag-IBIG ER,Tax Withheld,Net Pay';
  return [head, ...emps.map((e, i) => { const k = contributionsMonthly(e.monthlyRate); const taxable = r2(e.monthlyRate - k.sssEE - k.phEE - k.piEE); const w = withholding(taxable, 'monthly');
    const phEE = i === 1 ? r2(k.phEE - 50) : k.phEE; // one deliberate mistake, so the check has something to find
    return [e.name, e.tin, e.monthlyRate, taxable, k.sssEE, k.sssER, k.ec, phEE, k.phER, k.piEE, k.piER, w, r2(e.monthlyRate - k.sssEE - phEE - k.piEE - w)].join(','); })].join('\n');
}

export function ImportPayroll({ c }: { c: Ctx }) {
  const { t } = c; const clients = visibleClients(c).filter(x => hasModule(x, 'compliance'));
  const ext = clients.filter(x => x.payrollSource === 'external');
  const [clientId, setClientId] = useState((ext[0] ?? clients[0])?.id); const cl = c.s.clients.find(x => x.id === clientId);
  const lastMonth = iso(new Date(today().getFullYear(), today().getMonth() - 1, 1)).slice(0, 7);
  const [month, setMonth] = useState(lastMonth); const [text, setText] = useState(''); const [checked, setChecked] = useState<Checked[] | null>(null);
  if (!cl) return <p className="muted">{t('noComplianceClients')}</p>;
  const existing = c.s.runs.find(r => r.clientId === cl.id && r.kind === 'imported' && r.period.startsWith(month));
  const ownRuns = c.s.runs.some(r => r.clientId === cl.id && r.status === 'approved' && isRegular(r) && r.period.startsWith(month));
  const check = () => {
    const rows = parseTable(text).filter(r => r.some(x => x.trim())); if (rows.length < 2) return setChecked([]);
    const head = rows[0].map(h => h.trim().toLowerCase()); const idx = Object.fromEntries(COLS.map(([k, re]) => [k, head.findIndex(h => re.test(h))])) as Record<keyof Row, number>;
    const num = (r: string[], k: keyof Row) => idx[k] >= 0 ? r2(Number(String(r[idx[k]] ?? '').replace(/[₱,\s]/g, '')) || 0) : 0;
    const str = (r: string[], k: keyof Row) => idx[k] >= 0 ? String(r[idx[k]] ?? '').trim() : '';
    const emps = c.s.employees.filter(e => e.clientId === cl.id);
    setChecked(rows.slice(1).map(r => {
      const row: Row = { name: str(r, 'name'), tin: str(r, 'tin'), sssNo: str(r, 'sssNo'), phNo: str(r, 'phNo'), piNo: str(r, 'piNo'), gross: num(r, 'gross'), taxable: num(r, 'taxable'), sssEE: num(r, 'sssEE'), sssER: num(r, 'sssER'), ec: num(r, 'ec'), phEE: num(r, 'phEE'), phER: num(r, 'phER'), piEE: num(r, 'piEE'), piER: num(r, 'piER'), wht: num(r, 'wht'), net: num(r, 'net'), sssLoan: num(r, 'sssLoan'), piLoan: num(r, 'piLoan') };
      const emp = emps.find(e => row.tin && digits(e.tin) === digits(row.tin)) ?? emps.find(e => e.name.toLowerCase() === row.name.toLowerCase());
      const k = contributionsMonthly(emp?.monthlyRate ?? row.gross); const issues: string[] = [];
      if (!emp) issues.push(t('imp_noEmp'));
      const cmp = (label: string, got: number, want: number) => { if (Math.abs(got - want) > 1) issues.push(t('imp_diff', { what: label, got: peso(got), want: peso(want) })); };
      cmp('SSS EE', row.sssEE, k.sssEE); cmp('SSS ER', row.sssER, k.sssER); cmp('PhilHealth EE', row.phEE, k.phEE); cmp('PhilHealth ER', row.phER, k.phER); cmp('Pag-IBIG EE', row.piEE, k.piEE); cmp('Pag-IBIG ER', row.piER, k.piER);
      if (row.taxable > 0) { const w = withholding(row.taxable, 'monthly'); if (Math.abs(w - row.wht) > 5) issues.push(t('imp_tax', { got: peso(row.wht), want: peso(w) })); }
      return { row, emp, issues };
    }));
  };
  const save = () => { if (!checked) return; const ok = checked.filter(x => x.emp);
    const lines: Line[] = ok.map(({ row, emp }) => ({ empId: emp!.id, daily: 0, hourly: 0, mwe: false, basic: row.gross, absences: 0, ot: 0, nd: 0, holiday: 0, special: 0, restDay: 0, taxableAllowance: 0, deMinimis: 0, gross: row.gross,
      msc: contributionsMonthly(emp!.monthlyRate).msc, sssEE: row.sssEE, sssER: row.sssER, ec: row.ec, phEE: row.phEE, phER: row.phER, piEE: row.piEE, piER: row.piER, taxable: row.taxable, wht: row.wht, taxAdjustment: 0, sssLoan: row.sssLoan, pagibigLoan: row.piLoan, otherDeduction: 0,
      net: row.net || r2(row.gross - row.sssEE - row.phEE - row.piEE - row.wht) }));
    const run: Run = { id: `${cl.id}-${month}-M-imported`, clientId: cl.id, period: `${month}-M`, status: 'approved', kind: 'imported', source: cl.externalSystem || t('otherSystem'), label: t('importedFrom', { system: cl.externalSystem || t('otherSystem') }),
      hours: {}, reasons: {}, preparedBy: c.user.id, lines };
    // Human in the loop: the register takes effect (and drives the agency filings) only after a second person accepts it.
    if (submitInbound(c, { kind: 'payroll', clientId: cl.id, content: text, summary: t('inSumPayroll', { n: lines.length, month: c.monthLabel(month), client: cl.name, net: peso(r2(lines.reduce((a, l) => a + l.net, 0))) }), payload: run, control: 'payrun' }, { page: 'files', id: 'import' })) { setChecked(null); setText(''); } };
  const issues = checked?.reduce((a, x) => a + x.issues.length, 0) ?? 0;
  return (<><Why>{t('byoIntro')}</Why><section className="card"><div className="form">
    <label>{t('chooseClient')}<select value={clientId} onChange={e => { setClientId(e.target.value); setChecked(null); }}>{clients.map(x => <option key={x.id} value={x.id}>{x.name}{x.payrollSource === 'external' ? ` (${x.externalSystem || t('otherSystem')})` : ''}</option>)}</select></label>
    <label>{t('month')}<input type="month" value={month} max={iso(today()).slice(0, 7)} onChange={e => { setMonth(e.target.value); setChecked(null); }} /></label></div>
    {cl.payrollSource !== 'external' && <p className="warnbox small">{t('byoNotExternal')}</p>}
    {ownRuns && <p className="warnbox small">{t('byoOwnRuns')}</p>}
    {existing && <p className="okbox small">{t('byoExisting', { n: existing.lines?.length ?? 0, date: existing.approvedAt ?? '' })}</p>}
    <label className="block">{t('pasteRegister')}<textarea rows={6} value={text} placeholder="Employee Name,TIN,Gross Pay,Taxable Income,SSS EE,SSS ER,EC,PhilHealth EE,PhilHealth ER,Pag-IBIG EE,Pag-IBIG ER,Tax Withheld,Net Pay" onChange={e => { setText(e.target.value); setChecked(null); }} /></label>
    <div className="row"><input type="file" accept=".csv,.txt,text/csv" aria-label={t('chooseFile')} onChange={e => { const f = e.target.files?.[0]; if (f) f.text().then(x => { setText(x); setChecked(null); }); }} />
      <button className="btn small ghost" onClick={() => { setText(sampleRegister(c, cl)); setChecked(null); }}>{t('useSample')}</button>
      <span className="grow" /><button className="btn" disabled={!text.trim()} onClick={check}>{t('checkFigures')}</button></div>
    {checked && (checked.length === 0 ? <p className="bad small">{t('imp_empty')}</p> : <>
      <h3>{t('imp_result', { n: checked.length, issues })}</h3>
      <div className="scroll"><table className="tbl small"><thead><tr><th>{t('colEmployee')}</th><th className="num">{t('gross')}</th><th className="num">SSS</th><th className="num">PhilHealth</th><th className="num">Pag-IBIG</th><th className="num">{t('wht')}</th><th>{t('checks')}</th></tr></thead>
        <tbody>{checked.map((x, i) => <tr key={i}><td><b>{x.row.name}</b>{x.emp ? <div className="muted">{x.emp.position}</div> : null}</td><td className="num">{peso(x.row.gross)}</td><td className="num">{peso(r2(x.row.sssEE + x.row.sssER + x.row.ec))}</td><td className="num">{peso(r2(x.row.phEE + x.row.phER))}</td><td className="num">{peso(r2(x.row.piEE + x.row.piER))}</td><td className="num">{peso(x.row.wht)}</td>
          <td>{x.issues.length ? <ul className="bad">{x.issues.map(s => <li key={s}>{s}</li>)}</ul> : <Chip u="ok">{t('imp_ok')}</Chip>}</td></tr>)}</tbody></table></div>
      <p className="muted small">{t('imp_note')}</p>
      <div className="row end"><button className="btn" disabled={!checked.some(x => x.emp)} onClick={save}>{t('imp_save', { n: checked.filter(x => x.emp).length, month: c.monthLabel(month) })}</button></div></>)}
  </section>
  <InboundQueue c={c} kind="payroll" route={{ page: 'files', id: 'import' }} apply={(s, payload, it, reviewer) => { const run = { ...(payload as Run), approvedBy: reviewer, approvedAt: iso(today()), approvals: it.approvals };
    return { ...s, runs: [...s.runs.filter(r => r.id !== run.id), run], activity: [{ at: new Date().toISOString(), user: reviewer, clientId: it.clientId, action: 'act_imported', detail: { n: run.lines?.length ?? 0, month: run.period.slice(0, 7) } }, ...s.activity].slice(0, 300) }; }} />
  <ImportedList c={c} cl={cl} /></>);
}
function ImportedList({ c, cl }: { c: Ctx; cl: Client }) {
  const { t } = c; const runs = c.s.runs.filter(r => r.clientId === cl.id && r.kind === 'imported').sort((a, b) => b.period.localeCompare(a.period));
  if (!runs.length) return null;
  return (<section className="card"><h2>{t('importedTitle')}</h2><table className="tbl"><tbody>{runs.map(r => { const net = r2((r.lines ?? []).reduce((a, l) => a + l.net, 0)); return (
    <tr key={r.id}><td><b>{c.monthLabel(r.period.slice(0, 7))}</b><div className="muted small">{r.label}</div></td><td className="num">{t('employeesCount', { n: r.lines?.length ?? 0 })}</td><td className="num">{peso(net)}</td><td><button className="btn small ghost" onClick={() => c.go({ page: 'files' })}>{t('seeFilings')}</button></td></tr>); })}</tbody></table></section>);
}
void currentPeriod;
