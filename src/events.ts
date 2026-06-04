type Listener = (...args: any[]) => void;

const listeners = new Map<string, Set<Listener>>();

export function on(event: string, fn: Listener): void {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(fn);
}

export function off(event: string, fn: Listener): void {
  listeners.get(event)?.delete(fn);
}

export function emit(event: string, ...args: any[]): void {
  listeners.get(event)?.forEach(fn => fn(...args));
}
