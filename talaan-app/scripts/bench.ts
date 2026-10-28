/**
 * Micro-benchmarks for Talaan's hot paths (run: npm run bench). Reports the median and 99th percentile time per
 * operation in microseconds, measured in-process (no network). These are the parts that must stay fast as firms and
 * employees grow; the network and database round trip is planned for separately (see talaan-ai/ARCHITECTURE.md).
 */
import { writeFileSync } from 'node:fs';
import { computeLine, EMPTY_HOURS, type Employee } from '../src/engine';
import { KB } from '../src/kb';
import { HybridRetriever } from '../src/rag/retriever';
import { checkInput } from '../src/rag/guard';
import { canOpen } from '../src/entitlements';
import { balanceOf, arStatus } from '../src/receivables';

const e: Employee = { id: 'b', clientId: 'c', name: 'Bench', position: '', monthlyRate: 28000, workdays: 261, tin: '', sss: '', philhealth: '', pagibig: '', bankAccount: '', active: true };
const r = new HybridRetriever(KB);
const qs = ['How much is the SSS contribution?', 'magkano ang 13th month', 'request a vacation leave', '加班工资怎么计算', 'What is the capital of France?'];
let i = 0;
const ops: Record<string, () => unknown> = {
  'payroll line (one employee, one cutoff)': () => computeLine(e, { ...EMPTY_HOURS, otHours: (i++ % 9), ndHours: 4 }, 'semi', 755),
  'leave/timesheet entry validation + access check': () => canOpen('employee', 'myleave', new Set(['hr', 'payroll'])),
  'invoice balance and status': () => arStatus({ no: 'x', customerId: 'c', total: 3180.8, issuedAt: '2026-10-01', dueAt: '2026-10-16', payments: [{ id: 'p', date: '2026-10-10', amount: 1000, method: 'gcash', reference: 'r', by: 'u' }] }, '2026-10-28') && balanceOf({ no: 'x', customerId: 'c', total: 1, issuedAt: '', dueAt: '' }),
  'Ask Tala guardrails (input check)': () => checkInput(qs[i++ % qs.length]),
  'Ask Tala retrieval (65 entries, 3 languages)': () => r.search(qs[i++ % qs.length]),
};
const out: Record<string, { median_us: number; p99_us: number; per_second: number }> = {};
for (const [name, f] of Object.entries(ops)) {
  for (let w = 0; w < 2000; w++) f(); // warm up the JIT
  const t: number[] = []; for (let n = 0; n < 20000; n++) { const s = performance.now(); f(); t.push((performance.now() - s) * 1000); }
  t.sort((a, b) => a - b); const med = t[t.length >> 1], p99 = t[Math.floor(t.length * 0.99)];
  out[name] = { median_us: Math.round(med * 100) / 100, p99_us: Math.round(p99 * 100) / 100, per_second: Math.round(1e6 / Math.max(med, 0.01)) };
}
console.table(out);
writeFileSync(new URL('../../talaan-ai/metrics/bench.json', import.meta.url), JSON.stringify({ at: new Date().toISOString(), node: process.version, results: out }, null, 1));
