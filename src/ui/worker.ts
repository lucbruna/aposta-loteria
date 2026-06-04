import type { Game, Ticket, DrawRow } from '../types';
import { captureError } from '../logger';

let worker: Worker | null = null;
let pendingResolve: ((value: Ticket[]) => void) | null = null;
let pendingReject: ((reason: any) => void) | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../worker/index.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'progress' && pendingProgress) {
        pendingProgress(payload);
      } else if (type === 'result') {
        if (pendingResolve) pendingResolve(payload);
        cleanup();
      } else if (type === 'error') {
        if (pendingReject) pendingReject(new Error(payload));
        cleanup();
      }
    };
    worker.onerror = (e) => {
      captureError('worker:onerror', e);
      if (pendingReject) pendingReject(e);
      cleanup();
    };
  }
  return worker;
}

let pendingProgress: ((pct: number) => void) | null = null;

function cleanup(): void {
  pendingResolve = null;
  pendingReject = null;
  pendingProgress = null;
}

export function terminateWorker(): void {
  if (worker) { worker.terminate(); worker = null; }
}

export function generateWithWorker(
  g: Game,
  count: number,
  strategy: string,
  filterMode: string,
  seedOffset: number,
  hist: DrawRow[],
  simCount: number,
  onProgress?: (pct: number) => void,
): Promise<Ticket[]> {
  return new Promise((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;
    pendingProgress = onProgress || null;

    try {
      const w = getWorker();
      w.postMessage({
        type: 'generate',
        payload: { g, count, strategy, filterMode, seedOffset, hist, simCount },
      });
      } catch (err) {
      captureError('worker:post', err);
      reject(err);
      cleanup();
    }
  });
}
