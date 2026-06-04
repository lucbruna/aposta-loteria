import type { AnalysisResult, LatestData, Ticket, WalletFavorite, MLTree } from './types';
import { GAMES } from './config';
import type { GBTree } from './engine/ml';
import type { MarkovChain } from './engine/markov';
import type { ClusterResult } from './engine/cluster';

export interface GlobalState {
  view: string;
  game: string;
  selected: Record<string, number[]>;
  history: Record<string, import('./types').DrawRow[]>;
  latest: Record<string, LatestData>;
  generated: Ticket[];
  budget: Ticket[];
  wheel: Ticket[];
  quick: Ticket[];
  favorites: WalletFavorite[];
  analysisCache: Record<string, { sig: string; data: AnalysisResult }>;
  forests?: Record<string, MLTree[] | null>;
  markovCache?: Record<string, MarkovChain | null>;
  clusterCache?: Record<string, ClusterResult | null>;
  gbForests?: Record<string, GBTree[] | null>;
  _simCount?: number;
}

export const STATE: GlobalState = {
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
  try {
    const c: Record<string, { sig: string; data: AnalysisResult }> = {};
    for (const [k, v] of Object.entries(STATE.analysisCache)) {
      c[k] = { sig: v.sig, data: v.data };
    }
    localStorage.setItem('analysisCache', JSON.stringify(c));
  } catch { /* Worker mode: no localStorage */ }
}

export function saveMarkovCache(): void {
  try { localStorage.setItem('markovCache', JSON.stringify(STATE.markovCache || {})); } catch { /* worker */ }
}

export function saveClusterCache(): void {
  try { localStorage.setItem('clusterCache', JSON.stringify(STATE.clusterCache || {})); } catch { /* worker */ }
}

export function saveGBForests(): void {
  try { localStorage.setItem('gbForests', JSON.stringify(STATE.gbForests || {})); } catch { /* worker */ }
}

export function saveHistory(id: string): void {
  localStorage.setItem('hist_' + id, JSON.stringify(STATE.history[id] || []));
}

export function saveFavorites(): void {
  localStorage.setItem('favorite_wallets', JSON.stringify(STATE.favorites.slice(0, 40)));
}

function loadHistory(id: string): import('./types').DrawRow[] {
  try { return JSON.parse(localStorage.getItem('hist_' + id) || '[]'); } catch { return []; }
}
