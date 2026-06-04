import type { DrawRow } from './types';
import { GAMES } from './config';
import type { MarkovChain } from './engine/markov';
import type { ClusterResult } from './engine/cluster';
import type { MLTree } from './types';

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
  forests?: Record<string, MLTree[] | null>;
  markovCache?: Record<string, MarkovChain | null>;
  clusterCache?: Record<string, ClusterResult | null>;
  gbForests?: Record<string, any[] | null>;
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

try {
  GAMES.forEach(g => {
    STATE.selected[g.id] = [];
    STATE.history[g.id] = loadHistory(g.id);
  });

  const c = JSON.parse(localStorage.getItem('analysisCache') || '{}');
  Object.assign(STATE.analysisCache, c);

  const m = JSON.parse(localStorage.getItem('markovCache') || '{}');
  STATE.markovCache = m;

  const cl = JSON.parse(localStorage.getItem('clusterCache') || '{}');
  STATE.clusterCache = cl;

  const gb = JSON.parse(localStorage.getItem('gbForests') || '{}');
  STATE.gbForests = gb;
} catch {
  /* Worker mode: no localStorage, STATE stays with defaults */
  STATE.markovCache = {};
  STATE.clusterCache = {};
  STATE.gbForests = {};
}

export function saveAnalysisCache(): void {
  const c: Record<string, { sig: string; data: any }> = {};
  for (const [k, v] of Object.entries(STATE.analysisCache)) {
    c[k] = { sig: v.sig, data: v.data };
  }
  localStorage.setItem('analysisCache', JSON.stringify(c));
}

export function saveMarkovCache(): void {
  localStorage.setItem('markovCache', JSON.stringify(STATE.markovCache || {}));
}

export function saveClusterCache(): void {
  localStorage.setItem('clusterCache', JSON.stringify(STATE.clusterCache || {}));
}

export function saveGBForests(): void {
  localStorage.setItem('gbForests', JSON.stringify(STATE.gbForests || {}));
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
