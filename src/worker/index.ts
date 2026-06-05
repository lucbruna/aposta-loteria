import type { Game, DrawRow } from '../types';
import { generateSet } from '../engine/generate';
import { STATE } from '../state';
import { captureError } from '../logger';

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

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, payload } = e.data as { type: string; payload: WorkerPayload };

  if (type === 'generate') {
    try {
      const { g, count, strategy, filterMode, seedOffset, hist, simCount } = payload;

      STATE._simCount = simCount;
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
      captureError('worker:generate', err);
      self.postMessage({ type: 'error', payload: (err as Error).message || String(err) });
    }
  }
};
