/**
 * Safe localStorage helpers. Every access is guarded so calls are no-ops when
 * storage is unavailable (SSR, privacy mode, quota errors).
 */

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getItem(key: string): string | null {
  try {
    return getStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function setItem(key: string, value: string): void {
  try {
    getStorage()?.setItem(key, value);
  } catch {}
}

export function removeItem(key: string): void {
  try {
    getStorage()?.removeItem(key);
  } catch {}
}

export function getJSON<T>(key: string): T | null {
  const raw = getItem(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setJSON(key: string, value: unknown): void {
  try {
    setItem(key, JSON.stringify(value));
  } catch {}
}
