import type { Game, AnalysisResult } from '../types';

let Chart: any = null;

async function getChart(): Promise<any> {
  if (!Chart) {
    const mod = await import('chart.js');
    Chart = mod.Chart;
  }
  return Chart;
}

export async function renderFreqChart(
  canvasId: string,
  g: Game,
  a: AnalysisResult
): Promise<void> {
  const Chart = await getChart();
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  if (!canvas) return;

  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  const nums = a.score.map(s => s.n);
  const freqs = a.score.map(s => s.freq);
  const scores = a.score.map(s => s.score);
  const color = g.color;

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: nums.map(n => String(n).padStart(g.max > 99 ? 3 : 2, '0')),
      datasets: [
        {
          label: 'Frequencia',
          data: freqs,
          backgroundColor: color + '60',
          borderColor: color,
          borderWidth: 1,
          order: 2,
        },
        {
          label: 'Score IA',
          data: scores,
          type: 'line',
          borderColor: '#facc15',
          backgroundColor: '#facc15',
          pointRadius: 2,
          pointHoverRadius: 4,
          tension: 0.3,
          yAxisID: 'y1',
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 11 } } },
      },
      scales: {
        x: {
          ticks: { color: '#94a3b8', font: { size: 9 }, maxRotation: 90 },
          grid: { color: 'rgba(255,255,255,0.05)' },
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#94a3b8', font: { size: 10 } },
          grid: { color: 'rgba(255,255,255,0.05)' },
          title: { display: true, text: 'Frequencia', color: '#94a3b8' },
        },
        y1: {
          position: 'right',
          min: 0,
          max: 100,
          ticks: { color: '#facc15', font: { size: 10 } },
          grid: { display: false },
          title: { display: true, text: 'Score (0-99)', color: '#facc15' },
        },
      },
    },
  });
}

export async function renderPairHeatmap(
  canvasId: string,
  g: Game,
  a: AnalysisResult
): Promise<void> {
  const Chart = await getChart();
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  if (!canvas) return;

  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  const topN = Math.min(15, g.max - g.min + 1);
  const topNums = a.score.slice(0, topN).map(s => s.n);
  const labels = topNums.map(n => String(n).padStart(g.max > 99 ? 3 : 2, '0'));

  const data: number[][] = [];
  for (const aNum of topNums) {
    const row: number[] = [];
    for (const bNum of topNums) {
      if (aNum < bNum) {
        const key = aNum + '-' + bNum;
        row.push(a.pair.get(key) || 0);
      } else if (aNum > bNum) {
        const key = bNum + '-' + aNum;
        row.push(a.pair.get(key) || 0);
      } else {
        row.push(0);
      }
    }
    data.push(row);
  }

  const allVals = data.flat();
  const maxVal = Math.max(...allVals, 1);

  new Chart(canvas, {
    type: 'matrix',
    data: {
      datasets: [{
        data: data.flatMap((row, i) =>
          row.map((v, j) => ({ x: j, y: i, v }))
        ),
        backgroundColor(ctx: any) {
          const v = ctx.raw?.v || 0;
          const alpha = v / maxVal;
          return `rgba(45, 212, 191, ${alpha})`;
        },
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        width: ({ chart }: any) => (chart.chartArea?.width || 300) / labels.length / 1.3,
        height: ({ chart }: any) => (chart.chartArea?.height || 300) / labels.length / 1.3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title(items: any[]) {
              const { x, y } = items[0].raw;
              return `${labels[y]} × ${labels[x]}`;
            },
            label(item: any) {
              return `Frequencia: ${item.raw.v}`;
            },
          },
        },
      },
      scales: {
        x: {
          type: 'category',
          labels,
          ticks: { color: '#94a3b8', font: { size: 9 } },
          grid: { display: false },
        },
        y: {
          type: 'category',
          labels,
          ticks: { color: '#94a3b8', font: { size: 9 } },
          grid: { display: false },
          reverse: true,
        },
      },
    },
  });
}

export async function renderBacktestChart(
  canvasId: string,
  statsAi: Record<number, number>,
  statsRandom: Record<number, number>,
  g: Game
): Promise<void> {
  const Chart = await getChart();
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  if (!canvas) return;

  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  const keys = Array.from({ length: g.pick + 1 }, (_, i) => i).reverse();
  const aiData = keys.map(k => statsAi[k] || 0);
  const rndData = keys.map(k => statsRandom[k] || 0);

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: keys.map(k => `${k} acertos`),
      datasets: [
        {
          label: 'IA Next-Gen',
          data: aiData,
          backgroundColor: g.color,
          borderRadius: 4,
        },
        {
          label: 'Aleatorio',
          data: rndData,
          backgroundColor: '#94a3b8',
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 11 } } },
      },
      scales: {
        x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { beginAtZero: true, ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
      },
    },
  });
}
