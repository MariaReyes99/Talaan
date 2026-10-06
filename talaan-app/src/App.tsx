import { useCallback, useEffect, useMemo, useRef as useRefHook, useState, type ReactNode } from 'react';
import { jsPDF } from 'jspdf';
import TourHost from './tour/TourHost';
import { makeT, LANG_NAMES, INTL_LOCALE, DICTS, type Lang } from './i18n';
import { EMPTY_HOURS, idRules, journal, totals, r2, type Employee, type Hours, type Check, type Line } from './engine';
import { USERS as SEED_USERS, SEED_REFS, inPeriod, sampleState, periodInfo, currentPeriod, shiftPeriod, linesFor, checksFor, filingsFor, tasksFor, daysBetween, iso, PORTAL,
  DEFAULT_CODES, type Notice, type Email, type Invoice, type InvoiceLine, type Rates, type Contact, type Region, type Holiday, type WatchSource, type ReviewItem, type Role, type AccountKey, type BankTemplate, type BankColumn, type EmployerIds, type Remit, type CheckKey, type CheckValue, type PartnerCheck, type Activity, type State, type Run, type Client, type Task, type Filing, type FilingKind, type User } from './model';
import { ask, KB, CATEGORIES, liveCorpus, checkCorpus, type Entry } from './kb';
import { addDoc, listDocs, getDoc, deleteDoc, MAX_DOC_BYTES, ACCEPT_DOCS, type DocMeta } from './docs';
import { LAYOUTS, compareWithSample, sssR3, sssMl2, sssR1a, phRf1, phEr2, piMcrf, piStlrf, piNewMembers, birAlphalist, type LayoutInfo } from './layouts';
import { BANK_PRESETS, buildPayoutFile } from './bank';
import { form2316Pdf } from './pdf2316';
import { continuityPack } from './continuity';
import { encryptFile, decryptFile, passwordProblems, DecryptError } from './secure';
import { strToU8, zipSync } from 'fflate';
import { yearEnd } from './engine';
import { birFile, payoutFile, xeroJournalCsv, genericJournalCsv, employeesCsv, registerCsv, calendarCsv, parseTable } from './files';

const KEY = 'talaan-prototype-v8';
let USERS: User[] = SEED_USERS; // the live user list, refreshed from stored data on every render
const TOUR_SEEN = 'talaan-tour-seen';
const tourSeen = () => { try { return localStorage.getItem(TOUR_SEEN) === '1'; } catch { return false; } };
type Route = { page: 'home' | 'clients' | 'client' | 'payruns' | 'run' | 'files' | 'payslips' | 'ask' | 'faqs' | 'plans' | 'connections' | 'admin' | 'billing'; id?: string; step?: number };
type T = ReturnType<typeof makeT>;

function load(): { s: State; lang: Lang; user: string } {
  try { const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (raw?.s?.v === 8) return raw; } catch { /* empty */ }
  return { s: sampleState(), lang: 'en', user: 'jun' };
}
const peso = (n: number) => '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date();

export default function App() {
  const init = useMemo(load, []);
  const [s, setS] = useState<State>(init.s);
  const [lang, setLang] = useState<Lang>(init.lang);
  const [userId, setUserId] = useState(init.user);
  const [route, setRoute] = useState<Route>({ page: 'home' });
  const [modal, setModal] = useState<ReactNode>(null);
  const [toast, setToast] = useState('');
  const [tourOpen, setTourOpen] = useState(() => !tourSeen());
  const t = useMemo(() => makeT(lang), [lang]);
  const closeTour = useCallback(() => { setTourOpen(false); try { localStorage.setItem(TOUR_SEEN, '1'); } catch { /* empty */ } }, []);
  const changeLang = useCallback((l: Lang) => setLang(l), []);
  USERS = s.users;
  const user = USERS.find(u => u.id === userId) ?? USERS.find(u => u.active !== false)!;
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify({ s, lang, user: userId })); } catch { /* empty */ } }, [s, lang, userId]);
  useEffect(() => { document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang; }, [lang]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 2600); return () => clearTimeout(id); }, [toast]);
  useEffect(() => { if (user.role === 'employee') setRoute({ page: 'payslips' }); else if (route.page === 'payslips') setRoute({ page: 'home' }); }, [userId]);

  const fmt = (d: Date) => d.toLocaleDateString(INTL_LOCALE[lang], { month: 'short', day: 'numeric', year: 'numeric' });
  const monthLabel = (m: string) => new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1).toLocaleDateString(INTL_LOCALE[lang], { month: 'long', year: 'numeric' });
  const periodLabel = (p: string) => { const h = p.slice(8); const m = monthLabel(p.slice(0, 7)); return h === 'M' ? m : t(h === 'A' ? 'cutoffA' : 'cutoffB', { month: m }); };
  const log = (action: string, detail: Activity['detail'] = {}, clientId?: string) => setS(p => ({ ...p, activity: [{ at: new Date().toISOString(), user: userId, clientId, action, detail }, ...p.activity].slice(0, 300) }));
  const notify = (to: string[], key: string, vars: Notice['vars'], route: Route) => { const at = new Date().toISOString();
    setS(p => ({ ...p, notices: [...[...new Set(to)].map((u, i) => ({ id: `n_${Date.now()}_${i}_${u}`, to: u, at, key, vars, route })), ...p.notices].slice(0, 400) })); };
  const email = (to: string[], subject: string, body: string, kind: string, clientId?: string) => { const list = [...new Set(to.filter(Boolean))]; if (!list.length) return false;
    setS(p => ({ ...p, outbox: [{ id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString(), to: list, subject, body, kind, clientId, status: 'queued', by: userId } as Email, ...p.outbox].slice(0, 400) }));
    log('act_email', { subject }, clientId); return true; };
  const ctx: Ctx = { s, setS, t, lang, user, go: setRoute, fmt, monthLabel, periodLabel, modal: setModal, toast: setToast, openTour: () => setTourOpen(true), log, notify, email };

  const nav: [Route['page'], string][] = user.role === 'employee' ? [['payslips', 'myPayslips'], ['faqs', 'faqs'], ['ask', 'ask']]
    : [['home', 'home'], ['clients', 'clients'], ['payruns', 'payRuns'], ['files', 'remitPay'], ['connections', 'connections'], ...(user.role !== 'client' ? [['billing', 'billing']] as [Route['page'], string][] : []), ['faqs', 'faqs'], ['ask', 'ask'], ...(user.role === 'firmOwner' ? [['admin', 'admin']] as [Route['page'], string][] : [])];
  const active = route.page === 'client' ? 'clients' : route.page === 'run' ? 'payruns' : route.page;

  return (
    <div className="app">
      <div className="banner">{t('banner')}</div>
      <header className="bar">
        <button className="logo" onClick={() => setRoute({ page: user.role === 'employee' ? 'payslips' : 'home' })}><Star size={24} /><span>talaan</span></button>
        <nav>{nav.map(([p, k]) => <button key={p} className={active === p ? 'on' : ''} onClick={() => setRoute({ page: p })}>{t(k)}</button>)}</nav>
        <div className="right">
          <Bell c={ctx} />
          <button className="helpbtn" aria-pressed={s.prefs?.help !== false} title={s.prefs?.help !== false ? t('hideHelp') : t('showHelp')} onClick={() => setS(p => ({ ...p, prefs: { ...p.prefs, help: p.prefs?.help === false } }))}>?<span>{t('help')}</span></button>
          <button className="tourbtn" aria-label={t('tour')} title={t('tour')} onClick={() => setTourOpen(true)}><Star size={16} /><span>{t('tour')}</span></button>
          <select className="langselect" aria-label={t('language')} value={lang} onChange={e => setLang(e.target.value as Lang)}>{(Object.keys(LANG_NAMES) as Lang[]).map(l => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}</select>
          <div className="langs" role="group" aria-label={t('language')}>
            {(Object.keys(LANG_NAMES) as Lang[]).map(l => <button key={l} aria-pressed={l === lang} onClick={() => setLang(l)}>{LANG_NAMES[l]}</button>)}
          </div>
          <label className="who"><span>{t('viewingAs')}</span>
            <select value={userId} onChange={e => setUserId(e.target.value)}>
              {USERS.filter(u => u.active !== false).map(u => <option key={u.id} value={u.id}>{u.name} ({t(roleKey(u))})</option>)}
            </select>
          </label>
        </div>
      </header>
      <main className="main">
        {s.prefs?.help !== false && <PageHelp c={ctx} page={route.page} />}
        {route.page === 'home' && <Home c={ctx} />}
        {route.page === 'clients' && <Clients c={ctx} />}
        {route.page === 'client' && <ClientPage c={ctx} id={route.id!} />}
        {route.page === 'payruns' && <PayRuns key={userId} c={ctx} />}
        {route.page === 'run' && <RunPage c={ctx} id={route.id!} startStep={route.step} />}
        {route.page === 'files' && <Files c={ctx} />}
        {route.page === 'payslips' && <Payslips c={ctx} />}
        {route.page === 'ask' && <Ask c={ctx} />}
        {route.page === 'faqs' && <Faqs c={ctx} />}
        {route.page === 'connections' && <Connections c={ctx} tab={route.id} />}
        {route.page === 'billing' && (user.role === 'firmOwner' || user.role === 'preparer' ? <BillingPage c={ctx} tab={route.id} /> : null)}
        {route.page === 'admin' && (user.role === 'firmOwner' ? <Admin c={ctx} tab={route.id} /> : <p className="warn">{t('adminOnly')}</p>)}
        {route.page === 'plans' && <Plans c={ctx} />}
      </main>
      <footer className="foot">
        <button className="link tourlink" onClick={() => setTourOpen(true)}><Star size={16} /> {t('tour')}</button>
        <button className="link" onClick={() => setRoute({ page: 'plans' })}>{t('plans')}</button>
        <button className="link" onClick={() => { const fresh = sampleState(); setS(fresh); setToast(t('resetDemo')); setRoute({ page: 'home' }); }}>{t('resetDemo')}</button>
      </footer>
      {modal && <div className="scrim" onClick={() => setModal(null)}><div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>{modal}</div></div>}
      {toast && <div className="toast" role="status">{toast}</div>}
      <TourHost open={tourOpen} lang={lang} onLang={changeLang} onClose={closeTour} />
    </div>
  );
}

interface Ctx { s: State; setS: (f: State | ((p: State) => State)) => void; t: T; lang: Lang; user: User; go: (r: Route) => void; fmt: (d: Date) => string;
  monthLabel: (m: string) => string; periodLabel: (p: string) => string; modal: (n: ReactNode) => void; toast: (s: string) => void; openTour: () => void; log: (action: string, detail?: Activity['detail'], clientId?: string) => void;
  notify: (to: string[], key: string, vars: Notice['vars'], route: Route) => void; email: (to: string[], subject: string, body: string, kind: string, clientId?: string) => boolean }
const roleKey = (u: User) => ({ firmOwner: 'roleFirmOwner', preparer: 'rolePreparer', client: 'roleClient', employee: 'roleEmployee' } as const)[u.role];
const visibleClients = (c: Ctx) => c.s.clients.filter(x => x.active !== false && (c.user.role !== 'client' || x.id === c.user.clientId));
const corpusOf = (c: Ctx) => liveCorpus(c.s.corpus.custom, c.s.corpus.removed);

function Star({ size = 20 }: { size?: number }) {
  const pts = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 24 : 44; return `${(50 + r * Math.cos(a)).toFixed(1)},${(54 + r * Math.sin(a)).toFixed(1)}`; }).join(' ');
  return <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true"><polygon points={pts} fill="#F6B21A" stroke="#F6B21A" strokeWidth={10} strokeLinejoin="round" /></svg>;
}
const Chip = ({ u, children }: { u: 'late' | 'soon' | 'ok' | 'info'; children: ReactNode }) => <span className={`chip ${u}`}>{children}</span>;
const Why = ({ children }: { children: ReactNode }) => <p className="why"><Star size={18} />{children}</p>;

function dueText(c: Ctx, d: Date) {
  const n = daysBetween(today(), d);
  return n < -1 ? c.t('daysLate', { days: -n }) : n === -1 ? c.t('dayLate') : n === 0 ? c.t('dueToday') : n === 1 ? c.t('dueTomorrow') : c.t('dueIn', { days: n });
}
function taskText(c: Ctx, k: Task) {
  if (k.kind === 'file') return c.t('taskFile', { file: c.t(fileKey(k.filing!.kind)), month: c.monthLabel(k.filing!.month) });
  return c.t(k.kind === 'approve' ? 'taskPayRun' : 'taskStart', { period: c.periodLabel(k.period!) });
}
const LIT: Record<string, string> = { sss: 'SSS', philhealth: 'PhilHealth', pagibig: 'Pag-IBIG' };
const fileKey = (k: FilingKind) => ({ bir: 'fileBIR', sss: 'fileSSS', ph: 'filePH', pi: 'filePI' } as const)[k];
function openTask(c: Ctx, k: Task) {
  if (k.kind === 'file') return c.go({ page: 'files' });
  if (k.kind === 'approve') return c.go({ page: 'run', id: k.runId });
  return c.go({ page: 'payruns', id: `${k.clientId}|${k.period}` });
}

/* ---------------- Home ---------------- */
function Home({ c }: { c: Ctx }) {
  const { t } = c;
  const clients = visibleClients(c);
  const tasks = tasksFor(c.s, today()).filter(k => clients.some(x => x.id === k.clientId));
  const urgent = tasks.filter(k => k.urgency !== 'ok');
  const upcoming = tasks.filter(k => k.urgency === 'ok' && daysBetween(today(), k.due) <= 14);
  const statusOf = (id: string) => { const ks = tasks.filter(k => k.clientId === id); return ks.some(k => k.urgency === 'late') ? 'late' : ks.some(k => k.urgency === 'soon') ? 'soon' : 'ok'; };
  const label = { late: t('statusLate'), soon: t('statusSoon'), ok: t('statusOk') };
  return (<>
    <div className="head"><div><h1>{t('greeting', { name: c.user.name.split(' ')[0] })}</h1><p className="muted">{t('clientsSummary', { n: clients.length })}</p></div>
      <div className="row"><button className="btn ghost" onClick={c.openTour}><Star size={16} /> {t('tour')}</button>
        {(c.user.role === 'preparer' || c.user.role === 'firmOwner') && <button className="btn" onClick={() => c.go({ page: 'payruns' })}>{t('startPayRun')}</button>}</div></div>
    {(c.user.role === 'firmOwner' || c.user.role === 'preparer') && <GettingStarted c={c} />}
    {c.user.role === 'firmOwner' && (() => { const due = corpusDue(c); return due ? <div className="card duebar"><Chip u="soon">{t('reviewDueChip')}</Chip><span className="grow">{t('corpusDueTask', { n: due })}</span><button className="btn small" onClick={() => c.go({ page: 'admin', id: 'corpus' })}>{t('open')}</button></div> : null; })()}
    <ApprovalsWaiting c={c} />
    <section className="card"><h2>{t('needsYou')}</h2>
      {urgent.length === 0 ? <p className="muted">{t('allClear')}</p> : <ul className="tasks">{urgent.map((k, i) => (
        <li key={i}><Chip u={k.urgency}>{dueText(c, k.due)}</Chip><span className="grow"><b>{c.s.clients.find(x => x.id === k.clientId)!.name}</b><br />{taskText(c, k)}</span>
          <button className="btn small" onClick={() => openTask(c, k)}>{t('open')}</button></li>))}</ul>}
    </section>
    <section className="card"><table className="tbl"><thead><tr><th>{t('colClient')}</th><th className="num">{t('colStaff')}</th><th>{t('colNext')}</th><th>{t('assignee')}</th><th>{t('colStatus')}</th></tr></thead>
      <tbody>{clients.map(cl => { const next = tasks.find(k => k.clientId === cl.id); const st = statusOf(cl.id); return (
        <tr key={cl.id} className="clickable" onClick={() => c.go({ page: 'client', id: cl.id })}><td><b>{cl.name}</b></td>
          <td className="num">{c.s.employees.filter(e => e.clientId === cl.id && e.active).length}</td>
          <td>{next ? <>{taskText(c, next)}<div className="muted small">{dueText(c, next.due)}</div></> : '—'}</td><td>{cl.assignee ? <span className="avatar" title={USERS.find(u => u.id === cl.assignee)?.name}>{initials(cl.assignee)}</span> : <span className="muted small">{t('unassigned')}</span>}</td><td><Chip u={st}>{label[st]}</Chip></td></tr>); })}</tbody></table></section>
    <section className="card"><div className="row between"><h2>{t('recentActivity')}</h2><button className="btn small ghost" onClick={() => c.go({ page: 'connections', id: 'activity' })}>{t('seeAll')}</button></div><ActivityList c={c} limit={5} /></section>
    <section className="card"><h2>{t('upcoming')}</h2>
      {upcoming.length === 0 ? <p className="muted">{t('nothingUpcoming')}</p> : <ul className="tasks">{upcoming.map((k, i) => (
        <li key={i}><span className="date">{c.fmt(k.due)}</span><span className="grow"><b>{c.s.clients.find(x => x.id === k.clientId)!.name}</b>, {taskText(c, k)}</span>
          <button className="btn small ghost" onClick={() => openTask(c, k)}>{t('open')}</button></li>))}</ul>}
    </section>
  </>);
}

/* ---------------- Clients ---------------- */
function Clients({ c }: { c: Ctx }) {
  const canAdd = c.user.role === 'firmOwner' || c.user.role === 'preparer';
  return (<><div className="head"><h1>{c.t('clients')}</h1>{canAdd && <button className="btn" onClick={() => c.modal(<ClientForm c={c} />)}>+ {c.t('addClient')}</button>}</div>
    <div className="grid">{visibleClients(c).map(cl => (
      <button key={cl.id} className="card tile" onClick={() => c.go({ page: 'client', id: cl.id })}>
        <h2>{cl.name}</h2><p className="muted">{c.t('employeesCount', { n: c.s.employees.filter(e => e.clientId === cl.id && e.active).length })}</p>
        <p className="small">{cl.bank}, {c.t('xero')}: {cl.xero ? c.t('xeroConnected') : c.t('xeroNotConnected')}</p></button>))}</div></>);
}

function ClientPage({ c, id }: { c: Ctx; id: string }) {
  const { t } = c; const cl = c.s.clients.find(x => x.id === id)!;
  const emps = c.s.employees.filter(e => e.clientId === id);
  const canEdit = c.user.role === 'firmOwner' || c.user.role === 'preparer';
  const upd = (patch: Partial<Client>) => c.setS(s => ({ ...s, clients: s.clients.map(x => x.id === id ? { ...x, ...patch } : x) }));
  const num = (v: string, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number(v) || lo));
  return (<>
    <div className="head"><div><h1>{cl.name}</h1><p className="muted">{t('employeesCount', { n: emps.length })}</p></div>
      {canEdit && <button className="btn" onClick={() => c.go({ page: 'payruns', id: `${id}|${currentPeriod(cl.freq)}` })}>{t('startPayRun')}</button>}</div>
    <section className="card"><div className="row between"><h2>{t('employeesTitle')}</h2>{canEdit && <button className="btn small" onClick={() => c.modal(<EmployeeForm c={c} clientId={id} />)}>{t('addEmployee')}</button>}</div>
      <table className="tbl"><thead><tr><th>{t('name')}</th><th>{t('position')}</th><th className="num">{t('monthlyRate')}</th><th>{t('tin')}</th><th>{t('sss')}</th><th></th></tr></thead>
        <tbody>{emps.map(e => { const bad = !idRules.tin(e.tin) || !idRules.sss(e.sss) || !idRules.philhealth(e.philhealth) || !idRules.pagibig(e.pagibig) || !idRules.bankAccount(e.bankAccount);
          return (<tr key={e.id}><td><b>{e.name}</b>{bad && <> <Chip u="late">!</Chip></>}</td><td>{e.position}</td><td className="num">{peso(e.monthlyRate)}</td><td>{e.tin}</td><td>{e.sss}</td>
            <td>{canEdit && <button className="btn small ghost" onClick={() => c.modal(<EmployeeForm c={c} clientId={id} emp={e} />)}>{t('editEmployee')}</button>}
              <button className="btn small ghost" onClick={() => c.modal(<div><h2>{e.name}</h2><DocsPanel c={c} owner={`emp:${e.id}`} title={t('docsTitle')} /><div className="row end"><button className="btn" onClick={() => c.modal(null)}>{t('close')}</button></div></div>)}>📎</button></td></tr>); })}</tbody></table></section>
    <section className="card"><h2>{t('settings')}</h2>
      <div className="form">
        <label>{t('region')}<select disabled={!canEdit} value={cl.region ?? ''} onChange={e => { const r = c.s.refs.regions.find(x => x.id === e.target.value); upd({ region: e.target.value, ...(r ? { minWage: r.nonAgri } : {}) }); }}><option value="">—</option>{c.s.refs.regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <label><span>{t('minWage')} <Tip text={t('tip_minWage')} /></span><input type="number" min={0} step="0.01" disabled={!canEdit} value={cl.minWage} onChange={e => upd({ minWage: num(e.target.value, 0, 5000) })} /><small>{t('minWageHint')}</small></label>
        <label><span>{t('workdays')} <Tip text={t('tip_workdays')} /></span><select disabled={!canEdit} value={cl.workdays} onChange={e => upd({ workdays: Number(e.target.value) as 261 | 313 })}><option value={261}>261</option><option value={313}>313</option></select><small>{t('workdaysHint')}</small></label>
        <label>{t('bank')}<select disabled={!canEdit} value={cl.bank} onChange={e => upd({ bank: e.target.value })}>{[...new Set([...c.s.refs.banks, cl.bank])].map(b => <option key={b}>{b}</option>)}</select></label>
        <label>{t('xero')}<span className="row"><Chip u={cl.xero ? 'ok' : 'info'}>{cl.xero ? t('xeroConnected') : t('xeroNotConnected')}</Chip>
          {canEdit && <button className="btn small ghost" onClick={() => upd({ xero: !cl.xero })}>{cl.xero ? t('disconnect') : t('connectXero')}</button>}</span></label>
        <label><span>{t('assignee')} <Tip text={t('tip_assignee')} /></span><select disabled={!canEdit} value={cl.assignee ?? ''} onChange={e => upd({ assignee: e.target.value || undefined })}><option value="">{t('unassigned')}</option>{USERS.filter(u => u.role === 'firmOwner' || u.role === 'preparer').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
      </div>
      <h3>{t('dueDays')} <Tip text={t('tip_dueDays')} /></h3><div className="form four">
        {(['bir', 'sss', 'ph', 'pi'] as FilingKind[]).map(k => <label key={k}>{t(fileKey(k))}<input type="number" min={1} max={31} disabled={!canEdit} value={cl.dueDays[k]} onChange={e => upd({ dueDays: { ...cl.dueDays, [k]: num(e.target.value, 1, 31) } })} /></label>)}
      </div><small className="muted">{t('dueDaysHint')}</small>
      <h3>{t('employerIds')}</h3><div className="form">
        {([['sss', 'idSss'], ['philhealth', 'idPh'], ['pagibig', 'idPi'], ['tin', 'idTin'], ['rdo', 'idRdo'], ['address', 'idAddress']] as [keyof EmployerIds, string][]).map(([k, l]) =>
          <label key={k}>{t(l)}<input disabled={!canEdit} value={cl.ids?.[k] ?? ''} onChange={e => upd({ ids: { ...(cl.ids ?? { sss: '', philhealth: '', pagibig: '', tin: '', rdo: '', address: '' }), [k]: e.target.value.slice(0, 120) } })} /></label>)}
      </div>
      <BankFormatEditor c={c} cl={cl} canEdit={canEdit} onChange={bt => upd({ bankTemplate: bt })} />
      <DocsPanel c={c} owner={`client-banktemplate:${cl.id}`} title={t('bankTemplateDoc')} kind="Bank file template" compact />
      <h3>{t('accountCodes')} <Tip text={t('tip_codes')} /></h3><div className="form four">
        {(Object.keys(DEFAULT_CODES) as AccountKey[]).map(k => <label key={k}>{t(k)}<input disabled={!canEdit} value={(cl.codes ?? DEFAULT_CODES)[k]} onChange={e => upd({ codes: { ...(cl.codes ?? DEFAULT_CODES), [k]: e.target.value.slice(0, 20) } })} /></label>)}
      </div><small className="muted">{t('accountCodesHint')}</small>
    </section>
    <ContactsCard c={c} cl={cl} canEdit={canEdit} onChange={p => upd(p)} />
    <DocsPanel c={c} owner={`client:${cl.id}`} title={t('docsTitle')} />
    </>);
}

function EmployeeForm({ c, clientId, emp }: { c: Ctx; clientId: string; emp?: Employee }) {
  const { t } = c; const cl = c.s.clients.find(x => x.id === clientId)!;
  const [e, setE] = useState<Employee>(emp ?? { id: `${clientId}-${Date.now()}`, clientId, name: '', position: '', monthlyRate: 0, workdays: cl.workdays, tin: '', sss: '', philhealth: '', pagibig: '', bankAccount: '', active: true });
  const d = (v: string) => v.replace(/\D/g, '').length;
  const fields: [keyof Employee, (v: string) => boolean, string][] = [
    ['tin', idRules.tin, t('tinHelp', { got: d(e.tin) })], ['sss', idRules.sss, t('digitsNeeded', { n: 10, got: d(e.sss) })],
    ['philhealth', idRules.philhealth, t('digitsNeeded', { n: 12, got: d(e.philhealth) })], ['pagibig', idRules.pagibig, t('digitsNeeded', { n: 12, got: d(e.pagibig) })],
    ...((e.payout ?? 'bank') === 'bank' ? [['bankAccount', idRules.bankAccount, t('bankHelp')]] as typeof fields : [['mobile', idRules.mobile, t('mobileHelp')]] as typeof fields)];
  const ok = e.name.trim().length > 1 && e.monthlyRate > 0 && fields.every(([k, f]) => f(String(e[k] ?? '')));
  const set = (k: keyof Employee, v: string | number) => setE({ ...e, [k]: v });
  const save = () => { if (!ok) return; c.setS(s => ({ ...s, employees: emp ? s.employees.map(x => x.id === e.id ? e : x) : [...s.employees, e] })); c.log('act_emp', { name: e.name }, clientId); c.modal(null); c.toast(t('saved')); };
  return (<div><h2>{emp ? t('editEmployee') : t('addEmployee')}</h2>
    <div className="form">
      <label>{t('name')}<input value={e.name} onChange={x => set('name', x.target.value)} />{e.name.trim().length < 2 && <small className="bad">{t('requiredField')}</small>}</label>
      <label>{t('position')}<input value={e.position} onChange={x => set('position', x.target.value)} /></label>
      <label>{t('monthlyRate')}<input type="number" min={0} step="0.01" value={e.monthlyRate || ''} onChange={x => set('monthlyRate', Math.max(0, Number(x.target.value) || 0))} />{!(e.monthlyRate > 0) && <small className="bad">{t('requiredField')}</small>}</label>
      <label>{t('hireDate')}<input type="date" value={e.hireDate ?? ''} onChange={x => setE({ ...e, hireDate: x.target.value })} /></label>
      <label>{t('birthDate')}<input type="date" value={e.birthDate ?? ''} onChange={x => setE({ ...e, birthDate: x.target.value })} /></label>
      <label>{t('payBy')}<select value={e.payout ?? 'bank'} onChange={x => setE({ ...e, payout: x.target.value as Employee['payout'] })}><option value="bank">{t('payBank')}</option><option value="gcash">GCash</option><option value="maya">Maya</option></select></label>
      {fields.map(([k, f, help]) => { const v = String(e[k] ?? ''); const good = f(v); return (
        <label key={k} className={good ? 'good' : 'badfield'}>{t(k)}<input inputMode="numeric" value={v} onChange={x => set(k, x.target.value.replace(/[^\d-]/g, ''))} />
          <small className={good ? 'ok' : 'bad'}>{good ? '✓ ' + t('looksRight') : help}</small></label>); })}
    </div>
    {!ok && <p className="bad small">{t('fixIdsFirst')}</p>}
    <div className="row end"><button className="btn ghost" onClick={() => c.modal(null)}>{t('cancel')}</button><button className="btn" disabled={!ok} onClick={save}>{t('save')}</button></div></div>);
}

/* ---------------- Pay runs ---------------- */
type PsStatus = 'notStarted' | 'late' | 'blocked' | 'needsReason' | 'ready' | 'waiting' | 'returned' | 'approved';
interface PayRow { key: string; clientId: string; period: string; run?: Run; status: PsStatus; payDate: Date; net: number }
function runEligibility(c: Ctx, r?: Run): string | null {
  if (!r) return 'why_notStarted'; if (r.status === 'approved') return 'why_notDraft';
  const ch = checksFor(c.s, r); if (ch.some(k => k.level === 'red')) return 'why_red';
  if (ch.filter(k => k.level === 'amber').some(k => (r.reasons[checkKey(k)] ?? '').trim().length < 3)) return 'why_reason';
  if (!r.submitted) return 'why_notSubmitted';
  if (c.user.id === r.preparedBy) return 'why_own';
  if (!(c.user.role === 'firmOwner' || (c.user.role === 'client' && c.user.clientId === r.clientId))) return 'why_role';
  return null;
}
function payRows(c: Ctx, clients: Client[]): PayRow[] {
  const rows: PayRow[] = c.s.runs.filter(r => clients.some(x => x.id === r.clientId)).map(r => {
    const payDate = periodInfo(r.period).payDate; let status: PsStatus = 'approved';
    if (r.status === 'draft') { const ch = checksFor(c.s, r);
      status = r.submitted ? 'waiting' : daysBetween(today(), payDate) < 0 ? 'late' : r.returned ? 'returned' : ch.some(k => k.level === 'red') ? 'blocked' : ch.filter(k => k.level === 'amber').some(k => (r.reasons[checkKey(k)] ?? '').trim().length < 3) ? 'needsReason' : 'ready'; }
    return { key: r.id, clientId: r.clientId, period: r.period, run: r, status, payDate, net: totals(linesFor(c.s, r)).net };
  });
  for (const cl of clients) { const p = currentPeriod(cl.freq); if (!c.s.runs.some(r => r.clientId === cl.id && r.period === p)) rows.push({ key: `new|${cl.id}|${p}`, clientId: cl.id, period: p, status: 'notStarted', payDate: periodInfo(p).payDate, net: 0 }); }
  return rows.sort((a, b) => a.payDate.getTime() - b.payDate.getTime() || a.clientId.localeCompare(b.clientId));
}
const PS_CHIP: Record<PsStatus, 'late' | 'soon' | 'ok' | 'info'> = { notStarted: 'info', late: 'late', blocked: 'late', needsReason: 'soon', ready: 'ok', waiting: 'soon', returned: 'late', approved: 'ok' };
function MultiFilter({ label, options, value, onChange }: { label: string; options: [string, string][]; value: Set<string>; onChange: (v: Set<string>) => void }) {
  return (<div className="mf"><span className="mf-label">{label}</span><div className="pills" role="group" aria-label={label}>{options.map(([k, l]) =>
    <button key={k} aria-pressed={value.has(k)} onClick={() => { const n = new Set(value); if (n.has(k)) n.delete(k); else n.add(k); onChange(n); }}>{l}</button>)}</div></div>);
}
function PayRuns({ c }: { c: Ctx }) {
  const { t } = c; const clients = visibleClients(c);
  const canStart = c.user.role === 'firmOwner' || c.user.role === 'preparer';
  const all = payRows(c, clients);
  const [fCo, setFCo] = useState<Set<string>>(new Set()); const [fSt, setFSt] = useState<Set<string>>(new Set()); const [fCut, setFCut] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  const shown = all.filter(r => (!fCo.size || fCo.has(r.clientId)) && (!fSt.size || fSt.has(r.status)) && (!fCut.size || fCut.has(r.period))
    && (!ql || `${c.s.clients.find(x => x.id === r.clientId)?.name} ${c.periodLabel(r.period)} ${t('ps_' + r.status)} ${c.fmt(r.payDate)}`.toLowerCase().includes(ql)));
  const startable = (r: PayRow) => r.status === 'notStarted';
  const chosen = all.filter(r => sel.has(r.key) && startable(r));
  const toStart = chosen;
  const periods = [...new Set(all.map(r => r.period))].sort().reverse();
  const toggle = (k: string) => { const n = new Set(sel); if (n.has(k)) n.delete(k); else n.add(k); setSel(n); };
  const shownStartable = shown.filter(startable);
  const allShownSelected = shownStartable.length > 0 && shownStartable.every(r => sel.has(r.key));

  const makeRun = (r: PayRow): Run => ({ id: `${r.clientId}-${r.period}`, clientId: r.clientId, period: r.period, status: 'draft', reasons: {}, preparedBy: c.user.id,
      hours: Object.fromEntries(c.s.employees.filter(e => e.clientId === r.clientId && inPeriod(e, r.period)).map(e => [e.id, { ...EMPTY_HOURS }])) });
  const startRows = (rows: PayRow[]) => { const made = rows.map(makeRun);
    c.setS(s => ({ ...s, runs: [...s.runs, ...made.filter(m => !s.runs.some(x => x.id === m.id))] }));
    made.forEach(m => c.log('act_created', { period: m.period }, m.clientId)); return made; };
  const startAll = () => { const made = startRows(toStart); setSel(new Set()); c.toast(t('startedN', { n: made.length })); };
  const startOne = (r: PayRow) => { const [m] = startRows([r]); c.go({ page: 'run', id: m.id, step: 2 }); };

  return (<>
    <div className="head"><h1>{t('payRunsTitle')}</h1></div>
    {canStart && <NewPayRun c={c} clients={clients} />}
    <section className="card">
      <p className="muted small">{t('batchIntro')}</p>
      <div className="filterbar">
        <input type="search" className="tsearch" placeholder={t('searchRuns')} aria-label={t('searchRuns')} value={q} onChange={e => setQ(e.target.value)} />
        <MultiSelect c={c} label={t('f_company')} options={clients.map(x => [x.id, x.name])} value={fCo} onChange={setFCo} />
        <MultiSelect c={c} label={t('f_status')} options={(['notStarted', 'late', 'blocked', 'needsReason', 'ready', 'waiting', 'returned', 'approved'] as PsStatus[]).map(k => [k, t('ps_' + k)])} value={fSt} onChange={setFSt} />
        <MultiSelect c={c} label={t('f_cutoff')} options={periods.map(p => [p, c.periodLabel(p)])} value={fCut} onChange={setFCut} />
        {(fCo.size || fSt.size || fCut.size || q) ? <button className="link" onClick={() => { setFCo(new Set()); setFSt(new Set()); setFCut(new Set()); setQ(''); }}>{t('clearFilters')}</button> : null}
      </div>
      {chosen.length > 0 && canStart && <div className="batchbar" role="region" aria-label={t('selectedN', { n: chosen.length })}><b>{t('selectedN', { n: chosen.length })}</b>
        {canStart && <button className="btn small" disabled={!toStart.length} onClick={startAll}>{t('bStart', { n: toStart.length })}</button>}
        <button className="link" onClick={() => setSel(new Set())}>{t('clearSel')}</button></div>}
      <div className="scroll"><table className="tbl"><thead><tr>
        <th style={{ width: 32 }}>{canStart && <input type="checkbox" aria-label={t('selectAll')} title={t('selectAll')} disabled={!shownStartable.length} checked={allShownSelected} onChange={() => { const n = new Set(sel); shownStartable.forEach(r => allShownSelected ? n.delete(r.key) : n.add(r.key)); setSel(n); }} />}</th>
        <th>{t('colClient')}</th><th>{t('period')}</th><th>{t('payDate', { date: '' }).trim()}</th><th>{t('colStatus')}</th><th className="num">{t('netPay')}</th><th></th></tr></thead>
        <tbody>{shown.map(r => { const cl = c.s.clients.find(x => x.id === r.clientId)!; return (
          <tr key={r.key} className={sel.has(r.key) && startable(r) ? 'selrow' : ''}><td>{canStart && startable(r) && <input type="checkbox" aria-label={`${t('start')}: ${cl.name}, ${c.periodLabel(r.period)}`} checked={sel.has(r.key)} onChange={() => toggle(r.key)} />}</td>
            <td><b>{cl.name}</b></td><td>{c.periodLabel(r.period)}</td><td>{c.fmt(r.payDate)}{r.status !== 'approved' && <div className="muted small">{dueText(c, r.payDate)}</div>}</td>
            <td><Chip u={PS_CHIP[r.status]}>{t('ps_' + r.status)}</Chip></td><td className="num">{r.run ? peso(r.net) : '—'}</td>
            <td>{r.run ? <button className="btn small ghost" onClick={() => c.go({ page: 'run', id: r.run!.id })}>{t('open')}</button> : canStart && <button className="btn small" onClick={() => startOne(r)}>{t('start')}</button>}</td></tr>); })}</tbody></table></div>
      {!shown.length && <p className="muted">{t('noRows')}</p>}
    </section></>);
}
function BatchApprove({ c, rows, onDone }: { c: Ctx; rows: PayRow[]; onDone: () => void }) {
  const { t } = c; const [typed, setTyped] = useState('');
  const judged = rows.map(r => ({ r, why: runEligibility(c, r.run) }));
  const ok = judged.filter(x => !x.why), skip = judged.filter(x => x.why);
  const total = r2(ok.reduce((a, x) => a + x.r.net, 0));
  const go = () => { const stamp = iso(today());
    c.setS(s => ({ ...s, runs: s.runs.map(run => { const hit = ok.find(x => x.r.run!.id === run.id); return hit ? { ...run, status: 'approved', approvedBy: c.user.id, approvedAt: stamp, lines: linesFor(s, run) } : run; }) }));
    ok.forEach(x => { c.log('act_approved', { period: x.r.period }, x.r.clientId); afterApproval(c, x.r.run!, linesFor(c.s, x.r.run!)); }); c.modal(null); onDone(); c.toast(t('approvedN', { n: ok.length, m: skip.length })); };
  return (<div><h2>{t('approveTitle')}</h2>
    {ok.length > 0 && <><h3>{t('eligible')} ({ok.length})</h3><table className="tbl small"><tbody>{ok.map(({ r }) => <tr key={r.key}><td>{c.s.clients.find(x => x.id === r.clientId)!.name}</td><td>{c.periodLabel(r.period)}</td><td className="num">{peso(r.net)}</td></tr>)}
      <tr className="totalrow"><td colSpan={2}>{t('grandTotal')}</td><td className="num">{peso(total)}</td></tr></tbody></table></>}
    {skip.length > 0 && <><h3>{t('notEligible')} ({skip.length})</h3><ul className="small">{skip.map(({ r, why }) => <li key={r.key}>{c.s.clients.find(x => x.id === r.clientId)!.name}, {c.periodLabel(r.period)}: <span className="warn">{t(why!)}</span></li>)}</ul></>}
    {ok.length ? <><p className="small">{t('batchConfirm', { n: ok.length })}</p><div className="form"><label>{t('confirmLabel')}<input inputMode="numeric" value={typed} onChange={e => setTyped(e.target.value.replace(/\D/g, ''))} /></label></div></> : <p className="warn">{t('nothingEligible')}</p>}
    <div className="row end"><button className="btn ghost" onClick={() => c.modal(null)}>{t('cancel')}</button>{ok.length > 0 && <button className="btn green" disabled={typed !== String(ok.length)} onClick={go}>{t('bApprove', { n: ok.length })}</button>}</div></div>);
}
function NewPayRun({ c, clients }: { c: Ctx; clients: Client[] }) {
  const { t } = c;
  const firstStart = tasksFor(c.s, today()).find(k => k.kind === 'start' && clients.some(x => x.id === k.clientId));
  const [clientId, setClientId] = useState(firstStart?.clientId ?? clients[0]?.id);
  const cl = c.s.clients.find(x => x.id === clientId)!;
  const options = [-1, 0, 1].map(n => shiftPeriod(currentPeriod(cl.freq), cl.freq, n));
  const [period, setPeriod] = useState(currentPeriod(cl.freq));
  useEffect(() => { setPeriod(currentPeriod(cl.freq)); }, [clientId]);
  const existing = c.s.runs.find(r => r.clientId === clientId && r.period === period);
  const start = () => {
    if (existing) return c.go({ page: 'run', id: existing.id });
    const emps = c.s.employees.filter(e => e.clientId === clientId && inPeriod(e, period));
    const run: Run = { id: `${clientId}-${period}`, clientId, period, status: 'draft', hours: Object.fromEntries(emps.map(e => [e.id, { ...EMPTY_HOURS }])), reasons: {}, preparedBy: c.user.id };
    c.setS(s => ({ ...s, runs: [...s.runs, run] })); c.log('act_created', { period }, clientId); c.go({ page: 'run', id: run.id, step: 2 });
  };
  return (<section className="card accent"><Stepper c={c} step={1} /><h2>{t('newPayRun')}</h2><Why>{t('why1')}</Why>
    <div className="form">
      <label>{t('chooseClient')}<select value={clientId} onChange={e => setClientId(e.target.value)}>{clients.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>{t('choosePeriod')}<select value={period} onChange={e => setPeriod(e.target.value)}>{options.map(p => <option key={p} value={p}>{c.periodLabel(p)}</option>)}</select>
        <small>{t('payDate', { date: c.fmt(periodInfo(period).payDate) })}</small></label>
    </div>
    <div className="row end">{existing && <span className="muted small">{t('existsOpen')}</span>}<button className="btn" onClick={start}>{existing ? t('open') : t('start')}</button></div>
  </section>);
}

function Stepper({ c, step }: { c: Ctx; step: number }) {
  return <ol className="stepper" aria-label={c.t('stepOf', { n: step })}>{[1, 2, 3, 4, 5].map(n => (
    <li key={n} className={n < step ? 'done' : n === step ? 'cur' : ''} aria-current={n === step ? 'step' : undefined}><b>{n < step ? '✓' : n}</b><span>{c.t('step' + n)}</span></li>))}</ol>;
}

const HOUR_FIELDS: (keyof Hours)[] = ['absentDays', 'otHours', 'ndHours', 'regHolidayDays', 'specialDays', 'restDays', 'taxableAllowance', 'deMinimis', 'sssLoan', 'pagibigLoan', 'otherDeduction'];
const GUIDED_FIELDS: (keyof Hours)[] = ['absentDays', 'otHours', 'ndHours', 'regHolidayDays'];
const checkKey = (k: Check) => `${k.code}|${k.empId ?? ''}`;

function RunPage({ c, id, startStep }: { c: Ctx; id: string; startStep?: number }) {
  const { t } = c;
  const run = c.s.runs.find(r => r.id === id);
  const [step, setStep] = useState(startStep ?? (run?.status === 'approved' ? 5 : 2));
  const [mode, setMode] = useState<'guided' | 'advanced'>('guided');
  if (!run) return null;
  const cl = c.s.clients.find(x => x.id === run.clientId)!;
  const lines = linesFor(c.s, run); const tot = totals(lines);
  const emps = c.s.employees.filter(e => e.clientId === run.clientId && (run.status === 'approved' ? lines.some(l => l.empId === e.id) : inPeriod(e, run.period)));
  const checks = checksFor(c.s, run);
  const red = checks.filter(k => k.level === 'red'), amber = checks.filter(k => k.level === 'amber'), green = checks.filter(k => k.level === 'green');
  const amberDone = amber.every(k => (run.reasons[checkKey(k)] ?? '').trim().length >= 3);
  const locked = run.status === 'approved'; const waiting = !locked && !!run.submitted; const editLocked = locked || waiting;
  const updRun = (patch: Partial<Run>) => c.setS(s => ({ ...s, runs: s.runs.map(r => r.id === id ? { ...r, ...patch } : r) }));
  const setHour = (empId: string, k: keyof Hours, v: string) => { const n = Math.max(0, Math.min(k.endsWith('Days') ? 31 : 999999, r2(Number(v) || 0)));
    updRun({ hours: { ...run.hours, [empId]: { ...(run.hours[empId] ?? EMPTY_HOURS), [k]: n } } }); };
  const preparer = USERS.find(u => u.id === run.preparedBy)!;
  const canApproveRole = c.user.role === 'firmOwner' || (c.user.role === 'client' && c.user.clientId === run.clientId);
  const isPreparer = c.user.id === run.preparedBy;
  const govt = r2(tot.sssEE + tot.sssER + tot.ec + tot.phEE + tot.phER + tot.piEE + tot.piER);
  const empName = (eid: string) => emps.find(e => e.id === eid)?.name ?? eid;

  const approve = () => c.modal(<div><h2>{t('step4')}</h2><p>{t('confirmApprove')}</p><div className="row end">
    <button className="btn ghost" onClick={() => c.modal(null)}>{t('cancel')}</button>
    <button className="btn green" onClick={() => { updRun({ status: 'approved', approvedBy: c.user.id, approvedAt: iso(today()), lines }); c.log('act_approved', { period: run.period }, run.clientId); afterApproval(c, run, lines); c.modal(null); c.toast(t('approvedBy', { name: c.user.name, date: c.fmt(today()) })); setStep(5); }}>{t('approveAs', { name: c.user.name })}</button></div></div>);

  return (<>
    <div className="head"><div><h1>{cl.name}</h1><p className="muted">{c.periodLabel(run.period)}, {t('payDate', { date: c.fmt(periodInfo(run.period).payDate) })}</p></div>
      {locked && <Chip u="ok">🔒 {t('approvedBy', { name: USERS.find(u => u.id === run.approvedBy)?.name ?? '', date: c.fmt(new Date(run.approvedAt!)) })}</Chip>}</div>
    <section className="card"><Stepper c={c} step={step} />

    {step === 2 && (<>
      <div className="row between"><h2>{t('step2')}</h2>
        <div className="seg">{(['guided', 'advanced'] as const).map(m => <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>{t(m)}</button>)}</div></div>
      <Why>{t('why2')}</Why>
      {(() => { const pi = periodInfo(run.period); const hs = c.s.refs.holidays.filter(h => h.date >= iso(pi.start) && h.date <= iso(pi.end)); return hs.length ? <p className="small holidays">📅 {t('holidaysInCutoff', { list: hs.map(h => `${c.fmt(new Date(h.date + 'T00:00'))} ${h.name} (${t(h.type === 'regular' ? 'regularH' : 'specialH')})`).join('; ') })}</p> : null; })()}
      {waiting && <p className="warnbox small">🔒 {t('submittedLocked')}</p>}{!editLocked && <ImportBox c={c} run={run} emps={emps} cl={cl} onApply={h => updRun({ hours: h })} />}
      <div className="scroll"><table className="tbl hours"><thead><tr><th>{t('colEmployee')}</th>{(mode === 'guided' ? GUIDED_FIELDS : HOUR_FIELDS).map(k => <th key={k}>{t(k)}</th>)}<th className="num">{t('colNet')}</th></tr></thead>
        <tbody>{emps.map(e => { const h = run.hours[e.id] ?? EMPTY_HOURS; const l = lines.find(x => x.empId === e.id)!; return (
          <tr key={e.id}><td><b>{e.name}</b><div className="muted small">{e.position}</div></td>
            {(mode === 'guided' ? GUIDED_FIELDS : HOUR_FIELDS).map(k => <td key={k}><input type="number" min={0} step={k.endsWith('Days') ? 0.5 : 0.25} disabled={editLocked} value={h[k] || ''} placeholder="0" aria-label={`${e.name} ${t(k)}`} onChange={x => setHour(e.id, k, x.target.value)} /></td>)}
            <td className="num"><b>{peso(l.net)}</b></td></tr>); })}</tbody></table></div>
      <div className="row end"><button className="btn" onClick={() => setStep(3)}>{t('next')}</button></div>
    </>)}

    {step === 3 && (<>
      <div className="row between"><h2>{t('step3')}</h2><Chip u={red.length ? 'late' : amber.length ? 'soon' : 'ok'}>{t('checksSummary', { red: red.length, amber: amber.length, green: green.length })}</Chip></div>
      <Why>{t('why3')}</Why>
      <ul className="checks">
        {red.map(k => <li key={checkKey(k)} className="r"><span className="dot">!</span><span className="grow">{t('c_' + k.code, k.vars)}</span>
          {!locked && <button className="btn small red" onClick={() => { const e = emps.find(x => x.id === k.empId); if (e && /^bad/.test(k.code)) c.modal(<EmployeeForm c={c} clientId={cl.id} emp={e} />); else setStep(2); }}>{t('fixNow')}</button>}</li>)}
        {amber.map(k => <li key={checkKey(k)} className="a"><span className="dot">?</span><span className="grow">{t('c_' + k.code, k.vars)}
          <input className="reason" disabled={locked} placeholder={t('reasonPlaceholder')} value={run.reasons[checkKey(k)] ?? ''} onChange={x => updRun({ reasons: { ...run.reasons, [checkKey(k)]: x.target.value } })} /></span></li>)}
        {green.map(k => <li key={checkKey(k)} className="g"><span className="dot">✓</span><span className="grow">{t('c_' + k.code, k.vars)}</span></li>)}
      </ul>
      {red.length > 0 && <p className="bad small">{t('fixBefore')}</p>}
      {red.length === 0 && !amberDone && <p className="warn small">{t('explainAmber')}</p>}
      <div className="row end"><button className="btn ghost" onClick={() => setStep(2)}>{t('back')}</button><button className="btn" disabled={red.length > 0 || !amberDone} onClick={() => setStep(4)}>{t('next')}</button></div>
    </>)}

    {step === 4 && (<>
      <h2>{t('step4')} <Tip text={t('tip_workflow')} /></h2><Why>{t('why4')}</Why>
      <div className="stats">
        <div><span>{t('employees')}</span><b>{lines.length}</b></div><div><span>{t('gross')}</span><b>{peso(tot.gross)}</b></div>
        <div><span>{t('govt')}</span><b>{peso(govt)}</b></div><div><span>{t('wht')}</span><b>{peso(tot.wht)}</b></div>
        <div className="hl"><span>{t('netPay')}</span><b>{peso(tot.net)}</b></div><div><span>{t('employerCost')}</span><b>{peso(r2(tot.gross + tot.sssER + tot.ec + tot.phER + tot.piER))}</b></div>
      </div>
      <table className="tbl"><thead><tr><th>{t('colEmployee')}</th><th className="num">{t('colGross')}</th><th className="num">{t('colDeductions')}</th><th className="num">{t('colNet')}</th></tr></thead>
        <tbody>{lines.map(l => <tr key={l.empId}><td>{empName(l.empId)}</td><td className="num">{peso(l.gross)}</td><td className="num">{peso(r2(l.gross - l.net))}</td><td className="num"><b>{peso(l.net)}</b></td></tr>)}</tbody></table>
      <p className="muted small">{t('preparedBy', { name: preparer.name })}</p>
      <Workflow c={c} run={run} ready={red.length === 0 && amberDone} lines={lines} />
      {locked ? <Chip u="ok">🔒 {t('locked')}</Chip>
        : red.length > 0 || !amberDone ? <p className="bad">{t('notReady')}</p>
        : !run.submitted ? <p className="muted">{t('notSubmittedYet')}</p>
        : isPreparer ? <p className="warn">{t('cantApproveOwn')}</p>
        : !canApproveRole ? <p className="warn">{t('cantApproveRole')}</p> : null}
      <div className="row end"><button className="btn ghost" onClick={() => setStep(3)}>{t('back')}</button>
        {!locked && run.submitted && canApproveRole && !isPreparer && <button className="btn ghost" onClick={() => c.modal(<ReturnForm c={c} run={run} />)}>{t('returnRun')}</button>}
        {!locked && <button className="btn green" disabled={!run.submitted || isPreparer || !canApproveRole || red.length > 0 || !amberDone} onClick={approve}>{t('approveAs', { name: c.user.name })}</button>}
        {locked && <button className="btn" onClick={() => setStep(5)}>{t('next')}</button>}</div>
    </>)}

    {step === 5 && (locked ? <RunFiles c={c} run={run} cl={cl} /> : <p className="warn">{t('notReady')}</p>)}
    </section>
    <DocsPanel c={c} owner={`run:${run.id}`} title={t('docsTitle')} />
    <Notes c={c} run={run} />
  </>);
}

function ImportBox({ c, run, emps, cl, onApply }: { c: Ctx; run: Run; emps: Employee[]; cl: Client; onApply: (h: Record<string, Hours>) => void }) {
  const { t } = c; const [open, setOpen] = useState(false); const [text, setText] = useState(''); const [msg, setMsg] = useState('');
  const apply = () => {
    const rows = text.trim().split(/\r?\n/).map(r => r.split(/\t|,/).map(x => x.trim())); if (rows.length < 2) return;
    const head = rows[0].map(h => h.toLowerCase());
    const guess = (h: string): keyof Hours | 'name' | '' => /name|pangalan|姓名/.test(h) ? 'name' : /absent|liban|缺勤/.test(h) ? 'absentDays' : /night|nd|夜/.test(h) ? 'ndHours' : /ot|overtime|加班/.test(h) ? 'otHours' : /holiday|假/.test(h) ? 'regHolidayDays' : /rest/.test(h) ? 'restDays' : '';
    const map = Object.fromEntries(head.map((h, i) => [String(i), cl.importMap?.[h] ?? guess(h)]));
    const hours = { ...run.hours }; let n = 0, miss = 0;
    for (const r of rows.slice(1)) { const nameIdx = Object.keys(map).find(i => map[i] === 'name'); if (nameIdx === undefined) break;
      const e = emps.find(x => x.name.toLowerCase() === (r[Number(nameIdx)] ?? '').toLowerCase()); if (!e) { miss++; continue; } n++;
      const h = { ...(hours[e.id] ?? EMPTY_HOURS) }; for (const [i, k] of Object.entries(map)) if (k && k !== 'name') (h as Record<string, number>)[k] = Math.max(0, Number(r[Number(i)]) || 0); hours[e.id] = h; }
    onApply(hours);
    c.setS(s => ({ ...s, clients: s.clients.map(x => x.id === cl.id ? { ...x, importMap: Object.fromEntries(head.map((h, i) => [h, map[String(i)]])) } : x) }));
    c.log('act_hours', { n }, cl.id);
    setMsg(`${t('importDone', { n, miss })}. ${t('importRemember')}.`);
  };
  const sample = 'Name\tAbsent\tOT\tND\n' + emps.slice(0, 3).map((e, i) => `${e.name}\t${i === 2 ? 1 : 0}\t${i * 2}\t0`).join('\n');
  return (<div className="import"><button className="btn small ghost" onClick={() => setOpen(!open)}>{t('importSheet')}</button>
    {open && <div className="importbox"><p className="small muted">{t('importHelp')}</p><textarea rows={4} value={text} placeholder={sample} onChange={e => setText(e.target.value)} />
      <div className="row"><button className="btn small" disabled={!text.trim()} onClick={apply}>{t('importApply')}</button>{msg && <span className="okmsg small">✓ {msg}</span>}</div></div>}</div>);
}

type FileData = string | ArrayBuffer | Uint8Array;
let sessionPassword: string | null = null; // kept in memory only, never saved
async function saveFile(c: Ctx, filename: string, data: FileData, opts: { plain?: boolean } = {}) {
  if (c.s.prefs?.protect && !opts.plain) {
    const go = async (pw: string) => saveRaw(c, `${filename}.talaan.json`, await encryptFile(filename, data, pw));
    if (sessionPassword) return go(sessionPassword);
    c.modal(<PasswordPrompt c={c} filename={filename} onDone={(pw, remember) => { if (remember) sessionPassword = pw; c.modal(null); go(pw); }} />);
    return;
  }
  return saveRaw(c, filename, data);
}
function PasswordPrompt({ c, filename, onDone }: { c: Ctx; filename: string; onDone: (pw: string, remember: boolean) => void }) {
  const { t } = c; const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [remember, setRemember] = useState(false);
  const probs = passwordProblems(pw); const ok = !probs.length && pw === pw2;
  return (<form onSubmit={e => { e.preventDefault(); if (ok) onDone(pw, remember); }}><h2>{t('pwTitle')}</h2><p className="muted small">{filename}</p>
    <div className="form"><label>{t('password')}<input type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} /></label>
      <label>{t('confirmPw')}<input type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} /></label></div>
    <p className={probs.length ? 'warn small' : 'muted small'}>{t('pwRules')}</p>{pw2 && pw !== pw2 && <p className="bad small">{t('pwMismatch')}</p>}
    <p className="muted small">{t('sharePw')}</p>
    <label className="check"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> {t('rememberPw')}</label>
    <div className="row end"><button type="button" className="btn ghost" onClick={() => c.modal(null)}>{t('cancel')}</button><button className="btn" type="submit" disabled={!ok}>{t('encryptSave')}</button></div></form>);
}
async function saveRaw(c: Ctx, filename: string, data: FileData) {
  const w = window as unknown as { claude?: { use: (n: string) => Promise<{ save: (o: { filename: string; data: FileData }) => Promise<unknown> } | null> } };
  if (w.claude?.use) {
    try {
      const dl = await w.claude.use('downloads');
      if (dl) { await dl.save({ filename, data }); c.log('act_exported', { file: filename }); return; }
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'declined') return;
      if (code === 'rejected_extension' || code === 'extension_not_enabled') { c.toast(c.t('downloadsBlocked')); return; }
    }
    if (typeof data === 'string') { c.modal(<div><h2>{filename}</h2><p className="muted small">{c.t('downloadOff')}</p><textarea className="code" readOnly rows={14} value={data.replace(/^\uFEFF/, '')} /><div className="row end"><button className="btn" onClick={() => c.modal(null)}>{c.t('close')}</button></div></div>); }
    else c.toast(c.t('downloadsBlocked'));
    return;
  }
  // Running locally (npm start): a normal browser download.
  const blob = new Blob([data as BlobPart]); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  c.log('act_exported', { file: filename });
}

function payslipHtml(c: Ctx, run: Run, cl: Client) {
  const { t } = c; const lines = run.lines ?? [];
  const row = (k: string, v: number, neg = false) => v ? `<tr><td>${LIT[k] ?? t(k)}</td><td style="text-align:right">${neg ? '−' : ''}${peso(v)}</td></tr>` : '';
  const slips = lines.map(l => { const e = c.s.employees.find(x => x.id === l.empId)!; return `<section style="page-break-after:always;border:1px solid #ccd;border-radius:10px;padding:18px;margin:16px 0;max-width:520px">
    <h2 style="margin:0">${t('payslip')}: ${e.name}</h2><p>${cl.name}<br>${c.periodLabel(run.period)}</p><table style="width:100%">
    ${row('basicPay', l.basic)}${row('absences', l.absences, true)}${row('overtime', l.ot)}${row('nightDiff', l.nd)}${row('holidayPay', l.holiday)}${row('specialPay', l.special)}${row('restDayPay', l.restDay)}${row('allowances', l.taxableAllowance + l.deMinimis)}
    <tr><td><b>${t('gross')}</b></td><td style="text-align:right"><b>${peso(l.gross)}</b></td></tr>
    ${row('sss', l.sssEE, true)}${row('philhealth', l.phEE, true)}${row('pagibig', l.piEE, true)}${row('wht', l.wht, true)}${row('sssLoan', l.sssLoan, true)}${row('pagibigLoan', l.pagibigLoan, true)}${row('otherDeduction', l.otherDeduction, true)}
    <tr><td><b>${t('netPay')}</b></td><td style="text-align:right"><b>${peso(l.net)}</b></td></tr></table>${l.mwe ? `<p>${t('mweNote')}</p>` : ''}</section>`; }).join('');
  return `<!doctype html><html lang="${c.lang}"><head><meta charset="utf-8"><title>${t('payslipsFile')}</title></head><body style="font-family:system-ui,'Noto Sans SC',sans-serif">${slips}</body></html>`;
}

function RunFiles({ c, run, cl }: { c: Ctx; run: Run; cl: Client }) {
  const { t } = c; const lines = run.lines ?? []; const j = journal(lines); const emps = c.s.employees;
  const slug = `${cl.id}_${run.period}`;
  const send = () => { if (!cl.xero) return c.toast(t('xeroNeedsConnect')); c.setS(s => ({ ...s, runs: s.runs.map(r => r.id === run.id ? { ...r, xeroSentAt: iso(today()) } : r) })); c.log('act_xero', {}, run.clientId); c.toast(t('sentXero')); };
  return (<>
    <h2>{t('step5')}</h2><Why>{t('why5')}</Why>
    <div className="filegrid">
      <div className="file"><b>{t('bankFile', { bank: cl.bank })}</b><span className="muted small">{cl.bank} online banking</span><button className="btn small" onClick={() => { const tpl = cl.bankTemplate ?? BANK_PRESETS['Generic CSV']; const f = buildPayoutFile(tpl, lines, emps, { payDate: iso(periodInfo(run.period).payDate), reference: `PAYROLL ${run.period}`, method: 'bank' }); saveFile(c, `${slug}_bank_${cl.bank}.${tpl.delimiter === 'fixed' ? 'txt' : 'csv'}`, f.text); }}>{t('download')}</button>
        <span className="muted small">{cl.bankTemplate?.verified ? `${t('testedWithBank')} ${cl.bankTemplate.verified}` : t('untested')}</span></div>
      {(['gcash', 'maya'] as const).filter(w => lines.some(l => emps.find(e => e.id === l.empId)?.payout === w)).map(w => (
        <div key={w} className="file"><b>{w === 'gcash' ? 'GCash' : 'Maya'}</b><span className="muted small">{t('d_wallet')}</span><button className="btn small" onClick={() => saveFile(c, `${slug}_${w}_payouts.csv`, buildPayoutFile(BANK_PRESETS[w === 'gcash' ? 'GCash bulk payout' : 'Maya bulk payout'], lines, emps, { payDate: iso(periodInfo(run.period).payDate), reference: `${cl.name} ${run.period}`, method: w }).text)}>{t('download')}</button></div>))}
      <div className="file"><b>{t('payslipsFile')}</b><span className="muted small">{t('employees')}: {lines.length}</span><button className="btn small" onClick={() => saveFile(c, `${slug}_payslips.html`, payslipHtml(c, run, cl))}>{t('download')}</button></div>
      <div className="file"><b>{t('files')}</b><span className="muted small">SSS, PhilHealth, Pag-IBIG, BIR</span><button className="btn small ghost" onClick={() => c.go({ page: 'files' })}>{t('open')}</button></div>
    </div>
    <div className="row between"><h3>{t('journalTitle')}</h3>{run.xeroSentAt ? <Chip u="ok">✓ {t('sentXero')}</Chip> : <button className="btn small xero" onClick={send}>{t('sendXero')}</button>}</div>
    <table className="tbl"><thead><tr><th>{t('colAccount')}</th><th className="num">{t('debit')}</th><th className="num">{t('credit')}</th></tr></thead>
      <tbody>{j.map(([k, dr, cr]) => <tr key={k}><td>{t(k)}</td><td className="num">{dr ? peso(dr) : ''}</td><td className="num">{cr ? peso(cr) : ''}</td></tr>)}
        <tr className="totalrow"><td>{t('total')}</td><td className="num">{peso(r2(j.reduce((a, r) => a + r[1], 0)))}</td><td className="num">{peso(r2(j.reduce((a, r) => a + r[2], 0)))}</td></tr></tbody></table>
  </>);
}

/* ---------------- Compliance: remit and pay, new hires, year-end, layouts ---------------- */
const AGENCY_FORMS: Record<FilingKind, string> = { sss: 'SSS: R-3 + ML-2', ph: 'PhilHealth: RF-1', pi: 'Pag-IBIG: MCRF + STLRF', bir: 'BIR: 1601-C' };
const blankIds: EmployerIds = { sss: '', philhealth: '', pagibig: '', tin: '', rdo: '', address: '' };
function remitStatus(f: Filing): { u: 'ok' | 'soon' | 'late' | 'info'; key: string; amt?: number } {
  const r = f.remit;
  if (!r || (!r.uploadedAt && r.amountPaid === undefined)) return { u: 'info', key: 'st_notStarted' };
  if (r.amountPaid === undefined) return { u: 'soon', key: 'st_uploaded' };
  const diff = r2(r.amountPaid - f.expected);
  if (diff < -0.004) return { u: 'late', key: 'st_short', amt: -diff };
  if (diff > 0.004) return { u: 'soon', key: 'st_over', amt: diff };
  if (!r.receipt) return { u: 'soon', key: 'st_noReceipt' };
  return { u: 'ok', key: 'st_matched' };
}
function agencyFiles(c: Ctx, f: Filing): { label: string; file: string; make: () => string }[] {
  const cl = c.s.clients.find(x => x.id === f.clientId)!; const ids = cl.ids ?? blankIds; const emps = c.s.employees; const tag = `${cl.id}_${f.month}`;
  const isNew = (e: Employee) => (e.hireDate ?? '').slice(0, 7) === f.month;
  if (f.kind === 'sss') return [{ label: 'R-3', file: `${tag}_SSS_R3.csv`, make: () => sssR3(f.lines, emps, f.month, ids, cl.name) }, { label: 'ML-2', file: `${tag}_SSS_ML2.csv`, make: () => sssMl2(f.lines, emps, f.month, ids) }];
  if (f.kind === 'ph') return [{ label: 'RF-1', file: `${tag}_PhilHealth_RF1.csv`, make: () => phRf1(f.lines, emps, f.month, ids, cl.name, isNew) }];
  if (f.kind === 'pi') return [{ label: 'MCRF', file: `${tag}_PagIBIG_MCRF.csv`, make: () => piMcrf(f.lines, emps, f.month, ids, cl.name) }, { label: 'STLRF', file: `${tag}_PagIBIG_STLRF.csv`, make: () => piStlrf(f.lines, emps, f.month, ids) }];
  return [{ label: '1601-C', file: `${tag}_BIR_1601C.csv`, make: () => birFile(f.lines, f.month, cl.name) }];
}
function Files({ c }: { c: Ctx }) {
  const { t } = c; const [tab, setTab] = useState('remit');
  const tabs: [string, string][] = [['remit', 'tabRemit'], ['newhires', 'tabNewHires'], ['yearend', 'tabYearEnd'], ['layouts', 'tabLayouts']];
  return (<><div className="head"><h1>{t('remitPay')}</h1></div>
    <div className="pills tabs" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} aria-pressed={tab === k} onClick={() => setTab(k)}>{t(l)}</button>)}</div>
    {tab === 'remit' && <RemitTable c={c} />}{tab === 'newhires' && <NewHires c={c} />}{tab === 'yearend' && <YearEndView c={c} />}{tab === 'layouts' && <LayoutsView c={c} />}</>);
}
function RemitTable({ c }: { c: Ctx }) {
  const { t } = c; const clients = visibleClients(c);
  const filings = filingsFor(c.s).filter(f => clients.some(x => x.id === f.clientId)).sort((a, b) => Number(!!a.filed) - Number(!!b.filed) || a.due.getTime() - b.due.getTime());
  const canFile = c.user.role !== 'employee';
  if (!filings.length) return <p className="muted">{t('noFilings')}</p>;
  return (<><Why>{t('remitIntro')}</Why>{c.s.prefs?.protect && <p className="warnbox small">🔒 {t('protectedNote')}</p>}<section className="card"><div className="scroll"><table className="tbl"><thead><tr><th>{t('colClient')}</th><th>{t('colAgency')}</th><th>{t('colDue')}</th><th className="num">{t('colExpected')}</th><th>{t('colProgress')}</th><th></th></tr></thead>
    <tbody>{filings.map(f => { const st = remitStatus(f); const n = daysBetween(today(), f.due); const r = f.remit;
      const steps = [!!r?.generatedAt, !!r?.uploadedAt, !!r?.reference, r?.amountPaid !== undefined, !!r?.receipt];
      return (<tr key={f.key}><td><b>{c.s.clients.find(x => x.id === f.clientId)!.name}</b><div className="muted small">{c.monthLabel(f.month)}</div></td>
        <td>{AGENCY_FORMS[f.kind]}<div className="muted small">{PORTAL[f.kind]}</div></td>
        <td>{c.fmt(f.due)}<div>{!f.filed && <Chip u={n < 0 ? 'late' : n <= 3 ? 'soon' : 'info'}>{dueText(c, f.due)}</Chip>}</div></td>
        <td className="num"><b>{peso(f.expected)}</b>{r?.amountPaid !== undefined && <div className="muted small">{peso(r.amountPaid)}</div>}</td>
        <td><Chip u={st.u}>{t(st.key, { amt: st.amt !== undefined ? peso(st.amt) : '' })}</Chip><div className="dots" aria-hidden="true">{steps.map((d, i) => <span key={i} className={d ? 'on' : ''} />)}</div></td>
        <td>{canFile && <button className="btn small" onClick={() => c.modal(<RemitForm c={c} f={f} />)}>{r?.amountPaid !== undefined ? t('edit') : t('record')}</button>}</td></tr>); })}</tbody></table></div></section></>);
}
function RemitForm({ c, f }: { c: Ctx; f: Filing }) {
  const { t } = c; const cl = c.s.clients.find(x => x.id === f.clientId)!;
  const [r, setR] = useState<Remit>({ ...(f.remit ?? {}) });
  const set = (p: Partial<Remit>) => setR(x => ({ ...x, ...p }));
  const diff = r.amountPaid !== undefined ? r2(r.amountPaid - f.expected) : 0;
  const errors = [!(r.reference ?? '').trim() || (r.reference ?? '').trim().length < 4 ? t('needRef') : '', r.amountPaid === undefined || !(r.amountPaid > 0) ? t('needAmount') : '', !r.receipt ? t('needReceipt') : '',
    Math.abs(diff) > 0.004 && !(r.note ?? '').trim() ? t('noteLabel') : ''].filter(Boolean);
  const save = () => { c.setS(s => ({ ...s, remits: { ...s.remits, [f.key]: r } }));
    if (!errors.length) { c.log('act_filed', { kind: f.kind, month: f.month }, f.clientId);
      if (Math.abs(diff) < 0.005 && cl.notify?.remitted !== false && !f.remit?.paidAt) (cl.contacts ?? []).forEach(ct => c.email([ct.email], t('em_remit_subj', { client: cl.name, agency: AGENCY_FORMS[f.kind].split(':')[0], month: c.monthLabel(f.month) }),
        t('em_remit_body', { name: ct.name, agency: AGENCY_FORMS[f.kind].split(':')[0], month: c.monthLabel(f.month), amt: peso(r.amountPaid ?? 0), ref: r.reference ?? '', date: r.paidAt ?? iso(today()), firm: c.s.billing.firmName }), 'remitted', cl.id)); }
    c.modal(null); c.toast(Math.abs(diff) > 0.004 ? t('remitWarn') : t('saved')); };
  return (<div><h2>{AGENCY_FORMS[f.kind]}</h2><p className="muted">{cl.name}, {c.monthLabel(f.month)}. {t('colExpected')}: <b>{peso(f.expected)}</b></p>
    <ol className="remitsteps">
      <li><b>{t('stepGenerate')}</b><div className="row">{agencyFiles(c, f).map(x => <button key={x.label} className="btn small ghost" onClick={() => { saveFile(c, x.file, x.make()); set({ generatedAt: r.generatedAt ?? iso(today()) }); }}>{t('download')} {x.label}</button>)}</div></li>
      <li><label className="check"><input type="checkbox" checked={!!r.uploadedAt} onChange={e => set({ uploadedAt: e.target.checked ? iso(today()) : undefined })} /> {t('uploadedQ', { portal: PORTAL[f.kind] })}</label></li>
      <li><div className="form">
        <label><span>{t('stepRef')} <Tip text={t('tip_reference')} /></span><input value={r.reference ?? ''} onChange={e => set({ reference: e.target.value.replace(/[^\w\- ]/g, '').slice(0, 40) })} /></label>
        <label>{t('stepChannel')}<select value={r.channel ?? ''} onChange={e => set({ channel: e.target.value })}><option value="">—</option>{['ch_bank', 'ch_branch', 'ch_ewallet', 'ch_portal', ...(f.kind === 'bir' ? ['ch_efps'] : [])].map(k => <option key={k} value={t(k)}>{t(k)}</option>)}</select></label>
        <label>{t('stepAmount')}<input type="number" min={0} step="0.01" value={r.amountPaid ?? ''} onChange={e => set({ amountPaid: e.target.value === '' ? undefined : Math.max(0, r2(Number(e.target.value))) })} /></label>
        <label>{t('stepDate')}<input type="date" value={r.paidAt ?? ''} onChange={e => set({ paidAt: e.target.value })} /></label>
        <label>{t('stepReceipt')}<input type="file" accept=".pdf,image/*" onChange={e => { const x = e.target.files?.[0]; if (!x) return; if (x.size > MAX_DOC_BYTES) return c.toast(t('tooBig'));
          addDoc({ owner: `remit:${f.key}`, kind: 'Agency receipt', name: x.name, size: x.size, type: x.type, addedBy: c.user.id }, x).then(() => set({ receipt: { name: x.name, size: x.size } })); }} />{r.receipt && <small className="ok">✓ {r.receipt.name}</small>}</label>
      </div></li>
    </ol>
    <DocsPanel c={c} owner={`remit:${f.key}`} title={t('docsTitle')} compact />
    {r.amountPaid !== undefined && Math.abs(diff) > 0.004 && <div className="warnbox"><b>{t('remitWarn')}</b> {t('diffNote', { amt: peso(diff) })}<label>{t('noteLabel')}<input value={r.note ?? ''} onChange={e => set({ note: e.target.value.slice(0, 300) })} /></label></div>}
    {errors.length > 0 && <ul className="bad small">{errors.map(x => <li key={x}>{x}</li>)}</ul>}
    <div className="row end"><button className="btn ghost" onClick={() => c.modal(null)}>{t('cancel')}</button><button className="btn" onClick={save}>{t('saveRemit')}</button></div></div>);
}
function NewHires({ c }: { c: Ctx }) {
  const { t } = c; const clients = visibleClients(c);
  const [clientId, setClientId] = useState(clients[0]?.id); const [month, setMonth] = useState(iso(today()).slice(0, 7));
  const cl = c.s.clients.find(x => x.id === clientId)!; const ids = cl.ids ?? blankIds;
  const hires = c.s.employees.filter(e => e.clientId === clientId && (e.hireDate ?? '').slice(0, 7) === month);
  const tag = `${clientId}_${month}`;
  return (<><Why>{t('nhIntro')}</Why><section className="card"><div className="form">
      <label>{t('chooseClient')}<select value={clientId} onChange={e => setClientId(e.target.value)}>{clients.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>{t('month')}<input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label></div>
    {!hires.length ? <p className="muted">{t('noNewHires')}</p> : <><table className="tbl"><tbody>{hires.map(e => <tr key={e.id}><td><b>{e.name}</b><div className="muted small">{e.position}</div></td><td>{t('hired', { date: e.hireDate ?? '' })}</td><td>SSS {e.sss}</td><td>PhilHealth {e.philhealth}</td></tr>)}</tbody></table>
      <div className="filegrid" style={{ marginTop: 12 }}>
        <div className="file"><b>{t('nhSss')}</b><span className="muted small">My.SSS</span><button className="btn small" onClick={() => saveFile(c, `${tag}_SSS_R1A.csv`, sssR1a(hires, ids, cl.name))}>{t('download')}</button></div>
        <div className="file"><b>{t('nhPh')}</b><span className="muted small">PhilHealth EPRS</span><button className="btn small" onClick={() => saveFile(c, `${tag}_PhilHealth_ER2.csv`, phEr2(hires, ids, cl.name))}>{t('download')}</button></div>
        <div className="file"><b>{t('nhPi')}</b><span className="muted small">{t('nhPiNote')}</span><button className="btn small" onClick={() => saveFile(c, `${tag}_PagIBIG_new_members.csv`, piNewMembers(hires, ids))}>{t('download')}</button></div>
      </div></>}</section></>);
}
function YearEndView({ c }: { c: Ctx }) {
  const { t } = c; const clients = visibleClients(c);
  const [clientId, setClientId] = useState(clients[0]?.id); const [year, setYear] = useState(today().getFullYear());
  const cl = c.s.clients.find(x => x.id === clientId)!;
  const runs = c.s.runs.filter(r => r.clientId === clientId && r.status === 'approved' && r.period.startsWith(String(year)));
  const emps = c.s.employees.filter(e => e.clientId === clientId);
  const rows = emps.map(e => { const ls = runs.flatMap(r => (r.lines ?? []).filter(l => l.empId === e.id)); const op = e.opening?.year === year ? e.opening : undefined;
    return { e, ls, op, y: yearEnd(e.id, ls, 0, op?.taxable ?? 0, op?.withheld ?? 0, op?.gross ?? 0) }; }).filter(r => r.ls.length || r.op);
  const canEdit = c.user.role === 'firmOwner' || c.user.role === 'preparer';
  const dec = c.s.runs.find(r => r.clientId === clientId && r.status === 'draft' && r.period === `${year}-12-${cl.freq === 'monthly' ? 'M' : 'B'}`);
  const apply = () => { if (!dec) return c.toast(t('noDecRun'));
    c.setS(s => ({ ...s, runs: s.runs.map(r => r.id !== dec.id ? r : { ...r, hours: Object.fromEntries(Object.entries(r.hours).map(([id, h]) => [id, { ...h, taxAdjustment: rows.find(x => x.e.id === id)?.y.difference ?? 0 }])) }) }));
    c.toast(t('applyAdjDone', { n: rows.length })); };
  return (<><Why>{t('yeIntro')}</Why><section className="card"><div className="form">
      <label>{t('chooseClient')}<select value={clientId} onChange={e => setClientId(e.target.value)}>{clients.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>{t('year')}<select value={year} onChange={e => setYear(Number(e.target.value))}>{[today().getFullYear(), today().getFullYear() - 1].map(y => <option key={y}>{y}</option>)}</select></label></div>
    <div className="scroll"><table className="tbl"><thead><tr><th>{t('colEmployee')}</th><th className="num">{t('gross')}</th><th className="num">{t('colTaxable')}</th><th className="num">{t('colTaxDue')}</th><th className="num">{t('colWithheld')}</th><th className="num">{t('colDiff')}</th><th></th></tr></thead>
      <tbody>{rows.map(({ e, ls, y, op }) => <tr key={e.id}><td><b>{e.name}</b>{y.mwe && <> <Chip u="info">{t('mweShort')}</Chip></>}<div className="small">{op ? <span className="muted">{t('openingIncluded', { amt: peso(op.gross) })}</span> : <span className="warn">{t('noOpening')}</span>}{canEdit && <> <button className="link" onClick={() => c.modal(<OpeningForm c={c} e={e} year={year} />)}>{t('setOpening')}</button></>}</div></td><td className="num">{peso(y.gross)}</td><td className="num">{peso(y.taxable)}</td><td className="num">{peso(y.taxDue)}</td><td className="num">{peso(y.withheld)}</td>
        <td className="num"><b className={y.difference < 0 ? 'okmsg' : ''}>{y.difference < 0 ? `(${peso(-y.difference)})` : peso(y.difference)}</b></td>
        <td><button className="btn small ghost" onClick={() => saveFile(c, `${clientId}_${year}_2316_${e.name.replace(/\W+/g, '_')}.pdf`, form2316Pdf({ e, y, lines: ls, year, employer: { name: cl.name, ids: cl.ids ?? blankIds } }))}>{t('pdf2316')}</button></td></tr>)}</tbody></table></div>
    <div className="row end"><button className="btn ghost" onClick={() => saveFile(c, `${clientId}_${year}_alphalist_1604C.csv`, birAlphalist(rows.map(r => ({ e: r.e, y: r.y })), year, cl.ids ?? blankIds, cl.name))}>{t('alphalist')}</button>
      {(c.user.role === 'firmOwner' || c.user.role === 'preparer') && <button className="btn" onClick={apply}>{t('applyAdj')}</button>}</div></section></>);
}
function OpeningForm({ c, e, year }: { c: Ctx; e: Employee; year: number }) {
  const { t } = c; const cur = e.opening?.year === year ? e.opening : { year, gross: 0, taxable: 0, withheld: 0 };
  const [o, setO] = useState(cur); const num = (v: string) => Math.max(0, r2(Number(v) || 0));
  const ok = o.taxable <= o.gross && o.withheld <= o.taxable;
  const save = () => { if (!ok) return; c.setS(s => ({ ...s, employees: s.employees.map(x => x.id === e.id ? { ...x, opening: o } : x) })); c.log('act_emp', { name: e.name }, e.clientId); c.modal(null); c.toast(t('saved')); };
  return (<div><h2>{t('setOpening')}: {e.name} <Tip text={t('tip_opening')} /></h2><p className="muted small">{t('openingHint', { year })}</p><div className="form">
    <label>{t('opGross')}<input type="number" min={0} step="0.01" value={o.gross || ''} onChange={x => setO({ ...o, gross: num(x.target.value) })} /></label>
    <label>{t('opTaxable')}<input type="number" min={0} step="0.01" value={o.taxable || ''} onChange={x => setO({ ...o, taxable: num(x.target.value) })} /></label>
    <label>{t('opWithheld')}<input type="number" min={0} step="0.01" value={o.withheld || ''} onChange={x => setO({ ...o, withheld: num(x.target.value) })} /></label></div>
    {!ok && <p className="bad small">{t('openingBad')}</p>}
    <div className="row end"><button className="btn ghost" onClick={() => c.modal(null)}>{t('cancel')}</button><button className="btn" disabled={!ok} onClick={save}>{t('save')}</button></div></div>);
}
function LayoutsView({ c }: { c: Ctx }) {
  const { t } = c; const [pick, setPick] = useState(LAYOUTS[0].id); const [result, setResult] = useState<ReturnType<typeof compareWithSample> | null>(null);
  const label = (l: LayoutInfo) => <Chip u={l.status === 'verified' ? 'ok' : l.status === 'form' ? 'info' : 'soon'}>{t(l.status === 'verified' ? 'ly_verified' : l.status === 'form' ? 'ly_form' : 'ly_spec')}</Chip>;
  const sampleOurs = (id: string) => { const f = filingsFor(c.s)[0]; const cl = c.s.clients[0]; const ids = cl.ids ?? blankIds; const emps = c.s.employees;
    const m: Record<string, () => string> = { 'sss-r3': () => sssR3(f.lines, emps, f.month, ids, cl.name), 'sss-ml2': () => sssMl2(f.lines, emps, f.month, ids), 'ph-rf1': () => phRf1(f.lines, emps, f.month, ids, cl.name, () => false),
      'pi-mcrf': () => piMcrf(f.lines, emps, f.month, ids, cl.name), 'pi-stlrf': () => piStlrf(f.lines, emps, f.month, ids), 'bir-1601c': () => birFile(f.lines, f.month, cl.name),
      'sss-r1a': () => sssR1a(emps.slice(0, 2), ids, cl.name), 'ph-er2': () => phEr2(emps.slice(0, 2), ids, cl.name), 'bir-alpha': () => birAlphalist([], today().getFullYear(), ids, cl.name), 'bir-2316': () => '' };
    return (m[id] ?? (() => ''))(); };
  return (<><Why>{t('lyIntro')}</Why>
    <section className="card"><div className="scroll"><table className="tbl"><thead><tr><th>{t('colAgency')}</th><th>{t('colStatus')}</th><th>{t('lySource')}</th><th>{t('lyVerify')}</th></tr></thead>
      <tbody>{LAYOUTS.map(l => <tr key={l.id}><td><b>{l.agency} {l.form}</b><div className="muted small">{l.name}</div><div className="small">{l.portal}</div></td><td>{label(l)}</td><td className="small">{l.source}</td><td className="small">{l.howToVerify}</td></tr>)}</tbody></table></div></section>
    <section className="card"><h2>{t('lyCheck')}</h2><div className="form">
      <label>{t('lyPick')}<select value={pick} onChange={e => { setPick(e.target.value); setResult(null); }}>{LAYOUTS.filter(l => l.id !== 'bir-2316').map(l => <option key={l.id} value={l.id}>{l.agency} {l.form}</option>)}</select></label>
      <label>{t('lySample')}<input type="file" accept=".csv,.txt,.dat,text/plain" onChange={e => { const x = e.target.files?.[0]; if (x) x.text().then(txt => setResult(compareWithSample(sampleOurs(pick), txt))); }} /></label></div>
      {result && <div className={result.match ? 'okbox' : 'warnbox'}><b>{result.match ? t('lyMatch') : t('lyNoMatch')}</b><ul>{result.notes.map(n => <li key={n} className="small">{n}</li>)}</ul></div>}</section></>);
}
function BankFormatEditor({ c, cl, canEdit, onChange }: { c: Ctx; cl: Client; canEdit: boolean; onChange: (b: BankTemplate) => void }) {
  const { t } = c; const tpl = cl.bankTemplate ?? BANK_PRESETS['Generic CSV'];
  const set = (p: Partial<BankTemplate>) => onChange({ ...tpl, ...p, verified: undefined });
  const cols = tpl.columns; const setCols = (cs: BankColumn[]) => set({ columns: cs });
  const preview = (() => { const run = c.s.runs.filter(r => r.clientId === cl.id && r.status === 'approved').pop(); if (!run) return ''; return buildPayoutFile(tpl, (run.lines ?? []).slice(0, 3), c.s.employees, { payDate: iso(periodInfo(run.period).payDate), reference: `PAYROLL ${run.period}`, method: 'bank' }).text; })();
  return (<><h3>{t('bankFormat')} <Tip text={t('tip_bankFormat')} /></h3><p className="muted small">{t('bankFormatHint')}</p>
    <div className="form">
      <label>{t('preset')}<select disabled={!canEdit} value="" onChange={e => e.target.value && onChange({ ...BANK_PRESETS[e.target.value] })}><option value="">{tpl.name}</option>{Object.keys(BANK_PRESETS).filter(k => !/GCash|Maya/.test(k)).map(k => <option key={k} value={k}>{k}</option>)}</select></label>
      <label>{t('delimiter')}<select disabled={!canEdit} value={tpl.delimiter} onChange={e => set({ delimiter: e.target.value as BankTemplate['delimiter'] })}><option value=",">,</option><option value={'\t'}>Tab</option><option value="|">|</option><option value="fixed">{t('fixedWidth')}</option></select></label>
      <label>{t('amountAs')}<select disabled={!canEdit} value={tpl.amount} onChange={e => set({ amount: e.target.value as BankTemplate['amount'] })}><option value="decimal">{t('amtDecimal')}</option><option value="centavos">{t('amtCentavos')}</option></select></label>
      <label>{t('dateAs')}<select disabled={!canEdit} value={tpl.date} onChange={e => set({ date: e.target.value as BankTemplate['date'] })}>{['YYYY-MM-DD', 'MM/DD/YYYY', 'MMDDYYYY'].map(d => <option key={d}>{d}</option>)}</select></label>
      <label className="check"><input type="checkbox" disabled={!canEdit} checked={tpl.header} onChange={e => set({ header: e.target.checked })} /> {t('withHeader')}</label>
      <label className="check"><input type="checkbox" disabled={!canEdit} checked={tpl.trailer} onChange={e => set({ trailer: e.target.checked })} /> {t('trailerRow')}</label>
    </div>
    <h4 className="small">{t('columnsLbl')}</h4>
    <table className="tbl small"><tbody>{cols.map((col, i) => <tr key={i}><td>{i + 1}</td>
      <td><select disabled={!canEdit} value={col.field} onChange={e => setCols(cols.map((x, j) => j === i ? { ...x, field: e.target.value as BankColumn['field'], label: t('f_' + e.target.value) } : x))}>{(['account', 'name', 'amount', 'date', 'reference', 'literal'] as const).map(f => <option key={f} value={f}>{t('f_' + f)}</option>)}</select></td>
      <td><input disabled={!canEdit} value={col.label} onChange={e => setCols(cols.map((x, j) => j === i ? { ...x, label: e.target.value.slice(0, 40) } : x))} /></td>
      {col.field === 'literal' && <td><input disabled={!canEdit} placeholder={t('f_literal')} value={col.literal ?? ''} onChange={e => setCols(cols.map((x, j) => j === i ? { ...x, literal: e.target.value.slice(0, 40) } : x))} /></td>}
      {tpl.delimiter === 'fixed' && <td><input type="number" min={1} max={80} disabled={!canEdit} value={col.width ?? 20} aria-label={t('width')} onChange={e => setCols(cols.map((x, j) => j === i ? { ...x, width: Math.max(1, Math.min(80, Number(e.target.value) || 1)) } : x))} /></td>}
      <td>{canEdit && i > 0 && <button className="btn small ghost" onClick={() => { const n = [...cols]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setCols(n); }}>{t('moveUp')}</button>}
        {canEdit && cols.length > 2 && <button className="btn small ghost" onClick={() => setCols(cols.filter((_, j) => j !== i))}>{t('removeCol')}</button>}</td></tr>)}</tbody></table>
    {canEdit && <button className="btn small ghost" onClick={() => setCols([...cols, { field: 'literal', label: t('f_literal'), literal: '' }])}>{t('addCol')}</button>}
    {preview && <><h4 className="small">{t('previewFile')}</h4><pre className="code">{preview}</pre></>}
    <div className="row">{tpl.verified ? <Chip u="ok">{t('testedWithBank')} {tpl.verified}</Chip> : <Chip u="soon">{t('untested')}</Chip>}
      {canEdit && <button className="btn small ghost" onClick={() => onChange({ ...tpl, verified: iso(today()) })}>{t('markTested')}</button>}</div></>);
}

/* ---------------- Employee portal ---------------- */
function Payslips({ c }: { c: Ctx }) {
  const { t } = c; const empId = c.user.empId ?? 'lim-3';
  const mine = c.s.runs.filter(r => r.status === 'approved' && r.lines?.some(l => l.empId === empId)).sort((a, b) => b.period.localeCompare(a.period));
  const [sel, setSel] = useState(mine[0]?.id);
  const run = mine.find(r => r.id === sel); const l = run?.lines?.find(x => x.empId === empId);
  const year = String(today().getFullYear()); const ytd = mine.filter(r => r.period.startsWith(year)).flatMap(r => r.lines!.filter(x => x.empId === empId));
  const sum = (k: 'gross' | 'taxable' | 'wht' | 'sssEE' | 'phEE' | 'piEE') => r2(ytd.reduce((a, x) => a + x[k], 0));
  const Row = ({ k, v, neg }: { k: string; v: number; neg?: boolean }) => v ? <div className="kv"><span>{LIT[k] ?? t(k)}</span><b>{neg ? '−' : ''}{peso(v)}</b></div> : null;
  return (<><div className="head"><h1>{t('myPayslipsTitle')}</h1></div>
    {!mine.length ? <p className="muted">{t('noPayslips')}</p> : <div className="split">
      <section className="card"><ul className="list">{mine.map(r => <li key={r.id}><button aria-pressed={r.id === sel} onClick={() => setSel(r.id)}>{c.periodLabel(r.period)}<b>{peso(r.lines!.find(x => x.empId === empId)!.net)}</b></button></li>)}</ul></section>
      {l && run && <section className="card slip"><h2>{t('payslip')}</h2><p className="muted">{c.s.clients.find(x => x.id === run.clientId)!.name}, {c.periodLabel(run.period)}</p>
        <h3>{t('earnings')}</h3><Row k="basicPay" v={l.basic} /><Row k="absences" v={l.absences} neg /><Row k="overtime" v={l.ot} /><Row k="nightDiff" v={l.nd} /><Row k="holidayPay" v={l.holiday} /><Row k="specialPay" v={l.special} /><Row k="restDayPay" v={l.restDay} />
        <div className="kv strong"><span>{t('gross')}</span><b>{peso(l.gross)}</b></div>
        <h3>{t('deductions')}</h3><Row k="sss" v={l.sssEE} neg /><Row k="philhealth" v={l.phEE} neg /><Row k="pagibig" v={l.piEE} neg /><Row k="wht" v={l.wht} neg /><Row k="sssLoan" v={l.sssLoan} neg /><Row k="pagibigLoan" v={l.pagibigLoan} neg />
        <div className="kv net"><span>{t('netPay')}</span><b>{peso(l.net)}</b></div>{l.mwe && <p className="okmsg small">{t('mweNote')}</p>}</section>}
      <section className="card"><h2>{t('ytdTitle')}</h2><div className="kv"><span>{t('gross')}</span><b>{peso(sum('gross'))}</b></div>
        <div className="kv"><span>{t('contribTotal')}</span><b>{peso(r2(sum('sssEE') + sum('phEE') + sum('piEE')))}</b></div>
        <div className="kv"><span>{t('taxableComp')}</span><b>{peso(sum('taxable'))}</b></div><div className="kv"><span>{t('wht')}</span><b>{peso(sum('wht'))}</b></div>
        <p className="muted small">{t('ytdNote')}</p></section></div>}</>);
}

/* ---------------- Ask Tala ---------------- */
const audienceOf = (u: User) => (u.role === 'employee' ? 'employee' : undefined);
function Answer({ c, e }: { c: Ctx; e: Entry }) {
  const { t } = c;
  return (<div className="answer"><p>{e.a[c.lang]}</p>
    <div className="src">{t('source')}: {e.sourceUrl ? <a href={e.sourceUrl} target="_blank" rel="noreferrer">{e.source}</a> : e.source}</div>
    <div className="meta">{t('effectiveFrom', { date: e.effective })} · {t('checkedOn', { date: e.verified })}{e.category !== 'talaan' && e.category !== 'employees' ? <> · {t('reviewNote')}</> : null}</div></div>);
}
function Ask({ c }: { c: Ctx }) {
  const { t } = c; const [q, setQ] = useState(''); const [log, setLog] = useState<{ q: string; a: Entry[] }[]>([]);
  const aud = audienceOf(c.user);
  const suggestions = corpusOf(c).filter(e => !aud || e.audience.includes(aud)).filter(e => ['thirteenth-tax', 'de-minimis', 'min-wage-ncr', 'deadline-1601c', 'emp-deductions', 'final-pay'].includes(e.id)).slice(0, 4).map(e => e.q[c.lang]);
  const go = (text: string) => { if (!text.trim()) return; const a = ask(text, c.lang, aud, corpusOf(c)); setLog(l => [...l, { q: text, a }]); if (!a.length) c.setS(s => ({ ...s, askLog: [...s.askLog, text] })); setQ(''); };
  return (<><div className="head"><h1>{t('askTitle')}</h1><button className="btn ghost" onClick={() => c.go({ page: 'faqs' })}>{t('browseFaqs')}</button></div><section className="card chat"><Why>{t('askIntro')}</Why>
    {log.map((m, i) => <div key={i} className="turn"><div className="bub me">{m.q}</div>
      {m.a.length ? m.a.map(e => <div key={e.id} className="bub tala"><Star size={22} /><div><b>{e.q[c.lang]}</b><Answer c={c} e={e} /></div></div>)
        : <div className="bub tala"><Star size={22} /><div>{t('noSource')}</div></div>}</div>)}
    {!log.length && <div className="sugg"><span className="muted small">{t('tryAsking')}</span>{suggestions.map(s => <button key={s} className="btn small ghost" onClick={() => go(s)}>{s}</button>)}</div>}
    <form className="askbar" onSubmit={e => { e.preventDefault(); go(q); }}><input value={q} placeholder={t('askPlaceholder')} onChange={e => setQ(e.target.value)} /><button className="btn" type="submit">{t('askButton')}</button></form>
  </section></>);
}

/* ---------------- FAQs ---------------- */
function Faqs({ c }: { c: Ctx }) {
  const { t } = c; const aud = audienceOf(c.user);
  const [cat, setCat] = useState<string>(aud ? 'employees' : 'all'); const [find, setFind] = useState(''); const [open, setOpen] = useState<string | null>(null);
  const pool = corpusOf(c).filter(e => !aud || e.audience.includes(aud));
  const cats = CATEGORIES.filter(k => pool.some(e => e.category === k));
  const f = find.trim().toLowerCase();
  const shown = pool.filter(e => (cat === 'all' || e.category === cat) && (!f || `${e.q[c.lang]} ${e.a[c.lang]} ${e.q.en} ${e.source}`.toLowerCase().includes(f)));
  const groups = (cat === 'all' ? cats : [cat]).map(k => [k, shown.filter(e => e.category === k)] as const).filter(([, es]) => es.length);
  return (<><div className="head"><div><h1>{t('faqs')}</h1><p className="muted">{t('faqIntro')}</p></div><div className="row"><button className="btn ghost" onClick={c.openTour}><Star size={16} /> {t('tour')}</button><button className="btn ghost" onClick={() => c.go({ page: 'ask' })}>{t('askTala')}</button></div></div>
    <div className="faqbar"><input type="search" value={find} placeholder={t('faqSearch')} aria-label={t('faqSearch')} onChange={e => setFind(e.target.value)} />
      <div className="pills" role="group">{(['all', ...cats] as string[]).map(k => <button key={k} aria-pressed={cat === k} onClick={() => setCat(k)}>{k === 'all' ? t('allTopics') : t('cat_' + k)} <span>{k === 'all' ? pool.length : pool.filter(e => e.category === k).length}</span></button>)}</div></div>
    {!groups.length && <p className="muted">{t('noMatches')}</p>}
    {groups.map(([k, es]) => <section key={k} className="card faqgroup"><h2>{t('cat_' + k)}</h2>
      {es.map(e => <div key={e.id} className={`faq ${open === e.id ? 'open' : ''}`}>
        <button aria-expanded={open === e.id} onClick={() => setOpen(open === e.id ? null : e.id)}><span>{e.q[c.lang]}</span><span className="chev" aria-hidden="true">{open === e.id ? '−' : '+'}</span></button>
        {open === e.id && <Answer c={c} e={e} />}</div>)}</section>)}</>);
}

/* ---------------- Plans ---------------- */
function Plans({ c }: { c: Ctx }) {
  const { t } = c;
  return (<><div className="head"><h1>{t('plansTitle')}</h1></div><p className="muted">{t('hypothesis')}</p>
    <div className="grid">
      <section className="card plan"><h2>{t('firmPlan')}</h2><p className="muted small">{t('perClient')}</p>
        {[['1–10', 499], ['11–50', 1299], ['51–200', 2999]].map(([r, p]) => <div key={r} className="kv"><span>{t('clientSize', { range: r })}</span><b>₱{p.toLocaleString('en-PH')}</b></div>)}
        <p className="small">{t('firmIncludes')}</p></section>
      <section className="card plan"><h2>{t('smePlan')}: {t('essentials')}</h2><p className="price">₱99 <span className="muted small">{t('perEmployee')}</span></p><p className="muted small">{t('minimum')}</p><p className="small">{t('essentialsIncludes')}</p></section>
      <section className="card plan"><h2>{t('smePlan')}: {t('plus')}</h2><p className="price">₱149 <span className="muted small">{t('perEmployee')}</span></p><p className="small">{t('plusIncludes')}</p></section>
    </div></>);
}

/* ---------------- Teamwork: activity and notes ---------------- */
const initials = (id: string) => { const w = (USERS.find(u => u.id === id)?.name ?? id).split(' '); return (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase(); };
function activityText(c: Ctx, a: Activity) {
  const d = { ...(a.detail ?? {}) } as Record<string, string | number>;
  if (typeof d.period === 'string') d.period = c.periodLabel(d.period);
  if (typeof d.kind === 'string') d.file = `${c.t(fileKey(d.kind as FilingKind))}, ${c.monthLabel(String(d.month))}`;
  return c.t(a.action, d);
}
function ActivityList({ c, limit }: { c: Ctx; limit?: number }) {
  const clients = visibleClients(c);
  const items = c.s.activity.filter(a => !a.clientId || clients.some(x => x.id === a.clientId)).slice(0, limit ?? 300);
  if (!items.length) return <p className="muted">{c.t('noActivity')}</p>;
  return <ul className="activity">{items.map((a, i) => { const u = USERS.find(x => x.id === a.user); const cl = c.s.clients.find(x => x.id === a.clientId); return (
    <li key={i}><span className="avatar">{initials(a.user)}</span><span className="grow"><b>{u?.name}</b> {activityText(c, a)}{cl && <span className="muted">, {cl.name}</span>}</span>
      <span className="muted small">{new Date(a.at).toLocaleString(INTL_LOCALE[c.lang], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></li>); })}</ul>;
}
function Notes({ c, run }: { c: Ctx; run: Run }) {
  const { t } = c; const [text, setText] = useState(''); const notes = c.s.notes[run.id] ?? [];
  const add = () => { const v = text.trim(); if (!v) return; c.setS(s => ({ ...s, notes: { ...s.notes, [run.id]: [...(s.notes[run.id] ?? []), { at: new Date().toISOString(), user: c.user.id, text: v.slice(0, 1000) }] } })); c.log('act_note', {}, run.clientId); setText(''); };
  return (<section className="card"><h2>{t('notesTitle')}</h2>
    {!notes.length && <p className="muted small">{t('noNotes')}</p>}
    <ul className="notes">{notes.map((n, i) => <li key={i}><span className="avatar">{initials(n.user)}</span><div><b>{USERS.find(u => u.id === n.user)?.name}</b> <span className="muted small">{new Date(n.at).toLocaleString(INTL_LOCALE[c.lang], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span><p>{n.text}</p></div></li>)}</ul>
    {c.user.role !== 'employee' && <form className="askbar" onSubmit={e => { e.preventDefault(); add(); }}><input value={text} placeholder={t('notePlaceholder')} onChange={e => setText(e.target.value)} /><button className="btn" type="submit" disabled={!text.trim()}>{t('addNote')}</button></form>}
  </section>);
}

/* ---------------- Connections: apps, import and export, activity ---------------- */
type AppCard = { name: string; group: string; status: 'works' | 'demo' | 'files' | 'planned'; phase?: number; desc: string; action?: () => void; actionLabel?: string; extra?: string };
function Connections({ c, tab }: { c: Ctx; tab?: string }) {
  const { t } = c; const cur = tab ?? 'apps';
  const tabs: [string, string][] = [['apps', 'tabApps'], ['data', 'tabData'], ['email', 'tabEmail'], ['partners', 'tabPartners'], ['continuity', 'tabContinuity'], ['activity', 'tabActivity']];
  return (<><div className="head"><div><h1>{t('connections')}</h1><p className="muted">{t('conIntro')}</p></div></div>
    <div className="pills tabs" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={cur === k} aria-pressed={cur === k} onClick={() => c.go({ page: 'connections', id: k })}>{t(l)}</button>)}</div>
    {cur === 'apps' && <Apps c={c} />}{cur === 'data' && <DataHub c={c} />}{cur === 'partners' && <PartnerChecks c={c} />}{cur === 'email' && <Outbox c={c} />}{cur === 'continuity' && <Continuity c={c} />}{cur === 'activity' && <section className="card"><ActivityList c={c} /></section>}</>);
}
function Apps({ c }: { c: Ctx }) {
  const { t } = c; const clients = visibleClients(c);
  const toData = () => c.go({ page: 'connections', id: 'data' }); const toFiles = () => c.go({ page: 'files' });
  const xeroN = clients.filter(x => x.xero).length;
  const preview = (channel: string) => { const run = c.s.runs.find(r => r.status === 'draft' && clients.some(x => x.id === r.clientId)) ?? c.s.runs[0]; const cl = c.s.clients.find(x => x.id === run.clientId)!;
    c.modal(<div><h2>{t('msgTitle')}: {channel}</h2><div className="msgprev"><Star size={20} /><p>{t('msgApproval', { client: cl.name, period: c.periodLabel(run.period), net: peso(totals(linesFor(c.s, run)).net) })}</p></div>
      <p className="muted small">{t('st_planned', { n: 2 })}</p><div className="row end"><button className="btn" onClick={() => c.modal(null)}>{t('close')}</button></div></div>); };
  const cards: AppCard[] = [
    { name: 'Xero', group: 'grp_accounting', status: 'demo', desc: t('d_xero'), action: toData, actionLabel: t('act_open'), extra: t('connectedCount', { n: xeroN, total: clients.length }) },
    { name: 'QuickBooks Online', group: 'grp_accounting', status: 'works', desc: t('d_qbo'), action: toData, actionLabel: t('act_open') },
    { name: 'Juan', group: 'grp_accounting', status: 'works', desc: t('d_juan'), action: toData, actionLabel: t('act_open') },
    { name: 'BIR eFPS / eBIRForms', group: 'grp_government', status: 'files', desc: t('d_bir'), action: toFiles, actionLabel: t('act_open') },
    { name: 'My.SSS', group: 'grp_government', status: 'files', desc: t('d_sss'), action: toFiles, actionLabel: t('act_open') },
    { name: 'PhilHealth EPRS', group: 'grp_government', status: 'files', desc: t('d_ph'), action: toFiles, actionLabel: t('act_open') },
    { name: 'Virtual Pag-IBIG', group: 'grp_government', status: 'files', desc: t('d_pi'), action: toFiles, actionLabel: t('act_open') },
    ...['BDO', 'BPI', 'Metrobank', 'UnionBank'].map(b => ({ name: b, group: 'grp_banks', status: 'works' as const, desc: t('d_bank'), action: () => c.go({ page: 'payruns' }), actionLabel: t('act_open') })),
    { name: 'GCash', group: 'grp_wallets', status: 'works', desc: t('d_wallet'), action: toData, actionLabel: t('act_open') },
    { name: 'Maya', group: 'grp_wallets', status: 'works', desc: t('d_wallet'), action: toData, actionLabel: t('act_open') },
    { name: 'PayMongo / Xendit', group: 'grp_wallets', status: 'planned', phase: 2, desc: t('d_gateway') },
    { name: 'Excel / Google Sheets', group: 'grp_time', status: 'works', desc: t('d_sheets'), action: toData, actionLabel: t('act_open') },
    { name: 'ZKTeco / biometrics', group: 'grp_time', status: 'works', desc: t('d_bio'), action: () => c.go({ page: 'payruns' }), actionLabel: t('act_open') },
    { name: 'Google Calendar / Outlook', group: 'grp_team', status: 'works', desc: t('d_cal'), action: toData, actionLabel: t('act_open') },
    { name: 'Email', group: 'grp_team', status: 'planned', phase: 1, desc: t('d_email'), action: () => preview('Email'), actionLabel: t('act_preview') },
    { name: 'Viber', group: 'grp_team', status: 'planned', phase: 2, desc: t('d_viber'), action: () => preview('Viber'), actionLabel: t('act_preview') },
    { name: 'Slack', group: 'grp_team', status: 'planned', phase: 2, desc: t('d_slack'), action: () => preview('Slack'), actionLabel: t('act_preview') },
    { name: 'Microsoft Teams', group: 'grp_team', status: 'planned', phase: 2, desc: t('d_teams'), action: () => preview('Microsoft Teams'), actionLabel: t('act_preview') },
  ];
  const chip = (a: AppCard) => a.status === 'works' ? <Chip u="ok">{t('st_works')}</Chip> : a.status === 'demo' ? <Chip u="info">{t('st_demo')}</Chip> : a.status === 'files' ? <Chip u="info">{t('st_files')}</Chip> : <Chip u="soon">{t('st_planned', { n: a.phase ?? 2 })}</Chip>;
  return <>{['grp_accounting', 'grp_government', 'grp_banks', 'grp_wallets', 'grp_time', 'grp_team'].map(g => (
    <section key={g} className="card"><h2>{t(g)}</h2><div className="appgrid">{cards.filter(a => a.group === g).map(a => (
      <div key={a.name} className="appcard"><div className="row between"><span className="appname"><span className="appmark" aria-hidden="true">{a.name.split(/[ /.]/)[0].slice(0, 2)}</span>{a.name}</span>{chip(a)}</div>
        <p className="small">{a.desc}</p>{a.extra && <p className="muted small">{a.extra}</p>}
        {a.action ? <button className="btn small ghost" onClick={a.action}>{a.actionLabel}</button> : <button className="btn small ghost" disabled>{t('comingLater')}</button>}</div>))}</div></section>))}</>;
}
function DataHub({ c }: { c: Ctx }) {
  const { t } = c; const clients = visibleClients(c);
  const [clientId, setClientId] = useState<string>('all');
  const sel = clientId === 'all' ? clients : clients.filter(x => x.id === clientId);
  const tag = clientId === 'all' ? 'all-clients' : clientId; const stamp = iso(today());
  const name = (id: string) => c.s.clients.find(x => x.id === id)?.name ?? id;
  const approved = c.s.runs.filter(r => r.status === 'approved' && sel.some(x => x.id === r.clientId)).sort((a, b) => a.period.localeCompare(b.period));
  const codesFor = (id: string) => (k: string) => (c.s.clients.find(x => x.id === id)?.codes ?? DEFAULT_CODES)[k as AccountKey] ?? k;
  const journals = () => approved.map(r => ({ r, narration: `Payroll ${name(r.clientId)} ${r.period}`, date: iso(periodInfo(r.period).payDate), lines: journal(r.lines ?? []) }));
  const latest = (w: 'gcash' | 'maya') => { const r = [...approved].reverse().find(x => (x.lines ?? []).some(l => c.s.employees.find(e => e.id === l.empId)?.payout === w)); return r; };
  const exports: { key: string; file: string; make: () => string | null }[] = [
    { key: 'exp_employees', file: `talaan_employees_${tag}_${stamp}.csv`, make: () => employeesCsv(c.s.employees.filter(e => sel.some(x => x.id === e.clientId)), name) },
    { key: 'exp_register', file: `talaan_register_${tag}_${stamp}.csv`, make: () => registerCsv(approved.map(r => ({ client: name(r.clientId), period: r.period, lines: r.lines ?? [] })), c.s.employees) },
    { key: 'exp_xero', file: `talaan_xero_journals_${tag}_${stamp}.csv`, make: () => { const js = journals(); return js.length ? xeroJournalCsv(js.map(j => ({ narration: j.narration, date: j.date, lines: j.lines, codes: codesFor(j.r.clientId) })), k => DICTS.en[k] ?? k) : null; } },
    { key: 'exp_generic', file: `talaan_journals_${tag}_${stamp}.csv`, make: () => { const js = journals(); return js.length ? genericJournalCsv(js.map((j, i) => ({ no: `TAL-${String(i + 1).padStart(4, '0')}`, narration: j.narration, date: j.date, lines: j.lines, codes: codesFor(j.r.clientId) })), k => DICTS.en[k] ?? k) : null; } },
    { key: 'exp_calendar', file: `talaan_deadlines_${tag}_${stamp}.csv`, make: () => calendarCsv(tasksFor(c.s, today()).filter(k => sel.some(x => x.id === k.clientId)).map(k => ({ subject: `${name(k.clientId)}: ${taskText(c, k)}`, date: k.due, description: k.kind === 'file' ? `Upload at ${PORTAL[k.filing!.kind]}` : 'Talaan pay run' }))) },
    { key: 'exp_gcash', file: `talaan_gcash_payouts_${tag}_${stamp}.csv`, make: () => { const r = latest('gcash'); return r ? payoutFile(r.lines ?? [], c.s.employees, 'gcash', `${name(r.clientId)} ${r.period}`) : null; } },
    { key: 'exp_maya', file: `talaan_maya_payouts_${tag}_${stamp}.csv`, make: () => { const r = latest('maya'); return r ? payoutFile(r.lines ?? [], c.s.employees, 'maya', `${name(r.clientId)} ${r.period}`) : null; } },
    { key: 'exp_backup', file: `talaan_backup_${stamp}.json`, make: () => JSON.stringify(c.s, null, 1) },
  ];
  return (<div className="split2">
    <section className="card"><h2>{t('exportTitle')}</h2>
      <div className="form"><label>{t('forClient')}<select value={clientId} onChange={e => setClientId(e.target.value)}><option value="all">{t('allClients')}</option>{clients.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div>
      <ul className="exports">{exports.filter(x => x.key !== 'exp_backup' || c.user.role === 'firmOwner' || c.user.role === 'preparer').map(x => <li key={x.key}><span className="grow"><b>{t(x.key)}</b><br /><span className="muted small">{x.file}</span></span>
        <button className="btn small" onClick={() => { const data = x.make(); if (!data) return c.toast(t('nothingToExport')); saveFile(c, x.file, data); }}>{t('download')}</button></li>)}</ul>
      <p className="muted small">{t('exp_note')}</p></section>
    <div>{(c.user.role === 'firmOwner' || c.user.role === 'preparer') && <section className="card"><h2>{t('importTitle')}</h2><EmployeeImport c={c} /><hr /><Restore c={c} /></section>}
      <ProtectCard c={c} /></div>
  </div>);
}
function EmployeeImport({ c }: { c: Ctx }) {
  const { t } = c; const clients = visibleClients(c);
  const [clientId, setClientId] = useState(clients[0]?.id); const [text, setText] = useState('');
  type Row = { e: Employee; problems: string[]; existing: boolean };
  const [rows, setRows] = useState<Row[] | null>(null);
  const check = () => {
    const tbl = parseTable(text); if (tbl.length < 2) { setRows([]); return; }
    const head = tbl[0].map(h => h.toLowerCase());
    const col = (re: RegExp) => head.findIndex(h => re.test(h));
    const ix = { name: col(/^name|pangalan|姓名/), pos: col(/position|posisyon|职位/), rate: col(/rate|salary|sahod|月薪/), tin: col(/tin/), sss: col(/sss/), ph: col(/philhealth|phic/), pi: col(/pag-?ibig|hdmf|mid/), bank: col(/bank|account|账号/), pay: col(/pay by|payout|paraan|付款/), mobile: col(/mobile|phone|gcash|maya|手机/) };
    const cl = c.s.clients.find(x => x.id === clientId)!;
    setRows(tbl.slice(1).map((r, i) => {
      const g = (k: keyof typeof ix) => (ix[k] >= 0 ? r[ix[k]] ?? '' : '').trim();
      const nm = g('name'); const ex = c.s.employees.find(e => e.clientId === clientId && e.name.toLowerCase() === nm.toLowerCase());
      const payRaw = g('pay').toLowerCase(); const payout: Employee['payout'] = /gcash/.test(payRaw) ? 'gcash' : /maya/.test(payRaw) ? 'maya' : 'bank';
      const e: Employee = { id: ex?.id ?? `${clientId}-imp-${Date.now()}-${i}`, clientId, name: nm, position: g('pos'), monthlyRate: r2(Number(g('rate').replace(/[₱,\s]/g, '')) || 0), workdays: cl.workdays,
        tin: g('tin'), sss: g('sss'), philhealth: g('ph'), pagibig: g('pi'), bankAccount: g('bank'), payout, mobile: g('mobile'), active: true };
      const p: string[] = [];
      if (nm.length < 2) p.push(t('name')); if (!(e.monthlyRate > 0)) p.push(t('monthlyRate'));
      if (!idRules.tin(e.tin)) p.push(t('tin')); if (!idRules.sss(e.sss)) p.push(t('sss')); if (!idRules.philhealth(e.philhealth)) p.push(t('philhealth')); if (!idRules.pagibig(e.pagibig)) p.push(t('pagibig'));
      if (payout === 'bank' ? !idRules.bankAccount(e.bankAccount) : !idRules.mobile(e.mobile ?? '')) p.push(payout === 'bank' ? t('bankAccount') : t('mobile'));
      return { e, problems: p, existing: !!ex };
    }));
  };
  const good = rows?.filter(r => !r.problems.length) ?? [];
  const apply = () => { c.setS(s => { const ids = new Set(good.map(r => r.e.id)); return { ...s, employees: [...s.employees.filter(e => !ids.has(e.id)), ...good.map(r => r.e)] }; });
    c.log('act_import', { n: good.length }, clientId); c.toast(t('importedN', { n: good.length })); setRows(null); setText(''); };
  const onFile = (f?: File) => { if (!f) return; f.text().then(x => { setText(x); setRows(null); }).catch(() => c.toast(t('badFile'))); };
  const sample = 'Name\tPosition\tMonthly rate\tTIN\tSSS\tPhilHealth\tPag-IBIG\tBank account\tPay by\tMobile\nMaria Reyes\tCashier\t21000\t123-456-789\t34-1234567-8\t12-345678901-2\t1234-5678-9012\t001234567890\tBank\t';
  return (<div><h3>{t('imp_employees')}</h3><p className="small muted">{t('impHelp')}</p>
    <div className="form"><label>{t('forClient')}<select value={clientId} onChange={e => { setClientId(e.target.value); setRows(null); }}>{clients.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>{t('chooseFile')}<input type="file" accept=".csv,.tsv,.txt,text/csv" onChange={e => onFile(e.target.files?.[0])} /></label></div>
    <textarea rows={5} value={text} placeholder={sample} onChange={e => { setText(e.target.value); setRows(null); }} />
    <div className="row"><button className="btn small" disabled={!text.trim()} onClick={check}>{t('checkRows')}</button>
      {rows && <span className={good.length === rows.length ? 'okmsg small' : 'warn small'}>{t('rowsOk', { ok: good.length, bad: rows.length - good.length })}</span>}</div>
    {rows && rows.length > 0 && <div className="scroll"><table className="tbl small"><thead><tr><th>{t('name')}</th><th></th><th>{t('rowProblem')}</th></tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}><td>{r.e.name || '—'}</td><td>{r.problems.length ? <Chip u="late">!</Chip> : <Chip u="ok">{r.existing ? t('willUpdate') : t('willAdd')}</Chip>}</td><td className="small">{r.problems.join(', ')}</td></tr>)}</tbody></table></div>}
    {!rows && <p className="muted small">{t('noRowsYet')}</p>}
    <div className="row end"><button className="btn" disabled={!good.length} onClick={apply}>{t('importRows', { n: good.length })}</button></div></div>);
}
function Restore({ c }: { c: Ctx }) {
  const { t } = c;
  const onFile = (f?: File) => { if (!f) return; f.text().then(x => { const d = JSON.parse(x) as State;
    if (!d || !Array.isArray(d.clients) || !Array.isArray(d.employees) || !Array.isArray(d.runs)) throw new Error('bad');
    c.modal(<div><h2>{t('impRestore')}</h2><p>{t('restoreWarn')}</p><div className="row end"><button className="btn ghost" onClick={() => c.modal(null)}>{t('cancel')}</button>
      <button className="btn" onClick={() => { const base = sampleState(); c.setS({ ...base, ...d, v: 7, activity: d.activity ?? [], notes: d.notes ?? {}, filings: d.filings ?? {}, askLog: d.askLog ?? [], remits: d.remits ?? {}, partners: d.partners ?? {}, users: d.users ?? base.users, refs: d.refs ?? base.refs, corpus: d.corpus ?? base.corpus, watch: d.watch ?? base.watch }); c.log('act_restore'); c.modal(null); c.toast(t('restored')); }}>{t('confirm')}</button></div></div>);
  }).catch(() => c.toast(t('badFile'))); };
  return <div><h3>{t('impRestore')}</h3><div className="form"><label>{t('chooseBackup')}<input type="file" accept=".json,application/json" onChange={e => onFile(e.target.files?.[0])} /></label></div></div>;
}

/* ---------------- Partner checks and continuity ---------------- */
const PARTNERS: { name: string; kind: string }[] = [
  { name: 'BDO', kind: 'grp_banks' }, { name: 'BPI', kind: 'grp_banks' }, { name: 'Metrobank', kind: 'grp_banks' }, { name: 'UnionBank', kind: 'grp_banks' },
  { name: 'GCash', kind: 'grp_wallets' }, { name: 'Maya', kind: 'grp_wallets' }, { name: 'PayMongo', kind: 'grp_wallets' }, { name: 'Xendit', kind: 'grp_wallets' },
  { name: 'Juan (BIR eTSP)', kind: 'grp_accounting' }, { name: 'Xero', kind: 'grp_accounting' }, { name: 'Hosting and data (Vercel, Upstash, database)', kind: 'grp_team' },
];
const CHECKS: CheckKey[] = ['funds', 'licence', 'bcp', 'export', 'continuity'];
const emptyCheck = (): PartnerCheck => ({ checks: { funds: 'unknown', licence: 'unknown', bcp: 'unknown', export: 'unknown', continuity: 'unknown' }, licence: '', evidence: '' });
function partnerStatus(p?: PartnerCheck) {
  if (!p || CHECKS.every(k => p.checks[k] === 'unknown')) return { u: 'info' as const, key: 'pc_unchecked' };
  if (CHECKS.some(k => p.checks[k] === 'no')) return { u: 'late' as const, key: 'pc_gaps' };
  if (CHECKS.some(k => p.checks[k] === 'unknown')) return { u: 'soon' as const, key: 'pc_unchecked' };
  if (!p.reviewed || daysBetween(new Date(p.reviewed), today()) > 365) return { u: 'soon' as const, key: 'pc_stale' };
  return { u: 'ok' as const, key: 'pc_ready' };
}
function PartnerChecks({ c }: { c: Ctx }) {
  const { t } = c; const [open, setOpen] = useState<string | null>(null);
  const canEdit = c.user.role === 'firmOwner' || c.user.role === 'preparer';
  const upd = (name: string, p: PartnerCheck) => c.setS(s => ({ ...s, partners: { ...s.partners, [name]: p } }));
  return (<><Why>{t('pcIntro')}</Why><p className="muted small">{t('pcNotHolding')}</p>
    <section className="card">{PARTNERS.map(({ name, kind }) => { const p = c.s.partners[name] ?? emptyCheck(); const st = partnerStatus(c.s.partners[name]); return (
      <div key={name} className={`faq ${open === name ? 'open' : ''}`}><button aria-expanded={open === name} onClick={() => setOpen(open === name ? null : name)}><span>{name} <span className="muted small">· {t(kind)}</span></span><span className="row"><Chip u={st.u}>{t(st.key)}</Chip><span className="chev">{open === name ? '−' : '+'}</span></span></button>
        {open === name && <div className="answer"><table className="tbl small"><tbody>{CHECKS.map(k => <tr key={k}><td><b>{t('ck_' + k)}</b><div className="muted">{t('ckh_' + k)}</div></td>
          <td style={{ width: 150 }}><select disabled={!canEdit} value={p.checks[k]} onChange={e => upd(name, { ...p, checks: { ...p.checks, [k]: e.target.value as CheckValue } })}>{(['unknown', 'yes', 'no'] as CheckValue[]).map(v => <option key={v} value={v}>{t('v_' + v)}</option>)}</select></td></tr>)}</tbody></table>
          <div className="form"><label>{t('licenceNo')}<input disabled={!canEdit} value={p.licence} onChange={e => upd(name, { ...p, licence: e.target.value.slice(0, 160) })} /></label>
            <label>{t('evidence')}<input disabled={!canEdit} value={p.evidence} onChange={e => upd(name, { ...p, evidence: e.target.value.slice(0, 300) })} /></label></div>
          <div className="row"><span className="muted small">{t('reviewedOn')}: {p.reviewed ?? '—'}</span>{canEdit && <button className="btn small ghost" onClick={() => upd(name, { ...p, reviewed: iso(today()) })}>{t('markReviewed')}</button>}</div></div>}</div>); })}</section></>);
}
function Continuity({ c }: { c: Ctx }) {
  const { t } = c; const last = c.s.activity.find(a => a.action === 'act_exported' && String(a.detail?.file ?? '').startsWith('talaan_continuity_'));
  const download = () => { const name = (id: string) => c.s.clients.find(x => x.id === id)?.name ?? id;
    const deadlines = tasksFor(c.s, today()).map(k => ({ subject: `${name(k.clientId)}: ${taskText(c, k)}`, date: k.due, description: k.kind === 'file' ? `Upload at ${PORTAL[k.filing!.kind]}` : 'Pay run' }));
    saveFile(c, `talaan_continuity_${iso(today())}.zip`, continuityPack(c.s, { today: today(), deadlines, clientName: name })); };
  return (<><Why>{t('ctIntro')}</Why>
    <section className="card"><h2>{t('ctPack')}</h2><p>{t('ctPackDesc')}</p><p className="muted small">{last ? t('ctLast', { date: new Date(last.at).toLocaleDateString(INTL_LOCALE[c.lang]) }) : t('ctNever')} {t('ctDue')}</p>
      {(c.user.role === 'firmOwner' || c.user.role === 'preparer') && <button className="btn" onClick={download}>{t('ctPack')}</button>}</section>
    <section className="card"><h2>{t('ctPlan')}</h2><ol className="plan">{['ct1', 'ct2', 'ct3', 'ct4'].map(k => <li key={k}>{t(k)}</li>)}</ol><p className="muted small">{t('ctDrill')}</p></section></>);
}

/* ---------------- File protection ---------------- */
function ProtectCard({ c }: { c: Ctx }) {
  const { t } = c; const [pw, setPw] = useState(''); const [file, setFile] = useState<File | null>(null); const [err, setErr] = useState('');
  const open = async () => { setErr(''); if (!file) return;
    try { const out = await decryptFile(await file.text(), pw); await saveFile(c, out.name, out.data, { plain: true }); setPw(''); }
    catch (e) { setErr(e instanceof DecryptError && e.code === 'not-envelope' ? t('notEnvelope') : t('wrongPw')); } };
  return (<section className="card"><h2>{t('protectTitle')}</h2><p className="small">{t('protectDesc')}</p>
    <label className="check"><input type="checkbox" checked={!!c.s.prefs?.protect} onChange={e => { if (!e.target.checked) sessionPassword = null; c.setS(s => ({ ...s, prefs: { ...s.prefs, protect: e.target.checked } })); }} /> {t('protectOn')}</label>
    <hr /><h3>{t('openTitle')}</h3><p className="small muted">{t('openDesc')}</p>
    <form className="form" onSubmit={e => { e.preventDefault(); open(); }}>
      <label>{t('chooseFile')}<input type="file" accept=".json,application/json" onChange={e => { setFile(e.target.files?.[0] ?? null); setErr(''); }} /></label>
      <label>{t('password')}<input type="password" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} /></label>
      <div className="row"><button className="btn" type="submit" disabled={!file || !pw}>{t('decryptSave')}</button></div></form>
    {err && <p className="bad small">{err}</p>}</section>);
}

/* ---------------- Help, tips and getting started ---------------- */
function Tip({ text }: { text: string }) {
  return <span className="tip" tabIndex={0} role="note" aria-label={text}>i<span className="tipbox" aria-hidden="true">{text}</span></span>;
}
const PAGE_ICON: Record<string, string> = { home: '🏠', clients: '🏢', client: '🏢', payruns: '💵', run: '💵', files: '🧾', connections: '🔗', faqs: '❓', ask: '💬', plans: '🏷️', admin: '⚙️', payslips: '📄' };
function PageHelp({ c, page }: { c: Ctx; page: string }) {
  const { t } = c; const [open, setOpen] = useState(false);
  const key = page === 'client' ? 'client' : page; const lead = t(`h_${key}_lead`); if (lead.startsWith('h_')) return null;
  const steps = t(`h_${key}_steps`).split('|');
  return (<div className="pagehelp"><span className="phicon" aria-hidden="true">{PAGE_ICON[key] ?? '★'}</span>
    <div className="grow"><p>{lead}</p>{open && <ol>{steps.map((x, i) => <li key={i}>{x}</li>)}</ol>}</div>
    <button className="btn small ghost" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? t('hideHelp') : t('howItWorks')}</button></div>);
}
function corpusDue(c: Ctx) {
  const days = c.s.corpus.reviewEveryDays || 30;
  return corpusOf(c).filter(e => !e.verified || daysBetween(new Date(e.verified), today()) > days).length;
}
function GettingStarted({ c }: { c: Ctx }) {
  const { t } = c;
  const items: [string, boolean, Route][] = [
    ['gs1', c.s.users.filter(u => u.active !== false && (u.role === 'firmOwner' || u.role === 'preparer')).length > 1, { page: 'admin', id: 'users' }],
    ['gs2', c.s.clients.some(x => x.ids?.sss && x.ids?.tin), { page: 'clients' }],
    ['gs3', c.s.employees.length > 0, { page: 'clients' }],
    ['gs4', c.s.clients.some(x => x.bankTemplate?.verified), { page: 'clients' }],
    ['gs5', c.s.runs.some(r => r.status === 'approved'), { page: 'payruns' }],
    ['gs6', Object.values(c.s.remits).some(r => r.receipt && r.amountPaid !== undefined && r.reference && r.uploadedAt && !r.reference.endsWith(r.reference.slice(-3)) === false && !Object.keys(c.s.filings).length), { page: 'files' }],
    ['gs7', !!c.s.corpus.lastCheck && Object.values(c.s.partners).some(p => p.reviewed), { page: 'admin', id: 'corpus' }],
  ];
  const done = items.filter(x => x[1]).length;
  if (done === items.length) return null;
  return (<section className="card gs"><div className="row between"><h2>{t('gettingStarted')}</h2><span className="muted small">{t('gsDone', { n: done, m: items.length })}</span></div>
    <div className="gsbar"><span style={{ width: `${(done / items.length) * 100}%` }} /></div>
    <ol className="gslist">{items.map(([k, ok, r]) => <li key={k} className={ok ? 'done' : ''}><span className="gsdot">{ok ? '✓' : ''}</span><span className="grow">{t(k)}</span>{!ok && <button className="btn small ghost" onClick={() => c.go(r)}>{t('go')}</button>}</li>)}</ol></section>);
}

/* ---------------- Supporting documents ---------------- */
function DocsPanel({ c, owner, title, kind, compact }: { c: Ctx; owner: string; title: string; kind?: string; compact?: boolean }) {
  const { t } = c; const [docs, setDocs] = useState<DocMeta[]>([]); const [k, setK] = useState(kind ?? c.s.refs.docTypes[0] ?? 'Other');
  const refresh = () => listDocs(owner).then(setDocs).catch(() => setDocs([]));
  useEffect(() => { refresh(); }, [owner]);
  const canEdit = c.user.role !== 'employee';
  const upload = async (files: FileList | null) => { if (!files) return;
    for (const f of Array.from(files)) { if (f.size > MAX_DOC_BYTES) { c.toast(t('tooBig')); continue; }
      await addDoc({ owner, kind: k, name: f.name, size: f.size, type: f.type, addedBy: c.user.id }, f); c.log('act_doc', { file: f.name }); }
    refresh(); c.toast(t('docAdded')); };
  const download = async (d: DocMeta) => { const x = await getDoc(d.id); if (x) saveFile(c, d.name, await x.blob.arrayBuffer(), { plain: true }); };
  const Wrap = compact ? 'div' : 'section';
  return (<Wrap className={compact ? 'docs compact' : 'card docs'}><div className="row between"><h3 style={{ margin: 0 }}>📎 {title}</h3>
      {canEdit && <div className="row">{!kind && <select aria-label={t('docKind')} value={k} onChange={e => setK(e.target.value)}>{c.s.refs.docTypes.map(x => <option key={x}>{x}</option>)}</select>}
        <label className="btn small ghost filebtn">{t('addDoc')}<input type="file" multiple accept={ACCEPT_DOCS} onChange={e => { upload(e.target.files); e.target.value = ''; }} /></label></div>}</div>
    {!docs.length ? <p className="muted small">{t('noDocs')}</p> : <ul className="doclist">{docs.map(d => <li key={d.id}><span className="grow"><b>{d.name}</b> <span className="muted small">{d.kind} · {(d.size / 1024).toFixed(0)} KB · {new Date(d.addedAt).toLocaleDateString(INTL_LOCALE[c.lang])} · {USERS.find(u => u.id === d.addedBy)?.name ?? d.addedBy}</span></span>
      <button className="btn small ghost" onClick={() => download(d)}>{t('download')}</button>{canEdit && <button className="btn small ghost" onClick={() => deleteDoc(d.id).then(() => { refresh(); c.toast(t('docRemoved')); })}>{t('deleteDoc')}</button>}</li>)}</ul>}
    {!compact && <p className="muted small">{t('docsNote')}</p>}</Wrap>);
}

/* ---------------- Clients: add ---------------- */
function ClientForm({ c }: { c: Ctx }) {
  const { t } = c; const refs = c.s.refs;
  const [f, setF] = useState({ name: '', freq: 'semi' as Client['freq'], region: refs.regions[0]?.id ?? '', workdays: 261 as 261 | 313, bank: refs.banks[0] ?? 'BDO', sss: '', philhealth: '', pagibig: '', tin: '', rdo: '', address: '' });
  const set = (p: Partial<typeof f>) => setF(x => ({ ...x, ...p }));
  const taken = c.s.clients.some(x => x.name.trim().toLowerCase() === f.name.trim().toLowerCase());
  const ok = f.name.trim().length > 1 && !taken;
  const save = () => { if (!ok) return; const r = refs.regions.find(x => x.id === f.region);
    const id = f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) + '-' + Date.now().toString(36).slice(-4);
    const cl: Client = { id, name: f.name.trim(), freq: f.freq, region: f.region, minWage: r?.nonAgri ?? 0, workdays: f.workdays, bank: f.bank, xero: false, active: true,
      dueDays: { bir: 10, sss: 28, ph: 15, pi: 15 }, assignee: c.user.role === 'preparer' ? c.user.id : undefined, ids: { sss: f.sss, philhealth: f.philhealth, pagibig: f.pagibig, tin: f.tin, rdo: f.rdo, address: f.address } };
    c.setS(s => ({ ...s, clients: [...s.clients, cl] })); c.log('act_client', { name: cl.name }, id); c.modal(null); c.toast(t('clientAdded')); c.go({ page: 'client', id }); };
  return (<div><h2>{t('addClient')}</h2><div className="form">
    <label>{t('clientName')}<input autoFocus value={f.name} onChange={e => set({ name: e.target.value.slice(0, 80) })} />{!f.name.trim() ? <small className="bad">{t('nameNeeded')}</small> : taken && <small className="bad">{t('nameTaken')}</small>}</label>
    <label>{t('payFreq')}<select value={f.freq} onChange={e => set({ freq: e.target.value as Client['freq'] })}><option value="semi">{t('semi')}</option><option value="monthly">{t('monthlyFreq')}</option></select></label>
    <label><span>{t('region')} <Tip text={t('tip_minWage')} /></span><select value={f.region} onChange={e => set({ region: e.target.value })}>{refs.regions.map(r => <option key={r.id} value={r.id}>{r.name} (₱{r.nonAgri})</option>)}</select></label>
    <label><span>{t('workdays')} <Tip text={t('tip_workdays')} /></span><select value={f.workdays} onChange={e => set({ workdays: Number(e.target.value) as 261 | 313 })}><option value={261}>261</option><option value={313}>313</option></select></label>
    <label>{t('bank')}<select value={f.bank} onChange={e => set({ bank: e.target.value })}>{refs.banks.map(b => <option key={b}>{b}</option>)}</select></label></div>
    <h3>{t('employerIds')}</h3><div className="form">
      {([['sss', 'idSss'], ['philhealth', 'idPh'], ['pagibig', 'idPi'], ['tin', 'idTin'], ['rdo', 'idRdo'], ['address', 'idAddress']] as [keyof typeof f, string][]).map(([k, l]) => <label key={k}>{t(l)}<input value={String(f[k])} onChange={e => set({ [k]: e.target.value.slice(0, 120) } as Partial<typeof f>)} /></label>)}</div>
    <div className="row end"><button className="btn ghost" onClick={() => c.modal(null)}>{t('cancel')}</button><button className="btn" disabled={!ok} onClick={save}>{t('save')}</button></div></div>);
}

/* ---------------- Admin ---------------- */
function Admin({ c, tab }: { c: Ctx; tab?: string }) {
  const { t } = c; const cur = tab ?? 'users';
  const tabs: [string, string][] = [['users', 'tabUsers'], ['clients', 'tabClients'], ['refs', 'tabRefs'], ['corpus', 'tabCorpus'], ['watch', 'tabWatch']];
  return (<><div className="head"><h1>{t('admin')}</h1></div>
    <div className="pills tabs" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={cur === k} aria-pressed={cur === k} onClick={() => c.go({ page: 'admin', id: k })}>{t(l)}</button>)}</div>
    {cur === 'users' && <UsersAdmin c={c} />}{cur === 'clients' && <ClientsAdmin c={c} />}{cur === 'refs' && <RefsAdmin c={c} />}{cur === 'corpus' && <CorpusAdmin c={c} />}{cur === 'watch' && <WatchAdmin c={c} />}</>);
}
function UsersAdmin({ c }: { c: Ctx }) {
  const { t } = c;
  return (<><p className="muted small">{t('prodAuth')}</p><section className="card"><div className="row between"><p style={{ margin: 0 }}>{t('usersIntro')}</p><button className="btn" onClick={() => c.modal(<UserForm c={c} />)}>+ {t('addUser')}</button></div>
    <table className="tbl"><thead><tr><th>{t('name')}</th><th>{t('role')}</th><th>{t('clientFor')}</th><th>{t('email')}</th><th>{t('colStatus')}</th><th></th></tr></thead>
      <tbody>{c.s.users.map(u => <tr key={u.id}><td><span className="avatar">{initials(u.id)}</span> <b>{u.name}</b></td><td>{t(roleKey(u))}<div className="muted small">{t('roleDesc_' + u.role)}</div></td>
        <td>{c.s.clients.find(x => x.id === u.clientId)?.name ?? '—'}</td><td className="small">{u.email ?? '—'}</td><td><Chip u={u.active === false ? 'info' : 'ok'}>{u.active === false ? t('inactive') : t('active')}</Chip></td>
        <td><button className="btn small ghost" onClick={() => c.modal(<UserForm c={c} u={u} />)}>{t('editUser')}</button></td></tr>)}</tbody></table></section></>);
}
function UserForm({ c, u }: { c: Ctx; u?: User }) {
  const { t } = c; const [f, setF] = useState<User>(u ?? { id: `u_${Date.now().toString(36)}`, name: '', role: 'preparer', email: '', active: true });
  const set = (p: Partial<User>) => setF(x => ({ ...x, ...p }));
  const owners = c.s.users.filter(x => x.role === 'firmOwner' && x.active !== false && x.id !== f.id).length;
  const problems = [f.name.trim().length < 2 ? t('nameNeeded').replace(/company/i, '') : '', f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email) ? t('emailBad') : '',
    (f.role === 'client' || f.role === 'employee') && !f.clientId ? t('needClient') : '', f.role === 'employee' && !f.empId ? t('needEmployee') : '',
    u && u.id === c.user.id && f.active === false ? t('cantSelf') : '', (f.role !== 'firmOwner' || f.active === false) && owners === 0 && u?.role === 'firmOwner' ? t('needOwner') : ''].filter(Boolean);
  const save = () => { if (problems.length) return; c.setS(s => ({ ...s, users: u ? s.users.map(x => x.id === f.id ? f : x) : [...s.users, f] })); c.log('act_user', { name: f.name }); c.modal(null); c.toast(t('saved')); };
  return (<div><h2>{u ? t('editUser') : t('addUser')}</h2><div className="form">
    <label>{t('name')}<input value={f.name} onChange={e => set({ name: e.target.value.slice(0, 80) })} /></label>
    <label>{t('email')}<input type="email" value={f.email ?? ''} onChange={e => set({ email: e.target.value.trim().slice(0, 120) })} /></label>
    <label>{t('role')}<select value={f.role} onChange={e => set({ role: e.target.value as Role, clientId: undefined, empId: undefined })}>{(['firmOwner', 'preparer', 'client', 'employee'] as Role[]).map(r => <option key={r} value={r}>{t(roleKey({ ...f, role: r }))}</option>)}</select><small>{t('roleDesc_' + f.role)}</small></label>
    {(f.role === 'client' || f.role === 'employee') && <label>{t('clientFor')}<select value={f.clientId ?? ''} onChange={e => set({ clientId: e.target.value || undefined, empId: undefined })}><option value="">—</option>{c.s.clients.filter(x => x.active !== false).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
    {f.role === 'employee' && f.clientId && <label>{t('employeeFor')}<select value={f.empId ?? ''} onChange={e => set({ empId: e.target.value || undefined })}><option value="">—</option>{c.s.employees.filter(e => e.clientId === f.clientId).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>}
    <label className="check"><input type="checkbox" checked={f.active !== false} onChange={e => set({ active: e.target.checked })} /> {t('active')}</label></div>
    {problems.length > 0 && <ul className="bad small">{problems.map(p => <li key={p}>{p}</li>)}</ul>}
    <div className="row end"><button className="btn ghost" onClick={() => c.modal(null)}>{t('cancel')}</button><button className="btn" disabled={problems.length > 0} onClick={save}>{t('save')}</button></div></div>);
}
function ClientsAdmin({ c }: { c: Ctx }) {
  const { t } = c;
  const toggle = (id: string, active: boolean) => c.setS(s => ({ ...s, clients: s.clients.map(x => x.id === id ? { ...x, active } : x) }));
  return (<section className="card"><div className="row between"><h2>{t('clients')}</h2><button className="btn" onClick={() => c.modal(<ClientForm c={c} />)}>+ {t('addClient')}</button></div>
    <table className="tbl"><thead><tr><th>{t('clientName')}</th><th>{t('region')}</th><th className="num">{t('colStaff')}</th><th>{t('assignee')}</th><th>{t('colStatus')}</th><th></th></tr></thead>
      <tbody>{c.s.clients.map(x => <tr key={x.id}><td><b>{x.name}</b></td><td>{c.s.refs.regions.find(r => r.id === x.region)?.name ?? '—'}</td><td className="num">{c.s.employees.filter(e => e.clientId === x.id).length}</td>
        <td>{USERS.find(u => u.id === x.assignee)?.name ?? '—'}</td><td><Chip u={x.active === false ? 'info' : 'ok'}>{x.active === false ? t('inactive') : t('active')}</Chip></td>
        <td><button className="btn small ghost" onClick={() => c.go({ page: 'client', id: x.id })}>{t('open')}</button> <button className="btn small ghost" onClick={() => toggle(x.id, x.active === false)}>{x.active === false ? t('activate') : t('deactivate')}</button></td></tr>)}</tbody></table></section>);
}
function RefsAdmin({ c }: { c: Ctx }) {
  const { t } = c; const r = c.s.refs;
  const upd = (p: Partial<typeof r>) => c.setS(s => ({ ...s, refs: { ...s.refs, ...p } }));
  const [bank, setBank] = useState(''); const [doc, setDoc] = useState(''); const [hol, setHol] = useState<Holiday>({ date: '', name: '', type: 'regular' });
  const setRegion = (i: number, p: Partial<Region>) => upd({ regions: r.regions.map((x, j) => j === i ? { ...x, ...p } : x) });
  const apply = (reg: Region) => { const n = c.s.clients.filter(x => x.region === reg.id).length; c.setS(s => ({ ...s, clients: s.clients.map(x => x.region === reg.id ? { ...x, minWage: reg.nonAgri } : x) })); c.toast(t('regionApplied', { n })); };
  return (<>
    <section className="card"><h2>{t('regionsTitle')} <Tip text={t('tip_minWage')} /></h2><div className="scroll"><table className="tbl small"><thead><tr><th>{t('region')}</th><th>{t('nonAgri')}</th><th>{t('otherRate')}</th><th>{t('wageOrder')}</th><th>{t('effective')}</th><th>{t('checkedCol')}</th><th></th></tr></thead>
      <tbody>{r.regions.map((x, i) => <tr key={x.id}><td><input value={x.name} onChange={e => setRegion(i, { name: e.target.value })} /></td>
        <td><input type="number" min={0} value={x.nonAgri} onChange={e => setRegion(i, { nonAgri: Math.max(0, Number(e.target.value) || 0) })} /></td>
        <td><input type="number" min={0} value={x.other} onChange={e => setRegion(i, { other: Math.max(0, Number(e.target.value) || 0) })} /></td>
        <td><input value={x.wageOrder} onChange={e => setRegion(i, { wageOrder: e.target.value })} /></td><td><input type="date" value={x.effective} onChange={e => setRegion(i, { effective: e.target.value })} /></td>
        <td><input type="date" value={x.checked ?? ''} onChange={e => setRegion(i, { checked: e.target.value })} /></td><td><button className="btn small ghost" onClick={() => apply(x)}>{t('applyRegion')}</button></td></tr>)}</tbody></table></div>
      <button className="btn small ghost" onClick={() => upd({ regions: [...r.regions, { id: `r_${Date.now().toString(36)}`, name: '', nonAgri: 0, other: 0, wageOrder: '', effective: '' }] })}>+ {t('addRegion')}</button></section>
    <section className="card"><h2>{t('holidaysTitle')}</h2><p className="muted small">{t('holidaysNote')}</p>
      <table className="tbl small"><tbody>{[...r.holidays].sort((a, b) => a.date.localeCompare(b.date)).map(h => <tr key={h.date + h.name}><td>{h.date}</td><td>{h.name}</td><td><Chip u={h.type === 'regular' ? 'info' : 'soon'}>{t(h.type === 'regular' ? 'regularH' : 'specialH')}</Chip></td>
        <td><button className="btn small ghost" onClick={() => upd({ holidays: r.holidays.filter(x => x !== h) })}>{t('removeItem')}</button></td></tr>)}</tbody></table>
      <div className="row"><input type="date" aria-label={t('dateLbl')} value={hol.date} onChange={e => setHol({ ...hol, date: e.target.value })} /><input placeholder={t('nameLbl')} value={hol.name} onChange={e => setHol({ ...hol, name: e.target.value })} />
        <select aria-label={t('typeLbl')} value={hol.type} onChange={e => setHol({ ...hol, type: e.target.value as Holiday['type'] })}><option value="regular">{t('regularH')}</option><option value="special">{t('specialH')}</option></select>
        <button className="btn small" disabled={!hol.date || !hol.name.trim()} onClick={() => { upd({ holidays: [...r.holidays, { ...hol, name: hol.name.trim() }] }); setHol({ date: '', name: '', type: 'regular' }); }}>+ {t('addHoliday')}</button></div></section>
    <div className="split2">
      <section className="card"><h2>{t('banksTitle')}</h2><ul className="chips">{r.banks.map(b => <li key={b}>{b} <button className="link" aria-label={`${t('removeItem')} ${b}`} onClick={() => upd({ banks: r.banks.filter(x => x !== b) })}>✕</button></li>)}</ul>
        <div className="row"><input value={bank} placeholder={t('nameLbl')} onChange={e => setBank(e.target.value.slice(0, 40))} /><button className="btn small" disabled={!bank.trim() || r.banks.includes(bank.trim())} onClick={() => { upd({ banks: [...r.banks, bank.trim()] }); setBank(''); }}>+ {t('addBank')}</button></div></section>
      <section className="card"><h2>{t('docTypesTitle')}</h2><ul className="chips">{r.docTypes.map(b => <li key={b}>{b} <button className="link" aria-label={`${t('removeItem')} ${b}`} onClick={() => upd({ docTypes: r.docTypes.filter(x => x !== b) })}>✕</button></li>)}</ul>
        <div className="row"><input value={doc} placeholder={t('nameLbl')} onChange={e => setDoc(e.target.value.slice(0, 40))} /><button className="btn small" disabled={!doc.trim() || r.docTypes.includes(doc.trim())} onClick={() => { upd({ docTypes: [...r.docTypes, doc.trim()] }); setDoc(''); }}>+ {t('addDocType')}</button></div></section>
    </div></>);
}
function CorpusAdmin({ c }: { c: Ctx }) {
  const { t } = c; const entries = corpusOf(c); const days = c.s.corpus.reviewEveryDays || 30;
  const [issues, setIssues] = useState<ReturnType<typeof checkCorpus> | null>(null);
  const isDue = (e: Entry) => !e.verified || daysBetween(new Date(e.verified), today()) > days;
  const upsert = (e: Entry) => c.setS(s => ({ ...s, corpus: { ...s.corpus, custom: [...s.corpus.custom.filter(x => (x as { id: string }).id !== e.id), { ...e, product: 'talaan', namespace: 'talaan-ph-payroll' } as unknown as Record<string, unknown>] } }));
  const run = () => { const res = checkCorpus(entries); setIssues(res);
    c.setS(s => ({ ...s, corpus: { ...s.corpus, lastCheck: { at: new Date().toISOString(), errors: res.filter(x => x.level === 'error').length, warnings: res.filter(x => x.level === 'warn').length, user: c.user.name } } })); };
  const lc = c.s.corpus.lastCheck; const custom = new Set(c.s.corpus.custom.map(x => (x as { id: string }).id));
  return (<><Why>{t('corpusIntro')}</Why>
    <section className="card"><div className="row between"><div className="row"><b>{t('entriesN', { n: entries.length })}</b><Chip u={entries.some(isDue) ? 'soon' : 'ok'}>{entries.filter(isDue).length} {t('reviewDueChip')}</Chip></div>
        <div className="row"><label className="small">{t('reviewEvery')} <input type="number" min={7} max={365} style={{ width: 70 }} value={days} onChange={e => c.setS(s => ({ ...s, corpus: { ...s.corpus, reviewEveryDays: Math.max(7, Math.min(365, Number(e.target.value) || 30)) } }))} /></label>
          <button className="btn ghost" onClick={run}>{t('runCheck')}</button><button className="btn" onClick={() => c.modal(<EntryForm c={c} onSave={upsert} />)}>+ {t('addEntry')}</button></div></div>
      <p className="muted small">{lc ? `${t('lastCheckLbl', { date: new Date(lc.at).toLocaleString(INTL_LOCALE[c.lang]), user: lc.user })}: ${t('checkResult', { e: lc.errors, w: lc.warnings })}` : t('noCheck')}. {t('fullCheckNote')}</p>
      {issues && (issues.length ? <div className="warnbox"><ul>{issues.slice(0, 40).map((x, i) => <li key={i} className={x.level === 'error' ? 'bad small' : 'warn small'}>{x.id}: {x.text}</li>)}</ul></div> : <div className="okbox">✓ {t('checkResult', { e: 0, w: 0 })}</div>)}
      <div className="scroll"><table className="tbl small"><thead><tr><th>{t('topic')}</th><th>{t('askTitle')}</th><th>{t('sourceText')}</th><th>{t('effectiveDate')}</th><th>{t('lastReviewed')}</th><th></th></tr></thead>
        <tbody>{entries.map(e => <tr key={e.id}><td>{t('cat_' + e.category)}</td><td>{e.q[c.lang]}{custom.has(e.id) && <> <Chip u="info">{t('customChip')}</Chip></>}</td><td>{e.sourceUrl ? <a href={e.sourceUrl} target="_blank" rel="noreferrer">{e.source}</a> : e.source}</td><td>{e.effective}</td>
          <td>{e.verified} <Chip u={isDue(e) ? 'soon' : 'ok'}>{isDue(e) ? t('reviewDueChip') : t('currentChip')}</Chip></td>
          <td><button className="btn small ghost" onClick={() => c.modal(<EntryForm c={c} e={e} onSave={upsert} />)}>{t('edit')}</button> <button className="btn small ghost" onClick={() => upsert({ ...e, verified: iso(today()) })}>{t('markReviewedC')}</button>
            <button className="btn small ghost" onClick={() => c.setS(s => ({ ...s, corpus: { ...s.corpus, removed: [...s.corpus.removed, e.id] } }))}>{t('removeEntry')}</button></td></tr>)}</tbody></table></div></section></>);
}
function EntryForm({ c, e, onSave, prefill }: { c: Ctx; e?: Entry; onSave: (e: Entry) => void; prefill?: Partial<Entry> }) {
  const { t } = c; const blank = (): Record<Lang, string> => ({ en: '', tl: '', zh: '' });
  const [f, setF] = useState<Entry>(e ?? { id: `custom-${Date.now().toString(36)}`, category: 'deadlines', audience: ['accountant', 'owner'], kw: [], source: '', sourceUrl: '', effective: iso(today()), verified: iso(today()), status: 'Needs CPA review before production use', q: blank(), a: blank(), ...prefill } as Entry);
  const [kw, setKw] = useState(f.kw.map(([k]) => k).join(', '));
  const ok = (['en', 'tl', 'zh'] as Lang[]).every(l => f.q[l].trim() && f.a[l].trim()) && f.source.trim() && (!f.sourceUrl || /^https:\/\//.test(f.sourceUrl));
  const save = () => { if (!ok) return; onSave({ ...f, verified: iso(today()), kw: kw.split(',').map(x => x.trim().toLowerCase()).filter(Boolean).map(k => [k, k.length > 5 ? 3 : 2] as [string, number]) }); c.log('act_corpus', { name: f.q.en.slice(0, 50) }); c.modal(null); c.toast(t('entrySaved')); };
  return (<div><h2>{e ? t('editEntry') : t('addEntry')}</h2><div className="form">
    <label>{t('topic')}<select value={f.category} onChange={x => setF({ ...f, category: x.target.value })}>{CATEGORIES.map(k => <option key={k} value={k}>{t('cat_' + k)}</option>)}</select></label>
    <label>{t('sourceText')}<input value={f.source} onChange={x => setF({ ...f, source: x.target.value.slice(0, 200) })} /></label>
    <label>{t('sourceUrl')}<input value={f.sourceUrl} placeholder="https://" onChange={x => setF({ ...f, sourceUrl: x.target.value.trim().slice(0, 300) })} />{f.sourceUrl && !/^https:\/\//.test(f.sourceUrl) && <small className="bad">{t('urlBad')}</small>}</label>
    <label>{t('effectiveDate')}<input type="date" value={f.effective} onChange={x => setF({ ...f, effective: x.target.value })} /></label>
    <label>{t('keywords')}<input value={kw} onChange={x => setKw(x.target.value.slice(0, 300))} /></label></div>
    {(['en', 'tl', 'zh'] as Lang[]).map(l => <div key={l} className="form one"><label>{t('questionIn', { lang: LANG_NAMES[l] })}<input value={f.q[l]} onChange={x => setF({ ...f, q: { ...f.q, [l]: x.target.value.slice(0, 200) } })} /></label>
      <label>{t('answerIn', { lang: LANG_NAMES[l] })}<textarea rows={3} value={f.a[l]} onChange={x => setF({ ...f, a: { ...f.a, [l]: x.target.value.slice(0, 1200) } })} /></label></div>)}
    <DocsPanel c={c} owner={`corpus:${f.id}`} title={t('sourceFiles')} kind="Registration document" compact />
    {!ok && <p className="warn small">{t('allLangsNeeded')}</p>}
    <div className="row end"><button className="btn ghost" onClick={() => c.modal(null)}>{t('cancel')}</button><button className="btn" disabled={!ok} onClick={save}>{t('save')}</button></div></div>);
}
function WatchAdmin({ c }: { c: Ctx }) {
  const { t } = c; const w = c.s.watch;
  const upd = (p: Partial<typeof w>) => c.setS(s => ({ ...s, watch: { ...s.watch, ...p } }));
  const [src, setSrc] = useState<WatchSource>({ id: '', agency: '', name: '', url: 'https://', watches: '', every: 'weekly' });
  const record = () => c.modal(<RecordChange c={c} onSave={(it) => upd({ queue: [it, ...w.queue], sources: w.sources.map(x => x.id === it.sourceId ? { ...x, lastChecked: it.detectedAt, lastChange: it.detectedAt } : x) })} />);
  const setItem = (id: string, p: Partial<ReviewItem>) => upd({ queue: w.queue.map(x => x.id === id ? { ...x, ...p, by: c.user.id } : x) });
  const accept = (it: ReviewItem) => { const s0 = w.sources.find(x => x.id === it.sourceId);
    c.modal(<EntryForm c={c} prefill={{ source: s0?.name ?? '', sourceUrl: s0?.url ?? '' }} onSave={e => { c.setS(s => ({ ...s, corpus: { ...s.corpus, custom: [...s.corpus.custom, { ...e, product: 'talaan', namespace: 'talaan-ph-payroll' } as unknown as Record<string, unknown>] }, watch: { ...s.watch, queue: s.watch.queue.map(x => x.id === it.id ? { ...x, status: 'accepted', entryId: e.id, by: c.user.id } : x) } })); }} />); };
  return (<><Why>{t('watchIntro')}</Why><p className="warnbox small">{t('serverNote')}</p>
    <section className="card"><div className="row between"><h2>{t('queueTitle')}</h2><button className="btn" onClick={record}>+ {t('recordChange')}</button></div>
      {!w.queue.length ? <p className="muted">{t('noQueue')}</p> : <table className="tbl"><tbody>{w.queue.map(it => { const s0 = w.sources.find(x => x.id === it.sourceId); return (<tr key={it.id}>
        <td><b>{s0?.name ?? it.sourceId}</b><div className="muted small">{it.detectedAt}</div></td><td>{it.summary}</td>
        <td><Chip u={it.status === 'open' ? 'soon' : it.status === 'accepted' ? 'ok' : 'info'}>{t('st_' + it.status)}</Chip></td>
        <td>{it.status === 'open' && <><button className="btn small" onClick={() => accept(it)}>{t('acceptChange')}</button> <button className="btn small ghost" onClick={() => setItem(it.id, { status: 'dismissed' })}>{t('dismiss')}</button></>}</td></tr>); })}</tbody></table>}</section>
    <section className="card"><h2>{t('tabWatch')}</h2><div className="scroll"><table className="tbl small"><thead><tr><th>{t('colAgency')}</th><th>{t('watches')}</th><th>{t('every')}</th><th>{t('lastCheckedLbl')}</th><th></th></tr></thead>
      <tbody>{w.sources.map(x => <tr key={x.id}><td><b>{x.agency}</b><div>{x.name}</div><a className="small" href={x.url} target="_blank" rel="noreferrer">{x.url}</a></td><td>{x.watches}</td>
        <td><select value={x.every} onChange={e => upd({ sources: w.sources.map(y => y.id === x.id ? { ...y, every: e.target.value as WatchSource['every'] } : y) })}>{(['daily', 'weekly', 'monthly'] as const).map(v => <option key={v} value={v}>{t('ev_' + v)}</option>)}</select></td>
        <td>{x.lastChecked ?? '—'}</td><td><button className="btn small ghost" onClick={() => upd({ sources: w.sources.filter(y => y.id !== x.id) })}>{t('removeItem')}</button></td></tr>)}</tbody></table></div>
      <h3>{t('addSource')}</h3><div className="form">
        <label>{t('colAgency')}<input value={src.agency} onChange={e => setSrc({ ...src, agency: e.target.value.slice(0, 30) })} /></label>
        <label>{t('nameLbl')}<input value={src.name} onChange={e => setSrc({ ...src, name: e.target.value.slice(0, 80) })} /></label>
        <label>{t('sourceUrl')}<input value={src.url} onChange={e => setSrc({ ...src, url: e.target.value.trim().slice(0, 300) })} />{!/^https:\/\/[^\s]+\.[^\s]+/.test(src.url) && <small className="bad">{t('urlBad')}</small>}</label>
        <label>{t('watches')}<input value={src.watches} onChange={e => setSrc({ ...src, watches: e.target.value.slice(0, 160) })} /></label>
        <label>{t('every')}<select value={src.every} onChange={e => setSrc({ ...src, every: e.target.value as WatchSource['every'] })}>{(['daily', 'weekly', 'monthly'] as const).map(v => <option key={v} value={v}>{t('ev_' + v)}</option>)}</select></label></div>
      <div className="row end"><button className="btn" disabled={!src.agency.trim() || !src.name.trim() || !/^https:\/\/[^\s]+\.[^\s]+/.test(src.url)} onClick={() => { upd({ sources: [...w.sources, { ...src, id: `src_${Date.now().toString(36)}` }] }); setSrc({ id: '', agency: '', name: '', url: 'https://', watches: '', every: 'weekly' }); }}>+ {t('addSource')}</button></div></section></>);
}
function RecordChange({ c, onSave }: { c: Ctx; onSave: (it: ReviewItem) => void }) {
  const { t } = c; const [sourceId, setSourceId] = useState(c.s.watch.sources[0]?.id ?? ''); const [summary, setSummary] = useState('');
  return (<div><h2>{t('recordChange')}</h2><div className="form one">
    <label>{t('tabWatch')}<select value={sourceId} onChange={e => setSourceId(e.target.value)}>{c.s.watch.sources.map(x => <option key={x.id} value={x.id}>{x.agency}: {x.name}</option>)}</select></label>
    <label>{t('summaryLbl')}<textarea rows={3} value={summary} onChange={e => setSummary(e.target.value.slice(0, 500))} /></label></div>
    <div className="row end"><button className="btn ghost" onClick={() => c.modal(null)}>{t('cancel')}</button><button className="btn" disabled={!sourceId || summary.trim().length < 5} onClick={() => { onSave({ id: `q_${Date.now().toString(36)}`, sourceId, detectedAt: iso(today()), summary: summary.trim(), status: 'open', by: c.user.id }); c.modal(null); }}>{t('save')}</button></div></div>);
}

/* ---------------- Searchable multi-select dropdown ---------------- */
function MultiSelect({ c, label, options, value, onChange }: { c: Ctx; label: string; options: [string, string][]; value: Set<string>; onChange: (v: Set<string>) => void }) {
  const { t } = c; const [open, setOpen] = useState(false); const [q, setQ] = useState('');
  const ref = useRefDiv();
  useEffect(() => { if (!open) return; const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc); return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); }; }, [open]);
  const ql = q.trim().toLowerCase(); const shown = options.filter(([, l]) => !ql || l.toLowerCase().includes(ql));
  const toggle = (k: string) => { const n = new Set(value); if (n.has(k)) n.delete(k); else n.add(k); onChange(n); };
  const summary = !value.size ? t('allOpt') : value.size === 1 ? options.find(([k]) => value.has(k))?.[1] ?? '' : t('nSelected', { n: value.size });
  return (<div className="ms" ref={ref}><button type="button" className={`ms-btn ${value.size ? 'on' : ''}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
      <span className="ms-label">{label}:</span> <span className="ms-val">{summary}</span> <span aria-hidden="true">▾</span></button>
    {open && <div className="ms-pop" role="listbox" aria-multiselectable="true" aria-label={label}>
      <input autoFocus type="search" placeholder={t('searchOpt')} aria-label={t('searchOpt')} value={q} onChange={e => setQ(e.target.value)} />
      <div className="row between ms-actions"><button type="button" className="link" onClick={() => { const n = new Set(value); shown.forEach(([k]) => n.add(k)); onChange(n); }}>{t('selectAll')}</button>
        <button type="button" className="link" onClick={() => onChange(new Set())}>{t('clearOpt')}</button></div>
      <ul>{shown.map(([k, l]) => <li key={k}><label className="check"><input type="checkbox" checked={value.has(k)} onChange={() => toggle(k)} /> {l}</label></li>)}
        {!shown.length && <li className="muted small">{t('noOptions')}</li>}</ul></div>}</div>);
}
function useRefDiv() { return useRefHook<HTMLDivElement>(null); }

/* ---------------- Notifications bell ---------------- */
function noticeText(c: Ctx, n: Notice) {
  const v = { ...n.vars } as Record<string, string | number>; if (typeof v.period === 'string' && /^\d{4}-\d{2}-[ABM]$/.test(v.period)) v.period = c.periodLabel(v.period);
  if (typeof v.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.date)) v.date = c.fmt(new Date(v.date + 'T00:00'));
  return c.t(n.key, v);
}
function Bell({ c }: { c: Ctx }) {
  const { t } = c; const [open, setOpen] = useState(false); const ref = useRefDiv();
  const mine = c.s.notices.filter(n => n.to === c.user.id); const unread = mine.filter(n => !n.read).length;
  useEffect(() => { if (!open) return; const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close); }, [open]);
  const read = (ids: string[]) => c.setS(s => ({ ...s, notices: s.notices.map(n => ids.includes(n.id) ? { ...n, read: true } : n) }));
  return (<div className="bellwrap" ref={ref}><button className="bell" aria-label={`${t('notifications')} (${unread})`} aria-expanded={open} onClick={() => setOpen(!open)}>🔔{unread > 0 && <span className="badge">{unread}</span>}</button>
    {open && <div className="bellpop" role="dialog" aria-label={t('notifications')}><div className="row between"><b>{t('notifications')}</b>{unread > 0 && <button className="link" onClick={() => read(mine.map(n => n.id))}>{t('markAllRead')}</button>}</div>
      {!mine.length ? <p className="muted small">{t('noNotices')}</p> : <ul>{mine.slice(0, 30).map(n => <li key={n.id} className={n.read ? '' : 'unread'}><button onClick={() => { read([n.id]); setOpen(false); c.go(n.route as Route); }}>
        <span>{noticeText(c, n)}</span><span className="muted small">{new Date(n.at).toLocaleString(INTL_LOCALE[c.lang], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></button></li>)}</ul>}</div>}</div>);
}

/* ---------------- Approval workflow ---------------- */
function approversFor(c: Ctx, run: Run) {
  return USERS.filter(u => u.active !== false && u.id !== run.preparedBy && (u.role === 'firmOwner' || (u.role === 'client' && u.clientId === run.clientId)));
}
function submitRun(c: Ctx, run: Run) {
  const cl = c.s.clients.find(x => x.id === run.clientId)!; const to = approversFor(c, run); const lines = linesFor(c.s, run); const tot = totals(lines);
  c.setS(s => ({ ...s, runs: s.runs.map(r => r.id === run.id ? { ...r, submitted: { at: new Date().toISOString(), by: c.user.id, to: to.map(u => u.id) }, returned: undefined } : r) }));
  c.notify(to.map(u => u.id), 'n_submitted', { name: c.user.name, client: cl.name, period: run.period }, { page: 'run', id: run.id, step: 4 });
  to.forEach(u => u.email && c.email([u.email], c.t('em_approval_subj', { client: cl.name, period: c.periodLabel(run.period) }),
    c.t('em_approval_body', { name: u.name, preparer: c.user.name, client: cl.name, period: c.periodLabel(run.period), n: lines.length, net: peso(tot.net), date: c.fmt(periodInfo(run.period).payDate) }), 'approval', cl.id));
  c.log('act_submitted', { period: run.period }, run.clientId);
}
function afterApproval(c: Ctx, run: Run, lines: Line[]) {
  const cl = c.s.clients.find(x => x.id === run.clientId)!; const tot = totals(lines); const govt = r2(tot.sssEE + tot.sssER + tot.ec + tot.phEE + tot.phER + tot.piEE + tot.piER);
  c.notify([run.preparedBy].filter(u => u !== c.user.id), 'n_approved', { name: c.user.name, client: cl.name, period: run.period }, { page: 'run', id: run.id, step: 5 });
  if (cl.notify?.approved !== false) (cl.contacts ?? []).forEach(ct => c.email([ct.email], c.t('em_approved_subj', { client: cl.name, period: c.periodLabel(run.period) }),
    c.t('em_approved_body', { name: ct.name, period: c.periodLabel(run.period), n: lines.length, net: peso(tot.net), govt: peso(govt), wht: peso(tot.wht), date: c.fmt(periodInfo(run.period).payDate), firm: c.s.billing.firmName }), 'approved', cl.id));
  c.setS(s => ({ ...s, runs: s.runs.map(r => r.id === run.id ? { ...r, submitted: undefined } : r) }));
}
function Workflow({ c, run, ready, lines }: { c: Ctx; run: Run; ready: boolean; lines: Line[] }) {
  const { t } = c; if (run.status === 'approved') return null;
  const approvers = approversFor(c, run); const names = (ids: string[]) => ids.map(id => USERS.find(u => u.id === id)?.name ?? id).join(', ');
  const isStaff = c.user.role === 'firmOwner' || c.user.role === 'preparer';
  const withdraw = () => { c.setS(s => ({ ...s, runs: s.runs.map(r => r.id === run.id ? { ...r, submitted: undefined } : r) }));
    const cl = c.s.clients.find(x => x.id === run.clientId)!; c.notify(run.submitted?.to ?? [], 'n_withdrawn', { name: c.user.name, client: cl.name, period: run.period }, { page: 'run', id: run.id }); };
  void lines;
  return (<div className="workflow">
    <ol className="wf"><li className="done">{t('step3')}</li><li className={run.submitted ? 'done' : 'cur'}>{t('submitForApproval')}</li><li className={run.submitted ? 'cur' : ''}>{t('step4')}</li></ol>
    {run.returned && !run.submitted && <div className="warnbox small">↩ {t('returnedMsg', { name: USERS.find(u => u.id === run.returned!.by)?.name ?? '', reason: run.returned.reason })}</div>}
    {run.submitted ? <p className="small">⏳ {t('submittedTo', { date: new Date(run.submitted.at).toLocaleString(INTL_LOCALE[c.lang], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }), names: names(run.submitted.to) })}
        {isStaff && c.user.id === run.submitted.by && <> <button className="link" onClick={withdraw}>{t('withdraw')}</button></>}</p>
      : isStaff && <div className="row"><button className="btn" disabled={!ready || !approvers.length} onClick={() => { submitRun(c, run); c.toast(t('submittedN', { n: 1 })); }}>{t('submitForApproval')}</button>
        <span className="muted small">{approvers.length ? `${t('approvers')}: ${approvers.map(u => u.name).join(', ')}` : t('noApprover')}</span></div>}
  </div>);
}
function ReturnForm({ c, run }: { c: Ctx; run: Run }) {
  const { t } = c; const [reason, setReason] = useState(''); const cl = c.s.clients.find(x => x.id === run.clientId)!;
  const go = () => { const prep = USERS.find(u => u.id === run.preparedBy);
    c.setS(s => ({ ...s, runs: s.runs.map(r => r.id === run.id ? { ...r, submitted: undefined, returned: { at: new Date().toISOString(), by: c.user.id, reason: reason.trim() } } : r) }));
    c.notify([run.preparedBy], 'n_returned', { name: c.user.name, client: cl.name, period: run.period, reason: reason.trim() }, { page: 'run', id: run.id, step: 3 });
    if (prep?.email) c.email([prep.email], t('em_returned_subj', { client: cl.name, period: c.periodLabel(run.period) }), t('em_returned_body', { name: prep.name, approver: c.user.name, client: cl.name, period: c.periodLabel(run.period), reason: reason.trim() }), 'returned', cl.id);
    c.log('act_returned', { period: run.period }, run.clientId); c.modal(null); c.toast(t('saved')); };
  return (<div><h2>{t('returnRun')}</h2><p className="muted">{cl.name}, {c.periodLabel(run.period)}</p><div className="form one"><label>{t('returnReason')}<textarea rows={3} autoFocus value={reason} onChange={e => setReason(e.target.value.slice(0, 500))} /></label></div>
    <div className="row end"><button className="btn ghost" onClick={() => c.modal(null)}>{t('cancel')}</button><button className="btn red" disabled={reason.trim().length < 5} onClick={go}>{t('returnRun')}</button></div></div>);
}
function ApprovalsWaiting({ c }: { c: Ctx }) {
  const { t } = c;
  const mine = c.s.runs.filter(r => r.status === 'draft' && r.submitted && (r.submitted.to.includes(c.user.id) || c.user.role === 'firmOwner'));
  if (!mine.length) return null;
  return (<section className="card approvals"><h2>⏳ {t('ps_waiting')} ({mine.length})</h2><ul className="tasks">{mine.map(r => { const cl = c.s.clients.find(x => x.id === r.clientId)!; const pay = periodInfo(r.period).payDate;
    const hours = Math.round((Date.now() - new Date(r.submitted!.at).getTime()) / 3600e3); const urgent = daysBetween(today(), pay) <= 1 || hours >= 24;
    return <li key={r.id}><Chip u={urgent ? 'late' : 'soon'}>{dueText(c, pay)}</Chip><span className="grow"><b>{cl.name}</b>, {c.periodLabel(r.period)}<div className="muted small">{t('waitingSince', { date: new Date(r.submitted!.at).toLocaleString(INTL_LOCALE[c.lang], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) })} · {USERS.find(u => u.id === r.submitted!.by)?.name}</div></span>
      <button className="btn small green" onClick={() => c.go({ page: 'run', id: r.id, step: 4 })}>{t('open')}</button></li>; })}</ul></section>);
}

/* ---------------- Client contacts and notifications ---------------- */
function ContactsCard({ c, cl, canEdit, onChange }: { c: Ctx; cl: Client; canEdit: boolean; onChange: (p: Partial<Client>) => void }) {
  const { t } = c; const contacts = cl.contacts ?? []; const n = cl.notify ?? { approved: true, remitted: true, invoice: true };
  const set = (i: number, p: Partial<Contact>) => onChange({ contacts: contacts.map((x, j) => j === i ? { ...x, ...p } : x) });
  const bad = (e: string) => !!e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  return (<section className="card"><h2>✉️ {t('notifTitle')}</h2>
    <table className="tbl small"><thead><tr><th>{t('contactName')}</th><th>{t('contactEmail')}</th><th>{t('billingContact')}</th><th></th></tr></thead><tbody>{contacts.map((x, i) => <tr key={i}>
      <td><input disabled={!canEdit} value={x.name} onChange={e => set(i, { name: e.target.value.slice(0, 80) })} /></td>
      <td><input disabled={!canEdit} type="email" value={x.email} onChange={e => set(i, { email: e.target.value.trim().slice(0, 120) })} />{bad(x.email) && <div className="bad small">{t('emailBad')}</div>}</td>
      <td><input type="checkbox" disabled={!canEdit} checked={!!x.billing} onChange={e => set(i, { billing: e.target.checked })} /></td>
      <td>{canEdit && <button className="btn small ghost" onClick={() => onChange({ contacts: contacts.filter((_, j) => j !== i) })}>{t('removeItem')}</button>}</td></tr>)}</tbody></table>
    {canEdit && <button className="btn small ghost" onClick={() => onChange({ contacts: [...contacts, { name: '', email: '', billing: false }] })}>+ {t('addContact')}</button>}
    <div className="form" style={{ marginTop: 10 }}>{(['approved', 'remitted', 'invoice'] as const).map(k => <label key={k} className="check"><input type="checkbox" disabled={!canEdit} checked={n[k]} onChange={e => onChange({ notify: { ...n, [k]: e.target.checked } })} /> {t(k === 'approved' ? 'notifyApproved' : k === 'remitted' ? 'notifyRemitted' : 'notifyInvoice')}</label>)}</div></section>);
}

/* ---------------- Email outbox ---------------- */
function Outbox({ c }: { c: Ctx }) {
  const { t } = c; const [open, setOpen] = useState<string | null>(null); const clients = visibleClients(c);
  const mails = c.s.outbox.filter(m => !m.clientId || clients.some(x => x.id === m.clientId));
  return (<><Why>{t('emailIntro')}</Why><section className="card">{!mails.length ? <p className="muted">{t('noEmails')}</p> : mails.map(m => (
    <div key={m.id} className={`faq ${open === m.id ? 'open' : ''}`}><button aria-expanded={open === m.id} onClick={() => setOpen(open === m.id ? null : m.id)}>
      <span><b>{m.subject}</b><div className="muted small">{t('toLbl')}: {m.to.join(', ')} · {new Date(m.at).toLocaleString(INTL_LOCALE[c.lang], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div></span>
      <span className="row"><Chip u={m.status === 'sent' ? 'ok' : m.status === 'failed' ? 'late' : 'soon'}>{m.status === 'sent' ? t('sentLbl') : m.status === 'failed' ? t('failedLbl') : t('queuedDemo')}</Chip><span className="chev">{open === m.id ? '−' : '+'}</span></span></button>
      {open === m.id && <div className="answer"><pre className="mailbody">{m.body}</pre>
        <a className="btn small" href={`mailto:${encodeURIComponent(m.to.join(','))}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`}>{t('openInMail')}</a></div>}</div>))}</section></>);
}

/* ---------------- Billing ---------------- */
const RATE_KEYS: (keyof Rates)[] = ['perRun', 'perPayslip', 'perFiling', 'perNewHire', 'per2316'];
function ratesFor(c: Ctx, cl: Client): Rates { const d = c.s.billing.rates; const o = cl.rates ?? {}; return Object.fromEntries(RATE_KEYS.map(k => [k, o[k] ?? d[k]])) as unknown as Rates; }
function billable(c: Ctx, cl: Client, month: string) {
  const items: { date: string; item: string }[] = [];
  const runs = c.s.runs.filter(r => r.clientId === cl.id && r.status === 'approved' && (r.approvedAt ?? '').startsWith(month));
  runs.forEach(r => items.push({ date: r.approvedAt!, item: `${c.t('l_runs')}: ${c.periodLabel(r.period)} (${r.lines?.length ?? 0})` }));
  const payslips = runs.reduce((a, r) => a + (r.lines?.length ?? 0), 0);
  const filings = filingsFor(c.s).filter(f => f.clientId === cl.id && f.remit?.paidAt?.startsWith(month) && f.remit.amountPaid !== undefined);
  filings.forEach(f => items.push({ date: f.remit!.paidAt!, item: `${AGENCY_FORMS[f.kind]}, ${c.monthLabel(f.month)} (${f.remit!.reference ?? ''})` }));
  const hires = c.s.employees.filter(e => e.clientId === cl.id && (e.hireDate ?? '').startsWith(month));
  hires.forEach(e => items.push({ date: e.hireDate!, item: `${c.t('l_newhires')}: ${e.name}` }));
  const certs = c.s.activity.filter(a => a.action === 'act_exported' && a.at.startsWith(month) && String(a.detail?.file ?? '').startsWith(`${cl.id}_`) && String(a.detail?.file).includes('_2316_'));
  certs.forEach(a => items.push({ date: a.at.slice(0, 10), item: `${c.t('l_2316')}: ${String(a.detail?.file)}` }));
  const r = ratesFor(c, cl);
  const lines: InvoiceLine[] = ([['l_runs', runs.length, r.perRun], ['l_payslips', payslips, r.perPayslip], ['l_filings', filings.length, r.perFiling], ['l_newhires', hires.length, r.perNewHire], ['l_2316', certs.length, r.per2316]] as [string, number, number][])
    .filter(([, q]) => q > 0).map(([k, q, rate]) => ({ label: c.t(k), qty: q, rate, amount: r2(q * rate) }));
  const subtotal = r2(lines.reduce((a, l) => a + l.amount, 0)); const vat = c.s.billing.vatRegistered ? r2(subtotal * 0.12) : 0;
  return { lines, items: items.sort((a, b) => a.date.localeCompare(b.date)), subtotal, vat, total: r2(subtotal + vat), counts: { runs: runs.length, payslips, filings: filings.length, hires: hires.length, certs: certs.length } };
}
function BillingPage({ c, tab }: { c: Ctx; tab?: string }) {
  const { t } = c; const cur = tab ?? 'summary';
  const tabs: [string, string][] = [['summary', 'tabSummary'], ['invoices', 'tabInvoices'], ['rates', 'tabRates']];
  return (<><div className="head"><h1>{t('billing')}</h1></div>
    <div className="pills tabs" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={cur === k} aria-pressed={cur === k} onClick={() => c.go({ page: 'billing', id: k })}>{t(l)}</button>)}</div>
    {cur === 'summary' && <BillingSummary c={c} />}{cur === 'invoices' && <InvoicesList c={c} />}{cur === 'rates' && <RateCard c={c} />}</>);
}
function BillingSummary({ c }: { c: Ctx }) {
  const { t } = c; const clients = visibleClients(c);
  const latest = c.s.runs.filter(r => r.status === 'approved').map(r => (r.approvedAt ?? '').slice(0, 7)).sort().pop() ?? iso(today()).slice(0, 7);
  const [month, setMonth] = useState(latest);
  const rows = clients.map(cl => ({ cl, b: billable(c, cl, month), inv: c.s.billing.invoices.find(i => i.clientId === cl.id && i.month === month) }));
  const sum = (f: (x: typeof rows[number]) => number) => rows.reduce((a, x) => a + f(x), 0);
  const exportCsv = () => saveFile(c, `talaan_billing_${month}.csv`, '\uFEFF' + [['Client', 'Pay runs', 'Payslips', 'Filings', 'New hires', '2316', 'Subtotal', 'VAT', 'Total', 'Invoice'],
    ...rows.map(({ cl, b, inv }) => [cl.name, b.counts.runs, b.counts.payslips, b.counts.filings, b.counts.hires, b.counts.certs, b.subtotal.toFixed(2), b.vat.toFixed(2), b.total.toFixed(2), inv?.no ?? ''])].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n'));
  return (<><Why>{t('billingIntro')}</Why><section className="card">
    <div className="row between"><div className="form" style={{ maxWidth: 260 }}><label>{t('month')}<input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label></div>
      <span className="muted small">{t('billingTip')}</span><button className="btn small ghost" onClick={exportCsv}>{t('exportSummary')}</button></div>
    <div className="scroll"><table className="tbl"><thead><tr><th>{t('colClient')}</th><th className="num">{t('l_runs')}</th><th className="num">{t('l_payslips')}</th><th className="num">{t('l_filings')}</th><th className="num">{t('l_newhires')}</th><th className="num">2316</th><th className="num">{t('totalDue')}</th><th>{t('invoiceStatus')}</th><th></th></tr></thead>
      <tbody>{rows.map(({ cl, b, inv }) => <tr key={cl.id}><td><b>{cl.name}</b></td><td className="num">{b.counts.runs}</td><td className="num">{b.counts.payslips}</td><td className="num">{b.counts.filings}</td><td className="num">{b.counts.hires}</td><td className="num">{b.counts.certs}</td>
        <td className="num"><b>{peso(b.total)}</b></td><td>{inv ? <Chip u={inv.status === 'paid' ? 'ok' : 'info'}>{inv.no}</Chip> : <Chip u={b.total ? 'soon' : 'info'}>{t('notInvoiced')}</Chip>}</td>
        <td className="nowrap"><button className="btn small ghost" disabled={!b.items.length} onClick={() => c.modal(<div><h2>{cl.name}: {t('viewTx')}</h2><p className="muted">{c.monthLabel(month)}</p><table className="tbl small"><thead><tr><th>{t('txDate')}</th><th>{t('txItem')}</th></tr></thead><tbody>{b.items.map((x, i) => <tr key={i}><td>{x.date.slice(0, 10)}</td><td>{x.item}</td></tr>)}</tbody></table><div className="row end"><button className="btn" onClick={() => c.modal(null)}>{t('close')}</button></div></div>)}>{t('viewTx')}</button>
          {!inv && <button className="btn small" disabled={!b.total} onClick={() => c.modal(<CreateInvoice c={c} cl={cl} month={month} />)}>{t('createInvoice')}</button>}</td></tr>)}
        <tr className="totalrow"><td>{t('totalsRow')}</td><td className="num">{sum(x => x.b.counts.runs)}</td><td className="num">{sum(x => x.b.counts.payslips)}</td><td className="num">{sum(x => x.b.counts.filings)}</td><td className="num">{sum(x => x.b.counts.hires)}</td><td className="num">{sum(x => x.b.counts.certs)}</td><td className="num">{peso(r2(sum(x => x.b.total)))}</td><td></td><td></td></tr></tbody></table></div></section></>);
}
function CreateInvoice({ c, cl, month }: { c: Ctx; cl: Client; month: string }) {
  const { t } = c; const b = billable(c, cl, month); const B = c.s.billing;
  const no = `SOA-${month.replace('-', '')}-${String(B.nextNo).padStart(4, '0')}`;
  const due = new Date(today().getTime() + B.termsDays * 864e5);
  const create = () => {
    const inv: Invoice = { no, clientId: cl.id, month, lines: b.lines, subtotal: b.subtotal, vat: b.vat, total: b.total, issuedAt: iso(today()), dueAt: iso(due), status: 'issued', by: c.user.id };
    c.setS(s => ({ ...s, billing: { ...s.billing, invoices: [inv, ...s.billing.invoices], nextNo: s.billing.nextNo + 1 } }));
    c.log('act_invoice', { no }, cl.id); c.notify(c.s.users.filter(u => u.role === 'firmOwner' && u.id !== c.user.id).map(u => u.id), 'n_invoice', { no, client: cl.name }, { page: 'billing', id: 'invoices' });
    if (cl.notify?.invoice !== false) emailInvoice(c, inv); c.modal(null); c.toast(t('invoiceCreated', { no })); };
  return (<div><h2>{t('createInvoice')}: {cl.name}</h2><p className="muted">{c.monthLabel(month)} · {t('invNo')} {no} · {t('dueOn')} {c.fmt(due)}</p>
    <InvoiceTable c={c} lines={b.lines} subtotal={b.subtotal} vat={b.vat} total={b.total} /><p className="warnbox small">{t('soaNote')}</p>
    <div className="row end"><button className="btn ghost" onClick={() => c.modal(null)}>{t('cancel')}</button><button className="btn" onClick={create}>{t('createInvoice')}</button></div></div>);
}
function InvoiceTable({ c, lines, subtotal, vat, total }: { c: Ctx; lines: InvoiceLine[]; subtotal: number; vat: number; total: number }) {
  const { t } = c;
  return <table className="tbl"><thead><tr><th>{t('txItem')}</th><th className="num">{t('qtyLbl')}</th><th className="num">{t('rateLbl')}</th><th className="num">{t('amountLbl')}</th></tr></thead>
    <tbody>{lines.map(l => <tr key={l.label}><td>{l.label}</td><td className="num">{l.qty}</td><td className="num">{peso(l.rate)}</td><td className="num">{peso(l.amount)}</td></tr>)}
      <tr><td colSpan={3}>{t('subtotal')}</td><td className="num">{peso(subtotal)}</td></tr>{vat > 0 && <tr><td colSpan={3}>{t('vatLbl')}</td><td className="num">{peso(vat)}</td></tr>}
      <tr className="totalrow"><td colSpan={3}>{t('totalDue')}</td><td className="num">{peso(total)}</td></tr></tbody></table>;
}
function emailInvoice(c: Ctx, inv: Invoice) {
  const cl = c.s.clients.find(x => x.id === inv.clientId)!; const to = (cl.contacts ?? []).filter(x => x.billing && x.email);
  if (!to.length) { c.toast(c.t('noContacts')); return; }
  to.forEach(ct => c.email([ct.email], c.t('em_invoice_subj', { no: inv.no, firm: c.s.billing.firmName }),
    c.t('em_invoice_body', { name: ct.name, no: inv.no, month: c.monthLabel(inv.month), total: peso(inv.total), due: c.fmt(new Date(inv.dueAt + 'T00:00')), firm: c.s.billing.firmName }) + '\n\n' + inv.lines.map(l => `${l.label}: ${l.qty} × ${peso(l.rate)} = ${peso(l.amount)}`).join('\n'), 'invoice', cl.id));
  c.toast(c.t('emailQueued', { to: to.map(x => x.email).join(', ') }));
}
function invoicePdf(c: Ctx, inv: Invoice) {
  const cl = c.s.clients.find(x => x.id === inv.clientId)!; const B = c.s.billing; const doc = new jsPDF({ unit: 'pt', format: 'a4' }); const W = doc.internal.pageSize.getWidth(); let y = 56;
  const P = (n: number) => 'PHP ' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text(B.firmName, 40, y); doc.setFontSize(12); doc.text('STATEMENT OF ACCOUNT', W - 40, y, { align: 'right' }); y += 22;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  [['No.', inv.no], ['Issued', inv.issuedAt], ['Due', inv.dueAt], ['Period', inv.month]].forEach(([k, v]) => { doc.text(`${k}: ${v}`, W - 40, y, { align: 'right' }); y += 14; });
  y += 6; doc.setFont('helvetica', 'bold'); doc.text('Bill to', 40, y); y += 14; doc.setFont('helvetica', 'normal'); doc.text(cl.name, 40, y); y += 13;
  if (cl.ids?.address) { doc.text(cl.ids.address, 40, y); y += 13; } if (cl.ids?.tin) { doc.text(`TIN ${cl.ids.tin}`, 40, y); y += 13; } y += 12;
  doc.setDrawColor(190); doc.line(40, y, W - 40, y); y += 16; doc.setFont('helvetica', 'bold');
  doc.text('Service', 40, y); doc.text('Qty', 330, y, { align: 'right' }); doc.text('Rate', 430, y, { align: 'right' }); doc.text('Amount', W - 40, y, { align: 'right' }); y += 8; doc.line(40, y, W - 40, y); y += 16; doc.setFont('helvetica', 'normal');
  const EN = makeT('en');
  inv.lines.forEach(l => { const label = Object.keys(DICTS.en).find(k => k.startsWith('l_') && [DICTS.en[k], DICTS.tl[k], DICTS.zh[k]].includes(l.label)); doc.text(label ? EN(label) : l.label, 40, y); doc.text(String(l.qty), 330, y, { align: 'right' }); doc.text(P(l.rate), 430, y, { align: 'right' }); doc.text(P(l.amount), W - 40, y, { align: 'right' }); y += 16; });
  y += 4; doc.line(300, y, W - 40, y); y += 16;
  doc.text('Subtotal', 330, y); doc.text(P(inv.subtotal), W - 40, y, { align: 'right' }); y += 15;
  if (inv.vat) { doc.text('VAT (12%)', 330, y); doc.text(P(inv.vat), W - 40, y, { align: 'right' }); y += 15; }
  doc.setFont('helvetica', 'bold'); doc.text('Total due', 330, y); doc.text(P(inv.total), W - 40, y, { align: 'right' }); y += 30;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(120);
  doc.text(doc.splitTextToSize(`${EN('soaNote')} Prepared in Talaan from the transactions processed in ${inv.month}.`, W - 80), 40, y);
  return doc.output('arraybuffer');
}
function InvoicesList({ c }: { c: Ctx }) {
  const { t } = c; const invs = c.s.billing.invoices.filter(i => visibleClients(c).some(x => x.id === i.clientId));
  const statement = (inv: Invoice) => { const cl = c.s.clients.find(x => x.id === inv.clientId)!; const b = billable(c, cl, inv.month);
    saveFile(c, `${inv.no}_statement.csv`, '\uFEFF' + [['Date', 'Item'], ...b.items.map(x => [x.date.slice(0, 10), x.item]), [], ['Line', 'Qty', 'Rate', 'Amount'], ...inv.lines.map(l => [l.label, l.qty, l.rate.toFixed(2), l.amount.toFixed(2)]), ['Total', '', '', inv.total.toFixed(2)]].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n')); };
  const paid = (no: string) => c.setS(s => ({ ...s, billing: { ...s.billing, invoices: s.billing.invoices.map(i => i.no === no ? { ...i, status: 'paid', paidAt: iso(today()) } : i) } }));
  if (!invs.length) return <section className="card"><p className="muted">{t('noInvoices')}</p></section>;
  return (<section className="card"><p className="warnbox small">{t('soaNote')}</p><div className="scroll"><table className="tbl"><thead><tr><th>{t('invNo')}</th><th>{t('colClient')}</th><th>{t('month')}</th><th>{t('issuedOn')}</th><th>{t('dueOn')}</th><th className="num">{t('totalDue')}</th><th>{t('colStatus')}</th><th></th></tr></thead>
    <tbody>{invs.map(i => { const overdue = i.status !== 'paid' && i.dueAt < iso(today()); return <tr key={i.no}><td><b>{i.no}</b></td><td>{c.s.clients.find(x => x.id === i.clientId)?.name}</td><td>{c.monthLabel(i.month)}</td><td>{i.issuedAt}</td><td>{i.dueAt}</td><td className="num">{peso(i.total)}</td>
      <td><Chip u={i.status === 'paid' ? 'ok' : overdue ? 'late' : 'info'}>{i.status === 'paid' ? t('paidChip') : overdue ? t('overdueChip') : t('issuedChip')}</Chip></td>
      <td className="nowrap"><button className="btn small ghost" onClick={() => saveFile(c, `${i.no}.pdf`, invoicePdf(c, i))}>{t('downloadPdf')}</button> <button className="btn small ghost" onClick={() => statement(i)}>{t('statementCsv')}</button> <button className="btn small ghost" onClick={() => emailInvoice(c, i)}>{t('emailInvoice')}</button>
        {i.status !== 'paid' && <> <button className="btn small green" onClick={() => paid(i.no)}>{t('markPaid')}</button></>}</td></tr>; })}</tbody></table></div></section>);
}
function RateCard({ c }: { c: Ctx }) {
  const { t } = c; const B = c.s.billing; const clients = visibleClients(c);
  const setB = (p: Partial<typeof B>) => c.setS(s => ({ ...s, billing: { ...s.billing, ...p } }));
  const num = (v: string) => Math.max(0, r2(Number(v) || 0));
  const setClientRate = (id: string, k: keyof Rates, v: string) => c.setS(s => ({ ...s, clients: s.clients.map(x => { if (x.id !== id) return x; const r = { ...(x.rates ?? {}) }; if (v === '') delete r[k]; else r[k] = num(v); return { ...x, rates: r }; }) }));
  return (<><section className="card"><h2>{t('tabRates')} <Tip text={t('tip_billing')} /></h2><div className="form">
    <label>{t('firmNameLbl')}<input value={B.firmName} onChange={e => setB({ firmName: e.target.value.slice(0, 100) })} /></label>
    <label>{t('termsLbl')}<input type="number" min={0} max={120} value={B.termsDays} onChange={e => setB({ termsDays: Math.max(0, Math.min(120, Number(e.target.value) || 0)) })} /></label>
    <label className="check"><input type="checkbox" checked={B.vatRegistered} onChange={e => setB({ vatRegistered: e.target.checked })} /> {t('vatReg')}</label></div>
    <div className="form">{RATE_KEYS.map(k => <label key={k}>{t(k)}<input type="number" min={0} step="0.01" value={B.rates[k]} onChange={e => setB({ rates: { ...B.rates, [k]: num(e.target.value) } })} /></label>)}</div></section>
    <section className="card"><h2>{t('clientRates')}</h2><div className="scroll"><table className="tbl small"><thead><tr><th>{t('colClient')}</th>{RATE_KEYS.map(k => <th key={k}>{t(k)}</th>)}</tr></thead>
      <tbody>{clients.map(cl => <tr key={cl.id}><td><b>{cl.name}</b></td>{RATE_KEYS.map(k => <td key={k}><input type="number" min={0} step="0.01" placeholder={`${t('useDefault')}: ${B.rates[k]}`} value={cl.rates?.[k] ?? ''} onChange={e => setClientRate(cl.id, k, e.target.value)} /></td>)}</tr>)}</tbody></table></div></section></>);
}
