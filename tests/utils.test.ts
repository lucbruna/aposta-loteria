import { describe, it, expect } from 'vitest';
import { GAMES } from '../src/config';
import { range, comb, mulberry, hash, sample, fmtMoney, fmtNum } from '../src/utils';

describe('Utils', () => {
  it('range should return correct number array', () => {
    const g = GAMES[0]; // Mega-Sena: 1-60
    const r = range(g);
    expect(r).toHaveLength(60);
    expect(r[0]).toBe(1);
    expect(r[59]).toBe(60);
  });

  it('comb should calculate combinations correctly', () => {
    expect(comb(60, 6)).toBe(50063860);
    expect(comb(25, 15)).toBe(3268760);
  });

  it('mulberry should produce deterministic values', () => {
    const rng1 = mulberry(12345);
    const rng2 = mulberry(12345);
    const a = Array.from({ length: 10 }, () => rng1());
    const b = Array.from({ length: 10 }, () => rng2());
    expect(a).toEqual(b);
  });

  it('hash should produce consistent values', () => {
    expect(hash('megasena')).toBe(hash('megasena'));
    expect(hash('megasena')).not.toBe(hash('lotofacil'));
  });

  it('sample should pick k items', () => {
    const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const rng = mulberry(42);
    const result = sample(pool, 5, rng);
    expect(result).toHaveLength(5);
    expect(new Set(result).size).toBe(5);
    result.forEach(n => expect(pool).toContain(n));
  });

  it('sample with weights should favor higher weights', () => {
    const pool = [1, 2, 3];
    const weights = new Map([[1, 1], [2, 1], [3, 100]]);
    const results = Array.from({ length: 500 }, (_, i) => {
      const rng = mulberry(i * 7919 + 1);
      return sample(pool, 1, rng)[0];
    });
    const count1 = results.filter(n => n === 1).length;
    const count2 = results.filter(n => n === 2).length;
    const count3 = results.filter(n => n === 3).length;
    expect(count3).toBeGreaterThan(count1);
    expect(count3).toBeGreaterThan(count2);
  });

  it('fmtMoney should format BRL correctly', () => {
    expect(fmtMoney(6)).toContain('6');
    expect(fmtMoney(null)).toBe('variavel');
  });

  it('fmtNum should pad numbers', () => {
    const g = GAMES[0]; // max 60, pad 2
    expect(fmtNum(5, g)).toBe('05');
    expect(fmtNum(50, g)).toBe('50');
  });
});
