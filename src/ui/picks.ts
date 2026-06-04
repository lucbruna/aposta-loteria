import type { Game } from '../types';
import { GAMES } from '../config';
import { STATE } from '../state';
import { generateSet } from '../engine/generate';
import { portfolioReport } from '../engine/score';
import { renderPickRow } from './renderers';
import { showProgress } from './progress';
import { $ } from '../utils';
import { generateWithWorker, terminateWorker } from './worker';

export function renderPicks(): void {
  const g = GAMES.find(x => x.id === ($('bulkGame') as HTMLSelectElement).value) || GAMES[0];
  const count = Math.max(1, Math.min(50, Number(($('bulkCount') as HTMLInputElement).value) || 10));
  const strategy = ($('strategy') as HTMLSelectElement).value;
  const filterMode = ($('filterMode') as HTMLSelectElement).value;
  (window as any)._simCount = parseInt(($('simDepth') as HTMLSelectElement).value) || 3000;

  $('picksOutput')!.innerHTML = `<h3>${g.name}</h3><p class="analysis">Gerando ${count} jogos com estrategia <strong>${strategy}</strong>...</p>`;

  setTimeout(async () => {
    const prog = showProgress('picksOutput', `Gerando ${count} jogos (${(window as any)._simCount.toLocaleString()} simulacoes)`);
    const hist = STATE.history[g.id] || [];

    try {
      const tickets = await generateWithWorker(g, count, strategy, filterMode, 0, hist, (window as any)._simCount, (pct) => {
        prog.update(pct);
      });
      STATE.generated = tickets;
      prog.done();
      $('picksOutput')!.style.setProperty('--accent', g.color);
      $('picksOutput')!.innerHTML = `<h3>${g.name} | ${STATE.generated.length} jogos | ${strategy} | ${(window as any)._simCount.toLocaleString()} simulacoes</h3>
        <p class="analysis">${portfolioReport(g, STATE.generated)}</p>
        ${STATE.generated.map((p, i) => renderPickRow(g, p, i)).join('')}`;
    } catch (err) {
      console.warn('Worker error, falling back to direct generation:', err);
      prog.done();
      STATE.generated = generateSet(g, count, strategy as any, filterMode as any, 0, (pct) => {
        prog.update(pct);
      });
      prog.done();
      $('picksOutput')!.style.setProperty('--accent', g.color);
      $('picksOutput')!.innerHTML = `<h3>${g.name} | ${STATE.generated.length} jogos | ${strategy} | ${(window as any)._simCount.toLocaleString()} simulacoes</h3>
        <p class="analysis">${portfolioReport(g, STATE.generated)}</p>
        ${STATE.generated.map((p, i) => renderPickRow(g, p, i)).join('')}`;
    }
  }, 50);
}
