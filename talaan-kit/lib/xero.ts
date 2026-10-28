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
/** Local tests only: XERO_API_BASE points the API calls at a mock server (ignored on Vercel). */
const API = !process.env.VERCEL && process.env.XERO_API_BASE ? process.env.XERO_API_BASE.replace(/\/+$/, '') : 'https://api.xero.com';
export const XERO_CONNECTIONS_URL = `${API}/connections`;
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
  // Local tests only: a fixed demo connection, so routes can be tested against the mock server without signing in to Xero.
  if (!process.env.VERCEL && process.env.TALAAN_DEV_XERO_TOKEN) return { tenants: [{ tenantId: 'tenant-demo', tenantName: 'Demo Company (PH)', tenantType: 'ORGANISATION' }], accessToken: process.env.TALAAN_DEV_XERO_TOKEN, refreshToken: '', expiresAt: Date.now() + 3600e3, connectedAt: '' };
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

async function xeroGet<T>(orgId: string, tenantId: string, path: string): Promise<T> {
  const c = await getConnection(orgId); if (!c) throw new XeroError('Xero is not connected for this firm.', 409);
  if (!c.tenants.some(t => t.tenantId === tenantId)) throw new XeroError('This Xero organisation is not part of the firm\'s connection.', 403);
  const res = await fetch(`${API}/api.xro/2.0/${path}`, { headers: { Authorization: `Bearer ${c.accessToken}`, 'xero-tenant-id': tenantId, Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new XeroError(`Xero ${path} lookup failed (${res.status})`, 502);
  return res.json() as Promise<T>;
}
export class XeroError extends Error { constructor(m: string, public status = 502, public detail?: unknown) { super(m); } }
/** Active account codes in the organisation's chart of accounts (scope accounting.settings.read). */
export async function getAccounts(orgId: string, tenantId: string) {
  const j = await xeroGet<{ Accounts: { Code?: string; Name: string; Status: string; Type: string }[] }>(orgId, tenantId, 'Accounts');
  return j.Accounts.filter(a => a.Code && a.Status === 'ACTIVE').map(a => ({ code: a.Code!, name: a.Name, type: a.Type }));
}
/** Tax rate names the organisation uses (for the CSV *TaxRate column). */
export async function getTaxRates(orgId: string, tenantId: string) {
  const j = await xeroGet<{ TaxRates: { Name: string; TaxType: string; Status: string; EffectiveRate?: number }[] }>(orgId, tenantId, 'TaxRates');
  return j.TaxRates.filter(r => r.Status === 'ACTIVE').map(r => ({ name: r.Name, taxType: r.TaxType, rate: r.EffectiveRate ?? 0 }));
}

/**
 * Posts an approved, authorised Talaan payroll journal to Xero as a DRAFT manual journal (a person posts it in Xero).
 * Lines: debits positive, credits negative, netting to zero. Account codes are checked against the organisation's
 * chart of accounts first; department split goes to the "Department" tracking category; amounts carry no tax (NoTax).
 */
export async function postManualJournal(orgId: string, tenantId: string, j: { narration: string; date: string; lines: { accountCode: string; description: string; amount: number; department?: string }[] }) {
  const total = Math.round(j.lines.reduce((a, l) => a + l.amount, 0) * 100);
  if (total !== 0) throw new XeroError('Journal does not balance; nothing was sent to Xero.', 422);
  const codes = new Set((await getAccounts(orgId, tenantId)).map(a => a.code));
  const missing = [...new Set(j.lines.map(l => l.accountCode.trim()).filter(c => !codes.has(c)))];
  if (missing.length) throw new XeroError(`Account codes not found in this Xero organisation: ${missing.join(', ')}`, 422, { missing });
  const c = (await getConnection(orgId))!;
  const res = await fetch(`${API}/api.xro/2.0/ManualJournals`, {
    method: 'POST', signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${c.accessToken}`, 'xero-tenant-id': tenantId, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ManualJournals: [{ Narration: j.narration.slice(0, 500), Date: j.date.slice(0, 10), Status: 'DRAFT', LineAmountTypes: 'NoTax',
      JournalLines: j.lines.map(l => ({ AccountCode: l.accountCode.trim(), Description: l.description.slice(0, 200), LineAmount: Math.round(l.amount * 100) / 100, ...(l.department ? { Tracking: [{ Name: 'Department', Option: l.department }] } : {}) })) }] }),
  });
  if (!res.ok) throw new XeroError(`Xero rejected the journal (${res.status}): ${(await res.text()).slice(0, 300)}`, 502);
  const out = (await res.json()) as { ManualJournals?: { ManualJournalID: string; Status: string }[] };
  return { journalId: out.ManualJournals?.[0]?.ManualJournalID ?? '', status: out.ManualJournals?.[0]?.Status ?? 'DRAFT' };
}
