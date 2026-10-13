import * as THREE from 'three';

/** How long a damage tint stays up. About 100 ms. */
export const HIT_FLASH_MS = 100;

/** Flash-map id for the player viewmodel. */
export const PLAYER_FLASH_ID = 'player';

const FLASH_WHITE = new THREE.Color(1, 1, 1);
const ACTIVE_FLAG = 'adHitFlash';

export type FlashMap = Map<string, number>;

interface MaterialSnapshot {
  color?: THREE.Color;
  emissive?: THREE.Color;
  emissiveIntensity?: number;
}

const snapshots = new WeakMap<THREE.Material, MaterialSnapshot>();

export function createFlashMap(): FlashMap {
  return new Map();
}

/**
 * Starts (or refreshes) a flash. `until` is an absolute timestamp in ms.
 * A second hit before the first ends keeps the later deadline.
 */
export function triggerHitFlash(
  flashes: FlashMap,
  id: string,
  nowMs: number,
  durationMs = HIT_FLASH_MS,
): void {
  const until = nowMs + durationMs;
  const prev = flashes.get(id) ?? 0;
  flashes.set(id, Math.max(prev, until));
}

/** 1 at the start of the flash, falling to 0. 0 once `nowMs` reaches the deadline. */
export function hitFlashAmount(flashes: FlashMap, id: string, nowMs: number): number {
  const until = flashes.get(id);
  if (until == null || nowMs >= until) return 0;
  const remaining = until - nowMs;
  return Math.max(0, Math.min(1, remaining / HIT_FLASH_MS));
}

export function isHitFlashing(flashes: FlashMap, id: string, nowMs: number): boolean {
  return hitFlashAmount(flashes, id, nowMs) > 0;
}

export function pruneHitFlashes(flashes: FlashMap, nowMs: number): void {
  for (const [id, until] of flashes) {
    if (nowMs >= until) flashes.delete(id);
  }
}

/**
 * Pause hold. Adds `elapsedMs` to every deadline so remaining flash time
 * stays put while the wall clock moves. Call once per paused frame with the
 * time since the previous sample, then sync at the new `now`.
 */
export function holdHitFlashes(flashes: FlashMap, elapsedMs: number): void {
  if (!(elapsedMs > 0)) return;
  for (const [id, until] of flashes) {
    flashes.set(id, until + elapsedMs);
  }
}

function tintMaterial(mat: THREE.Material, amount: number): void {
  const std = mat as THREE.MeshStandardMaterial;
  const hasColor = std.color instanceof THREE.Color;
  const hasEmissive = std.emissive instanceof THREE.Color;
  if (!hasColor && !hasEmissive) return;

  if (amount <= 0) {
    const snap = snapshots.get(mat);
    if (!snap) return;
    if (snap.color && hasColor) std.color.copy(snap.color);
    if (snap.emissive && hasEmissive) std.emissive.copy(snap.emissive);
    if (snap.emissiveIntensity !== undefined && typeof std.emissiveIntensity === 'number') {
      std.emissiveIntensity = snap.emissiveIntensity;
    }
    snapshots.delete(mat);
    return;
  }

  if (!snapshots.has(mat)) {
    snapshots.set(mat, {
      color: hasColor ? std.color.clone() : undefined,
      emissive: hasEmissive ? std.emissive.clone() : undefined,
      emissiveIntensity:
        typeof std.emissiveIntensity === 'number' ? std.emissiveIntensity : undefined,
    });
  }

  if (hasColor) std.color.copy(FLASH_WHITE);
  if (hasEmissive) {
    std.emissive.copy(FLASH_WHITE);
    std.emissiveIntensity = 1.2 + amount * 2.4;
  }
}

/** White emissive/color tint while `amount` > 0. Restores the previous material when it hits 0. */
export function applyHitFlash(root: THREE.Object3D | null | undefined, amount: number): void {
  if (!root) return;
  const active = root.userData[ACTIVE_FLAG] === true;
  if (amount <= 0 && !active) return;
  root.userData[ACTIVE_FLAG] = amount > 0;

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of list) {
      if (mat) tintMaterial(mat, amount);
    }
  });
}

/** Applies the current flash amount to every registered mesh, then drops expired timers. */
export function syncHitFlashes(
  flashes: FlashMap,
  targets: Map<string, THREE.Object3D | null>,
  nowMs: number,
): void {
  for (const [id, obj] of targets) {
    if (!obj) continue;
    applyHitFlash(obj, hitFlashAmount(flashes, id, nowMs));
  }
  pruneHitFlashes(flashes, nowMs);
}

const _euler = new THREE.Euler();
const _local = new THREE.Vector3();
const _localQ = new THREE.Quaternion();
const _worldQ = new THREE.Quaternion();

/**
 * The viewmodel pose is authored in camera space (the numbers in Game).
 * Compose it onto the camera so the player mesh — the thing we flash — sits in view.
 */
export function applyCameraLocalPose(object: THREE.Object3D, camera: THREE.Camera): void {
  _euler.copy(object.rotation);
  _local.copy(object.position);
  _localQ.setFromEuler(_euler);
  _local.applyQuaternion(camera.quaternion);
  object.position.copy(camera.position).add(_local);
  _worldQ.copy(camera.quaternion).multiply(_localQ);
  object.quaternion.copy(_worldQ);
}
