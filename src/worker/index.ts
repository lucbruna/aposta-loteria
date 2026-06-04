import type { Game, DrawRow } from '../types';
import { GAMES } from '../config';
import { generateSet } from '../engine/generate';
import { STATE } from '../state';

type WorkerPayload = {
  g: Game;
  count: number;
  strategy: string;
  filterMode: string;
  seedOffset: number;
  hist: DrawRow[];
  simCount: number;
};

type WorkerMessage = { type: string; payload: any };

const G = (self as any).GAMES || GAMES;

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, payload } = e.data as { type: string; payload: WorkerPayload };

  if (type === 'generate') {
    try {
      const { g, count, strategy, filterMode, seedOffset, hist, simCount } = payload;

      (self as any)._simCount = simCount;
      Object.assign(STATE, {
        analysisCache: {},
        forests: {},
        markovCache: {},
        clusterCache: {},
        gbForests: {},
        selected: {},
        latest: {},
        generated: [],
        budget: [],
        wheel: [],
        quick: [],
        favorites: [],
      });
      STATE.history[g.id] = hist;

      const tickets = generateSet(g as any, count, strategy as any, filterMode as any, seedOffset, (pct: number) => {
        self.postMessage({ type: 'progress', payload: pct });
      });

      self.postMessage({ type: 'result', payload: tickets });
    } catch (err) {
      self.postMessage({ type: 'error', payload: (err as Error).message || String(err) });
    }
  }
};
