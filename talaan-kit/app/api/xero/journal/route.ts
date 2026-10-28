/**
 * POST /api/xero/journal  { tenantId, subject (pay run id), clientId?, period?, narration, date, lines: [{ accountCode, description, amount, department? }] }
 * Sends a payroll journal to the client's Xero organisation as a DRAFT manual journal, only after a second person has
 * authorised this exact journal (same SHA-256 as the app computes with xeroJournalContent). Every attempt is logged:
 * sent, then accepted (with Xero's journal ID) or failed (with Xero's message); failures alert the firm the next morning.
 */
import { postManualJournal, XeroError } from '../../../../lib/xero';
import { xeroGuard } from '../../../../lib/xero-route';
import { appendServer, getLog } from '../../../../lib/ilog';
import { fingerprint, releaseState, xeroJournalContent, type JournalLine } from '../../../../lib/integrations-core';
import { del, setIfNew } from '../../../../lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const g = await xeroGuard(req, '/api/xero/journal'); if (g instanceof Response) return g; const { who } = g;
  if (who.role !== 'firmOwner' && who.role !== 'preparer') return Response.json({ error: 'Firm staff only' }, { status: 403 });
  let b: { tenantId?: string; subject?: string; clientId?: string; period?: string; narration?: string; date?: string; lines?: JournalLine[] };
  try { b = await req.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const lines = (Array.isArray(b.lines) ? b.lines : []).slice(0, 500).filter(l => l && typeof l.accountCode === 'string' && Number.isFinite(l.amount))
    .map(l => ({ accountCode: l.accountCode, description: String(l.description ?? ''), amount: Number(l.amount), department: typeof l.department === 'string' && l.department ? l.department : undefined }));
  if (!b.tenantId || !b.subject || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.date)) || !lines.length) return Response.json({ error: 'tenantId, subject, date and lines are required' }, { status: 400 });
  if (Math.round(lines.reduce((a, l) => a + l.amount, 0) * 100) !== 0) return Response.json({ error: 'Journal does not balance; nothing was sent to Xero.' }, { status: 422 });
  const hash = fingerprint(xeroJournalContent(b.tenantId, b.date!, lines));
  // One send at a time per journal, so two clicks cannot post it to Xero twice.
  if (!(await setIfNew(`xsend:${who.org}:${b.subject}`, 1, 120))) return Response.json({ error: 'This journal is already being sent' }, { status: 409 });
  try { return await send(who, b as Required<typeof b>, lines, hash); } finally { await del(`xsend:${who.org}:${b.subject}`); }
}

async function send(who: { org: string; sub: string }, b: { tenantId: string; subject: string; clientId?: string; period?: string; narration?: string; date: string }, lines: JournalLine[], hash: string) {
  const log = await getLog(who.org);
  if (log.some(e => e.system === 'xero' && e.subject === b.subject && e.status === 'accepted' && e.fileHash === hash)) return Response.json({ duplicate: true, message: 'Already in Xero' });
  const rel = releaseState(log, 'xero', 'Manual journal', b.subject, hash);
  if (rel.state !== 'authorised') return Response.json({ error: 'A second person must authorise this journal before it is sent', state: rel.state }, { status: 409 });
  const base = { system: 'xero' as const, doc: 'Manual journal', subject: b.subject, clientId: b.clientId, period: b.period, fileHash: hash, by: who.sub };
  await appendServer(who.org, { ...base, status: 'sent', message: b.tenantId });
  try {
    const r = await postManualJournal(who.org, b.tenantId, { narration: String(b.narration ?? 'Payroll'), date: b.date, lines });
    const ev = await appendServer(who.org, { ...base, status: 'accepted', ref: r.journalId, message: `Draft manual journal in Xero (${r.status})` });
    return Response.json({ sent: true, journalId: r.journalId, event: ev.id });
  } catch (e) {
    const msg = e instanceof XeroError ? e.message : 'Xero request failed';
    await appendServer(who.org, { ...base, status: 'failed', message: msg });
    return Response.json({ error: msg, detail: e instanceof XeroError ? e.detail : undefined }, { status: e instanceof XeroError ? e.status : 502 });
  }
}
