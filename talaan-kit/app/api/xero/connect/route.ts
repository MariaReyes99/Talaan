/**
 * Starts "Connect to Xero". Visit /api/xero/connect?org=<firm organisation ID>.
 * Sends the user to Xero's sign-in page with a one-time state value stored in a secure cookie.
 *
 * Before production: replace the ?org= parameter with the signed-in firm from Clerk
 * (const { orgId } = await auth()), so nobody can connect Xero for another firm.
 */
import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { assertTalaanEnv, envErrorResponse, required } from '../../../../lib/env';
import { XERO_AUTHORIZE_URL, XERO_SCOPES } from '../../../../lib/xero';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  let clientId: string, redirectUri: string;
  try { assertTalaanEnv(); clientId = required('XERO_CLIENT_ID'); redirectUri = required('XERO_REDIRECT_URI'); } catch (e) { return envErrorResponse(e); }

  const orgId = new URL(req.url).searchParams.get('org') ?? '';
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(orgId)) return Response.json({ error: 'Missing or invalid org' }, { status: 400 });

  const state = randomBytes(24).toString('base64url');
  const url = new URL(XERO_AUTHORIZE_URL);
  url.search = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirectUri, scope: XERO_SCOPES.join(' '), state }).toString();

  const res = NextResponse.redirect(url.toString());
  res.cookies.set('talaan_xero_state', `${state}.${orgId}`, {
    httpOnly: true, secure: redirectUri.startsWith('https://'), sameSite: 'lax', path: '/api/xero', maxAge: 600,
  });
  return res;
}
