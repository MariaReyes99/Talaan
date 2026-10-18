/**
 * Xero OAuth 2.0 and manual journals for Talaan.
 * Uses Xero's granular scopes: apps created on or after 2 March 2026 cannot use the old
 * accounting.transactions scope. Payroll journals need accounting.manualjournals; the chart of
 * accounts needs accounting.settings.read.
 */
import { decrypt, encrypt } from './crypto';
import { required } from './env';
import { getJson, setJson } from './store';

export const XERO_AUTHORIZE_URL = 'https://login.xero.com/identity/connect/authorize';
export const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token';
export const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections';
export const XERO_SCOPES = ['openid', 'profile', 'email', 'offline_access', 'accounting.manualjournals', 'accounting.settings.read'];

export interface XeroTenant { tenantId: string; tenantName: string; tenantType: string }
export interface XeroConnection { tenants: XeroTenant[]; accessToken: string; refreshToken: string; expiresAt: number; connectedAt: string }

const basicAuth = () => 'Basic ' + Buffer.from(`${required('XERO_CLIENT_ID')}:${required('XERO_CLIENT_SECRET')}`).toString('base64');

export async function exchangeCode(code: string) {
  const res = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: required('XERO_REDIRECT_URI') }),
  });
  if (!res.ok) throw new Error(`Xero token exchange failed (${res.status})`);
  return (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
}

export async function listTenants(accessToken: string): Promise<XeroTenant[]> {
  const res = await fetch(XERO_CONNECTIONS_URL, { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error(`Xero connections lookup failed (${res.status})`);
  const rows = (await res.json()) as XeroTenant[];
  return rows.map(r => ({ tenantId: r.tenantId, tenantName: r.tenantName, tenantType: r.tenantType }));
}

const storeKey = (orgId: string) => `xero:org:${orgId}`;
export async function saveConnection(orgId: string, c: XeroConnection) {
  await setJson(storeKey(orgId), encrypt(JSON.stringify(c)));
}
/** Loads a firm's Xero connection, refreshing the access token when it is about to expire. */
export async function getConnection(orgId: string): Promise<XeroConnection | null> {
  const enc = await getJson<string>(storeKey(orgId));
  if (!enc) return null;
  const c = JSON.parse(decrypt(enc)) as XeroConnection;
  if (c.expiresAt - Date.now() > 60_000) return c;
  const res = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: c.refreshToken }),
  });
  if (!res.ok) throw new Error(`Xero token refresh failed (${res.status}); the firm must reconnect Xero.`);
  const t = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
  const next = { ...c, accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: Date.now() + t.expires_in * 1000 };
  await saveConnection(orgId, next);
  return next;
}

/**
 * Posts an approved Talaan payroll journal to Xero as a DRAFT manual journal.
 * Lines: debits positive, credits negative, and they must net to zero.
 */
export async function postManualJournal(orgId: string, tenantId: string, j: { narration: string; date: string; lines: { accountCode: string; description: string; amount: number }[] }) {
  const total = Math.round(j.lines.reduce((a, l) => a + l.amount, 0) * 100);
  if (total !== 0) throw new Error('Journal does not balance; nothing was sent to Xero.');
  const c = await getConnection(orgId);
  if (!c) throw new Error('Xero is not connected for this firm.');
  const res = await fetch('https://api.xero.com/api.xro/2.0/ManualJournals', {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.accessToken}`, 'xero-tenant-id': tenantId, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ManualJournals: [{ Narration: j.narration, Date: j.date, Status: 'DRAFT',
      JournalLines: j.lines.map(l => ({ AccountCode: l.accountCode, Description: l.description, LineAmount: Math.round(l.amount * 100) / 100 })) }] }),
  });
  if (!res.ok) throw new Error(`Xero rejected the journal (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json();
}
