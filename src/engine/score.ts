import type { Game, AnalysisResult, AIReply } from '../types';
import { profileScore, pairScore, entropyScore, popularPatternPenalty } from './filters';
import { rfScore, fourierScore } from './ml';
import { analyze } from './analyze';
import { ENGINE, GAMES, SOURCE_NOTE } from '../config';
import { STATE } from '../state';

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
  return Math.round(Math.max(1, Math.min(99, avg * 0.42 + balance * 0.14 + spans * 0.08 + profile * 0.18 + pair * 0.1 + entropy * 0.08 - penalty)));
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

  return base * 0.25 + prof * 0.12 + pair * 0.1 + entropy * 0.06 + ts * 0.12 + diversity * 0.08 - pop * 0.04 + ml * 0.1 + fourier * 0.08 + noise;
}

export function ensembleScore(g: Game, pick: number[], forest: any[] | null): number {
  const a = analyze(g);
  const base = scoreTicket(g, pick, a);
  const prof = profileScore(g, pick, a.profile);
  const ent = entropyScore(g, pick);
  const rf = rfScore(g, pick, forest);
  const fourier = fourierScore(g, pick);
  const final = Math.round(base * 0.3 + prof * 0.12 + ent * 0.08 + rf * 0.3 + fourier * 0.15);
  return Math.min(99, Math.max(1, final));
}

export function aiReport(g: Game, pick: number[]): AIReply {
  if (g.federal || g.columns) return { grade: 'Neutro', profile: 50, pair: 50, entropy: 50, risk: 'aleatorio' };
  const a = analyze(g);
  const profile = profileScore(g, pick, a.profile);
  const pair = pairScore(g, pick, a);
  const entropy = entropyScore(g, pick);
  const penalty = popularPatternPenalty(g, pick);
  const grade = scoreTicket(g, pick, a) >= 82 ? 'Elite' : scoreTicket(g, pick, a) >= 70 ? 'Forte' : 'Moderado';
  const risk = penalty > 12 ? 'padrao popular penalizado' : entropy < 55 ? 'baixa dispersao' : 'perfil equilibrado';
  return { grade, profile, pair, entropy, risk };
}

export function portfolioReport(g: Game, set: any[]): string {
  if (g.federal || g.columns) return 'Carteira sem analise matricial para esta modalidade.';
  const all = set.flatMap(x => x.main);
  const unique = new Set(all).size;
  const coverage = Math.round(unique / (g.max - g.min + 1) * 100);
  const avg = Math.round(set.reduce((s, x) => s + x.score, 0) / Math.max(set.length, 1));
  const overlap = set.length < 2 ? 0 : Math.round((1 - (() => {
    const distances = set[0].main.map((n: number) => set.slice(1).filter((x: any) => x.main.includes(n)).length);
    return distances.reduce((a: number, b: number) => a + b, 0) / Math.max(distances.length, 1);
  })() / g.pick) * 100);
  const sims = (window as any)._simCount || ENGINE.sims;
  const hasRF = !!STATE.forests?.[g.id];
  return `IA Next-Gen: ${sims.toLocaleString()} simulacoes MC + GA + MCTS${hasRF ? ' + RF + Fourier' : ''} | score medio ${avg}/99 | cobertura ${coverage}% | sobreposicao ${Math.max(0, overlap)}% | ensemble: frequencia temporal + matriz co-ocorrencia + ML supervisionado.`;
}
