/**
 * Bank and e-wallet payout files built from a per-client template, so a firm can match its bank's
 * exact layout without code. Presets are starting points only: each must be matched to the template
 * the client's bank provides, then marked verified after a successful test upload.
 */
import type { Employee, Line } from './engine';
import { r2 } from './engine';
import type { BankTemplate } from './model';

export const BANK_PRESETS: Record<string, BankTemplate> = {
  'Generic CSV': { name: 'Generic CSV', delimiter: ',', header: true, amount: 'decimal', date: 'YYYY-MM-DD', trailer: true,
    columns: [{ field: 'account', label: 'Account number' }, { field: 'name', label: 'Employee name' }, { field: 'amount', label: 'Amount' }, { field: 'date', label: 'Credit date' }] },
  'Fixed-width text': { name: 'Fixed-width text', delimiter: 'fixed', header: false, amount: 'centavos', date: 'MMDDYYYY', trailer: true,
    columns: [{ field: 'account', label: 'Account number', width: 16 }, { field: 'amount', label: 'Amount (centavos)', width: 15 }, { field: 'name', label: 'Employee name', width: 40 }, { field: 'date', label: 'Credit date', width: 8 }] },
  'Pipe-delimited': { name: 'Pipe-delimited', delimiter: '|', header: true, amount: 'decimal', date: 'MM/DD/YYYY', trailer: false,
    columns: [{ field: 'reference', label: 'Reference' }, { field: 'account', label: 'Account number' }, { field: 'name', label: 'Employee name' }, { field: 'amount', label: 'Amount' }] },
  'GCash bulk payout': { name: 'GCash bulk payout', delimiter: ',', header: true, amount: 'decimal', date: 'YYYY-MM-DD', trailer: false,
    columns: [{ field: 'account', label: 'Mobile number' }, { field: 'name', label: 'Recipient name' }, { field: 'amount', label: 'Amount' }, { field: 'reference', label: 'Note' }] },
  'Maya bulk payout': { name: 'Maya bulk payout', delimiter: ',', header: true, amount: 'decimal', date: 'YYYY-MM-DD', trailer: false,
    columns: [{ field: 'account', label: 'Mobile number' }, { field: 'name', label: 'Recipient name' }, { field: 'amount', label: 'Amount' }, { field: 'reference', label: 'Reference' }] },
};

const fmtDate = (d: string, f: BankTemplate['date']) => { const [y, m, dd] = d.split('-'); return f === 'YYYY-MM-DD' ? d : f === 'MM/DD/YYYY' ? `${m}/${dd}/${y}` : `${m}${dd}${y}`; };
const clean = (s: string) => s.normalize('NFKD').replace(/[^\x20-\x7E]/g, '').replace(/[|,"\t]/g, ' ').trim();

export function buildPayoutFile(t: BankTemplate, lines: Line[], emps: Employee[], o: { payDate: string; reference: string; method: 'bank' | 'gcash' | 'maya' }) {
  const rows = lines.map(l => ({ l, e: emps.find(x => x.id === l.empId)! })).filter(r => (r.e.payout ?? 'bank') === o.method && r.l.net > 0);
  const val = (c: BankTemplate['columns'][number], r: typeof rows[number]) => {
    switch (c.field) {
      case 'account': return (o.method === 'bank' ? r.e.bankAccount : r.e.mobile ?? '').replace(/\D/g, '');
      case 'name': return clean(r.e.name).toUpperCase();
      case 'amount': return t.amount === 'centavos' ? String(Math.round(r.l.net * 100)) : r.l.net.toFixed(2);
      case 'date': return fmtDate(o.payDate, t.date);
      case 'reference': return clean(o.reference);
      default: return c.literal ?? '';
    }
  };
  const fixed = (c: BankTemplate['columns'][number], v: string) => { const w = c.width ?? 20; return c.field === 'amount' || c.field === 'account' ? v.slice(-w).padStart(w, '0') : v.slice(0, w).padEnd(w, ' '); };
  const join = (vals: string[]) => t.delimiter === 'fixed' ? vals.join('') : vals.join(t.delimiter === '\t' ? '\t' : t.delimiter);
  const out: string[] = [];
  if (t.header && t.delimiter !== 'fixed') out.push(join(t.columns.map(c => c.label)));
  for (const r of rows) out.push(join(t.columns.map(c => t.delimiter === 'fixed' ? fixed(c, val(c, r)) : val(c, r))));
  const total = r2(rows.reduce((a, r) => a + r.l.net, 0));
  if (t.trailer) out.push(t.delimiter === 'fixed' ? `T${String(rows.length).padStart(6, '0')}${String(Math.round(total * 100)).padStart(15, '0')}` : join(['TOTAL', String(rows.length), total.toFixed(2)]));
  return { text: out.join('\r\n'), count: rows.length, total };
}
