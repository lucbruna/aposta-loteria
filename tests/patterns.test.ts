import { describe, it, expect } from 'vitest';
import { GAMES } from '../src/config';
import { analyze } from '../src/engine/analyze';
import { analyzePatterns, buildCalendarHeatmap } from '../src/engine/patterns';

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
});
