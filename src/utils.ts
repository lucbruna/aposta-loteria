import type { Game } from './types';
import { ENGINE } from './config';

export function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

export function fmtMoney(v: number | null): string {
  return v == null ? 'variavel' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function fmtNum(n: number, g: Game): string {
  return String(n).padStart(g && g.max > 99 ? 5 : 2, '0');
}

export function range(g: Game): number[] {
  return Array.from({ length: g.max - g.min + 1 }, (_, i) => g.min + i);
}

export function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
  return Math.round(r);
}

export function cfg(g: Game, k: keyof NonNullable<typeof g.engine>): number {
  return (g.engine && g.engine[k] !== undefined ? g.engine[k] : ENGINE[k]) as number;
}

export function chance(g: Game): number {
  return comb(g.max - g.min + 1, g.pick);
}

export function todaySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export function mulberry(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function sample(
  pool: number[],
  k: number,
  rng: () => number,
  weights?: Map<number, number>
): number[] {
  const bag = pool.map(n => ({ n, w: Math.max(0.0001, weights ? weights.get(n) || 1 : 1) }));
  const out: number[] = [];
  while (out.length < k && bag.length) {
    const total = bag.reduce((s, x) => s + x.w, 0);
    let hit = rng() * total;
    const idx = bag.findIndex(x => (hit -= x.w) <= 0);
    out.push(bag.splice(idx < 0 ? bag.length - 1 : idx, 1)[0].n);
  }
  return out.sort((a, b) => a - b);
}

export function hitCount(a: number[], b: number[]): number {
  const s = new Set(b);
  return a.filter(n => s.has(n)).length;
}

export function weightedHits(map: Record<number, number>): number {
  return Object.entries(map).reduce((s, [k, v]) => s + Number(k) * v, 0);
}

export async function copyText(text: string): Promise<void> {
  try { await navigator.clipboard.writeText(text); } catch { prompt('Copie:', text); }
}

export function sumArr(a: number[]): number {
  return a.reduce((s, v) => s + v, 0);
}

export function countRuns(pick: number[]): number {
  let runs = 0;
  for (let i = 1; i < pick.length; i++) if (pick[i] === pick[i - 1] + 1) runs++;
  return runs;
}

export function downloadFile(filename: string, content: string, mime: string = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ticketsToCSV(g: Game, tickets: Array<{ main: number[]; extra?: number[]; score?: number }>): string {
  const head = ['#', 'numeros', g.extra?.name || 'extra', 'score'];
  const rows = tickets.map((t, i) => [
    String(i + 1),
    t.main.map(n => fmtNum(n, g)).join('-'),
    t.extra && t.extra.length ? t.extra.join('-') : '',
    t.score != null ? String(t.score) : '',
  ].join(','));
  return [head.join(','), ...rows].join('\n');
}

export function ticketsToJSON(g: Game, tickets: Array<{ main: number[]; extra?: number[]; score?: number }>): string {
  return JSON.stringify({
    game: { id: g.id, name: g.name, pick: g.pick, min: g.min, max: g.max },
    generated: new Date().toISOString(),
    tickets: tickets.map((t, i) => ({
      index: i + 1,
      main: t.main,
      extra: t.extra || [],
      score: t.score || 0,
    })),
  }, null, 2);
}
