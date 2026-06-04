import type { Game, Ticket, AIReply } from '../types';
import { analyze } from './analyze';
import { scoreTicket, aiReport } from './score';
import { extrasFor } from './extras';
import { comb, range } from '../utils';

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

  const chosen: Ticket[] = [];
  combos.sort((x, y) => scoreTicket(g, y, a) - scoreTicket(g, x, a));

  for (const combo of combos) {
    if (chosen.length >= limit) break;
    const minDist = chosen.length
      ? Math.min(...chosen.map(c => combo.filter(n => !c.main.includes(n)).length))
      : g.pick;
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
