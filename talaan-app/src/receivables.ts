/**
 * Receivables: invoices, payments, balances, ageing and statements of account. Pure functions used at both
 * billing levels: the accounting firm billing its client employers, and Talaan HQ billing accounting firms
 * and employers that subscribe directly.
 */
import { r2 } from './engine';

export type PayMethod = 'bank' | 'gcash' | 'maya' | 'check' | 'card' | 'cash' | 'other';
export const PAY_METHODS: PayMethod[] = ['bank', 'gcash', 'maya', 'check', 'card', 'cash', 'other'];
export interface ProofFile { docId: string; name: string; size: number; type: string }
export interface Payment { id: string; date: string; amount: number; method: PayMethod; reference: string; by: string; note?: string; /** Creditable withholding tax (BIR Form 2307) the customer deducted. */ cwt?: number;
  /** How the payment reached Talaan: paid online through Talaan's checkout (confirmed by the payment provider), recorded by staff, or claimed by the customer with proof and confirmed by staff. */
  source?: 'online' | 'staff' | 'proof'; proof?: ProofFile; confirmedBy?: string; confirmedAt?: string; /** Staff ticked that the deposit appears on the bank or e-wallet statement. */ reconciledBy?: string }
/**
 * A payment the customer says they made outside Talaan (bank deposit, cheque, transfer), with proof attached.
 * Human in the loop: nothing changes on the invoice until a staff member reviews the proof and confirms or rejects it.
 */
export interface PaymentClaim { id: string; level: 'firm' | 'hq'; docNo: string; customerId: string; amount: number; cwt?: number; date: string; method: PayMethod; reference: string; note?: string;
  proof: ProofFile; submittedBy: string; submittedAt: string; status: 'pending' | 'confirmed' | 'rejected'; reviewedBy?: string; reviewedAt?: string; reason?: string }
/** Pending claims count toward nothing until confirmed; this shows what a customer has already sent proof for. */
export const pendingFor = (claims: PaymentClaim[] | undefined, docNo: string) => (claims ?? []).filter(x => x.docNo === docNo && x.status === 'pending');
/** A confirmed claim becomes a payment, keeping the proof and who confirmed it. */
export function claimToPayment(cl: PaymentClaim, reviewer: string, at: string): Payment {
  return { id: `p-${cl.id}`, date: cl.date, amount: cl.amount, cwt: cl.cwt, method: cl.method, reference: cl.reference, note: cl.note, by: cl.submittedBy, source: 'proof', proof: cl.proof, confirmedBy: reviewer, confirmedAt: at };
}
export type ArStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue';
export interface ArDoc { no: string; customerId: string; total: number; issuedAt: string; dueAt: string; draft?: boolean; payments?: Payment[]; /** Older records marked paid before payments were recorded one by one. */ paidAt?: string }

/** Amount settled: cash received plus any 2307 withholding the customer deducted. */
export const settled = (d: ArDoc) => r2((d.payments ?? []).reduce((a, p) => a + p.amount + (p.cwt ?? 0), 0) + (d.paidAt && !(d.payments ?? []).length ? d.total : 0));
export const balanceOf = (d: ArDoc) => r2(Math.max(0, d.total - settled(d)));

export function arStatus(d: ArDoc, today: string): ArStatus {
  if (d.draft) return 'draft';
  const bal = balanceOf(d);
  if (bal <= 0.005) return 'paid';
  if (d.dueAt < today) return 'overdue';
  return settled(d) > 0 ? 'partial' : 'sent';
}
export const daysBetweenIso = (a: string, b: string) => Math.round((new Date(b + 'T00:00').getTime() - new Date(a + 'T00:00').getTime()) / 864e5);

export const AGING_BUCKETS = ['current', 'd1_30', 'd31_60', 'd61_90', 'd90p'] as const;
export type AgingBucket = typeof AGING_BUCKETS[number];
export function bucketOf(d: ArDoc, today: string): AgingBucket {
  const late = daysBetweenIso(d.dueAt, today);
  return late <= 0 ? 'current' : late <= 30 ? 'd1_30' : late <= 60 ? 'd31_60' : late <= 90 ? 'd61_90' : 'd90p';
}
/** Open balances by age band, per customer and in total. */
export function aging(docs: ArDoc[], today: string) {
  const empty = () => Object.fromEntries(AGING_BUCKETS.map(b => [b, 0])) as Record<AgingBucket, number>;
  const total = empty(); const byCustomer = new Map<string, Record<AgingBucket, number>>();
  for (const d of docs) { if (d.draft) continue; const bal = balanceOf(d); if (bal <= 0.005) continue; const b = bucketOf(d, today);
    total[b] = r2(total[b] + bal); const row = byCustomer.get(d.customerId) ?? empty(); row[b] = r2(row[b] + bal); byCustomer.set(d.customerId, row); }
  const sumOf = (r: Record<AgingBucket, number>) => r2(AGING_BUCKETS.reduce((a, b) => a + r[b], 0));
  return { total, outstanding: sumOf(total), byCustomer: [...byCustomer.entries()].map(([customerId, r]) => ({ customerId, ...r, outstanding: sumOf(r) })).sort((a, b) => b.outstanding - a.outstanding) };
}

/** Collection metrics for the period: billed, collected, collection rate and days sales outstanding. */
export function collections(docs: ArDoc[], today: string, days = 90) {
  const from = new Date(new Date(today + 'T00:00').getTime() - days * 864e5).toISOString().slice(0, 10);
  const issued = docs.filter(d => !d.draft && d.issuedAt >= from && d.issuedAt <= today);
  const billed = r2(issued.reduce((a, d) => a + d.total, 0));
  const collected = r2(docs.flatMap(d => d.payments ?? []).filter(p => p.date >= from && p.date <= today).reduce((a, p) => a + p.amount + (p.cwt ?? 0), 0));
  const open = r2(docs.filter(d => !d.draft).reduce((a, d) => a + balanceOf(d), 0));
  return { billed, collected, rate: billed ? r2(collected / billed) : 1, dso: billed ? Math.round(open / (billed / days)) : 0, open };
}

/** Statement of account: every invoice and payment for one customer, with a running balance. */
export function statementRows(docs: ArDoc[], customerId: string, from = '0000-01-01', to = '9999-12-31') {
  const mine = docs.filter(d => d.customerId === customerId && !d.draft);
  const events: { date: string; ref: string; desc: string; charge: number; credit: number }[] = [];
  let opening = 0;
  for (const d of mine) {
    if (d.issuedAt < from) opening += d.total; else if (d.issuedAt <= to) events.push({ date: d.issuedAt, ref: d.no, desc: `Invoice ${d.no} (due ${d.dueAt})`, charge: d.total, credit: 0 });
    const pays = d.payments?.length ? d.payments : d.paidAt ? [{ id: 'legacy', date: d.paidAt, amount: d.total, method: 'other' as PayMethod, reference: '', by: '' }] : [];
    for (const p of pays) { const amt = p.amount + (p.cwt ?? 0);
      if (p.date < from) opening -= amt; else if (p.date <= to) events.push({ date: p.date, ref: p.reference || d.no, desc: `Payment for ${d.no} (${p.method}${p.cwt ? `, 2307 ₱${p.cwt.toFixed(2)}` : ''})`, charge: 0, credit: amt }); }
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || b.charge - a.charge);
  let bal = r2(opening); const rows = events.map(e => { bal = r2(bal + e.charge - e.credit); return { ...e, balance: bal }; });
  return { opening: r2(opening), rows, closing: bal };
}
export function statementCsv(customerName: string, issuer: string, docs: ArDoc[], customerId: string, from?: string, to?: string) {
  const st = statementRows(docs, customerId, from, to);
  const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return '﻿' + [[`Statement of account: ${customerName}`], [`From ${issuer}`], [`Period ${from ?? 'start'} to ${to ?? 'today'}`], [],
    ['Date', 'Reference', 'Description', 'Charges', 'Payments', 'Balance'], ['', '', 'Opening balance', '', '', st.opening.toFixed(2)],
    ...st.rows.map(r => [r.date, r.ref, r.desc, r.charge ? r.charge.toFixed(2) : '', r.credit ? r.credit.toFixed(2) : '', r.balance.toFixed(2)]),
    ['', '', 'Closing balance', '', '', st.closing.toFixed(2)]].map(r => r.map(q).join(',')).join('\r\n');
}

/** Validates a payment before it is recorded. Overpayments are refused (record the excess as a separate credit). */
export function checkPayment(d: ArDoc, p: Pick<Payment, 'amount' | 'date' | 'reference' | 'method'> & { cwt?: number }, today: string): string | null {
  if (!(p.amount > 0) && !((p.cwt ?? 0) > 0)) return 'payAmountNeeded';
  if (p.amount + (p.cwt ?? 0) > balanceOf(d) + 0.005) return 'payTooMuch';
  if (!p.date || p.date > today) return 'payDateBad';
  if (p.date < d.issuedAt) return 'payBeforeInvoice';
  if (p.method !== 'cash' && !p.reference.trim()) return 'payRefNeeded';
  return null;
}
