/** GET /api/integrations/hq — failures by firm for Talaan HQ (service token only), from the daily check. */
import { assertTalaanEnv, envErrorResponse } from '../../../../lib/env';
import { serviceOk } from '../../../../lib/auth';
import { listOrgs } from '../../../../lib/ilog';
import { getJson } from '../../../../lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try { assertTalaanEnv(); } catch (e) { return envErrorResponse(e); }
  if (!serviceOk(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const orgs = await listOrgs();
  return Response.json({ firms: await Promise.all(orgs.map(async org => ({ org, ...((await getJson<object>(`ihq:${org}`)) ?? {}) }))) });
}
