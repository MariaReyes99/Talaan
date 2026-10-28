/** Talaan HR: leave (types, balances, requests and approval), employee history and notes, employee self-service. */
import { useState } from 'react';
import { r2, type Employee } from '../engine';
import { iso, leaveBalance, daysBetween, hasModule, type LeaveRequest, type LeaveType, type State, type EmpChange } from '../model';
import { Chip, Why, peso, today, visibleClients, usersNow, type Ctx } from '../App';
import { ModuleBadge } from './shell';

const canManage = (c: Ctx) => c.user.role === 'firmOwner' || c.user.role === 'preparer';
const canDecide = (c: Ctx, empClientId: string) => c.user.role === 'firmOwner' || (c.user.role === 'client' && c.user.clientId === empClientId);
const typeName = (s: State, id: string) => (s.leaveTypes.find(x => x.id === id)?.name ?? id).split(' (')[0];
const userName = (id: string) => usersNow().find(u => u.id === id)?.name ?? id;

export function HR({ c, tab }: { c: Ctx; tab?: string }) {
  const { t } = c; const cur = tab ?? 'requests';
  const pending = c.s.leaveRequests.filter(q => q.status === 'pending' && visibleClients(c).some(x => x.id === c.s.employees.find(e => e.id === q.empId)?.clientId)).length;
  const tabs: [string, string][] = [['requests', 'tabLeaveRequests'], ['balances', 'tabBalances'], ['people', 'tabPeople'], ['types', 'tabLeaveTypes']];
  return (<><ModuleBadge c={c} m="hr" /><div className="head"><div><h1>{t('navHR')}</h1><p className="muted">{t('hrSub')}</p></div>{canManage(c) && <button className="btn" onClick={() => c.modal(<LeaveForm c={c} />)}>+ {t('fileLeave')}</button>}</div>
    <div className="pills tabs" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={cur === k} aria-pressed={cur === k} onClick={() => c.go({ page: 'hr', id: k })}>{t(l)}{k === 'requests' && pending > 0 && <span>{pending}</span>}</button>)}</div>
    {cur === 'requests' && <Requests c={c} />}{cur === 'balances' && <Balances c={c} />}{cur === 'people' && <People c={c} />}{cur === 'types' && <LeaveTypes c={c} />}</>);
}

function hrClients(c: Ctx) { return visibleClients(c).filter(x => hasModule(x, 'hr')); }

function Requests({ c }: { c: Ctx }) {
  const { t } = c; const clients = hrClients(c); const [show, setShow] = useState<'pending' | 'all'>('pending');
  const reqs = c.s.leaveRequests.filter(q => clients.some(x => x.id === c.s.employees.find(e => e.id === q.empId)?.clientId) && (show === 'all' || q.status === 'pending')).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  return (<><Why>{t('leaveIntro')}</Why><section className="card"><div className="row between"><div className="seg">{(['pending', 'all'] as const).map(k => <button key={k} aria-pressed={show === k} onClick={() => setShow(k)}>{t('show_' + k)}</button>)}</div></div>
    {!reqs.length ? <p className="muted">{t('noLeave')}</p> : <div className="scroll"><table className="tbl"><thead><tr><th>{t('colEmployee')}</th><th>{t('leaveType')}</th><th>{t('dates')}</th><th className="num">{t('days')}</th><th>{t('colStatus')}</th><th></th></tr></thead>
      <tbody>{reqs.map(q => <ReqRow key={q.id} c={c} q={q} />)}</tbody></table></div>}</section></>);
}
function ReqRow({ c, q }: { c: Ctx; q: LeaveRequest }) {
  const { t } = c; const e = c.s.employees.find(x => x.id === q.empId); const lt = c.s.leaveTypes.find(x => x.id === q.typeId);
  if (!e) return null; const bal = leaveBalance(c.s, e.id, q.typeId, Number(q.from.slice(0, 4)));
  const decide = (status: 'approved' | 'rejected') => { c.setS(s => ({ ...s, leaveRequests: s.leaveRequests.map(x => x.id === q.id ? { ...x, status, decidedBy: c.user.id, decidedAt: new Date().toISOString() } : x) }));
    c.log(status === 'approved' ? 'act_leaveOk' : 'act_leaveNo', { name: e.name }, e.clientId);
    const emp = usersNow().find(u => u.empId === e.id); if (emp) c.notify([emp.id], status === 'approved' ? 'n_leaveOk' : 'n_leaveNo', { type: typeName(c.s, q.typeId), from: q.from }, { page: 'myleave' });
    c.toast(t(status === 'approved' ? 'leaveApproved' : 'leaveRejected')); };
  const over = lt && lt.days > 0 && q.status === 'pending' && q.days > bal.left;
  return (<tr><td><b>{e.name}</b><div className="muted small">{c.s.clients.find(x => x.id === e.clientId)?.name}</div></td>
    <td>{typeName(c.s, q.typeId)}{lt && !lt.paid && <div><Chip u="soon">{t('unpaid')}</Chip></div>}</td>
    <td>{q.from === q.to ? q.from : `${q.from} → ${q.to}`}{q.reason && <div className="muted small">{q.reason}</div>}</td><td className="num">{q.days}</td>
    <td><Chip u={q.status === 'approved' ? 'ok' : q.status === 'rejected' ? 'late' : 'soon'}>{t('ls_' + q.status)}</Chip>{q.decidedBy && <div className="muted small">{userName(q.decidedBy)}</div>}
      {over && <div className="bad small">{t('overBalance', { n: bal.left })}</div>}</td>
    <td>{q.status === 'pending' && canDecide(c, e.clientId) && <div className="row"><button className="btn small green" onClick={() => decide('approved')}>{t('approve')}</button><button className="btn small ghost" onClick={() => decide('rejected')}>{t('reject')}</button></div>}
      {q.status === 'pending' && !canDecide(c, e.clientId) && <span className="muted small">{t('waitingClient')}</span>}</td></tr>);
}

function Balances({ c }: { c: Ctx }) {
  const { t } = c; const clients = hrClients(c); const [clientId, setClientId] = useState(clients[0]?.id); const year = today().getFullYear();
  const types = c.s.leaveTypes.filter(x => x.active !== false && x.days > 0 && x.days < 60);
  const emps = c.s.employees.filter(e => e.clientId === clientId && e.active);
  return (<><Why>{t('balancesIntro')}</Why><section className="card"><div className="form"><label>{t('chooseClient')}<select value={clientId} onChange={e => setClientId(e.target.value)}>{clients.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div>
    <div className="scroll"><table className="tbl"><thead><tr><th>{t('colEmployee')}</th>{types.map(x => <th key={x.id} className="num">{x.name.split(' (')[0]}</th>)}</tr></thead>
      <tbody>{emps.map(e => <tr key={e.id}><td><b>{e.name}</b><div className="muted small">{e.department}</div></td>{types.map(x => { const b = leaveBalance(c.s, e.id, x.id, year); return <td key={x.id} className="num"><b>{b.left}</b><span className="muted small"> / {b.entitled}</span>{b.pending > 0 && <div className="warn small">{t('pendingN', { n: b.pending })}</div>}</td>; })}</tr>)}</tbody></table></div>
    <p className="muted small">{t('balancesNote')}</p></section></>);
}

function LeaveTypes({ c }: { c: Ctx }) {
  const { t } = c; const edit = c.user.role === 'firmOwner';
  const upd = (id: string, p: Partial<LeaveType>) => c.setS(s => ({ ...s, leaveTypes: s.leaveTypes.map(x => x.id === id ? { ...x, ...p } : x) }));
  return (<><Why>{t('leaveTypesIntro')}</Why><section className="card"><div className="scroll"><table className="tbl"><thead><tr><th>{t('leaveType')}</th><th className="num">{t('daysPerYear')}</th><th>{t('paidQ')}</th><th>{t('convertibleQ')}</th><th>{t('colStatus')}</th></tr></thead>
    <tbody>{c.s.leaveTypes.map(x => <tr key={x.id} className={x.active === false ? 'inactive' : ''}><td><input aria-label={t('leaveType')} disabled={!edit} value={x.name} onChange={e => upd(x.id, { name: e.target.value.slice(0, 80) })} /></td>
      <td className="num"><input aria-label={t('daysPerYear')} type="number" min={0} max={365} disabled={!edit} value={x.days} onChange={e => upd(x.id, { days: Math.max(0, Math.min(365, Number(e.target.value) || 0)) })} style={{ maxWidth: 80 }} /></td>
      <td><input type="checkbox" aria-label={t('paidQ')} disabled={!edit} checked={x.paid} onChange={e => upd(x.id, { paid: e.target.checked })} /></td>
      <td><input type="checkbox" aria-label={t('convertibleQ')} disabled={!edit} checked={x.convertible} onChange={e => upd(x.id, { convertible: e.target.checked })} /></td>
      <td><label className="check"><input type="checkbox" disabled={!edit} checked={x.active !== false} onChange={e => upd(x.id, { active: e.target.checked })} /> {t('active')}</label></td></tr>)}</tbody></table></div>
    {edit && <div className="row end"><button className="btn small" onClick={() => c.setS(s => ({ ...s, leaveTypes: [...s.leaveTypes, { id: `lt_${Date.now().toString(36)}`, name: t('newLeaveType'), days: 0, paid: true, convertible: false, active: true }] }))}>+ {t('addLeaveType')}</button></div>}
    <p className="muted small">{t('leaveLawNote')}</p></section></>);
}

function People({ c }: { c: Ctx }) {
  const { t } = c; const clients = hrClients(c); const [clientId, setClientId] = useState(clients[0]?.id);
  const emps = c.s.employees.filter(e => e.clientId === clientId);
  const years = (e: Employee) => e.hireDate ? r2(daysBetween(new Date(e.hireDate + 'T00:00'), today()) / 365.25) : 0;
  return (<><Why>{t('peopleIntro')}</Why><section className="card"><div className="form"><label>{t('chooseClient')}<select value={clientId} onChange={e => setClientId(e.target.value)}>{clients.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div>
    <div className="scroll"><table className="tbl"><thead><tr><th>{t('colEmployee')}</th><th>{t('department')}</th><th>{t('hireDate')}</th><th className="num">{t('tenure')}</th><th>{t('lastChange')}</th><th></th></tr></thead>
      <tbody>{emps.map(e => { const h = (c.s.empHistory[e.id] ?? [])[0]; return (<tr key={e.id} className={e.separationDate ? 'inactive' : ''}><td><b>{e.name}</b><div className="muted small">{e.position}</div>{e.separationDate && <Chip u="info">{t('separatedOn', { date: e.separationDate })}</Chip>}</td>
        <td>{e.department ?? '—'}</td><td>{e.hireDate ?? '—'}</td><td className="num">{years(e) ? t('yearsN', { n: years(e).toFixed(1) }) : '—'}</td>
        <td className="small">{h ? <>{t('fld_' + h.field)}: {fmtVal(h.field, h.from)} → {fmtVal(h.field, h.to)}<div className="muted">{h.at.slice(0, 10)}</div></> : <span className="muted">—</span>}</td>
        <td><button className="btn small ghost" onClick={() => c.modal(<EmployeeHistory c={c} e={e} />)}>{t('historyNotes')}</button></td></tr>); })}</tbody></table></div></section></>);
}

const fmtVal = (field: string, v: string) => field === 'monthlyRate' && v && !isNaN(Number(v)) ? peso(Number(v)) : (v || '—');
const TRACKED: (keyof Employee)[] = ['name', 'position', 'monthlyRate', 'department', 'bankAccount', 'payout', 'tin', 'sss', 'philhealth', 'pagibig', 'hireDate', 'separationDate'];
/** Records who changed what on an employee and why. Bank and ID numbers are masked in the history. */
export function logEmployeeChanges(s: State, before: Employee | undefined, after: Employee, user: string, reason: string): State {
  if (!before) return { ...s, empHistory: { ...s.empHistory, [after.id]: [{ at: new Date().toISOString(), user, field: 'created', from: '', to: after.position }] } };
  const mask = (k: string, v: unknown) => ['bankAccount', 'tin', 'sss', 'philhealth', 'pagibig'].includes(k) && v ? `•••${String(v).replace(/\D/g, '').slice(-4)}` : String(v ?? '');
  const changes: EmpChange[] = TRACKED.filter(k => String(before[k] ?? '') !== String(after[k] ?? '')).map(k => ({ at: new Date().toISOString(), user, field: k, from: mask(k, before[k]), to: mask(k, after[k]), ...(reason ? { reason } : {}) }));
  if (!changes.length) return s;
  return { ...s, empHistory: { ...s.empHistory, [after.id]: [...changes, ...(s.empHistory[after.id] ?? [])].slice(0, 100) } };
}

export function EmployeeHistory({ c, e }: { c: Ctx; e: Employee }) {
  const { t } = c; const hist = c.s.empHistory[e.id] ?? []; const notes = c.s.notes[`emp:${e.id}`] ?? []; const [text, setText] = useState('');
  const year = today().getFullYear(); const types = c.s.leaveTypes.filter(x => x.active !== false && x.days > 0 && x.days < 60);
  const add = () => { if (text.trim().length < 2) return; c.setS(s => ({ ...s, notes: { ...s.notes, [`emp:${e.id}`]: [...(s.notes[`emp:${e.id}`] ?? []), { at: new Date().toISOString(), user: c.user.id, text: text.trim().slice(0, 500) }] } })); setText(''); };
  return (<div><h2>{e.name}</h2><p className="muted">{e.position}{e.department ? ` · ${e.department}` : ''} · {c.s.clients.find(x => x.id === e.clientId)?.name}</p>
    {hasModule(c.s.clients.find(x => x.id === e.clientId)!, 'hr') && <><h3>{t('tabBalances')}</h3><div className="tags">{types.map(x => { const b = leaveBalance(c.s, e.id, x.id, year); return <span key={x.id} className="tag">{x.name.split(' (')[0]}: <b>{b.left}</b>/{b.entitled}</span>; })}</div></>}
    <h3>{t('history')}</h3>{!hist.length ? <p className="muted small">{t('noHistory')}</p> : <ul className="activity">{hist.map((h, i) => <li key={i}><span className="grow"><b>{userName(h.user)}</b> {h.field === 'created' ? t('histCreated') : <>{t('fld_' + h.field)}: {fmtVal(h.field, h.from)} → <b>{fmtVal(h.field, h.to)}</b></>}{h.reason && <div className="muted small">“{h.reason}”</div>}</span><span className="muted small">{h.at.slice(0, 10)}</span></li>)}</ul>}
    <h3>{t('notesTitle')}</h3>{notes.map((n, i) => <p key={i} className="small"><b>{userName(n.user)}</b> <span className="muted">{n.at.slice(0, 10)}</span><br />{n.text}</p>)}
    {c.user.role !== 'employee' && <div className="row"><input className="grow" value={text} placeholder={t('addNotePh')} onChange={x => setText(x.target.value)} /><button className="btn small" onClick={add}>{t('addNote')}</button></div>}
    <div className="row end"><button className="btn" onClick={() => c.modal(null)}>{t('close')}</button></div></div>);
}

/* ---------- Filing leave (staff) and self-service (employee) ---------- */
function LeaveForm({ c, empId: fixed }: { c: Ctx; empId?: string }) {
  const { t } = c; const clients = hrClients(c);
  const [empId, setEmpId] = useState(fixed ?? c.s.employees.find(e => clients.some(x => x.id === e.clientId) && e.active)?.id ?? '');
  const [typeId, setTypeId] = useState('vl'); const [from, setFrom] = useState(iso(today())); const [to, setTo] = useState(iso(today())); const [reason, setReason] = useState('');
  const span = from && to && to >= from ? daysBetween(new Date(from + 'T00:00'), new Date(to + 'T00:00')) + 1 : 0; const [days, setDays] = useState<number | null>(null); const n = days ?? span;
  const e = c.s.employees.find(x => x.id === empId); const lt = c.s.leaveTypes.find(x => x.id === typeId); const bal = e ? leaveBalance(c.s, e.id, typeId, Number(from.slice(0, 4))) : null;
  const over = !!(lt && lt.days > 0 && bal && n > bal.left);
  const ok = e && lt && n > 0 && n <= span && !(over && fixed);
  const save = () => { if (!ok || !e) return; const auto = !fixed && canDecide(c, e.clientId);
    const q: LeaveRequest = { id: `lv_${Date.now().toString(36)}`, empId: e.id, typeId, from, to, days: r2(n), reason: reason.trim() || undefined, status: auto ? 'approved' : 'pending', requestedBy: c.user.id, requestedAt: new Date().toISOString(), ...(auto ? { decidedBy: c.user.id, decidedAt: new Date().toISOString() } : {}) };
    c.setS(s => ({ ...s, leaveRequests: [q, ...s.leaveRequests] })); c.log('act_leave', { name: e.name }, e.clientId);
    if (!auto) { const approvers = usersNow().filter(u => u.active !== false && (u.role === 'firmOwner' || (u.role === 'client' && u.clientId === e.clientId))).map(u => u.id);
      c.notify(approvers, 'n_leaveReq', { name: e.name, type: typeName(c.s, typeId), days: q.days }, { page: 'hr', id: 'requests' }); }
    c.modal(null); c.toast(t(auto ? 'leaveApproved' : 'leaveSent')); };
  const pool = c.s.employees.filter(x => clients.some(cl => cl.id === x.clientId) && x.active);
  return (<div><h2>{fixed ? t('requestLeave') : t('fileLeave')}</h2><div className="form">
    {!fixed && <label>{t('colEmployee')}<select value={empId} onChange={x => setEmpId(x.target.value)}>{pool.map(x => <option key={x.id} value={x.id}>{x.name} ({c.s.clients.find(cl => cl.id === x.clientId)?.name})</option>)}</select></label>}
    <label>{t('leaveType')}<select value={typeId} onChange={x => setTypeId(x.target.value)}>{c.s.leaveTypes.filter(x => x.active !== false).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>{bal && lt && lt.days > 0 && <small>{t('balanceLeft', { n: bal.left, m: bal.entitled })}</small>}</label>
    <label>{t('fromDate')}<input type="date" value={from} onChange={x => { setFrom(x.target.value); if (to < x.target.value) setTo(x.target.value); setDays(null); }} /></label>
    <label>{t('toDate')}<input type="date" min={from} value={to} onChange={x => { setTo(x.target.value); setDays(null); }} /></label>
    <label>{t('days')}<input type="number" min={0.5} step={0.5} max={span} value={n || ''} onChange={x => setDays(Math.max(0, Math.min(span, Number(x.target.value) || 0)))} /><small>{t('daysHint')}</small></label>
    <label className="wide">{t('reasonOpt')}<input value={reason} onChange={x => setReason(x.target.value.slice(0, 200))} /></label></div>
    {over && <p className={fixed ? 'bad small' : 'warn small'}>{t('overBalance', { n: bal!.left })}</p>}
    {lt && !lt.paid && <p className="warn small">{t('unpaidNote')}</p>}
    <div className="row end"><button className="btn ghost" onClick={() => c.modal(null)}>{t('cancel')}</button><button className="btn" disabled={!ok} onClick={save}>{fixed ? t('sendRequest') : t('save')}</button></div></div>);
}

export function MyLeave({ c }: { c: Ctx }) {
  const { t } = c; const empId = c.user.empId ?? ''; const e = c.s.employees.find(x => x.id === empId); const year = today().getFullYear();
  if (!e) return <p className="muted">{t('noEmployeeLink')}</p>;
  const types = c.s.leaveTypes.filter(x => x.active !== false && x.days > 0 && x.days < 60);
  const mine = c.s.leaveRequests.filter(q => q.empId === empId).sort((a, b) => b.from.localeCompare(a.from));
  return (<><div className="head"><div><h1>{t('myLeave')}</h1><p className="muted">{e.name} · {c.s.clients.find(x => x.id === e.clientId)?.name}</p></div><button className="btn" onClick={() => c.modal(<LeaveForm c={c} empId={empId} />)}>+ {t('requestLeave')}</button></div>
    <div className="stats">{types.map(x => { const b = leaveBalance(c.s, empId, x.id, year); return <div key={x.id}><span>{x.name.split(' (')[0]}</span><b>{b.left} <small className="muted">/ {b.entitled}</small></b>{b.pending > 0 && <small className="warn">{t('pendingN', { n: b.pending })}</small>}</div>; })}</div>
    <section className="card"><h2>{t('myRequests')}</h2>{!mine.length ? <p className="muted">{t('noLeave')}</p> : <table className="tbl"><tbody>{mine.map(q => <tr key={q.id}><td><b>{typeName(c.s, q.typeId)}</b><div className="muted small">{q.reason}</div></td><td>{q.from === q.to ? q.from : `${q.from} → ${q.to}`}</td><td className="num">{q.days} {t('daysShort')}</td><td><Chip u={q.status === 'approved' ? 'ok' : q.status === 'rejected' ? 'late' : 'soon'}>{t('ls_' + q.status)}</Chip></td>
      <td>{q.status === 'pending' && <button className="btn small ghost" onClick={() => c.setS(s => ({ ...s, leaveRequests: s.leaveRequests.filter(x => x.id !== q.id) }))}>{t('withdraw')}</button>}</td></tr>)}</tbody></table>}</section></>);
}
