import type { Game } from '../types';
import { GAMES, SOURCE_NOTE } from '../config';
import { STATE, saveAnalysisCache, saveFavorites } from '../state';
import { analyze } from '../engine/analyze';
import { buildGame, generateSet } from '../engine/generate';
import { scoreTicket, aiReport, portfolioReport, ensembleScore } from '../engine/score';
import { comb, $, fmtMoney, fmtNum, cfg, copyText } from '../utils';
import { emit, on } from '../events';
import { captureError, captureWarn, getLogs, clearLogs } from '../logger';
import { renderDashboard, renderGame } from './dashboard';
import { renderPicks } from './picks';
import { renderFavorites, saveWallet, copyFavorite, deleteFavorite, clearFavorites } from './favorites';
import { renderQuick, runQuick } from './quick';
import { renderBacktest, runBacktest, runAutoTune } from './backtest';
import { runBudget } from './budget';
import { runWheel, renderWheel } from './wheel';
import { renderImportStatus, importHistory, loadHistoryFile, clearHistory } from '../history/parser';


(window as any).showView = showView;
(window as any).showGame = showGame;
(window as any).toggleNum = toggleNum;
(window as any).setColumn = setColumn;
(window as any).autoFill = autoFill;
(window as any).clearSel = clearSel;
(window as any).copyCurrent = copyCurrent;
(window as any).renderPicks = renderPicks;
(window as any).renderFavorites = renderFavorites;
(window as any).renderQuick = renderQuick;
(window as any).runQuick = runQuick;
(window as any).copyQuick = copyQuick;
(window as any).saveQuick = saveQuick;
(window as any).saveGenerated = saveGenerated;
(window as any).copyPicks = copyPicks;
(window as any).runBacktest = runBacktest;
(window as any).runAutoTune = runAutoTune;
(window as any).runBudget = runBudget;
(window as any).copyBudget = copyBudget;
(window as any).runWheel = runWheel;
(window as any).copyWheel = copyWheel;
(window as any).importHistory = importHistory;
(window as any).loadHistoryFile = loadHistoryFile;
(window as any).clearHistory = clearHistory;
(window as any).toggleTheme = toggleTheme;
(window as any).toggleSide = toggleSide;
(window as any).showLogs = showLogs;
(window as any).copyText = copyText;
(window as any).copyFavorite = copyFavorite;
(window as any).deleteFavorite = deleteFavorite;
(window as any).clearFavorites = clearFavorites;
(window as any).saveWallet = saveWallet;
(window as any).$ = $;

function showView(v: string): void {
  STATE.view = v;
  document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
  $(`view-${v}`).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(x => {
    x.classList.remove('active');
    x.removeAttribute('aria-current');
  });
  document.querySelectorAll(`[data-view="${v}"]`).forEach(x => {
    x.classList.add('active');
    x.setAttribute('aria-current', 'page');
  });

  const map: Record<string, [string, string]> = {
    dashboard: ['Dashboard', 'Analise matematica das principais loterias brasileiras'],
    quick: ['Modo rapido', 'Geracao direta para celular e uso diario'],
    picks: ['Palpites otimizados', 'Geracao por cobertura, equilibrio e diversidade'],
    favorites: ['Favoritas', 'Carteiras salvas no navegador'],
    backtest: ['Backtest IA', 'Teste walk-forward com historico importado'],
    budget: ['Orcamento IA', 'Carteira otimizada por valor disponivel'],
    wheel: ['Fechamento', 'Cobertura combinatoria com base inteligente'],
    import: ['Importar historico', 'Use dados reais para calibrar frequencias e gaps'],
  };
  const m = map[v];
  if (m) { $('pageTitle').textContent = m[0]; $('pageSub').textContent = m[1]; }

  if (v === 'dashboard') renderDashboard();
  if (v === 'quick') renderQuick();
  if (v === 'picks') renderPicks();
  if (v === 'favorites') renderFavorites();
  if (v === 'backtest') renderBacktest();
  if (v === 'budget') runBudget();
  if (v === 'wheel') renderWheel();
  if (v === 'import') renderImportStatus();
  closeSide();
  setTimeout(() => $(`view-${v}`)?.querySelector<HTMLElement>('button, select, input, [tabindex]:not([tabindex="-1"])')?.focus(), 100);
}

function showGame(id: string): void {
  STATE.view = 'game';
  STATE.game = id;
  document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
  $('view-game').classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(x => {
    x.classList.remove('active');
    x.removeAttribute('aria-current');
  });
  document.querySelectorAll(`[data-game="${id}"]`).forEach(x => {
    x.classList.add('active');
    x.setAttribute('aria-current', 'page');
  });
  const g = GAMES.find(x => x.id === id)!;
  $('pageTitle').textContent = g.name;
  $('pageSub').textContent = `${g.draw} | aposta base ${fmtMoney(g.price)}`;
  renderGame(g);
  closeSide();
  setTimeout(() => $('view-game')?.querySelector<HTMLElement>('button, select, input, [tabindex]:not([tabindex="-1"])')?.focus(), 100);
}

function toggleNum(id: string, n: number): void {
  const g = GAMES.find(x => x.id === id)!;
  const sel = STATE.selected[id];
  const i = sel.indexOf(n);
  if (i >= 0) sel.splice(i, 1);
  else if (sel.length < g.pick) sel.push(n);
  sel.sort((a, b) => a - b);
  renderGame(g);
}

function setColumn(id: string, col: number, n: number): void {
  STATE.selected[id][col] = n;
  renderGame(GAMES.find(x => x.id === id)!);
}

function autoFill(id: string): void {
  const g = GAMES.find(x => x.id === id)!;
  STATE.selected[id] = buildGame(g, 'balanced', 0);
  renderGame(g);
}

function clearSel(id: string): void {
  STATE.selected[id] = [];
  renderGame(GAMES.find(x => x.id === id)!);
}

function copyCurrent(id: string): void {
  const g = GAMES.find(x => x.id === id)!;
  copyText(`${g.name}: ${STATE.selected[id].map((n: number) => fmtNum(n, g)).join(' ')}`);
}

function formatTicket(g: Game, p: { main: number[]; extra?: number[]; score?: number }): string {
  return `${g.name}: ${p.main.map((n: number) => fmtNum(n, g)).join(' ')}${p.extra?.length ? ' | Extra: ' + p.extra.join(' ') : ''}`;
}

function copyPicks(): void {
  const g = GAMES.find(x => x.id === ($('bulkGame') as HTMLSelectElement).value) || GAMES[0];
  copyText(STATE.generated.map(p => formatTicket(g, p)).join('\n'));
}

function copyQuick(): void {
  const g = GAMES.find(x => x.id === ($('quickGame') as HTMLSelectElement).value) || GAMES[0];
  copyText(STATE.quick.map(p => formatTicket(g, p)).join('\n'));
}

function saveQuick(): void {
  const g = GAMES.find(x => x.id === ($('quickGame') as HTMLSelectElement).value) || GAMES[0];
  saveWallet(g.id, STATE.quick, 'Modo rapido');
}

function saveGenerated(): void {
  const g = GAMES.find(x => x.id === ($('bulkGame') as HTMLSelectElement).value) || GAMES[0];
  saveWallet(g.id, STATE.generated, 'Palpites otimizados');
}

function copyBudget(): void {
  const g = GAMES.find(x => x.id === ($('budgetGame') as HTMLSelectElement).value) || GAMES[0];
  copyText(STATE.budget.map(p => formatTicket(g, p)).join('\n'));
}

function copyWheel(): void {
  const g = GAMES.find(x => x.id === ($('wheelGame') as HTMLSelectElement).value) || GAMES[0];
  copyText(STATE.wheel.map(p => formatTicket(g, p)).join('\n'));
}

function toggleTheme(): void {
  const html = document.documentElement;
  html.dataset.theme = html.dataset.theme === 'light' ? 'dark' : 'light';
}

function toggleSide(): void { $('side').classList.toggle('open'); }
function closeSide(): void { $('side').classList.remove('open'); }

function showLogs(): void {
  const logs = getLogs();
  const html = logs.map(e =>
    `<div style="padding:6px 0;border-bottom:1px solid var(--line);font-size:11px">
      <span style="color:${e.level === 'error' ? 'var(--red)' : 'var(--yellow)'}">[${e.level}]</span>
      ${new Date(e.ts).toLocaleTimeString()} <strong>${e.msg}</strong>
      ${e.detail ? `<br><span style="color:var(--muted)">${e.detail}</span>` : ''}
    </div>`
  ).join('');
  const view = $('view-dashboard')!;
  view.innerHTML = `
    <div class="card">
      <div class="toolbar">
        <h3 style="margin:0">Log de Erros</h3>
        <button class="btn" onclick="clearLogs();showLogs()">Limpar</button>
        <button class="btn" onclick="renderDashboard()">Voltar</button>
      </div>
      ${html || '<p class="analysis">Nenhum erro registrado.</p>'}
    </div>`;
}

document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    const t = e.target as HTMLElement;
    if (t.getAttribute('onclick') && t.tagName !== 'INPUT' && t.tagName !== 'SELECT') {
      e.preventDefault();
      t.click();
    }
  }
  if (e.key === 'Escape') closeSide();
});

export function init(): void {
  renderNav();
  fillSelects();
  renderDashboard();
  $('picksOutput')!.innerHTML = '<h3>Palpites otimizados</h3><p class="analysis">Escolha a modalidade e clique em Gerar.</p>';
  updateStatus();
  tryFetchLatest();
  autoImportCSV();
  on('log-added', () => {
    const btn = $('logBtn');
    if (btn) {
      btn.style.display = '';
      const cnt = $('logCount');
      if (cnt) cnt.textContent = String(getLogs('error').length);
    }
  });
}

function renderNav(): void {
  $('gameNav')!.innerHTML = GAMES.map(g =>
    `<button class="nav-btn" data-game="${g.id}" onclick="showGame('${g.id}')" aria-label="${g.name}"><span class="nav-dot" style="background:${g.color}" aria-hidden="true"></span>${g.name}</button>`
  ).join('');
}

function fillSelects(): void {
  ['bulkGame', 'importGame', 'backtestGame', 'budgetGame', 'wheelGame', 'quickGame'].forEach(id => {
    $(id)!.innerHTML = GAMES.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
  });
}

function updateStatus(): void {
  const total = GAMES.reduce((s, g) => s + (STATE.history[g.id] || []).length, 0);
  $('dataBadge')!.textContent = total ? `${total} concursos locais` : 'Base local';
}

async function autoImportCSV(): Promise<void> {
  let imported = loadEmbeddedData();
  const files = [
    { id: 'lotofacil', variants: ['Lotofácil.csv', 'Lotofacil.csv', 'lotofacil.csv'] },
    { id: 'megasena', variants: ['Mega-Sena.csv', 'mega-sena.csv'] },
    { id: 'timemania', variants: ['Timemania.csv', 'timemania.csv'] },
    { id: 'quina', variants: ['Quina.csv', 'quina.csv'] },
    { id: 'lotomania', variants: ['Lotomania.csv', 'lotomania.csv'] },
  ];

  for (const f of files) {
    const g = GAMES.find(x => x.id === f.id);
    if (!g || (STATE.history[f.id] || []).length > 0) continue;
    for (const path of f.variants) {
      try {
        const r = await fetch(path, { cache: 'no-store' });
        if (!r.ok) continue;
        const text = await r.text();
        const { parseHistory } = await import('../history/parser');
        const rows = parseHistory(text, g);
        if (rows.length >= 25) {
          STATE.history[f.id] = rows;
          delete STATE.analysisCache[f.id];
          const { saveHistory } = await import('../state');
          saveHistory(f.id);
          imported++;
          break;
        }
      } catch { continue; }
    }
  }

  const total = GAMES.reduce((s, g) => s + (STATE.history[g.id] || []).length, 0);
  if (total) {
    renderDashboard();
    renderImportStatus();
    updateStatus();
  }
  $('dataBadge')!.textContent = total ? `${total} concursos locais` : 'Sem historico - Importe em Importar historico';
}

function loadEmbeddedData(): number {
  const emb = (window as any).__EMBEDDED;
  if (!emb) return 0;
  let loaded = 0;
  GAMES.forEach(g => {
    const arr = emb[g.id];
    if (!arr?.length || (STATE.history[g.id] || []).length >= arr.length) return;
    const rows = arr.map((nums: number[]) => ({
      main: nums.filter((n: number) => n >= g.min && n <= g.max).sort((a: number, b: number) => a - b),
      raw: nums.join(' '),
    }));
    if (rows.length >= 25) { STATE.history[g.id] = rows; delete STATE.analysisCache[g.id]; loaded++; }
  });
  STATE.forests = {};
  return loaded;
}

async function tryFetchLatest(): Promise<void> {
  const APIs = [
    'https://loteriascaixa-api.herokuapp.com/api',
    'https://loteriascaixa-deploy.vercel.app/api',
    'https://loteriaapi.vercel.app/api',
  ];
  let ok = 0;
  const gameList = GAMES.filter(g => !g.federal);
  await Promise.all(gameList.map(async g => {
    for (const base of APIs) {
      try {
        const r = await fetch(`${base}/${g.api}/latest`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(4000),
        });
        if (!r.ok) continue;
        const data = await r.json();
        const nums = (data.dezenas || data.listaDezenas || []).map(Number).filter((n: number) => !Number.isNaN(n));
          if (nums.length >= Math.min(g.pick, 6)) {
            STATE.latest[g.id] = data;
            ok++;
            STATE.latest[g.id].valorAcumuladoProximoConcurso = data.valorAcumuladoProximoConcurso || data.valorAcumulado || data.acumulado || data.valorPremio || data.premio || 0;
            STATE.latest[g.id].valorEstimadoProximoConcurso = data.valorEstimadoProximoConcurso || data.estimativa || data.estimado || data.valorEstimado || 0;
            STATE.latest[g.id].dataProximoConcurso = data.dataProximoConcurso || data.data || data.proximoConcurso || '';
            STATE.latest[g.id].data = data.data || data.dataProximoConcurso || '';
            break;
        }
      } catch { captureWarn('api:fetch', `${g.api} via ${base} failed`); }
    }
  }));
  const badge = $('dataBadge')!;
  if (ok) {
    const total = GAMES.reduce((s, g) => s + (STATE.history[g.id] || []).length, 0);
    badge.textContent = `${ok}/${gameList.length} online · ${total} locais`;
  } else {
    const total = GAMES.reduce((s, g) => s + (STATE.history[g.id] || []).length, 0);
    badge.textContent = total ? `${total} concursos locais` : 'Base local';
  }
  emit('latest-updated');
}

init();
