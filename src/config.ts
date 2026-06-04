import type { Game, EngineConfig, DrawRow } from './types';

export const SOURCE_NOTE = 'Regras conferidas nas paginas oficiais da CAIXA em 03/06/2026.';

export const GAMES: Game[] = [
  { id: 'megasena', api: 'megasena', name: 'Mega-Sena', color: '#10b981', min: 1, max: 60, pick: 6, maxPick: 20, price: 6, draw: 'ter, qui e sab', odds: 50063860, engine: { sims: 3000, gens: 40, pop: 80, mutRate: 0.22, crossRate: 0.7 } },
  { id: 'lotofacil', api: 'lotofacil', name: 'Lotofacil', color: '#e11d48', min: 1, max: 25, pick: 15, maxPick: 20, price: 3.5, draw: 'seg a sab', odds: 3268760, engine: { sims: 5000, gens: 50, pop: 100, mutRate: 0.18, crossRate: 0.75 } },
  { id: 'quina', api: 'quina', name: 'Quina', color: '#8b5cf6', min: 1, max: 80, pick: 5, maxPick: 15, drawSize: 5, price: 3, draw: 'seg a sab', odds: 24040016, engine: { sims: 2000, gens: 30, pop: 60, mutRate: 0.25, crossRate: 0.65 } },
  { id: 'lotomania', api: 'lotomania', name: 'Lotomania', color: '#f97316', min: 0, max: 99, pick: 50, maxPick: 50, drawSize: 20, price: 3, draw: 'seg, qua e sex', odds: 11372635, engine: { sims: 10000, gens: 60, pop: 120, mutRate: 0.12, crossRate: 0.8 } },
  { id: 'timemania', api: 'timemania', name: 'Timemania', color: '#0ea5e9', min: 1, max: 80, pick: 10, maxPick: 10, drawSize: 7, price: 3.5, draw: 'ter, qui e sab', odds: 26147212, engine: { sims: 4000, gens: 45, pop: 90, mutRate: 0.2, crossRate: 0.75 } },
  { id: 'duplasena', api: 'duplasena', name: 'Dupla Sena', color: '#ec4899', min: 1, max: 50, pick: 6, maxPick: 15, price: 3, draw: 'seg, qua e sex', odds: 15890700, engine: { sims: 3000, gens: 40, pop: 80, mutRate: 0.22, crossRate: 0.7 } },
  { id: 'diadesorte', api: 'diadesorte', name: 'Dia de Sorte', color: '#d97706', min: 1, max: 31, pick: 7, maxPick: 15, price: 3, draw: 'ter, qui e sab', odds: 2629575, extra: { name: 'Mes', min: 1, max: 12, pick: 1 }, engine: { sims: 3000, gens: 35, pop: 70, mutRate: 0.2, crossRate: 0.7 } },
  { id: 'supersete', api: 'supersete', name: 'Super Sete', color: '#2563eb', min: 0, max: 9, pick: 7, maxPick: 21, price: 3, draw: 'seg, qua e sex', odds: 10000000, columns: 7 },
  { id: 'maismilionaria', api: 'maismilionaria', name: '+Milionaria', color: '#7c3aed', min: 1, max: 50, pick: 6, maxPick: 12, price: 6, draw: 'qua e sab', odds: 238360500, extra: { name: 'Trevos', min: 1, max: 6, pick: 2 }, engine: { sims: 5000, gens: 50, pop: 100, mutRate: 0.18, crossRate: 0.75 } },
  { id: 'federal', api: 'federal', name: 'Federal', color: '#059669', min: 0, max: 99999, pick: 1, maxPick: 1, price: null, draw: 'qua e sab', odds: null, federal: true },
];

export const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const ENGINE: EngineConfig = {
  sims: 5000,
  gens: 50,
  pop: 100,
  elite: 6,
  mutRate: 0.18,
  crossRate: 0.75,
  decay: 0.88,
  temporalProfile(hist: DrawRow[]): Map<number, number> | null {
    const t = hist.length;
    if (!t) return null;
    const w = Array.from({ length: t }, (_, i) => Math.pow(this.decay, t - 1 - i));
    const s = w.reduce((a, b) => a + b, 0);
    const nw = w.map(v => v / s);
    const f = new Map<number, number>();
    hist.forEach((d, i) => d.main.forEach(n => f.set(n, (f.get(n) || 0) + nw[i])));
    return f;
  },
  coMatrix(g: Game, hist: DrawRow[]): Map<string, number> {
    const m = new Map<string, number>();
    const nums = range(g);
    nums.forEach(a => nums.forEach(b => { if (a < b) m.set(a + '-' + b, 0); }));
    hist.forEach(d => {
      const s = [...new Set(d.main)].filter(n => n >= g.min && n <= g.max).sort((a, b) => a - b);
      for (let i = 0; i < s.length; i++)
        for (let j = i + 1; j < s.length; j++) {
          const k = s[i] + '-' + s[j];
          if (m.has(k)) m.set(k, m.get(k)! + 1);
        }
    });
    return m;
  },
  clusters(g: Game, hist: DrawRow[]): number[][] {
    if (hist.length < 20) return [];
    const co = this.coMatrix(g, hist);
    const nums = range(g);
    const max = Math.max(...Array.from(co.values()), 1);
    const sim = new Map<string, number>();
    nums.forEach(a => nums.forEach(b => { if (a < b) { const k = a + '-' + b; sim.set(k, (co.get(k) || 0) / max); } }));
    const cs: number[][] = [];
    const used = new Set<number>();
    nums.forEach(n => {
      if (used.has(n)) return;
      const c = [n];
      used.add(n);
      nums.forEach(m => {
        if (used.has(m)) return;
        const k = n < m ? n + '-' + m : m + '-' + n;
        if ((sim.get(k) || 0) > 0.12) { c.push(m); used.add(m); }
      });
      if (c.length > 1) cs.push(c);
    });
    return cs;
  },
};

function range(g: Game): number[] {
  return Array.from({ length: g.max - g.min + 1 }, (_, i) => g.min + i);
}
