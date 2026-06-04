import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = join(DATA_DIR, 'loterias.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDB(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      api TEXT,
      color TEXT,
      min_num INTEGER DEFAULT 1,
      max_num INTEGER DEFAULT 60,
      pick INTEGER DEFAULT 6,
      max_pick INTEGER DEFAULT 20,
      price REAL,
      draw TEXT,
      odds INTEGER,
      draw_size INTEGER,
      columns INTEGER,
      federal INTEGER DEFAULT 0,
      extra_name TEXT,
      extra_min INTEGER,
      extra_max INTEGER,
      extra_pick INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL REFERENCES games(id),
      draw_numbers TEXT NOT NULL,
      raw_line TEXT,
      draw_date TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_history_game ON history(game_id);

    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL REFERENCES games(id),
      label TEXT,
      tickets_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS generated_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL REFERENCES games(id),
      strategy TEXT,
      tickets_json TEXT NOT NULL,
      params_json TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS backtest_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL REFERENCES games(id),
      params_json TEXT,
      results_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed games if table is empty
  const count = db.prepare('SELECT COUNT(*) as c FROM games').get() as { c: number };
  if (count.c === 0) {
    const insert = db.prepare(`
      INSERT INTO games (id, name, api, color, min_num, max_num, pick, max_pick, price, draw, odds, draw_size, columns, federal, extra_name, extra_min, extra_max, extra_pick)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const games = [
      ['megasena', 'Mega-Sena', 'megasena', '#10b981', 1, 60, 6, 20, 6, 'ter, qui e sab', 50063860, null, null, 0, null, null, null, null],
      ['lotofacil', 'Lotofácil', 'lotofacil', '#e11d48', 1, 25, 15, 20, 3.5, 'seg a sab', 3268760, null, null, 0, null, null, null, null],
      ['quina', 'Quina', 'quina', '#8b5cf6', 1, 80, 5, 15, 3, 'seg a sab', 24040016, 5, null, 0, null, null, null, null],
      ['lotomania', 'Lotomania', 'lotomania', '#f97316', 0, 99, 50, 50, 3, 'seg, qua e sex', 11372635, 20, null, 0, null, null, null, null],
      ['timemania', 'Timemania', 'timemania', '#0ea5e9', 1, 80, 10, 10, 3.5, 'ter, qui e sab', 26147212, 7, null, 0, null, null, null, null],
      ['duplasena', 'Dupla Sena', 'duplasena', '#ec4899', 1, 50, 6, 15, 3, 'seg, qua e sex', 15890700, null, null, 0, null, null, null, null],
      ['diadesorte', 'Dia de Sorte', 'diadesorte', '#d97706', 1, 31, 7, 15, 3, 'ter, qui e sab', 2629575, null, null, 0, 'Mês', 1, 12, 1],
      ['supersete', 'Super Sete', 'supersete', '#2563eb', 0, 9, 7, 21, 3, 'seg, qua e sex', 10000000, null, 7, 0, null, null, null, null],
      ['maismilionaria', '+Milionária', 'maismilionaria', '#7c3aed', 1, 50, 6, 12, 6, 'qua e sab', 238360500, null, null, 0, 'Trevos', 1, 6, 2],
      ['federal', 'Federal', 'federal', '#059669', 0, 99999, 1, 1, null, 'qua e sab', null, null, null, 1, null, null, null, null],
    ];
    const insertMany = db.transaction(() => {
      for (const g of games) insert.run(...g);
    });
    insertMany();
  }
}

export default db;
