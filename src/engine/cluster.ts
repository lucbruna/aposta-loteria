import type { Game, DrawRow } from '../types';
import { range, sumArr } from '../utils';

export interface ClusterProfile {
  sumMean: number;
  evenMean: number;
  spanMean: number;
  runMean: number;
}

export interface ClusterResult {
  centroids: ClusterProfile[];
  assignments: number[];
  inertia: number;
}

function drawProfile(draw: DrawRow): ClusterProfile {
  const sorted = [...draw.main].sort((a, b) => a - b);
  return {
    sumMean: sumArr(sorted),
    evenMean: sorted.filter(n => n % 2 === 0).length,
    spanMean: Math.max(...sorted) - Math.min(...sorted),
    runMean: (() => {
      let runs = 0;
      for (let i = 1; i < sorted.length; i++)
        if (sorted[i] === sorted[i - 1] + 1) runs++;
      return runs;
    })(),
  };
}

function euclidean(a: ClusterProfile, b: ClusterProfile): number {
  return Math.sqrt(
    (a.sumMean - b.sumMean) ** 2 +
    (a.evenMean - b.evenMean) ** 2 +
    (a.spanMean - b.spanMean) ** 2 +
    (a.runMean - b.runMean) ** 2
  );
}

function centroidOf(indices: number[], profiles: ClusterProfile[]): ClusterProfile {
  if (!indices.length) return { sumMean: 0, evenMean: 0, spanMean: 0, runMean: 0 };
  const n = indices.length;
  return {
    sumMean: indices.reduce((s, i) => s + profiles[i].sumMean, 0) / n,
    evenMean: indices.reduce((s, i) => s + profiles[i].evenMean, 0) / n,
    spanMean: indices.reduce((s, i) => s + profiles[i].spanMean, 0) / n,
    runMean: indices.reduce((s, i) => s + profiles[i].runMean, 0) / n,
  };
}

export function kmeans(g: Game, hist: DrawRow[], k: number = 4, maxIter: number = 20): ClusterResult | null {
  if (hist.length < 10) return null;
  const profiles = hist.map(d => drawProfile(d));
  const n = profiles.length;
  if (n <= k) return null;

  const rng = (seed: number) => {
    let s = seed;
    return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return s / 0xffffffff; };
  };
  const rand = rng(42);

  const centroids: ClusterProfile[] = [];
  const chosen = new Set<number>();
  for (let i = 0; i < k; i++) {
    let idx: number;
    do { idx = Math.floor(rand() * n); } while (chosen.has(idx));
    chosen.add(idx);
    centroids.push({ ...profiles[idx] });
  }

  const assignments: number[] = new Array(n).fill(0);
  let prevAssign: number[] = [];

  for (let iter = 0; iter < maxIter; iter++) {
    for (let i = 0; i < n; i++) {
      let bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const d = euclidean(profiles[i], centroids[c]);
        if (d < bestDist) { bestDist = d; assignments[i] = c; }
      }
    }

    if (prevAssign.length && prevAssign.every((a, i) => a === assignments[i])) break;
    prevAssign = [...assignments];

    for (let c = 0; c < k; c++) {
      const members = assignments.map((a, i) => a === c ? i : -1).filter(i => i >= 0);
      centroids[c] = centroidOf(members, profiles);
    }
  }

  const inertia = profiles.reduce((s, p, i) => s + euclidean(p, centroids[assignments[i]]), 0);

  return { centroids, assignments, inertia };
}

export function clusterFit(g: Game, pick: number[], clusters: ClusterResult): number {
  if (!clusters || clusters.centroids.length < 2) return 50;
  const prof = drawProfile({ main: pick });
  let bestDist = Infinity;
  let bestC = 0;
  for (let c = 0; c < clusters.centroids.length; c++) {
    const d = euclidean(prof, clusters.centroids[c]);
    if (d < bestDist) { bestDist = d; bestC = c; }
  }

  const members = clusters.assignments.filter(a => a === bestC).length;
  const ratio = members / clusters.assignments.length;
  return Math.round(Math.min(99, ratio * 100));
}
