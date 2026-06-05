import type { Game } from '../types';
import { GAMES } from '../config';
import { STATE } from '../state';
import { generateSet } from '../engine/generate';
import { portfolioReport } from '../engine/score';
import { analyzePatterns, patternToHTML, buildCalendarHeatmap, heatmapToHTML } from '../engine/patterns';
import { analyze } from '../engine/analyze';
import { renderPickRow } from './renderers';
import { showProgress } from './progress';
import { $, downloadFile, ticketsToCSV, ticketsToJSON, fmtNum } from '../utils';
import { generateWithWorker } from './worker';

export function renderPicks(): void {
  const g = GAMES.find(x => x.id === ($('bulkGame') as HTMLSelectElement).value) || GAMES[0];
  const count = Math.max(1, Math.min(50, Number(($('bulkCount') as HTMLInputElement).value) || 10));
  const strategy = ($('strategy') as HTMLSelectElement).value;
  const filterMode = ($('filterMode') as HTMLSelectElement).value;
  STATE._simCount = parseInt(($('simDepth') as HTMLSelectElement).value) || 3000;

  $('picksOutput')!.innerHTML = `<h3>${g.name}</h3><p class="analysis">Gerando ${count} jogos com estrategia <strong>${strategy}</strong>...</p>`;

  setTimeout(async () => {
    STATE._cancelled = false;
    const prog = showProgress('picksOutput', `Gerando ${count} jogos (${STATE._simCount!.toLocaleString()} simulacoes)`, () => { STATE._cancelled = true; });
    const hist = STATE.history[g.id] || [];

    try {
      const tickets = await generateWithWorker(g, count, strategy, filterMode, 0, hist, STATE._simCount!, (pct) => {
        prog.update(pct);
      });
      STATE.generated = tickets;
      prog.done();
      $('picksOutput')!.style.setProperty('--accent', g.color);
      $('picksOutput')!.innerHTML = renderPicksHTML(g, STATE.generated, strategy, STATE._simCount!);
    } catch (err) {
      console.warn('Worker error, falling back to direct generation:', err);
      STATE.generated = generateSet(g, count, strategy as any, filterMode as any, 0, (pct) => {
        prog.update(pct);
      });
      prog.done();
      $('picksOutput')!.style.setProperty('--accent', g.color);
      $('picksOutput')!.innerHTML = renderPicksHTML(g, STATE.generated, strategy, STATE._simCount!);
    }
  }, 50);
}

function renderPicksHTML(g: Game, generated: any[], strategy: string, sims: number): string {
  const ts = new Date().toISOString().slice(0, 10);
  void ts;
  const a = analyze(g);
  const patterns = generated.length && a.hist.length
    ? patternToHTML(generated.slice(0, 3).map(p => analyzePatterns(g, p.main, a)).flat().filter((v, i, arr) => arr.findIndex(x => x.id === v.id) === i))
    : '';
  const heat = a.hist.length ? buildCalendarHeatmap(g, a.hist, new Date().getFullYear(), new Date().getMonth() + 1) : null;
  const heatHTML = heat ? heatmapToHTML(heat) : '';
  return `<h3>${g.name} | ${generated.length} jogos | ${strategy} | ${sims.toLocaleString()} simulacoes</h3>
    <p class="analysis">${portfolioReport(g, generated)}</p>
    <div class="action-row" style="margin:8px 0;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn" onclick="exportPicksCSV('${g.id}')" aria-label="Exportar CSV">Exportar CSV</button>
      <button class="btn" onclick="exportPicksJSON('${g.id}')" aria-label="Exportar JSON">Exportar JSON</button>
      <button class="btn" onclick="exportPicksText('${g.id}')" aria-label="Copiar texto">Copiar texto</button>
      <button class="btn" onclick="saveCurrentFavorites('${g.id}')" aria-label="Salvar todos nos favoritos">Salvar todos</button>
    </div>
    ${heatHTML}
    ${patterns ? `<details open class="patterns-section"><summary>Padroes detectados (primeiros 3 jogos)</summary>${patterns}</details>` : ''}
    <div style="margin-top:8px"><button class="btn" onclick="compareStrategies('${g.id}')">Comparar estrategias</button></div>
    ${generated.map((p, i) => renderPickRow(g, p, i)).join('')}`;
}

export function exportPicksCSV(gId: string): void {
  const g = GAMES.find(x => x.id === gId);
  if (!g || !STATE.generated.length) return;
  const ts = new Date().toISOString().slice(0, 10);
  downloadFile(`loterias_${g.id}_${ts}.csv`, ticketsToCSV(g, STATE.generated), 'text/csv;charset=utf-8');
}

export function exportPicksJSON(gId: string): void {
  const g = GAMES.find(x => x.id === gId);
  if (!g || !STATE.generated.length) return;
  const ts = new Date().toISOString().slice(0, 10);
  downloadFile(`loterias_${g.id}_${ts}.json`, ticketsToJSON(g, STATE.generated), 'application/json;charset=utf-8');
}

export function exportPicksText(gId: string): void {
  const g = GAMES.find(x => x.id === gId);
  if (!g || !STATE.generated.length) return;
  const text = STATE.generated.map((p, i) => `${i + 1}. ${p.main.map(n => fmtNum(n, g)).join(' ')}${p.extra?.length ? ' | ' + (g.extra?.name || 'Extra') + ': ' + p.extra.join(' ') : ''}`).join('\n');
  downloadFile(`loterias_${g.id}_${new Date().toISOString().slice(0, 10)}.txt`, text);
}

export async function compareStrategies(gId: string): Promise<void> {
  const g = GAMES.find(x => x.id === gId);
  if (!g) return;
  const hist = STATE.history[g.id] || [];
  if (!hist.length) {
    alert('Importe o historico da modalidade para comparar estrategias.');
    return;
  }
  const count = 5;
  const out: Record<string, { avg: number; tickets: any[] }> = {};
  for (const strat of ['balanced', 'coverage', 'contrarian', 'ai'] as const) {
    const t = generateSet(g, count, strat as any, 'standard', 0);
    const avg = t.reduce((s, x) => s + (x.score || 0), 0) / t.length;
    out[strat] = { avg: Math.round(avg), tickets: t };
  }
  $('picksOutput')!.style.setProperty('--accent', g.color);
  $('picksOutput')!.innerHTML = `<h3>${g.name} - Comparacao de estrategias (${count} jogos cada)</h3>
    <div class="compare-grid">${Object.entries(out).map(([k, v]) =>
      `<div class="compare-col"><h4 style="color:${g.color}">${k}</h4><div class="muted">Score medio: <strong>${v.avg}</strong></div>${v.tickets.map(t => `<div class="pick-row"><div class="balls">${t.main.map((n: number) => `<span class="ball small pick" style="--accent:${g.color}">${fmtNum(n, g)}</span>`).join('')}</div><div class="muted">${t.score}/99</div></div>`).join('')}</div>`
    ).join('')}</div>`;
}
