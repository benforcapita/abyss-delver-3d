/**
 * AD-24.7: dash direction follows the current move / stick input, relative to
 * the camera. With no input the dash goes straight back (a back-dodge), per
 * docs/proposals/AD-24-controls.md §3 ("backwards when the stick is centered").
 */

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
 * World-space unit (x, z) dash direction for the camera yaw. Local forward
 * (z = -1) maps to the camera's facing (-sin yaw, -cos yaw); local right
 * (x = +1) maps to the camera's right (cos yaw, -sin yaw).
 */
export function dashDirection(move: MoveInput, yaw: number): { x: number; z: number } {
  let { x, z } = move;
  const len = Math.hypot(x, z);
  if (len < DASH_IDLE_EPSILON) {
    x = 0;
    z = 1; // idle → back-dodge
  } else {
    x /= len;
    z /= len;
  }
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: x * c + z * s, z: -x * s + z * c };
}
