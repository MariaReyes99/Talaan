/**
 * Exports corpus/corpus.json as RAG-ready Markdown, one file per entry, with front matter for
 * the search index (agency, source, effective date, check date) plus sources.json.
 * Talaan only: every file carries product: talaan and namespace: talaan-ph-payroll.
 * Load it into Talaan's own vector index. Never load it into another product's index.
 * Run: npm run export:corpus
 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { KB } from '../src/kb';
rmSync('corpus/md', { recursive: true, force: true });
const agency = (src: string) => /SSS|RA 11199|PD 626/.test(src) ? 'SSS' : /PhilHealth|11223/.test(src) ? 'PhilHealth' : /HDMF|Pag-IBIG/.test(src) ? 'Pag-IBIG'
  : /BIR|NIRC|RR /.test(src) ? 'BIR' : /Wage Order|NWPC/.test(src) ? 'NWPC/RTWPB' : /Labor Code|DOLE|PD 851|RA 7641|RA 8187|RA 11210|RA 11861|RA 9262|RA 9710/.test(src) ? 'DOLE' : /10173|NPC/.test(src) ? 'NPC' : 'Talaan';
const sources = new Map<string, { source: string; url: string; agency: string; entries: string[] }>();
for (const e of KB) {
  const ag = agency(e.source);
  const fm = ['---', 'product: talaan', 'namespace: talaan-ph-payroll', `id: ${e.id}`, `category: ${e.category}`, `agency: ${ag}`, `audience: [${e.audience.join(', ')}]`, `source: "${e.source.replace(/"/g, '\\"')}"`,
    `source_url: ${e.sourceUrl || 'none'}`, `effective: ${e.effective}`, `verified: ${e.verified}`, `status: ${e.status}`, `languages: [en, tl, zh-Hans]`, '---'].join('\n');
  const body = (['en', 'tl', 'zh'] as const).map(l => `## ${l === 'en' ? 'English' : l === 'tl' ? 'Tagalog' : '中文'}\n\n**${e.q[l]}**\n\n${e.a[l]}`).join('\n\n');
  mkdirSync(`corpus/md/${e.category}`, { recursive: true });
  writeFileSync(`corpus/md/${e.category}/${e.id}.md`, `${fm}\n\n# ${e.q.en}\n\n${body}\n\nSource: ${e.source}\n`);
  const s = sources.get(e.source) ?? { source: e.source, url: e.sourceUrl, agency: ag, entries: [] }; s.entries.push(e.id); sources.set(e.source, s);
}
writeFileSync('corpus/sources.json', JSON.stringify([...sources.values()], null, 2));
console.log(`Wrote ${KB.length} Markdown files to corpus/md and ${sources.size} sources to corpus/sources.json`);
