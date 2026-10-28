/** Shared checks for the Xero API routes: signed-in organisation, Books module, and a tenant from the firm's own connection. */
import { assertTalaanEnv, envErrorResponse } from './env';
import { orgFromRequest, type OrgClaims } from './auth';
import { requireModule } from './entitlements';
import { XeroError } from './xero';

export async function xeroGuard(req: Request, path: string): Promise<{ who: OrgClaims } | Response> {
  try { assertTalaanEnv(); } catch (e) { return envErrorResponse(e); }
  const who = orgFromRequest(req); if (!who) return Response.json({ error: 'Sign in to Talaan first' }, { status: 401 });
  if (who.role === 'employee') return Response.json({ error: 'Not available' }, { status: 403 });
  const denied = await requireModule(who.org, path); if (denied) return denied;
  return { who };
}
export const xeroFail = (e: unknown) => e instanceof XeroError ? Response.json({ error: e.message, detail: e.detail }, { status: e.status }) : Response.json({ error: 'Xero request failed' }, { status: 502 });
