/** Tests the source watch with a fake website and in-memory storage. Run: npx tsx scripts/test-watch.ts */
import assert from 'node:assert';
import { checkSource, pageText, type QueueItem } from '../lib/watch';
const store = new Map<string, unknown>();
let page = '<html><script>var t=123</script><h1>Wage orders</h1><p>NCR-28: P755 from 26 Sep 2026</p></html>';
let clock = new Date('2026-10-01T22:00:00Z');
const deps = { fetch: (async () => new Response(page, { status: 200 })) as typeof fetch, now: () => clock,
  get: async <T>(k: string) => (store.get(k) as T) ?? null, set: async (k: string, v: unknown) => { store.set(k, v); } };
const src = { id: 'nwpc', agency: 'NWPC', name: 'Regional wage orders', url: 'https://example.test', every: 'daily' as const };
assert.equal((await checkSource(src, deps)).status, 'first');
clock = new Date('2026-10-01T23:00:00Z'); assert.equal((await checkSource(src, deps)).status, 'skipped', 'not due again within a day');
clock = new Date('2026-10-02T22:00:00Z'); page = page.replace('var t=123', 'var t=999');
assert.equal((await checkSource(src, deps)).status, 'unchanged', 'script changes are ignored');
clock = new Date('2026-10-03T22:00:00Z'); page = page.replace('</p>', '</p><p>Region VII-25: P560 from 1 Nov 2026</p>');
assert.equal((await checkSource(src, deps)).status, 'changed');
const q = store.get('watch:queue') as QueueItem[]; assert.equal(q.length, 1); assert.ok(q[0].summary.includes('Region VII-25'), q[0].summary);
clock = new Date('2026-10-04T22:00:00Z');
assert.equal((await checkSource(src, { ...deps, fetch: (async () => new Response('down', { status: 503 })) as typeof fetch })).status, 'error');
assert.equal(pageText('<p>a&nbsp;&amp; b</p><style>x{}</style>'), 'a & b');
console.log('source watch tests passed; queued:', q[0].summary);
