/** Talaan Books: account mapping for each client, department (tracking) split, and journals for Xero, QuickBooks or other accounting apps. */
import { useState } from 'react';
import { journal, totals, r2, type Line } from '../engine';
import { DEFAULT_CODES, fmtCsvDate, hasModule, iso, periodInfo, type AccountKey, type Client, type CsvDateFormat, type Run } from '../model';
import { fingerprint, xeroJournalContent } from '../integrations';
import { ReleaseGate } from './integrations';

/** Common tax rate names in Xero Philippines organisations; the live app reads the organisation's own list (GET /api/xero/taxrates). */
const TAX_RATES = ['Tax Exempt', 'No VAT', 'Zero Rated', 'Exempt Purchases'];
const DATE_FORMATS: CsvDateFormat[] = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
import { Chip, Why, Tip, peso, today, saveFile, visibleClients, type Ctx } from '../App';
import { ModuleBadge } from './shell';

type JRow = { key: AccountKey; dept?: string; dr: number; cr: number };
/** The payroll journal, with salary and bonus expense split by department when the client tracks departments. */
export function journalRows(lines: Line[], deptOf: (empId: string) => string | undefined, split: boolean): JRow[] {
  const base = journal(lines).map(([k, dr, cr]) => ({ key: k as AccountKey, dr, cr }));
  if (!split) return base;
  const depts = [...new Set(lines.map(l => deptOf(l.empId) ?? '—'))].sort();
  const out: JRow[] = [];
  for (const r of base) {
    if (r.key !== 'accSalaries' && r.key !== 'accBonus' && r.key !== 'accEmployer') { out.push(r); continue; }
    const pick = (l: Line) => r.key === 'accSalaries' ? l.gross - (l.bonus ?? 0) : r.key === 'accBonus' ? (l.bonus ?? 0) : l.sssER + l.ec + l.phER + l.piER;
    const parts = depts.map(d => ({ key: r.key, dept: d, dr: r2(lines.filter(l => (deptOf(l.empId) ?? '—') === d).reduce((a, l) => a + pick(l), 0)), cr: 0 })).filter(x => x.dr);
    const diff = r2(r.dr - parts.reduce((a, x) => a + x.dr, 0)); if (parts.length && diff) parts[parts.length - 1].dr = r2(parts[parts.length - 1].dr + diff); // keep rounding inside the total
    out.push(...parts);
  }
  return out;
}
function csvCell(v: string | number) { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }

export function Books({ c }: { c: Ctx }) {
  const { t } = c; const clients = visibleClients(c).filter(x => hasModule(x, 'books'));
  const [clientId, setClientId] = useState(clients[0]?.id); const cl = c.s.clients.find(x => x.id === clientId); const [runId, setRunId] = useState<string | undefined>(undefined);
  if (!cl) return (<><div className="head"><h1>{t('navBooks')}</h1></div><p className="muted">{t('noBooksClients')}</p></>);
  const canEdit = c.user.role === 'firmOwner' || c.user.role === 'preparer';
  const upd = (p: Partial<Client>) => c.setS(s => ({ ...s, clients: s.clients.map(x => x.id === cl.id ? { ...x, ...p } : x) }));
  const codes = { ...DEFAULT_CODES, ...(cl.codes ?? {}) }; const split = !!cl.trackDepts;
  const runs = c.s.runs.filter(r => r.clientId === cl.id && r.status === 'approved').sort((a, b) => b.period.localeCompare(a.period));
  const run = runs.find(r => r.id === runId) ?? runs[0];
  const deptOf = (id: string) => c.s.employees.find(e => e.id === id)?.department;
  const rows = run ? journalRows(run.lines ?? [], deptOf, split) : [];
  const dr = r2(rows.reduce((a, r) => a + r.dr, 0)), cr = r2(rows.reduce((a, r) => a + r.cr, 0));
  const narr = (r: Run) => `Payroll ${cl.name} ${c.periodLabel(r.period)}${r.label ? ' ' + r.label : ''}`;
  const date = (r: Run) => iso(periodInfo(r.period).payDate);
  const xeroText = () => { if (!run) return ''; const head = ['*Narration', '*Date', 'Description', '*AccountCode', '*TaxRate', '*Amount', 'TrackingName1', 'TrackingOption1'];
    const body = rows.map(r => [narr(run), fmtCsvDate(date(run), cl.csvDateFormat), t(r.key), codes[r.key], cl.xeroTaxRate || 'Tax Exempt', r2(r.dr - r.cr).toFixed(2), r.dept ? 'Department' : '', r.dept ?? '']);
    return [head, ...body].map(x => x.map(csvCell).join(',')).join('\r\n'); };
  const xeroCsv = () => { if (!run) return; const file = `${cl.id}_${run.period}_xero_journal.csv`; const text = xeroText(); saveFile(c, file, text);
    c.ievent({ system: 'xero', status: 'prepared', doc: 'Manual journal', subject: run.id, clientId: cl.id, period: run.period.slice(0, 7), fileName: file, fileHash: fingerprint(text), message: 'CSV import' }); };
  const genericText = () => { if (!run) return ''; const head = ['Journal No', 'Journal Date', 'Account Code', 'Account Name', 'Department', 'Debit', 'Credit', 'Description'];
    const body = rows.map(r => [`PR-${run.period}`, date(run), codes[r.key], t(r.key), r.dept ?? '', r.dr ? r.dr.toFixed(2) : '', r.cr ? r.cr.toFixed(2) : '', narr(run)]);
    return [head, ...body].map(x => x.map(csvCell).join(',')).join('\r\n'); };
  const genericCsv = () => { if (!run) return; const file = `${cl.id}_${run.period}_journal.csv`; const text = genericText(); saveFile(c, file, text);
    c.ievent({ system: 'export', status: 'prepared', doc: 'Journal (other apps)', subject: run.id, clientId: cl.id, period: run.period.slice(0, 7), fileName: file, fileHash: fingerprint(text) }); };
  const missing = (Object.keys(DEFAULT_CODES) as AccountKey[]).filter(k => rows.some(r => r.key === k) && !String(codes[k] ?? '').trim());
  const send = () => { if (!run) return; if (!cl.xero) return c.toast(t('xeroNeedsConnect')); if (!cl.xeroTenantId) return c.toast(t('xeroPickOrg')); if (missing.length) return c.toast(t('xeroCodesMissing', { codes: missing.map(k => t(k)).join(', ') }));
    c.setS(s => ({ ...s, runs: s.runs.map(r => r.id === run.id ? { ...r, xeroSentAt: iso(today()) } : r) })); c.log('act_xero', {}, cl.id);
    c.ievent({ system: 'xero', status: 'sent', doc: 'Manual journal', subject: run.id, clientId: cl.id, period: run.period.slice(0, 7), message: `${cl.xeroTenantName ?? ''} · ${t('xeroProtoNote')}` }); c.toast(t('sentXero')); };
  const orgs = [cl.name, 'Demo Company (Global)'];
  const items = c.s.payItems.filter(p => p.active !== false && p.account);
  return (<><ModuleBadge c={c} m="books" /><div className="head"><div><h1>{t('navBooks')}</h1><p className="muted">{t('booksSub')}</p></div></div>
    <Why>{t('booksIntro')}</Why>
    <section className="card"><div className="form">
      <label>{t('chooseClient')}<select value={cl.id} onChange={e => { setClientId(e.target.value); setRunId(undefined); }}>{clients.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>{t('xero')}<span className="row"><Chip u={cl.xero ? 'ok' : 'info'}>{cl.xero ? t('xeroConnected') : t('xeroNotConnected')}</Chip>{canEdit && <button className="btn small ghost" onClick={() => upd({ xero: !cl.xero })}>{cl.xero ? t('disconnect') : t('connectXero')}</button>}</span><small>{t('xeroDemoNote')}</small></label>
      {cl.xero && <label>{t('xeroOrg')} <Tip text={t('tip_xeroOrg')} /><select disabled={!canEdit} value={cl.xeroTenantId ?? ''} onChange={e => { const i = orgs.findIndex((_, n) => `demo-${n}` === e.target.value); upd({ xeroTenantId: e.target.value || undefined, xeroTenantName: i >= 0 ? orgs[i] : undefined }); }}>
        <option value="">{t('xeroOrgPh')}</option>{orgs.map((o, n) => <option key={o} value={`demo-${n}`}>{o}</option>)}</select></label>}
      <label>{t('csvDateFormat')} <Tip text={t('tip_csvDate')} /><select disabled={!canEdit} value={cl.csvDateFormat ?? 'DD/MM/YYYY'} onChange={e => upd({ csvDateFormat: e.target.value as CsvDateFormat })}>{DATE_FORMATS.map(d => <option key={d}>{d}</option>)}</select></label>
      <label>{t('xeroTaxRateLabel')} <Tip text={t('tip_xeroTaxRate')} /><select disabled={!canEdit} value={cl.xeroTaxRate ?? 'Tax Exempt'} onChange={e => upd({ xeroTaxRate: e.target.value })}>{[...new Set([...(cl.xeroTaxRate ? [cl.xeroTaxRate] : []), ...TAX_RATES])].map(x => <option key={x}>{x}</option>)}</select></label>
      <label className="check"><input type="checkbox" disabled={!canEdit} checked={split} onChange={e => upd({ trackDepts: e.target.checked })} /> {t('trackDepts')} <Tip text={t('tip_trackDepts')} /></label></div>
      <p className="muted small">{t('xeroServerNote')}</p></section>
    <section className="card"><h2>{t('accountMapping')} <Tip text={t('tip_codes')} /></h2><div className="scroll"><table className="tbl"><thead><tr><th>{t('payrollLine')}</th><th>{t('accountCode')}</th><th>{t('side')}</th></tr></thead>
      <tbody>{(Object.keys(DEFAULT_CODES) as AccountKey[]).map(k => <tr key={k}><td>{t(k)}<div className="muted small">{t('acch_' + k)}</div></td>
        <td><input aria-label={`${t(k)} ${t('accountCode')}`} disabled={!canEdit} value={codes[k]} onChange={e => upd({ codes: { ...codes, [k]: e.target.value.slice(0, 20) } })} style={{ maxWidth: 120 }} /></td>
        <td>{['accSalaries', 'accBonus', 'accEmployer', 'accReimb'].includes(k) ? t('debitSide') : t('creditSide')}</td></tr>)}</tbody></table></div>
      {items.length > 0 && <p className="small">{t('itemAccounts')}: {items.map(p => `${p.name} → ${p.account}`).join('; ')}</p>}
      <p className="muted small">{t('accountCodesHint')}</p></section>
    <section className="card"><div className="row between"><h2>{t('journalPreview')}</h2>{runs.length > 0 && <select aria-label={t('period')} value={run?.id} onChange={e => setRunId(e.target.value)}>{runs.map(r => <option key={r.id} value={r.id}>{c.periodLabel(r.period)}{r.label ? ` · ${r.label}` : ''}</option>)}</select>}</div>
      {!run ? <p className="muted">{t('noApprovedRuns')}</p> : <>
        <table className="tbl"><thead><tr><th>{t('colAccount')}</th><th>{t('accountCode')}</th><th>{t('department')}</th><th className="num">{t('debit')}</th><th className="num">{t('credit')}</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}><td>{t(r.key)}</td><td>{codes[r.key]}</td><td>{r.dept ?? ''}</td><td className="num">{r.dr ? peso(r.dr) : ''}</td><td className="num">{r.cr ? peso(r.cr) : ''}</td></tr>)}
            <tr className="totalrow"><td colSpan={3}>{t('total')} {Math.abs(dr - cr) < 0.01 ? <Chip u="ok">{t('balanced')}</Chip> : <Chip u="late">{t('notBalanced')}</Chip>}</td><td className="num">{peso(dr)}</td><td className="num">{peso(cr)}</td></tr></tbody></table>
        <div className="row end"><ReleaseGate c={c} system="export" doc="Journal (other apps)" subject={run.id} clientId={cl.id} period={run.period.slice(0, 7)} content={genericText()} summary={t('relSumExport', { what: t('dlGeneric'), scope: `${cl.name} · ${c.periodLabel(run.period)}` })} route={{ page: 'books' }}><button className="btn ghost" onClick={genericCsv}>{t('dlGeneric')}</button></ReleaseGate>
          </div>
        <ReleaseGate c={c} system="xero" doc="Manual journal" subject={run.id} clientId={cl.id} period={run.period.slice(0, 7)} content={xeroJournalContent(cl.xeroTenantId ?? '', date(run), rows.map(r => ({ accountCode: codes[r.key], description: t(r.key), amount: r2(r.dr - r.cr), department: r.dept })))} summary={t('relSumXero', { client: cl.name, period: c.periodLabel(run.period), org: cl.xeroTenantName ?? '—' })} route={{ page: 'books' }}>
          <div className="row end"><button className="btn ghost" onClick={xeroCsv}>{t('dlXero')}</button>{run.xeroSentAt ? <Chip u="ok">✓ {t('sentXero')} {run.xeroSentAt}</Chip> : <button className="btn xero" onClick={send}>{t('sendXero')}</button>}</div></ReleaseGate>
        <p className="muted small">{t('journalTotals', { gross: peso(totals(run.lines ?? []).gross), net: peso(totals(run.lines ?? []).net) })}</p></>}</section></>);
}
