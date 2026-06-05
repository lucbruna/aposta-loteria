import { describe, it, expect } from 'vitest';
import { chiSquareTest, ksTest, kellyFraction, computeEdge, bootstrapCI, meanStd, percentile, recommendStrategy } from '../src/engine/stats';
import { GAMES } from '../src/config';
import type { DrawRow } from '../src/types';

describe('Stats', () => {
  it('chiSquareTest returns chi2, df, p', () => {
    const r = chiSquareTest({ 0: 10, 1: 5 }, { 0: 7, 1: 8 });
    expect(r.chi2).toBeGreaterThan(0);
    expect(r.df).toBe(2);
    expect(r.p).toBeGreaterThan(0);
  });

  it('chiSquareTest returns p=1 for identical distributions', () => {
    const dist = { 0: 40, 1: 40, 2: 20 };
    const result = chiSquareTest(dist, dist);
    expect(result.chi2).toBe(0);
    expect(result.p).toBe(1);
  });

  it('ksTest computes max distance', () => {
    const r = ksTest({ 0: 5, 1: 5 }, { 0: 10, 1: 0 });
    expect(r).toBeGreaterThan(0);
  });

  it('ksTest returns D statistic in 0..1', () => {
    const ai = { 0: 30, 1: 40, 2: 20, 3: 10 };
    const rnd = { 0: 25, 1: 25, 2: 25, 3: 25 };
    const d = ksTest(ai, rnd);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThanOrEqual(1);
  });

  it('kellyFraction caps at 0.25', () => {
    expect(kellyFraction(0.5, 2)).toBe(0.25);
    expect(kellyFraction(0.01, 1000)).toBeCloseTo(0, 2);
    expect(kellyFraction(-0.1, 100)).toBe(0);
    expect(kellyFraction(0, 10)).toBe(0);
  });

  it('computeEdge normalizes to -0.5..0.5', () => {
    expect(computeEdge(GAMES[0], 100, 50)).toBe(0.5);
    expect(computeEdge(GAMES[0], 0, 50)).toBe(-0.5);
    expect(computeEdge(GAMES[0], 50, 50)).toBe(0);
  });

  it('meanStd returns correct mean and std', () => {
    const r = meanStd([1, 2, 3, 4, 5]);
    expect(r.mean).toBe(3);
    expect(r.n).toBe(5);
    expect(r.std).toBeGreaterThan(0);
  });

  it('meanStd handles empty array', () => {
    const r = meanStd([]);
    expect(r.mean).toBe(0);
    expect(r.n).toBe(0);
  });

  it('percentile picks correct quantile', () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5], 0)).toBe(1);
    expect(percentile([1, 2, 3, 4, 5], 100)).toBe(5);
  });

  it('bootstrapCI produces a valid confidence interval', () => {
    const samples = Array.from({ length: 30 }, () => Math.random() * 100);
    const ci = bootstrapCI(samples, 200, 42);
    expect(ci.samples).toBe(200);
    expect(ci.n).toBe(30);
    expect(ci.ci95Low).toBeLessThan(ci.mean);
    expect(ci.ci95High).toBeGreaterThan(ci.mean);
    expect(ci.ci99Low).toBeLessThanOrEqual(ci.ci95Low);
    expect(ci.ci99High).toBeGreaterThanOrEqual(ci.ci95High);
  });

  it('bootstrapCI returns zeros for empty input', () => {
    const ci = bootstrapCI([], 100, 1);
    expect(ci.mean).toBe(0);
    expect(ci.samples).toBe(0);
  });

  it('recommendStrategy picks based on history size', () => {
    const fakeHist = (n: number): DrawRow[] => Array.from({ length: n }, (_, i) => ({
      main: [1, 2, 3, 4, 5, 6].map(x => ((x + i) % 60) + 1).sort((a, b) => a - b),
      raw: '',
    }));
    const g = GAMES[0];
    const r1 = recommendStrategy(fakeHist(10), g);
    const r2 = recommendStrategy(fakeHist(50), g);
    const r3 = recommendStrategy(fakeHist(150), g);
    const r4 = recommendStrategy(fakeHist(600), g);
    expect(r1.strategy).toBe('random');
    expect(r2.strategy).toBe('balanced');
    expect(r3.strategy).toBe('coverage');
    expect(r4.strategy).toBe('ai');
  });

  it('recommendStrategy returns random for federal/columns', () => {
    const federal = GAMES.find(x => x.federal);
    if (federal) {
      const r = recommendStrategy([], federal);
      expect(r.strategy).toBe('random');
    }
  });
});
