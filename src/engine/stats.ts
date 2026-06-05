import type { Game, DrawRow } from '../types';

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

export function meanStd(arr: number[]): { mean: number; std: number; n: number } {
  if (!arr.length) return { mean: 0, std: 0, n: 0 };
  const m = arr.reduce((s, v) => s + v, 0) / arr.length;
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(arr.length - 1, 1);
  return { mean: m, std: Math.sqrt(v), n: arr.length };
}

export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

export interface BootstrapCI {
  mean: number;
  ci95Low: number;
  ci95High: number;
  ci99Low: number;
  ci99High: number;
  std: number;
  n: number;
  samples: number;
}

export function bootstrapCI(samples: number[], iterations: number = 200, seed: number = 0): BootstrapCI {
  if (!samples.length) return { mean: 0, ci95Low: 0, ci95High: 0, ci99Low: 0, ci99High: 0, std: 0, n: 0, samples: 0 };
  const { mean, std, n } = meanStd(samples);
  const rng = mulberry(seed || Date.now());
  const means: number[] = [];
  for (let i = 0; i < iterations; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += samples[Math.floor(rng() * samples.length)];
    means.push(s / n);
  }
  means.sort((a, b) => a - b);
  return {
    mean, std, n,
    samples: iterations,
    ci95Low: percentile(means, 2.5),
    ci95High: percentile(means, 97.5),
    ci99Low: percentile(means, 0.5),
    ci99High: percentile(means, 99.5),
  };
}

export function bootstrapTicketCI(
  scoreFn: (sample: DrawRow[]) => number,
  hist: DrawRow[],
  iterations: number = 100,
  subsampleFraction: number = 0.7
): BootstrapCI {
  if (hist.length < 10) return { mean: 0, ci95Low: 0, ci95High: 0, ci99Low: 0, ci99High: 0, std: 0, n: 0, samples: 0 };
  const subSize = Math.max(5, Math.floor(hist.length * subsampleFraction));
  const rng = mulberry(Date.now());
  const out: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const sample: DrawRow[] = [];
    for (let j = 0; j < subSize; j++) sample.push(hist[Math.floor(rng() * hist.length)]);
    out.push(scoreFn(sample));
  }
  return bootstrapCI(out, iterations, 0);
}

function mulberry(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export interface StrategyRecommendation {
  strategy: 'random' | 'balanced' | 'coverage' | 'ai' | 'contrarian';
  reason: string;
  confidence: number;
}

export function recommendStrategy(hist: DrawRow[], g: Game): StrategyRecommendation {
  if (g.federal || g.columns) {
    return { strategy: 'random', reason: 'Modalidade sem analise estatistica', confidence: 1.0 };
  }
  const t = hist.length;
  if (t < 20) {
    return { strategy: 'random', reason: `Historico insuficiente (${t} < 20 concursos)`, confidence: 0.9 };
  }
  if (t < 60) {
    return { strategy: 'balanced', reason: `Historico curto (${t}) - balanceamento via pesos`, confidence: 0.7 };
  }
  if (t < 200) {
    return { strategy: 'coverage', reason: `Historico medio (${t}) - cobertura inteligente`, confidence: 0.7 };
  }
  if (t < 500) {
    return { strategy: 'ai', reason: `Historico bom (${t}) - ensemble AI completo`, confidence: 0.85 };
  }
  return { strategy: 'ai', reason: `Historico rico (${t}) - IA ensemble captura todos os sinais`, confidence: 0.95 };
}
