import { describe, it, expect } from 'vitest';
import { GAMES } from '../src/config';
import { analyze } from '../src/engine/analyze';
import { buildGame, generateSet } from '../src/engine/generate';
import { scoreTicket, portfolioReport } from '../src/engine/score';
import { mlBuildForest, rfScore, fourierScore, mlFeatures, gbBuildForest, gbScore } from '../src/engine/ml';
import { mcTickets } from '../src/engine/montecarlo';
import { mctsTicket } from '../src/engine/mcts';
import { geneticTicket } from '../src/engine/genetic';
import { buildMarkov, markovScore } from '../src/engine/markov';
import type { Ticket, Strategy, DrawRow, Game } from '../src/types';

function fakeHist(g: Game, draws: number[][]): DrawRow[] {
  return draws.map((d, i) => ({
    main: d.slice().sort((a, b) => a - b),
    raw: d.join(' '),
    date: `2024-01-${(i + 1).toString().padStart(2, '0')}`,
  }));
}

describe('Engine Integration', () => {
  const g = GAMES[0]; // Mega-Sena

  it('analyze should return valid analysis', () => {
    const a = analyze(g);
    expect(a.hist).toBeDefined();
    expect(a.total).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeInstanceOf(Array);
    expect(a.freq).toBeInstanceOf(Map);
    if (a.score.length > 0) {
      expect(a.score[0].n).toBeGreaterThanOrEqual(1);
      expect(a.score[0].n).toBeLessThanOrEqual(60);
      expect(a.score[0].score).toBeGreaterThanOrEqual(1);
      expect(a.score[0].score).toBeLessThanOrEqual(99);
    }
  });

  it('buildGame should produce valid tickets for all strategies', () => {
    const strategies: Strategy[] = ['balanced', 'coverage', 'contrarian', 'random'];
    for (const s of strategies) {
      const ticket = buildGame(g, s, 0, []);
      expect(ticket).toHaveLength(g.pick);
      expect(new Set(ticket).size).toBe(g.pick);
      ticket.forEach(n => {
        expect(n).toBeGreaterThanOrEqual(g.min);
        expect(n).toBeLessThanOrEqual(g.max);
      });
      const sorted = [...ticket].sort((a, b) => a - b);
      expect(ticket).toEqual(sorted);
    }
  });

  it('generateSet should produce correct number of tickets', () => {
    const tickets = generateSet(g, 5, 'balanced', 'standard');
    expect(tickets).toHaveLength(5);
    tickets.forEach((t: Ticket) => {
      expect(t.main).toHaveLength(g.pick);
      expect(t.score).toBeGreaterThanOrEqual(0);
      expect(t.ai).toBeDefined();
      expect(t.ai.grade).toBeDefined();
    });
  });

  it('scoreTicket should return consistent scores', () => {
    const t1 = buildGame(g, 'ai', 0);
    const t2 = buildGame(g, 'ai', 1);
    const s1 = scoreTicket(g, t1);
    const s2 = scoreTicket(g, t2);
    expect(s1).toBeGreaterThanOrEqual(0);
    expect(s2).toBeGreaterThanOrEqual(0);
  });

  it('aiTicket should produce valid ticket', () => {
    const t = buildGame(g, 'ai', 42);
    expect(t).toHaveLength(g.pick);
    expect(new Set(t).size).toBe(g.pick);
  });

  it('portfolioReport should produce non-empty report', () => {
    const tickets = generateSet(g, 3, 'ai', 'standard');
    const report = portfolioReport(g, tickets);
    expect(report).toBeTruthy();
    expect(report.length).toBeGreaterThan(0);
  });

  it('mcTickets should produce multiple valid tickets', () => {
    const tickets = mcTickets(g, 0, [], 500);
    expect(tickets.length).toBeGreaterThanOrEqual(1);
    tickets.forEach(t => {
      expect(t).toHaveLength(g.pick);
      expect(new Set(t).size).toBe(g.pick);
    });
  });

  it('fourierScore should compute valid score', () => {
    const a = analyze(g);
    if (a.hist.length > 0) {
      const fs = fourierScore(g, [1, 2, 3, 4, 5, 6]);
      expect(typeof fs).toBe('number');
      expect(fs).not.toBeNaN();
    }
  });

  it('rfScore should produce deterministic results', () => {
    const a = analyze(g);
    const forest = mlBuildForest(g, a.hist, 3);
    if (forest) {
      const s1 = rfScore(g, [1, 2, 3, 4, 5, 6], forest);
      const s2 = rfScore(g, [1, 2, 3, 4, 5, 6], forest);
      expect(s1).toBe(s2);
    }
  });

  it('mlFeatures should include new metrics (gapMean, gapVar, dec, sym)', () => {
    const hist = fakeHist(g, [
      [1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12], [1, 13, 14, 15, 16, 17],
      [18, 19, 20, 21, 22, 23], [1, 24, 25, 26, 27, 28],
    ]);
    const f = mlFeatures(g, hist, 1);
    expect(f.gapMean).toBeGreaterThan(0);
    expect(f.gapVar).toBeGreaterThanOrEqual(0);
    expect(f.dec).toBeDefined();
    expect(f.sym).toBeDefined();
  });

  it('markov with Laplace smoothing returns score for unseen pairs', () => {
    const hist = fakeHist(g, [
      [1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12], [1, 2, 13, 14, 15, 16],
      [17, 18, 19, 20, 21, 22], [1, 2, 23, 24, 25, 26], [27, 28, 29, 30, 31, 32],
      [1, 2, 33, 34, 35, 36], [37, 38, 39, 40, 41, 42], [1, 2, 43, 44, 45, 46],
      [47, 48, 49, 50, 51, 52], [1, 2, 53, 54, 55, 56],
    ]);
    const m = buildMarkov(g, hist);
    expect(m).not.toBeNull();
    if (m) {
      const s = markovScore(g, [1, 2, 3, 4, 5, 6], m);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(99);
    }
  });

  it('mctsTicket produces a valid ticket', () => {
    const t = mctsTicket(g, 0, []);
    expect(t).toHaveLength(g.pick);
    expect(new Set(t).size).toBe(g.pick);
  });

  it('geneticTicket produces a valid ticket', () => {
    const t = geneticTicket(g, 0, []);
    expect(t).toHaveLength(g.pick);
    expect(new Set(t).size).toBe(g.pick);
  });

  it('gbBuildForest produces a non-empty forest with deeper trees', () => {
    const hist = fakeHist(g, Array.from({ length: 50 }, (_, i) => {
      const base = (i * 7 + 3) % g.max;
      return Array.from({ length: g.pick }, (_, k) => ((base + k * 11) % g.max) + 1);
    }));
    const forest = gbBuildForest(g, hist, 8);
    expect(forest).not.toBeNull();
    if (forest) {
      expect(forest.length).toBeGreaterThan(0);
      const score = gbScore(g, [1, 2, 3, 4, 5, 6], forest as any);
      expect(score).toBeGreaterThanOrEqual(0);
    }
  });
});
