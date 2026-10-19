/** Talaan Payroll: pay items, pay templates, loans, off-cycle runs (13th month, bonuses, reimbursements) and final pay. */
import { useState } from 'react';
import { EMPTY_HOURS, computeLine, r2, type Employee, type Hours } from '../engine';
import { currentPeriod, shiftPeriod, periodInfo, inPeriod, iso, refreshRun, loanBalance, leaveBalance, thirteenthDue, ytdBenefits, yearToDate, yearEnd, runKind, isRegular, hasModule,
  type Client, type Run, type PayItem, type PayItemKind, type Loan, type LoanKind, type State } from '../model';
import { Chip, Why, Tip, peso, today, saveFile, visibleClients, usersNow, PayrollTabs, type Ctx } from '../App';
import { ModuleBadge, BRAND_MARK } from './shell';

const KINDS: PayItemKind[] = ['allowance', 'deMinimis', 'deduction', 'reimbursement'];
const LOAN_KINDS: LoanKind[] = ['sss', 'pagibig', 'company', 'cashAdvance'];
const canPrepare = (c: Ctx) => c.user.role === 'firmOwner' || c.user.role === 'preparer';
const empName = (s: State, id: string) => s.employees.find(e => e.id === id)?.name ?? id;

export function RunKindChip({ c, run }: { c: Ctx; run: Run }) {
  const k = runKind(run); return <Chip u={k === 'final' ? 'late' : k === 'imported' ? 'info' : 'soon'}>{c.t('rk_' + k)}</Chip>;
}

/* ---------- Setup pages ---------- */
export function PayrollSetup({ c, tab }: { c: Ctx; tab?: string }) {
  const cur = tab ?? 'items';
  return (<><ModuleBadge c={c} m="payroll" /><div className="head"><div><h1>{c.t('navPayroll')}</h1><p className="muted">{c.t('payrollSetupSub')}</p></div></div>
    <PayrollTabs c={c} cur={cur} />
    {cur === 'items' && <PayItems c={c} />}{cur === 'templates' && <Templates c={c} />}{cur === 'loans' && <Loans c={c} />}</>);
}

function PayItems({ c }: { c: Ctx }) {
  const { t } = c; const edit = canPrepare(c);
  const upd = (id: string, p: Partial<PayItem>) => c.setS(s => ({ ...s, payItems: s.payItems.map(x => x.id === id ? { ...x, ...p } : x) }));
  const add = () => { const id = `item_${Date.now().toString(36)}`; c.setS(s => ({ ...s, payItems: [...s.payItems, { id, name: t('newItem'), kind: 'allowance', active: true }] })); };
  return (<><Why>{t('payItemsIntro')}</Why><section className="card"><div className="scroll"><table className="tbl"><thead><tr><th>{t('itemName')}</th><th>{t('itemKind')} <Tip text={t('tip_itemKind')} /></th><th>{t('itemAccount')}</th><th>{t('colStatus')}</th></tr></thead>
    <tbody>{c.s.payItems.map(x => <tr key={x.id} className={x.active === false ? 'inactive' : ''}>
      <td><input aria-label={t('itemName')} disabled={!edit} value={x.name} onChange={e => upd(x.id, { name: e.target.value.slice(0, 60) })} /></td>
      <td><select aria-label={t('itemKind')} disabled={!edit} value={x.kind} onChange={e => upd(x.id, { kind: e.target.value as PayItemKind })}>{KINDS.map(k => <option key={k} value={k}>{t('pk_' + k)}</option>)}</select><div className="muted small">{t('pkh_' + x.kind)}</div></td>
      <td><input aria-label={t('itemAccount')} disabled={!edit} placeholder={t('accDefault')} value={x.account ?? ''} onChange={e => upd(x.id, { account: e.target.value.slice(0, 20) || undefined })} style={{ maxWidth: 110 }} /></td>
      <td><label className="check"><input type="checkbox" disabled={!edit} checked={x.active !== false} onChange={e => upd(x.id, { active: e.target.checked })} /> {t('active')}</label></td></tr>)}</tbody></table></div>
    {edit && <div className="row end"><button className="btn small" onClick={add}>+ {t('addItem')}</button></div>}</section></>);
}

function Templates({ c }: { c: Ctx }) {
  const { t } = c; const clients = visibleClients(c).filter(x => hasModule(x, 'payroll'));
  const [clientId, setClientId] = useState(clients[0]?.id); const cl = c.s.clients.find(x => x.id === clientId);
  if (!cl) return <p className="muted">{t('noPayrollClients')}</p>;
  const emps = c.s.employees.filter(e => e.clientId === cl.id && e.active);
  const item = (id: string) => c.s.payItems.find(p => p.id === id);
  return (<><Why>{t('templatesIntro')}</Why><section className="card"><div className="form"><label>{t('chooseClient')}<select value={clientId} onChange={e => setClientId(e.target.value)}>{clients.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div>
    <div className="scroll"><table className="tbl"><thead><tr><th>{t('colEmployee')}</th><th>{t('templateItems')}</th><th className="num">{t('perCutoff')}</th><th></th></tr></thead>
      <tbody>{emps.map(e => { const tpl = e.template ?? []; const net = r2(tpl.reduce((a, x) => a + (item(x.itemId)?.kind === 'deduction' ? -x.amount : x.amount), 0)); return (
        <tr key={e.id}><td><b>{e.name}</b><div className="muted small">{e.position}</div></td>
          <td>{tpl.length ? <div className="tags">{tpl.map((x, i) => <span key={i} className={`tag ${item(x.itemId)?.kind ?? ''}`}>{item(x.itemId)?.name ?? x.itemId} {peso(x.amount)}</span>)}</div> : <span className="muted small">{t('noTemplate')}</span>}</td>
          <td className="num">{net ? peso(net) : '—'}</td>
          <td>{canPrepare(c) && <button className="btn small ghost" onClick={() => c.modal(<TemplateForm c={c} e={e} />)}>{t('edit')}</button>}</td></tr>); })}</tbody></table></div>
    <p className="muted small">{t('templatesNote')}</p></section></>);
}

function TemplateForm({ c, e }: { c: Ctx; e: Employee }) {
  const { t } = c; const [rows, setRows] = useState(e.template ?? []);
  const items = c.s.payItems.filter(p => p.active !== false);
  const save = () => { const clean = rows.filter(r => r.amount > 0 && items.some(p => p.id === r.itemId));
    c.setS(s => ({ ...s, employees: s.employees.map(x => x.id === e.id ? { ...x, template: clean } : x) })); c.log('act_template', { name: e.name }, e.clientId); c.modal(null); c.toast(t('saved')); };
  return (<div><h2>{t('templateFor', { name: e.name })}</h2><p className="muted small">{t('templateHelp')}</p>
    <table className="tbl small"><tbody>{rows.map((r, i) => <tr key={i}>
      <td><select aria-label={t('itemName')} value={r.itemId} onChange={x => setRows(rows.map((y, j) => j === i ? { ...y, itemId: x.target.value } : y))}>{items.map(p => <option key={p.id} value={p.id}>{p.name} ({t('pk_' + p.kind)})</option>)}</select></td>
      <td><input aria-label={t('amount')} type="number" min={0} step="0.01" value={r.amount || ''} onChange={x => setRows(rows.map((y, j) => j === i ? { ...y, amount: Math.max(0, r2(Number(x.target.value) || 0)) } : y))} /></td>
      <td><button className="btn small ghost" onClick={() => setRows(rows.filter((_, j) => j !== i))}>{t('remove')}</button></td></tr>)}</tbody></table>
    <button className="btn small ghost" onClick={() => setRows([...rows, { itemId: items[0]?.id ?? '', amount: 0 }])}>+ {t('addLine')}</button>
    <div className="row end"><button className="btn ghost" onClick={() => c.modal(null)}>{t('cancel')}</button><button className="btn" onClick={save}>{t('save')}</button></div></div>);
}

function Loans({ c }: { c: Ctx }) {
  const { t } = c; const clients = visibleClients(c);
  const loans = c.s.loans.filter(l => clients.some(x => x.id === c.s.employees.find(e => e.id === l.empId)?.clientId));
  return (<><Why>{t('loansIntro')}</Why><section className="card"><div className="row between"><h2>{t('tabLoans')}</h2>{canPrepare(c) && <button className="btn small" onClick={() => c.modal(<LoanForm c={c} />)}>+ {t('addLoan')}</button>}</div>
    {!loans.length ? <p className="muted">{t('noLoans')}</p> : <div className="scroll"><table className="tbl"><thead><tr><th>{t('colEmployee')}</th><th>{t('loanKind')}</th><th className="num">{t('principal')}</th><th className="num">{t('perCutoff')}</th><th className="num">{t('paidSoFar')}</th><th className="num">{t('balance')}</th><th>{t('colStatus')}</th><th></th></tr></thead>
      <tbody>{loans.map(l => { const bal = loanBalance(c.s, l); const e = c.s.employees.find(x => x.id === l.empId); const done = l.closed || bal <= 0; return (
        <tr key={l.id} className={done ? 'inactive' : ''}><td><b>{e?.name}</b><div className="muted small">{c.s.clients.find(x => x.id === e?.clientId)?.name}</div></td>
          <td>{t('lk_' + l.kind)}{l.note && <div className="muted small">{l.note}</div>}</td><td className="num">{peso(l.principal)}</td><td className="num">{peso(l.perPeriod)}</td>
          <td className="num">{peso(r2(l.principal - bal))}</td><td className="num"><b>{peso(bal)}</b><div className="lbar"><span style={{ width: `${Math.min(100, ((l.principal - bal) / l.principal) * 100)}%` }} /></div></td>
          <td><Chip u={done ? 'ok' : 'info'}>{done ? t('loanDone') : t('fromPeriod', { period: c.periodLabel(l.start) })}</Chip></td>
          <td>{canPrepare(c) && !done && <button className="btn small ghost" onClick={() => { c.setS(s => ({ ...s, loans: s.loans.map(x => x.id === l.id ? { ...x, closed: true } : x) })); c.toast(t('saved')); }}>{t('closeLoan')}</button>}</td></tr>); })}</tbody></table></div>}
    <p className="muted small">{t('loansNote')}</p></section></>);
}

function LoanForm({ c }: { c: Ctx }) {
  const { t } = c; const clients = visibleClients(c).filter(x => hasModule(x, 'payroll'));
  const [clientId, setClientId] = useState(clients[0]?.id ?? ''); const cl = c.s.clients.find(x => x.id === clientId)!;
  const emps = c.s.employees.filter(e => e.clientId === clientId && e.active);
  const [l, setL] = useState<Loan>({ id: `ln_${Date.now().toString(36)}`, empId: emps[0]?.id ?? '', kind: 'sss', principal: 0, perPeriod: 0, start: currentPeriod(cl.freq), createdAt: iso(today()) });
  const ok = l.empId && l.principal > 0 && l.perPeriod > 0 && l.perPeriod <= l.principal;
  const periods = [0, 1, 2].map(n => shiftPeriod(currentPeriod(cl.freq), cl.freq, n));
  const save = () => { if (!ok) return; c.setS(s => ({ ...s, loans: [...s.loans, l] })); c.log('act_loan', { name: empName(c.s, l.empId) }, clientId); c.modal(null); c.toast(t('saved')); };
  return (<div><h2>{t('addLoan')}</h2><div className="form">
    <label>{t('chooseClient')}<select value={clientId} onChange={e => { setClientId(e.target.value); const first = c.s.employees.find(x => x.clientId === e.target.value && x.active); setL({ ...l, empId: first?.id ?? '' }); }}>{clients.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label>{t('colEmployee')}<select value={l.empId} onChange={e => setL({ ...l, empId: e.target.value })}>{emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
    <label>{t('loanKind')}<select value={l.kind} onChange={e => setL({ ...l, kind: e.target.value as LoanKind })}>{LOAN_KINDS.map(k => <option key={k} value={k}>{t('lk_' + k)}</option>)}</select></label>
    <label>{t('principal')}<input type="number" min={0} step="0.01" value={l.principal || ''} onChange={e => setL({ ...l, principal: Math.max(0, r2(Number(e.target.value) || 0)) })} /></label>
    <label>{t('perCutoff')}<input type="number" min={0} step="0.01" value={l.perPeriod || ''} onChange={e => setL({ ...l, perPeriod: Math.max(0, r2(Number(e.target.value) || 0)) })} />{l.perPeriod > 0 && l.principal > 0 && <small>{t('loanCutoffs', { n: Math.ceil(l.principal / l.perPeriod) })}</small>}</label>
    <label>{t('firstCutoff')}<select value={l.start} onChange={e => setL({ ...l, start: e.target.value })}>{periods.map(p => <option key={p} value={p}>{c.periodLabel(p)}</option>)}</select></label>
    <label className="wide">{t('noteLabel')}<input value={l.note ?? ''} onChange={e => setL({ ...l, note: e.target.value.slice(0, 120) })} /></label></div>
    {l.perPeriod > l.principal && <p className="bad small">{t('loanTooBig')}</p>}
    <div className="row end"><button className="btn ghost" onClick={() => c.modal(null)}>{t('cancel')}</button><button className="btn" disabled={!ok} onClick={save}>{t('save')}</button></div></div>);
}

/* ---------- Run tools: copy, refresh, delete; what was filled in ---------- */
export function RunTools({ c, run }: { c: Ctx; run: Run }) {
  const { t } = c;
  const upd = (patch: Partial<Run>) => c.setS(s => ({ ...s, runs: s.runs.map(r => r.id === run.id ? { ...r, ...patch } : r) }));
  const prev = c.s.runs.filter(r => r.clientId === run.clientId && r.status === 'approved' && isRegular(r) && r.period < run.period).sort((a, b) => b.period.localeCompare(a.period))[0];
  const copy = () => { if (!prev) return c.toast(t('noPrevRun'));
    const keep: (keyof Hours)[] = ['absentDays', 'otHours', 'ndHours', 'regHolidayDays', 'specialDays', 'restDays'];
    const hours = Object.fromEntries(Object.entries(run.hours).map(([id, h]) => [id, { ...h, ...Object.fromEntries(keep.map(k => [k, prev.hours[id]?.[k] ?? 0])) }]));
    upd({ hours }); c.toast(t('copiedFrom', { period: c.periodLabel(prev.period) })); };
  const refresh = () => { upd(refreshRun(c.s, run)); c.toast(t('refreshed')); };
  const del = () => c.modal(<div><h2>{t('deleteDraft')}</h2><p>{t('deleteDraftQ')}</p><div className="row end"><button className="btn ghost" onClick={() => c.modal(null)}>{t('cancel')}</button>
    <button className="btn red" onClick={() => { c.setS(s => ({ ...s, runs: s.runs.filter(r => r.id !== run.id) })); c.log('act_deleted', { period: run.period }, run.clientId); c.modal(null); c.go({ page: 'payruns' }); c.toast(t('deleted')); }}>{t('deleteDraft')}</button></div></div>);
  return (<div className="runtools row"><button className="btn small ghost" disabled={!prev} onClick={copy} title={prev ? t('copyHint', { period: c.periodLabel(prev.period) }) : t('noPrevRun')}>⟲ {t('copyLast')}</button>
    <button className="btn small ghost" onClick={refresh} title={t('refreshHint')}>↻ {t('refreshRun')}</button>
    <span className="grow" /><button className="btn small ghost" onClick={del}>{t('deleteDraft')}</button></div>);
}

export function RunPrefillNote({ c, run }: { c: Ctx; run: Run }) {
  const { t } = c; const kind = runKind(run);
  if (kind === 'final') return <FinalPayNote c={c} run={run} />;
  if (kind !== 'regular') return null;
  const loans = Object.entries(run.loanApplied ?? {}).map(([id, amt]) => { const l = c.s.loans.find(x => x.id === id); return l ? `${empName(c.s, l.empId)}: ${t('lk_' + l.kind)} ${peso(amt)}` : ''; }).filter(Boolean);
  const leave = (run.leaveApplied ?? []).map(id => { const q = c.s.leaveRequests.find(x => x.id === id); const lt = q && c.s.leaveTypes.find(x => x.id === q.typeId); return q && lt ? `${empName(c.s, q.empId)}: ${lt.name.split(' (')[0]} (${q.days} ${t('daysShort')})${lt.paid ? '' : ' → ' + t('absentDays')}` : ''; }).filter(Boolean);
  const tpl = c.s.employees.filter(e => run.hours[e.id] && (e.template ?? []).length).length;
  if (!loans.length && !leave.length && !tpl) return null;
  return (<div className="prefill small"><b>{t('prefillTitle')}</b><ul>
    {tpl > 0 && <li>{t('prefillTpl', { n: tpl })}</li>}
    {loans.length > 0 && <li>{t('prefillLoans')}: {loans.join('; ')}</li>}
    {leave.length > 0 && <li>{t('prefillLeave')}: {leave.join('; ')}</li>}</ul></div>);
}

/* ---------- Off-cycle runs: 13th month, bonuses, reimbursements ---------- */
export function OffCycleForm({ c, clients }: { c: Ctx; clients: Client[] }) {
  const { t } = c; const [clientId, setClientId] = useState(clients[0]?.id); const cl = c.s.clients.find(x => x.id === clientId)!;
  const [kind, setKind] = useState<'bonus' | 'reimbursement'>('bonus'); const [label, setLabel] = useState(t('lbl13th'));
  const periods = [-1, 0, 1, 2].map(n => shiftPeriod(currentPeriod(cl.freq), cl.freq, n)); const [period, setPeriod] = useState(currentPeriod(cl.freq));
  const emps = c.s.employees.filter(e => e.clientId === clientId && inPeriod(e, period)); const [pick, setPick] = useState<Set<string> | null>(null); const chosen = pick ?? new Set(emps.map(e => e.id));
  const [fill, setFill] = useState<'thirteenth' | 'fixed' | 'blank'>('thirteenth'); const [amt, setAmt] = useState(0);
  const year = period.slice(0, 4);
  const amountFor = (e: Employee) => kind === 'reimbursement' ? 0 : fill === 'thirteenth' ? thirteenthDue(c.s, e, year).due : fill === 'fixed' ? amt : 0;
  const create = () => {
    const id = `${clientId}-${period}-${kind}-${Date.now().toString(36)}`; const ids = emps.filter(e => chosen.has(e.id)).map(e => e.id);
    const run: Run = { id, clientId: clientId!, period, status: 'draft', kind, label: label.trim() || t('rk_' + kind), empIds: ids, reasons: {}, preparedBy: c.user.id,
      hours: Object.fromEntries(ids.map(eid => [eid, { ...EMPTY_HOURS, ...(kind === 'bonus' ? { bonus: amountFor(c.s.employees.find(e => e.id === eid)!) } : {}) }])) };
    c.setS(s => ({ ...s, runs: [...s.runs, run] })); c.log('act_offcycle', { label: run.label! }, clientId); c.modal(null); c.go({ page: 'run', id, step: 2 }); };
  return (<div><h2>{t('offCycleNew')}</h2><Why>{t('offCycleIntro')}</Why><div className="form">
    <label>{t('chooseClient')}<select value={clientId} onChange={e => { setClientId(e.target.value); setPick(null); }}>{clients.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label>{t('runType')}<select value={kind} onChange={e => { const k = e.target.value as 'bonus' | 'reimbursement'; setKind(k); setLabel(k === 'bonus' ? t('lbl13th') : t('lblReimb')); }}><option value="bonus">{t('rk_bonus')}</option><option value="reimbursement">{t('rk_reimbursement')}</option></select></label>
    <label>{t('runLabel')}<input list="oc-labels" value={label} onChange={e => setLabel(e.target.value.slice(0, 60))} /><datalist id="oc-labels">{[t('lbl13th'), t('lbl14th'), t('lblMidYear'), t('lblReimb')].map(x => <option key={x} value={x} />)}</datalist></label>
    <label>{t('payInCutoff')}<select value={period} onChange={e => setPeriod(e.target.value)}>{periods.map(p => <option key={p} value={p}>{c.periodLabel(p)}</option>)}</select><small>{t('payDate', { date: c.fmt(periodInfo(period).payDate) })}</small></label>
    {kind === 'bonus' && <label>{t('fillWith')}<select value={fill} onChange={e => setFill(e.target.value as typeof fill)}><option value="thirteenth">{t('fill13th')}</option><option value="fixed">{t('fillFixed')}</option><option value="blank">{t('fillBlank')}</option></select></label>}
    {kind === 'bonus' && fill === 'fixed' && <label>{t('amount')}<input type="number" min={0} value={amt || ''} onChange={e => setAmt(Math.max(0, r2(Number(e.target.value) || 0)))} /></label>}</div>
    <h3>{t('employees')} ({chosen.size}/{emps.length})</h3>
    <div className="scroll" style={{ maxHeight: 260 }}><table className="tbl small"><tbody>{emps.map(e => { const d = thirteenthDue(c.s, e, year); return (<tr key={e.id}>
      <td><label className="check"><input type="checkbox" checked={chosen.has(e.id)} onChange={() => { const x = new Set(chosen); if (x.has(e.id)) x.delete(e.id); else x.add(e.id); setPick(x); }} /> {e.name}</label></td>
      {kind === 'bonus' && <td className="muted">{t('basicEarned')} {peso(d.basicEarned)} · {t('benefitsPaid')} {peso(ytdBenefits(c.s, e.id, year))}</td>}
      {kind === 'bonus' && <td className="num"><b>{peso(amountFor(e))}</b></td>}</tr>); })}</tbody></table></div>
    {kind === 'bonus' && <p className="muted small">{t('bonusTaxNote')}</p>}
    <div className="row end"><button className="btn ghost" onClick={() => c.modal(null)}>{t('cancel')}</button><button className="btn" disabled={!chosen.size} onClick={create}>{t('createRun')}</button></div></div>);
}

/* ---------- Final pay ---------- */
const workdaysBetween = (from: Date, to: Date, six: boolean) => { let n = 0; const d = new Date(from); while (d <= to) { const w = d.getDay(); if (w !== 0 && (six || w !== 6)) n++; d.setDate(d.getDate() + 1); } return n; };
export function finalPayHours(s: State, cl: Client, e: Employee, sep: string) {
  const period = currentPeriod(cl.freq, new Date(sep + 'T00:00')); const { end } = periodInfo(period); const year = period.slice(0, 4);
  const daily = (e.monthlyRate * 12) / e.workdays; const per = cl.freq === 'semi' ? 2 : 1;
  const after = new Date(sep + 'T00:00'); after.setDate(after.getDate() + 1);
  const absentDays = Math.min(e.workdays === 313 ? 13 : 11, workdaysBetween(after, end, e.workdays === 313));
  const thisBasic = Math.max(0, e.monthlyRate / per - absentDays * daily);
  const d13 = thirteenthDue(s, e, year); const bonus = r2(Math.max(0, (d13.basicEarned + thisBasic) / 12 - ytdBenefits(s, e.id, year)));
  const leaveDays = r2(s.leaveTypes.filter(lt => lt.convertible && lt.active !== false).reduce((a, lt) => a + leaveBalance(s, e.id, lt.id, Number(year)).left, 0));
  const leaveConversion = r2(leaveDays * daily);
  const h: Hours = { ...EMPTY_HOURS, absentDays, bonus, leaveDays, leaveConversion };
  const line = computeLine(e, h, cl.freq, cl.minWage, { ytdBenefits: ytdBenefits(s, e.id, year) });
  const op = e.opening?.year === Number(year) ? e.opening : undefined;
  const y = yearEnd(e.id, [...yearToDate(s, e.id, year), line], 0, op?.taxable ?? 0, op?.withheld ?? 0, op?.gross ?? 0);
  return { period, hours: { ...h, taxAdjustment: y.difference }, parts: { absentDays, bonus, leaveDays, leaveConversion, taxAdjustment: y.difference, daily: r2(daily) } };
}
export function FinalPayForm({ c, clients }: { c: Ctx; clients: Client[] }) {
  const { t } = c; const [clientId, setClientId] = useState(clients[0]?.id); const cl = c.s.clients.find(x => x.id === clientId)!;
  const emps = c.s.employees.filter(e => e.clientId === clientId && e.active && !e.separationDate);
  const [empId, setEmpId] = useState(emps[0]?.id ?? ''); const e = c.s.employees.find(x => x.id === empId);
  const [sep, setSep] = useState(iso(today())); const [reason, setReason] = useState('resigned');
  const calc = e ? finalPayHours(c.s, cl, e, sep) : null;
  const create = () => { if (!e || !calc) return; const id = `${clientId}-${calc.period}-final-${e.id}`;
    if (c.s.runs.some(r => r.id === id)) return c.go({ page: 'run', id });
    const run: Run = { id, clientId: clientId!, period: calc.period, status: 'draft', kind: 'final', label: `${t('rk_final')}: ${e.name}`, empIds: [e.id], reasons: {}, preparedBy: c.user.id, hours: { [e.id]: calc.hours } };
    c.setS(s => ({ ...s, runs: [...s.runs, run], employees: s.employees.map(x => x.id === e.id ? { ...x, separationDate: sep, separationReason: reason } : x) }));
    c.log('act_finalpay', { name: e.name }, clientId); c.modal(null); c.go({ page: 'run', id, step: 2 }); };
  return (<div><h2>{t('finalPayNew')}</h2><Why>{t('finalPayIntro')}</Why><div className="form">
    <label>{t('chooseClient')}<select value={clientId} onChange={x => { setClientId(x.target.value); setEmpId(c.s.employees.find(y => y.clientId === x.target.value && y.active && !y.separationDate)?.id ?? ''); }}>{clients.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label>{t('colEmployee')}<select value={empId} onChange={x => setEmpId(x.target.value)}>{emps.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label>{t('lastDay')}<input type="date" value={sep} onChange={x => setSep(x.target.value)} /></label>
    <label>{t('sepReason')}<select value={reason} onChange={x => setReason(x.target.value)}>{['resigned', 'endContract', 'retired', 'terminated', 'redundancy'].map(k => <option key={k} value={k}>{t('sr_' + k)}</option>)}</select></label></div>
    {calc && <table className="tbl small"><tbody>
      <tr><td>{t('fpLastSalary', { period: c.periodLabel(calc.period) })}</td><td className="num">{t('fpAbsentAfter', { n: calc.parts.absentDays })}</td></tr>
      <tr><td>{t('fp13th')}</td><td className="num">{peso(calc.parts.bonus)}</td></tr>
      <tr><td>{t('fpLeave', { n: calc.parts.leaveDays })}</td><td className="num">{peso(calc.parts.leaveConversion)}</td></tr>
      <tr><td>{t('fpTax')}</td><td className="num">{calc.parts.taxAdjustment < 0 ? `(${peso(-calc.parts.taxAdjustment)})` : peso(calc.parts.taxAdjustment)}</td></tr></tbody></table>}
    <p className="muted small">{t('finalPayNote')}</p>
    <div className="row end"><button className="btn ghost" onClick={() => c.modal(null)}>{t('cancel')}</button><button className="btn" disabled={!e} onClick={create}>{t('createRun')}</button></div></div>);
}

function FinalPayNote({ c, run }: { c: Ctx; run: Run }) {
  const { t } = c; const e = c.s.employees.find(x => x.id === run.empIds?.[0]); const cl = c.s.clients.find(x => x.id === run.clientId)!;
  if (!e) return null;
  const coe = () => saveFile(c, `${cl.id}_COE_${e.name.replace(/\W+/g, '_')}.html`, coeHtml(c, e, cl), { plain: true });
  return (<div className="prefill small"><b>{t('finalPayFor', { name: e.name, date: e.separationDate ?? '' })}</b>
    <ul><li>{t('fpChecklist1')}</li><li>{t('fpChecklist2')}</li><li>{t('fpChecklist3')}</li></ul>
    <div className="row"><button className="btn small ghost" onClick={coe}>{t('coeDownload')}</button><span className="muted">{t('sr_' + (e.separationReason ?? 'resigned'))}</span></div></div>);
}
function coeHtml(c: Ctx, e: Employee, cl: Client) {
  const signer = usersNow().find(u => u.role === 'client' && u.clientId === cl.id)?.name ?? `${cl.name} authorised signatory`;
  const d = (x?: string) => x ? new Date(x + 'T00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Certificate of Employment</title></head><body style="font-family:Georgia,serif;max-width:640px;margin:48px auto;line-height:1.7">
<p style="text-align:right">${d(iso(today()))}</p><h1 style="text-align:center;letter-spacing:2px">CERTIFICATE OF EMPLOYMENT</h1>
<p>This is to certify that <b>${e.name}</b> was employed by <b>${cl.name}</b>${cl.ids?.address ? `, ${cl.ids.address}` : ''}, as <b>${e.position}</b> from <b>${d(e.hireDate)}</b> to <b>${d(e.separationDate)}</b>.</p>
<p>This certification is issued upon the request of the employee for whatever legal purpose it may serve.</p>
<p style="margin-top:64px">______________________________<br>${signer}<br>${cl.name}</p>
<p style="font-size:12px;color:#666;margin-top:40px"><img src="${BRAND_MARK}" alt="" width="16" height="16" style="vertical-align:middle"> Prepared in Talaan. Under DOLE Labor Advisory No. 06-2020, a certificate of employment is issued within three days of the employee's request. Check with the employer's adviser before release.</p></body></html>`;
}
