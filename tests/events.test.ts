import { describe, it, expect } from 'vitest';
import { on, off, emit } from '../src/events';

describe('Event Bus', () => {
  it('should call listeners on emit', () => {
    let called = false;
    const fn = () => { called = true; };
    on('test-event', fn);
    emit('test-event');
    expect(called).toBe(true);
    off('test-event', fn);
  });

  it('should pass arguments to listeners', () => {
    let result = '';
    const fn = (a: string, b: string) => { result = a + b; };
    on('concat', fn);
    emit('concat', 'hello', 'world');
    expect(result).toBe('helloworld');
    off('concat', fn);
  });

  it('should not call removed listeners', () => {
    let count = 0;
    const fn = () => { count++; };
    on('count', fn);
    emit('count');
    expect(count).toBe(1);
    off('count', fn);
    emit('count');
    expect(count).toBe(1); // Still 1 because listener was removed
  });

  it('should handle multiple listeners', () => {
    let a = 0;
    let b = 0;
    const fn1 = () => { a++; };
    const fn2 = () => { b++; };
    on('multi', fn1);
    on('multi', fn2);
    emit('multi');
    expect(a).toBe(1);
    expect(b).toBe(1);
    off('multi', fn1);
    off('multi', fn2);
  });
});
