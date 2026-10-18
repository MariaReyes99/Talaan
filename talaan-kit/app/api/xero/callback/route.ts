/**
 * Xero sends the user back here after they approve Talaan.
 * Register exactly this address as the Redirect URI in the Talaan Xero app:
 *   https://talaan-ivory.vercel.app/api/xero/callback
 * and set the same value in XERO_REDIRECT_URI.
 */
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { assertTalaanEnv, envErrorResponse, siteUrl } from '../../../../lib/env';
import { exchangeCode, listTenants, saveConnection } from '../../../../lib/xero';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

export async function GET(req: Request) {
  let base: string;
  try { assertTalaanEnv(); base = siteUrl(); } catch (e) { return envErrorResponse(e); }

  const params = new URL(req.url).searchParams;
  const back = (status: string) => {
    const res = NextResponse.redirect(`${base}/en?xero=${status}`);
    res.cookies.set('talaan_xero_state', '', { path: '/api/xero', maxAge: 0 });
    return res;
  };
  if (params.get('error')) return back('denied');

  const cookie = req.headers.get('cookie')?.match(/(?:^|;\s*)talaan_xero_state=([^;]+)/)?.[1] ?? '';
  const [expected, orgId] = decodeURIComponent(cookie).split('.');
  const state = params.get('state') ?? '', code = params.get('code') ?? '';
  if (!expected || !orgId || !state || !same(state, expected)) return Response.json({ error: 'Sign-in expired or did not match. Start again from Connect to Xero.' }, { status: 400 });
  if (!code) return Response.json({ error: 'Missing code from Xero' }, { status: 400 });

  try {
    const t = await exchangeCode(code);
    const tenants = await listTenants(t.access_token);
    await saveConnection(orgId, { tenants, accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: Date.now() + t.expires_in * 1000, connectedAt: new Date().toISOString() });
    return back('connected');
  } catch (e) {
    console.error('Xero callback failed:', (e as Error).message); // never log tokens
    return back('failed');
  }
}
