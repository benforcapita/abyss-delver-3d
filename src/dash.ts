/**
 * AD-24.7: dash direction follows the current move / stick input, relative to
 * the camera. With no input the dash goes straight back (a back-dodge), per
 * docs/proposals/AD-24-controls.md §3 ("backwards when the stick is centered").
 */

import { cameraMoveVector, localToWorld, type Vec2 } from './cameraBasis';

export interface MoveInput {
  /** Strafe: -1 left … +1 right. */
  x: number;
  /** Forward/back in local space: -1 forward … +1 back. */
  z: number;
}

/** Combine keyboard flags and the joystick vector exactly as movement does. */
export function moveInputFrom(
  keys: { left?: boolean; right?: boolean; up?: boolean; down?: boolean } | undefined,
  stick: { x: number; y: number } | undefined,
): MoveInput {
  let x = 0;
  let z = 0;
  if (keys) {
    if (keys.left) x -= 1;
    if (keys.right) x += 1;
    if (keys.up) z -= 1;
    if (keys.down) z += 1;
  }
  if (stick) {
    x += stick.x;
    z -= stick.y;
  }
  return { x, z };
}

/** Below this input magnitude the player counts as idle. */
export const DASH_IDLE_EPSILON = 0.05;

/**
 * World-space unit (x, z) dash direction for the camera yaw, using the shared
 * camera basis (src/cameraBasis.ts) so dash and walking always agree. Idle
 * input (below DASH_IDLE_EPSILON) back-dodges: local back (0, +1).
 */
export function dashDirection(move: MoveInput, yaw: number): Vec2 {
  if (Math.hypot(move.x, move.z) < DASH_IDLE_EPSILON) return localToWorld(0, 1, yaw);
  return cameraMoveVector(move.x, move.z, yaw);
}
