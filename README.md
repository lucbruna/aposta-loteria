# Loterias Brasil IA

Motor probabilistico para analise das principais loterias brasileiras com Monte Carlo, Algoritmo Genetico, MCTS, Random Forest e Fourier.

## Modalidades suportadas

Mega-Sena, Lotofácil, Quina, Lotomania, Timemania, Dupla Sena, Dia de Sorte, Super Sete, +Milionária, Federal

## Tech Stack

- **Frontend:** Vite + TypeScript + Chart.js
- **Backend:** Express + SQLite (better-sqlite3)
- **Tests:** Vitest (28 testes)
- **PWA:** Service Worker + Manifest

## Comandos

```bash
npm install           # Instalar dependencias
npm run dev           # Frontend apenas
npm run dev:all       # Frontend + API
npm run api           # API apenas
npm run build         # Build producao
npm test              # Rodar testes
npm run typecheck     # TypeScript strict
```

## API Endpoints

| Method | Path | Descricao |
|--------|------|-----------|
| GET | /api/health | Health check |
| GET | /api/games | Listar jogos |
| GET | /api/history/:gameId | Historico |
| POST | /api/history/:gameId | Salvar historico |
| GET | /api/favorites | Listar favoritas |
| POST | /api/favorites | Salvar favorita |
| DELETE | /api/favorites/:id | Remover favorita |

## Estrutura

```
src/
  engine/     Motor IA (MC, GA, MCTS, RF, Fourier)
  ui/         Interface (dashboard, picks, backtest)
  history/    Parsers de CSV/HTML
  worker/     Web Worker
server/       API REST + SQLite
tests/        Testes unitarios
```

## Disclaimer

Sorteios de loteria sao eventos aleatorios independentes. Nenhum algoritmo aumenta a probabilidade fisica de uma combinacao especifica sair. Este painel melhora qualidade operacional: evita padroes ruins de apostador, calcula chances reais, diversifica jogos e usa historico apenas como diagnostico.
