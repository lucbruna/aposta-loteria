import { describe, it, expect } from 'vitest';
import { LRUMap } from '../src/lru';

describe('LRU Map', () => {
  it('should limit entries to max size', () => {
    const cache = new LRUMap<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.size).toBe(3);
    expect(cache.get('a')).toBe(1);

    cache.set('d', 4);
    expect(cache.size).toBe(3);
    expect(cache.has('b')).toBe(false); // 'b' was least recently used
    expect(cache.has('d')).toBe(true);
  });

  it('should promote accessed entries', () => {
    const cache = new LRUMap<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.get('a'); // promotes 'a' to most recently used
    cache.set('d', 4);
    expect(cache.has('a')).toBe(true); // 'a' was promoted
    expect(cache.has('b')).toBe(false); // 'b' was evicted (oldest)
  });

  it('should update existing entries without changing size', () => {
    const cache = new LRUMap<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('a', 99);
    expect(cache.size).toBe(3);
    expect(cache.get('a')).toBe(99);
  });
});
