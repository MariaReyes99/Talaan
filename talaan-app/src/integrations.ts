/**
 * Integration log and failure alerts, shared by the app and the server (talaan-kit syncs this file).
 *
 * Every attempt to exchange something with an outside system is one event: a government file prepared, uploaded,
 * accepted or rejected; a payment made; a bank file; a Xero journal; a payment-provider webhook. Events are append-only
 * and chained: each carries the SHA-256 of the one before, so any later change or deletion is detectable (verifyChain).
 *
 * The alert rules turn obligations (filings with due dates) and events into notices for the accounting firm:
 * the assigned preparer and the firm owners first; the client owner too if it is still unresolved after 2 days.
 */

/* ---------- SHA-256 (synchronous, so the browser and server compute the same chain without async crypto) ---------- */
const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
export function sha256(input: string | Uint8Array): string {
  const msg = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const len = msg.length, bits = len * 8, total = ((len + 9 + 63) >> 6) << 6; const buf = new Uint8Array(total); buf.set(msg); buf[len] = 0x80;
  const dv = new DataView(buf.buffer); dv.setUint32(total - 8, Math.floor(bits / 2 ** 32)); dv.setUint32(total - 4, bits >>> 0);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]); const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) { const a = w[i - 15], b = w[i - 2]; w[i] = (w[i - 16] + (rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3)) + w[i - 7] + (rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10))) >>> 0; }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  return [...h].map(x => x.toString(16).padStart(8, '0')).join('');
}
export const fingerprint = (content: string | ArrayBuffer | Uint8Array) => sha256(typeof content === 'string' ? content : content instanceof Uint8Array ? content : new Uint8Array(content));

/* ---------- events ---------- */
export type System = 'bir' | 'sss' | 'ph' | 'pi' | 'bank' | 'ewallet' | 'xero' | 'paymongo' | 'stripe' | 'email' | 'import' | 'export';
export const SYSTEMS: System[] = ['bir', 'sss', 'ph', 'pi', 'bank', 'ewallet', 'xero', 'paymongo', 'stripe', 'email', 'import', 'export'];
/**
 * Human in the loop: no file leaves Talaan and no received file takes effect without a second person.
 *  - Outgoing (agency files, bank and e-wallet payouts, Xero journals): requested → authorised (or declined) by someone
 *    other than the requester, for the exact file content (its SHA-256). If the data changes, the authorisation no longer applies.
 *  - Incoming (payroll registers, employee lists, agency receipts): received → accepted (or declined) by someone other than the submitter.
 */
export type IStatus = 'requested' | 'authorised' | 'declined' | 'received' | 'prepared' | 'uploaded' | 'sent' | 'accepted' | 'paid' | 'confirmed' | 'rejected' | 'failed' | 'resolved';
/** Statuses that count as a pass, a failure, or still in progress. */
export const PASS: IStatus[] = ['accepted', 'confirmed', 'resolved'];
export const FAIL: IStatus[] = ['rejected', 'failed'];
export interface IntegrationEvent {
  seq: number; id: string; at: string; system: System; status: IStatus;
  /** What was exchanged: 'R-3', '1601-C', 'MCRF', 'Bank file', 'Manual journal', 'Invoice payment' … */
  doc: string;
  /** The thing it belongs to: a filing key (client|month|kind), a pay run id, an invoice number. */
  subject: string; clientId?: string; period?: string;
  fileName?: string; fileHash?: string; ref?: string; amount?: number; message?: string;
  /** For a corrected attempt: the id of the rejected or failed event it fixes. */
  retryOf?: string; by: string;
  /** For authorised or declined: the id of the request it answers. */
  ofRequest?: string;
  prev: string; hash: string;
}
export type NewEvent = Omit<IntegrationEvent, 'seq' | 'id' | 'prev' | 'hash' | 'at'> & { at?: string };
const GENESIS = '0'.repeat(64);
const canon = (e: Omit<IntegrationEvent, 'hash'>) => JSON.stringify([e.seq, e.id, e.at, e.system, e.status, e.doc, e.subject, e.clientId ?? '', e.period ?? '', e.fileName ?? '', e.fileHash ?? '', e.ref ?? '', e.amount ?? '', e.message ?? '', e.retryOf ?? '', e.by, e.prev, e.ofRequest ?? '']);

/** Appends one event, chained to the last. Never edits or removes earlier events. */
export function appendEvent(log: IntegrationEvent[], e: NewEvent): IntegrationEvent[] {
  const last = log[log.length - 1]; const seq = (last?.seq ?? 0) + 1; const at = e.at ?? new Date().toISOString();
  const base = { ...e, at, seq, id: `ie${seq}-${sha256(at + e.subject + e.status + seq).slice(0, 8)}`, prev: last?.hash ?? GENESIS };
  return [...log, { ...base, hash: sha256(canon(base)) }];
}
/** Checks the whole chain. ok = no event was changed, removed or reordered. */
export function verifyChain(log: IntegrationEvent[]): { ok: boolean; brokenAt?: number; checked: number } {
  let prev = log[0]?.prev ?? GENESIS; // a log may start after older events were archived; it must still link from there on
  for (let i = 0; i < log.length; i++) {
    const e = log[i]; const { hash, ...rest } = e;
    if (e.prev !== prev || sha256(canon(rest)) !== hash || (i > 0 && e.seq !== log[i - 1].seq + 1)) return { ok: false, brokenAt: e.seq, checked: i };
    prev = hash;
  }
  return { ok: true, checked: log.length };
}

/** The latest state of each subject + document + system: what passed, what failed, what is still open. */
export interface BoardRow { system: System; doc: string; subject: string; clientId?: string; period?: string; status: IStatus; at: string; attempts: number; failures: number; lastFailure?: IntegrationEvent; last: IntegrationEvent }
export function board(log: IntegrationEvent[], clientId?: string): BoardRow[] {
  const m = new Map<string, BoardRow>();
  for (const e of log) { if (clientId && e.clientId !== clientId) continue;
    const k = `${e.system}|${e.doc}|${e.subject}`; const r = m.get(k);
    const fail = FAIL.includes(e.status);
    if (!r) m.set(k, { system: e.system, doc: e.doc, subject: e.subject, clientId: e.clientId, period: e.period, status: e.status, at: e.at, attempts: e.status === 'prepared' || e.status === 'sent' ? 1 : 0, failures: fail ? 1 : 0, lastFailure: fail ? e : undefined, last: e });
    else { r.status = e.status; r.at = e.at; r.last = e; if (e.status === 'prepared' || e.status === 'sent') r.attempts++; if (fail) { r.failures++; r.lastFailure = e; } } }
  return [...m.values()].sort((a, b) => b.at.localeCompare(a.at));
}
export const outcome = (s: IStatus): 'pass' | 'fail' | 'open' => PASS.includes(s) ? 'pass' : FAIL.includes(s) || s === 'declined' ? 'fail' : 'open';

/**
 * Where an outgoing file stands. 'authorised' only when enough different people (not the requester) authorised this exact
 * content (same hash) after the latest request, with no rejection since: 1 for exports and Xero, 2 for payout files and
 * government filings (approvals.ts). 'partly' = some but not all authorisations given. Each authorisation's ref holds the duty.
 * 'changed' = the data changed since it was requested or authorised.
 */
export type Release = { state: 'none' | 'requested' | 'partly' | 'authorised' | 'declined' | 'changed'; request?: IntegrationEvent; decision?: IntegrationEvent; approvals: IntegrationEvent[] };
export function releaseState(log: IntegrationEvent[], system: System, doc: string, subject: string, contentHash: string, required = 1): Release {
  const mine = log.filter(e => e.system === system && e.doc === doc && e.subject === subject);
  let from = 0; mine.forEach((e, i) => { if (FAIL.includes(e.status)) from = i + 1; });
  const after = mine.slice(from); const request = [...after].reverse().find(e => e.status === 'requested');
  if (!request) return { state: 'none', approvals: [] };
  const answers = after.filter(e => e.ofRequest === request.id && e.by !== request.by);
  const declined = answers.find(e => e.status === 'declined');
  const seen = new Set<string>(); const approvals = answers.filter(e => e.status === 'authorised' && e.fileHash === request.fileHash && !seen.has(e.by) && seen.add(e.by));
  const decision = declined ?? approvals[approvals.length - 1];
  if (request.fileHash !== contentHash) return { state: 'changed', request, decision, approvals };
  if (declined) return { state: 'declined', request, decision, approvals };
  if (approvals.length >= required) return { state: 'authorised', request, decision, approvals };
  return { state: approvals.length ? 'partly' : 'requested', request, decision, approvals };
}
/** Who may authorise a release or accept a received file: an active firm owner, or the client's own approver, never the requester. */
export function canAuthorise(p: { id: string; role: string; clientId?: string; active?: boolean }, requesterId: string, clientId?: string) {
  return p.active !== false && p.id !== requesterId && (p.role === 'firmOwner' || (p.role === 'client' && !!clientId && p.clientId === clientId));
}

export function eventsCsv(log: IntegrationEvent[], name: (clientId?: string) => string, chain: { ok: boolean; brokenAt?: number }) {
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return '﻿' + [[`Talaan integration log · chain ${chain.ok ? 'verified' : `BROKEN at #${chain.brokenAt}`}`], [],
    ['Seq', 'When (UTC)', 'System', 'Document', 'Client', 'Period', 'Subject', 'Status', 'Outcome', 'Reference', 'Amount', 'File', 'File SHA-256', 'Message', 'Retry of', 'By', 'Hash', 'Previous hash'],
    ...log.map(e => [e.seq, e.at, e.system, e.doc, name(e.clientId), e.period, e.subject, e.status, outcome(e.status), e.ref, e.amount, e.fileName, e.fileHash, e.message, e.retryOf, e.by, e.hash, e.prev])].map(r => r.map(q).join(',')).join('\r\n');
}

/* ---------- alerts ---------- */
export type AlertKind = 'due3' | 'due' | 'overdue' | 'mismatch' | 'rejected' | 'failed' | 'awaiting';
export interface Obligation { key: string; clientId: string; system: System; doc: string; period: string; due: string; done: boolean; expected?: number; paid?: number; mismatchNote?: string }
export interface Person { id: string; role: string; clientId?: string; active?: boolean; email?: string }
export interface Alert { id: string; kind: AlertKind; clientId: string; system: System; doc: string; subject: string; period?: string; since: string; days: number; recipients: string[]; escalated: boolean; message?: string }
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10) + 'T00:00:00Z') - Date.parse(a.slice(0, 10) + 'T00:00:00Z')) / 864e5);
export const ESCALATE_AFTER_DAYS = 2;

/**
 * Notices due today. Each alert id includes its stage (and escalation), so sending is idempotent: keep the ids already
 * sent and send only new ones. Preparer + firm owners always; the client's owner too once escalated.
 */
export function integrationAlerts(obligations: Obligation[], log: IntegrationEvent[], clients: { id: string; assignee?: string }[], people: Person[], today: string): Alert[] {
  const owners = people.filter(p => p.role === 'firmOwner' && p.active !== false).map(p => p.id);
  const to = (clientId: string, escalate: boolean) => { const cl = clients.find(c => c.id === clientId);
    return [...new Set([...(cl?.assignee ? [cl.assignee] : []), ...owners, ...(escalate ? people.filter(p => p.role === 'client' && p.clientId === clientId && p.active !== false).map(p => p.id) : [])])]; };
  const out: Alert[] = []; const rows = board(log);
  for (const o of obligations) {
    if (o.done) continue; const d = dayDiff(today, o.due); // days until due (negative = late)
    const base = { clientId: o.clientId, system: o.system, doc: o.doc, subject: o.key, period: o.period };
    if (d === 3) out.push({ ...base, id: `${o.key}|due3`, kind: 'due3', since: today, days: 3, recipients: to(o.clientId, false), escalated: false });
    else if (d === 0) out.push({ ...base, id: `${o.key}|due`, kind: 'due', since: today, days: 0, recipients: to(o.clientId, false), escalated: false });
    else if (d < 0) { const esc = -d >= ESCALATE_AFTER_DAYS; out.push({ ...base, id: `${o.key}|overdue|${esc ? 'esc' : 'firm'}`, kind: 'overdue', since: o.due, days: -d, recipients: to(o.clientId, esc), escalated: esc }); }
    if (o.paid !== undefined && o.expected !== undefined && Math.abs(o.paid - o.expected) > 0.004 && !o.mismatchNote)
      out.push({ ...base, id: `${o.key}|mismatch|${o.paid}`, kind: 'mismatch', since: today, days: 0, recipients: to(o.clientId, false), escalated: false, message: `paid ${o.paid.toFixed(2)}, expected ${o.expected.toFixed(2)}` });
  }
  // Rejections and failed syncs that have not been followed by a pass on the same subject.
  for (const r of rows) {
    // A failed alert email is logged and counted for Talaan HQ, but never alerts again by email (that would loop).
    if (!FAIL.includes(r.status) || !r.clientId || r.system === 'email') continue; const age = Math.max(0, dayDiff(r.at, today)); const esc = age >= ESCALATE_AFTER_DAYS;
    out.push({ id: `${r.last.id}|${r.status}|${esc ? 'esc' : 'firm'}`, kind: r.status === 'rejected' ? 'rejected' : 'failed', clientId: r.clientId, system: r.system, doc: r.doc, subject: r.subject, period: r.period, since: r.at, days: age, recipients: to(r.clientId, esc), escalated: esc, message: r.last.message });
  }
  // Files waiting for a second person (release authorisation or acceptance of a received file) for a day or more.
  for (const r of rows) {
    if ((r.status !== 'requested' && r.status !== 'received') || !r.clientId) continue; const age = dayDiff(r.at, today); if (age < 1) continue; const esc = age >= ESCALATE_AFTER_DAYS;
    out.push({ id: `${r.last.id}|awaiting|${esc ? 'esc' : 'firm'}`, kind: 'awaiting', clientId: r.clientId, system: r.system, doc: r.doc, subject: r.subject, period: r.period, since: r.at, days: age, recipients: to(r.clientId, esc), escalated: esc, message: r.last.message });
  }
  return out;
}

/** Failures in a window, for Talaan HQ: totals by system, still-open failures, and repeats (same client and system twice or more). */
export function failureSummary(log: IntegrationEvent[], sinceIso: string) {
  const recent = log.filter(e => e.at >= sinceIso && FAIL.includes(e.status));
  const bySystem: Partial<Record<System, number>> = {}; for (const e of recent) bySystem[e.system] = (bySystem[e.system] ?? 0) + 1;
  const pairs = new Map<string, number>(); for (const e of recent) { const k = `${e.clientId ?? ''}|${e.system}`; pairs.set(k, (pairs.get(k) ?? 0) + 1); }
  const repeats = [...pairs].filter(([, n]) => n >= 2).map(([k, n]) => { const [clientId, system] = k.split('|'); return { clientId, system: system as System, n }; });
  const open = board(log).filter(r => FAIL.includes(r.status)).length;
  return { total: recent.length, open, bySystem, repeats };
}

/* ---------- Xero manual journal: the exact content a person authorises, computed the same way in the app and on the server ---------- */
export interface JournalLine { accountCode: string; description: string; amount: number; department?: string }
export const xeroJournalContent = (tenantId: string, date: string, lines: JournalLine[]) =>
  JSON.stringify({ tenantId, date: date.slice(0, 10), lines: lines.map(l => [l.accountCode.trim(), Math.round(l.amount * 100), l.department ?? '']) });
