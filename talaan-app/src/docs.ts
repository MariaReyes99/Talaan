/**
 * Supporting documents (receipts, timesheets, bank templates, IDs, contracts) stored in the browser's
 * IndexedDB, attached to a client, employee, pay run, remittance or corpus source.
 * Prototype only: production stores files in Talaan's own encrypted storage with access control.
 */
export interface DocMeta { id: string; owner: string; kind: string; name: string; size: number; type: string; addedAt: string; addedBy: string }
export const MAX_DOC_BYTES = 10 * 1024 * 1024;
export const ACCEPT_DOCS = '.pdf,.png,.jpg,.jpeg,.webp,.csv,.txt,.xlsx,.xls,.docx,.doc';

const DB = 'talaan-docs', STORE = 'docs';
const memory = new Map<string, { meta: DocMeta; blob: Blob }>();
let dbp: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise(resolve => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => { const os = req.result.createObjectStore(STORE, { keyPath: 'meta.id' }); os.createIndex('owner', 'meta.owner'); };
      req.onsuccess = () => resolve(req.result); req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbp;
}
const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> => {
  const d = await db(); if (!d) return undefined;
  return new Promise((res, rej) => { const r = fn(d.transaction(STORE, mode).objectStore(STORE)); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
};
export async function addDoc(meta: Omit<DocMeta, 'id' | 'addedAt'>, blob: Blob): Promise<DocMeta> {
  const m: DocMeta = { ...meta, id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, addedAt: new Date().toISOString() };
  if (!(await db())) memory.set(m.id, { meta: m, blob }); else await tx('readwrite', s => s.put({ meta: m, blob }));
  return m;
}
export async function listDocs(owner: string): Promise<DocMeta[]> {
  if (!(await db())) return [...memory.values()].filter(x => x.meta.owner === owner).map(x => x.meta);
  const rows = (await tx<{ meta: DocMeta }[]>('readonly', s => s.index('owner').getAll(owner))) ?? [];
  return rows.map(r => r.meta).sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}
export async function getDoc(id: string): Promise<{ meta: DocMeta; blob: Blob } | undefined> {
  if (!(await db())) return memory.get(id);
  return tx('readonly', s => s.get(id));
}
export async function deleteDoc(id: string) { if (!(await db())) memory.delete(id); else await tx('readwrite', s => s.delete(id)); }
