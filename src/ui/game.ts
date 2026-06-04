import type { Game, AnalysisResult } from '../types';
import { STATE } from '../state';
import { scoreTicket, aiReport, ensembleScore } from '../engine/score';
import { $, fmtNum } from '../utils';

export function suggestionText(g: Game, a: AnalysisResult, sel: number[]): string {
  if (g.federal) return 'Federal usa bilhete de 5 digitos.';
  if (g.columns) return 'Super Sete trabalha por colunas independentes.';
  const need = g.pick - sel.length;
  const even = sel.filter(n => n % 2 === 0).length;
  const hot = sel.filter(n => a.top.includes(n)).length;
  const cold = sel.filter(n => a.cold.includes(n)).length;
  if (!sel.length) return `<strong>Leitura:</strong> ${a.hist.length} concursos. Top: ${a.top.slice(0, 8).map(n => fmtNum(n, g)).join(', ')}.`;
  if (need > 0) return `<strong>Faltam ${need}.</strong> ${even} pares, ${sel.length - even} impares, ${hot} quentes, ${cold} frias.`;
  return `<strong>Aposta completa.</strong> Score ${scoreTicket(g, sel)}/99.`;
}

export function advancedInsight(g: Game, pick: number[]): string {
  if (g.federal || g.columns) return '<strong>IA:</strong> modalidade aleatoria controlada.';
  const r = aiReport(g, pick);
  const forest = STATE.forests?.[g.id];
  const ensemble = forest ? ensembleScore(g, pick, forest) : null;
  return `<strong>IA Next-Gen:</strong> ${r.grade}. Perfil ${r.profile}/100, Pares ${r.pair}/100, Entropia ${r.entropy}/100${ensemble !== null ? `, Ensemble ML: ${ensemble}/99` : ''}. ${r.risk}.`;
}
