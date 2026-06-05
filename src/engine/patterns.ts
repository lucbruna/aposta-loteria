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

void countRuns;
void range;
