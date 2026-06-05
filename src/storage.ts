import { get, set, del, createStore } from 'idb-keyval';
import { deflate, inflate } from 'pako';

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

const COMPRESS_THRESHOLD = 2048; // bytes - compress values larger than this

function compress(val: unknown): unknown {
  const json = JSON.stringify(val);
  if (json.length < COMPRESS_THRESHOLD) return val;
  const compressed = deflate(json);
  return { __c: true, d: Array.from(compressed) };
}

function decompress(val: unknown): unknown {
  if (val && typeof val === 'object' && '__c' in (val as any) && (val as any).__c) {
    const buf = new Uint8Array((val as any).d as number[]);
    const json = inflate(buf, { to: 'string' });
    return JSON.parse(json);
  }
  return val;
}

export async function storageGet<T>(key: string): Promise<T | null> {
  try {
    const val = await get<T>(key, customStore);
    if (val !== undefined) return decompress(val) as T;
  } catch { /* fall through */ }
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch { return null; }
}

export async function storageSet(key: string, value: unknown): Promise<void> {
  const compressed = compress(value);
  try {
    await set(key, compressed, customStore);
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
