import { t } from '../i18n';
/** Draft pictures are too big for localStorage, so the web keeps them in IndexedDB. */
const DB = 'cami-drafts';
const STORE = 'blobs';

let dbPromise: Promise<IDBDatabase> | null = null;

function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'));
  });
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const tx = (await db()).transaction(STORE, mode);
  const req = fn(tx.objectStore(STORE));
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB error'));
    tx.onabort = () => reject(tx.error ?? new Error(t('drafts.browserFull')));
  });
}

export async function putBlob(key: string, bytes: Uint8Array) {
  await run('readwrite', (s) => s.put(bytes, key));
}

export async function getBlob(key: string): Promise<Uint8Array | null> {
  return (await run<Uint8Array | undefined>('readonly', (s) => s.get(key))) ?? null;
}

export async function deleteBlob(key: string) {
  await run('readwrite', (s) => s.delete(key));
}
