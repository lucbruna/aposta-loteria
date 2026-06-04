import type { Game, AnalysisResult } from '../types';
import { buildGame } from './generate';
import { enhancedFit } from './score';
import { analyze } from './analyze';
import { sample, range, todaySeed, hash, mulberry, cfg } from '../utils';

function selTournament(pop: Array<{ ticket: number[]; fitness: number }>, k: number, rng: () => number) {
  let best: typeof pop[0] | null = null;
  for (let i = 0; i < k; i++) {
    const idx = Math.floor(rng() * pop.length);
    if (!best || pop[idx].fitness > best.fitness) best = pop[idx];
  }
  return best;
}

function crossover(g: Game, t1: number[], t2: number[], rng: () => number, a?: AnalysisResult): number[] {
  const pool = [...new Set([...t1, ...t2])];
  return sample(pool, g.pick, rng, a?.weights);
}

function mutate(ticket: number[], g: Game, a: AnalysisResult, rng: () => number, mr?: number): number[] {
  const rate = mr ?? cfg(g, 'mutRate');
  const pool = range(g).filter(n => !ticket.includes(n));
  const res = [...ticket];
  const mc = Math.max(1, Math.floor(g.pick * rate));

  for (let i = 0; i < mc; i++) {
    const idx = Math.floor(rng() * res.length);
    const weights = pool.map(n => a.weights.get(n) || 50);
    const tw = weights.reduce((s, v) => s + v, 0);
    let w = rng() * tw, si = 0;
    for (let j = 0; j < weights.length; j++) { w -= weights[j]; if (w <= 0) { si = j; break; } }
    const nn = pool[si];
    if (nn !== undefined) {
      pool.splice(si, 1);
      pool.push(res[idx]);
      res[idx] = nn;
    }
  }
  return res.sort((a, b) => a - b);
}

function avgDistanceFn(pick: number[], sets: number[][]): number {
  const distances = sets.map(s => pick.filter(n => !s.includes(n)).length);
  return distances.reduce((a, b) => a + b, 0) / Math.max(distances.length, 1);
}

export function geneticTicket(g: Game, index: number, avoid: number[][]): number[] {
  const a = analyze(g);
  const ps = cfg(g, 'pop');
  const el = g.engine?.elite || 6;
  const gs = cfg(g, 'gens');
  let rng = mulberry(todaySeed() + hash(g.id + 'ga') + index * 7919);

  let pop: Array<{ ticket: number[]; fitness: number }> = [];
  for (let i = 0; i < ps; i++) {
    const t = buildGame(g, 'balanced', index * ps + i, avoid);
    pop.push({ ticket: t, fitness: enhancedFit(g, t, a, avoid, index, i) });
  }

  for (let gen = 0; gen < gs; gen++) {
    pop.sort((x, y) => y.fitness - x.fitness);
    const np = pop.slice(0, el);

    const divScore = pop.length > 1
      ? pop.slice(0, 10).reduce((s, x, i) => s + (i ? avgDistanceFn(x.ticket, pop.slice(0, i).map(y => y.ticket)) : 0), 0) / 9
      : 0;

    rng = mulberry(rng() * 4294967296 + Math.floor(divScore * 100));
    const tempMut = 0.35 * Math.pow(0.05 / 0.35, gen / gs) * (1 + Math.max(0, 0.5 - divScore) * 0.3);

    while (np.length < ps) {
      if (rng() < cfg(g, 'crossRate')) {
        const p1 = selTournament(pop, 3, rng);
        const p2 = selTournament(pop, 3, rng);
        if (p1 && p2) {
          const child = crossover(g, p1.ticket, p2.ticket, rng, a);
          const mut = mutate(child, g, a, rng, tempMut);
          np.push({ ticket: mut, fitness: enhancedFit(g, mut, a, avoid, index, gen) });
        }
      } else {
        const p = selTournament(pop, 1, rng);
        if (p) {
          const mut = mutate(p.ticket, g, a, rng, tempMut);
          np.push({ ticket: mut, fitness: enhancedFit(g, mut, a, avoid, index, gen) });
        }
      }
    }
    pop = np;
  }

  pop.sort((x, y) => y.fitness - x.fitness);
  return pop[0].ticket;
}
