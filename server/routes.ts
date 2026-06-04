import { Router, Request, Response } from 'express';
import db, { initDB } from './db.js';

initDB();

const router = Router();

// GET /api/games
router.get('/games', (_req: Request, res: Response) => {
  const games = db.prepare('SELECT * FROM games ORDER BY name').all();
  res.json(games);
});

// GET /api/history/:gameId
router.get('/history/:gameId', (req: Request, res: Response) => {
  const { gameId } = req.params;
  const rows = db.prepare('SELECT * FROM history WHERE game_id = ? ORDER BY id').all(gameId);
  const history = rows.map((r: any) => ({
    main: JSON.parse(r.draw_numbers),
    raw: r.raw_line,
    date: r.draw_date,
  }));
  res.json(history);
});

// POST /api/history/:gameId
router.post('/history/:gameId', (req: Request, res: Response) => {
  const { gameId } = req.params;
  const { draws } = req.body;
  if (!Array.isArray(draws) || !draws.length) {
    res.status(400).json({ error: 'draws array required' });
    return;
  }

  const del = db.prepare('DELETE FROM history WHERE game_id = ?');
  const ins = db.prepare('INSERT INTO history (game_id, draw_numbers, raw_line) VALUES (?, ?, ?)');

  const tx = db.transaction(() => {
    del.run(gameId);
    for (const d of draws) {
      ins.run(gameId, JSON.stringify(d.main), d.raw || null);
    }
  });
  tx();

  res.json({ ok: true, count: draws.length });
});

// GET /api/history/:gameId/count
router.get('/history/:gameId/count', (req: Request, res: Response) => {
  const { gameId } = req.params;
  const row = db.prepare('SELECT COUNT(*) as count FROM history WHERE game_id = ?').get(gameId) as any;
  res.json({ count: row?.count || 0 });
});

// GET /api/history/:gameId/latest
router.get('/history/:gameId/latest', (req: Request, res: Response) => {
  const { gameId } = req.params;
  const row = db.prepare('SELECT * FROM history WHERE game_id = ? ORDER BY id DESC LIMIT 1').get(gameId) as any;
  if (!row) {
    res.json(null);
    return;
  }
  res.json({
    main: JSON.parse(row.draw_numbers),
    raw: row.raw_line,
    date: row.draw_date,
  });
});

// POST /api/favorites
router.post('/favorites', (req: Request, res: Response) => {
  const { gameId, label, tickets } = req.body;
  if (!gameId || !tickets) {
    res.status(400).json({ error: 'gameId and tickets required' });
    return;
  }
  const result = db.prepare(
    'INSERT INTO favorites (game_id, label, tickets_json) VALUES (?, ?, ?)'
  ).run(gameId, label || null, JSON.stringify(tickets));
  res.json({ ok: true, id: result.lastInsertRowid });
});

// GET /api/favorites
router.get('/favorites', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM favorites ORDER BY created_at DESC LIMIT 40').all();
  res.json(rows.map((r: any) => ({
    id: r.id,
    gameId: r.game_id,
    label: r.label,
    date: r.created_at,
    tickets: JSON.parse(r.tickets_json),
  })));
});

// DELETE /api/favorites/:id
router.delete('/favorites/:id', (req: Request, res: Response) => {
  db.prepare('DELETE FROM favorites WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// DELETE /api/favorites
router.delete('/favorites', (_req: Request, res: Response) => {
  db.prepare('DELETE FROM favorites').run();
  res.json({ ok: true });
});

// POST /api/backtest
router.post('/backtest', (req: Request, res: Response) => {
  const { gameId, params, results } = req.body;
  db.prepare(
    'INSERT INTO backtest_results (game_id, params_json, results_json) VALUES (?, ?, ?)'
  ).run(gameId, JSON.stringify(params), JSON.stringify(results));
  res.json({ ok: true });
});

// GET /api/backtest/:gameId
router.get('/backtest/:gameId', (req: Request, res: Response) => {
  const rows = db.prepare(
    'SELECT * FROM backtest_results WHERE game_id = ? ORDER BY created_at DESC LIMIT 10'
  ).all(req.params.gameId);
  res.json(rows.map((r: any) => ({
    id: r.id,
    params: JSON.parse(r.params_json || '{}'),
    results: JSON.parse(r.results_json),
    date: r.created_at,
  })));
});

// GET /api/health
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
