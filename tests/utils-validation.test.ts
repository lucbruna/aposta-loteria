import { describe, it, expect } from 'vitest';
import { clampInt, isValidDrawRow, sanitizeText, downloadFile, ticketsToCSV, ticketsToJSON } from '../src/utils';
import { GAMES } from '../src/config';

describe('Utils validation', () => {
  it('clampInt clamps to range', () => {
    expect(clampInt(5, 1, 10, 1)).toBe(5);
    expect(clampInt(0, 1, 10, 1)).toBe(1);
    expect(clampInt(20, 1, 10, 1)).toBe(10);
    expect(clampInt(NaN, 1, 10, 7)).toBe(7);
    expect(clampInt('5', 1, 10, 1)).toBe(5);
  });

  it('isValidDrawRow validates Mega-Sena row', () => {
    const g = GAMES[0];
    expect(isValidDrawRow(g, { main: [1, 2, 3, 4, 5, 6] })).toBe(true);
    expect(isValidDrawRow(g, { main: [1, 2, 3, 4, 5] })).toBe(false);
    expect(isValidDrawRow(g, { main: [1, 2, 3, 4, 5, 5] })).toBe(false);
    expect(isValidDrawRow(g, { main: [1, 2, 3, 4, 5, 100] })).toBe(false);
    expect(isValidDrawRow(g, { main: [1.5, 2, 3, 4, 5, 6] })).toBe(false);
    expect(isValidDrawRow(g, null as any)).toBe(false);
  });

  it('isValidDrawRow validates federal row', () => {
    const g = GAMES.find(x => x.federal);
    if (g) {
      expect(isValidDrawRow(g, { main: [12345] })).toBe(true);
      expect(isValidDrawRow(g, { main: [1, 2] })).toBe(false);
    }
  });

  it('isValidDrawRow validates Super Sete columns', () => {
    const g = GAMES.find(x => x.columns);
    if (g && g.columns) {
      const cols: number[] = [];
      for (let i = 0; i < g.columns; i++) cols.push(5);
      expect(isValidDrawRow(g, { main: cols })).toBe(true);
      const bad: number[] = [...cols.slice(0, -1), 99];
      expect(isValidDrawRow(g, { main: bad })).toBe(false);
    }
  });

  it('sanitizeText strips control characters', () => {
    expect(sanitizeText('hello\x00world')).toBe('helloworld');
    expect(sanitizeText('a'.repeat(10000), 100)).toHaveLength(100);
  });

  it('ticketsToCSV produces valid CSV', () => {
    const g = GAMES[0];
    const csv = ticketsToCSV(g, [{ main: [1, 2, 3, 4, 5, 6], score: 85 }]);
    expect(csv).toContain('#,numeros');
    expect(csv).toContain('01-02-03-04-05-06');
  });

  it('ticketsToJSON produces valid JSON', () => {
    const g = GAMES[0];
    const json = ticketsToJSON(g, [{ main: [1, 2, 3, 4, 5, 6], score: 85 }]);
    const parsed = JSON.parse(json);
    expect(parsed.tickets[0].main).toEqual([1, 2, 3, 4, 5, 6]);
    expect(parsed.tickets[0].score).toBe(85);
  });
});

describe('downloadFile', () => {
  it('creates an anchor and triggers download', () => {
    (URL as any).createObjectURL = (URL as any).createObjectURL || (() => 'blob:fake');
    (URL as any).revokeObjectURL = (URL as any).revokeObjectURL || (() => {});
    let clicked = false;
    const origCreate = document.createElement.bind(document);
    document.createElement = ((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        (el as any).click = () => { clicked = true; };
      }
      return el;
    }) as any;
    downloadFile('test.txt', 'hello');
    expect(clicked).toBe(true);
    document.createElement = origCreate;
  });
});
