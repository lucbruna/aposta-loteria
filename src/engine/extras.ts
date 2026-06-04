import type { Game } from '../types';
import { sample, todaySeed, hash, mulberry } from '../utils';

export function extrasFor(g: Game, index: number = 0): number[] {
  if (!g.extra) return [];
  const rng = mulberry(todaySeed() + hash(g.id + 'extra') + index * 3571);
  const pool = Array.from({ length: g.extra.max - g.extra.min + 1 }, (_, i) => g.extra!.min + i);
  return sample(pool, g.extra.pick, rng);
}
