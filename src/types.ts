/// <reference types="vitest" />
/// <reference types="vite/client" />

interface ExtraField {
  name: string;
  min: number;
  max: number;
  pick: number;
}

interface GameEngine {
  sims: number;
  gens: number;
  pop: number;
  mutRate: number;
  crossRate: number;
  elite?: number;
  decay?: number;
}

export interface Game {
  id: string;
  api: string;
  name: string;
  color: string;
  min: number;
  max: number;
  pick: number;
  maxPick: number;
  price: number | null;
  draw: string;
  odds: number | null;
  drawSize?: number;
  columns?: number;
  federal?: boolean;
  extra?: ExtraField;
  engine?: GameEngine;
}

export interface DrawRow {
  main: number[];
  raw?: string;
}

export interface AnalysisProfile {
  sumMean: number;
  sumSd: number;
  evenMean: number;
  evenSd: number;
  spanMean: number;
  spanSd: number;
  runMean: number;
  runSd: number;
}

export interface NumberScore {
  n: number;
  freq: number;
  gap: number;
  score: number;
}

export interface AnalysisResult {
  hist: DrawRow[];
  total: number;
  score: NumberScore[];
  freq: Map<number, number>;
  pair: Map<string, number>;
  pairPower: Map<number, number>;
  profile: AnalysisProfile;
  top: number[];
  cold: number[];
  weights: Map<number, number>;
  mean: number;
  sd: number;
  lastSeen: Map<number, number>;
}

export interface AIReply {
  grade: string;
  profile: number;
  pair: number;
  entropy: number;
  risk: string;
}

export interface Ticket {
  main: number[];
  extra: number[];
  score: number;
  ai: AIReply;
}

export interface WalletFavorite {
  id: number;
  gameId: string;
  label: string;
  date: string;
  tickets: Ticket[];
}

export type Strategy = 'ai' | 'balanced' | 'coverage' | 'contrarian' | 'random';
export type FilterMode = 'standard' | 'soft' | 'off';

export interface BacktestStats {
  ai: Record<number, number>;
  random: Record<number, number>;
  total: number;
  bestAi: number;
  bestRandom: number;
}

export interface EngineConfig {
  sims: number;
  gens: number;
  pop: number;
  elite: number;
  mutRate: number;
  crossRate: number;
  decay: number;
  temporalProfile(hist: DrawRow[]): Map<number, number> | null;
  coMatrix(game: Game, hist: DrawRow[]): Map<string, number>;
  clusters(game: Game, hist: DrawRow[]): number[][];
}

export interface MLFeatures {
  freq: number;
  recency: number;
  bayes: number;
  z: number;
  even: number;
  high: number;
  pairPower: number;
  gap: number;
  dec?: number;
  sym?: number;
  gapMean?: number;
  gapVar?: number;
}

export interface MLTree {
  v?: number;
  feat?: string;
  th?: number;
  l?: MLTree;
  r?: MLTree;
}

export interface LatestData {
  concurso?: number;
  data?: string;
  dataProximoConcurso?: string;
  dezenas?: string[];
  listaDezenas?: string[];
  valorAcumuladoProximoConcurso?: number;
  valorAcumulado?: number;
  acumulado?: number;
  valorPremio?: number;
  premio?: number;
  valorEstimadoProximoConcurso?: number;
  estimativa?: number;
  estimado?: number;
  valorEstimado?: number;
  premiacoes?: Array<{ faixa: number; descricao: string; ganhadores: number; valorPremio: number }>;
  local?: string;
  cidades?: string[];
  trevos?: number[];
  mesSorte?: number;
  timeCoracao?: number;
  [key: string]: unknown;
}

export interface AppState {
  view: string;
  game: string;
  selected: Record<string, number[]>;
  history: Record<string, DrawRow[]>;
  latest: Record<string, LatestData>;
  generated: Ticket[];
  budget: Ticket[];
  wheel: Ticket[];
  quick: Ticket[];
  favorites: WalletFavorite[];
  analysisCache: Record<string, { sig: string; data: AnalysisResult }>;
  forests?: Record<string, MLTree[] | null>;
}

export interface WorkerRequest {
  type: 'generate' | 'analyze' | 'backtest' | 'autotune';
  payload: unknown;
}

export interface WorkerResponse {
  type: string;
  payload: unknown;
}

export const PRIME_SEEDS = {
  INDEX: 7919,
  EXTRA: 3571,
  MCTS: 7919,
  GA: 7919,
  RF: 7919,
  BACKTEST: 7919,
} as const;
