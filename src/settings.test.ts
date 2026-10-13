import {beforeEach, describe, expect, it, vi} from 'vitest';

// Minimal in-memory localStorage for the node test environment.
const store = new Map<string, string>();
vi.stubGlobal('window', {
  localStorage: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  },
});

const S = await import('./platform/settings');
const KEY = 'ad3d.settings';

beforeEach(() => {
  store.clear();
  S.reloadSettings();
});

describe('settings store', () => {
  it('has the agreed defaults', () => {
    expect(S.DEFAULT_SETTINGS).toEqual({
      lookSensitivity: 1.8, enableAutoAimAssist: true, musicVolume: 0.15, sfxVolume: 0.7, touchSoftLock: true, screenShake: true,
      keyBindings: S.DEFAULT_SETTINGS.keyBindings,
    });
  });

  it('uses defaults when nothing is saved', () => {
    expect(S.loadSettings()).toEqual(S.DEFAULT_SETTINGS);
    expect(S.getSettings()).toEqual(S.DEFAULT_SETTINGS);
  });

  it('saves and loads round-trip', () => {
    S.saveSettings({lookSensitivity: 2.5, enableAutoAimAssist: false, musicVolume: 0.2, sfxVolume: 0.9});
    expect(JSON.parse(store.get(KEY)!)).toMatchObject({lookSensitivity: 2.5, musicVolume: 0.2});
    expect(S.reloadSettings()).toEqual({
      lookSensitivity: 2.5, enableAutoAimAssist: false, musicVolume: 0.2, sfxVolume: 0.9, touchSoftLock: true, screenShake: true,
      keyBindings: S.DEFAULT_SETTINGS.keyBindings,
    });
  });

  it('falls back to defaults on corrupt JSON', () => {
    store.set(KEY, '{not json');
    expect(S.loadSettings()).toEqual(S.DEFAULT_SETTINGS);
  });

  it.each([['null'], ['42'], ['"str"'], ['[1,2]']])('defaults for non-object %s', (raw) => {
    store.set(KEY, raw);
    expect(S.loadSettings()).toEqual(S.DEFAULT_SETTINGS);
  });

  it('merges partial data with defaults and ignores wrong types', () => {
    store.set(KEY, JSON.stringify({lookSensitivity: 3, enableAutoAimAssist: 'yes', sfxVolume: 'loud'}));
    expect(S.loadSettings()).toEqual({...S.DEFAULT_SETTINGS, lookSensitivity: 3});
  });

  it('loads old saves (config keys, extra keys) and preserves extra keys on save', () => {
    store.set(KEY, JSON.stringify({defaultMusicVolume: 0.1, playerSpeed: 9}));
    expect(S.reloadSettings().musicVolume).toBe(0.1);
    S.saveSettings({sfxVolume: 0.3});
    const saved = JSON.parse(store.get(KEY)!);
    expect(saved.playerSpeed).toBe(9);
    expect(saved.sfxVolume).toBe(0.3);
    expect(saved.musicVolume).toBe(0.1);
  });

  it('clamps out-of-range and non-finite values', () => {
    expect(S.normalizeSettings({lookSensitivity: 99, musicVolume: -1, sfxVolume: 5})).toEqual({
      ...S.DEFAULT_SETTINGS, lookSensitivity: 4, musicVolume: 0, sfxVolume: 1,
    });
    expect(S.normalizeSettings({lookSensitivity: 0.01}).lookSensitivity).toBe(0.5);
    expect(S.normalizeSettings({lookSensitivity: NaN}).lookSensitivity).toBe(1.8);
    expect(S.saveSettings({musicVolume: 3}).musicVolume).toBe(1);
  });

  it('persists key bindings through the store and tolerates old saves without them', () => {
    store.set(KEY, JSON.stringify({lookSensitivity: 2}));
    expect(S.reloadSettings().keyBindings).toEqual(S.DEFAULT_SETTINGS.keyBindings);
    S.saveSettings({keyBindings: {...S.DEFAULT_SETTINGS.keyBindings, attack: 'KeyF'}});
    expect(JSON.parse(store.get(KEY)!).keyBindings.attack).toBe('KeyF');
    expect(S.reloadSettings().keyBindings.attack).toBe('KeyF');
    store.set(KEY, JSON.stringify({keyBindings: 'garbage'}));
    expect(S.reloadSettings().keyBindings).toEqual(S.DEFAULT_SETTINGS.keyBindings);
  });

  it('notifies subscribers and exposes live values via getConfig', async () => {
    const seen: number[] = [];
    const off = S.subscribeSettings((s) => seen.push(s.lookSensitivity));
    S.saveSettings({lookSensitivity: 1.2});
    off();
    S.saveSettings({lookSensitivity: 1.3});
    expect(seen).toEqual([1.2]);
    const {getConfig} = await import('./platform/config');
    expect(getConfig('lookSensitivity')).toBe(1.3);
    S.saveSettings({enableAutoAimAssist: false});
    expect(getConfig('enableAutoAimAssist')).toBe(false);
  });
});
