import type { Game, AnalysisResult, AnalysisProfile } from '../types';
import { sumArr, countRuns } from '../utils';

function bell(value: number, mean: number, sd: number): number {
  const z = Math.abs(value - mean) / (sd || 1);
  return Math.max(0, 100 - z * 34);
}

export function profileScore(g: Game, pick: number[], profile: AnalysisProfile): number {
  const even = pick.filter(n => n % 2 === 0).length;
  const span = Math.max(...pick) - Math.min(...pick);
  const runs = countRuns(pick);
  return Math.round(
    bell(sumArr(pick), profile.sumMean, profile.sumSd) * 0.42 +
    bell(even, profile.evenMean, profile.evenSd || 1) * 0.24 +
    bell(span, profile.spanMean, profile.spanSd || 1) * 0.22 +
    bell(runs, profile.runMean, profile.runSd || 1) * 0.12
  );
}

export function pairScore(g: Game, pick: number[], a: AnalysisResult): number {
  if (!a.pair.size) return 55;
  const vals: number[] = [];
  for (let i = 0; i < pick.length; i++)
    for (let j = i + 1; j < pick.length; j++) {
      const key = pick[i] < pick[j] ? pick[i] + '-' + pick[j] : pick[j] + '-' + pick[i];
      vals.push(a.pair.get(key) || 0);
    }
  const max = Math.max(...a.pair.values(), 1);
  return Math.round(Math.min(100, (vals.reduce((s, v) => s + v, 0) / Math.max(vals.length, 1)) / max * 100 + 30));
}

export function entropyScore(g: Game, pick: number[]): number {
  const bins = [0, 0, 0, 0];
  pick.forEach(n => {
    const idx = Math.min(3, Math.floor((n - g.min) / (g.max - g.min + 1) * 4));
    bins[idx]++;
  });
  const e = bins.reduce((s, c) => c ? s - (c / pick.length) * Math.log2(c / pick.length) : s, 0);
  return Math.round(e / 2 * 100);
}

export function popularPatternPenalty(g: Game, pick: number[]): number {
  const sorted = [...pick].sort((a, b) => a - b);
  let p = 0;
  if (sorted.every((n, i) => i === 0 || n === sorted[i - 1] + 1)) p += 22;
  if (sorted.every(n => n <= 31) && g.max > 31) p += 8;
  if (sorted.every(n => n % 2 === sorted[0] % 2)) p += 14;
  if (countRuns(sorted) > Math.max(2, Math.ceil(g.pick * 0.28))) p += 8;
  return p;
}

export function passesFilters(g: Game, pick: number[], mode: 'standard' | 'soft' | 'off' = 'standard'): boolean {
  if (mode === 'off' || g.federal || g.columns) return true;
  const penalty = popularPatternPenalty(g, pick);
  const even = pick.filter(n => n % 2 === 0).length;
  const evenLimit = mode === 'soft' ? Math.ceil(g.pick * 0.82) : Math.ceil(g.pick * 0.72);
  const allCalendar = g.max > 31 && pick.filter(n => n <= 31).length >= Math.ceil(g.pick * (mode === 'soft' ? 0.92 : 0.82));
  const sum = sumArr(pick);
  const minSum = g.pick * g.min + comb(g.pick, 2);
  const maxSum = g.pick * g.max - comb(g.pick, 2);
  const tooExtreme = sum < minSum + (maxSum - minSum) * 0.08 || sum > maxSum - (maxSum - minSum) * 0.08;
  return penalty < (mode === 'soft' ? 28 : 18) && even > 0 && even < evenLimit && !allCalendar && !tooExtreme;
}

function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
  return Math.round(r);
}
