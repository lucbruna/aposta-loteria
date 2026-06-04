import type { Game, AnalysisResult, Ticket, Strategy, FilterMode, MLTree } from '../types';
import { analyze } from './analyze';
import { enhancedFit, scoreTicket, aiReport } from './score';
import { passesFilters } from './filters';
import { sample, todaySeed, hash, mulberry, range, cfg } from '../utils';
import { mcTickets } from './montecarlo';
import { geneticTicket } from './genetic';
import { mctsTicket } from './mcts';
import { mlBuildForest } from './ml';
import { extrasFor } from './extras';
import { STATE } from '../state';

export function buildGame(g: Game, strategy: Strategy = 'balanced', index: number = 0, avoid: number[][] = [], onProgress?: (pct: number) => void): number[] {
  if (g.federal) return [Math.floor(mulberry(todaySeed() + index + hash(g.id))() * 100000)];
  if (g.columns) {
    const rng = mulberry(todaySeed() + hash(g.id + strategy) + index * 7919);
    return Array.from({ length: g.columns }, () => Math.floor(rng() * 10));
  }
  if (strategy === 'ai') return aiTicket(g, index, avoid, onProgress);

  const a = analyze(g);
  const rng = mulberry(todaySeed() + hash(g.id + strategy) + index * 7919);
  const pool = range(g);
  let weights: Map<number, number> = new Map(pool.map(n => [n, 1]));

  if (strategy === 'balanced') weights = a.weights;
  if (strategy === 'contrarian') weights = new Map(pool.map(n => [n, 100 - (a.weights.get(n) || 50)]));
  if (strategy === 'coverage') {
    weights = new Map(pool.map(n => [n, (a.weights.get(n) || 50)]));
    avoid.flat().forEach(n => weights.set(n, Math.max(1, (weights.get(n) || 1) * 0.35)));
  }

  let pick = sample(pool, g.pick, rng, weights);
  pick = repairComposition(g, pick, a, rng);
  return pick;
}

export function aiTicket(g: Game, index: number = 0, avoid: number[][] = [], onProgress?: (pct: number) => void): number[] {
  const a = analyze(g);
  if (!STATE.forests) STATE.forests = {};
  if (!STATE.forests[g.id]) STATE.forests[g.id] = mlBuildForest(g, a.hist, 15);

  const simCount = (window as any)._simCount || cfg(g, 'sims');

  const subProgress = (start: number, end: number) => {
    return (subPct: number) => { if (onProgress) onProgress(start + (end - start) * subPct / 100); };
  };

  const mc = mcTickets(g, index, avoid, Math.min(simCount, 6000), subProgress(0, 30));
  const ga = geneticTicket(g, index, avoid, subProgress(30, 70));
  const mcts = mctsTicket(g, index, avoid, subProgress(70, 80));

  const all = [...mc, ga, mcts];
  let best: number[] | null = null;
  let bestFit = -Infinity;

  for (let ci = 0; ci < all.length; ci++) {
    const fit = enhancedFit(g, all[ci], a, avoid, index, 0);
    if (!best || fit > bestFit) { best = all[ci]; bestFit = fit; }
    if (onProgress) onProgress(80 + Math.round((ci + 1) / all.length * 20));
  }
  return best!;
}

export function generateSet(
  g: Game,
  count: number,
  strategy: Strategy = 'balanced',
  filterMode: FilterMode = 'standard',
  seedOffset: number = 0,
  onProgress?: (pct: number) => void,
): Ticket[] {
  const out: Ticket[] = [];
  let guard = 0;
  const maxAttempts = count * 12;

  for (let i = 0; out.length < count && guard < maxAttempts; guard++, i++) {
    const ticketProgress = strategy === 'ai' && onProgress
      ? (subPct: number) => {
          const overall = (out.length + subPct / 100) / count * 100;
          onProgress(Math.round(Math.min(99, overall)));
        }
      : undefined;
    const main = buildGame(g, strategy, i + seedOffset, out.map(x => x.main), ticketProgress);
    if (!passesFilters(g, main, filterMode) && guard < count * 10) continue;
    out.push({
      main,
      extra: extrasFor(g, out.length),
      score: scoreTicket(g, main),
      ai: aiReport(g, main),
    });
    if (onProgress && strategy !== 'ai') onProgress(Math.round((out.length / count) * 100));
  }

  if (onProgress) onProgress(100);
  return out.sort((a, b) => b.score - a.score);
}

function repairComposition(g: Game, pick: number[], a: AnalysisResult, rng: () => number): number[] {
  const targetEven = Math.round(g.pick / 2);
  const pool = range(g).filter(n => !pick.includes(n));
  let guard = 0;
  let result = [...pick];
  while (Math.abs(result.filter(n => n % 2 === 0).length - targetEven) > Math.max(1, Math.ceil(g.pick * 0.25)) && guard++ < 40) {
    const needEven = result.filter(n => n % 2 === 0).length < targetEven;
    const candidates = pool.filter(n => (n % 2 === 0) === needEven).sort((x, y) => (a.weights.get(y) || 0) - (a.weights.get(x) || 0));
    const candidate = candidates[0];
    const replace = result.find(n => (n % 2 === 0) !== needEven);
    if (candidate == null || replace == null) break;
    result = result.filter(n => n !== replace).concat(candidate).sort((x, y) => x - y);
  }
  return result;
}
