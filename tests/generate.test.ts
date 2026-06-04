import { describe, it, expect, beforeAll } from 'vitest';
import { GAMES } from '../src/config';
import { buildGame, generateSet } from '../src/engine/generate';

describe('Generate Engine', () => {
  const megasena = GAMES[0];

  beforeAll(() => {
    (global as any).window = global;
    (global as any).STATE = {
      history: { megasena: [] },
      analysisCache: {},
      forests: {},
    };
    (global as any).localStorage = {
      getItem: () => null,
      setItem: () => {},
    };
    (global as any).ENGINE = {
      sims: 1000, gens: 10, pop: 30, elite: 4, mutRate: 0.22, crossRate: 0.7, decay: 0.88,
      temporalProfile: () => null,
      coMatrix: () => new Map(),
      clusters: () => [],
    };
  });

  it('should generate valid tickets for balanced strategy', () => {
    const ticket = buildGame(megasena, 'balanced', 0);
    expect(ticket).toHaveLength(megasena.pick);
    expect(new Set(ticket).size).toBe(megasena.pick);
    ticket.forEach(n => {
      expect(n).toBeGreaterThanOrEqual(megasena.min);
      expect(n).toBeLessThanOrEqual(megasena.max);
    });
  });

  it('should generate different tickets with different seeds', () => {
    const t1 = buildGame(megasena, 'balanced', 0);
    const t2 = buildGame(megasena, 'balanced', 1);
    const t1Str = t1.join(',');
    const t2Str = t2.join(',');
    expect(t1Str).not.toBe(t2Str); // Very unlikely to be same
  });

  it('should generate tickets for all strategies', () => {
    const strategies = ['balanced', 'coverage', 'contrarian', 'random'] as const;
    strategies.forEach(s => {
      const ticket = buildGame(megasena, s, 0);
      expect(ticket).toHaveLength(megasena.pick);
    });
  });

  it('generateSet should produce requested count', () => {
    const results = generateSet(megasena, 5, 'balanced', 'standard');
    expect(results).toHaveLength(5);
    results.forEach((r: { main: number[]; score: number }) => {
      expect(r.main).toHaveLength(megasena.pick);
      expect(r.score).toBeGreaterThanOrEqual(1);
      expect(r.score).toBeLessThanOrEqual(99);
    });
  });

  it('should handle federal lottery', () => {
    const federal = GAMES.find(g => g.federal)!;
    const ticket = buildGame(federal, 'balanced', 0);
    expect(ticket).toHaveLength(1);
    expect(ticket[0]).toBeGreaterThanOrEqual(0);
    expect(ticket[0]).toBeLessThanOrEqual(99999);
  });
});
