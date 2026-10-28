/**
 * Password protection for downloaded files (AES-256-GCM, key from PBKDF2-SHA256, 310,000 iterations).
 * Uses the browser's built-in Web Crypto. The password is never stored or sent anywhere.
 * Output is a small JSON "envelope" (.talaan.json). Agency portals and banks cannot read it:
 * decrypt it in Talaan right before uploading.
 */
export const ENVELOPE_FORMAT = 'talaan-encrypted';
export interface Envelope { format: typeof ENVELOPE_FORMAT; v: 1; alg: 'AES-256-GCM'; kdf: 'PBKDF2-SHA256'; iter: number; salt: string; iv: string; name: string; size: number; created: string; data: string }

const b64 = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), ch => ch.charCodeAt(0));
const toBytes = (d: string | ArrayBuffer | Uint8Array) => typeof d === 'string' ? new TextEncoder().encode(d) : d instanceof Uint8Array ? d : new Uint8Array(d);

async function key(password: string, salt: Uint8Array, iter: number) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Rules for a usable password: at least 12 characters with letters and numbers. */
export function passwordProblems(p: string) {
  const out: string[] = [];
  if (p.length < 12) out.push('length'); if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) out.push('mix');
  return out;
}

export async function encryptFile(name: string, data: string | ArrayBuffer | Uint8Array, password: string): Promise<string> {
  const bytes = toBytes(data); const salt = crypto.getRandomValues(new Uint8Array(16)); const iv = crypto.getRandomValues(new Uint8Array(12)); const iter = 310000;
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource, additionalData: new TextEncoder().encode(name) as BufferSource }, await key(password, salt, iter), bytes as BufferSource));
  const env: Envelope = { format: ENVELOPE_FORMAT, v: 1, alg: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iter, salt: b64(salt), iv: b64(iv), name, size: bytes.length, created: new Date().toISOString(), data: b64(ct) };
  return JSON.stringify(env);
}

export class DecryptError extends Error { constructor(public code: 'not-envelope' | 'wrong-password') { super(code); } }
export async function decryptFile(text: string, password: string): Promise<{ name: string; data: Uint8Array }> {
  let env: Envelope;
  try { env = JSON.parse(text); } catch { throw new DecryptError('not-envelope'); }
  if (env?.format !== ENVELOPE_FORMAT || env.v !== 1 || env.alg !== 'AES-256-GCM') throw new DecryptError('not-envelope');
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) as BufferSource, additionalData: new TextEncoder().encode(env.name) as BufferSource }, await key(password, unb64(env.salt), env.iter), unb64(env.data) as BufferSource);
    return { name: env.name, data: new Uint8Array(pt) };
  } catch { throw new DecryptError('wrong-password'); } // wrong password or tampered file: AES-GCM detects both
}
