import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {BEST_KEY, LEGACY_BEST_KEY, loadBest, saveBest} from './bestScore';
import {sdk} from './platform/lifecycle';

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

describe('legacy ad3d.best migration', () => {
  it('old key only: migrates to v1 and removes old key', () => {
    store.setItem(LEGACY_BEST_KEY, JSON.stringify({score: 900, floor: 3}));
    expect(loadBest()).toEqual({score: 900, floor: 3});
    expect(JSON.parse(store.getItem(BEST_KEY)!)).toEqual({score: 900, floor: 3});
    expect(store.getItem(LEGACY_BEST_KEY)).toBeNull();
  });
  it('old key without floor or as bare number', () => {
    store.setItem(LEGACY_BEST_KEY, JSON.stringify({score: 400}));
    expect(loadBest()).toEqual({score: 400, floor: 0});
    store.clear();
    store.setItem(LEGACY_BEST_KEY, '250');
    expect(loadBest()).toEqual({score: 250, floor: 0});
  });
  it('both keys present: v1 wins, old key removed', () => {
    store.setItem(BEST_KEY, JSON.stringify({score: 100, floor: 1}));
    store.setItem(LEGACY_BEST_KEY, JSON.stringify({score: 9999, floor: 5}));
    expect(loadBest()).toEqual({score: 100, floor: 1});
    expect(store.getItem(LEGACY_BEST_KEY)).toBeNull();
  });
  it('corrupt old key: defaults, no v1 written, old key removed', () => {
    store.setItem(LEGACY_BEST_KEY, '{not json');
    expect(loadBest()).toEqual({score: 0, floor: 0});
    expect(store.getItem(BEST_KEY)).toBeNull();
    expect(store.getItem(LEGACY_BEST_KEY)).toBeNull();
  });
  it('no keys: defaults and nothing written', () => {
    expect(loadBest()).toEqual({score: 0, floor: 0});
    expect(store.length).toBe(0);
  });
  it('saveBest merges with migrated legacy value', () => {
    store.setItem(LEGACY_BEST_KEY, JSON.stringify({score: 900, floor: 3}));
    expect(saveBest({score: 500, floor: 4})).toEqual({score: 900, floor: 4});
  });
});

describe('lifecycle sdk', () => {
  it('gameOver no longer writes any storage (single save lives in App)', () => {
    sdk.gameOver(1234, 2);
    expect(store.length).toBe(0);
  });
});
