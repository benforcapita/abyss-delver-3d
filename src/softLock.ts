/**
 * AD-24.6: touch auto-aim soft lock (docs/proposals/AD-24-controls.md §3).
 * When SLASH or SPELL is pressed on touch, snap the camera yaw toward the
 * nearest living enemy within a cone around the current facing and in range.
 */
import { getSettings } from './platform/settings';

/** Max angle (degrees) between facing and target, either side. */
export const SOFT_LOCK_CONE_DEG = 30;
/** Max distance (world units) to a target. */
export const SOFT_LOCK_RANGE = 12;

export interface SoftLockTarget {
  pos: readonly [number, number, number];
  hp: number;
}

/** Yaw that faces (dx, dz); facing is (-sin yaw, -cos yaw). */
export function yawToward(dx: number, dz: number): number {
  return Math.atan2(-dx, -dz);
}

/** Smallest signed difference a − b, wrapped to (−π, π]. */
export function angleDiff(a: number, b: number): number {
  let d = (a - b) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

/**
 * Pure: yaw to snap to, or null when no living target is in the cone and
 * range. Picks the nearest target; ties go to the smaller angle.
 */
export function softLockYaw(
  player: { x: number; z: number },
  yaw: number,
  targets: readonly SoftLockTarget[],
  coneDeg = SOFT_LOCK_CONE_DEG,
  range = SOFT_LOCK_RANGE,
): number | null {
  const cone = (coneDeg * Math.PI) / 180;
  let best: { dist: number; ang: number; yaw: number } | null = null;
  for (const t of targets) {
    if (!(t.hp > 0)) continue;
    const dx = t.pos[0] - player.x;
    const dz = t.pos[2] - player.z;
    const dist = Math.hypot(dx, dz);
    if (dist === 0 || dist > range) continue;
    const ty = yawToward(dx, dz);
    const ang = Math.abs(angleDiff(ty, yaw));
    if (ang > cone) continue;
    if (!best || dist < best.dist || (dist === best.dist && ang < best.ang)) {
      best = { dist, ang, yaw: ty };
    }
  }
  return best ? yaw + angleDiff(best.yaw, yaw) : null;
}

let touchAimPending = false;

/** Called by the touch SLASH / SPELL buttons. */
export function markTouchAim(): void {
  touchAimPending = true;
}

/**
 * Consume a pending touch press. Returns the yaw to snap to, or null when
 * there was no touch press, the setting is off, or there is no target.
 */
export function takeTouchAimYaw(
  player: { x: number; z: number },
  yaw: number,
  targets: readonly SoftLockTarget[],
): number | null {
  if (!touchAimPending) return null;
  touchAimPending = false;
  if (!getSettings().touchSoftLock) return null;
  return softLockYaw(player, yaw, targets);
}
