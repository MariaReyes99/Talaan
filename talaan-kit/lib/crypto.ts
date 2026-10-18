/**
 * Encrypts secrets at rest (such as Xero tokens) with AES-256-GCM.
 * TALAAN_TOKEN_KEY must be 64 hex characters (32 bytes), Talaan's own, generated the same way as IP_HASH_SALT.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { required, TalaanEnvError } from './env';

function key() {
  const hex = required('TALAAN_TOKEN_KEY');
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new TalaanEnvError('TALAAN_TOKEN_KEY must be 64 hex characters (32 bytes).');
  return Buffer.from(hex, 'hex');
}
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}
export function decrypt(token: string): string {
  const [v, iv, tag, data] = token.split('.');
  if (v !== 'v1') throw new Error('Unknown encryption format');
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8');
}
