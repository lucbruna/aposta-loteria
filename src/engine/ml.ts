import type { Game, MLFeatures, MLTree, AnalysisResult, DrawRow } from '../types';
import { range, hash, mulberry, sumArr } from '../utils';
import { analyze } from './analyze';
import { STATE, saveGBForests } from '../state';

export function mlFeatures(g: Game, hist: DrawRow[], num: number): MLFeatures {
  const nums = range(g);
  const t = hist.length;
  const ds = g.drawSize || g.pick;

  const freq = hist.filter(d => d.main.includes(num)).length;
  const lastIdx = hist.map((d, i) => d.main.includes(num) ? i : -1).filter(i => i >= 0);
  const gap = lastIdx.length ? t - 1 - lastIdx[lastIdx.length - 1] : t;
  const recency = t ? Math.min(gap / Math.max(3, t * 0.25), 1) : 0.5;
  const expected = ds / nums.length;
  const bayes = (freq + 1) / (t + 1 / expected);

  const allFreq = nums.map(n => hist.filter(d => d.main.includes(n)).length);
  const m = allFreq.reduce((a, b) => a + b, 0) / allFreq.length || 1;
  const sd = Math.sqrt(allFreq.reduce((s, v) => s + (v - m) ** 2, 0) / allFreq.length) || 1;
  const z = (freq - m) / sd;

  const even = num % 2 === 0 ? 1 : 0;
  const high = num >= (g.min + g.max) / 2 ? 1 : 0;

  const pairs: number[] = [];
  hist.forEach(d => {
    const m = d.main;
    if (m.includes(num)) m.forEach(n => { if (n !== num) pairs.push(n); });
  });
  const pairPower = pairs.length;
  const maxPP = nums.map(n => hist.filter(d => d.main.includes(n)).length * t / 100).reduce((a, b) => Math.max(a, b), 1);

  return { freq, recency, bayes, z, even, high, pairPower: pairPower / maxPP, gap };
}

function buildTree(
  examples: Array<{ features: MLFeatures; appeared: number }>,
  usedFeatures: Set<string>,
  depth: number,
  maxDepth: number,
): MLTree {
  if (depth >= maxDepth || examples.length < 4) {
    const votes = examples.reduce((s, e) => s + e.appeared, 0);
    return { v: votes / examples.length };
  }

  const feats = [...usedFeatures];
  let bestGain = 0, bestFeat = feats[0], bestThresh = 0;

  for (const f of feats) {
    const vals = examples.map(e => (e.features as any)[f]);
    const sorted = [...new Set(vals)].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length - 1; i++) {
      const th = (sorted[i] + sorted[i + 1]) / 2;
      const left = examples.filter(e => (e.features as any)[f] <= th);
      const right = examples.filter(e => (e.features as any)[f] > th);
      if (!left.length || !right.length) continue;

      const pL = left.reduce((s, e) => s + e.appeared, 0) / left.length;
      const pR = right.reduce((s, e) => s + e.appeared, 0) / right.length;
      const gain = 2 -
        (pL * pL + (1 - pL) * (1 - pL)) * left.length / examples.length -
        (pR * pR + (1 - pR) * (1 - pR)) * right.length / examples.length;
      if (gain > bestGain) { bestGain = gain; bestFeat = f; bestThresh = th; }
    }
  }

  if (bestGain < 0.01) {
    const votes = examples.reduce((s, e) => s + e.appeared, 0);
    return { v: votes / examples.length };
  }

  const left = examples.filter(e => (e.features as any)[bestFeat] <= bestThresh);
  const right = examples.filter(e => (e.features as any)[bestFeat] > bestThresh);
  return { feat: bestFeat, th: bestThresh, l: buildTree(left, usedFeatures, depth + 1, maxDepth), r: buildTree(right, usedFeatures, depth + 1, maxDepth) };
}

export function mlBuildForest(g: Game, hist: DrawRow[], trees: number = 20): MLTree[] | null {
  if (hist.length < 30) return null;
  const nums = range(g);
  const maxDepth = 4;
  const forest: MLTree[] = [];

  const outcomes = nums.map(num => {
    const nextDrawIdx = Math.floor(hist.length * 0.7);
    const trainHist = hist.slice(0, nextDrawIdx);
    const testHist = hist.slice(nextDrawIdx);
    const features = mlFeatures(g, trainHist, num);
    const appeared = testHist.some(d => d.main.includes(num)) ? 1 : 0;
    return { features, appeared };
  });

  for (let t = 0; t < trees; t++) {
    const rng = mulberry(t * 7919 + hash('rf' + g.id));
    const bootstrap: typeof outcomes = [];
    for (let i = 0; i < nums.length; i++) bootstrap.push(outcomes[Math.floor(rng() * outcomes.length)]);

    const usedFeatures = new Set<string>();
    const allFeats = ['freq', 'recency', 'bayes', 'z', 'even', 'high', 'pairPower', 'gap'];
    while (usedFeatures.size < 3) usedFeatures.add(allFeats[Math.floor(rng() * allFeats.length)]);

    forest.push(buildTree(bootstrap, usedFeatures, 0, maxDepth));
  }

  return forest;
}

export function mlPredict(tree: MLTree, features: MLFeatures): number {
  if (tree.v !== undefined) return tree.v;
  return (features as any)[tree.feat!] <= tree.th!
    ? mlPredict(tree.l!, features)
    : mlPredict(tree.r!, features);
}

export function rfScore(g: Game, pick: number[], forest: MLTree[] | null): number {
  if (!forest) return 50;
  const nums = range(g);
  const a = analyze(g);

  const scores = pick.map(n => {
    const feats = mlFeatures(g, a.hist, n);
    const preds = forest.map(t => mlPredict(t, feats));
    return preds.reduce((s, v) => s + v, 0) / forest.length;
  });

  return Math.round(scores.reduce((s, v) => s + v, 0) / scores.length * 100);
}

export function fourierScore(g: Game, pick: number[]): number {
  const a = analyze(g);
  const hist = a.hist;
  const n = hist.length;
  if (n < 20) return 50;

  const nums = range(g);
  const periods = [3, 5, 7, 10, 15];

  const numScores = nums.map(num => {
    const freq = hist.map(d => d.main.includes(num) ? 1 : 0);
    let maxMag = 0;
    for (const p of periods) {
      let re = 0, im = 0;
      for (let i = 0; i < freq.length; i++) {
        const angle = 2 * Math.PI * i / p;
        re += freq[i] * Math.cos(angle);
        im -= freq[i] * Math.sin(angle);
      }
      const mag = Math.sqrt(re * re + im * im) / (freq.length || 1);
      if (mag > maxMag) maxMag = mag;
    }
    return { num, score: maxMag };
  });

  const maxS = Math.max(...numScores.map(x => x.score), 0.001);
  const pickScore = pick.reduce((s, n) => {
    const fs = numScores.find(x => x.num === n);
    return s + (fs ? fs.score / maxS : 0);
  }, 0);

  return Math.round(pickScore / pick.length * 100);
}

export interface GBTree {
  pred: number;
  feat?: string;
  th?: number;
  l?: GBTree;
  r?: GBTree;
}

export function gbBuildForest(g: Game, hist: DrawRow[], trees: number = 15, lr: number = 0.1): GBTree[] | null {
  if (hist.length < 30) return null;
  const sig = `${g.id}:${hist.length}:${hist[0]?.raw || ''}:${hist[hist.length - 1]?.raw || ''}`;
  const cached = STATE.gbForests?.[g.id];
  if (cached && (cached as any)._sig === sig) return cached as any;

  const nums = range(g);
  const maxDepth = 3;
  const forest: GBTree[] = [];

  const outcomes = nums.map(num => {
    const splitIdx = Math.floor(hist.length * 0.7);
    const trainHist = hist.slice(0, splitIdx);
    const testHist = hist.slice(splitIdx);
    const features = mlFeatures(g, trainHist, num);
    const appeared = testHist.some(d => d.main.includes(num)) ? 1 : 0;
    return { features, appeared };
  });

  let residuals = outcomes.map(o => o.appeared);

  for (let t = 0; t < trees; t++) {
    const rng = mulberry(t * 3571 + hash('gb' + g.id));
    const usedFeatures = new Set<string>();
    const allFeats = ['freq', 'recency', 'bayes', 'z', 'even', 'high', 'pairPower', 'gap'];
    while (usedFeatures.size < 3) usedFeatures.add(allFeats[Math.floor(rng() * allFeats.length)]);

    const tree = buildGBTree(
      outcomes.map((o, i) => ({ features: o.features, residual: residuals[i] })),
      usedFeatures, 0, maxDepth
    );
    forest.push(tree);

    const preds = outcomes.map((o, idx) => gbPredict(tree, o.features));
    residuals = residuals.map((r, idx) => r - preds[idx] * lr);
  }

  (forest as any)._sig = sig;
  if (!STATE.gbForests) STATE.gbForests = {};
  STATE.gbForests[g.id] = forest as any;
  saveGBForests();
  return forest;
}

function buildGBTree(
  examples: Array<{ features: MLFeatures; residual: number }>,
  usedFeatures: Set<string>,
  depth: number,
  maxDepth: number,
): GBTree {
  if (depth >= maxDepth || examples.length < 4) {
    return { pred: examples.reduce((s, e) => s + e.residual, 0) / Math.max(examples.length, 1) };
  }

  const feats = [...usedFeatures];
  let bestGain = Infinity;
  let bestFeat = feats[0];
  let bestThresh = 0;

  for (const f of feats) {
    const vals = examples.map(e => (e.features as any)[f]);
    const sorted = [...new Set(vals)].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length - 1; i++) {
      const th = (sorted[i] + sorted[i + 1]) / 2;
      const left = examples.filter(e => (e.features as any)[f] <= th);
      const right = examples.filter(e => (e.features as any)[f] > th);
      if (!left.length || !right.length) continue;

      const meanL = left.reduce((s, e) => s + e.residual, 0) / left.length;
      const meanR = right.reduce((s, e) => s + e.residual, 0) / right.length;
      const mse = left.reduce((s, e) => s + (e.residual - meanL) ** 2, 0) +
                  right.reduce((s, e) => s + (e.residual - meanR) ** 2, 0);
      if (mse < bestGain) { bestGain = mse; bestFeat = f; bestThresh = th; }
    }
  }

  const left = examples.filter(e => (e.features as any)[bestFeat] <= bestThresh);
  const right = examples.filter(e => (e.features as any)[bestFeat] > bestThresh);
  if (!left.length || !right.length) {
    return { pred: examples.reduce((s, e) => s + e.residual, 0) / examples.length };
  }

  return {
    pred: 0,
    feat: bestFeat,
    th: bestThresh,
    l: buildGBTree(left, usedFeatures, depth + 1, maxDepth),
    r: buildGBTree(right, usedFeatures, depth + 1, maxDepth),
  };
}

export function gbPredict(tree: GBTree, features: MLFeatures): number {
  if (tree.feat == null) return tree.pred;
  return (features as any)[tree.feat] <= tree.th!
    ? (tree.l ? gbPredict(tree.l, features) : 0)
    : (tree.r ? gbPredict(tree.r, features) : 0);
}

export function gbScore(g: Game, pick: number[], forest: GBTree[] | null, lr: number = 0.1): number {
  if (!forest) return 50;
  const a = analyze(g);
  const scores = pick.map(n => {
    const feats = mlFeatures(g, a.hist, n);
    return forest.reduce((s, t) => s + gbPredict(t, feats) * lr, 0);
  });
  const raw = scores.reduce((s, v) => s + v, 0) / scores.length;
  return Math.round(Math.min(99, Math.max(1, (raw + 0.5) * 100)));
}
