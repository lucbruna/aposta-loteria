import type { Game, DrawRow } from '../types';
import { range } from '../utils';

export interface MarkovChain {
  transition: Map<string, number>;
  counts: Map<string, number>;
  total: number;
  sig: string;
}

export function buildMarkov(g: Game, hist: DrawRow[]): MarkovChain | null {
  if (hist.length < 10) return null;
  const sig = `${g.id}:${hist.length}:${hist[0]?.raw || ''}:${hist[hist.length - 1]?.raw || ''}`;
  const nums = range(g);
  const transition = new Map<string, number>();
  const counts = new Map<string, number>();

  nums.forEach(a => nums.forEach(b => {
    if (a === b) return;
    const k = a + '-' + b;
    transition.set(k, 0);
    counts.set(k, 0);
  }));

  for (let i = 0; i < hist.length - 1; i++) {
    const curr = new Set(hist[i].main);
    const next = new Set(hist[i + 1].main);
    curr.forEach(a => {
      const ca = (counts.get(a + '-' + a) || 0) + 1;
      counts.set(a + '-' + a, ca);
      next.forEach(b => {
        if (a === b) return;
        const k = a + '-' + b;
        transition.set(k, (transition.get(k) || 0) + 1);
        counts.set(k, (counts.get(k) || 0) + 1);
      });
    });
  }

  return { transition, counts, total: hist.length, sig };
}

export function markovScore(g: Game, pick: number[], markov: MarkovChain): number {
  if (!markov) return 50;
  let score = 0;
  let pairs = 0;
  const alpha = 0.5;
  let maxPossible = 0;
  for (let i = 0; i < pick.length; i++) {
    for (let j = 0; j < pick.length; j++) {
      if (i === j) continue;
      const k = pick[i] + '-' + pick[j];
      const t = markov.transition.get(k) || 0;
      const c = markov.counts.get(k) || 0;
      const smoothed = (t + alpha) / (c + alpha * 2);
      score += smoothed;
      maxPossible += 1;
      pairs++;
    }
  }
  const avg = score / Math.max(pairs, 1);
  return Math.round(Math.min(99, avg * 100 * (maxPossible / Math.max(pairs, 1))));
}

export function markovTransitions(g: Game, hist: DrawRow[]): Map<number, number> | null {
  if (hist.length < 10) return null;
  const last = new Set(hist[hist.length - 1].main);
  const nums = range(g);
  const result = new Map<number, number>();

  let totalTransitions = 0;
  const raw = new Map<number, number>();

  for (let i = 0; i < hist.length - 1; i++) {
    const curr = new Set(hist[i].main);
    const next = new Set(hist[i + 1].main);
    if ([...curr].some(n => last.has(n))) {
      next.forEach(n => {
        raw.set(n, (raw.get(n) || 0) + 1);
        totalTransitions++;
      });
    }
  }

  if (!totalTransitions) return null;
  nums.forEach(n => {
    result.set(n, ((raw.get(n) || 0) / totalTransitions) * 100);
  });
  return result;
}
