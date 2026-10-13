import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('window', {
  localStorage: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  },
});

const L = await import('./softLock');
const S = await import('./platform/settings');
const P = { x: 0, z: 0 };
const e = (x: number, z: number, hp = 10) => ({ pos: [x, 1, z] as [number, number, number], hp });
const facing = (yaw: number) => [-Math.sin(yaw), -Math.cos(yaw)];

beforeEach(() => {
  store.clear();
  S.reloadSettings();
});

describe('softLockYaw', () => {
  it('snaps yaw to face the target in the cone', () => {
    const y = L.softLockYaw(P, 0, [e(2, -5)])!; // ~21.8° right of -Z
    const [fx, fz] = facing(y);
    expect(fx).toBeCloseTo(2 / Math.hypot(2, 5));
    expect(fz).toBeCloseTo(-5 / Math.hypot(2, 5));
  });

  it('picks the nearest enemy in the cone', () => {
    const y = L.softLockYaw(P, 0, [e(-1, -8), e(1, -3), e(0, -6)])!;
    expect(y).toBeCloseTo(L.yawToward(1, -3));
  });

  it('ignores enemies outside the cone, out of range, behind, or dead', () => {
    expect(L.softLockYaw(P, 0, [e(5, -2)])).toBeNull(); // ~68° off
    expect(L.softLockYaw(P, 0, [e(0, -(L.SOFT_LOCK_RANGE + 1))])).toBeNull();
    expect(L.softLockYaw(P, 0, [e(0, 5)])).toBeNull();
    expect(L.softLockYaw(P, 0, [e(0, -3, 0)])).toBeNull();
    expect(L.softLockYaw(P, 0, [])).toBeNull();
  });

  it('cone edge: just inside locks, just outside does not', () => {
    const inside = ((L.SOFT_LOCK_CONE_DEG - 1) * Math.PI) / 180;
    const outside = ((L.SOFT_LOCK_CONE_DEG + 1) * Math.PI) / 180;
    expect(L.softLockYaw(P, 0, [e(-Math.sin(inside) * 5, -Math.cos(inside) * 5)])).not.toBeNull();
    expect(L.softLockYaw(P, 0, [e(-Math.sin(outside) * 5, -Math.cos(outside) * 5)])).toBeNull();
  });

  it('handles yaw wrap-around without spinning', () => {
    const yaw = 10 * Math.PI + 0.1; // many turns
    const t = e(-Math.sin(yaw - 0.2) * 4, -Math.cos(yaw - 0.2) * 4);
    const y = L.softLockYaw(P, yaw, [t])!;
    expect(y).toBeCloseTo(yaw - 0.2);
  });
});

describe('takeTouchAimYaw', () => {
  it('only acts after a touch press, once', () => {
    const t = [e(1, -4)];
    expect(L.takeTouchAimYaw(P, 0, t)).toBeNull();
    L.markTouchAim();
    expect(L.takeTouchAimYaw(P, 0, t)).not.toBeNull();
    expect(L.takeTouchAimYaw(P, 0, t)).toBeNull();
  });

  it('respects the persisted setting (default on)', () => {
    expect(S.DEFAULT_SETTINGS.touchSoftLock).toBe(true);
    S.saveSettings({ touchSoftLock: false });
    expect(JSON.parse(store.get('ad3d.settings')!).touchSoftLock).toBe(false);
    expect(S.reloadSettings().touchSoftLock).toBe(false);
    L.markTouchAim();
    expect(L.takeTouchAimYaw(P, 0, [e(1, -4)])).toBeNull();
    store.set('ad3d.settings', JSON.stringify({ touchSoftLock: 'yes' }));
    expect(S.reloadSettings().touchSoftLock).toBe(true);
  });
});
