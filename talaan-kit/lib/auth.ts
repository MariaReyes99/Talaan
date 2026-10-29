/**
 * Who is calling. API routes never trust an organisation ID sent in the request body.
 *  - Users: a short-lived organisation token "<payload>.<signature>" (HMAC-SHA256 with ORG_TOKEN_SECRET), issued by
 *    Talaan's sign-in (session) for the person's own firm or company, sent as "Authorization: Bearer <token>".
 *  - Talaan's own services (NeMo Guardrails server, billing jobs): "x-talaan-service: <TALAAN_SERVICE_TOKEN>".
 * Both comparisons are constant-time.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { required } from './env';

const eq = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

export function serviceOk(req: Request) {
  const token = process.env.TALAAN_SERVICE_TOKEN; const got = req.headers.get('x-talaan-service') ?? '';
  return !!token && token.length >= 16 && eq(got, token);
}

/** Token claims from Talaan sign-in. clientId: the company of a client user. duties: approval duties approved in Talaan (approvals.ts). */
export interface OrgClaims { org: string; sub: string; role: string; exp: number; clientId?: string; duties?: ('review' | 'finance' | 'signatory' | 'config' | 'security')[] }
export function issueOrgToken(c: Omit<OrgClaims, 'exp'>, ttlSeconds = 3600) {
  const payload = Buffer.from(JSON.stringify({ ...c, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString('base64url');
  return `${payload}.${createHmac('sha256', required('ORG_TOKEN_SECRET')).update(payload).digest('base64url')}`;
}
export function orgFromRequest(req: Request): OrgClaims | null {
  const m = /^Bearer ([\w-]+)\.([\w-]+)$/.exec(req.headers.get('authorization') ?? ''); if (!m) return null;
  const want = createHmac('sha256', required('ORG_TOKEN_SECRET')).update(m[1]).digest('base64url');
  if (!eq(m[2], want)) return null;
  try { const c = JSON.parse(Buffer.from(m[1], 'base64url').toString()) as OrgClaims; return c.exp > Date.now() / 1000 && c.org ? c : null; } catch { return null; }
}
/** A salted hash of the caller's IP, for rate limits without storing IP addresses. */
export function ipKey(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  return createHash('sha256').update(required('IP_HASH_SALT') + ip).digest('hex').slice(0, 24);
}
