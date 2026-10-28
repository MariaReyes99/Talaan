/**
 * Small key-value store on Talaan's own Upstash Redis database.
 * Every key is prefixed with "talaan:" as a second safeguard against sharing data with another project.
 * For local testing only, TALAAN_DEV_MEMORY_STORE=1 keeps data in memory (never allowed on Vercel).
 */
import { Redis } from '@upstash/redis';
import { required, TalaanEnvError } from './env';

const PREFIX = 'talaan:';
// One map per process (Next dev loads each route separately; sharing it keeps local tests realistic).
const g = globalThis as unknown as { __talaanMemory?: Map<string, { v: unknown; exp?: number }> };
const memory = (g.__talaanMemory ??= new Map<string, { v: unknown; exp?: number }>());
let redis: Redis | null = null;

function useMemory() {
  if (process.env.TALAAN_DEV_MEMORY_STORE === '1') {
    if (process.env.VERCEL) throw new TalaanEnvError('TALAAN_DEV_MEMORY_STORE is for local testing only. Remove it from Vercel.');
    return true;
  }
  return false;
}
function client() {
  if (!redis) redis = new Redis({ url: required('UPSTASH_REDIS_REST_URL'), token: required('UPSTASH_REDIS_REST_TOKEN') });
  return redis;
}
const k = (key: string) => (key.startsWith(PREFIX) ? key : PREFIX + key);

export async function getJson<T>(key: string): Promise<T | null> {
  if (useMemory()) { const e = memory.get(k(key)); if (!e || (e.exp && e.exp < Date.now())) return null; return e.v as T; }
  return (await client().get<T>(k(key))) ?? null;
}
export async function setJson(key: string, value: unknown, ttlSeconds?: number) {
  if (useMemory()) { memory.set(k(key), { v: value, exp: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined }); return; }
  if (ttlSeconds) await client().set(k(key), value, { ex: ttlSeconds }); else await client().set(k(key), value);
}
/** Stores a value only if the key is new. Returns false if it already existed (used to skip repeated webhooks). */
export async function setIfNew(key: string, value: unknown, ttlSeconds: number) {
  if (useMemory()) { if (await getJson(key)) return false; await setJson(key, value, ttlSeconds); return true; }
  return (await client().set(k(key), value, { nx: true, ex: ttlSeconds })) === 'OK';
}
/** Removes a key (used to release short locks). */
export async function del(key: string) {
  if (useMemory()) { memory.delete(k(key)); return; }
  await client().del(k(key));
}
