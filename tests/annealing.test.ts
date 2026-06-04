import { describe, it, expect } from 'vitest';
import { GAMES } from '../src/config';
import { saTicket } from '../src/engine/annealing';
import { scoreTicket } from '../src/engine/score';

describe('Simulated Annealing', () => {
  const g = GAMES[0]; // Mega-Sena

  it('should produce a valid ticket', () => {
    const t = saTicket(g, [], 42);
    expect(t).toHaveLength(g.pick);
    expect(new Set(t).size).toBe(g.pick);
    const sorted = [...t].sort((a, b) => a - b);
    expect(t).toEqual(sorted);
    t.forEach(n => {
      expect(n).toBeGreaterThanOrEqual(g.min);
      expect(n).toBeLessThanOrEqual(g.max);
    });
  });

  it('should produce reproducible results with same seed', () => {
    const t1 = saTicket(g, [], 12345);
    const t2 = saTicket(g, [], 12345);
    expect(t1).toEqual(t2);
  });

  it('should produce different results with different seeds', () => {
    const t1 = saTicket(g, [], 100);
    const t2 = saTicket(g, [], 200);
    // Very unlikely to produce the same ticket with different seeds
    expect(t1).not.toEqual(t2);
  });

  it('tickets should have valid scores', () => {
    const tickets = Array.from({ length: 5 }, (_, i) => saTicket(g, [], i * 7919));
    tickets.forEach(t => {
      const score = scoreTicket(g, t);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });
});
