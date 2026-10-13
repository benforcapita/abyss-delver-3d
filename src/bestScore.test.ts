import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BEST_KEY, loadBest, saveBest } from './bestScore';

function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

let store: Storage;
beforeEach(() => {
  store = memStorage();
  vi.stubGlobal('localStorage', store);
});
afterEach(() => vi.unstubAllGlobals());

describe('bestScore', () => {
  it('returns default when empty', () => {
    expect(loadBest()).toEqual({ score: 0, floor: 0 });
  });
  it('saves and loads', () => {
    saveBest({ score: 1200, floor: 2 });
    expect(loadBest()).toEqual({ score: 1200, floor: 2 });
  });
  it('keeps max of each field independently', () => {
    saveBest({ score: 5000, floor: 1 });
    saveBest({ score: 100, floor: 4 });
    expect(loadBest()).toEqual({ score: 5000, floor: 4 });
  });
  it('uses a versioned key', () => {
    saveBest({ score: 7, floor: 1 });
    expect(BEST_KEY).toMatch(/v\d+$/);
    expect(JSON.parse(store.getItem(BEST_KEY)!)).toEqual({ score: 7, floor: 1 });
  });
  it('falls back on corrupt JSON', () => {
    store.setItem(BEST_KEY, '{not json');
    expect(loadBest()).toEqual({ score: 0, floor: 0 });
    expect(saveBest({ score: 3, floor: 1 })).toEqual({ score: 3, floor: 1 });
  });
  it('falls back on wrong shapes', () => {
    for (const v of ['[1,2]', 'null', '42', '{"score":"x","floor":-3}']) {
      store.setItem(BEST_KEY, v);
      expect(loadBest()).toEqual({ score: 0, floor: 0 });
    }
  });
  it('never throws when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('quota'); },
    });
    expect(loadBest()).toEqual({ score: 0, floor: 0 });
    expect(() => saveBest({ score: 10, floor: 1 })).not.toThrow();
  });
  it('never throws when storage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(loadBest()).toEqual({ score: 0, floor: 0 });
    expect(saveBest({ score: 10, floor: 1 })).toEqual({ score: 10, floor: 1 });
  });
});
