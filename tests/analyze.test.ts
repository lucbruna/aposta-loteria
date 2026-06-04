import { describe, it, expect, beforeAll } from 'vitest';
import { GAMES } from '../src/config';
import { analyze } from '../src/engine/analyze';

describe('Analyze Engine', () => {
  const megasena = GAMES[0];

  beforeAll(() => {
    // Setup mock history
    const mockHistory = Array.from({ length: 100 }, (_, i) => ({
      main: [1, 2, 3, 4, 5, 6].map(n => ((n + i * 7) % 60) + 1),
      raw: '',
    }));
    (global as any).window = global;
    (global as any).STATE = {
      history: { megasena: mockHistory },
      analysisCache: {},
    };
    (global as any).localStorage = {
      getItem: () => null,
      setItem: () => {},
    };
  });

  it('should return analysis result with correct structure', () => {
    const result = analyze(megasena);
    expect(result).toBeDefined();
    expect(result.total).toBeGreaterThan(0);
    expect(result.score).toBeDefined();
    expect(result.top).toBeDefined();
    expect(result.cold).toBeDefined();
    expect(result.weights).toBeDefined();
    expect(result.profile).toBeDefined();
  });

  it('should have scores between 1 and 99', () => {
    const result = analyze(megasena);
    result.score.forEach(s => {
      expect(s.score).toBeGreaterThanOrEqual(1);
      expect(s.score).toBeLessThanOrEqual(99);
    });
  });

  it('should rank numbers by score descending', () => {
    const result = analyze(megasena);
    for (let i = 1; i < result.score.length; i++) {
      expect(result.score[i].score).toBeLessThanOrEqual(result.score[i - 1].score);
    }
  });

  it('should use cache for repeated calls', () => {
    const result1 = analyze(megasena);
    const result2 = analyze(megasena);
    expect(result1).toBe(result2);
  });
});
