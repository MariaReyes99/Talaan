/**
 * Copies Ask Tala's shared code (guardrails, retriever, pipeline), the module entitlements and the corpus from
 * talaan-app into lib/rag, so the browser app, this server and the evals run exactly the same logic.
 * Run after changing talaan-app/src/rag or the corpus: npm run sync:rag (the build runs it too).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
const app = new URL('../../talaan-app/', import.meta.url), out = new URL('../lib/rag/', import.meta.url);
if (!existsSync(new URL('src/rag/retriever.ts', app))) { console.log('talaan-app not found next to the kit: using the committed lib/rag copy.'); process.exit(0); }
mkdirSync(out, { recursive: true });
const head = f => `// GENERATED from talaan-app/${f} by scripts/sync-rag.mjs. Edit the original, then run npm run sync:rag.\n`;
for (const f of ['text.ts', 'retriever.ts', 'guard.ts', 'pipeline.ts']) writeFileSync(new URL(f, out), head(`src/rag/${f}`) + readFileSync(new URL(`src/rag/${f}`, app), 'utf8'));
// entitlements.ts imports a type from model.ts; the kit only needs the module keys.
writeFileSync(new URL('entitlements.ts', out), head('src/entitlements.ts') + readFileSync(new URL('src/entitlements.ts', app), 'utf8').replace("import type { ModuleKey } from './model';", "export type ModuleKey = 'payroll' | 'compliance' | 'books' | 'hr' | 'ai' | 'analytics';"));
const corpus = JSON.parse(readFileSync(new URL('corpus/corpus.json', app), 'utf8')).filter(e => e.product === 'talaan' && e.namespace === 'talaan-ph-payroll');
writeFileSync(new URL('corpus.json', out), JSON.stringify(corpus));
console.log(`Synced Ask Tala code and ${corpus.length} corpus entries into lib/rag.`);
