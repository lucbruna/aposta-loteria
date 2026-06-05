import type { Game, DrawRow } from '../types';
import { GAMES } from '../config';
import { STATE, saveHistory } from '../state';
import { renderDashboard } from '../ui/dashboard';
import { pushHistory } from '../api';

export function parseHistory(text: string, g: Game): DrawRow[] {
  const normalized = String(text || '')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ');

  const seen = new Set<string>();
  return normalized.split(/\r?\n/)
    .map(line => extractDrawFromLine(line, g))
    .filter((draw): draw is DrawRow => {
      if (!draw) return false;
      const key = draw.main.join('-');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function extractDrawFromLine(line: string, g: Game): DrawRow | null {
  const raw = String(line || '').trim();
  if (!raw) return null;
  const tokens = (raw.match(/\d+/g) || []).map(Number);
  if (!tokens.length) return null;

  if (g.federal) {
    const reversed = tokens.slice().reverse();
    const n = reversed.find((x: number) => x >= 0 && x <= 99999);
    return n == null ? null : { main: [n], raw };
  }

  const firstField = raw.split(/[;\t,]/)[0];
  if (!/^\d+$/.test(firstField)) return null;

  const drawSize = g.drawSize || g.pick;
  const valid = (n: number) => Number.isInteger(n) && n >= g.min && n <= g.max;
  const validNums = tokens.filter(valid);

  const segments: number[][] = [];
  let current: number[] = [];
  tokens.forEach(n => {
    if (valid(n)) current.push(n);
    else if (current.length) { segments.push(current); current = []; }
  });
  if (current.length) segments.push(current);

  let bestResult: { main: number[]; score: number } | null = null;
  const minLen = Math.min(drawSize, Math.max(3, drawSize - 2));

  for (const seg of segments) {
    if (seg.length < minLen) continue;
    const truncated = seg.slice(0, drawSize);
    const unique = [...new Set(truncated)].sort((a, b) => a - b);
    const diff = Math.abs(unique.length - drawSize);
    const score = unique.length * 100 - diff * 50 + (unique.length === truncated.length && unique.length === drawSize ? 100 : 0);
    if (!bestResult || score > bestResult.score) bestResult = { main: unique, score };
  }

  if (bestResult) return { main: bestResult.main, raw };
  if (validNums.length >= minLen) return { main: [...new Set(validNums)].slice(0, drawSize).sort((a, b) => a - b), raw };
  return null;
}

export function detectGameFromFile(name: string, text: string = ''): Game | null {
  const s = (name + ' ' + String(text).slice(0, 4000)).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const tests: Array<[string, RegExp]> = [
    ['maismilionaria', /mais.?milionaria|\+milionaria|milionaria/],
    ['lotofacil', /lotofacil|lotfac|d_lotfac/],
    ['megasena', /mega.?sena|megasena|megase|d_megase/],
    ['quina', /quina|d_quina/],
    ['lotomania', /lotomania|lotoma|d_lotoma/],
    ['timemania', /timemania|time.?mania/],
    ['duplasena', /dupla.?sena|duplasena/],
    ['diadesorte', /dia.?de.?sorte|diadesorte/],
    ['supersete', /super.?sete|supersete/],
    ['federal', /federal/],
  ];
  const hit = tests.find(([, rx]) => rx.test(s));
  return hit ? GAMES.find(g => g.id === hit[0]) || null : null;
}

export function loadHistoryFile(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files && input.files[0];
  if (!file) return;

  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'xlsx') {
    document.getElementById('importMessage')!.innerHTML = 'XLSX nao pode ser lido sem biblioteca externa. Salve como CSV/TXT/HTML.';
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || '');
    const detected = detectGameFromFile(file.name, text);
    const importGame = document.getElementById('importGame') as HTMLSelectElement;
    if (detected) importGame.value = detected.id;
    (document.getElementById('historyText') as HTMLTextAreaElement).value = text;
    document.getElementById('importMessage')!.innerHTML += ` Arquivo carregado: ${file.name}.`;
    importHistory(file.name);
    input.value = '';
  };
  reader.readAsText(file, ext === 'csv' ? 'UTF-8' : 'ISO-8859-1');
}

export function importHistory(_source: string = 'texto colado'): void {
  const importGame = document.getElementById('importGame') as HTMLSelectElement;
  const g = GAMES.find(x => x.id === importGame.value);
  if (!g) return;
  const text = (document.getElementById('historyText') as HTMLTextAreaElement).value;
  const rows = parseHistory(text, g);
  if (!rows.length) {
    document.getElementById('importMessage')!.innerHTML = `Nenhum concurso encontrado para ${g.name}.`;
    return;
  }

  STATE.history[g.id] = rows;
  delete STATE.analysisCache[g.id];
  saveHistory(g.id);
  STATE.forests = {};

  // Sync to API if available
  pushHistory(g.id, rows).then(ok => {
    if (ok) console.log(`History synced to API: ${g.id} (${rows.length} draws)`);
  });

  (document.getElementById('historyText') as HTMLTextAreaElement).value = '';
  renderImportStatus();
  renderDashboard();
  document.getElementById('importMessage')!.innerHTML = `Importado: ${rows.length} concursos de ${g.name}.`;
}

export function renderImportStatus(): void {
  const el = document.getElementById('historyStatus');
  if (!el) return;
  el.innerHTML = `<table class="table">
    <thead><tr><th>Jogo</th><th>Concursos</th><th>Universo</th><th>Aposta</th></tr></thead>
    <tbody>${GAMES.map(g => `<tr><td>${g.name}</td><td>${(STATE.history[g.id] || []).length}</td><td>${g.min}-${g.max}</td><td>${g.pick}${g.extra ? ' + ' + g.extra.pick : ''}</td></tr>`).join('')}</tbody>
  </table>`;
}

export function clearHistory(): void {
  const importGame = document.getElementById('importGame') as HTMLSelectElement;
  const g = GAMES.find(x => x.id === importGame.value);
  if (!g) return;
  STATE.history[g.id] = [];
  delete STATE.analysisCache[g.id];
  saveHistory(g.id);
  renderImportStatus();
  renderDashboard();
}
