import type { Game, AnalysisResult } from '../types';
import { GAMES } from '../config';
import { STATE } from '../state';
import { analyze } from '../engine/analyze';
import { generateSet } from '../engine/generate';
import { scoreTicket, portfolioReport } from '../engine/score';
import { fmtMoney, comb, $ } from '../utils';
import { renderNumberGrid, renderMetrics, renderPickRow, suggestionText } from './renderers';
import { advancedInsight } from './game';
import { renderFreqChart, renderPairHeatmap } from './charts';

function fmt(v: number | null | undefined): string {
  if (v == null || v === 0) return '-';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function pad(n: number, g: Game): string {
  return String(n).padStart(g.max > 99 ? 5 : 2, '0');
}

export function renderDashboard(): void {
  const totalHist = GAMES.reduce((s, g) => s + (STATE.history[g.id] || []).length, 0);
  const latest = STATE.latest || {};
  const totalAccumulated = GAMES.reduce((s, g) => {
    const d = latest[g.id];
    return s + ((d && d.valorAcumulado) || 0);
  }, 0);
  const onlineCount = Object.keys(latest).filter(k => latest[k]?.concurso).length;

  const heroHTML = `
    <div class="hero">
      <div class="hero-grid">
        <div class="hero-main">
          <h2>Premio Acumulado Total</h2>
          <div class="value" id="heroAccumulated">${fmt(totalAccumulated)}</div>
          <div class="sub">${onlineCount} modalidades online · ${totalHist} concursos na base local</div>
        </div>
        <div class="hero-stats">
          ${[
            ['Modalidades', String(GAMES.length), ''],
            ['Online agora', String(onlineCount), onlineCount ? 'green' : ''],
            ['Prox. Sorteio', nextDrawDate(latest), 'gold'],
          ].map(s => `<div class="hero-stat"><div class="label">${s[0]}</div><div class="value${s[2] ? ' ' + s[2] : ''}">${s[1]}</div></div>`).join('')}
        </div>
      </div>
    </div>`;

  const evolutionHTML = `
    <h3 style="margin:0 0 8px;font-size:13px;font-weight:600">Painel de Evolucao</h3>
    <div class="evolution-grid">
      ${GAMES.map(g => renderEvolutionCard(g)).join('')}
    </div>`;

  $('kpis')!.innerHTML = heroHTML;
  $('gameCards')!.innerHTML = evolutionHTML;

  animateValue('heroAccumulated', totalAccumulated);
}

function nextDrawDate(latest: Record<string, any>): string {
  const dates = GAMES.map(g => {
    const d = latest[g.id];
    if (d?.dataProximoConcurso) return { game: g.name, date: d.dataProximoConcurso };
    return null;
  }).filter(Boolean) as Array<{ game: string; date: string }>;

  if (!dates.length) return '—';
  dates.sort((a, b) => new Date(a.date.split('/').reverse().join('-')).getTime() - new Date(b.date.split('/').reverse().join('-')).getTime());
  return `${dates[0].date} (${dates[0].game})`;
}

function renderEvolutionCard(g: Game): string {
  const a: AnalysisResult = analyze(g);
  const latest = STATE.latest?.[g.id];
  const hist = (STATE.history[g.id] || []).length;
  const accumulated = latest?.valorAcumulado || 0;
  const estimated = latest?.valorEstimadoProximoConcurso || 0;
  const lastDraw = latest?.concurso || '—';
  const lastDate = latest?.data || '';
  const lastNums: number[] = (latest?.dezenas || []).map(Number).filter((n: number) => !isNaN(n));

  const recentDraws = a.hist.slice(-5).reverse();
  const drawDots = recentDraws.slice(0, 5).map(d => {
    const dots = d.main.slice(0, 3);
    return `<span class="evol-dot hit" title="Concurso">${String(dots[0] ?? '').padStart(2, '0')}</span>`;
  }).join('');
  const emptyDots = Math.max(0, 5 - recentDraws.length);
  const emptyHTML = Array(emptyDots).fill('<span class="evol-dot" style="opacity:.3"></span>').join('');

  const maxPrize = Math.max(accumulated, estimated, 1);
  const accumPct = Math.min(100, (accumulated / maxPrize) * 100);

  return `<div class="evolution-card" style="--accent:${g.color}" onclick="showGame('${g.id}')">
    <div class="evol-head">
      <span class="evol-name">${g.name}</span>
      <span class="evol-prize">${fmt(accumulated)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-bottom:2px">
      <span>Acumulado</span>
      <span>Prox: ${fmt(estimated)}</span>
    </div>
    <div class="evol-bar-wrap">
      <div class="evol-bar" style="width:${accumPct}%"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-top:2px">
      <span>Concurso ${lastDraw}</span>
      <span>${lastDate}</span>
      <span>${hist} registros</span>
    </div>
    ${lastNums.length ? `<div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap">${lastNums.slice(0, 6).map(n => `<span class="ball small pick" style="--accent:${g.color};width:22px;height:22px;font-size:9px">${pad(n, g)}</span>`).join('')}</div>` : ''}
    <div class="evol-dots">${drawDots}${emptyHTML}</div>
  </div>`;
}

function animateValue(id: string, target: number): void {
  const el = $(id);
  if (!el) return;
  const start = 0;
  const duration = 1000;
  const startTime = performance.now();
  function tick(now: number): void {
    const pct = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - pct, 3);
    const current = start + (target - start) * eased;
    el.textContent = current.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    if (pct < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

export function renderGame(g: Game): void {
  const a = analyze(g);
  const sel = STATE.selected[g.id];
  const generated = generateSet(g, 5, 'ai');
  const odds = g.odds || comb(g.max - g.min + 1, g.pick);
  const prob = odds ? (1 / odds * 100).toExponential(3) : 'variavel';
  const latest = STATE.latest?.[g.id];
  const accumulated = latest?.valorAcumulado;
  const nextDraw = latest?.dataProximoConcurso || '';
  const estimated = latest?.valorEstimadoProximoConcurso;

  $('gameView')!.innerHTML = `
    <div class="toolbar" style="--accent:${g.color}">
      <button class="btn primary" onclick="autoFill('${g.id}')">Sugestao IA</button>
      <button class="btn" onclick="clearSel('${g.id}')">Limpar</button>
      <button class="btn" onclick="copyCurrent('${g.id}')">Copiar jogo</button>
      <span class="pill">Chance: 1 em ${odds ? odds.toLocaleString('pt-BR') : '?'}</span>
      ${accumulated ? `<span class="pill prize">Acumulado: ${fmtMoney(accumulated)}</span>` : ''}
      ${estimated ? `<span class="pill premium">Prox: ${fmtMoney(estimated)}</span>` : ''}
    </div>
    <div class="grid kpis" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))">
      <div class="card kpi"><div class="label">Aposta base</div><div class="value">${fmtMoney(g.price)}</div><div class="sub">${g.draw}</div></div>
      <div class="card kpi"><div class="label">Probabilidade</div><div class="value">${prob}</div><div class="sub">por jogo simples</div></div>
      <div class="card kpi"><div class="label">Historico</div><div class="value">${a.hist.length}</div><div class="sub">concursos</div></div>
      <div class="card kpi"><div class="label">Score atual</div><div class="value">${sel.length ? scoreTicket(g, sel) : '-'}</div><div class="sub">${sel.length}/${g.pick} selecionados</div></div>
      ${nextDraw ? `<div class="card kpi"><div class="label">Proximo sorteio</div><div class="value" style="font-size:15px">${nextDraw}</div><div class="sub">${estimated ? fmtMoney(estimated) : ''}</div></div>` : ''}
    </div>
    <div class="grid two" style="--accent:${g.color}">
      <div class="card"><h3>Volante</h3><div class="balls">${renderNumberGrid(g, a, sel)}</div></div>
      <div class="card"><h3>Aposta</h3>
        <div class="balls" style="margin-bottom:12px">${sel.length ? sel.map((n: number) => `<span class="ball pick" onclick="toggleNum('${g.id}',${n})" style="--accent:${g.color}">${String(n).padStart(g.max > 99 ? 5 : 2, '0')}</span>`).join('') : '<span class="analysis">Nenhum numero.</span>'}</div>
        <div class="analysis">${suggestionText(g, a, sel)}<br><br>${sel.length === g.pick ? advancedInsight(g, sel) : advancedInsight(g, generated[0].main)}</div>
      </div>
    </div>
    <div class="grid two" style="margin-top:14px;--accent:${g.color}">
      <div class="card"><h3>Frequencia</h3>
        <div style="height:200px"><canvas id="freqChart-${g.id}"></canvas></div>
      </div>
      <div class="card"><h3>Top 5 IA</h3>
        <p class="analysis">${portfolioReport(g, generated)}</p>
        ${generated.map((p, i) => renderPickRow(g, p, i)).join('')}
      </div>
    </div>
    <div class="grid two" style="margin-top:14px;--accent:${g.color}">
      <div class="card"><h3>Forca</h3>${renderMetrics(g, a.score.slice(0, 12), a)}</div>
      <div class="card"><h3>Pares</h3>
        <div style="height:240px"><canvas id="pairChart-${g.id}"></canvas></div>
      </div>
    </div>`;

  setTimeout(() => {
    renderFreqChart(`freqChart-${g.id}`, g, a);
    renderPairHeatmap(`pairChart-${g.id}`, g, a);
  }, 100);
}
