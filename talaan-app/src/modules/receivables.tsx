/** Shared receivables screens: record a payment, ageing of open balances, and collection figures. Used by firm Billing, Talaan HQ Billing and the client's Invoices page. */
import { useState } from 'react';
import { r2 } from '../engine';
import { iso } from '../model';
import { PAY_METHODS, AGING_BUCKETS, aging, balanceOf, checkPayment, collections, type ArDoc, type Payment, type PayMethod } from '../receivables';
import { peso, today, Tip, type Ctx } from '../App';
import { addDoc, MAX_DOC_BYTES } from '../docs';

export function PaymentForm({ c, doc, title, onSave }: { c: Ctx; doc: ArDoc; title: string; onSave: (p: Payment) => void }) {
  const { t } = c; const bal = balanceOf(doc);
  const [p, setP] = useState({ amount: bal, cwt: 0, date: iso(today()), method: 'bank' as PayMethod, reference: '', note: '' });
  const err = checkPayment(doc, p, iso(today()));
  const [file, setFile] = useState<File | null>(null);
  const save = async () => { if (err) return; const meta = file ? await addDoc({ owner: `pay:${doc.no}`, kind: 'Proof of payment', name: file.name, size: file.size, type: file.type, addedBy: c.user.id }, file) : null;
    onSave({ ...(meta ? { proof: { docId: meta.id, name: meta.name, size: meta.size, type: meta.type } } : {}), id: `p${Date.now().toString(36)}`, date: p.date, amount: r2(p.amount), cwt: p.cwt ? r2(p.cwt) : undefined, method: p.method, reference: p.reference.trim().slice(0, 60), note: p.note.trim().slice(0, 200) || undefined, by: c.user.id }); c.modal(null); c.toast(t('paymentRecorded', { amt: peso(r2(p.amount + p.cwt)), no: doc.no })); };
  return (<div><h2>{t('recordPayment')}: {title}</h2><p className="muted">{t('invNo')} {doc.no} · {t('balanceDue')} <b>{peso(bal)}</b></p>
    <div className="form">
      <label>{t('payAmount')}<input type="number" min={0} step="0.01" value={p.amount || ''} onChange={e => setP({ ...p, amount: Math.max(0, Number(e.target.value) || 0) })} /></label>
      <label><span>{t('payCwt')} <Tip text={t('tip_cwt')} /></span><input type="number" min={0} step="0.01" value={p.cwt || ''} onChange={e => setP({ ...p, cwt: Math.max(0, Number(e.target.value) || 0) })} /></label>
      <label>{t('payDate')}<input type="date" value={p.date} max={iso(today())} onChange={e => setP({ ...p, date: e.target.value })} /></label>
      <label>{t('payMethod')}<select value={p.method} onChange={e => setP({ ...p, method: e.target.value as PayMethod })}>{PAY_METHODS.map(m => <option key={m} value={m}>{t('pm_' + m)}</option>)}</select></label>
      <label>{t('payRef')}<input value={p.reference} placeholder={t('payRefPh')} onChange={e => setP({ ...p, reference: e.target.value })} /></label>
      <label>{t('proofFileOpt')}<input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={e => { const x = e.target.files?.[0] ?? null; if (x && x.size > MAX_DOC_BYTES) { c.toast(t('tooBig')); return; } setFile(x); }} />{file && <small className="ok">✓ {file.name}</small>}</label>
      <label className="wide">{t('payNote')}<input value={p.note} onChange={e => setP({ ...p, note: e.target.value })} /></label></div>
    {err && <p className="bad small">{t(err)}</p>}
    <div className="row end"><button className="btn ghost" onClick={() => c.modal(null)}>{t('cancel')}</button><button className="btn" disabled={!!err} onClick={save}>{t('recordPayment')}</button></div></div>);
}

export function PaymentsList({ c, doc }: { c: Ctx; doc: ArDoc }) {
  const { t } = c; const pays = doc.payments ?? [];
  if (!pays.length) return null;
  return <ul className="activity small">{pays.map(p => <li key={p.id}><span className="grow">{p.date} · {t('pm_' + p.method)}{p.reference ? ` · ${p.reference}` : ''}{p.source ? ` · ${t('ps_' + p.source)}` : ''}{p.proof ? ` · 📎 ${p.proof.name}` : ''}{p.note ? ` · ${p.note}` : ''}</span><b>{peso(p.amount)}</b>{p.cwt ? <span className="muted"> + 2307 {peso(p.cwt)}</span> : null}</li>)}</ul>;
}

/** Ageing of open balances and the last 90 days' collections. */
export function AgingCard({ c, docs, nameOf, onStatement }: { c: Ctx; docs: ArDoc[]; nameOf: (id: string) => string; onStatement?: (customerId: string) => void }) {
  const { t } = c; const now = iso(today()); const a = aging(docs, now); const k = collections(docs, now);
  return (<section className="card"><div className="row between"><h2>{t('arTitle')} <Tip text={t('tip_aging')} /></h2><span className="muted small">{t('arAsOf', { date: now })}</span></div>
    <div className="stats kpis">
      <div><span>{t('arOutstanding')}</span><b>{peso(a.outstanding)}</b></div>
      <div><span>{t('arOverdue')}</span><b className={a.outstanding - a.total.current > 0 ? 'bad' : ''}>{peso(r2(a.outstanding - a.total.current))}</b></div>
      <div><span>{t('arCollected90')}</span><b>{peso(k.collected)}</b><small className="muted">{t('arRate', { pct: Math.round(k.rate * 100) })}</small></div>
      <div><span>{t('arDso')}</span><b>{k.dso}</b><small className="muted">{t('arDsoUnit')}</small></div></div>
    {a.byCustomer.length === 0 ? <p className="muted">{t('arNone')}</p> :
      <div className="scroll"><table className="tbl"><thead><tr><th>{t('arCustomer')}</th>{AGING_BUCKETS.map(b => <th key={b} className="num">{t('ag_' + b)}</th>)}<th className="num">{t('total')}</th><th></th></tr></thead>
        <tbody>{a.byCustomer.map(r => <tr key={r.customerId}><td><b>{nameOf(r.customerId)}</b></td>{AGING_BUCKETS.map(b => <td key={b} className={`num ${b !== 'current' && r[b] ? 'bad' : ''}`}>{r[b] ? peso(r[b]) : '—'}</td>)}<td className="num"><b>{peso(r.outstanding)}</b></td>
          <td>{onStatement && <button className="btn small ghost" onClick={() => onStatement(r.customerId)}>{t('statementOfAccount')}</button>}</td></tr>)}
          <tr className="totalrow"><td>{t('total')}</td>{AGING_BUCKETS.map(b => <td key={b} className="num">{peso(a.total[b])}</td>)}<td className="num">{peso(a.outstanding)}</td><td></td></tr></tbody></table></div>}
  </section>);
}
