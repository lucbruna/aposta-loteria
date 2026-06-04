import type { Game, AnalysisResult } from '../types';
import { buildGame } from './generate';
import { enhancedFit } from './score';
import { analyze } from './analyze';
import { cfg } from '../utils';

export function mcTickets(
  g: Game,
  index: number,
  avoid: number[][],
  count: number,
  onProgress?: (pct: number) => void
): number[][] {
  const a = analyze(g);
  const cnt = count || cfg(g, 'sims');
  const variants: Array<'balanced' | 'coverage' | 'contrarian' | 'random'> = ['balanced', 'coverage', 'contrarian', 'random'];
  const all: Array<{ main: number[]; fit: number }> = [];
  const reportEvery = Math.max(1, Math.floor(cnt / 50));

  for (let i = 0; i < cnt; i++) {
    const s = variants[i % variants.length];
    const c = buildGame(g, s, index * cnt + i, avoid);
    const fit = enhancedFit(g, c, a, avoid, index, i);
    all.push({ main: c, fit });
    if (onProgress && i % reportEvery === 0) onProgress(Math.round((i / cnt) * 100));
  }

  if (onProgress) onProgress(100);
  return all.sort((x, y) => y.fit - x.fit).slice(0, 20).map(x => x.main);
}
