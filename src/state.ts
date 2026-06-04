import type { DrawRow } from './types';
import { GAMES } from './config';

export const STATE: {
  view: string;
  game: string;
  selected: Record<string, number[]>;
  history: Record<string, DrawRow[]>;
  latest: Record<string, any>;
  generated: any[];
  budget: any[];
  wheel: any[];
  quick: any[];
  favorites: any[];
  analysisCache: Record<string, { sig: string; data: any }>;
  forests?: Record<string, any[] | null>;
  _simCount?: number;
} = {
  view: 'dashboard',
  game: 'megasena',
  selected: {},
  history: {},
  latest: {},
  generated: [],
  budget: [],
  wheel: [],
  quick: [],
  favorites: [],
  analysisCache: {},
};

GAMES.forEach(g => {
  STATE.selected[g.id] = [];
  STATE.history[g.id] = loadHistory(g.id);
});

try {
  const c = JSON.parse(localStorage.getItem('analysisCache') || '{}');
  Object.assign(STATE.analysisCache, c);
} catch { /* empty */ }

export function saveAnalysisCache(): void {
  const c: Record<string, { sig: string; data: any }> = {};
  for (const [k, v] of Object.entries(STATE.analysisCache)) {
    c[k] = { sig: v.sig, data: v.data };
  }
  localStorage.setItem('analysisCache', JSON.stringify(c));
}

export function saveHistory(id: string): void {
  localStorage.setItem('hist_' + id, JSON.stringify(STATE.history[id] || []));
}

export function saveFavorites(): void {
  localStorage.setItem('favorite_wallets', JSON.stringify(STATE.favorites.slice(0, 40)));
}

function loadHistory(id: string): DrawRow[] {
  try { return JSON.parse(localStorage.getItem('hist_' + id) || '[]'); } catch { return []; }
}
