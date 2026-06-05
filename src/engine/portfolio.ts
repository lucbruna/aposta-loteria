import type { Game, Ticket } from '../types';
import { GAMES } from '../config';
import { generateSet } from './generate';
import { kellyFraction } from './stats';

export interface PortfolioAllocation {
  gameId: string;
  game: Game;
  weight: number;
  ticketCount: number;
  cost: number;
  expectedCoverage: number;
  tickets: Ticket[];
}

export interface Portfolio {
  budget: number;
  strategy: 'ai' | 'balanced' | 'coverage' | 'contrarian';
  allocations: PortfolioAllocation[];
  totalCost: number;
  totalTickets: number;
  remainingBudget: number;
}

const DEFAULT_WEIGHTS: Record<string, number> = {
  megasena: 1.0,
  lotofacil: 0.85,
  quina: 0.7,
  lotomania: 0.5,
  timemania: 0.4,
  duplasena: 0.4,
  diadesorte: 0.4,
  supersete: 0.5,
  maismilionaria: 0.3,
  federal: 0.2,
};

export function defaultWeight(gameId: string): number {
  return DEFAULT_WEIGHTS[gameId] || 0.5;
}

export function optimizePortfolio(
  budget: number,
  gameIds: string[],
  strategy: 'ai' | 'balanced' | 'coverage' | 'contrarian' = 'ai'
): Portfolio {
  const eligible = gameIds.length ? gameIds : GAMES.map(g => g.id);
  const games = eligible.map(id => GAMES.find(g => g.id === id)).filter(Boolean) as Game[];
  const priceable = games.filter(g => g.price && g.price > 0);

  if (!priceable.length || budget <= 0) {
    return { budget, strategy, allocations: [], totalCost: 0, totalTickets: 0, remainingBudget: budget };
  }

  const totalWeight = priceable.reduce((s, g) => s + defaultWeight(g.id), 0);
  const allocations: PortfolioAllocation[] = [];
  let remaining = budget;
  let totalTickets = 0;

  for (let i = 0; i < priceable.length; i++) {
    const g = priceable[i];
    const price = g.price!;
    const isLast = i === priceable.length - 1;
    const idealShare = isLast ? remaining : Math.floor((budget * defaultWeight(g.id)) / totalWeight);
    const maxAffordable = Math.floor(idealShare / price);
    const targetCount = isLast ? Math.max(0, Math.min(maxAffordable, Math.floor(remaining / price))) : maxAffordable;
    if (targetCount <= 0) continue;

    const cost = targetCount * g.price!;
    if (cost > remaining && !isLast) continue;

    const tickets = generateSet(g, targetCount, strategy, 'standard', 0);
    const expectedCoverage = (g.odds ? 1 / g.odds : 0) * targetCount;

    allocations.push({
      gameId: g.id,
      game: g,
      weight: defaultWeight(g.id),
      ticketCount: tickets.length,
      cost,
      expectedCoverage,
      tickets,
    });
    totalTickets += tickets.length;
    remaining -= cost;
  }

  return {
    budget,
    strategy,
    allocations,
    totalCost: budget - remaining,
    totalTickets,
    remainingBudget: remaining,
  };
}

export function portfolioToSummary(p: Portfolio): string {
  if (!p.allocations.length) {
    return '<p class="analysis">Orcamento insuficiente para qualquer modalidade.</p>';
  }
  const lines = p.allocations.map(a => {
    const pct = ((a.cost / p.budget) * 100).toFixed(0);
    return `<div class="alloc-row">
      <div class="alloc-game" style="--accent:${a.game.color}"><strong>${a.game.name}</strong></div>
      <div class="alloc-count">${a.ticketCount} jogos</div>
      <div class="alloc-cost">R$ ${a.cost.toFixed(2)} (${pct}%)</div>
      <div class="alloc-expected">Cobertura: ${(a.expectedCoverage * 100).toFixed(4)}%</div>
    </div>`;
  }).join('');
  return `<div class="portfolio-summary">
    <div class="alloc-header">
      <div>Modalidade</div><div>Jogos</div><div>Custo</div><div>Cobertura esperada</div>
    </div>
    ${lines}
    <div class="alloc-footer">
      <strong>Total</strong> ${p.totalTickets} jogos | R$ ${p.totalCost.toFixed(2)} | Restante: R$ ${p.remainingBudget.toFixed(2)}
    </div>
  </div>`;
}

export function applyKelly(p: Portfolio, edge: number = 0.05): Portfolio {
  const budget = p.budget;
  for (const a of p.allocations) {
    const odds = a.game.odds || 1;
    const k = kellyFraction(edge, odds);
    const kellyCount = Math.max(1, Math.floor((budget * k) / a.game.price!));
    a.ticketCount = Math.min(a.ticketCount, kellyCount);
  }
  p.allocations = p.allocations.filter(a => a.ticketCount > 0);
  p.totalTickets = p.allocations.reduce((s, a) => s + a.ticketCount, 0);
  p.totalCost = p.allocations.reduce((s, a) => s + a.ticketCount * a.game.price!, 0);
  p.remainingBudget = budget - p.totalCost;
  return p;
}
