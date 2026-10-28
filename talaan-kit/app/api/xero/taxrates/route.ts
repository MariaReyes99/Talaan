/** GET /api/xero/taxrates?tenantId= — tax rate names in the organisation, for the CSV import's *TaxRate column. */
import { getTaxRates } from '../../../../lib/xero';
import { xeroFail, xeroGuard } from '../../../../lib/xero-route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const g = await xeroGuard(req, '/api/xero/taxrates'); if (g instanceof Response) return g;
  const tenantId = new URL(req.url).searchParams.get('tenantId') ?? ''; if (!tenantId) return Response.json({ error: 'Missing tenantId' }, { status: 400 });
  try { return Response.json({ taxRates: await getTaxRates(g.who.org, tenantId) }); } catch (e) { return xeroFail(e); }
}
