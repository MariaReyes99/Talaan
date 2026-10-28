/**
 * POST /api/integrations/events  — record one exchange with an outside system (Authorization: Bearer <organisation token>).
 * GET  /api/integrations/events?clientId=  — the log with the chain check (staff: all clients; client users: their company only).
 *
 * The person, role, company and approval duties come from the signed token, never the body. The same double-approval
 * rules as the app (approvals.ts) are enforced here:
 *  - authorised / declined answer a request made by someone else, for the same file (SHA-256). Payout files need payroll
 *    review then finance, government filings review then an authorised signatory, other files one approver; the server
 *    assigns the duty, nobody authorises twice, and client approvers act only for their own company;
 *  - a received file (payroll register, employee list) needs its approvals from people other than the uploader before it
 *    can be accepted; an agency receipt is confirmed by someone other than who attached it;
 *  - an upload to a government portal is recorded only after the filing was authorised;
 *  - employees cannot post; client users may only approve, decline, confirm or upload for their own company.
 * Run-level separation (preparer, final approver, releaser) is checked where the pay run lives (the app; Postgres when it moves there).
 */
import { assertTalaanEnv, envErrorResponse } from '../../../../lib/env';
import { orgFromRequest, type OrgClaims } from '../../../../lib/auth';
import { requireModule } from '../../../../lib/entitlements';
import { appendServer, getLog, verifyChain } from '../../../../lib/ilog';
import { SYSTEMS, canAuthorise, releaseState, type IntegrationEvent, type IStatus, type NewEvent, type System } from '../../../../lib/integrations-core';
import { POLICY, canApprove, nextDuty, type Approval, type Control } from '../../../../lib/approvals-core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const STATUSES: IStatus[] = ['requested', 'authorised', 'declined', 'received', 'prepared', 'uploaded', 'sent', 'accepted', 'paid', 'confirmed', 'rejected', 'failed', 'resolved'];
const GOV: System[] = ['bir', 'sss', 'ph', 'pi'];
const CLIENT_MAY: IStatus[] = ['authorised', 'declined', 'accepted', 'confirmed', 'received'];
const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
const no = (error: string, status = 403) => Response.json({ error }, { status });
/** Which double-approval rule an outgoing file follows: payout files and government filings need two people. */
const releaseControl = (s: System): Control | null => s === 'bank' || s === 'ewallet' ? 'release' : GOV.includes(s) ? 'filing' : null;
const person = (w: OrgClaims) => ({ id: w.sub, role: w.role, clientId: w.clientId, duties: w.duties, active: true });
/** Distinct approvals already given (oldest first), with the duty the server assigns in order. */
const given = (evs: IntegrationEvent[], control: Control | null, exclude: string): Approval[] => {
  const seen = new Set<string>(); const out: Approval[] = [];
  for (const e of evs) if (e.status === 'authorised' && e.by !== exclude && !seen.has(e.by)) { seen.add(e.by); out.push({ by: e.by, at: e.at, duty: control ? POLICY[control][out.length] ?? 'finance' : 'finance' }); }
  return out;
};

export async function POST(req: Request) {
  try { assertTalaanEnv(); } catch (e) { return envErrorResponse(e); }
  const who = orgFromRequest(req); if (!who) return no('Sign in to Talaan first', 401);
  if (who.role === 'employee') return no('Not available');
  const denied = await requireModule(who.org, '/api/integrations/events'); if (denied) return denied;
  let b: Record<string, unknown>; try { b = await req.json(); } catch { return no('Invalid JSON', 400); }
  const system = b.system as System, status = b.status as IStatus, doc = str(b.doc, 120), subject = str(b.subject, 160);
  if (!SYSTEMS.includes(system) || !STATUSES.includes(status) || !doc || !subject) return no('system, status, doc and subject are required', 400);
  const fileHash = str(b.fileHash, 64); if (fileHash && !/^[0-9a-f]{64}$/.test(fileHash)) return no('fileHash must be a SHA-256 hex string', 400);
  const e: NewEvent = { system, status, doc, subject, clientId: str(b.clientId, 64), period: str(b.period, 20), fileName: str(b.fileName, 200), fileHash, ref: str(b.ref, 80),
    amount: typeof b.amount === 'number' && Number.isFinite(b.amount) ? Math.round(b.amount * 100) / 100 : undefined, message: str(b.message, 500), retryOf: str(b.retryOf, 80), ofRequest: str(b.ofRequest, 80), by: who.sub };
  if (who.role === 'client') {
    if (!CLIENT_MAY.includes(status)) return no('Client users can approve, decline, confirm or upload only');
    if (!who.clientId || e.clientId !== who.clientId) return no('Client users act only for their own company');
  } else if (who.role !== 'firmOwner' && who.role !== 'preparer') return no('Not available');
  const log = await getLog(who.org); const me = person(who);

  if (system === 'import' && (status === 'authorised' || status === 'accepted' || status === 'declined')) {
    // Received file: approvals by people other than the uploader; accepted only with all of them.
    const got = [...log].reverse().find(x => x.subject === subject && x.system === 'import' && x.status === 'received'); if (!got) return no('Nothing was received for this item', 409);
    if (got.by === who.sub) return no('Someone other than the uploader must review a received file');
    if (who.role === 'client' && got.clientId !== who.clientId) return no('Client users act only for their own company');
    const control = got.ref === 'payrun' || got.ref === 'bank' || got.ref === 'restore' ? got.ref as Control : null;
    const prior = given(log.slice(log.indexOf(got) + 1).filter(x => x.subject === subject && x.system === 'import'), control, got.by);
    if (prior.some(a => a.by === who.sub)) return no('A different person must give the next approval');
    const ok = control ? canApprove(me, control, { requesters: [got.by], approvals: prior, clientId: got.clientId }) : canAuthorise(me, got.by, got.clientId);
    if (!ok) return no('You do not hold the approval duty for this step');
    const need = control ? POLICY[control].length : 1;
    if (status === 'accepted' && prior.length + 1 < need) return no(`Needs ${need} approvals; give yours as "authorised" first`, 409);
    if (status === 'authorised' && prior.length + 1 >= need) return no('This is the last approval: post it as "accepted"', 409);
    e.ref = control ? nextDuty(control, prior) ?? undefined : undefined; e.clientId = got.clientId; e.ofRequest = undefined;
  } else if (status === 'authorised' || status === 'declined') {
    const reqEv = log.find(x => x.id === e.ofRequest && x.status === 'requested' && x.system === system && x.doc === doc && x.subject === subject); if (!reqEv) return no('No matching request to answer', 409);
    if (reqEv.by === who.sub) return no('You cannot authorise your own request');
    if (who.role === 'client' && reqEv.clientId !== who.clientId) return no('Client users act only for their own company');
    if (status === 'authorised' && reqEv.fileHash !== fileHash) return no('The file changed since it was requested; ask again', 409);
    const control = releaseControl(system);
    const prior = given(log.filter(x => x.ofRequest === reqEv.id), control, reqEv.by);
    if (prior.some(a => a.by === who.sub)) return no('You already authorised this; a different person must give the next approval');
    if (control && prior.length >= POLICY[control].length) return no('Already fully authorised', 409);
    const ok = control ? canApprove(me, control, { requesters: [reqEv.by], approvals: prior, clientId: reqEv.clientId }) : canAuthorise(me, reqEv.by, reqEv.clientId);
    if (!ok) return no('You do not hold the approval duty for this step');
    e.ref = control ? nextDuty(control, prior) ?? undefined : undefined; e.clientId = reqEv.clientId;
  } else if (GOV.includes(system) && status === 'confirmed') {
    const got = [...log].reverse().find(x => x.subject === subject && x.status === 'received'); if (!got) return no('No receipt was attached', 409);
    if (got.by === who.sub) return no('Someone other than the person who attached the receipt must check it');
  } else if (GOV.includes(system) && status === 'uploaded') {
    if (!fileHash || releaseState(log, system, doc, subject, fileHash, POLICY.filing.length).state !== 'authorised') return no('Record the upload after the review and the authorised signatory approved this filing', 409);
  } else if (who.role === 'client' && status !== 'received') return no('Not available');
  try { return Response.json({ event: await appendServer(who.org, e) }); } catch (err) { return no((err as Error).message, 503); }
}

export async function GET(req: Request) {
  try { assertTalaanEnv(); } catch (e) { return envErrorResponse(e); }
  const who = orgFromRequest(req); if (!who) return no('Sign in to Talaan first', 401);
  if (who.role !== 'firmOwner' && who.role !== 'preparer' && who.role !== 'client') return no('Not available');
  const log = await getLog(who.org); const clientId = who.role === 'client' ? who.clientId ?? '__none' : new URL(req.url).searchParams.get('clientId');
  return Response.json({ chain: verifyChain(log), events: clientId ? log.filter(e => e.clientId === clientId) : log });
}
