/**
 * Paying an invoice. The preferred route is "Pay now": the customer pays online through Talaan's checkout and the
 * payment provider confirms it, so it is recorded straight away. When the customer paid another way (deposit,
 * cheque, transfer), they upload proof; a staff member then reviews it and confirms or rejects it (human in the loop).
 * The same screens serve both levels: client employers paying their accounting firm, and firms or direct employers paying Talaan.
 */
import { useState } from 'react';
import { r2 } from '../engine';
import { iso } from '../model';
import { addDoc, getDoc, MAX_DOC_BYTES } from '../docs';
import { balanceOf, checkPayment, claimToPayment, pendingFor, PAY_METHODS, type ArDoc, type Payment, type PaymentClaim, type PayMethod } from '../receivables';
import { Chip, peso, today, saveFile, Tip, type Ctx } from '../App';

const ONLINE: { id: PayMethod; label: string }[] = [{ id: 'gcash', label: 'GCash' }, { id: 'maya', label: 'Maya' }, { id: 'card', label: 'pc_card' }, { id: 'bank', label: 'pc_bank' }];

/** Online checkout. In the live product this opens the payment provider's secure page (talaan-kit /api/pay/checkout) and the provider's webhook records the payment. */
export function PayOnline({ c, doc, payee, onPaid, amount }: { c: Ctx; doc: ArDoc; payee: string; onPaid: (p: Payment) => void; amount?: number }) {
  const { t } = c; const bal = r2(Math.min(balanceOf(doc), amount ?? Infinity)); const [ch, setCh] = useState<PayMethod>('gcash'); const [step, setStep] = useState<'choose' | 'confirm' | 'done'>('choose'); const [ref, setRef] = useState('');
  const pay = () => { const reference = `TLN-${Date.now().toString(36).toUpperCase().slice(-8)}`; setRef(reference);
    onPaid({ id: `p${Date.now().toString(36)}`, date: iso(today()), amount: bal, method: ch, reference, by: c.user.id, source: 'online', confirmedBy: 'payment provider', confirmedAt: new Date().toISOString(), note: t('demoPayment') }); setStep('done'); };
  return (<div><h2>{t('payNow')}: {doc.no}</h2>
    <ol className="steps small"><li className={step === 'choose' ? 'on' : 'done'}>{t('payStepChoose')}</li><li className={step === 'confirm' ? 'on' : step === 'done' ? 'done' : ''}>{t('payStepConfirm')}</li><li className={step === 'done' ? 'on' : ''}>{t('payStepDone')}</li></ol>
    {step === 'choose' && <><p>{t('payTo', { payee })} <b>{peso(bal)}</b></p>
      <div className="paychoices">{ONLINE.map(o => <button key={o.id} className={`modchip ${ch === o.id ? 'on' : ''}`} aria-pressed={ch === o.id} onClick={() => setCh(o.id)}><span className="tick">{ch === o.id ? '✓' : ''}</span>{o.label.startsWith('pc_') ? t(o.label) : o.label}</button>)}</div>
      <p className="muted small">{t('payOnlineNote')}</p>
      <div className="row end"><button className="btn ghost" onClick={() => c.modal(null)}>{t('cancel')}</button><button className="btn" disabled={bal <= 0} onClick={() => setStep('confirm')}>{t('next')}</button></div></>}
    {step === 'confirm' && <><table className="tbl small"><tbody><tr><td>{t('payee')}</td><td><b>{payee}</b></td></tr><tr><td>{t('invNo')}</td><td>{doc.no}</td></tr><tr><td>{t('payMethod')}</td><td>{ONLINE.find(o => o.id === ch)!.label.startsWith('pc_') ? t(ONLINE.find(o => o.id === ch)!.label) : ONLINE.find(o => o.id === ch)!.label}</td></tr><tr className="totalrow"><td>{t('payAmount')}</td><td>{peso(bal)}</td></tr></tbody></table>
      <p className="warnbox small">{t('payDemoNote')}</p>
      <div className="row end"><button className="btn ghost" onClick={() => setStep('choose')}>{t('back')}</button><button className="btn green" onClick={pay}>{t('payAmt', { amt: peso(bal) })}</button></div></>}
    {step === 'done' && <><p className="okmsg">✓ {t('paidOnline', { amt: peso(bal), ref })}</p><p className="muted small">{t('paidOnlineHint')}</p><div className="row end"><button className="btn" onClick={() => c.modal(null)}>{t('close')}</button></div></>}
  </div>);
}

/** "I paid another way": the customer records what they paid and attaches the deposit slip, transfer confirmation or cheque. */
export function ProofForm({ c, doc, level, payee, reviewers }: { c: Ctx; doc: ArDoc; level: 'firm' | 'hq'; payee: string; reviewers: string[] }) {
  const { t } = c; const bal = balanceOf(doc);
  const [f, setF] = useState({ amount: bal, cwt: 0, date: iso(today()), method: 'bank' as PayMethod, reference: '', note: '' }); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false);
  const err = checkPayment(doc, f, iso(today())) ?? (!file ? 'proofNeeded' : null);
  const send = async () => { if (err || !file) return; setBusy(true);
    const meta = await addDoc({ owner: `pay:${doc.no}`, kind: 'Proof of payment', name: file.name, size: file.size, type: file.type, addedBy: c.user.id }, file);
    const claim: PaymentClaim = { id: `cl${Date.now().toString(36)}`, level, docNo: doc.no, customerId: doc.customerId, amount: r2(f.amount), cwt: f.cwt ? r2(f.cwt) : undefined, date: f.date, method: f.method, reference: f.reference.trim().slice(0, 60), note: f.note.trim().slice(0, 200) || undefined,
      proof: { docId: meta.id, name: file.name, size: file.size, type: file.type }, submittedBy: c.user.id, submittedAt: new Date().toISOString(), status: 'pending' };
    c.setS(s => ({ ...s, claims: [claim, ...(s.claims ?? [])] })); c.log('act_claim', { no: doc.no });
    c.notify(reviewers, 'n_claim', { no: doc.no, who: c.user.name }, level === 'hq' ? { page: 'hq', id: 'billing' } : { page: 'billing', id: 'invoices' });
    c.modal(null); c.toast(t('proofSent', { payee })); };
  return (<div><h2>{t('uploadProof')}: {doc.no}</h2><p className="muted small">{t('proofIntro', { payee })}</p>
    <div className="form">
      <label>{t('payAmount')}<input type="number" min={0} step="0.01" value={f.amount || ''} onChange={e => setF({ ...f, amount: Math.max(0, Number(e.target.value) || 0) })} /></label>
      <label><span>{t('payCwt')} <Tip text={t('tip_cwt')} /></span><input type="number" min={0} step="0.01" value={f.cwt || ''} onChange={e => setF({ ...f, cwt: Math.max(0, Number(e.target.value) || 0) })} /></label>
      <label>{t('payDatePaid')}<input type="date" value={f.date} max={iso(today())} onChange={e => setF({ ...f, date: e.target.value })} /></label>
      <label>{t('payMethod')}<select value={f.method} onChange={e => setF({ ...f, method: e.target.value as PayMethod })}>{PAY_METHODS.map(m => <option key={m} value={m}>{t('pm_' + m)}</option>)}</select></label>
      <label>{t('payRef')}<input value={f.reference} placeholder={t('payRefPh')} onChange={e => setF({ ...f, reference: e.target.value })} /></label>
      <label>{t('proofFile')}<input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={e => { const x = e.target.files?.[0] ?? null; if (x && x.size > MAX_DOC_BYTES) { c.toast(t('tooBig')); return; } setFile(x); }} />{file && <small className="ok">✓ {file.name}</small>}</label>
      <label className="wide">{t('payNote')}<input value={f.note} onChange={e => setF({ ...f, note: e.target.value })} /></label></div>
    {err && <p className="bad small">{t(err)}</p>}
    <p className="muted small">{t('proofReviewNote', { payee })}</p>
    <div className="row end"><button className="btn ghost" onClick={() => c.modal(null)}>{t('cancel')}</button><button className="btn" disabled={!!err || busy} onClick={send}>{t('sendProof')}</button></div></div>);
}

/** Customer-side status of proofs sent for one invoice. */
export function ClaimStatus({ c, docNo }: { c: Ctx; docNo: string }) {
  const { t } = c; const mine = (c.s.claims ?? []).filter(x => x.docNo === docNo && (x.status === 'pending' || (x.status === 'rejected' && !(c.s.claims ?? []).some(y => y.docNo === docNo && y.status === 'confirmed' && y.submittedAt > x.submittedAt))));
  if (!mine.length) return null;
  return <div className="small">{mine.map(x => <div key={x.id}>{x.status === 'pending' ? <Chip u="soon">{t('proofPending', { amt: peso(x.amount + (x.cwt ?? 0)) })}</Chip> : <span className="bad">{t('proofRejected', { reason: x.reason ?? '' })}</span>}</div>)}</div>;
}

/** Staff review queue: open the proof, then confirm (records the payment) or reject with a reason. The person who sent the proof cannot confirm it. */
export function ClaimsQueue({ c, level, docOf, nameOf, onConfirm }: { c: Ctx; level: 'firm' | 'hq'; docOf: (no: string) => ArDoc | undefined; nameOf: (id: string) => string; onConfirm: (claim: PaymentClaim, p: Payment) => void }) {
  const { t } = c; const list = (c.s.claims ?? []).filter(x => x.level === level && x.status === 'pending');
  const [reject, setReject] = useState<{ id: string; reason: string } | null>(null);
  if (!list.length) return null;
  const view = async (cl: PaymentClaim) => { const d = await getDoc(cl.proof.docId); if (d) saveFile(c, cl.proof.name, await d.blob.arrayBuffer(), { plain: true }); else c.toast(t('proofMissing')); };
  const decide = (cl: PaymentClaim, status: 'confirmed' | 'rejected', reason?: string) => {
    if ((c.s.claims ?? []).find(x => x.id === cl.id)?.status !== 'pending') { c.toast(t('claimDone')); return; } // someone else already decided it
    const at = new Date().toISOString();
    c.setS(s => ({ ...s, claims: (s.claims ?? []).map(x => x.id === cl.id ? { ...x, status, reviewedBy: c.user.id, reviewedAt: at, reason } : x) }));
    if (status === 'confirmed') onConfirm(cl, claimToPayment(cl, c.user.id, at));
    c.notify([cl.submittedBy], status === 'confirmed' ? 'n_claimOk' : 'n_claimNo', { no: cl.docNo, reason: reason ?? '' }, level === 'hq' ? { page: 'billing', id: 'subscription' } : { page: 'invoices' });
    c.log(status === 'confirmed' ? 'act_claimOk' : 'act_claimNo', { no: cl.docNo }); c.toast(t(status === 'confirmed' ? 'claimConfirmed' : 'claimRejected', { no: cl.docNo })); setReject(null); };
  return (<section className="card attention"><h2>{t('claimsTitle', { n: list.length })} <Tip text={t('tip_claims')} /></h2>
    <div className="scroll"><table className="tbl"><thead><tr><th>{t('invNo')}</th><th>{t('arCustomer')}</th><th className="num">{t('payAmount')}</th><th>{t('payDatePaid')}</th><th>{t('payRef')}</th><th>{t('proofFile')}</th><th></th></tr></thead>
      <tbody>{list.map(cl => { const doc = docOf(cl.docNo); const err = !doc ? 'claimNoInvoice' : checkPayment(doc, cl, iso(today())); const self = cl.submittedBy === c.user.id;
        return <tr key={cl.id}><td><b>{cl.docNo}</b><div className="muted small">{t('sentBy', { who: c.s.users.find(u => u.id === cl.submittedBy)?.name ?? cl.submittedBy, date: cl.submittedAt.slice(0, 10) })}</div></td><td>{nameOf(cl.customerId)}</td>
          <td className="num">{peso(cl.amount)}{cl.cwt ? <div className="muted small">+ 2307 {peso(cl.cwt)}</div> : null}{doc && <div className="muted small">{t('balanceDue')}: {peso(balanceOf(doc))}</div>}</td><td>{cl.date}</td><td>{t('pm_' + cl.method)}<div className="small">{cl.reference}</div>{cl.note && <div className="muted small">{cl.note}</div>}</td>
          <td><button className="link" onClick={() => view(cl)}>{cl.proof.name}</button></td>
          <td>{reject?.id === cl.id ? <div className="row"><input autoFocus placeholder={t('rejectReasonPh')} value={reject.reason} onChange={e => setReject({ id: cl.id, reason: e.target.value.slice(0, 160) })} /><button className="btn small" disabled={reject.reason.trim().length < 5} onClick={() => decide(cl, 'rejected', reject.reason.trim())}>{t('reject')}</button></div>
            : <div className="row"><button className="btn small green" disabled={!!err || self} title={self ? t('claimSelf') : err ? t(err) : ''} onClick={() => decide(cl, 'confirmed')}>{t('confirmPayment')}</button><button className="btn small ghost" onClick={() => setReject({ id: cl.id, reason: '' })}>{t('reject')}</button></div>}
            {(err || self) && <div className="small warn">{self ? t('claimSelf') : t(err!)}</div>}</td></tr>; })}</tbody></table></div>
    <p className="muted small">{t('claimsHint')}</p></section>);
}

/** Buttons a customer sees on an open invoice: pay online (preferred) or upload proof of a payment made elsewhere. */
export function PayButtons({ c, doc, level, payee, reviewers, onPaid }: { c: Ctx; doc: ArDoc; level: 'firm' | 'hq'; payee: string; reviewers: string[]; onPaid: (p: Payment) => void }) {
  const { t } = c; if (balanceOf(doc) <= 0.005) return null;
  // Money already claimed with proof is held back, so the invoice is never paid twice; any remainder can still be paid now.
  const held = pendingFor(c.s.claims, doc.no).reduce((a, x) => a + x.amount + (x.cwt ?? 0), 0); const rest = r2(balanceOf(doc) - held); const pending = held > 0;
  if (rest <= 0.005) return null;
  return <span className="row"><button className="btn small green" onClick={() => c.modal(<PayOnline c={c} doc={doc} payee={payee} onPaid={onPaid} amount={rest} />)}>{pending ? t('payRest', { amt: peso(rest) }) : t('payNow')}</button>
    <button className="btn small ghost" disabled={pending} title={pending ? t('proofAlready') : ''} onClick={() => c.modal(<ProofForm c={c} doc={doc} level={level} payee={payee} reviewers={reviewers} />)}>{t('paidElsewhere')}</button></span>;
}
