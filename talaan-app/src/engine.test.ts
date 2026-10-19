import { computeLine, withholding, contributionsMonthly, journal, runChecks, annualTax, yearEnd, EMPTY_HOURS, type Employee } from './engine';
import assert from 'node:assert';
const r2x = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const e: Employee = { id: 'x', clientId: 'c', name: 'T', position: '', monthlyRate: 25000, workdays: 261, tin: '', sss: '', philhealth: '', pagibig: '', bankAccount: '', active: true };
const c = contributionsMonthly(25000);
assert.equal(c.msc, 25000); assert.equal(c.sssEE, 1250); assert.equal(c.sssER, 2500); assert.equal(c.ec, 30);
assert.equal(c.phEE, 625); assert.equal(c.piEE, 200); assert.equal(c.piER, 200);
assert.equal(contributionsMonthly(5260).msc, 5500); assert.equal(contributionsMonthly(4000).msc, 5000); assert.equal(contributionsMonthly(80000).msc, 35000);
assert.equal(contributionsMonthly(8000).phEE, 250);   // floor 10,000
assert.equal(contributionsMonthly(150000).phEE, 2500); // ceiling 100,000
const l = computeLine(e, EMPTY_HOURS, 'semi', 695);
assert.equal(l.gross, 12500); assert.equal(l.sssEE, 625); assert.equal(l.phEE, 312.5); assert.equal(l.piEE, 100);
assert.equal(l.taxable, 11462.5); assert.equal(l.wht, 156.82); // 15% of (11,462.50 − 10,417) = 156.825
// annual cross-check: 24 cutoffs ≈ annual tax on ₱275,100 = ₱3,765
assert.ok(Math.abs(l.wht * 24 - 0.15 * (275100 - 250000)) < 5);
assert.equal(withholding(20000, 'semi'), 937.5 + 0.2 * (20000 - 16667));
const mw = computeLine({ ...e, monthlyRate: 695 * 261 / 12 }, { ...EMPTY_HOURS, otHours: 4 }, 'semi', 695);
assert.ok(mw.mwe); assert.equal(mw.wht, 0);
const j = journal([l, computeLine(e, { ...EMPTY_HOURS, otHours: 10, sssLoan: 500 }, 'semi', 695)]);
const dr = j.reduce((a, r) => a + r[1], 0), cr = j.reduce((a, r) => a + r[2], 0);
assert.ok(Math.abs(dr - cr) < 0.02, `journal balances: ${dr} vs ${cr}`);
// regression: an employee added after a pay run was approved must not break its checks
assert.doesNotThrow(() => runChecks([e, { ...e, id: 'new' }], [l], {}, 'semi', 755, {}));
// e-wallet payout needs a valid mobile number
assert.ok(runChecks([{ ...e, payout: 'gcash', mobile: '0917' }], [{ ...l, empId: 'x' }], {}, 'semi', 1, {}).some(c => c.code === 'badMobile'));
// annual tax table and year-end adjustment
assert.equal(annualTax(250000), 0); assert.equal(annualTax(400000), 22500); assert.equal(annualTax(275100), 3765);
const yr = yearEnd('x', Array(24).fill(l));
assert.equal(yr.taxable, r2x(11462.5 * 24)); assert.equal(yr.taxDue, 3765); assert.ok(Math.abs(yr.difference - (3765 - 156.82 * 24)) < 0.01);
assert.equal(yearEnd('x', [l], 100000).thirteenthExcess, 10000); // only the part above ₱90,000 is taxable
const adj = computeLine(e, { ...EMPTY_HOURS, taxAdjustment: -50 }, 'semi', 695);
assert.equal(adj.wht, 106.82); assert.equal(adj.net, r2x(l.net + 50));
// opening balances from a previous system count toward the year
const op = yearEnd('x', [l], 0, 200000, 9000, 210000); assert.equal(op.taxable, r2x(200000 + 11462.5)); assert.equal(op.withheld, r2x(9000 + 156.82)); assert.equal(op.gross, r2x(210000 + 12500));
// 13th month and bonuses: tax-free up to ₱90,000 a year, no contributions in an off-cycle run
const b1 = computeLine(e, { ...EMPTY_HOURS, bonus: 25000 }, 'semi', 695, { offCycle: true });
assert.equal(b1.basic, 0); assert.equal(b1.sssEE, 0); assert.equal(b1.phEE, 0); assert.equal(b1.piEE, 0);
assert.equal(b1.gross, 25000); assert.equal(b1.taxable, 0); assert.equal(b1.wht, 0); assert.equal(b1.net, 25000);
const b2 = computeLine(e, { ...EMPTY_HOURS, bonus: 30000 }, 'semi', 695, { offCycle: true, ytdBenefits: 80000 });
assert.equal(b2.bonusTaxable, 20000); assert.equal(b2.taxable, 20000); assert.ok(b2.wht > 0);
// reimbursements are added to net pay, never taxed and not part of gross
const rb = computeLine(e, { ...EMPTY_HOURS, reimbursement: 1500 }, 'semi', 695);
assert.equal(rb.gross, l.gross); assert.equal(rb.taxable, l.taxable); assert.equal(rb.net, r2x(l.net + 1500));
// leave conversion: up to 10 days is de minimis, the rest is taxable
const daily = 25000 * 12 / 261;
const lc = computeLine(e, { ...EMPTY_HOURS, leaveConversion: r2x(daily * 15), leaveDays: 15 }, 'semi', 695, { offCycle: true });
assert.ok(Math.abs(lc.taxable - daily * 5) < 0.05, `leave taxable ${lc.taxable}`);
// journal still balances with bonus and reimbursement accounts
const j2 = journal([b2, rb, l]); const d2 = j2.reduce((a, r) => a + r[1], 0), c2 = j2.reduce((a, r) => a + r[2], 0);
assert.ok(Math.abs(d2 - c2) < 0.02, `journal with bonus balances: ${d2} vs ${c2}`);
assert.ok(j2.some(r => r[0] === 'accBonus') && j2.some(r => r[0] === 'accReimb'));
console.log('engine tests passed', { wht: l.wht, net: l.net, journalDr: dr.toFixed(2), journalCr: cr.toFixed(2) });
