import type { Game, DrawRow } from '../types';
import { GAMES } from '../config';
import { generateSet } from '../engine/generate';

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
    const { g, count, strategy, filterMode, seedOffset, hist, simCount } = payload;

    (self as any)._simCount = simCount;
    (self as any).STATE = {
      history: { [g.id]: hist },
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
    };

    const tickets = generateSet(g as any, count, strategy as any, filterMode as any, seedOffset, (pct: number) => {
      self.postMessage({ type: 'progress', payload: pct });
    });

    self.postMessage({ type: 'result', payload: tickets });
  }
};
