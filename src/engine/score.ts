import type { Game, AnalysisResult, AIReply, DrawRow, MLTree } from '../types';
import { profileScore, pairScore, entropyScore, popularPatternPenalty } from './filters';
import { rfScore, fourierScore, gbScore, gbBuildForest } from './ml';
import { buildMarkov, markovScore } from './markov';
import { kmeans, clusterFit } from './cluster';
import { analyze } from './analyze';
import { ENGINE, GAMES, SOURCE_NOTE } from '../config';
import { STATE, saveMarkovCache, saveClusterCache, saveGBForests } from '../state';

function ensureMarkov(g: Game, hist: DrawRow[]): void {
  if (!STATE.markovCache) STATE.markovCache = {};
  const sig = `${g.id}:${hist.length}:${hist[0]?.raw || ''}:${hist[hist.length - 1]?.raw || ''}`;
  if (!STATE.markovCache[g.id] || STATE.markovCache[g.id]?.sig !== sig) {
    STATE.markovCache[g.id] = buildMarkov(g, hist);
    saveMarkovCache();
  }
}

function ensureCluster(g: Game, hist: DrawRow[]): void {
  if (!STATE.clusterCache) STATE.clusterCache = {};
  if (!STATE.clusterCache[g.id]) {
    STATE.clusterCache[g.id] = kmeans(g, hist);
    saveClusterCache();
  }
}

function ensureGB(g: Game, hist: DrawRow[]): void {
  if (!STATE.gbForests) STATE.gbForests = {};
  const sig = `${g.id}:${hist.length}:${hist[0]?.raw || ''}:${hist[hist.length - 1]?.raw || ''}`;
  const had = STATE.gbForests[g.id] && (STATE.gbForests[g.id] as any)._sig === sig;
  if (!had && hist.length >= 30) {
    STATE.gbForests[g.id] = gbBuildForest(g, hist);
    saveGBForests();
  }
}

export function scoreTicket(g: Game, pick: number[], analysis?: AnalysisResult): number {
  if (g.federal || g.columns) return 50;
  const a = analysis || analyze(g);
  const scores = pick.map(n => a.weights.get(n) || 50);
  const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
  const even = pick.filter(n => n % 2 === 0).length;
  const balance = 100 - Math.abs(even - g.pick / 2) * (100 / g.pick);
  const spans = (Math.max(...pick) - Math.min(...pick)) / (g.max - g.min || 1) * 100;
  const profile = profileScore(g, pick, a.profile);
  const pair = pairScore(g, pick, a);
  const entropy = entropyScore(g, pick);
  const penalty = popularPatternPenalty(g, pick);

  if (!STATE.markovCache?.[g.id] && a.hist.length >= 10) ensureMarkov(g, a.hist);
  const mk = STATE.markovCache?.[g.id] ? markovScore(g, pick, STATE.markovCache[g.id]!) / 100 : 0;

  if (!STATE.clusterCache?.[g.id] && a.hist.length >= 10) ensureCluster(g, a.hist);
  const cl = STATE.clusterCache?.[g.id] ? clusterFit(g, pick, STATE.clusterCache[g.id]!) / 100 : 0;

  if (!STATE.gbForests?.[g.id] && a.hist.length >= 30) ensureGB(g, a.hist);
  const gbScoreVal = STATE.gbForests?.[g.id] ? gbScore(g, pick, STATE.gbForests[g.id] as any) / 100 : 0;

  return Math.round(Math.max(1, Math.min(99,
    avg * 0.28 + balance * 0.10 + spans * 0.06 + profile * 0.14 +
    pair * 0.08 + entropy * 0.06 + mk * 0.12 + cl * 0.10 + gbScoreVal * 0.06 - penalty
  )));
}

export function enhancedFit(
  g: Game,
  pick: number[],
  a: AnalysisResult,
  avoid: number[][],
  index: number,
  simIdx: number
): number {
  const base = scoreTicket(g, pick, a);
  const prof = profileScore(g, pick, a.profile);
  const pair = pairScore(g, pick, a);
  const entropy = entropyScore(g, pick);
  const pop = popularPatternPenalty(g, pick);

  const temporalProfile = ENGINE.temporalProfile(a.hist);
  let ts = 0;
  if (temporalProfile) {
    const sc = pick.map(n => temporalProfile.get(n) || 0);
    ts = sc.reduce((s, v) => s + v, 0) / sc.length * 50;
  }

  const avgDistanceFn = (p: number[], sets: number[][]) => {
    const distances = sets.map(s => p.filter(n => !s.includes(n)).length);
    return distances.reduce((a, b) => a + b, 0) / Math.max(distances.length, 1);
  };
  const diversity = avoid.length ? Math.min(30, avgDistanceFn(pick, avoid) * 2.5) : 15;
  const noise = ((simIdx * 9973 + 7919) % 100) / 1000;

  const forest = STATE.forests?.[g.id];
  const ml = forest ? rfScore(g, pick, forest) / 2 : 0;
  const fourier = fourierScore(g, pick) * 0.15;

  const markov = STATE.markovCache?.[g.id] || null;
  const mk = markov ? markovScore(g, pick, markov) * 0.08 : 0;

  const gb = STATE.gbForests?.[g.id] || null;
  const gbVal = gb ? gbScore(g, pick, gb as any) * 0.05 : 0;

  return base * 0.22 + prof * 0.10 + pair * 0.08 + entropy * 0.05 + ts * 0.10 +
    diversity * 0.07 - pop * 0.04 + ml * 0.08 + fourier * 0.06 + mk + gbVal + noise;
}

export function ensembleScore(g: Game, pick: number[], forest: any[] | null): number {
  const a = analyze(g);
  const base = scoreTicket(g, pick, a);
  const prof = profileScore(g, pick, a.profile);
  const ent = entropyScore(g, pick);
  const rf = rfScore(g, pick, forest);
  const fourier = fourierScore(g, pick);

  const markov = STATE.markovCache?.[g.id] || null;
  const mk = markov ? markovScore(g, pick, markov) : 50;

  const gb = STATE.gbForests?.[g.id] || null;
  const gbV = gb ? gbScore(g, pick, gb as any) : 50;

  const final = Math.round(base * 0.22 + prof * 0.10 + ent * 0.06 + rf * 0.22 + fourier * 0.10 + mk * 0.15 + gbV * 0.15);
  return Math.min(99, Math.max(1, final));
}

export function aiReport(g: Game, pick: number[]): AIReply {
  if (g.federal || g.columns) return { grade: 'Neutro', profile: 50, pair: 50, entropy: 50, risk: 'aleatorio' };
  const a = analyze(g);
  const profile = profileScore(g, pick, a.profile);
  const pair = pairScore(g, pick, a);
  const entropy = entropyScore(g, pick);
  const penalty = popularPatternPenalty(g, pick);

  const markov = STATE.markovCache?.[g.id] || null;
  const mk = markov ? markovScore(g, pick, markov) : 50;

  const cluster = STATE.clusterCache?.[g.id] || null;
  const cl = cluster ? clusterFit(g, pick, cluster) : 50;

  const grade = scoreTicket(g, pick, a) >= 82 ? 'Elite' : scoreTicket(g, pick, a) >= 70 ? 'Forte' : 'Moderado';
  const risk = penalty > 12 ? 'padrao popular penalizado' : entropy < 55 ? 'baixa dispersao' : 'perfil equilibrado';
  return { grade, profile, pair, entropy, risk };
}

function calcCoverage(g: Game, set: any[]): number {
  const all = set.flatMap(x => x.main);
  return new Set(all).size;
}

function calcOverlap(g: Game, set: any[]): number {
  if (set.length < 2) return 0;
  const distances = set[0].main.map((n: number) => set.slice(1).filter((x: any) => x.main.includes(n)).length);
  const avg = distances.reduce((a: number, b: number) => a + b, 0) / Math.max(distances.length, 1);
  return Math.round((1 - avg / g.pick) * 100);
}

function calcDiversification(g: Game, set: any[]): number {
  if (set.length < 2) return 100;
  const uniquePairs = new Set<string>();
  const totalPairs = set.flatMap(t => {
    const m = t.main;
    const pairs: string[] = [];
    for (let i = 0; i < m.length; i++)
      for (let j = i + 1; j < m.length; j++)
        pairs.push(m[i] < m[j] ? m[i] + '-' + m[j] : m[j] + '-' + m[i]);
    return pairs;
  });
  totalPairs.forEach(p => uniquePairs.add(p));
  const totalPossible = (g.pick * (g.pick - 1) / 2) * set.length;
  return Math.round((uniquePairs.size / Math.max(totalPossible, 1)) * 100);
}

function calcClusterSpread(g: Game, set: any[]): number {
  const cluster = STATE.clusterCache?.[g.id];
  if (!cluster || set.length < 2) return 50;
  const clusterIds = set.map(t => clusterFit(g, t.main, cluster));
  const unique = new Set(clusterIds).size;
  return Math.round((unique / cluster.centroids.length) * 100);
}

export function portfolioReport(g: Game, set: any[]): string {
  if (g.federal || g.columns) return 'Carteira sem analise matricial para esta modalidade.';
  const all = set.flatMap(x => x.main);
  const unique = new Set(all).size;
  const coverage = Math.round(unique / (g.max - g.min + 1) * 100);
  const avg = Math.round(set.reduce((s, x) => s + x.score, 0) / Math.max(set.length, 1));
  const overlap = calcOverlap(g, set);
  const diversification = calcDiversification(g, set);
  const clusterSpread = calcClusterSpread(g, set);
  const sims = STATE._simCount || ENGINE.sims;
  const hasRF = !!STATE.forests?.[g.id];
  const hasGB = !!STATE.gbForests?.[g.id];
  const hasMarkov = !!STATE.markovCache?.[g.id];
  const hasCluster = !!STATE.clusterCache?.[g.id];
  return [
    `IA Next-Gen: ${sims.toLocaleString()} simulacoes MC + GA + MCTS`,
    hasRF ? '+ RF' : '',
    hasGB ? '+ GradBoost' : '',
    hasMarkov ? '+ Markov' : '',
    hasCluster ? '+ Cluster' : '',
    `| score medio ${avg}/99`,
    `| cobertura ${coverage}%`,
    `| sobreposicao ${Math.max(0, overlap)}%`,
    `| diversificacao ${diversification}%`,
    `| dispersao ${clusterSpread}%`,
  ].filter(Boolean).join(' ');
}
