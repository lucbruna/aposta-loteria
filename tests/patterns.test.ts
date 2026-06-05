import { describe, it, expect } from 'vitest';
import { GAMES } from '../src/config';
import { analyze } from '../src/engine/analyze';
import { analyzePatterns, buildCalendarHeatmap, buildCoOccurrence } from '../src/engine/patterns';
import type { DrawRow } from '../src/types';

describe('Patterns', () => {
  const g = GAMES[0];

  it('analyzePatterns returns no patterns for federal/columns games', () => {
    const federal = GAMES.find(x => x.federal);
    if (federal) {
      const patterns = analyzePatterns(federal, [1, 2, 3, 4, 5], analyze(federal));
      expect(patterns).toEqual([]);
    }
  });

  it('analyzePatterns detects long sequences', () => {
    const a = analyze(g);
    const patterns = analyzePatterns(g, [1, 2, 3, 4, 5, 6], a);
    const seq = patterns.find(p => p.id === 'seq');
    expect(seq).toBeDefined();
    expect(['warn', 'risk']).toContain(seq!.status);
  });

  it('analyzePatterns detects parity', () => {
    const a = analyze(g);
    const patterns = analyzePatterns(g, [1, 3, 5, 7, 9, 11], a);
    const par = patterns.find(p => p.id === 'par');
    expect(par).toBeDefined();
    expect(par!.detail).toContain('I');
  });

  it('buildCalendarHeatmap returns valid structure', () => {
    const a = analyze(g);
    if (a.hist.length > 0) {
      const h = buildCalendarHeatmap(g, a.hist, 2024, 6);
      expect(h.year).toBe(2024);
      expect(h.month).toBe(6);
      expect(h.days.length).toBeGreaterThanOrEqual(28);
    }
  });

  it('buildCoOccurrence returns null for federal/columns', () => {
    const federal = GAMES.find(x => x.federal);
    if (federal) expect(buildCoOccurrence(federal, [])).toBeNull();
  });

  it('buildCoOccurrence returns null for tiny history', () => {
    const hist: DrawRow[] = [{ main: [1, 2, 3, 4, 5, 6] }];
    expect(buildCoOccurrence(g, hist)).toBeNull();
  });

  it('buildCoOccurrence counts pairs correctly', () => {
    const hist: DrawRow[] = [
      { main: [1, 2, 3, 4, 5, 6] },
      { main: [1, 2, 7, 8, 9, 10] },
      { main: [1, 3, 11, 12, 13, 14] },
      { main: [2, 3, 15, 16, 17, 18] },
      { main: [1, 2, 19, 20, 21, 22] },
      { main: [1, 2, 23, 24, 25, 26] },
    ];
    const c = buildCoOccurrence(g, hist);
    expect(c).not.toBeNull();
    if (c) {
      const pair12 = c.topPairs.find(p => (p.a === 1 && p.b === 2) || (p.a === 2 && p.b === 1));
      expect(pair12).toBeDefined();
      expect(pair12!.count).toBe(4);
      expect(c.matrix[0][1]).toBe(4);
    }
  });

  it('buildCoOccurrence topPairs are sorted descending', () => {
    const hist: DrawRow[] = Array.from({ length: 30 }, (_, i) => ({
      main: Array.from({ length: 6 }, (_, k) => ((i * 7 + k * 11) % 60) + 1).sort((a, b) => a - b),
    }));
    const c = buildCoOccurrence(g, hist);
    if (c) {
      for (let i = 1; i < c.topPairs.length; i++) {
        expect(c.topPairs[i - 1].count).toBeGreaterThanOrEqual(c.topPairs[i].count);
      }
    }
  });
});
