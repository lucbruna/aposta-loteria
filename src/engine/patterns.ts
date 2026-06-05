import type { Game, DrawRow, AnalysisResult } from '../types';
import { range, countRuns } from '../utils';

export interface Pattern {
  id: string;
  label: string;
  description: string;
  status: 'ok' | 'warn' | 'risk';
  detail: string;
}

function consecutiveBlocks(pick: number[]): number[][] {
  const blocks: number[][] = [];
  let cur: number[] = [pick[0]];
  for (let i = 1; i < pick.length; i++) {
    if (pick[i] === pick[i - 1] + 1) cur.push(pick[i]);
    else { blocks.push(cur); cur = [pick[i]]; }
  }
  blocks.push(cur);
  return blocks;
}

function repeatsFromLast(pick: number[], hist: DrawRow[]): number[] {
  if (!hist.length) return [];
  const last = hist[hist.length - 1].main;
  return pick.filter(n => last.includes(n));
}

function modularDistribution(pick: number[]): { by: number[]; max: number; balanced: boolean } {
  const buckets: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
  pick.forEach(n => { buckets[n % 9] = (buckets[n % 9] || 0) + 1; });
  const by = Object.values(buckets);
  const max = Math.max(...by);
  const balanced = max <= Math.ceil(pick.length / 9) + 1;
  return { by, max, balanced };
}

function decadeSpread(pick: number[], g: Game): number {
  if (g.max - g.min < 10) return 0;
  const decades = new Set(pick.map(n => Math.floor((n - g.min) / 10)));
  return decades.size;
}

function lastDigitParity(pick: number[]): { even: number; odd: number } {
  let even = 0, odd = 0;
  pick.forEach(n => { (n % 2 === 0 ? even++ : odd++); });
  return { even, odd };
}

export function analyzePatterns(g: Game, pick: number[], a: AnalysisResult): Pattern[] {
  if (g.federal || g.columns) return [];
  const out: Pattern[] = [];

  const blocks = consecutiveBlocks(pick);
  const longest = Math.max(...blocks.map(b => b.length), 0);
  if (longest >= 4) {
    out.push({ id: 'seq', label: 'Sequencia longa', description: '>=4 consecutivos', status: 'risk', detail: `Sequencia de ${longest} (${blocks.find(b => b.length === longest)!.join('-')})` });
  } else if (longest === 3) {
    out.push({ id: 'seq', label: 'Sequencia media', description: '3 consecutivos', status: 'warn', detail: `Sequencia de 3` });
  } else {
    out.push({ id: 'seq', label: 'Sem sequencias longas', description: 'OK', status: 'ok', detail: `Maxima sequencia: ${longest}` });
  }

  const repeats = repeatsFromLast(pick, a.hist);
  if (repeats.length >= 4) {
    out.push({ id: 'rep', label: 'Muitos repetidos do ultimo', description: '>=4 do ultimo', status: 'warn', detail: `${repeats.length} repetidos: ${repeats.join(', ')}` });
  } else {
    out.push({ id: 'rep', label: 'Poucos repetidos do ultimo', description: 'OK', status: 'ok', detail: `${repeats.length} repetidos` });
  }

  const dist = modularDistribution(pick);
  out.push({
    id: 'mod',
    label: 'Distribuicao modular',
    description: 'por ultimo digito (mod 9)',
    status: dist.balanced ? 'ok' : 'warn',
    detail: dist.balanced ? 'Bem distribuido' : `Pico em ${dist.max} na mesma classe`,
  });

  const decades = decadeSpread(pick, g);
  if (decades >= 5) {
    out.push({ id: 'dec', label: 'Cobertura de dezenas', description: '>=5 faixas', status: 'ok', detail: `${decades} faixas cobertas` });
  } else if (decades >= 3) {
    out.push({ id: 'dec', label: 'Cobertura media', description: '3-4 faixas', status: 'warn', detail: `${decades} faixas` });
  } else {
    out.push({ id: 'dec', label: 'Cobertura baixa', description: '<3 faixas', status: 'risk', detail: `Apenas ${decades} faixas` });
  }

  const { even, odd } = lastDigitParity(pick);
  const target = Math.round(g.pick / 2);
  const balance = Math.abs(even - target);
  if (balance <= 1) {
    out.push({ id: 'par', label: 'Paridade', description: 'OK', status: 'ok', detail: `${even}P / ${odd}I` });
  } else if (balance === 2) {
    out.push({ id: 'par', label: 'Paridade', description: 'Levemente desbalanceado', status: 'warn', detail: `${even}P / ${odd}I` });
  } else {
    out.push({ id: 'par', label: 'Paridade', description: 'Desbalanceado', status: 'risk', detail: `${even}P / ${odd}I` });
  }

  const sum = pick.reduce((s, v) => s + v, 0);
  const sumMean = a.hist.length ? a.hist.reduce((s, d) => s + d.main.reduce((x, y) => x + y, 0), 0) / a.hist.length : 0;
  const sumSd = a.hist.length
    ? Math.sqrt(a.hist.reduce((s, d) => s + (d.main.reduce((x, y) => x + y, 0) - sumMean) ** 2, 0) / a.hist.length)
    : 1;
  const z = sumSd ? (sum - sumMean) / sumSd : 0;
  if (Math.abs(z) > 2) {
    out.push({ id: 'sum', label: 'Soma atipica', description: 'fora de 2 sigmas', status: 'warn', detail: `Soma ${sum} (z=${z.toFixed(2)})` });
  } else {
    out.push({ id: 'sum', label: 'Soma tipica', description: 'OK', status: 'ok', detail: `Soma ${sum} (z=${z.toFixed(2)})` });
  }

  return out;
}

export interface CalendarHeatmap {
  monthLabel: string;
  year: number;
  month: number;
  days: { day: number; count: number; avgSum: number; hit: boolean }[];
  total: number;
}

export function buildCalendarHeatmap(g: Game, hist: DrawRow[], year: number, month: number): CalendarHeatmap {
  const filtered = hist.filter(d => {
    if (!d.date) return false;
    const m = d.date.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return false;
    return Number(m[3]) === year && Number(m[2]) === month;
  });

  const days: { day: number; count: number; avgSum: number; hit: boolean }[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const day = filtered.filter(draw => {
      if (!draw.date) return false;
      const m = draw.date.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      return m ? Number(m[1]) === d : false;
    });
    const avgSum = day.length ? day.reduce((s, x) => s + x.main.reduce((a, b) => a + b, 0), 0) / day.length : 0;
    days.push({ day: d, count: day.length, avgSum, hit: day.length > 0 });
  }

  const monthLabel = new Date(year, month - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  return { monthLabel, year, month, days, total: filtered.length };
}

export function patternToHTML(patterns: Pattern[]): string {
  if (!patterns.length) return '';
  return `<div class="pattern-list">${patterns.map(p =>
    `<div class="pattern pattern-${p.status}"><strong>${p.label}</strong> <span class="muted">${p.description}</span><div class="pattern-detail">${p.detail}</div></div>`
  ).join('')}</div>`;
}

export function heatmapToHTML(h: CalendarHeatmap): string {
  const max = Math.max(...h.days.map(d => d.count), 1);
  return `<div class="heatmap"><div class="heatmap-title">${h.monthLabel} (${h.total} sorteios)</div><div class="heatmap-grid">${h.days.map(d => {
    const intensity = d.count / max;
    const bg = d.hit ? `rgba(56,189,248,${0.15 + intensity * 0.7})` : 'transparent';
    return `<div class="heatmap-cell" style="background:${bg}" title="${d.day}: ${d.count} sorteio(s)">${d.day}</div>`;
  }).join('')}</div></div>`;
}

export interface CoOccurrenceMatrix {
  labels: number[];
  matrix: number[][];
  totalDraws: number;
  topPairs: { a: number; b: number; count: number; rate: number }[];
}

export function buildCoOccurrence(g: Game, hist: DrawRow[]): CoOccurrenceMatrix | null {
  if (g.federal || g.columns) return null;
  if (hist.length < 5) return null;
  const labels = range(g);
  const idx = new Map<number, number>();
  labels.forEach((n, i) => idx.set(n, i));
  const matrix: number[][] = labels.map(() => labels.map(() => 0));

  for (const draw of hist) {
    const present = draw.main.filter(n => idx.has(n));
    for (let i = 0; i < present.length; i++) {
      for (let j = i + 1; j < present.length; j++) {
        const a = idx.get(present[i])!;
        const b = idx.get(present[j])!;
        matrix[a][b]++;
        matrix[b][a]++;
      }
    }
  }

  const pairs: { a: number; b: number; count: number; rate: number }[] = [];
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      if (matrix[i][j] > 0) {
        pairs.push({ a: labels[i], b: labels[j], count: matrix[i][j], rate: matrix[i][j] / hist.length });
      }
    }
  }
  pairs.sort((x, y) => y.count - x.count);
  return { labels, matrix, totalDraws: hist.length, topPairs: pairs.slice(0, 15) };
}

export function coOccurrenceToHTML(c: CoOccurrenceMatrix, topN: number = 30): string {
  if (!c) return '';
  const max = Math.max(...c.matrix.flat(), 1);
  const labelsToShow = c.labels.length <= 60 ? c.labels : c.labels.filter((_, i) => i % 2 === 0);
  const labelIdx = new Map<number, number>();
  labelsToShow.forEach((n, i) => labelIdx.set(n, i));
  const cellSize = labelsToShow.length > 30 ? 14 : 22;
  const cells: string[] = [];
  cells.push('<div class="cooc-row cooc-header"><div class="cooc-corner"></div>');
  for (const l of labelsToShow) cells.push(`<div class="cooc-h" style="width:${cellSize}px">${l % 10}</div>`);
  cells.push('</div>');
  for (const li of labelsToShow) {
    cells.push(`<div class="cooc-row"><div class="cooc-v" style="width:${cellSize}px;height:${cellSize}px">${li}</div>`);
    for (const lj of labelsToShow) {
      const ii = labelIdx.get(li)!, jj = labelIdx.get(lj)!;
      const v = c.matrix[ii][jj];
      const intensity = v / max;
      const bg = v === 0 ? 'transparent' : `rgba(56,189,248,${0.1 + intensity * 0.85})`;
      cells.push(`<div class="cooc-cell" style="width:${cellSize}px;height:${cellSize}px;background:${bg}" title="${li}+${lj}: ${v}x">${v > max * 0.5 ? v : ''}</div>`);
    }
    cells.push('</div>');
  }
  const pairsList = c.topPairs.slice(0, topN).map(p =>
    `<div class="cooc-pair"><strong>${p.a}+${p.b}</strong> <span class="muted">${p.count}x</span> <span class="muted">(${(p.rate * 100).toFixed(1)}%)</span></div>`
  ).join('');
  return `<div class="cooc-wrap">
    <details open><summary>Matriz de co-ocorrencia (${c.totalDraws} sorteios)</summary>
    <div class="cooc-scroll"><div class="cooc-grid">${cells.join('')}</div></div>
    <h4 style="margin:12px 0 6px;font-size:13px">Pares mais frequentes</h4>
    <div class="cooc-pairs">${pairsList}</div>
    </details>
  </div>`;
}

void countRuns;
void range;
