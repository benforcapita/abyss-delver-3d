/**
 * Enemy perception: an enemy only notices (and may only attack) the player
 * when it can actually see them — within sight range, inside its view cone
 * (unless already alerted or the player is right next to it) and with no wall
 * in between. After losing sight it remembers the last known position for a
 * while and goes to investigate.
 */
import {hasLineOfSight, type TileGrid} from './navigation';

/** Max distance (world units) an enemy can spot the player. */
export const SIGHT_RANGE = 18;
/** Half-angle of the view cone (degrees) for an enemy that hasn't noticed the player yet. */
export const VIEW_CONE_HALF_DEG = 70;
/** Within this distance an unaware enemy notices the player regardless of facing (still needs LOS). */
export const PROXIMITY_RADIUS = 3.5;
/** Seconds an enemy keeps hunting the last known position after losing sight. */
export const MEMORY_SECONDS = 4;

const COS_VIEW_CONE = Math.cos((VIEW_CONE_HALF_DEG * Math.PI) / 180);

export interface Awareness {
  seesPlayer?: boolean;
  /** Last world XZ where the player was seen, if any. */
  lastKnownPos?: [number, number];
  /** Seconds of memory left; 0 / unset = forgotten. */
  memory?: number;
}

export interface Viewer {
  x: number;
  z: number;
  /** Facing yaw; the model faces (sin yaw, cos yaw). */
  yaw: number;
  /** Already hunting the player: the view cone no longer applies. */
  alerted: boolean;
}

export function canSeePlayer(
  viewer: Viewer,
  px: number,
  pz: number,
  tiles: TileGrid,
  range = SIGHT_RANGE,
): boolean {
  const dx = px - viewer.x;
  const dz = pz - viewer.z;
  const dist = Math.hypot(dx, dz);
  if (dist > range) return false;
  if (!viewer.alerted && dist > PROXIMITY_RADIUS && dist > 0) {
    const dot = (Math.sin(viewer.yaw) * dx + Math.cos(viewer.yaw) * dz) / dist;
    if (dot < COS_VIEW_CONE) return false;
  }
  return hasLineOfSight(tiles, viewer.x, viewer.z, px, pz);
}

/** Updates `awareness` in place for this frame and returns whether the player is seen. */
export function perceive(
  awareness: Awareness,
  viewer: Viewer,
  px: number,
  pz: number,
  tiles: TileGrid,
  dt: number,
  range = SIGHT_RANGE,
): boolean {
  const sees = canSeePlayer(viewer, px, pz, tiles, range);
  awareness.seesPlayer = sees;
  if (sees) {
    awareness.lastKnownPos = [px, pz];
    awareness.memory = MEMORY_SECONDS;
  } else {
    awareness.memory = Math.max(0, (awareness.memory ?? 0) - dt);
  }
  return sees;
}

/** Being hit reveals the attacker: the enemy turns to hunt where the player is. */
export function alertTo(awareness: Awareness, px: number, pz: number): void {
  awareness.lastKnownPos = [px, pz];
  awareness.memory = MEMORY_SECONDS;
}
