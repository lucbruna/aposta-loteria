import express from 'express';
import cors from 'cors';
import routes from './routes.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const app = express();

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json({ limit: '10mb' }));

app.use('/api', routes);

app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  GET  /api/games`);
  console.log(`  GET  /api/history/:gameId`);
  console.log(`  POST /api/history/:gameId`);
  console.log(`  GET  /api/favorites`);
  console.log(`  POST /api/favorites`);
  console.log(`  DELETE /api/favorites/:id`);
  console.log(`  GET  /api/health`);
});
