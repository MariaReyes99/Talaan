/** GET /api/xero/accounts?tenantId= — active account codes, to check each client's account mapping before sending journals. */
import { getAccounts } from '../../../../lib/xero';
import { xeroFail, xeroGuard } from '../../../../lib/xero-route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const g = await xeroGuard(req, '/api/xero/accounts'); if (g instanceof Response) return g;
  const tenantId = new URL(req.url).searchParams.get('tenantId') ?? ''; if (!tenantId) return Response.json({ error: 'Missing tenantId' }, { status: 400 });
  try { return Response.json({ accounts: await getAccounts(g.who.org, tenantId) }); } catch (e) { return xeroFail(e); }
}
