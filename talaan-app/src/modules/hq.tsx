/**
 * Talaan HQ: the staff-only console for running the Talaan business itself.
 * Client monitoring (firms, usage, health), subscription billing (draft invoices to Xero, payments),
 * support tickets raised from inside the app, and release notes shown to firms after each update.
 * In the live product this is a separate, staff-only area on the same deployment, reading across all firms.
 */
import { useState } from 'react';
import { MODULES, MODULE_PRICE, AI_INCLUDED, APP_VERSION, filingsFor, iso, daysBetween, type Firm, type HqInvoice, type Ticket, type Release, type State } from '../model';
import { Chip, Why, peso, today, roleKey, type Ctx } from '../App';
import { ModuleBadge } from './shell';

/** The demo firm's numbers come from its live data; the other firms are samples. */
export function firmsNow(s: State): Firm[] {
  const month = iso(today()).slice(0, 7);
  return s.hq.firms.map(f => !f.live ? f : { ...f, name: s.billing.firmName, clients: s.clients.filter(x => x.active !== false).length, employees: s.employees.filter(e => e.active && !e.separationDate).length,
    users: s.users.filter(u => u.active !== false && u.role !== 'talaanAdmin').length, ai: s.aiUsage?.[month] ?? 0, lastActive: iso(today()), lateFilings: filingsFor(s).filter(x => !x.filed && x.due < today()).length });
}
export const mrrOf = (f: Firm) => f.plan === 'trial' ? 0 : MODULES.filter(m => f.modules.includes(m)).reduce((a, m) => a + MODULE_PRICE[m], 0) * f.employees;
const invStatus = (i: HqInvoice): HqInvoice['status'] => i.status === 'sent' && i.due < iso(today()) ? 'overdue' : i.status;
export function health(f: Firm): { u: 'ok' | 'soon' | 'late'; why: string[] } {
  const why: string[] = []; const idle = daysBetween(new Date(f.lastActive + 'T00:00'), today());
  if (idle > 7) why.push('h_idle'); if (f.lateFilings > 0) why.push('h_late'); if (f.errors7d > 2) why.push('h_errors'); if (f.invoices.some(i => invStatus(i) === 'overdue')) why.push('h_overdue');
  if (f.plan === 'trial' && f.trialEnds && daysBetween(today(), new Date(f.trialEnds + 'T00:00')) <= 14) why.push('h_trial');
  return { u: why.length >= 2 ? 'late' : why.length === 1 ? 'soon' : 'ok', why };
}

export function Hq({ c, tab }: { c: Ctx; tab?: string }) {
  const { t } = c; const cur = tab ?? 'overview'; const open = c.s.hq.tickets.filter(x => x.status !== 'solved').length;
  const tabs: [string, string][] = [['overview', 'hqOverview'], ['billing', 'hqBilling'], ['support', 'hqSupport'], ['releases', 'hqReleases']];
  return (<><ModuleBadge c={c} m="hq" /><div className="head"><div><h1>Talaan HQ</h1><p className="muted">{t('hqSub')}</p></div><Chip u="info">v{APP_VERSION}</Chip></div>
    <div className="pills tabs" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={cur === k} aria-pressed={cur === k} onClick={() => c.go({ page: 'hq', id: k })}>{t(l)}{k === 'support' && open > 0 && <span>{open}</span>}</button>)}</div>
    {cur === 'overview' && <Overview c={c} />}{cur === 'billing' && <Billing c={c} />}{cur === 'support' && <Support c={c} />}{cur === 'releases' && <Releases c={c} />}</>);
}

function Overview({ c }: { c: Ctx }) {
  const { t } = c; const firms = firmsNow(c.s); const active = firms.filter(f => f.plan === 'active');
  const mrr = firms.reduce((a, f) => a + mrrOf(f), 0); const emps = firms.reduce((a, f) => a + f.employees, 0);
  const atRisk = firms.filter(f => health(f).u !== 'ok').length; const overdue = firms.flatMap(f => f.invoices).filter(i => invStatus(i) === 'overdue');
  return (<><Why>{t('hqOverviewIntro')}</Why>
    <div className="stats kpis">
      <div><span>{t('hqFirms')}</span><b>{active.length}</b><small className="muted">{t('hqTrials', { n: firms.filter(f => f.plan === 'trial').length })}</small></div>
      <div><span>{t('hqMrr')}</span><b>{peso(mrr)}</b><small className="muted">{t('hqArr', { amt: peso(mrr * 12) })}</small></div>
      <div><span>{t('hqEmployees')}</span><b>{emps.toLocaleString('en-PH')}</b><small className="muted">{t('hqPaidThrough')}</small></div>
      <div className={atRisk ? 'warnk' : ''}><span>{t('hqAtRisk')}</span><b>{atRisk}</b><small className="muted">{t('hqAtRiskSub')}</small></div>
      <div className={overdue.length ? 'warnk' : ''}><span>{t('hqOverdue')}</span><b>{peso(overdue.reduce((a, i) => a + i.amount, 0))}</b><small className="muted">{t('hqInvoicesN', { n: overdue.length })}</small></div>
      <div><span>{t('hqTickets')}</span><b>{c.s.hq.tickets.filter(x => x.status !== 'solved').length}</b><small className="muted">{t('hqTicketsSub')}</small></div>
    </div>
    <section className="card"><h2>{t('hqFirmsTitle')}</h2><div className="scroll"><table className="tbl"><thead><tr><th>{t('hqFirm')}</th><th>{t('modulesTitle')}</th><th className="num">{t('colClients')}</th><th className="num">{t('kpiEmployees')}</th><th className="num">{t('hqAiUse')}</th><th>{t('hqLastActive')}</th><th className="num">{t('hqMrr')}</th><th>{t('hqHealth')}</th></tr></thead>
      <tbody>{firms.map(f => { const h = health(f); return (<tr key={f.id}><td><b>{f.name}</b><div className="muted small">{f.city} · {t('since', { date: f.since })}{f.live ? ` · ${t('hqThisDemo')}` : ''}</div>{f.plan === 'trial' && <Chip u="soon">{t('trialEnds', { date: f.trialEnds ?? '' })}</Chip>}</td>
        <td><div className="tags">{f.modules.map(m => <span key={m} className="tag">{t('mod_' + m)}</span>)}</div></td><td className="num">{f.clients}</td><td className="num">{f.employees}</td>
        <td className="num">{f.modules.includes('ai') ? <>{f.ai}<span className="muted small"> / {AI_INCLUDED}</span>{f.ai > AI_INCLUDED && <div className="warn small">{t('hqOverage')}</div>}</> : <span className="muted">—</span>}</td>
        <td className="nowrap">{f.lastActive}</td><td className="num">{peso(mrrOf(f))}</td><td><Chip u={h.u}>{t('hh_' + h.u)}</Chip>{h.why.length > 0 && <ul className="small muted">{h.why.map(w => <li key={w}>{t(w)}</li>)}</ul>}</td></tr>); })}</tbody></table></div>
      <p className="muted small">{t('hqMonitorNote')}</p></section></>);
}

function Billing({ c }: { c: Ctx }) {
  const { t } = c; const firms = firmsNow(c.s); const month = iso(today()).slice(0, 7);
  const setInv = (firmId: string, no: string, p: Partial<HqInvoice>) => c.setS(s => ({ ...s, hq: { ...s.hq, firms: s.hq.firms.map(f => f.id !== firmId ? f : { ...f, invoices: f.invoices.map(i => i.no === no ? { ...i, ...p } : i) }) } }));
  const toDraft = firms.filter(f => f.plan === 'active' && !f.invoices.some(i => i.month === month));
  const draftAll = () => { c.setS(s => { let n = s.hq.nextInvoice; const due = iso(new Date(today().getFullYear(), today().getMonth(), today().getDate() + 15));
    return { ...s, hq: { ...s.hq, firms: s.hq.firms.map(f => { const live = firmsNow(s).find(x => x.id === f.id)!; if (!toDraft.some(x => x.id === f.id)) return f;
      return { ...f, invoices: [...f.invoices, { no: `AUR-${String(n++).padStart(4, '0')}`, month, amount: mrrOf(live), status: 'draft', due } as HqInvoice] }; }), nextInvoice: n } }; });
    c.toast(t('hqDrafted', { n: toDraft.length })); };
  const rows = firms.flatMap(f => f.invoices.map(i => ({ f, i, st: invStatus(i) }))).sort((a, b) => b.i.month.localeCompare(a.i.month) || a.f.name.localeCompare(b.f.name));
  return (<><Why>{t('hqBillingIntro')}</Why>
    <section className="card"><div className="row between"><h2>{t('hqSubs')}</h2>{toDraft.length > 0 && <button className="btn" onClick={draftAll}>{t('hqDraftMonth', { n: toDraft.length, month: c.monthLabel(month) })}</button>}</div>
      <div className="scroll"><table className="tbl"><thead><tr><th>{t('hqFirm')}</th>{MODULES.map(m => <th key={m} className="num">{t('mod_' + m)}<div className="muted small">₱{MODULE_PRICE[m]}</div></th>)}<th className="num">{t('kpiEmployees')}</th><th className="num">{t('hqMrr')}</th></tr></thead>
        <tbody>{firms.map(f => <tr key={f.id}><td><b>{f.name}</b>{f.plan === 'trial' && <> <Chip u="soon">{t('trial')}</Chip></>}</td>{MODULES.map(m => <td key={m} className="num">{f.modules.includes(m) ? '✓' : <span className="muted">—</span>}</td>)}<td className="num">{f.employees}</td><td className="num"><b>{peso(mrrOf(f))}</b></td></tr>)}</tbody></table></div></section>
    <section className="card"><h2>{t('hqInvoices')}</h2><div className="scroll"><table className="tbl"><thead><tr><th>{t('invoiceNo')}</th><th>{t('hqFirm')}</th><th>{t('month')}</th><th className="num">{t('amount')}</th><th>{t('colDue')}</th><th>{t('colStatus')}</th><th></th></tr></thead>
      <tbody>{rows.map(({ f, i, st }) => <tr key={i.no}><td><b>{i.no}</b>{i.inXero && <div className="muted small">{t('inXero')}</div>}</td><td>{f.name}</td><td>{c.monthLabel(i.month)}</td><td className="num">{peso(i.amount)}</td><td>{i.due}</td>
        <td><Chip u={st === 'paid' ? 'ok' : st === 'overdue' ? 'late' : st === 'sent' ? 'soon' : 'info'}>{t('hs_' + st)}</Chip>{i.paidAt && <div className="muted small">{i.paidAt}</div>}</td>
        <td><div className="row">{st === 'draft' && <button className="btn small xero" onClick={() => { setInv(f.id, i.no, { status: 'sent', sentAt: iso(today()), inXero: true }); c.toast(t('hqSentXero', { no: i.no })); }}>{t('hqApproveSend')}</button>}
          {(st === 'sent' || st === 'overdue') && <button className="btn small ghost" onClick={() => setInv(f.id, i.no, { status: 'paid', paidAt: iso(today()) })}>{t('markPaid')}</button>}
          {st === 'overdue' && <button className="btn small ghost" onClick={() => c.toast(t('hqReminder', { firm: f.name }))}>{t('sendReminder')}</button>}</div></td></tr>)}</tbody></table></div>
      <p className="muted small">{t('hqBillingNote')}</p></section></>);
}

function Support({ c }: { c: Ctx }) {
  const { t } = c; const [show, setShow] = useState<'open' | 'all'>('open'); const firms = firmsNow(c.s);
  const list = c.s.hq.tickets.filter(x => show === 'all' || x.status !== 'solved').sort((a, b) => (a.priority === 'high' ? 0 : 1) - (b.priority === 'high' ? 0 : 1) || b.at.localeCompare(a.at));
  return (<><Why>{t('hqSupportIntro')}</Why><section className="card"><div className="seg">{(['open', 'all'] as const).map(k => <button key={k} aria-pressed={show === k} onClick={() => setShow(k)}>{t('tk_' + k)}</button>)}</div>
    {!list.length ? <p className="muted">{t('noTickets')}</p> : <div className="scroll"><table className="tbl"><thead><tr><th>#</th><th>{t('subject')}</th><th>{t('hqFirm')}</th><th>{t('raised')}</th><th>{t('colStatus')}</th><th></th></tr></thead>
      <tbody>{list.map(x => <tr key={x.id}><td>{x.id.slice(1)}</td><td><b>{x.subject}</b><div className="muted small">{t('tc_' + x.category)} · {t('page')}: {x.page} · v{x.version}</div></td><td>{firms.find(f => f.id === x.firmId)?.name}<div className="muted small">{x.userName}</div></td>
        <td>{x.at.slice(0, 10)}</td><td><Chip u={x.status === 'solved' ? 'ok' : x.status === 'waiting' ? 'soon' : 'late'}>{t('ts_' + x.status)}</Chip>{x.priority === 'high' && <div><Chip u="late">{t('high')}</Chip></div>}</td>
        <td><button className="btn small" onClick={() => c.modal(<TicketView c={c} id={x.id} staff />)}>{t('open')}</button></td></tr>)}</tbody></table></div>}
    <p className="muted small">{t('hqSupportNote')}</p></section></>);
}

export function TicketView({ c, id, staff }: { c: Ctx; id: string; staff?: boolean }) {
  const { t } = c; const x = c.s.hq.tickets.find(k => k.id === id); const [text, setText] = useState('');
  if (!x) return null;
  const set = (p: Partial<Ticket>) => c.setS(s => ({ ...s, hq: { ...s.hq, tickets: s.hq.tickets.map(k => k.id === id ? { ...k, ...p } : k) } }));
  const reply = () => { if (text.trim().length < 2) return; set({ replies: [...x.replies, { at: new Date().toISOString(), by: c.user.name, text: text.trim().slice(0, 2000), staff: !!staff }], status: staff ? 'waiting' : 'open' });
    if (staff) c.notify([x.user], 'n_ticketReply', { no: x.id.slice(1), subject: x.subject }, { page: 'home' }); setText(''); };
  return (<div><h2>#{x.id.slice(1)} {x.subject}</h2><p className="muted small">{x.userName} · {x.at.slice(0, 16).replace('T', ' ')} · {t('page')}: {x.page}{x.clientId ? ` · ${c.s.clients.find(k => k.id === x.clientId)?.name ?? x.clientId}` : ''} · v{x.version}</p>
    <div className="thread"><div className="msg"><p>{x.body}</p></div>{x.replies.map((r, i) => <div key={i} className={`msg ${r.staff ? 'staff' : ''}`}><b>{r.by}</b> <span className="muted small">{r.at.slice(0, 16).replace('T', ' ')}</span><p>{r.text}</p></div>)}</div>
    {x.status !== 'solved' && <label className="block">{t('yourReply')}<textarea rows={3} value={text} onChange={e => setText(e.target.value)} /></label>}
    <div className="row end">{staff && <select aria-label={t('colStatus')} value={x.status} onChange={e => set({ status: e.target.value as Ticket['status'] })}>{(['open', 'waiting', 'solved'] as const).map(k => <option key={k} value={k}>{t('ts_' + k)}</option>)}</select>}
      <button className="btn ghost" onClick={() => c.modal(null)}>{t('close')}</button>{x.status !== 'solved' && <button className="btn" disabled={text.trim().length < 2} onClick={reply}>{t('sendReply')}</button>}</div></div>);
}

function Releases({ c }: { c: Ctx }) {
  const { t } = c; const [r, setR] = useState({ version: '', title: '', notes: '' });
  const ok = /^\d+\.\d+\.\d+$/.test(r.version) && r.title.trim().length > 3 && r.notes.trim().length > 5 && !c.s.hq.releases.some(x => x.version === r.version);
  const publish = () => { if (!ok) return; const rel: Release = { id: `r${r.version.replace(/\./g, '')}`, version: r.version, date: iso(today()), title: r.title.trim(), notes: r.notes.trim(), by: c.user.id };
    c.setS(s => ({ ...s, hq: { ...s.hq, releases: [rel, ...s.hq.releases] } })); setR({ version: '', title: '', notes: '' }); c.toast(t('hqPublished')); };
  return (<><Why>{t('hqReleasesIntro')}</Why>
    <section className="card"><h2>{t('hqNewRelease')}</h2><div className="form">
      <label>{t('version')}<input placeholder="0.9.1" value={r.version} onChange={e => setR({ ...r, version: e.target.value.trim().slice(0, 12) })} /></label>
      <label>{t('relTitle')}<input value={r.title} onChange={e => setR({ ...r, title: e.target.value.slice(0, 80) })} /></label>
      <label className="wide">{t('relNotes')}<textarea rows={3} value={r.notes} onChange={e => setR({ ...r, notes: e.target.value.slice(0, 600) })} /></label></div>
      <div className="row end"><button className="btn" disabled={!ok} onClick={publish}>{t('hqPublish')}</button></div></section>
    <section className="card"><h2>{t('hqReleaseLog')}</h2><ul className="activity">{c.s.hq.releases.map(x => <li key={x.id}><span className="grow"><b>v{x.version} · {x.title}</b><div className="small">{x.notes}</div></span><span className="muted small">{x.date}</span></li>)}</ul>
      <p className="muted small">{t('hqDeployNote')}</p></section></>);
}

/* ---------- In-app support and release notes, seen by firm users ---------- */
export function SupportForm({ c, page, clientId }: { c: Ctx; page: string; clientId?: string }) {
  const { t } = c; const [f, setF] = useState({ subject: '', body: '', category: 'problem' as Ticket['category'], priority: 'normal' as Ticket['priority'] });
  const mine = c.s.hq.tickets.filter(x => x.user === c.user.id).sort((a, b) => b.at.localeCompare(a.at));
  const ok = f.subject.trim().length > 3 && f.body.trim().length > 5;
  const send = () => { if (!ok) return; const no = c.s.hq.nextTicket; const firmId = c.s.hq.firms.find(x => x.live)?.id ?? 'santos';
    const tk: Ticket = { id: `t${no}`, firmId, user: c.user.id, userName: c.user.name, at: new Date().toISOString(), subject: f.subject.trim(), body: f.body.trim(), category: f.category, priority: f.priority, page, clientId, version: APP_VERSION, status: 'open', replies: [] };
    c.setS(s => ({ ...s, hq: { ...s.hq, tickets: [tk, ...s.hq.tickets], nextTicket: no + 1 } })); c.modal(null); c.toast(t('ticketCreated', { no })); };
  return (<div><h2>{t('contactSupport')}</h2><p className="muted small">{t('supportIntro')}</p>
    <div className="form"><label>{t('tcType')}<select value={f.category} onChange={e => setF({ ...f, category: e.target.value as Ticket['category'] })}>{(['problem', 'question', 'request'] as const).map(k => <option key={k} value={k}>{t('tc_' + k)}</option>)}</select></label>
      <label>{t('priority')}<select value={f.priority} onChange={e => setF({ ...f, priority: e.target.value as Ticket['priority'] })}><option value="normal">{t('normal')}</option><option value="high">{t('highPay')}</option></select></label>
      <label className="wide">{t('subject')}<input value={f.subject} onChange={e => setF({ ...f, subject: e.target.value.slice(0, 120) })} /></label>
      <label className="wide">{t('describe')}<textarea rows={4} value={f.body} placeholder={t('describePh')} onChange={e => setF({ ...f, body: e.target.value.slice(0, 2000) })} /></label></div>
    <p className="small muted">{t('autoAttached', { page, user: `${c.user.name} (${t(roleKey(c.user))})`, version: APP_VERSION })}</p>
    <p className="warn small">{t('noPersonalData')}</p>
    <div className="row end"><button className="btn ghost" onClick={() => c.modal(null)}>{t('cancel')}</button><button className="btn" disabled={!ok} onClick={send}>{t('sendTicket')}</button></div>
    {mine.length > 0 && <><h3>{t('myTickets')}</h3><ul className="activity">{mine.map(x => <li key={x.id}><span className="grow"><b>#{x.id.slice(1)} {x.subject}</b><div className="muted small">{x.replies.length ? `${x.replies[x.replies.length - 1].by}: ${x.replies[x.replies.length - 1].text.slice(0, 90)}…` : t('noReplyYet')}</div></span>
      <Chip u={x.status === 'solved' ? 'ok' : x.status === 'waiting' ? 'soon' : 'info'}>{t('ts_' + x.status)}</Chip><button className="btn small ghost" onClick={() => c.modal(<TicketView c={c} id={x.id} />)}>{t('open')}</button></li>)}</ul></>}</div>);
}

export function WhatsNew({ c }: { c: Ctx }) {
  const { t } = c; const r = c.s.hq.releases[0]; if (!r || c.s.seenRelease === r.id) return null;
  return (<div className="whatsnew" role="status"><span className="wn-badge">{t('whatsNew')}</span><span className="grow"><b>v{r.version}: {r.title}.</b> {r.notes}</span>
    <button className="btn small ghost" onClick={() => c.setS(s => ({ ...s, seenRelease: r.id }))}>{t('gotIt')}</button></div>);
}
