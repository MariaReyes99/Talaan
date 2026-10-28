/** App shell pieces: global search, the "More" menu, module switches and the client setup checklist. */
import { dependents, missingDependencies } from '../entitlements';
import { useEffect, useRef, useState } from 'react';
import { MODULES, MODULE_PRICE, modulesOf, isRegular, type Client, type ModuleKey } from '../model';
import { Chip, visibleClients, type Ctx, type Route } from '../App';
import MARK from '../../assets/talaan-mark-96.png';

export function MoreMenu({ c, items, active }: { c: Ctx; items: [Route['page'], string][]; active: string }) {
  const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const off = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', off); return () => document.removeEventListener('mousedown', off); }, [open]);
  const on = items.some(([p]) => p === active);
  return (<div className="more" ref={ref}><button className={on ? 'on' : ''} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>{c.t('more')} ▾</button>
    {open && <div className="menu" role="menu">{items.map(([p, k]) => <button key={p} role="menuitem" className={active === p ? 'on' : ''} onClick={() => { setOpen(false); c.go({ page: p }); }}>{c.t(k)}</button>)}</div>}</div>);
}

interface Hit { label: string; sub: string; route: Route }
export function GlobalSearch({ c }: { c: Ctx }) {
  const { t } = c; const [q, setQ] = useState(''); const [open, setOpen] = useState(false); const [i, setI] = useState(0); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ref.current?.querySelector('input')?.focus(); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  const ql = q.trim().toLowerCase(); const clients = visibleClients(c);
  const pages: [Route['page'], string][] = [['payruns', 'navPayroll'], ['hr', 'navHR'], ['files', 'navCompliance'], ['books', 'navBooks'], ['analytics', 'navAnalytics'], ['ask', 'ask'], ['faqs', 'faqs'], ['connections', 'connections'], ['billing', 'billing'], ['plans', 'plans']];
  const hits: Hit[] = !ql ? [] : [
    ...clients.filter(x => x.name.toLowerCase().includes(ql)).map(x => ({ label: x.name, sub: t('srClient'), route: { page: 'client', id: x.id } as Route })),
    ...c.s.employees.filter(e => clients.some(x => x.id === e.clientId) && `${e.name} ${e.position} ${e.tin}`.toLowerCase().includes(ql))
      .map(e => ({ label: e.name, sub: `${t('srEmployee')} · ${e.position} · ${c.s.clients.find(x => x.id === e.clientId)?.name}`, route: { page: 'client', id: e.clientId } as Route })),
    ...c.s.runs.filter(r => clients.some(x => x.id === r.clientId) && `${c.s.clients.find(x => x.id === r.clientId)?.name} ${c.periodLabel(r.period)} ${r.label ?? ''}`.toLowerCase().includes(ql) && (isRegular(r) || r.kind !== 'imported'))
      .slice(0, 8).map(r => ({ label: `${c.s.clients.find(x => x.id === r.clientId)?.name}, ${c.periodLabel(r.period)}`, sub: `${t('srPayRun')}${r.label ? ' · ' + r.label : ''}`, route: { page: 'run', id: r.id } as Route })),
    ...pages.filter(([, k]) => t(k).toLowerCase().includes(ql)).map(([p, k]) => ({ label: t(k), sub: t('srPage'), route: { page: p } as Route })),
  ].slice(0, 12);
  const pick = (h: Hit) => { c.go(h.route); setQ(''); setOpen(false); };
  return (<div className="gsearch" ref={ref}>
    <input type="search" value={q} placeholder={t('searchAll')} aria-label={t('searchAll')} aria-expanded={open && hits.length > 0} role="combobox" aria-controls="gsearch-list"
      onChange={e => { setQ(e.target.value); setOpen(true); setI(0); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
      onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setI(Math.min(hits.length - 1, i + 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setI(Math.max(0, i - 1)); } else if (e.key === 'Enter' && hits[i]) pick(hits[i]); else if (e.key === 'Escape') setOpen(false); }} />
    {open && ql && <ul className="hits" id="gsearch-list" role="listbox">{hits.length ? hits.map((h, k) => <li key={k} role="option" aria-selected={k === i}><button onMouseDown={() => pick(h)}><b>{h.label}</b><span>{h.sub}</span></button></li>)
      : <li className="none">{t('noMatches')}</li>}</ul>}</div>);
}

export function ModulesCard({ c, cl, canEdit, onChange }: { c: Ctx; cl: Client; canEdit: boolean; onChange: (p: Partial<Client>) => void }) {
  const { t } = c; const mods = modulesOf(cl); const ext = cl.payrollSource === 'external';
  const toggle = (m: ModuleKey) => {
    if (mods.includes(m)) { const broken = dependents(m, mods); if (broken.length) return c.toast(t('modStillNeeded', { mod: t('mod_' + m), others: broken.map(x => t('mod_' + x)).join(', ') })); return onChange({ modules: mods.filter(x => x !== m) }); }
    const miss = missingDependencies(m, mods); if (miss.length) return c.toast(t('modNeedsFirst', { mod: t('mod_' + m), others: miss.map(x => t('mod_' + x)).join(` ${t('or')} `) }));
    onChange({ modules: MODULES.filter(x => x === m || mods.includes(x)) }); };
  return (<section className="card"><div className="row between"><h2>{t('modulesTitle')}</h2><span className="muted small">{t('modulesPrice', { amt: MODULES.filter(m => mods.includes(m) && !(m === 'payroll' && ext)).reduce((a, m) => a + MODULE_PRICE[m], 0) })}</span></div>
    <p className="muted small">{t('modulesIntro')}</p>
    <div className="modrow">{MODULES.map(m => { const on = mods.includes(m) && !(m === 'payroll' && ext); return (
      <button key={m} className={`modchip ${on ? 'on' : ''}`} disabled={!canEdit || (m === 'payroll' && ext)} aria-pressed={on} onClick={() => toggle(m)} title={t('modd_' + m)}>
        <span className="tick">{on ? '✓' : '+'}</span>Talaan {t('mod_' + m)}</button>); })}</div>
    <h3>{t('payrollSource')}</h3>
    <div className="seg">{(['talaan', 'external'] as const).map(k => <button key={k} disabled={!canEdit} aria-pressed={(cl.payrollSource ?? 'talaan') === k} onClick={() => onChange({ payrollSource: k })}>{t('src_' + k)}</button>)}</div>
    {ext && <div className="form" style={{ marginTop: 10 }}><label>{t('externalSystem')}<input disabled={!canEdit} list="ext-systems" value={cl.externalSystem ?? ''} onChange={e => onChange({ externalSystem: e.target.value.slice(0, 40) })} />
      <datalist id="ext-systems">{['Sprout Solutions', 'Salarium', 'PayrollHero', 'Talenox', 'Zoho Payroll', 'Excel'].map(x => <option key={x} value={x} />)}</datalist><small>{t('externalHint')}</small></label></div>}
  </section>);
}

export function ClientSetup({ c, cl }: { c: Ctx; cl: Client }) {
  const { t } = c; const s = c.s; const emps = s.employees.filter(e => e.clientId === cl.id); const ext = cl.payrollSource === 'external';
  const items: [string, boolean][] = [
    ['cs_ids', !!(cl.ids?.sss && cl.ids?.tin && cl.ids?.philhealth && cl.ids?.pagibig)],
    ['cs_contacts', (cl.contacts ?? []).length > 0],
    ...(ext ? [['cs_import', s.runs.some(r => r.clientId === cl.id && r.kind === 'imported')]] as [string, boolean][] : [
      ['cs_emps', emps.length > 0],
      ['cs_templates', emps.some(e => (e.template ?? []).length > 0)],
      ['cs_bank', !!cl.bankTemplate?.verified],
      ['cs_first', s.runs.some(r => r.clientId === cl.id && r.status === 'approved')],
    ] as [string, boolean][]),
    ...(modulesOf(cl).includes('books') ? [['cs_codes', !!cl.codes || cl.xero]] as [string, boolean][] : []),
  ];
  const done = items.filter(x => x[1]).length; if (done === items.length) return null;
  return (<section className="card gs"><div className="row between"><h2>{t('clientSetup')}</h2><span className="muted small">{t('gsDone', { n: done, m: items.length })}</span></div>
    <div className="gsbar"><span style={{ width: `${(done / items.length) * 100}%` }} /></div>
    <ol className="gslist">{items.map(([k, ok]) => <li key={k} className={ok ? 'done' : ''}><span className="gsdot">{ok ? '✓' : ''}</span><span className="grow">{t(k)}</span>{!ok && <Chip u="info">{t('toDo')}</Chip>}</li>)}</ol></section>);
}

/** The Talaan module lockup shown above each module's page title: the mark, TALAAN, and the module name. */
export function ModuleBadge({ c, m }: { c: Ctx; m: ModuleKey | 'hq' }) {
  return <div className="modbadge" aria-label={`Talaan ${m === 'hq' ? 'HQ' : c.t('mod_' + m)}`}><img src={MARK} alt="" /><span className="mb-word">TALAAN</span><span className="mb-mod">{m === 'hq' ? 'HQ' : c.t('mod_' + m)}</span></div>;
}
export const BRAND_MARK = MARK;
