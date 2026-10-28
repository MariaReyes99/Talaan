/** Double approval screens: change requests (salary, bank details, pay tables, roles), the approvals inbox and the approval matrix. */
import { useState } from 'react';
import { POLICY, MATRIX, ALLOWED_DUTIES, addApproval, canApprove, eligible, nextDuty, strands, unstaffed, dutiesOf, type ChangeRequest, type Control } from '../approvals';
import { applyChange } from '../changes';
import { fingerprint } from '../integrations';
import { Chip, Why, saveFile, today, usersNow, visibleClients, type Ctx } from '../App';
import { iso } from '../model';

const nameOf = (id?: string) => usersNow().find(u => u.id === id)?.name ?? id ?? '';
const ctxOf = (r: ChangeRequest) => ({ requesters: [r.requestedBy], approvals: r.approvals, clientId: r.clientId });

/** Records a change for double approval. Nothing changes until the last approval; the requester is told who must approve. */
export function requestChange(c: Ctx, x: { control: Control; clientId?: string; subject: string; title: string; lines: string[]; payload: unknown; reason?: string }) {
  const { t } = c; const id = `chg_${Date.now().toString(36)}`;
  const req: ChangeRequest = { id, ...x, hash: fingerprint(JSON.stringify(x.payload)), requestedBy: c.user.id, requestedAt: new Date().toISOString(), approvals: [], status: 'pending' };
  const to = eligible(usersNow(), x.control, ctxOf(req));
  c.setS(s => ({ ...s, changes: [req, ...(s.changes ?? []).filter(r => !(r.status === 'pending' && r.subject === x.subject && r.control === x.control && r.requestedBy === c.user.id))].slice(0, 500) }));
  c.notify(to.map(u => u.id), 'n_chgRequested', { name: c.user.name, what: x.title }, { page: 'home' });
  to.forEach(u => u.email && c.email([u.email], t('em_chg_subj', { what: x.title }), t('em_chg_body', { name: u.name, who: c.user.name, what: x.title, lines: x.lines.join('\n'), firm: c.s.billing.firmName }), 'approval', x.clientId));
  c.log('act_chgRequested', { what: x.title }, x.clientId);
  c.toast(to.length ? t('chgSent', { names: to.map(u => u.name).join(', ') }) : t('apNobody'));
}

function decide(c: Ctx, r: ChangeRequest, ok: boolean, reason?: string) {
  const { t } = c; if (!canApprove(c.user, r.control, ctxOf(r))) return;
  if (!ok) { c.setS(s => ({ ...s, changes: (s.changes ?? []).map(x => x.id === r.id ? { ...x, status: 'returned', returned: { by: c.user.id, at: new Date().toISOString(), reason: reason ?? '' } } : x) }));
    c.notify([r.requestedBy], 'n_chgReturned', { name: c.user.name, what: r.title, reason: reason ?? '' }, { page: 'home' }); c.log('act_chgReturned', { what: r.title }, r.clientId); return; }
  const { item, done } = addApproval(r, r.control, c.user.id);
  if (!done) { c.setS(s => ({ ...s, changes: (s.changes ?? []).map(x => x.id === r.id && x.approvals.length === r.approvals.length ? item : x) }));
    const next = eligible(usersNow(), r.control, ctxOf(item)); c.notify(next.map(u => u.id), 'n_chgRequested', { name: nameOf(r.requestedBy), what: r.title }, { page: 'home' });
    c.notify([r.requestedBy], 'n_chgStep', { name: c.user.name, what: r.title }, { page: 'home' }); c.log('act_chgApproved', { what: r.title }, r.clientId); c.toast(t('apStepDone')); return; }
  const stale = !applyChange(c.s, item);
  c.setS(s => { const cur = (s.changes ?? []).find(x => x.id === r.id); if (!cur || cur.status !== 'pending' || cur.approvals.length !== r.approvals.length) return s;
    const applied = applyChange(s, item); const base = applied ?? s;
    return { ...base, changes: (base.changes ?? []).map(x => x.id === r.id ? { ...item, status: applied ? 'approved' : 'stale', appliedAt: applied ? new Date().toISOString() : undefined } : x) }; });
  c.notify([r.requestedBy], 'n_chgApproved', { name: c.user.name, what: r.title }, { page: 'home' }); c.log('act_chgApproved', { what: r.title }, r.clientId);
  c.toast(stale ? t('chgStale') : t('chgApplied'));
}

function ChangeRow({ c, r }: { c: Ctx; r: ChangeRequest }) {
  const { t } = c; const [why, setWhy] = useState<string | null>(null); const may = r.status === 'pending' && canApprove(c.user, r.control, ctxOf(r));
  const missing = r.status === 'pending' ? unstaffed(usersNow(), r.control, ctxOf(r)) : [];
  return (<li><div className="row between"><span className="grow"><b>{r.title}</b> <Chip u={r.status === 'approved' ? 'ok' : r.status === 'pending' ? 'soon' : 'late'}>{t('chg_' + r.status)}</Chip>
      <div className="muted small">{t('ctl_' + r.control)} · {t('chgBy', { name: nameOf(r.requestedBy) })} · {new Date(r.requestedAt).toLocaleDateString()}{r.reason ? ` · “${r.reason}”` : ''}</div></span></div>
    <ul className="small">{r.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
    <ol className="apsteps small">{POLICY[r.control].map((d, i) => { const a = r.approvals[i]; return <li key={i} className={a ? 'done' : r.status === 'pending' && i === r.approvals.length ? 'cur' : ''}>{t('duty_' + d)}{a ? ` · ✓ ${nameOf(a.by)}` : ''}</li>; })}</ol>
    {r.returned && <p className="bad small">{t('chgReturnedBy', { name: nameOf(r.returned.by), reason: r.returned.reason })}</p>}
    {missing.length > 0 && <p className="warn small">{t('apNobody')}</p>}
    {may && strands(usersNow(), r.control, ctxOf(r), c.user.id) && <p className="warnbox small">{t('apStrand')}</p>}
    {may && (why === null ? <div className="row"><button className="btn small green" onClick={() => decide(c, r, true)}>{t('apApproveAs', { duty: t('duty_' + nextDuty(r.control, r.approvals)) })}</button><button className="btn small ghost" onClick={() => setWhy('')}>{t('returnRun')}</button></div>
      : <div className="row"><input autoFocus aria-label={t('relDeclineWhy')} placeholder={t('relDeclineWhy')} value={why} onChange={e => setWhy(e.target.value.slice(0, 200))} /><button className="btn small" disabled={why.trim().length < 5} onClick={() => decide(c, r, false, why.trim())}>{t('returnRun')}</button></div>)}
    {r.status === 'pending' && r.requestedBy === c.user.id && <button className="link small" onClick={() => c.setS(s => ({ ...s, changes: (s.changes ?? []).map(x => x.id === r.id ? { ...x, status: 'withdrawn' } : x) }))}>{t('withdraw')}</button>}</li>);
}

/** Home: changes this person can approve now, and their own requests still waiting. */
export function ChangeInbox({ c }: { c: Ctx }) {
  const { t } = c; const vis = new Set(visibleClients(c).map(x => x.id));
  const mine = (c.s.changes ?? []).filter(r => r.status === 'pending' && (!r.clientId || vis.has(r.clientId)) && (canApprove(c.user, r.control, ctxOf(r)) || r.requestedBy === c.user.id));
  if (!mine.length) return null;
  return (<section className="card approvals"><h2>🔐 {t('chgInbox')} ({mine.length})</h2><ul className="plain">{mine.map(r => <ChangeRow key={r.id} c={c} r={r} />)}</ul></section>);
}

/** Admin → Approvals: the matrix, who holds each duty, strict segregation, and the full history. */
export function ApprovalsAdmin({ c }: { c: Ctx }) {
  const { t } = c; const people = usersNow().filter(u => u.active !== false && u.role !== 'employee' && u.role !== 'talaanAdmin');
  const [show, setShow] = useState<'pending' | 'all'>('pending'); const list = (c.s.changes ?? []).filter(r => show === 'all' || r.status === 'pending');
  const strict = !!c.s.controls?.strictRelease;
  const who = (p: { name: string; role: string; clientId?: string }) => p.role === 'client' ? `${p.name} (${c.s.clients.find(x => x.id === p.clientId)?.name ?? ''})` : p.name;
  const csv = () => saveFile(c, `talaan_approvals_${iso(today())}.csv`, '﻿' + [['Requested', 'Control', 'Change', 'Details', 'Requested by', 'Reason', 'Approval 1', 'Approval 2', 'Status', 'Applied', 'Returned by', 'Return reason'],
    ...(c.s.changes ?? []).map(r => [r.requestedAt, r.control, r.title, r.lines.join(' | '), nameOf(r.requestedBy), r.reason ?? '', ...[0, 1].map(i => r.approvals[i] ? `${nameOf(r.approvals[i].by)} (${r.approvals[i].duty}) ${r.approvals[i].at}` : ''), r.status, r.appliedAt ?? '', nameOf(r.returned?.by), r.returned?.reason ?? ''])]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n'));
  return (<><Why>{t('apIntro')}</Why>
    <section className="card"><h2>{t('apMatrix')}</h2><div className="scroll"><table className="tbl small"><thead><tr><th>{t('apAction')}</th><th>{t('apMaker')}</th><th>{t('apStep1')}</th><th>{t('apStep2')}</th><th>{t('apWhere')}</th></tr></thead>
      <tbody>{MATRIX.map(m => { const st = POLICY[m.control]; return <tr key={m.key}><td><b>{t('mx_' + m.key)}</b></td><td>{t('mxm_' + m.key)}</td>
        <td>{t('duty_' + st[0])}<div className="muted">{people.filter(p => dutiesOf(p, p.clientId).includes(st[0])).map(who).join(', ') || '—'}</div></td>
        <td>{st[1] ? <>{t('duty_' + st[1])}<div className="muted">{people.filter(p => dutiesOf(p, p.clientId).includes(st[1])).map(who).join(', ') || '—'}</div></> : <span className="muted">{t('apMakerPlusOne')}</span>}</td>
        <td className="muted">{t('mxw_' + m.key)}</td></tr>; })}</tbody></table></div>
      <p className="muted small">{t('apRules')}</p>
      <p className="muted small">{t('apSingle')}</p></section>
    <section className="card"><h2>{t('apSod')}</h2><p className="small">{t('apSodText')}</p>
      <label className="check"><input type="checkbox" checked={strict} disabled={c.user.role !== 'firmOwner'} onChange={e => requestChange(c, { control: 'roles', subject: 'controls', title: t(e.target.checked ? 'apStrictOn' : 'apStrictOff'), lines: [t('apStrictHelp')], payload: { controls: { strictRelease: e.target.checked }, beforeControls: c.s.controls } })} /> {t('apStrict')}</label>
      <p className="muted small">{t('apStrictHelp')}</p></section>
    <section className="card"><div className="row between"><h2>{t('apHistory')}</h2><span className="row"><select aria-label={t('colStatus')} value={show} onChange={e => setShow(e.target.value as typeof show)}><option value="pending">{t('chg_pending')}</option><option value="all">{t('allOpt')}</option></select><button className="btn small ghost" onClick={csv}>{t('intExport')}</button></span></div>
      {!list.length ? <p className="muted">{t('apNone')}</p> : <ul className="plain">{list.map(r => <ChangeRow key={r.id} c={c} r={r} />)}</ul>}</section></>);
}

/** Checkboxes for a user's approval duties (only those their role may hold). */
export function DutyPicker({ c, role, value, onChange }: { c: Ctx; role: string; value?: string[]; onChange: (d: string[] | undefined) => void }) {
  const { t } = c; const allowed = ALLOWED_DUTIES[role] ?? []; if (!allowed.length) return null;
  const cur = new Set(value ?? dutiesOf({ id: '', role, clientId: role === 'client' ? 'x' : undefined }, role === 'client' ? 'x' : undefined));
  return (<fieldset className="duties"><legend>{t('apDuties')}</legend>{allowed.map(d => <label key={d} className="check"><input type="checkbox" checked={cur.has(d)} onChange={e => { const n = new Set(cur); if (e.target.checked) n.add(d); else n.delete(d); onChange([...n]); }} /> {t('duty_' + d)} <small className="muted">{t('dutyh_' + d)}</small></label>)}</fieldset>);
}
