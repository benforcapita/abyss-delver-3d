import {getJSON, setJSON} from './storage';
import playgroundConfig from '../../playground_config.json';

/** localStorage key shared with src/platform/config.ts. */
export const SETTINGS_KEY = 'ad3d.settings';

/** Player-facing settings persisted in localStorage['ad3d.settings']. */
export interface UserSettings {
  lookSensitivity: number;
  enableAutoAimAssist: boolean;
  /** Background music volume, 0..1. */
  musicVolume: number;
  /** Sound-effects volume, 0..1. */
  sfxVolume: number;
  /** Camera shake on damage. Defaults on; reduced-motion still suppresses it. */
  screenShake: boolean;
}

export const SETTINGS_LIMITS = {
  lookSensitivity: {min: 0.5, max: 4.0, step: 0.1},
  musicVolume: {min: 0, max: 1, step: 0.05},
  sfxVolume: {min: 0, max: 1, step: 0.05},
} as const;

export const DEFAULT_SETTINGS: Readonly<UserSettings> = Object.freeze({
  lookSensitivity: 1.8,
  // Mirrors the existing config default (playground_config.json, currently true).
  enableAutoAimAssist: playgroundConfig.values?.enableAutoAimAssist === true,
  // Matches BackgroundMusic's historical default so out-of-the-box sound is unchanged.
  musicVolume: 0.15,
  sfxVolume: 0.7,
  screenShake: playgroundConfig.values?.screenShake !== false,
});

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Merge arbitrary (possibly old, partial, or corrupt) data with defaults and
 * clamp every field into range. Older saves may use `defaultMusicVolume` /
 * `defaultSfxVolume` (config keys); these are honoured as fallbacks.
 */
export function normalizeSettings(raw: unknown): UserSettings {
  const src: Record<string, unknown> =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const L = SETTINGS_LIMITS;
  const D = DEFAULT_SETTINGS;
  return {
    lookSensitivity: clampNum(src.lookSensitivity, L.lookSensitivity.min, L.lookSensitivity.max, D.lookSensitivity),
    enableAutoAimAssist:
      typeof src.enableAutoAimAssist === 'boolean' ? src.enableAutoAimAssist : D.enableAutoAimAssist,
    musicVolume: clampNum(src.musicVolume ?? src.defaultMusicVolume, L.musicVolume.min, L.musicVolume.max, D.musicVolume),
    sfxVolume: clampNum(src.sfxVolume ?? src.defaultSfxVolume, L.sfxVolume.min, L.sfxVolume.max, D.sfxVolume),
    screenShake: typeof src.screenShake === 'boolean' ? src.screenShake : D.screenShake,
  };
}

/** Load settings from storage; never throws. */
export function loadSettings(): UserSettings {
  return normalizeSettings(getJSON<unknown>(SETTINGS_KEY));
}

type Listener = (s: UserSettings) => void;
let current: UserSettings = loadSettings();
const listeners = new Set<Listener>();

/** Current in-memory settings (live). */
export function getSettings(): UserSettings {
  return current;
}

/**
 * Apply a partial update, clamp it, persist it, and notify listeners.
 * Unknown keys already in storage (other config overrides) are preserved.
 */
export function saveSettings(patch: Partial<UserSettings>): UserSettings {
  current = normalizeSettings({...current, ...patch});
  const existing = getJSON<unknown>(SETTINGS_KEY);
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  setJSON(SETTINGS_KEY, {...base, ...current});
  listeners.forEach((l) => l(current));
  return current;
}

/** Re-read from storage (e.g. tests, other tabs). */
export function reloadSettings(): UserSettings {
  current = loadSettings();
  listeners.forEach((l) => l(current));
  return current;
}

export function subscribeSettings(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
