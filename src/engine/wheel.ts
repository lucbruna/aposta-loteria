import type { Game, Ticket } from '../types';
import { analyze } from './analyze';
import { scoreTicket, aiReport } from './score';
import { extrasFor } from './extras';

function combineLimited(
  arr: number[],
  k: number,
  limit: number,
  visit: (combo: number[]) => void,
  start: number = 0,
  prefix: number[] = []
): number {
  if (limit <= 0) return 0;
  if (prefix.length === k) { visit([...prefix]); return limit - 1; }
  for (let i = start; i <= arr.length - (k - prefix.length); i++) {
    prefix.push(arr[i]);
    limit = combineLimited(arr, k, limit, visit, i + 1, prefix);
    prefix.pop();
    if (limit <= 0) break;
  }
  return limit;
}

export function runWheel(g: Game, baseSize: number, limit: number): Ticket[] {
  const a = analyze(g);
  const base = a.score.slice(0, baseSize).map(x => x.n).sort((x, y) => x - y);
  const combos: number[][] = [];
  combineLimited(base, g.pick, limit * 18, combo => combos.push(combo));

  const scored = combos.map(c => ({ combo: c, score: scoreTicket(g, c, a) }));
  scored.sort((x, y) => y.score - x.score);

  const chosen: Ticket[] = [];
  for (const { combo } of scored) {
    if (chosen.length >= limit) break;
    let minDist = g.pick;
    for (const c of chosen) {
      let d = 0;
      for (const n of combo) if (!c.main.includes(n)) d++;
      if (d < minDist) minDist = d;
    }
    const score = Math.min(99, scoreTicket(g, combo, a) + minDist * 3);
    chosen.push({
      main: combo,
      extra: extrasFor(g, chosen.length),
      score,
      ai: aiReport(g, combo),
    });
    chosen.sort((x, y) => y.score - x.score);
    if (chosen.length > limit) chosen.pop();
  }

  return chosen.sort((a, b) => b.score - a.score);
}
