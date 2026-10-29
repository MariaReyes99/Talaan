/**
 * Talaan module entitlements: which screens and features each subscribed module unlocks, which modules
 * depend on others, and which persona may open which screen. One place decides access, so a client that
 * pays only for Compliance never reaches Payroll screens (by menu, search, link or saved route), and the
 * server routes (talaan-kit) apply the same rules.
 */
import type { ModuleKey } from './model';

export type Page = 'home' | 'clients' | 'client' | 'payruns' | 'run' | 'files' | 'payslips' | 'ask' | 'faqs' | 'plans' | 'connections' | 'admin' | 'billing'
  | 'payroll' | 'hr' | 'books' | 'analytics' | 'hq' | 'myleave' | 'invoices';
export type Persona = 'firmOwner' | 'preparer' | 'client' | 'employee' | 'talaanAdmin';

export interface ModuleSpec {
  /** Screens this module unlocks. */
  pages: Page[];
  /** Features, for the Plans page, the server API and tests. */
  features: string[];
  /** At least one of these must also be on for the module to have data to work with. */
  needsAnyOf?: ModuleKey[];
  /** Server API routes in talaan-kit that require this module. */
  api?: string[];
}

export const MODULE_MANIFEST: Record<ModuleKey, ModuleSpec> = {
  payroll: { pages: ['payruns', 'run', 'payroll', 'payslips'], features: ['payRuns', 'payItems', 'payTemplates', 'loans', 'bonusAnd13thMonth', 'reimbursements', 'finalPay', 'payslips', 'bankAndEwalletFiles', 'certificateOfEmployment'] },
  compliance: { pages: ['files'], features: ['sssR3', 'sssMl2', 'sssR1a', 'philhealthRf1', 'philhealthEr2', 'pagibigMcrf', 'pagibigStlrf', 'bir1601c', 'bir1604c', 'birAlphalist', 'bir2316', 'remittanceTracking', 'deadlineCalendar', 'importPayroll'] },
  hr: { pages: ['hr', 'myleave'], features: ['employeeRecords', 'leaveRequests', 'leaveBalances', 'changeHistory', 'statutoryLeaveTypes'] },
  books: { pages: ['books'], features: ['accountMapping', 'journalPreview', 'xeroJournal', 'genericJournalCsv', 'departmentSplit'], needsAnyOf: ['payroll', 'compliance'], api: ['/api/xero/journal', '/api/xero/accounts', '/api/xero/taxrates', '/api/xero/tenants'] },
  ai: { pages: ['ask'], features: ['askTala', 'citedAnswers', 'guardrails'], api: ['/api/ask'] },
  analytics: { pages: ['analytics'], features: ['dashboard', 'reports'], needsAnyOf: ['payroll', 'compliance'] },
};

/** Screens every persona reaches regardless of modules (subject to persona rules below). */
const CORE: Page[] = ['home', 'clients', 'client', 'faqs', 'plans', 'connections', 'billing', 'admin', 'hq', 'invoices'];

/** Screens each persona may open at all. */
export const PERSONA_PAGES: Record<Persona, Page[] | 'all-firm'> = {
  firmOwner: 'all-firm',
  preparer: 'all-firm',
  client: ['home', 'clients', 'client', 'payruns', 'run', 'files', 'hr', 'books', 'analytics', 'ask', 'faqs', 'plans', 'connections', 'invoices'],
  employee: ['payslips', 'myleave', 'faqs', 'ask'],
  talaanAdmin: ['hq', 'faqs'],
};
const FIRM_ONLY: Partial<Record<Page, Persona[]>> = { admin: ['firmOwner'], billing: ['firmOwner', 'preparer'], hq: ['talaanAdmin'], invoices: ['client', 'firmOwner', 'preparer'] };

/** The module a page belongs to, or null for core pages. */
export function moduleOf(page: Page): ModuleKey | null {
  for (const [m, spec] of Object.entries(MODULE_MANIFEST) as [ModuleKey, ModuleSpec][]) if (spec.pages.includes(page)) return m;
  return null;
}

export type Access = { ok: true } | { ok: false; reason: 'persona' | 'module'; module?: ModuleKey };
/**
 * Whether a persona may open a page, given the modules switched on for the clients they can see.
 * Employees and client owners see only their own company's modules; firm staff see the union of their clients'.
 */
export function canOpen(persona: Persona, page: Page, enabled: Set<ModuleKey>): Access {
  const allowed = PERSONA_PAGES[persona];
  if (allowed !== 'all-firm' && !allowed.includes(page)) return { ok: false, reason: 'persona' };
  if (allowed === 'all-firm' && page === 'hq') return { ok: false, reason: 'persona' };
  const only = FIRM_ONLY[page]; if (only && !only.includes(persona)) return { ok: false, reason: 'persona' };
  if (CORE.includes(page) || page === 'faqs') return { ok: true };
  const m = moduleOf(page);
  if (m && !enabled.has(m)) return { ok: false, reason: 'module', module: m };
  return { ok: true };
}

/** Modules a module needs before it is useful; returns what is missing. */
export function missingDependencies(m: ModuleKey, enabled: ModuleKey[]): ModuleKey[] {
  const need = MODULE_MANIFEST[m].needsAnyOf; if (!need) return [];
  return need.some(x => enabled.includes(x)) ? [] : need;
}

/** Turning a module off must not leave another module without its data source. Returns modules that would break. */
export function dependents(m: ModuleKey, enabled: ModuleKey[]): ModuleKey[] {
  const after = enabled.filter(x => x !== m);
  return after.filter(x => missingDependencies(x, after).length > 0);
}

/** Whether a server API path is covered by the org's modules. */
export function apiAllowed(path: string, enabled: ModuleKey[]): boolean {
  for (const [m, spec] of Object.entries(MODULE_MANIFEST) as [ModuleKey, ModuleSpec][]) if (spec.api?.some(p => path.startsWith(p))) return enabled.includes(m);
  return true;
}
