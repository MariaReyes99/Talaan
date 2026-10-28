/**
 * Server copy of each organisation's integration log (append-only, hash-chained; rules in integrations-core.ts).
 * Writes take a short per-organisation lock so two events at once cannot fork the chain. The newest 5,000 entries
 * stay in the live key; older ones move to numbered archive keys, kept for audits (BIR requires 10 years of records).
 */
import { appendEvent, verifyChain, type IntegrationEvent, type NewEvent, type Obligation, type Person } from './integrations-core';
import { del, getJson, setIfNew, setJson } from './store';

const LIVE = 5000;
const key = (org: string) => `ilog:${org}`;
export const getLog = async (org: string) => (await getJson<IntegrationEvent[]>(key(org))) ?? [];

async function withLock<T>(org: string, f: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 40; i++) {
    if (await setIfNew(`ilock:${org}`, 1, 10)) { try { return await f(); } finally { await del(`ilock:${org}`); } }
    await new Promise(r => setTimeout(r, 50 + Math.random() * 50));
  }
  throw new Error('Integration log is busy; try again.');
}
export async function appendServer(org: string, e: NewEvent): Promise<IntegrationEvent> {
  return withLock(org, async () => {
    let log = appendEvent(await getLog(org), { ...e, at: new Date().toISOString() });
    if (log.length > LIVE) { const n = ((await getJson<number>(`ilog:${org}:archives`)) ?? 0) + 1; await setJson(`ilog:${org}:archive:${n}`, log.slice(0, log.length - LIVE)); await setJson(`ilog:${org}:archives`, n); log = log.slice(-LIVE); }
    await setJson(key(org), log); await registerOrg(org);
    return log[log.length - 1];
  });
}
export async function registerOrg(org: string) { const orgs = (await getJson<string[]>('ilog:orgs')) ?? []; if (!orgs.includes(org)) await setJson('ilog:orgs', [...orgs, org]); }
export const listOrgs = async () => (await getJson<string[]>('ilog:orgs')) ?? [];
export { verifyChain };

/** What the daily check needs per organisation: obligations, client assignees and people with email addresses. */
export interface Roster { obligations: Obligation[]; clients: { id: string; assignee?: string; name?: string }[]; people: (Person & { name?: string; email?: string })[]; firmName?: string; updatedAt: string }
export const getRoster = (org: string) => getJson<Roster>(`iroster:${org}`);
export const saveRoster = async (org: string, r: Omit<Roster, 'updatedAt'>) => { await setJson(`iroster:${org}`, { ...r, updatedAt: new Date().toISOString() }); await registerOrg(org); };
