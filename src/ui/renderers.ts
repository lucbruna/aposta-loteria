import type { Game, AnalysisResult } from '../types';
import { scoreTicket, aiReport } from '../engine/score';
import { fmtNum } from '../utils';

export function renderNumberGrid(g: Game, a: AnalysisResult, sel: number[]): string {
  if (g.federal) return '<p class="analysis">Federal usa bilhete de 5 digitos.</p>';
  if (g.columns) {
    return Array.from({ length: 7 }, (_, col) =>
      `<div style="width:100%;font-size:12px;color:var(--muted);margin:8px 0 2px">Coluna ${col + 1}</div>` +
      Array.from({ length: 10 }, (_, n) => `<span class="ball ${sel[col] === n ? 'pick' : ''}" onclick="setColumn('${g.id}',${col},${n})" role="button" tabindex="0" aria-label="Coluna ${col + 1}, ${n}" style="--accent:${g.color}">${n}</span>`).join('')
    ).join('');
  }
  const nums = Array.from({ length: g.max - g.min + 1 }, (_, i) => g.min + i);
  return nums.map(n =>
    `<span class="ball ${sel.includes(n) ? 'pick' : ''} ${a.top.includes(n) ? 'reco' : ''}" onclick="toggleNum('${g.id}',${n})" role="button" tabindex="0" aria-label="${fmtNum(n, g)}${sel.includes(n) ? ', selecionado' : ''}" title="Score ${a.weights.get(n) || 50}" style="--accent:${g.color}">${fmtNum(n, g)}</span>`
  ).join('');
}

export function renderMetrics(g: Game, rows: Array<{ n: number; score: number }>, _a: AnalysisResult): string {
  const max = Math.max(...rows.map(x => x.score), 1);
  return `<div class="metric-list">${rows.map(x =>
    `<div class="metric"><strong style="color:${g.color}">${fmtNum(x.n, g)}</strong><div class="bar"><span style="width:${Math.round(x.score / max * 100)}%"></span></div><span>${x.score}</span></div>`
  ).join('')}</div>`;
}

export function renderPickRow(g: Game, p: any, i: number): string {
  const ai = p.ai || aiReport(g, p.main);
  return `<div class="pick-row"><div><div class="balls">${p.main.map((n: number) => `<span class="ball small pick" role="button" tabindex="0" aria-label="${fmtNum(n, g)}" style="--accent:${g.color}">${fmtNum(n, g)}</span>`).join('')}${p.extra?.length ? `<span class="pill">${g.extra?.name}: ${p.extra.join(', ')}</span>` : ''}</div><div class="pick-meta">Jogo ${i + 1} | score ${p.score}/99 | IA ${ai.grade} | perfil ${ai.profile} | pares ${ai.pair} | entropia ${ai.entropy} | ${ai.risk}</div></div><button class="btn" onclick="copyText('${formatTicket(g, p).replace(/'/g, "\\'")}')" aria-label="Copiar jogo ${i + 1}">Copiar</button></div>`;
}

export function formatTicket(g: Game, p: any): string {
  return `${g.name}: ${p.main.map((n: number) => fmtNum(n, g)).join(' ')}${p.extra?.length ? ' | ' + (g.extra?.name || 'Extra') + ': ' + p.extra.join(' ') : ''}`;
}

export function suggestionText(g: Game, a: AnalysisResult, sel: number[]): string {
  if (g.federal) return 'Use mais de um bilhete dentro do seu limite financeiro.';
  if (g.columns) return 'Super Sete trabalha por colunas independentes de 0 a 9.';
  const need = g.pick - sel.length;
  const even = sel.filter(n => n % 2 === 0).length;
  const hot = sel.filter(n => a.top.includes(n)).length;
  const cold = sel.filter(n => a.cold.includes(n)).length;
  if (!sel.length) return `<strong>Leitura:</strong> base com ${a.hist.length} concursos. Top calibrado: ${a.top.slice(0, 8).map(n => fmtNum(n, g)).join(', ')}.`;
  if (need > 0) return `<strong>Faltam ${need}.</strong> Selecionados: ${even} pares, ${sel.length - even} impares, ${hot} quentes, ${cold} frias.`;
  return `<strong>Aposta completa.</strong> Score ${scoreTicket(g, sel)}/99. Pares/impares: ${even}/${sel.length - even}.`;
}
