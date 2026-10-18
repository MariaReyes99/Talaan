/**
 * Back-translation report for reviewers.
 * Sends each Tagalog and Chinese message to a model (a different model from the
 * one that translated it, where possible), asks for a literal English
 * translation, and writes a CSV: key, English original, translation,
 * back-translation, and a "meaning matches?" verdict for a human to confirm.
 * A native reviewer still signs off; this only points them at likely problems.
 *
 * Run: OPENAI_API_KEY=... npx tsx scripts/back-translate.ts
 * Uses Talaan's own TALAAN_OPENAI_API_KEY (falls back to OPENAI_API_KEY) and REVIEW_MODEL.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import OpenAI from 'openai';

type Tree = { [k: string]: string | Tree };
const flat = (t: Tree, p = ''): [string, string][] =>
  Object.entries(t).flatMap(([k, v]) => (typeof v === 'string' ? [[p + k, v] as [string, string]] : flat(v, `${p}${k}.`)));
const load = (l: string) => new Map(flat(JSON.parse(readFileSync(`messages/${l}.json`, 'utf8'))));

const client = new OpenAI({ apiKey: process.env.TALAAN_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY });
const model = process.env.REVIEW_MODEL ?? 'gpt-4o-mini';
const en = load('en');
const rows: string[][] = [['locale', 'key', 'english', 'translation', 'back_translation', 'verdict', 'reviewer_ok']];

for (const loc of ['tl', 'zh-Hans']) {
  const tr = load(loc);
  const items = [...en.entries()].filter(([k]) => !k.startsWith('meta.')).map(([k, e]) => ({ key: k, english: e, translation: tr.get(k) ?? '' }));
  for (let i = 0; i < items.length; i += 25) {
    const batch = items.slice(i, i + 25);
    const res = await client.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You check UI translations for a Philippine payroll app. For each item, translate "translation" back into English literally, without looking at "english" first. Then compare with "english" and give verdict "same", "minor" (wording differs, meaning same) or "different" (meaning changed, missing or wrong tone). Return JSON {"items":[{"key","back","verdict","note"}]}.' },
        { role: 'user', content: JSON.stringify(batch) },
      ],
    });
    const out = JSON.parse(res.choices[0].message.content ?? '{"items":[]}').items as { key: string; back: string; verdict: string; note?: string }[];
    for (const o of out) {
      const item = batch.find((b) => b.key === o.key); if (!item) continue;
      rows.push([loc, o.key, item.english, item.translation, o.back, `${o.verdict}${o.note ? `: ${o.note}` : ''}`, '']);
    }
  }
}
const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
writeFileSync('translation-review.csv', '\uFEFF' + csv);
console.log(`Wrote translation-review.csv with ${rows.length - 1} rows. Sort by verdict and send "different" rows to the native reviewer first.`);
