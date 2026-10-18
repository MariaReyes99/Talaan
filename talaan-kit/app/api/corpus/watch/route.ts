/**
 * Scheduled source watch (Vercel Cron, see vercel.json). Vercel sends "Authorization: Bearer <CRON_SECRET>".
 * GET            → checks every source that is due and returns a summary
 * GET ?view=queue → returns the review queue
 * Changes go to the review queue only; the corpus is updated by a person in Admin → Source watch.
 */
import { assertTalaanEnv, envErrorResponse, required } from '../../../../lib/env';
import { getJson, setJson } from '../../../../lib/store';
import { checkSource } from '../../../../lib/watch';
import { WATCH_SOURCES } from '../../../../lib/watch-sources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  let secret: string;
  try { assertTalaanEnv(); secret = required('CRON_SECRET'); } catch (e) { return envErrorResponse(e); }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  if (new URL(req.url).searchParams.get('view') === 'queue') return Response.json({ queue: (await getJson('watch:queue')) ?? [] });

  const results = [];
  for (const src of WATCH_SOURCES) results.push(await checkSource(src, { fetch, now: () => new Date(), get: getJson, set: (k, v) => setJson(k, v) }));
  return Response.json({ checkedAt: new Date().toISOString(), results });
}
