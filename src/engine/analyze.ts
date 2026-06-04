import type { Game, AnalysisResult, AnalysisProfile, NumberScore, DrawRow } from '../types';
import { range, sumArr, countRuns } from '../utils';
import { STATE, saveAnalysisCache } from '../state';

export function analyze(g: Game): AnalysisResult {
  const hist = STATE.history[g.id] || [];
  const sig = `${hist.length}:${hist[0]?.raw || ''}:${hist[hist.length - 1]?.raw || ''}`;
  if (STATE.analysisCache[g.id]?.sig === sig) return STATE.analysisCache[g.id].data;

  const nums = range(g);
  const total = Math.max(hist.length, 1);
  const drawSize = g.drawSize || g.pick;
  const expected = drawSize / (g.max - g.min + 1);

  const freq = new Map<number, number>(nums.map(n => [n, 0]));
  const lastSeen = new Map<number, number>(nums.map(n => [n, -1]));
  const pair = new Map<string, number>();

  hist.forEach((draw: DrawRow, idx: number) => {
    const ds = [...new Set(draw.main)].filter(n => freq.has(n));
    ds.forEach(n => { freq.set(n, freq.get(n)! + 1); lastSeen.set(n, idx); });
    for (let i = 0; i < ds.length; i++)
      for (let j = i + 1; j < ds.length; j++) {
        const key = ds[i] < ds[j] ? ds[i] + '-' + ds[j] : ds[j] + '-' + ds[i];
        pair.set(key, (pair.get(key) || 0) + 1);
      }
  });

  const values = nums.map(n => freq.get(n)!);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length) || 1;

  const avgGap = new Map(nums.map(n => [n, hist.length ? lastSeen.get(n)! < 0 ? total : total - 1 - lastSeen.get(n)! : 0]));

  const pairPower = new Map<number, number>(nums.map(n => [n, 0]));
  pair.forEach((v, key) => key.split('-').map(Number).forEach(n => pairPower.set(n, (pairPower.get(n) || 0) + v)));
  const pairMax = Math.max(...pairPower.values(), 1);

  const profile = buildHistoricalProfile(g, hist);

  const score: NumberScore[] = nums.map(n => {
    const z = (freq.get(n)! - mean) / sd;
    const recency = hist.length ? Math.min(avgGap.get(n)! / Math.max(3, total * 0.25), 1) : 0.5;
    const bayes = (freq.get(n)! + 1) / (total + 1 / expected);
    const central = 1 - Math.abs((n - (g.min + g.max) / 2) / ((g.max - g.min + 1) / 2));
    const pairs = (pairPower.get(n) || 0) / pairMax;
    const value = 50 + z * 8 + recency * 13 + bayes * 112 + central * 3 + pairs * 8;
    return { n, freq: freq.get(n)!, gap: avgGap.get(n)!, score: Math.round(Math.max(1, Math.min(99, value))) };
  }).sort((a, b) => b.score - a.score || a.n - b.n);

  const top = score.slice(0, Math.max(5, Math.ceil(nums.length * 0.18))).map(x => x.n);
  const cold = [...score].sort((a, b) => a.freq - b.freq || b.gap - a.gap).slice(0, Math.max(5, Math.ceil(nums.length * 0.18))).map(x => x.n);
  const weights = new Map(score.map(x => [x.n, x.score]));

  const result: AnalysisResult = { hist, total, score, freq, pair, pairPower, profile, top, cold, weights, mean, sd };
  STATE.analysisCache[g.id] = { sig, data: result };
  saveAnalysisCache();
  return result;
}

function buildHistoricalProfile(g: Game, hist: DrawRow[]): AnalysisProfile {
  const pk = g.pick;
  const ds = g.drawSize || g.pick;
  const fallback: AnalysisProfile = {
    sumMean: pk * (g.min + g.max) / 2,
    sumSd: (g.max - g.min + 1) * Math.sqrt(pk) / 3,
    evenMean: pk / 2,
    evenSd: 1,
    spanMean: (g.max - g.min) * 0.78,
    spanSd: 1,
    runMean: 1,
    runSd: 1,
  };
  if (!hist.length || !ds) return fallback;

  const rows = hist.map(d => {
    const p = d.main.filter(n => n >= g.min && n <= g.max).sort((a, b) => a - b);
    return { sum: sumArr(p), even: p.filter(n => n % 2 === 0).length, span: Math.max(...p) - Math.min(...p), runs: countRuns(p) };
  });

  const meanFn = (k: keyof typeof rows[0]) => rows.reduce((s, r) => s + r[k], 0) / rows.length;
  const sdFn = (k: keyof typeof rows[0], m: number) => Math.sqrt(rows.reduce((s, r) => s + (r[k] - m) ** 2, 0) / rows.length) || 1;
  const s = pk / ds;

  return {
    sumMean: meanFn('sum') * s,
    sumSd: sdFn('sum', meanFn('sum')) * Math.sqrt(s),
    evenMean: meanFn('even') * s,
    evenSd: sdFn('even', meanFn('even')) * Math.sqrt(s),
    spanMean: meanFn('span') * s,
    spanSd: sdFn('span', meanFn('span')) * Math.sqrt(s),
    runMean: meanFn('runs') * s,
    runSd: sdFn('runs', meanFn('runs')) * Math.sqrt(s),
  };
}

export function onlineUpdate(g: Game, newDraws: DrawRow[]): void {
  const hist = STATE.history[g.id] || [];
  if (!newDraws?.length) return;
  const prevLen = hist.length - newDraws.length;
  if (prevLen < 0) return;
  const a = STATE.analysisCache[g.id]?.data;
  if (!a) return;

  newDraws.forEach((draw, di) => {
    const idx = prevLen + di;
    draw.main.forEach(n => {
      a.freq.set(n, (a.freq.get(n) || 0) + 1);
      a.lastSeen.set(n, idx);
      for (let i = 0; i < draw.main.length; i++)
        for (let j = i + 1; j < draw.main.length; j++) {
          const key = draw.main[i] < draw.main[j] ? draw.main[i] + '-' + draw.main[j] : draw.main[j] + '-' + draw.main[i];
          a.pair.set(key, (a.pair.get(key) || 0) + 1);
        }
    });
  });

  a.total = hist.length;
  const nums = range(g);
  const values = nums.map(n => a.freq.get(n)!);
  a.mean = values.reduce((a, b) => a + b, 0) / values.length;
  a.sd = Math.sqrt(values.reduce((s, v) => s + (v - a.mean) ** 2, 0) / values.length) || 1;

  const pairPower = new Map(nums.map(n => [n, 0]));
  a.pair.forEach((v: number, key: string) => key.split('-').map(Number).forEach((n: number) => pairPower.set(n, (pairPower.get(n) || 0) + v)));
  const pairMax = Math.max(...pairPower.values(), 1);

  const expected = (g.drawSize || g.pick) / nums.length;
  nums.forEach(n => {
    const z = (a.freq.get(n)! - a.mean) / a.sd;
    const recency = Math.min((a.total - 1 - a.lastSeen.get(n)!) / Math.max(3, a.total * 0.25), 1);
    const bayes = (a.freq.get(n)! + 1) / (a.total + 1 / expected);
    const central = 1 - Math.abs((n - (g.min + g.max) / 2) / (nums.length - 1));
    const pairs = (pairPower.get(n) || 0) / pairMax;
    a.weights.set(n, Math.round(Math.max(1, Math.min(99, 50 + z * 8 + recency * 13 + bayes * 112 + central * 3 + pairs * 8))));
  });
}
