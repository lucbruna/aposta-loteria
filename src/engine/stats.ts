import type { Game } from '../types';

export function chiSquareTest(observed: Record<string, number>, expected: Record<string, number>): { chi2: number; df: number; p: number } {
  let chi2 = 0;
  let df = 0;
  for (const k of Object.keys(observed)) {
    const o = observed[k] || 0;
    const e = expected[k] || 1;
    if (e > 0) { chi2 += (o - e) ** 2 / e; df++; }
  }
  return { chi2, df, p: df > 0 ? Math.exp(-chi2 / (2 * df)) : 1 };
}

export function ksTest(aiHits: Record<string, number>, randomHits: Record<string, number>): number {
  const keys = [...new Set([...Object.keys(aiHits), ...Object.keys(randomHits)])].map(Number).sort((a, b) => a - b);
  let aiCdf = 0, rndCdf = 0, maxD = 0;
  const aiT = Object.values(aiHits).reduce((s, v) => s + v, 0) || 1;
  const rndT = Object.values(randomHits).reduce((s, v) => s + v, 0) || 1;
  for (const k of keys) {
    aiCdf += (aiHits[String(k)] || 0) / aiT;
    rndCdf += (randomHits[String(k)] || 0) / rndT;
    maxD = Math.max(maxD, Math.abs(aiCdf - rndCdf));
  }
  return maxD;
}

export function kellyFraction(edge: number, odds: number): number {
  return Math.max(0, Math.min(0.25, edge / odds));
}

export function computeEdge(g: Game, pickScore: number, baselineScore: number): number {
  return Math.max(-0.5, Math.min(0.5, (pickScore - baselineScore) / 100));
}
