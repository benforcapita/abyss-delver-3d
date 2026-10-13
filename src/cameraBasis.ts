/**
 * Camera-relative basis shared by walking and dashing (AD-24.10).
 *
 * The camera uses rotation order 'YXZ' with rotation.y = yaw, so it looks
 * along forward = (-sin yaw, 0, -cos yaw) and its right is (cos yaw, 0, -sin yaw).
 * Local input uses x = strafe (+1 right) and z = forward/back (-1 forward),
 * matching how Game.tsx builds moveX / moveZ.
 */

export interface Vec2 {
  x: number;
  z: number;
}

/** Camera forward in world XZ for `yaw`. */
export function cameraForward(yaw: number): Vec2 {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}

/** Camera right in world XZ for `yaw`. */
export function cameraRight(yaw: number): Vec2 {
  return { x: Math.cos(yaw), z: -Math.sin(yaw) };
}

/**
 * Rotate local input (x = strafe right, z = back) into world XZ:
 * world = right * x + forward * (-z). Not normalized.
 */
export function localToWorld(x: number, z: number, yaw: number): Vec2 {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: x * c + z * s, z: -x * s + z * c };
}

/**
 * Unit world-space walk direction for local move input, or {0,0} when idle.
 * Diagonals are normalized so they are not faster.
 */
export function cameraMoveVector(moveX: number, moveZ: number, yaw: number): Vec2 {
  const len = Math.hypot(moveX, moveZ);
  if (len === 0) return { x: 0, z: 0 };
  return localToWorld(moveX / len, moveZ / len, yaw);
}
