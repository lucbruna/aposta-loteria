import { GAMES } from '../config';
import { runWheel as runWheelEngine } from '../engine/wheel';
import { analyze } from '../engine/analyze';
import { comb, $, fmtNum } from '../utils';
import { renderPickRow } from './renderers';
import { showProgress } from './progress';
import { STATE } from '../state';

export function renderWheel(): void {
  $('wheelOutput')!.innerHTML = '<h3>Fechamento</h3><p class="analysis">Escolha base de dezenas e limite de jogos.</p>';
}

export function runWheel(): void {
  const g = GAMES.find(x => x.id === ($('wheelGame') as HTMLSelectElement).value) || GAMES[0];
  if (g.federal || g.columns) {
    $('wheelOutput')!.innerHTML = `<h3>${g.name}</h3><p class="analysis">Fechamento nao se aplica.</p>`;
    return;
  }

  const baseSize = Math.max(g.pick, Math.min(g.maxPick || 25, Number(($('wheelBase') as HTMLInputElement).value) || g.pick + 4));
  const limit = Math.max(1, Math.min(300, Number(($('wheelLimit') as HTMLInputElement).value) || 30));

  const prog = showProgress('wheelOutput', `Analisando ${baseSize} dezenas`);

  STATE.wheel = runWheelEngine(g, baseSize, limit);
  prog.done();

  const base = analyze(g).score.slice(0, baseSize).map(x => x.n).sort((x, y) => x - y);
  const totalComb = comb(baseSize, g.pick);

  $('wheelOutput')!.style.setProperty('--accent', g.color);
  $('wheelOutput')!.innerHTML = `<h3>${g.name} | base ${baseSize} dezenas | ${STATE.wheel.length} jogos</h3>
    <p class="analysis">Base IA: <strong>${base.map(n => fmtNum(n, g)).join(' ')}</strong>. Combinacoes teoricas: <strong>${totalComb.toLocaleString('pt-BR')}</strong>.</p>
    ${STATE.wheel.map((p, i) => renderPickRow(g, p, i)).join('')}`;
}
