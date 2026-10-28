/**
 * Employee BIR Form 2316 summary as a PDF, built from approved pay runs.
 * This is a checking copy with the 2316 amounts; the signed certificate uses the official BIR Form 2316.
 */
import { jsPDF } from 'jspdf';
import type { Employee, Line, YearEnd } from './engine';
import { r2 } from './engine';
import type { EmployerIds } from './model';

const peso = (n: number) => 'PHP ' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function form2316Pdf(o: { e: Employee; y: YearEnd; lines: Line[]; year: number; employer: { name: string; ids: EmployerIds } }) {
  const { e, y, lines, year, employer } = o;
  const sum = (f: (l: Line) => number) => r2(lines.reduce((a, l) => a + f(l), 0));
  const contrib = sum(l => l.sssEE + l.phEE + l.piEE);
  const deMin = sum(l => l.deMinimis);
  const mweBasic = y.mwe ? sum(l => l.basic - l.absences) : 0;
  const mwePremiums = y.mwe ? sum(l => l.ot + l.nd + l.holiday + l.special + l.restDay) : 0;
  const taxableBasic = y.mwe ? 0 : sum(l => l.basic - l.absences);
  const taxableOther = y.mwe ? sum(l => l.taxableAllowance) : sum(l => l.ot + l.nd + l.holiday + l.special + l.restDay + l.taxableAllowance);

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(); let yy = 48;
  const line = () => { doc.setDrawColor(200); doc.line(40, yy, W - 40, yy); yy += 14; };
  const h = (t: string) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(t, 40, yy); yy += 16; doc.setFont('helvetica', 'normal'); doc.setFontSize(10); };
  const row = (label: string, value: string, bold = false) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.text(label, 48, yy); doc.text(value, W - 48, yy, { align: 'right' }); yy += 15; };

  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text('BIR Form 2316 summary', 40, yy); yy += 18;
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text(`Certificate of Compensation Payment / Tax Withheld, calendar year ${year}`, 40, yy); yy += 14;
  doc.setTextColor(150, 60, 0); doc.text('Checking copy prepared by Talaan. Issue the signed official BIR Form 2316 to the employee.', 40, yy); doc.setTextColor(0); yy += 18; line();

  h('Part I. Employee'); row('Name', e.name); row('TIN', e.tin); row('Date of birth', e.birthDate ?? '-'); row('Minimum wage earner', y.mwe ? 'Yes' : 'No'); line();
  h('Part II. Present employer'); row('Name', employer.name); row('TIN', employer.ids.tin); row('RDO', employer.ids.rdo); row('Address', employer.ids.address); line();
  h('Part IV-A. Summary');
  row('Gross compensation income from present employer', peso(y.gross));
  row('Less: total non-taxable/exempt compensation', peso(y.nonTaxable));
  row('Taxable compensation income from present employer', peso(y.taxable));
  row('Add: taxable compensation from previous employer', peso(0));
  row('Gross taxable compensation income', peso(y.taxable), true);
  row('Tax due', peso(y.taxDue));
  row('Taxes withheld by present employer', peso(y.withheld));
  row(y.difference >= 0 ? 'Still to collect in the last pay run' : 'To refund in the last pay run', peso(Math.abs(y.difference)));
  row('Total taxes withheld as adjusted', peso(r2(y.withheld + y.difference)), true); line();
  h('Part IV-B. Details of compensation');
  doc.setFont('helvetica', 'italic'); doc.text('Non-taxable / exempt', 48, yy); yy += 15; doc.setFont('helvetica', 'normal');
  row('Basic salary of minimum wage earner', peso(mweBasic));
  row('Holiday, overtime, night differential and hazard pay (MWE)', peso(mwePremiums));
  row('13th month pay and other benefits (up to PHP 90,000)', peso(Math.max(0, r2(y.gross - y.taxable - contrib - deMin - mweBasic - mwePremiums))));
  row('De minimis benefits', peso(deMin));
  row('SSS, PhilHealth, Pag-IBIG contributions and union dues (employee share)', peso(contrib));
  doc.setFont('helvetica', 'italic'); doc.text('Taxable', 48, yy); yy += 15; doc.setFont('helvetica', 'normal');
  row('Basic salary', peso(taxableBasic));
  row('Overtime, premiums, allowances and other taxable pay', peso(taxableOther));
  row('13th month pay and other benefits above PHP 90,000', peso(y.thirteenthExcess)); line();
  doc.setFontSize(8); doc.setTextColor(110);
  doc.text(`Based on ${lines.length} approved pay run(s) in Talaan. Rates and tables must be confirmed by a CPA before production use.`, 40, yy);
  return doc.output('arraybuffer');
}
