import type { Game, AnalysisResult } from '../types';

let uplotLoaded = false;
let uplot: any = null;
const _charts: Map<string, any> = new Map();

async function ensureUplot(): Promise<any> {
  if (!uplotLoaded) {
    const mod = await import('uplot');
    uplot = mod.default;
    uplotLoaded = true;
  }
  return uplot;
}

export async function renderFreqChart(
  canvasId: string,
  g: Game,
  a: AnalysisResult,
): Promise<void> {
  const uplot = await ensureUplot();
  const el = document.getElementById(canvasId)?.parentElement;
  if (!el) return;

  // Destroy existing
  const existing = _charts.get(canvasId);
  if (existing) { existing.destroy(); _charts.delete(canvasId); }

  const nums = a.score.slice(0, 60).map(s => s.n);
  const freqs = a.score.slice(0, 60).map(s => s.freq);
  const scores = a.score.slice(0, 60).map(s => s.score);
  const labels = nums.map(n => String(n).padStart(g.max > 99 ? 3 : 2, '0'));

  const chart = new uplot({
    width: el.clientWidth || 400,
    height: 200,
    cursor: { show: true },
    legend: { show: true },
    axes: [
      { stroke: '#94a3b8', grid: { stroke: 'rgba(255,255,255,0.05)' }, ticks: { stroke: 'rgba(255,255,255,0.08)' }, font: '9px system-ui' },
      { stroke: '#94a3b8', grid: { stroke: 'rgba(255,255,255,0.05)' }, ticks: { stroke: 'rgba(255,255,255,0.08)' }, font: '10px system-ui' },
      { stroke: '#facc15', grid: { show: false }, ticks: { stroke: 'rgba(255,255,255,0.08)' }, font: '10px system-ui', side: 1 },
    ],
    scales: {
      x: { time: false },
      y: { range: [0, null] },
      y1: { range: [0, 100], distr: 1 },
    },
    series: [
      { label: labels, value: (u: any, v: any) => labels[v] || '' },
      {
        label: 'Frequencia',
        fill: g.color + '60',
        stroke: g.color,
        width: 1,
        points: { show: false },
      },
      {
        label: 'Score IA',
        stroke: '#facc15',
        width: 1.5,
        points: { size: 2, stroke: '#facc15', fill: '#facc15' },
        scale: 'y1',
      },
    ],
    data: [
      nums.map((_, i) => i),
      freqs,
      scores,
    ],
  }, el);
  _charts.set(canvasId, chart);

  const ro = new ResizeObserver(() => {
    chart.setSize({ width: el.clientWidth || 400, height: 200 });
  });
  ro.observe(el);
}

export async function renderPairHeatmap(
  canvasId: string,
  g: Game,
  a: AnalysisResult,
): Promise<void> {
  // Simple canvas-based heatmap (no extra dependencies)
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const parent = canvas.parentElement;
  if (parent) {
    canvas.width = parent.clientWidth || 300;
    canvas.height = parent.clientHeight || 240;
  }

  const topN = Math.min(12, g.max - g.min + 1);
  const topNums = a.score.slice(0, topN).map(s => s.n);
  const cellW = (canvas.width - 40) / topN;
  const cellH = (canvas.height - 40) / topN;

  const vals: number[] = [];
  for (const aNum of topNums) {
    for (const bNum of topNums) {
      if (aNum === bNum) continue;
      const key = aNum < bNum ? aNum + '-' + bNum : bNum + '-' + aNum;
      vals.push(a.pair.get(key) || 0);
    }
  }
  const maxVal = Math.max(...vals, 1);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < topNums.length; i++) {
    for (let j = 0; j < topNums.length; j++) {
      if (i === j) continue;
      const key = topNums[i] < topNums[j] ? topNums[i] + '-' + topNums[j] : topNums[j] + '-' + topNums[i];
      const v = a.pair.get(key) || 0;
      const alpha = v / maxVal;
      ctx.fillStyle = `rgba(45, 212, 191, ${alpha})`;
      ctx.fillRect(30 + j * cellW, 10 + i * cellH, cellW - 1, cellH - 1);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '8px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(String(v), 30 + j * cellW + cellW / 2, 10 + i * cellH + cellH / 2 + 3);
    }
  }

  // Labels
  ctx.fillStyle = '#94a3b8';
  ctx.font = '9px system-ui';
  ctx.textAlign = 'center';
  for (let i = 0; i < topNums.length; i++) {
    const label = String(topNums[i]).padStart(g.max > 99 ? 3 : 2, '0');
    ctx.fillText(label, 30 + i * cellW + cellW / 2, canvas.height - 4);
    ctx.save();
    ctx.translate(14, 10 + i * cellH + cellH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(label, 0, 3);
    ctx.restore();
  }
}

export async function renderBacktestChart(
  canvasId: string,
  statsAi: Record<number, number>,
  statsRandom: Record<number, number>,
  g: Game,
): Promise<void> {
  const uplot = await ensureUplot();
  const el = document.getElementById(canvasId)?.parentElement;
  if (!el) return;

  const existing = _charts.get(canvasId);
  if (existing) { existing.destroy(); _charts.delete(canvasId); }

  const keys = Array.from({ length: g.pick + 1 }, (_, i) => i).reverse();
  const aiData = keys.map(k => statsAi[k] || 0);
  const rndData = keys.map(k => statsRandom[k] || 0);
  const labels = keys.map(k => `${k}`);

  const chart = new uplot({
    width: el.clientWidth || 400,
    height: 200,
    legend: { show: true },
    axes: [
      { stroke: '#94a3b8', grid: { stroke: 'rgba(255,255,255,0.05)' }, ticks: { stroke: 'rgba(255,255,255,0.08)' }, font: '10px system-ui' },
      { stroke: '#94a3b8', grid: { stroke: 'rgba(255,255,255,0.05)' }, ticks: { stroke: 'rgba(255,255,255,0.08)' }, font: '10px system-ui' },
    ],
    scales: {
      x: { time: false },
      y: { range: [0, null] },
    },
    series: [
      { label: labels, value: (u: any, v: any) => labels[v] || v },
      { label: 'IA Next-Gen', stroke: g.color, fill: g.color + '40', width: 1, points: { show: false } },
      { label: 'Aleatorio', stroke: '#94a3b8', fill: '#94a3b840', width: 1, points: { show: false } },
    ],
    data: [
      keys.map((_, i) => i),
      aiData,
      rndData,
    ],
  }, el);
  _charts.set(canvasId, chart);
}
