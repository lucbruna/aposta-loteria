import type { Game, AnalysisResult } from '../types';
import { GAMES, SOURCE_NOTE } from '../config';
import { STATE } from '../state';
import { analyze } from '../engine/analyze';
import { generateSet } from '../engine/generate';
import { scoreTicket, portfolioReport } from '../engine/score';
import { comb, fmtMoney, $ } from '../utils';
import { renderNumberGrid, renderMetrics, renderPickRow, suggestionText } from './renderers';
import { advancedInsight } from './game';
import { renderFreqChart, renderPairHeatmap } from './charts';
import { showProgress } from './progress';

export function renderDashboard(): void {
  const totalHist = GAMES.reduce((s, g) => s + (STATE.history[g.id] || []).length, 0);
  $('#kpis')!.innerHTML = [
    ['Modalidades', GAMES.length, 'configuradas com regras atuais'],
    ['Concursos importados', totalHist, 'base local do navegador'],
    ['Melhor chance simples', 'Lotofacil', '1 em 3.268.760'],
    ['Fonte', 'CAIXA', 'regras oficiais verificadas'],
  ].map(k => `<div class="card kpi"><div class="label">${k[0]}</div><div class="value">${k[1]}</div><div class="sub">${k[2]}</div></div>`).join('');

  $('#gameCards')!.innerHTML = GAMES.map(g => {
    const hist = (STATE.history[g.id] || []).length;
    const pick = generateSet(g, 1, 'balanced')[0];
    const pad = (n: number) => String(n).padStart(g.max > 99 ? 5 : 2, '0');
    return `<article class="card game-card" style="--accent:${g.color}" onclick="showGame('${g.id}')">
      <div class="game-head"><div><div class="game-name" style="color:${g.color}">${g.name}</div>
      <div class="game-desc">${g.pick}${g.extra ? ` + ${g.extra.pick} ${g.extra.name}` : ''} numeros | ${fmtMoney(g.price)}</div></div>
      <span class="pill">${hist} concursos</span></div>
      <div class="balls">${pick.main.slice(0, 18).map((n: number) => `<span class="ball small pick" style="--accent:${g.color}">${pad(n)}</span>`).join('')}${pick.main.length > 18 ? `<span class="pill">+${pick.main.length - 18}</span>` : ''}</div>
    </article>`;
  }).join('');
}

export function renderGame(g: Game): void {
  const a = analyze(g);
  const sel = STATE.selected[g.id];
  const generated = generateSet(g, 5, 'ai');
  const odds = g.odds || comb(g.max - g.min + 1, g.pick);
  const prob = odds ? (1 / odds * 100).toExponential(3) : 'variavel';

  $('#gameView')!.innerHTML = `
    <div class="toolbar" style="--accent:${g.color}">
      <button class="btn primary" onclick="autoFill('${g.id}')">Sugestao IA</button>
      <button class="btn" onclick="clearSel('${g.id}')">Limpar</button>
      <button class="btn" onclick="copyCurrent('${g.id}')">Copiar jogo</button>
      <span class="pill">Chance simples: ${odds ? '1 em ' + odds.toLocaleString('pt-BR') : 'depende da emissao'}</span>
    </div>
    <div class="grid kpis">
      <div class="card kpi"><div class="label">Aposta base</div><div class="value">${fmtMoney(g.price)}</div><div class="sub">${g.draw}</div></div>
      <div class="card kpi"><div class="label">Probabilidade</div><div class="value">${prob}</div><div class="sub">por jogo simples</div></div>
      <div class="card kpi"><div class="label">Historico</div><div class="value">${a.hist.length}</div><div class="sub">concursos importados</div></div>
      <div class="card kpi"><div class="label">Score atual</div><div class="value">${sel.length ? scoreTicket(g, sel) : '-'}</div><div class="sub">${sel.length}/${g.pick} selecionados</div></div>
    </div>
    <div class="grid two" style="--accent:${g.color}">
      <div class="card"><h3>Volante inteligente</h3><div class="balls">${renderNumberGrid(g, a, sel)}</div></div>
      <div class="card"><h3>Minha aposta</h3>
        <div class="balls" style="margin-bottom:14px">${sel.length ? sel.map((n: number) => `<span class="ball pick" onclick="toggleNum('${g.id}',${n})" style="--accent:${g.color}">${String(n).padStart(g.max > 99 ? 5 : 2, '0')}</span>`).join('') : '<span class="analysis">Nenhum numero selecionado.</span>'}</div>
        <div class="analysis">${suggestionText(g, a, sel)}<br><br>${sel.length === g.pick ? advancedInsight(g, sel) : advancedInsight(g, generated[0].main)}</div>
      </div>
    </div>
    <div class="grid two" style="margin-top:14px;--accent:${g.color}">
      <div class="card"><h3>Frequencia por numero</h3>
        <div style="height:220px"><canvas id="freqChart-${g.id}"></canvas></div>
      </div>
      <div class="card"><h3>Top 5 jogos IA Next-Gen</h3>
        <p class="analysis">${portfolioReport(g, generated)}</p>
        ${generated.map((p, i) => renderPickRow(g, p, i)).join('')}
      </div>
    </div>
    <div class="grid two" style="margin-top:14px;--accent:${g.color}">
      <div class="card"><h3>Forca estatistica</h3>${renderMetrics(g, a.score.slice(0, 12), a)}</div>
      <div class="card"><h3>Matriz de pares (top 15)</h3>
        <div style="height:260px"><canvas id="pairChart-${g.id}"></canvas></div>
      </div>
    </div>`;

  setTimeout(() => {
    renderFreqChart(`freqChart-${g.id}`, g, a);
    renderPairHeatmap(`pairChart-${g.id}`, g, a);
  }, 100);
}
