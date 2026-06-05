import type { AnalysisResult, LatestData, Ticket, WalletFavorite, MLTree, DrawRow } from './types';
import { GAMES } from './config';
import type { GBTree } from './engine/ml';
import type { MarkovChain } from './engine/markov';
import type { ClusterResult } from './engine/cluster';
import { storageGetSync, storageSet } from './storage';

export interface GlobalState {
  view: string;
  game: string;
  selected: Record<string, number[]>;
  history: Record<string, DrawRow[]>;
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
  _cancelled?: boolean;
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

const _histKeys = new Set<string>();

try {
  GAMES.forEach(g => {
    STATE.selected[g.id] = [];
    const h = loadHistorySync(g.id);
    STATE.history[g.id] = h;
    if (h.length) _histKeys.add('hist_' + g.id);
  });

  const c = storageGetSync<Record<string, { sig: string; data: AnalysisResult }>>('analysisCache') || {};
  Object.assign(STATE.analysisCache, c);

  const m = storageGetSync<Record<string, MarkovChain | null>>('markovCache') || {};
  STATE.markovCache = m;

  const cl = storageGetSync<Record<string, ClusterResult | null>>('clusterCache') || {};
  STATE.clusterCache = cl;

  const gb = storageGetSync<Record<string, GBTree[] | null>>('gbForests') || {};
  STATE.gbForests = gb;
} catch {
  STATE.markovCache = {};
  STATE.clusterCache = {};
  STATE.gbForests = {};
}

export function saveAnalysisCache(): void {
  const c: Record<string, { sig: string; data: AnalysisResult }> = {};
  for (const [k, v] of Object.entries(STATE.analysisCache)) {
    c[k] = { sig: v.sig, data: v.data };
  }
  storageSet('analysisCache', c);
}

export function saveMarkovCache(): void {
  storageSet('markovCache', STATE.markovCache || {});
}

export function saveClusterCache(): void {
  storageSet('clusterCache', STATE.clusterCache || {});
}

export function saveGBForests(): void {
  storageSet('gbForests', STATE.gbForests || {});
}

export function saveHistory(id: string): void {
  const key = 'hist_' + id;
  _histKeys.add(key);
  storageSet(key, STATE.history[id] || []);
}

export function saveFavorites(): void {
  storageSet('favorite_wallets', STATE.favorites.slice(0, 40));
}

function loadHistorySync(id: string): DrawRow[] {
  try {
    const raw = localStorage.getItem('hist_' + id);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
