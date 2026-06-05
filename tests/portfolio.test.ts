import { describe, it, expect } from 'vitest';
import { optimizePortfolio, defaultWeight, applyKelly } from '../src/engine/portfolio';

describe('Portfolio', () => {
  it('defaultWeight returns weights for known games', () => {
    expect(defaultWeight('megasena')).toBe(1.0);
    expect(defaultWeight('lotofacil')).toBeLessThan(defaultWeight('megasena'));
    expect(defaultWeight('unknown')).toBe(0.5);
  });

  it('optimizePortfolio with zero budget returns empty', () => {
    const p = optimizePortfolio(0, ['megasena'], 'ai');
    expect(p.allocations).toEqual([]);
    expect(p.totalCost).toBe(0);
    expect(p.remainingBudget).toBe(0);
  });

  it('optimizePortfolio with negative budget returns empty', () => {
    const p = optimizePortfolio(-10, ['megasena'], 'ai');
    expect(p.allocations).toEqual([]);
  });

  it('optimizePortfolio splits budget across games', () => {
    const p = optimizePortfolio(200, ['megasena', 'lotofacil'], 'balanced');
    expect(p.allocations.length).toBeGreaterThan(0);
    expect(p.totalCost + p.remainingBudget).toBeLessThanOrEqual(200);
    const totalTickets = p.allocations.reduce((s, a) => s + a.ticketCount, 0);
    expect(totalTickets).toBeGreaterThan(0);
  });

  it('optimizePortfolio gives Mega-Sena higher weight than Federal', () => {
    const p = optimizePortfolio(100, ['megasena', 'federal'], 'ai');
    const ms = p.allocations.find(a => a.gameId === 'megasena');
    const fed = p.allocations.find(a => a.gameId === 'federal');
    if (ms && fed) {
      expect(ms.ticketCount * ms.game.price!).toBeGreaterThan(fed.ticketCount * fed.game.price!);
    }
  });

  it('optimizePortfolio skips games without fixed price', () => {
    const p = optimizePortfolio(50, [], 'ai');
    expect(p.allocations.every(a => a.game.price && a.game.price > 0)).toBe(true);
  });

  it('applyKelly keeps allocations valid', () => {
    const p = optimizePortfolio(20, ['quina'], 'balanced');
    const before = p.totalTickets;
    if (before === 0) return;
    applyKelly(p, 0.001);
    for (const a of p.allocations) {
      expect(a.ticketCount).toBeGreaterThanOrEqual(0);
    }
    expect(p.totalTickets).toBeLessThanOrEqual(before);
  });
});
