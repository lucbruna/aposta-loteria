import { describe, it, expect } from 'vitest';
import { chiSquareTest, ksTest, kellyFraction } from '../src/engine/stats';

describe('Stats Functions', () => {
  it('chiSquareTest should return p-value', () => {
    const observed = { 0: 50, 1: 30, 2: 15, 3: 5 };
    const expected = { 0: 40, 1: 40, 2: 15, 3: 5 };
    const result = chiSquareTest(observed, expected);
    expect(result.chi2).toBeGreaterThan(0);
    expect(result.df).toBeGreaterThan(0);
    expect(result.p).toBeGreaterThan(0);
    expect(result.p).toBeLessThanOrEqual(1);
  });

  it('chiSquareTest should return p=1 for identical distributions', () => {
    const dist = { 0: 40, 1: 40, 2: 20 };
    const result = chiSquareTest(dist, dist);
    expect(result.chi2).toBe(0);
    expect(result.p).toBe(1);
  });

  it('ksTest should return D statistic', () => {
    const ai = { 0: 30, 1: 40, 2: 20, 3: 10 };
    const rnd = { 0: 25, 1: 25, 2: 25, 3: 25 };
    const d = ksTest(ai, rnd);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThanOrEqual(1);
  });

  it('kellyFraction should cap at 0.25', () => {
    expect(kellyFraction(0.5, 10)).toBe(0.05);
    expect(kellyFraction(0.5, 1)).toBe(0.25);
    expect(kellyFraction(0, 10)).toBe(0);
    expect(kellyFraction(-0.1, 10)).toBe(0);
  });
});
