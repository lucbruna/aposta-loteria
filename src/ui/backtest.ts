import { GAMES } from '../config';
import { STATE } from '../state';
import { generateSet } from '../engine/generate';
import { chiSquareTest, ksTest } from '../engine/stats';
import { hitCount, weightedHits, $ } from '../utils';
import { renderBacktestChart } from './charts';
import { showProgress } from './progress';

export function renderBacktest(): void {
  $('backtestOutput')!.innerHTML = '<h3>Backtest walk-forward</h3><p class="analysis">Importe historico real primeiro. O teste treina com concursos anteriores e compara IA vs aleatorio.</p>';
}

export function runBacktest(): void {
  const g = GAMES.find(x => x.id === ($('backtestGame') as HTMLSelectElement).value) || GAMES[0];
  const original = [...(STATE.history[g.id] || [])];
  const limit = Math.max(20, Math.min(Number(($('backtestDraws') as HTMLInputElement).value) || 80, original.length));
  const tickets = Math.max(1, Math.min(10, Number(($('backtestTickets') as HTMLInputElement).value) || 3));
  STATE._simCount = parseInt(($('backtestSim') as HTMLSelectElement).value) || 1000;

  if (g.federal || g.columns || original.length < 25) {
    $('backtestOutput')!.innerHTML = `<h3>${g.name}</h3><p class="analysis">Backtest exige pelo menos 25 concursos.</p>`;
    return;
  }

  const start = Math.max(10, original.length - limit);
  const totalTests = original.length - start;
  const stats: Record<string, Record<number, number>> = { ai: {}, random: {} };
  let bestAi = 0, bestRandom = 0;

  const prog = showProgress('backtestOutput', `Testando ${totalTests} concursos`);

  for (let i = start; i < original.length; i++) {
    STATE.history[g.id] = original.slice(0, i);
    const target = original[i].main;
    const ai = generateSet(g, tickets, 'ai', 'standard', i * 7919);
    const rnd = generateSet(g, tickets, 'random', 'standard', i * 7919);

    const aiBest = Math.max(...ai.map(t => hitCount(t.main, target)));
    const rndBest = Math.max(...rnd.map(t => hitCount(t.main, target)));
    stats.ai[aiBest] = (stats.ai[aiBest] || 0) + 1;
    stats.random[rndBest] = (stats.random[rndBest] || 0) + 1;
    bestAi = Math.max(bestAi, aiBest);
    bestRandom = Math.max(bestRandom, rndBest);

    prog.update(Math.round(((i - start + 1) / totalTests) * 100));
  }

  STATE.history[g.id] = original;
  prog.done();

  const rows = Array.from({ length: g.pick + 1 }, (_, i) => i).reverse();
  const aiW = weightedHits(stats.ai);
  const rndW = weightedHits(stats.random);
  const gain = ((aiW - rndW) / Math.max(rndW, 1) * 100).toFixed(1);
  const chi2 = chiSquareTest(stats.ai, stats.random);
  const ks = ksTest(stats.ai, stats.random);
  const sigText = chi2.p < 0.05 ? 'significativo (p<0.05)' : 'nao significativo';

  $('backtestOutput')!.style.setProperty('--accent', g.color);
  $('backtestOutput')!.innerHTML = `<h3>${g.name} | ${totalTests} concursos testados | ${tickets} jogos/concurso</h3>
    <p class="analysis">Melhor acerto IA: <strong>${bestAi}</strong>. Aleatorio: <strong>${bestRandom}</strong>. Vantagem: <strong>${gain}%</strong>.</p>
    <div style="height:180px;margin:12px 0"><canvas id="backtestChart"></canvas></div>
    <table class="table"><thead><tr><th>Acertos</th><th>IA Next-Gen</th><th>Aleatorio</th></tr></thead>
    <tbody>${rows.map(n => `<tr><td>${n}</td><td>${stats.ai[n] || 0}</td><td>${stats.random[n] || 0}</td></tr>`).join('')}</tbody></table>
    <p class="analysis">Qui-quadrado: ${chi2.chi2.toFixed(2)} (p=${chi2.p.toFixed(4)}) — ${sigText}. KS: D=${ks.toFixed(3)}.</p>`;

  setTimeout(() => renderBacktestChart('backtestChart', stats.ai, stats.random, g), 100);
}

export function runAutoTune(): void {
  const g = GAMES.find(x => x.id === ($('backtestGame') as HTMLSelectElement).value) || GAMES[0];
  const original = [...(STATE.history[g.id] || [])];
  const limit = Math.max(20, Math.min(80, original.length));
  const tickets = 3;

  if (g.federal || g.columns || original.length < 25) {
    $('backtestOutput')!.innerHTML = `<h3>Auto-tune ${g.name}</h3><p class="analysis">Requer historico.</p>`;
    return;
  }

  const grids = [
    { gens: 30, pop: 60, mutRate: 0.22, crossRate: 0.65 },
    { gens: 40, pop: 80, mutRate: 0.18, crossRate: 0.7 },
    { gens: 50, pop: 100, mutRate: 0.15, crossRate: 0.75 },
  ];

  $('backtestOutput')!.innerHTML = `<h3>Auto-tune ${g.name}</h3><p class="analysis">Testando ${grids.length} configuracos...</p>`;

  setTimeout(() => {
    const start = Math.max(10, original.length - limit);
    const results = grids.map(cfg => {
      const stats: any = { ai: {}, random: {}, total: 0, bestAi: 0, bestRandom: 0 };
      for (let i = start; i < original.length; i++) {
        STATE.history[g.id] = original.slice(0, i);
        const target = original[i].main;
        (g as any).engine = { ...cfg };
        const ai = generateSet(g, tickets, 'ai', 'standard', i * 7919);
        const rnd = generateSet(g, tickets, 'random', 'standard', i * 7919);
        const aiBest = Math.max(...ai.map(t => hitCount(t.main, target)));
        const rndBest = Math.max(...rnd.map(t => hitCount(t.main, target)));
        stats.ai[aiBest] = (stats.ai[aiBest] || 0) + 1;
        stats.random[rndBest] = (stats.random[rndBest] || 0) + 1;
        stats.bestAi = Math.max(stats.bestAi, aiBest);
        stats.bestRandom = Math.max(stats.bestRandom, rndBest);
        stats.total++;
      }
      STATE.history[g.id] = original;
      const w = weightedHits(stats.ai) - weightedHits(stats.random);
      return { cfg, stats, score: w };
    });

    results.sort((a, b) => b.score - a.score);
    delete (g as any).engine;

    $('backtestOutput')!.innerHTML = `<h3>Auto-tune ${g.name}</h3>
      <table class="table"><thead><tr><th>Config</th><th>Vantagem</th><th>Melhor IA</th><th>Melhor Rnd</th></tr></thead>
      <tbody>${results.map((r, i) =>
        `<tr${i === 0 ? ' style="background:color-mix(in srgb,var(--accent) 15%,transparent)"' : ''}>
          <td>gens=${r.cfg.gens}, pop=${r.cfg.pop}, mut=${r.cfg.mutRate}, cross=${r.cfg.crossRate}</td>
          <td>${r.score}</td><td>${r.stats.bestAi}</td><td>${r.stats.bestRandom}</td></tr>`
      ).join('')}</tbody></table>
      <p class="analysis">Configuracao lider destacada.</p>`;
  }, 50);
}
