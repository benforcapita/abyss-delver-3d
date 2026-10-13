export interface BestScore {
  score: number;
  floor: number;
}

/** Versioned localStorage key (LLD §6 names `ad3d.best`; suffixed with a version). */
export const BEST_KEY = 'ad3d.best.v1';

/** Legacy key written by the old platform/lifecycle sdk (pre-v1). */
export const LEGACY_BEST_KEY = 'ad3d.best';

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

/** Parses whatever the legacy key held: {score, floor?}, a bare number, or junk. */
function parseLegacy(raw: string): BestScore | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'number') return { score: sanitize(parsed), floor: 0 };
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const o = parsed as Record<string, unknown>;
      return { score: sanitize(o.score), floor: sanitize(o.floor) };
    }
  } catch {
    /* corrupt */
  }
  return null;
}

/**
 * One-time migration: if v1 is missing and the legacy key exists, copy a
 * sanitized value into v1 (when it holds anything) and remove the legacy key.
 * If v1 already exists the legacy key is just removed. Never throws.
 */
export function migrateLegacyBest(): void {
  try {
    const s = getStorage();
    if (!s) return;
    const legacy = s.getItem(LEGACY_BEST_KEY);
    if (legacy === null) return;
    if (s.getItem(BEST_KEY) === null) {
      const b = parseLegacy(legacy);
      if (b && (b.score > 0 || b.floor > 0)) s.setItem(BEST_KEY, JSON.stringify(b));
    }
    s.removeItem(LEGACY_BEST_KEY);
  } catch {
    /* ignore */
  }
}

export function loadBest(): BestScore {
  try {
    migrateLegacyBest();
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
