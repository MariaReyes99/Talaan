/** Integration log: what was sent to or received from each outside system, whether it passed or failed, and who was alerted. */
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { board, outcome, verifyChain, eventsCsv, failureSummary, releaseState, canAuthorise, fingerprint, appendEvent, SYSTEMS, type System } from '../integrations';
import { currentAlerts, SYSTEM_NAME } from '../alerts';
import { iso, type Inbound, type State } from '../model';
import { POLICY, addApproval, canApprove, eligible, nextDuty, strands, type Approval, type Control, type Duty } from '../approvals';
import { Chip, Why, today, saveFile, visibleClients, usersNow, type Ctx, type Route } from '../App';

const U = { pass: 'ok', fail: 'late', open: 'soon' } as const;
const when = (c: Ctx, at: string) => new Date(at).toLocaleString(c.lang === 'zh' ? 'zh-CN' : 'en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function IntegrationStatus({ c }: { c: Ctx }) {
  const { t } = c; const clients = visibleClients(c); const vis = new Set(clients.map(x => x.id));
  const [clientId, setClientId] = useState(''); const [system, setSystem] = useState<System | ''>(''); const [show, setShow] = useState<'all' | 'fail' | 'open' | 'pass'>('all'); const [openRow, setOpenRow] = useState('');
  const log = c.s.integrationLog ?? [];
  const chain = useMemo(() => verifyChain(log), [log]);
  const mine = log.filter(e => !e.clientId || vis.has(e.clientId)).filter(e => e.clientId ? vis.has(e.clientId) : c.user.role !== 'client');
  const rows = board(mine).filter(r => (!clientId || r.clientId === clientId) && (!system || r.system === system) && (show === 'all' || outcome(r.status) === show));
  const name = (id?: string) => c.s.clients.find(x => x.id === id)?.name ?? (id ?? '');
  const userName = (id: string) => usersNow().find(u => u.id === id)?.name ?? id;
  const ORDER = ['rejected', 'failed', 'awaiting', 'mismatch', 'overdue', 'due'];
  const alerts = currentAlerts(c.s, iso(today())).filter(a => vis.has(a.clientId) && (!clientId || a.clientId === clientId) && a.kind !== 'due3').sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || b.days - a.days);
  const [all, setAll] = useState(false); const isClientUser = (id: string) => usersNow().find(u => u.id === id)?.role === 'client';
  const counts = { pass: 0, fail: 0, open: 0 }; board(mine).forEach(r => counts[outcome(r.status)]++);
  const exportCsv = () => saveFile(c, `talaan_integration_log_${clientId || 'all'}_${iso(today())}.csv`, eventsCsv(mine.filter(e => !clientId || e.clientId === clientId), name, chain));
  return (<><Why>{t('intIntro')}</Why>
    <div className="stats kpis">
      <div><span>{t('int_pass')}</span><b>{counts.pass}</b></div>
      <div className={counts.fail ? 'warnk' : ''}><span>{t('int_fail')}</span><b>{counts.fail}</b></div>
      <div><span>{t('int_open')}</span><b>{counts.open}</b></div>
      <div className={chain.ok ? '' : 'warnk'}><span>{t('intChain')}</span><b>{chain.ok ? '✓' : '✗'}</b><small className="muted">{chain.ok ? t('intChainOk', { n: log.length }) : t('intChainBroken', { n: chain.brokenAt ?? 0 })}</small></div>
    </div>
    {alerts.length > 0 && <section className="card"><h2>{t('intAlertsTitle')}</h2><ul className="plain">{alerts.slice(0, all ? 60 : 6).map(a => <li key={a.id}>
      <Chip u={a.kind === 'due' ? 'soon' : 'late'}>{t('alk_' + a.kind)}</Chip> <b>{name(a.clientId)}</b> · {SYSTEM_NAME[a.system]} {a.doc}{a.period ? ` · ${/^\d{4}-\d{2}$/.test(a.period) ? c.monthLabel(a.period) : a.period}` : ''}{a.message ? ` · ${a.message}` : ''}
      <div className="muted small">{t('intRecipients', { names: a.recipients.map(userName).join(', ') })}{a.escalated && a.recipients.some(isClientUser) ? ` · ${t('intEscalated')}` : ''}</div></li>)}</ul>
      {alerts.length > 6 && <button className="link small" onClick={() => setAll(!all)}>{all ? t('showLess') : t('showAllN', { n: alerts.length })}</button>}</section>}
    <section className="card"><div className="form">
      <label>{t('chooseClient')}<select value={clientId} onChange={e => setClientId(e.target.value)}><option value="">{t('allOpt')}</option>{clients.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>{t('colSystem')}<select value={system} onChange={e => setSystem(e.target.value as System | '')}><option value="">{t('allOpt')}</option>{SYSTEMS.map(x => <option key={x} value={x}>{SYSTEM_NAME[x]}</option>)}</select></label>
      <label>{t('colStatus')}<select value={show} onChange={e => setShow(e.target.value as typeof show)}><option value="all">{t('allOpt')}</option><option value="fail">{t('int_fail')}</option><option value="open">{t('int_open')}</option><option value="pass">{t('int_pass')}</option></select></label>
    </div>
      {!rows.length ? <p className="muted">{t('intEmpty')}</p> : <div className="scroll"><table className="tbl"><thead><tr><th>{t('colClient')}</th><th>{t('colSystem')}</th><th>{t('colStatus')}</th><th>{t('intLast')}</th><th>{t('intDetail')}</th><th></th></tr></thead>
        <tbody>{rows.map(r => { const k = `${r.system}|${r.doc}|${r.subject}`; const hist = mine.filter(e => `${e.system}|${e.doc}|${e.subject}` === k); return (<Fragment key={k}>
          <tr><td><b>{name(r.clientId)}</b><div className="muted small">{r.period && /^\d{4}-\d{2}$/.test(r.period) ? c.monthLabel(r.period) : r.period}</div></td>
            <td>{SYSTEM_NAME[r.system]}<div className="muted small">{r.doc}</div></td>
            <td><Chip u={U[outcome(r.status)]}>{t('ist_' + r.status)}</Chip><div className="muted small">{t('intAttempts', { n: Math.max(1, r.attempts), f: r.failures })}</div></td>
            <td className="small">{when(c, r.at)}<div className="muted">{userName(r.last.by)}</div></td>
            <td className="small">{r.last.ref && <div>{t('stepRef')}: <b>{r.last.ref}</b></div>}{r.last.message && <div className={outcome(r.status) === 'fail' ? 'bad' : 'muted'}>{r.last.message}</div>}</td>
            <td><button className="link small" aria-expanded={openRow === k} onClick={() => setOpenRow(openRow === k ? '' : k)}>{t('intHistory')} ({hist.length})</button></td></tr>
          {openRow === k && <tr><td colSpan={6}><ol className="small">{hist.map(e => <li key={e.id}><b>#{e.seq}</b> {when(c, e.at)} · <Chip u={U[outcome(e.status)]}>{t('ist_' + e.status)}</Chip> {userName(e.by)}
            {e.fileName && <> · {e.fileName} <span className="muted" title={e.fileHash}>SHA-256 {e.fileHash?.slice(0, 12)}…</span></>}{e.ref && <> · {e.ref}</>}{e.amount !== undefined && <> · ₱{e.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</>}
            {e.message && <> · {e.message}</>}{e.retryOf && <> · <i>{t('intRetryOf', { n: log.find(x => x.id === e.retryOf)?.seq ?? '?' })}</i></>}</li>)}</ol></td></tr>}</Fragment>); })}</tbody></table></div>}
      <div className="row between"><p className="muted small">{t('intGovNote')}</p><button className="btn ghost" onClick={exportCsv}>{t('intExport')}</button></div></section></>);
}

/** Talaan HQ: failures by firm and system over the last 30 days. In the prototype only this browser's firm has a log; the live app reads every firm's from the server. */
export function HqIntegrations({ c, firms }: { c: Ctx; firms: { id: string; name: string; live?: boolean }[] }) {
  const { t } = c; const since = new Date(Date.now() - 30 * 864e5).toISOString(); const sum = failureSummary(c.s.integrationLog ?? [], since);
  const name = (id: string) => c.s.clients.find(x => x.id === id)?.name ?? id;
  return (<><Why>{t('hqIntIntro')}</Why><section className="card"><div className="scroll"><table className="tbl"><thead><tr><th>{t('hqFirm')}</th><th className="num">{t('hqIntFail30')}</th><th className="num">{t('hqIntOpen')}</th><th>{t('hqIntBySystem')}</th><th>{t('hqIntRepeats')}</th></tr></thead>
    <tbody>{firms.map(f => f.live ? <tr key={f.id}><td><b>{f.name}</b></td><td className="num">{sum.total}</td><td className="num">{sum.open ? <Chip u="late">{sum.open}</Chip> : 0}</td>
      <td className="small">{Object.entries(sum.bySystem).map(([k, n]) => `${SYSTEM_NAME[k]} ${n}`).join(' · ') || '—'}</td>
      <td className="small">{sum.repeats.length ? sum.repeats.map(r => `${name(r.clientId)}: ${SYSTEM_NAME[r.system]} ×${r.n}`).join('; ') : '—'}</td></tr>
      : <tr key={f.id}><td>{f.name}</td><td colSpan={4} className="muted small">{t('hqIntServerOnly')}</td></tr>)}</tbody></table></div></section></>);
}

/* ---------- Human in the loop for files ---------- */
const DOC_IN: Record<Inbound['kind'], string> = { payroll: 'Payroll register', employees: 'Employee list', restore: 'Backup restore' };
const nameOf = (id?: string) => usersNow().find(u => u.id === id)?.name ?? id ?? '';
const authorisers = (requester: string, clientId?: string) => usersNow().filter(u => canAuthorise(u, requester, clientId));
const isStaff = (c: Ctx) => c.user.role === 'firmOwner' || c.user.role === 'preparer';

/**
 * Outgoing file: shows its children (download or send buttons) only after the required people have authorised this exact content.
 * Exports and Xero need one person; payout files (control 'release') and government filings ('filing') need two, by duty
 * (approvals.ts). Requests and authorisations are integration-log entries, so the audit trail shows who asked, who
 * authorised in which role, and what (SHA-256).
 */
export function ReleaseGate({ c, system, doc, subject, clientId, period, content, summary, route, control, exclude, excludeFinal, children }: { c: Ctx; system: System; doc: string; subject: string; clientId?: string; period?: string; content: string; summary: string; route: Route;
  control?: Control; exclude?: string[]; excludeFinal?: string[]; children: ReactNode }) {
  const { t } = c; const hash = useMemo(() => fingerprint(content), [content]); const need = control ? POLICY[control].length : 1;
  const rs = releaseState(c.s.integrationLog ?? [], system, doc, subject, hash, need);
  const [preview, setPreview] = useState(false); const [why, setWhy] = useState<string | null>(null);
  const base = { system, doc, subject, clientId, period, fileHash: hash };
  const client = c.s.clients.find(x => x.id === clientId)?.name ?? '';
  const done: Approval[] = rs.approvals.map(e => ({ by: e.by, at: e.at, duty: (e.ref as Duty) ?? 'review' }));
  const ctxFor = (requester: string, approvals: Approval[]) => ({ requesters: [requester], approvals, clientId, exclude, excludeFinal });
  const whoCan = (requester: string, approvals: Approval[]) => control ? eligible(usersNow(), control, ctxFor(requester, approvals)) : authorisers(requester, clientId);
  const request = () => { const to = whoCan(c.user.id, []); if (!to.length) return c.toast(t('relNoAuthoriser'));
    c.ievent({ ...base, status: 'requested', message: summary }); c.notify(to.map(u => u.id), 'n_relRequested', { name: c.user.name, doc, client }, route);
    to.forEach(u => u.email && c.email([u.email], t('em_rel_subj', { doc, client }), t('em_rel_body', { name: u.name, who: c.user.name, doc, client, summary, firm: c.s.billing.firmName }), 'release', clientId)); c.toast(t('relRequestedToast')); };
  const mayAuth = !!rs.request && (rs.state === 'requested' || rs.state === 'partly') && (control ? canApprove(c.user, control, ctxFor(rs.request.by, done)) : canAuthorise(c.user, rs.request.by, clientId));
  const decide = (ok: boolean, reason?: string) => { if (!rs.request) return; const duty = control ? nextDuty(control, done) ?? undefined : undefined;
    c.ievent({ ...base, status: ok ? 'authorised' : 'declined', ofRequest: rs.request.id, ref: duty, message: reason ?? summary });
    const last = !control || done.length + 1 >= need;
    if (ok && !last) { const next = whoCan(rs.request.by, [...done, { by: c.user.id, at: '', duty: duty! }]); c.notify(next.map(u => u.id), 'n_relRequested', { name: nameOf(rs.request.by), doc, client }, route); }
    c.notify([rs.request.by], !ok ? 'n_relDeclined' : last ? 'n_relAuthorised' : 'n_relStep', { name: c.user.name, doc, client, reason: reason ?? '' }, route); setWhy(null); };
  const steps = control && <ol className="apsteps small">{POLICY[control].map((d, i) => { const a = done[i]; return <li key={i} className={a ? 'done' : i === done.length ? 'cur' : ''}>{t('duty_' + d)}{a ? ` · ✓ ${nameOf(a.by)}` : ''}</li>; })}</ol>;
  if (rs.state === 'authorised') return (<div className="gate ok"><p className="small okmsg">✓ {t('relAuthorised', { name: rs.approvals.map(e => nameOf(e.by)).join(' + '), who: nameOf(rs.request?.by) })}</p>{children}</div>);
  const pending = rs.state === 'requested' || rs.state === 'partly';
  return (<div className="gate"><p className="small"><b>🔐 {t(need > 1 ? 'relGate2' : 'relGate')}</b> {summary}</p>{steps}
    {rs.state === 'changed' && <p className="warn small">{t('relChanged')}</p>}
    {rs.state === 'declined' && <p className="bad small">{t('relDeclinedBy', { name: nameOf(rs.decision?.by), reason: rs.decision?.message ?? '' })}</p>}
    {pending && <p className="small">{t('relWaiting', { who: nameOf(rs.request?.by), names: whoCan(rs.request!.by, done).map(u => u.name).join(', ') || '—' })}</p>}
    {mayAuth && control && strands(usersNow(), control, ctxFor(rs.request!.by, done), c.user.id) && <p className="warnbox small">{t('apStrand')}</p>}
    {mayAuth && <><button className="link small" aria-expanded={preview} onClick={() => setPreview(!preview)}>{t('relPreview')}</button>
      {preview && <pre className="preview">{content.slice(0, 3000)}{content.length > 3000 ? '\n…' : ''}</pre>}
      <p className="muted small">SHA-256 {hash.slice(0, 16)}…</p>
      {why === null ? <div className="row"><button className="btn small green" onClick={() => decide(true)}>{control ? t('apApproveAs', { duty: t('duty_' + nextDuty(control, done)) }) : t('relAuthorise')}</button><button className="btn small ghost" onClick={() => setWhy('')}>{t('relDecline')}</button></div>
        : <div className="row"><input autoFocus aria-label={t('relDeclineWhy')} placeholder={t('relDeclineWhy')} value={why} onChange={e => setWhy(e.target.value.slice(0, 200))} /><button className="btn small" disabled={why.trim().length < 5} onClick={() => decide(false, why.trim())}>{t('relDecline')}</button></div>}</>}
    {!pending && isStaff(c) && <button className="btn small" onClick={request}>{t('relRequest')}</button>}
    {pending && !mayAuth && rs.request?.by === c.user.id && <p className="muted small">{t('relNotYou')}</p>}
    {pending && !whoCan(rs.request!.by, done).length && <p className="warn small">{t('apNobody')}</p>}</div>);
}

/** Puts a received file in the review queue; nothing changes until a second person accepts it. */
export function submitInbound(c: Ctx, x: { kind: Inbound['kind']; clientId: string; fileName?: string; content: string; summary: string; payload: unknown; control?: Inbound['control'] }, route: Route) {
  const { t } = c; const to = x.control ? eligible(usersNow(), x.control, { requesters: [c.user.id], approvals: [], clientId: x.clientId }) : authorisers(c.user.id, x.clientId); if (!to.length) { c.toast(t('relNoAuthoriser')); return false; }
  const id = `in_${Date.now().toString(36)}`; const hash = fingerprint(x.content); const doc = DOC_IN[x.kind];
  c.setS(s => ({ ...s, inbound: [{ id, kind: x.kind, clientId: x.clientId, fileName: x.fileName, fileHash: hash, summary: x.summary, payload: x.payload, submittedBy: c.user.id, at: new Date().toISOString(), status: 'pending' as const, control: x.control, approvals: [] }, ...(s.inbound ?? [])].slice(0, 200) }));
  c.ievent({ system: 'import', status: 'received', doc, subject: id, clientId: x.clientId, fileName: x.fileName, fileHash: hash, ref: x.control, message: x.summary });
  const client = c.s.clients.find(k => k.id === x.clientId)?.name ?? '';
  c.notify(to.map(u => u.id), 'n_inReceived', { name: c.user.name, doc, client }, route); c.toast(t('inSubmitted')); return true;
}

/** Received files of one kind waiting for review, with Accept (applies the change) and Decline. */
export function InboundQueue({ c, kind, apply, route }: { c: Ctx; kind: Inbound['kind']; apply: (s: State, payload: unknown, item: Inbound, reviewer: string) => State; route: Route }) {
  const { t } = c; const vis = new Set(visibleClients(c).map(x => x.id)); const [why, setWhy] = useState<{ id: string; text: string } | null>(null);
  const items = (c.s.inbound ?? []).filter(x => x.kind === kind && (x.clientId ? vis.has(x.clientId) : c.user.role === 'firmOwner' || c.user.role === 'preparer') && (x.status === 'pending' || Date.now() - Date.parse(x.reviewedAt ?? x.at) < 7 * 864e5));
  if (!items.length) return null;
  const doc = DOC_IN[kind];
  const ctxOf = (it: Inbound) => ({ requesters: [it.submittedBy], approvals: it.approvals ?? [], clientId: it.clientId });
  const mayOn = (it: Inbound) => it.status === 'pending' && (it.control ? canApprove(c.user, it.control, ctxOf(it)) : canAuthorise(c.user, it.submittedBy, it.clientId));
  const decide = (it: Inbound, ok: boolean, reason?: string) => {
    if (!mayOn(it)) return;
    const duty: Duty | undefined = ok && it.control ? nextDuty(it.control, it.approvals ?? []) ?? undefined : undefined;
    const step = ok && it.control ? addApproval(it, it.control, c.user.id) : null; const finished = !step || step.done; const approvals = step?.item.approvals ?? it.approvals ?? [];
    c.setS(s => { const cur = (s.inbound ?? []).find(x => x.id === it.id); if (!cur || cur.status !== 'pending' || (cur.approvals ?? []).length !== (it.approvals ?? []).length) return s;
      const reviewed: Inbound = finished ? { ...cur, approvals, status: ok ? 'accepted' : 'declined', reviewedBy: c.user.id, reviewedAt: new Date().toISOString(), reason } : { ...cur, approvals };
      const next = ok && finished ? apply(s, cur.payload, cur, c.user.id) : s;
      const status = !ok ? 'declined' : finished ? 'accepted' : 'authorised';
      return { ...next, inbound: (next.inbound ?? []).map(x => x.id === it.id ? reviewed : x), integrationLog: appendEvent(next.integrationLog ?? [], { system: 'import', status, doc, subject: it.id, clientId: it.clientId, fileName: it.fileName, fileHash: it.fileHash, ref: duty, message: reason ?? it.summary, by: c.user.id }) }; });
    const client = c.s.clients.find(x => x.id === it.clientId)?.name ?? '';
    if (ok && !finished && it.control) { const after = [...(it.approvals ?? []), { by: c.user.id, at: '', duty: duty ?? 'review' }]; c.notify(eligible(usersNow(), it.control, { ...ctxOf(it), approvals: after }).map(u => u.id), 'n_inReceived', { name: nameOf(it.submittedBy), doc, client }, route); }
    c.notify([it.submittedBy], !ok ? 'n_inDeclined' : finished ? 'n_inAccepted' : 'n_relStep', { name: c.user.name, doc, client, reason: reason ?? '' }, route); setWhy(null); c.toast(ok ? (finished ? t('inAcceptedToast') : t('apStepDone')) : t('saved'));
  };
  return (<section className="card"><h2>🔐 {t('inQueueTitle')}</h2><p className="muted small">{t('inQueueIntro')}</p><table className="tbl"><tbody>{items.map(it => { const may = mayOn(it); return (
    <tr key={it.id}><td><b>{c.s.clients.find(x => x.id === it.clientId)?.name ?? c.s.billing.firmName}</b><div className="small">{it.summary}</div><div className="muted small">{it.fileName ? `${it.fileName} · ` : ''}SHA-256 {it.fileHash.slice(0, 12)}… · {t('inBy', { name: nameOf(it.submittedBy) })}</div></td>
      <td>{it.control && <ol className="apsteps small">{POLICY[it.control].map((d, i) => { const a = it.approvals?.[i]; return <li key={i} className={a ? 'done' : ''}>{t('duty_' + d)}{a ? ` · ✓ ${nameOf(a.by)}` : ''}</li>; })}</ol>}{it.status === 'pending' ? <Chip u="soon">{t('inPending')}</Chip> : it.status === 'accepted' ? <Chip u="ok">{t('inAccepted', { name: nameOf(it.reviewedBy) })}</Chip> : <Chip u="late">{t('inDeclined', { name: nameOf(it.reviewedBy) })}</Chip>}{it.reason && <div className="muted small">{it.reason}</div>}</td>
      <td>{may && (why?.id === it.id ? <div className="row"><input autoFocus aria-label={t('relDeclineWhy')} placeholder={t('relDeclineWhy')} value={why.text} onChange={e => setWhy({ id: it.id, text: e.target.value.slice(0, 200) })} /><button className="btn small" disabled={why.text.trim().length < 5} onClick={() => decide(it, false, why.text.trim())}>{t('relDecline')}</button></div>
        : <div className="row"><button className="btn small green" onClick={() => decide(it, true)}>{it.control ? t('apApproveAs', { duty: t('duty_' + nextDuty(it.control, it.approvals ?? [])) }) : t('inAccept')}</button><button className="btn small ghost" onClick={() => setWhy({ id: it.id, text: '' })}>{t('relDecline')}</button></div>)}
        {it.status === 'pending' && !may && <span className="muted small">{it.submittedBy === c.user.id ? t('relNotYou') : t('inWaiting')}</span>}</td></tr>); })}</tbody></table></section>);
}
