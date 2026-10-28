/**
 * Daily integration check (Vercel Cron, 7:00 Manila time). For every organisation: deadlines (3 days before, due today,
 * overdue), amount mismatches, rejections, failed syncs and files waiting for a second person. Each alert is emailed once
 * per stage to the assigned preparer and firm owners, and to the client's approver once escalated (2 days unresolved).
 * Every email sent or failed is itself recorded in the integration log. Also stores a failure summary for Talaan HQ.
 * Vercel sends "Authorization: Bearer <CRON_SECRET>".
 */
import { timingSafeEqual } from 'node:crypto';
import { assertTalaanEnv, envErrorResponse, required } from '../../../../lib/env';
import { appendServer, getLog, getRoster, listOrgs } from '../../../../lib/ilog';
import { integrationAlerts, failureSummary, type Alert } from '../../../../lib/integrations-core';
import { getJson, setJson } from '../../../../lib/store';
import { sendEmail } from '../../../../lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const SYS: Record<string, string> = { bir: 'BIR', sss: 'SSS', ph: 'PhilHealth', pi: 'Pag-IBIG', bank: 'Bank', ewallet: 'E-wallet', xero: 'Xero', paymongo: 'PayMongo', stripe: 'Stripe', email: 'Email', import: 'Received file', export: 'Data export' };
const eq = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

function alertText(a: Alert, client: string) {
  const what = `${SYS[a.system] ?? a.system} ${a.doc}${a.period ? ` (${a.period})` : ''} for ${client}`;
  const line = { due3: `${what} is due in 3 days.`, due: `${what} is due today.`, overdue: `${what} is ${a.days} days overdue.`, mismatch: `${what}: the amount paid does not match (${a.message ?? ''}).`,
    rejected: `${what} was rejected: ${a.message ?? ''}`, failed: `${what} failed: ${a.message ?? ''}`, awaiting: `${what} has waited ${a.days} days for a second person to authorise or review it.` }[a.kind];
  return (a.escalated ? 'Escalated: ' : '') + line;
}

export async function GET(req: Request) {
  let secret: string; try { assertTalaanEnv(); secret = required('CRON_SECRET'); } catch (e) { return envErrorResponse(e); }
  if (!eq(req.headers.get('authorization') ?? '', `Bearer ${secret}`)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); // Philippine date
  const emailOn = !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM; const report: Record<string, { alerts: number; emailed: number; failed: number }> = {};
  for (const org of await listOrgs()) {
    const roster = await getRoster(org); const log = await getLog(org); if (!roster) continue;
    const sent = new Set((await getJson<string[]>(`isent:${org}`)) ?? []);
    const fresh = integrationAlerts(roster.obligations, log, roster.clients, roster.people, today).filter(a => !sent.has(a.id));
    const r = report[org] = { alerts: fresh.length, emailed: 0, failed: 0 };
    for (const a of fresh) {
      const client = roster.clients.find(c => c.id === a.clientId)?.name ?? a.clientId; const text = alertText(a, client);
      const to = a.recipients.map(id => roster.people.find(p => p.id === id)).filter(p => p?.email) as { id: string; name?: string; email: string }[];
      for (const p of to) {
        const res = emailOn ? await sendEmail({ to: [p.email], subject: `Action needed: ${SYS[a.system] ?? a.system} ${a.doc}${a.period ? ` (${a.period})` : ''}`, text: `Hi ${p.name ?? ''},\n\n${text}\n\nOpen Talaan → Compliance → Integration log for the details and history.\n\n${roster.firmName ?? ''} (sent by Talaan)` })
          : { ok: false as const, status: 503, error: 'Email is not set up (RESEND_API_KEY, EMAIL_FROM)' };
        await appendServer(org, { system: 'email', status: res.ok ? 'sent' : 'failed', doc: 'Alert email', subject: `${a.id}|${p.id}`, clientId: a.clientId, period: a.period, ref: res.ok ? res.id : undefined, message: res.ok ? text : `${res.error}. Alert: ${text}`, by: 'talaan' });
        if (res.ok) r.emailed++; else r.failed++;
      }
      sent.add(a.id);
    }
    await setJson(`isent:${org}`, [...sent].slice(-5000));
    await setJson(`ihq:${org}`, { at: new Date().toISOString(), firmName: roster.firmName, ...failureSummary(log, new Date(Date.now() - 30 * 864e5).toISOString()) });
  }
  return Response.json({ date: today, orgs: report });
}
