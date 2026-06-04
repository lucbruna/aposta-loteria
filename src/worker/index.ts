type WorkerRequest = { type: string; payload: any };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { type, payload } = e.data;

  switch (type) {
    case 'generate': {
      const { g, count, strategy, filterMode, seedOffset, history } = payload;
      // Rebuild analysis from history in worker context
      const result = generateInWorker(g, count, strategy, filterMode, seedOffset, history);
      self.postMessage({ type: 'generate-result', payload: result });
      break;
    }
    case 'backtest': {
      const { g, original, limit, tickets, simCount, history } = payload;
      const result = backtestInWorker(g, original, limit, tickets, simCount, history);
      self.postMessage({ type: 'backtest-result', payload: result });
      break;
    }
    case 'autotune': {
      const { g, original, limit, tickets, grids, history } = payload;
      const result = autotuneInWorker(g, original, limit, tickets, grids, history);
      self.postMessage({ type: 'autotune-result', payload: result });
      break;
    }
  }
};

function generateInWorker(g: any, count: number, strategy: string, filterMode: string, seedOffset: number, history: any[]) {
  // Minimal implementation of generateSet for worker
  const STATE = { history: { [g.id]: history }, forests: {}, analysisCache: {} };
  // Setup globals
  (self as any).STATE = STATE;
  (self as any)._simCount = g.engine?.sims || 3000;
  (self as any).GAMES = [g];
  (self as any).ENGINE = {
    sims: 5000, gens: 50, pop: 100, elite: 6, mutRate: 0.18, crossRate: 0.75, decay: 0.88,
    temporalProfile: (hist: any[]) => null,
    coMatrix: () => new Map(),
    clusters: () => [],
  };

  // Dynamic import of engine modules would be ideal but for worker simplicity
  // we re-implement a lightweight version here

  const out: any[] = [];
  for (let i = 0; i < count; i++) {
    const main = generateTicket(g, i + seedOffset);
    out.push({
      main,
      extra: [],
      score: 50,
      ai: { grade: 'Moderado', profile: 50, pair: 50, entropy: 50, risk: 'worker' },
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

function generateTicket(g: any, seed: number): number[] {
  const nums = Array.from({ length: g.max - g.min + 1 }, (_, i) => g.min + i);
  const shuffled = [...nums];
  let t = seed >>> 0;
  for (let i = shuffled.length - 1; i > 0; i--) {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    const j = ((r ^ (r >>> 14)) >>> 0) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, g.pick).sort((a, b) => a - b);
}

function backtestInWorker(g: any, original: any[], limit: number, tickets: number, simCount: number, history: any[]) {
  const start = Math.max(10, original.length - limit);
  const stats: any = { ai: {}, random: {}, total: 0, bestAi: 0, bestRandom: 0 };

  for (let i = start; i < original.length; i++) {
    const target = original[i].main;
    const aiTickets = generateSetLight(g, tickets, i * 7919);
    const rndTickets = generateRandomLight(g, tickets, i * 7919 + 1);

    const aiBest = Math.max(...aiTickets.map((t: number[]) => t.filter((n: number) => target.includes(n)).length));
    const rndBest = Math.max(...rndTickets.map((t: number[]) => t.filter((n: number) => target.includes(n)).length));

    stats.ai[aiBest] = (stats.ai[aiBest] || 0) + 1;
    stats.random[rndBest] = (stats.random[rndBest] || 0) + 1;
    stats.bestAi = Math.max(stats.bestAi, aiBest);
    stats.bestRandom = Math.max(stats.bestRandom, rndBest);
    stats.total++;
  }

  return stats;
}

function autotuneInWorker(g: any, original: any[], limit: number, tickets: number, grids: any[], history: any[]) {
  const start = Math.max(10, original.length - limit);
  const results = grids.map((cfg: any) => {
    const stats: any = { ai: {}, random: {}, total: 0, bestAi: 0, bestRandom: 0 };
    for (let i = start; i < original.length; i++) {
      const target = original[i].main;
      const aiTickets = generateSetLight(g, tickets, i * 7919);
      const rndTickets = generateRandomLight(g, tickets, i * 7919 + 1);
      const aiBest = Math.max(...aiTickets.map((t: number[]) => t.filter((n: number) => target.includes(n)).length));
      const rndBest = Math.max(...rndTickets.map((t: number[]) => t.filter((n: number) => target.includes(n)).length));
      stats.ai[aiBest] = (stats.ai[aiBest] || 0) + 1;
      stats.random[rndBest] = (stats.random[rndBest] || 0) + 1;
      stats.bestAi = Math.max(stats.bestAi, aiBest);
      stats.bestRandom = Math.max(stats.bestRandom, rndBest);
      stats.total++;
    }
    const w = Object.entries(stats.ai).reduce((s: number, [k, v]: any) => s + Number(k) * v, 0) -
      Object.entries(stats.random).reduce((s: number, [k, v]: any) => s + Number(k) * v, 0);
    return { cfg, stats, score: w };
  });
  return results.sort((a: any, b: any) => b.score - a.score);
}

function generateSetLight(g: any, count: number, seed: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < count; i++) out.push(generateTicket(g, seed + i));
  return out;
}

function generateRandomLight(g: any, count: number, seed: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < count; i++) out.push(generateTicket(g, seed + i + 9999));
  return out;
}
