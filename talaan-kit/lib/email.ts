/**
 * Sends Talaan's emails (approval requests, pay run processed, remittance recorded, statements) through
 * Resend's HTTP API with Talaan's own key and a verified sending domain.
 * Privacy guard: emails must never carry government ID numbers or bank account numbers; those stay in Talaan.
 */
import { required } from './env';

export interface OutgoingEmail { to: string[]; subject: string; text: string; replyTo?: string }
export type SendResult = { ok: true; id: string } | { ok: false; status: number; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SENSITIVE = [/\b\d{2}-\d{7}-\d\b/, /\b\d{3}-\d{3}-\d{3}(-\d{3,5})?\b/, /\b\d{2}-\d{9}-\d\b/, /\b\d{4}-\d{4}-\d{4}\b/, /\b\d{10,16}\b/];

export function validateEmail(m: OutgoingEmail): string | null {
  if (!Array.isArray(m.to) || !m.to.length || m.to.length > 10 || !m.to.every(x => typeof x === 'string' && EMAIL.test(x))) return 'Invalid recipients';
  if (typeof m.subject !== 'string' || !m.subject.trim() || m.subject.length > 200) return 'Invalid subject';
  if (typeof m.text !== 'string' || !m.text.trim() || m.text.length > 20000) return 'Invalid body';
  if (SENSITIVE.some(r => r.test(`${m.subject}\n${m.text}`))) return 'Email contains ID or account numbers; keep those in Talaan';
  return null;
}

export async function sendEmail(m: OutgoingEmail, deps: { fetch: typeof fetch } = { fetch }): Promise<SendResult> {
  const problem = validateEmail(m); if (problem) return { ok: false, status: 422, error: problem };
  const res = await deps.fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${required('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: required('EMAIL_FROM'), to: m.to, subject: m.subject, text: m.text, ...(m.replyTo ? { reply_to: m.replyTo } : {}) }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!res) return { ok: false, status: 502, error: 'Email service unreachable' };
  if (!res.ok) return { ok: false, status: 502, error: `Email service returned ${res.status}` };
  const j = (await res.json().catch(() => ({}))) as { id?: string };
  return { ok: true, id: j.id ?? '' };
}
