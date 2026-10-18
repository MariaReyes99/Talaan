/** Official sources Talaan watches for changes. Keep in step with Admin → Source watch in the app. */
export interface WatchSource { id: string; agency: string; name: string; url: string; every: 'daily' | 'weekly' | 'monthly' }
export const WATCH_SOURCES: WatchSource[] = [
  { id: 'bir', agency: 'BIR', name: 'BIR revenue issuances', url: 'https://www.bir.gov.ph', every: 'daily' },
  { id: 'sss', agency: 'SSS', name: 'SSS circulars and contribution schedule', url: 'https://www.sss.gov.ph', every: 'weekly' },
  { id: 'philhealth', agency: 'PhilHealth', name: 'PhilHealth circulars', url: 'https://www.philhealth.gov.ph', every: 'weekly' },
  { id: 'pagibig', agency: 'Pag-IBIG', name: 'Pag-IBIG Fund circulars', url: 'https://www.pagibigfund.gov.ph', every: 'weekly' },
  { id: 'nwpc', agency: 'NWPC', name: 'Regional wage orders', url: 'https://nwpc.dole.gov.ph', every: 'daily' },
  { id: 'dole', agency: 'DOLE', name: 'DOLE labor advisories', url: 'https://www.dole.gov.ph', every: 'weekly' },
  { id: 'bsp', agency: 'BSP', name: 'BSP licensed institutions', url: 'https://www.bsp.gov.ph', every: 'monthly' },
];
