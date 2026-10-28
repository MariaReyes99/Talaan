/**
 * Server-side module entitlements. Each organisation (accounting firm or direct employer) has the modules it pays for,
 * saved by the billing webhooks under talaan:entitlements:org:<orgId>. API routes call requireModule() so a firm that
 * has not subscribed to a module cannot use its API, whatever the browser sends.
 */
import { getJson, setJson } from './store';
import { MODULE_MANIFEST, apiAllowed, type ModuleKey } from './rag/entitlements';

export const ALL_MODULES = Object.keys(MODULE_MANIFEST) as ModuleKey[];
export interface Entitlement { orgId: string; modules: ModuleKey[]; status: 'active' | 'trial' | 'past_due' | 'read_only' | 'canceled'; updatedAt: string }

export async function orgEntitlement(orgId: string): Promise<Entitlement | null> {
  if (process.env.TALAAN_DEV_ALL_MODULES === '1' && !process.env.VERCEL) return { orgId, modules: ALL_MODULES, status: 'active', updatedAt: '' };
  return getJson<Entitlement>(`entitlements:org:${orgId}`);
}
export async function saveEntitlement(orgId: string, patch: Partial<Entitlement>) {
  const prev = (await getJson<Entitlement>(`entitlements:org:${orgId}`)) ?? { orgId, modules: [], status: 'trial', updatedAt: '' };
  const modules = (patch.modules ?? prev.modules).filter((m): m is ModuleKey => (ALL_MODULES as string[]).includes(m));
  await setJson(`entitlements:org:${orgId}`, { ...prev, ...patch, modules, orgId, updatedAt: new Date().toISOString() });
}
/** Returns a 402/403 response when the org may not use this API path, or null when it may. */
export async function requireModule(orgId: string | null | undefined, path: string): Promise<Response | null> {
  if (!orgId) return Response.json({ error: 'Missing organisation' }, { status: 401 });
  const e = await orgEntitlement(orgId);
  if (!e || e.status === 'canceled') return Response.json({ error: 'No active Talaan subscription' }, { status: 402 });
  if (!apiAllowed(path, e.modules)) return Response.json({ error: 'This feature is not in your Talaan plan', path }, { status: 403 });
  return null;
}
