import type { Game, AnalysisResult, LatestData } from '../types';
import { GAMES } from '../config';
import { STATE } from '../state';
import { analyze } from '../engine/analyze';
import { generateSet } from '../engine/generate';
import { scoreTicket, portfolioReport } from '../engine/score';
import { fmtMoney, comb, $ } from '../utils';
import { renderNumberGrid, renderMetrics, renderPickRow, suggestionText } from './renderers';
import { advancedInsight } from './game';
import { renderFreqChart, renderPairHeatmap } from './charts';
import { on } from '../events';

let _subscribed = false;

function subscribe(): void {
  if (_subscribed) return;
  _subscribed = true;
  on('latest-updated', () => renderDashboard());
}

function fmt(v: number | null | undefined): string {
  if (v == null || v === 0) return '-';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function pad(n: number, g: Game): string {
  return String(n).padStart(g.max > 99 ? 5 : 2, '0');
}

function getPrize(d: LatestData | undefined): number {
  if (!d) return 0;
  return d.valorAcumuladoProximoConcurso || d.valorAcumulado || d.acumulado || d.valorPremio || d.premio || 0;
}

function getEstimated(d: LatestData | undefined): number {
  if (!d) return 0;
  return d.valorEstimadoProximoConcurso || d.estimativa || d.estimado || d.valorEstimado || 0;
}

export function renderDashboard(): void {
  subscribe();
  const totalHist = GAMES.reduce((s, g) => s + (STATE.history[g.id] || []).length, 0);
  const latest = STATE.latest || {};
  const totalAccumulated = GAMES.reduce((s, g) => {
    return s + getPrize(latest[g.id]);
  }, 0);
  const onlineCount = Object.keys(latest).filter(k => latest[k]?.concurso).length;

  const bestOddsName = [...GAMES].sort((a, b) => (a.odds || Infinity) - (b.odds || Infinity))[0]?.name || '';
  const bestOddsVal = [...GAMES].sort((a, b) => (a.odds || Infinity) - (b.odds || Infinity))[0]?.odds;
  const biggestPrize = GAMES.reduce((best, g) => {
    const p = getPrize(latest[g.id]);
    return p > best.val ? { name: g.name, val: p } : best;
  }, { name: '', val: 0 });

  const heroHTML = `
    <div class="hero">
      <div class="hero-grid">
        <div class="hero-main">
          <h2>${onlineCount ? 'Premio Acumulado Total' : 'Base de Analise'}</h2>
          <div class="value" id="heroAccumulated">${onlineCount ? fmt(totalAccumulated) : totalHist + ' concursos'}</div>
          <div class="sub">${onlineCount ? `${onlineCount} modalidades online · ${totalHist} na base local` : `${GAMES.length} modalidades · ${totalHist} concursos importados`}</div>
        </div>
        <div class="hero-stats">
          ${onlineCount ? [
            ['Modalidades', String(GAMES.length)],
            ['Online agora', String(onlineCount)],
            ['Proximos Sorteios', allDrawsList(latest)],
            ['Maior Acumulado', biggestPrize.val ? fmt(biggestPrize.val) : '—'],
          ].map(s => `<div class="hero-stat"><div class="label">${s[0]}</div><div class="value${s[0] === 'Proximos Sorteios' ? ' draws-list' : ''}">${s[1]}</div></div>`).join('') : [
            ['Modalidades', String(GAMES.length)],
            ['Melhor Chance', bestOddsName],
            ['Chance', bestOddsVal ? '1 em ' + bestOddsVal.toLocaleString('pt-BR') : '—'],
            ['Base Historica', totalHist.toLocaleString('pt-BR') + ' conc'],
          ].map(s => `<div class="hero-stat"><div class="label">${s[0]}</div><div class="value">${s[1]}</div></div>`).join('')}
        </div>
      </div>
    </div>`;

  const evolutionHTML = `
    <h3 style="margin:0 0 8px;font-size:13px;font-weight:600">Painel de Evolucao</h3>
    <div class="evolution-grid">
      ${[...GAMES].sort((a, b) => {
        const ap = getPrize(STATE.latest?.[a.id]) || 0;
        const bp = getPrize(STATE.latest?.[b.id]) || 0;
        if (ap !== bp) return bp - ap;
        const ah = (STATE.history[a.id] || []).length;
        const bh = (STATE.history[b.id] || []).length;
        return bh - ah;
      }).map(g => { try { return renderEvolutionCard(g); } catch { return ''; } }).join('')}
    </div>`;

  $('kpis')!.innerHTML = heroHTML;
  $('gameCards')!.innerHTML = evolutionHTML;

  animateValue('heroAccumulated', totalAccumulated);
}

function nextDrawDate(latest: Record<string, LatestData>): string {
  const dates = GAMES.map(g => {
    const d = latest[g.id];
    if (d?.dataProximoConcurso) return { game: g.name, date: d.dataProximoConcurso };
    if (d?.data) return { game: g.name, date: d.data };
    return null;
  }).filter(Boolean) as Array<{ game: string; date: string }>;

  if (!dates.length) return '—';
  dates.sort((a, b) => new Date(a.date.split('/').reverse().join('-')).getTime() - new Date(b.date.split('/').reverse().join('-')).getTime());
  return `${dates[0].date} (${dates[0].game})`;
}

function allDrawsList(latest: Record<string, LatestData>): string {
  const items = GAMES.map(g => {
    const d = latest[g.id];
    const date = d?.dataProximoConcurso || d?.data || '';
    if (!date) return null;
    return { game: g, date };
  }).filter(Boolean) as Array<{ game: Game; date: string }>;
  if (!items.length) return '—';
  items.sort((a, b) => new Date(a.date.split('/').reverse().join('-')).getTime() - new Date(b.date.split('/').reverse().join('-')).getTime());
  return items.map(x =>
    `<span class="draw-pill" style="--pill:${x.game.color}" title="${x.game.name}">${x.date}</span>`
  ).join('');
}

function renderEvolutionCard(g: Game): string {
  const a: AnalysisResult = analyze(g);
  const latest = STATE.latest?.[g.id];
  const hist = (STATE.history[g.id] || []).length;
  const accumulated = getPrize(latest);
  const estimated = getEstimated(latest);
  const lastDraw = latest?.concurso ? String(latest.concurso) : (hist ? String(hist) : '—');
  const lastDate = latest?.data || '';
  const nextDate = latest?.dataProximoConcurso || '';
  const lastNums: number[] = (latest?.dezenas || []).map(Number).filter((n: number) => !isNaN(n));

  const recentDraws = a.hist.slice(-5).reverse();
  const drawDots = recentDraws.slice(0, 5).map(d => {
    const first = d.main[0];
    return `<span class="evol-dot hit" title="ultimos concursos">${first != null ? String(first).padStart(2, '0') : ''}</span>`;
  }).join('');
  const emptyDots = Math.max(0, 5 - recentDraws.length);
  const emptyHTML = Array(emptyDots).fill('<span class="evol-dot" style="opacity:.2"></span>').join('');

  const online = !!(latest?.concurso);
  const maxPrize = Math.max(accumulated, estimated, 1);
  const accumPct = online ? Math.min(100, (accumulated / maxPrize) * 100) : Math.min(100, hist * 3);
  const freqArr = a.score.slice(0, 5);
  const maxFreq = freqArr[0]?.score || 1;
  const freqPct = Math.min(100, freqArr.reduce((s, x) => s + x.score, 0) / (maxFreq || 1) * 25);
  const freqBars = freqArr.map(x =>
    `<div class="freq-row"><span class="freq-num">${String(x.n).padStart(2, '0')}</span><div class="freq-bar-wrap"><div class="freq-bar" style="width:${(x.score / maxFreq) * 100}%"></div></div><span class="freq-val">${x.score.toFixed(1)}</span></div>`
  ).join('');

  return `<div class="evolution-card" style="--accent:${g.color}" onclick="showGame('${g.id}')">
    <div class="evol-head">
      <span class="evol-name">${g.name}</span>
      <span class="evol-prize">${online ? fmt(accumulated) : (hist ? hist + ' conc' : '—')}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-bottom:2px">
      <span>${online ? 'Acumulado' : 'Frequencia media'}</span>
      <span>${online ? (estimated ? 'Prox: ' + fmt(estimated) : '') : (bestOddsText(g))}</span>
    </div>
    <div class="evol-bar-wrap">
      <div class="evol-bar" style="width:${online ? accumPct : freqPct}%"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-top:2px">
      <span>${online ? 'Concurso ' + lastDraw : (hist ? 'Ultimo concurso' : '')}</span>
      <span>${lastDate}</span>
      <span>${hist} registros</span>
    </div>
    ${nextDate ? `<div style="font-size:10px;color:var(--accent);margin-top:4px;font-weight:600">Proximo: ${nextDate}</div>` : ''}
    ${lastNums.length ? `<div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap">${lastNums.slice(0, 6).map(n => `<span class="ball small pick" style="--accent:${g.color};width:22px;height:22px;font-size:9px">${pad(n, g)}</span>`).join('')}</div>` : ''}
    ${hist ? `<div class="evol-dots">${drawDots}${emptyHTML}</div>` : ''}
    ${freqBars ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--line)"><div style="font-size:9px;color:var(--muted);margin-bottom:4px;font-weight:600">TOP 5 FREQ</div>${freqBars}</div>` : ''}
  </div>`;
}

function bestOddsText(g: Game): string {
  if (!g.odds) return 'chance variavel';
  return '1 em ' + g.odds.toLocaleString('pt-BR');
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
  const accumulated = getPrize(latest);
  const nextDraw = latest?.dataProximoConcurso || latest?.data || '';
  const estimated = getEstimated(latest);

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
