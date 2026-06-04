import { get, set, del, keys, createStore } from 'idb-keyval';

const customStore = createStore('loteria-db', 'state');
let _migrated = false;

async function migrateFromLocal(): Promise<void> {
  if (_migrated) return;
  _migrated = true;
  const localKeys = Object.keys(localStorage);
  for (const k of localKeys) {
    try {
      const v = localStorage.getItem(k);
      if (v) await set(k, JSON.parse(v), customStore);
    } catch { /* skip */ }
  }
}

export async function storageGet<T>(key: string): Promise<T | null> {
  try {
    const val = await get<T>(key, customStore);
    if (val !== undefined) return val;
  } catch { /* fall through */ }
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch { return null; }
}

export async function storageSet(key: string, value: unknown): Promise<void> {
  try {
    await set(key, value, customStore);
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota exceeded */ }
  }
}

export async function storageDel(key: string): Promise<void> {
  try { await del(key, customStore); } catch { /* ignore */ }
  localStorage.removeItem(key);
}

export function storageGetSync<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch { return null; }
}

export function storageSetSync(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
}

migrateFromLocal();
