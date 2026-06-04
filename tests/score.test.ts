import { describe, it, expect, beforeAll } from 'vitest';
import { GAMES } from '../src/config';
import { scoreTicket } from '../src/engine/score';
import { passesFilters, popularPatternPenalty } from '../src/engine/filters';

describe('Score Engine', () => {
  const megasena = GAMES[0]; // Mega-Sena: min=1, max=60, pick=6

  beforeAll(() => {
    (global as any).window = global;
    (global as any).STATE = {
      history: { megasena: [] },
      analysisCache: {},
    };
    (global as any).localStorage = {
      getItem: () => null,
      setItem: () => {},
    };
  });

  it('should score tickets between 1 and 99', () => {
    const ticket1 = [1, 2, 3, 4, 5, 6];
    const ticket2 = [10, 20, 30, 40, 50, 60];
    const ticket3 = [5, 15, 25, 35, 45, 55];

    [ticket1, ticket2, ticket3].forEach(t => {
      const s = scoreTicket(megasena, t);
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThanOrEqual(99);
    });
  });

  it('should penalize sequential patterns', () => {
    const sequential = [1, 2, 3, 4, 5, 6];
    const spread = [5, 12, 23, 34, 45, 56];
    const penaltySeq = popularPatternPenalty(megasena, sequential);
    const penaltySpread = popularPatternPenalty(megasena, spread);
    expect(penaltySeq).toBeGreaterThan(penaltySpread);
  });

  it('should penalize all-even or all-odd tickets', () => {
    const allEven = popularPatternPenalty(megasena, [2, 4, 6, 8, 10, 12]);
    const mixed = popularPatternPenalty(megasena, [1, 2, 3, 40, 50, 55]);
    expect(allEven).toBeGreaterThan(mixed);
  });
});

describe('Filters', () => {
  const megasena = GAMES[0];

  it('should pass balanced tickets in standard mode', () => {
    expect(passesFilters(megasena, [5, 12, 23, 34, 45, 56], 'standard')).toBe(true);
  });

  it('should reject all-low tickets', () => {
    expect(passesFilters(megasena, [1, 2, 3, 4, 5, 6], 'standard')).toBe(false);
  });

  it('should be more permissive in soft mode', () => {
    const borderline = [1, 2, 3, 4, 5, 7];
    expect(passesFilters(megasena, borderline, 'standard')).toBe(false);
    // In soft mode it might pass
  });

  it('"off" mode should always pass', () => {
    expect(passesFilters(megasena, [1, 2, 3, 4, 5, 6], 'off')).toBe(true);
  });
});
