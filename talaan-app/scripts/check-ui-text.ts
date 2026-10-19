/** Checks that every text key used by the app exists in English, Tagalog and Chinese. Run: npx tsx scripts/check-ui-text.ts */
import { readFileSync, readdirSync } from 'node:fs';
import { DICTS } from '../src/i18n';
const files = ['src/App.tsx', ...readdirSync('src/modules').map(f => 'src/modules/' + f)];
const src = files.map(f => readFileSync(f, 'utf8')).join('\n');
const used = new Set([...src.matchAll(/\bt\(\s*'([A-Za-z0-9_]+)'\s*[,)]/g)].map(m => m[1]));
// keys passed through arrays such as [['runs', 'tabPayRuns'], ...] or t(k)
for (const m of src.matchAll(/'((?:tab|nav|hq|rp_|rpd_|cs_|h_|act_|n_|why2_|role|mod_|modd_|rk_|pk_|pkh_|lk_|sr_|src_|ls_|show_|tk_|tc_|ts_|hs_|hh_|cs2_|view_|fld_|acch_|acc(?=[A-Z]))[A-Za-z0-9_]*)'/g)) used.add(m[1]);
const dyn: Record<string, string[]> = {
  mod_: ['payroll', 'compliance', 'books', 'hr', 'ai', 'analytics'], modd_: ['payroll', 'compliance', 'books', 'hr', 'ai', 'analytics'], rk_: ['regular', 'bonus', 'reimbursement', 'final', 'imported'],
  pk_: ['allowance', 'deMinimis', 'deduction', 'reimbursement'], pkh_: ['allowance', 'deMinimis', 'deduction', 'reimbursement'], lk_: ['sss', 'pagibig', 'company', 'cashAdvance'],
  sr_: ['resigned', 'endContract', 'retired', 'terminated', 'redundancy'], src_: ['talaan', 'external'], ls_: ['pending', 'approved', 'rejected'], show_: ['pending', 'all'], tk_: ['open', 'all'],
  tc_: ['problem', 'question', 'request'], ts_: ['open', 'waiting', 'solved'], hs_: ['draft', 'sent', 'paid', 'overdue'], hh_: ['ok', 'soon', 'late'], cs2_: ['done', 'late', 'soon', 'planned'], view_: ['month', 'list'],
  fld_: ['name', 'position', 'monthlyRate', 'department', 'bankAccount', 'payout', 'tin', 'sss', 'philhealth', 'pagibig', 'hireDate', 'separationDate'], why2_: ['bonus', 'reimbursement', 'final'],
  acch_: ['accSalaries', 'accBonus', 'accEmployer', 'accReimb', 'accSSS', 'accPH', 'accPI', 'accWHT', 'accOther', 'accNet'],
};
for (const [p, xs] of Object.entries(dyn)) for (const x of xs) used.add(p + x);
for (const p of ['payroll', 'hr', 'books', 'analytics', 'hq', 'myleave']) { used.add(`h_${p}_lead`); used.add(`h_${p}_steps`); }
const prefixesOnly = new Set([...Object.keys(dyn), 'tab', 'nav', 'hq', 'act_', 'n_', 'h_', 'cs_', 'rp_', 'rpd_', 'role', 'acc']);
const keys = [...used].filter(k => !prefixesOnly.has(k) && !k.endsWith('_')).sort();
let bad = 0;
for (const lang of ['en', 'tl', 'zh'] as const) { const miss = keys.filter(k => !(k in DICTS[lang])); if (miss.length) { bad += miss.length; console.log(`${lang}: ${miss.length} missing\n  ${miss.join(' ')}`); } }
// placeholders must match across languages
for (const k of keys) { const ph = (s?: string) => [...(s ?? '').matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(','); const e = ph(DICTS.en[k]);
  for (const lang of ['tl', 'zh'] as const) if (DICTS[lang][k] && ph(DICTS[lang][k]) !== e) { bad++; console.log(`${lang}: placeholders differ in ${k}`); } }
console.log(bad ? `${bad} problems` : `UI text OK: ${keys.length} keys in 3 languages`); process.exit(bad ? 1 : 0);
