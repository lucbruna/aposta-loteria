import { GAMES } from '../config';
import { generateSet } from '../engine/generate';
import { portfolioReport } from '../engine/score';
import { renderPickRow } from './renderers';
import { showProgress } from './progress';
import { $, fmtMoney } from '../utils';
import { STATE } from '../state';
import { generateWithWorker, terminateWorker } from './worker';

export function renderQuick(): void {
  $('quickOutput')!.innerHTML = 'Escolha a modalidade e o orcamento, depois clique em Gerar rapido.';
}

export function runQuick(): void {
  const g = GAMES.find(x => x.id === ($('quickGame') as HTMLSelectElement).value) || GAMES[0];
  const budget = Math.max(0, Number(($('quickBudget') as HTMLInputElement).value) || 0);
  const count = g.price ? Math.max(1, Math.min(80, Math.floor(budget / g.price))) : 5;
  (window as any)._simCount = parseInt(($('quickSim') as HTMLSelectElement).value) || 3000;

  $('quickOutput')!.innerHTML = `<p class="analysis">Gerando ${count} jogos...</p>`;

  setTimeout(async () => {
    const prog = showProgress('quickOutput', `Gerando ${count} jogos`);
    const hist = STATE.history[g.id] || [];

    try {
      const tickets = await generateWithWorker(g, count, 'ai', 'standard', 0, hist, (window as any)._simCount, (pct) => {
        prog.update(pct);
      });
      STATE.quick = tickets;
      prog.done();
      $('quickOutput')!.innerHTML = `<h3>${g.name} | ${STATE.quick.length} jogos | ${g.price ? fmtMoney(STATE.quick.length * g.price) : 'preco variavel'} | ${(window as any)._simCount.toLocaleString()} simulacoes</h3>${STATE.quick.map((p, i) => renderPickRow(g, p, i)).join('')}`;
    } catch {
      prog.done();
      $('quickOutput')!.innerHTML = `<p class="analysis">Usando geracao direta...</p>`;
      STATE.quick = generateSet(g, count, 'ai', 'standard', 0, (pct) => {
        prog.update(pct);
      });
      prog.done();
      $('quickOutput')!.innerHTML = `<h3>${g.name} | ${STATE.quick.length} jogos | ${g.price ? fmtMoney(STATE.quick.length * g.price) : 'preco variavel'} | ${(window as any)._simCount.toLocaleString()} simulacoes</h3>${STATE.quick.map((p, i) => renderPickRow(g, p, i)).join('')}`;
    }
  }, 50);
}
