import { GAMES } from '../config';
import { STATE } from '../state';
import { generateSet } from '../engine/generate';
import { portfolioReport } from '../engine/score';
import { kellyFraction } from '../engine/stats';
import { comb, fmtMoney, cfg, $ } from '../utils';
import { renderPickRow } from './renderers';
import { showProgress } from './progress';

export function runBudget(): void {
  const g = GAMES.find(x => x.id === ($('budgetGame') as HTMLSelectElement).value) || GAMES[0];
  const budget = Math.max(0, Number(($('budgetValue') as HTMLInputElement).value) || 0);
  const strategy = ($('budgetStrategy') as HTMLSelectElement).value;
  const price = g.price;

  if (!price) {
    $('budgetOutput')!.innerHTML = `<h3>${g.name}</h3><p class="analysis">Preco variavel. Use palpites otimizados.</p>`;
    return;
  }

  STATE._simCount = parseInt(($('budgetSim') as HTMLSelectElement).value) || cfg(g, 'sims');
  const count = Math.max(1, Math.min(300, Math.floor(budget / price)));
  const odds = g.odds || comb(g.max - g.min + 1, g.pick);
  const edge = 0.05;
  const kellyPct = odds ? kellyFraction(edge, odds) : 0.02;
  const kellyCount = Math.max(1, Math.min(count, Math.floor(budget * kellyPct / price)));

  $('budgetOutput')!.innerHTML = `<p class="analysis">Preparando ${count} jogos... Kelly sugere ${kellyCount} jogos.</p>`;

  setTimeout(() => {
    const prog = showProgress('budgetOutput', `Montando carteira de ${count} jogos`);

    STATE.budget = generateSet(g, count, strategy as any, 'standard', 0, (pct) => {
      prog.update(pct);
    });

    prog.done();
    const cost = count * price;
    $('budgetOutput')!.style.setProperty('--accent', g.color);
    $('budgetOutput')!.innerHTML = `<h3>${g.name} | ${fmtMoney(cost)} | ${count} jogos</h3>
      <p class="analysis">${portfolioReport(g, STATE.budget)} Sobra: <strong>${fmtMoney(Math.max(0, budget - cost))}</strong>. Kelly: ${kellyCount} jogos.</p>
      ${STATE.budget.slice(0, 80).map((p, i) => renderPickRow(g, p, i)).join('')}${STATE.budget.length > 80 ? '<p class="analysis">Mostrando 80 primeiros.</p>' : ''}`;
  }, 50);
}
