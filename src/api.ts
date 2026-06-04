import type { DrawRow, Ticket } from './types';

const API_BASE = 'http://localhost:3001/api';
let apiAvailable: boolean | null = null;

export async function checkApi(): Promise<boolean> {
  if (apiAvailable !== null) return apiAvailable;
  try {
    const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    apiAvailable = r.ok;
    return apiAvailable;
  } catch {
    apiAvailable = false;
    return false;
  }
}

export function getApiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export async function fetchGames(): Promise<Record<string, unknown>[]> {
  if (!(await checkApi())) return [];
  const r = await fetch(getApiUrl('/games'));
  if (!r.ok) return [];
  return r.json();
}

export async function fetchHistory(gameId: string): Promise<DrawRow[] | null> {
  if (!(await checkApi())) return null;
  try {
    const r = await fetch(getApiUrl(`/history/${gameId}`));
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

export async function pushHistory(gameId: string, draws: DrawRow[]): Promise<boolean> {
  if (!(await checkApi())) return false;
  try {
    const r = await fetch(getApiUrl(`/history/${gameId}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draws }),
    });
    return r.ok;
  } catch { return false; }
}

export async function fetchHistoryCount(gameId: string): Promise<number> {
  if (!(await checkApi())) return 0;
  try {
    const r = await fetch(getApiUrl(`/history/${gameId}/count`));
    if (!r.ok) return 0;
    const data = await r.json() as { count: number };
    return data.count;
  } catch { return 0; }
}

export async function fetchFavorites(): Promise<Record<string, unknown>[]> {
  if (!(await checkApi())) return [];
  try {
    const r = await fetch(getApiUrl('/favorites'));
    if (!r.ok) return [];
    return r.json();
  } catch { return []; }
}

export async function pushFavorite(gameId: string, label: string, tickets: Ticket[]): Promise<boolean> {
  if (!(await checkApi())) return false;
  try {
    const r = await fetch(getApiUrl('/favorites'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, label, tickets }),
    });
    return r.ok;
  } catch { return false; }
}

export async function deleteFavoriteApi(id: number): Promise<boolean> {
  if (!(await checkApi())) return false;
  try {
    const r = await fetch(getApiUrl(`/favorites/${id}`), { method: 'DELETE' });
    return r.ok;
  } catch { return false; }
}

export async function clearFavoritesApi(): Promise<boolean> {
  if (!(await checkApi())) return false;
  try {
    const r = await fetch(getApiUrl('/favorites'), { method: 'DELETE' });
    return r.ok;
  } catch { return false; }
}

export async function pushBacktestResult(gameId: string, params: Record<string, unknown>, results: Record<string, unknown>): Promise<boolean> {
  if (!(await checkApi())) return false;
  try {
    const r = await fetch(getApiUrl('/backtest'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, params, results }),
    });
    return r.ok;
  } catch { return false; }
}

export function setApiAvailable(v: boolean): void {
  apiAvailable = v;
}
