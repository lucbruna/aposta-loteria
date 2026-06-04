import { emit } from './events';

const MAX_LOG = 50;

export interface LogEntry {
  ts: number;
  level: 'error' | 'warn' | 'info';
  msg: string;
  detail?: string;
}

const ring: LogEntry[] = [];

export function captureError(context: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  const entry: LogEntry = { ts: Date.now(), level: 'error', msg, detail: context };
  ring.push(entry);
  if (ring.length > MAX_LOG) ring.shift();
  console.error(`[${context}]`, err);
  emit('log-added', entry);
}

export function captureWarn(context: string, msg: string): void {
  const entry: LogEntry = { ts: Date.now(), level: 'warn', msg, detail: context };
  ring.push(entry);
  if (ring.length > MAX_LOG) ring.shift();
  console.warn(`[${context}]`, msg);
}

export function getLogs(level?: 'error' | 'warn' | 'info'): LogEntry[] {
  return level ? ring.filter(e => e.level === level) : [...ring];
}

export function clearLogs(): void {
  ring.length = 0;
}
