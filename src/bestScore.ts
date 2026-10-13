export interface BestScore {
  score: number;
  floor: number;
}

/** Versioned localStorage key (LLD §6 names `ad3d.best`; suffixed with a version). */
export const BEST_KEY = 'ad3d.best.v1';

const DEFAULT_BEST: BestScore = { score: 0, floor: 0 };

function getStorage(): Storage | null {
  try {
    const s = (globalThis as { localStorage?: Storage }).localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

function sanitize(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
}

export function loadBest(): BestScore {
  try {
    const raw = getStorage()?.getItem(BEST_KEY);
    if (!raw) return { ...DEFAULT_BEST };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...DEFAULT_BEST };
    const o = parsed as Record<string, unknown>;
    return { score: sanitize(o.score), floor: sanitize(o.floor) };
  } catch {
    return { ...DEFAULT_BEST };
  }
}

/** Merges with the stored best (max per field) and returns the resulting best. Never throws. */
export function saveBest(entry: BestScore): BestScore {
  const prev = loadBest();
  const next: BestScore = {
    score: Math.max(prev.score, sanitize(entry?.score)),
    floor: Math.max(prev.floor, sanitize(entry?.floor)),
  };
  try {
    getStorage()?.setItem(BEST_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
