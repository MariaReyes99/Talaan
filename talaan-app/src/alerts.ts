/**
 * Turns integration alerts (integrations.ts) into in-app notices and emails, each sent once per stage.
 * The prototype runs this in the browser whenever filings or the integration log change; the live app runs the same
 * rules on the server every morning (talaan-kit /api/cron/integrations), so alerts go out even when nobody is signed in.
 */
import { integrationAlerts, type Alert } from './integrations';
import { obligationsFor, type Email, type Notice, type State } from './model';

type Tr = (k: string, v?: Record<string, string | number>) => string;
export const SYSTEM_NAME: Record<string, string> = { bir: 'BIR', sss: 'SSS', ph: 'PhilHealth', pi: 'Pag-IBIG', bank: 'Bank', ewallet: 'E-wallet', xero: 'Xero', paymongo: 'PayMongo', stripe: 'Stripe', email: 'Email', import: 'Received file', export: 'Data export' };

/** Every alert that applies today (sent or not). */
export function currentAlerts(s: State, todayIso: string): Alert[] {
  const people = s.users.map(u => ({ id: u.id, role: u.role, clientId: u.clientId, active: u.active, email: u.email }));
  return integrationAlerts(obligationsFor(s), s.integrationLog ?? [], s.clients.filter(c => c.active !== false), people, todayIso);
}
/** Alerts not sent yet. */
export const alertsDue = (s: State, todayIso: string) => { const sent = new Set(s.alertsSent ?? []); return currentAlerts(s, todayIso).filter(a => !sent.has(a.id)); };
export const alertKey = (a: Alert) => `al_${a.kind}${a.escalated ? '_esc' : ''}`;
export function alertVars(s: State, a: Alert, monthLabel: (m: string) => string): Record<string, string | number> {
  return { client: s.clients.find(c => c.id === a.clientId)?.name ?? a.clientId, doc: a.doc, month: a.period && /^\d{4}-\d{2}$/.test(a.period) ? monthLabel(a.period) : (a.period ?? ''), days: a.days, msg: a.message ?? '', system: SYSTEM_NAME[a.system] ?? a.system };
}
/** Adds the notices and emails for these alerts and remembers them as sent. Emails go only to people with an address. */
export function applyAlerts(s: State, alerts: Alert[], t: Tr, monthLabel: (m: string) => string, now = new Date()): State {
  const sent = new Set(s.alertsSent ?? []); const fresh = alerts.filter(a => !sent.has(a.id)); if (!fresh.length) return s;
  const at = now.toISOString(); const notices: Notice[] = []; const mails: Email[] = [];
  fresh.forEach((a, i) => {
    const vars = alertVars(s, a, monthLabel); const key = alertKey(a);
    for (const u of a.recipients) notices.push({ id: `al_${now.getTime()}_${i}_${u}`, to: u, at, key, vars, route: { page: 'files', id: 'integrations' } });
    for (const u of a.recipients) { const p = s.users.find(x => x.id === u); if (!p?.email) continue;
      mails.push({ id: `m_al_${now.getTime()}_${i}_${u}`, at, to: [p.email], subject: t('em_alert_subj', { doc: a.doc, client: String(vars.client), month: String(vars.month) }),
        body: t('em_alert_body', { name: p.name, text: t(key, vars), firm: s.billing.firmName }), kind: 'alert', clientId: a.clientId, status: 'queued', by: 'talaan' }); }
  });
  return { ...s, notices: [...notices, ...s.notices].slice(0, 400), outbox: [...mails, ...s.outbox].slice(0, 400), alertsSent: [...sent, ...fresh.map(a => a.id)].slice(-3000) };
}
