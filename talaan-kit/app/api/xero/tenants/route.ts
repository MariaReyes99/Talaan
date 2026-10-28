/** GET /api/xero/tenants — the Xero organisations in the firm's connection, to link each client to one. */
import { getConnection } from '../../../../lib/xero';
import { xeroGuard } from '../../../../lib/xero-route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const g = await xeroGuard(req, '/api/xero/tenants'); if (g instanceof Response) return g;
  const c = await getConnection(g.who.org); if (!c) return Response.json({ error: 'Xero is not connected for this firm.' }, { status: 409 });
  return Response.json({ tenants: c.tenants });
}
