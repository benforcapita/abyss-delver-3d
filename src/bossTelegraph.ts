// Boss attack telegraph model (pure logic, no three/React deps).
// Note: LLD §7 specifies boss telegraphs as a "ring mesh with fill-progress
// before windup->attack" but gives no numeric timings or sizes, so the windup
// duration and radius below are chosen here for gameplay balance.

import type {EnemyArchetype} from './types';

export const BOSS_TELEGRAPH_WINDUP = 0.9; // seconds
export const BOSS_TELEGRAPH_RADIUS = 2.5; // world units

export interface BossTelegraph {
  cx: number;
  cz: number;
  radius: number;
  windup: number;
  elapsed: number;
}

/** Inclusive XZ-plane check: is point (px, pz) inside the ring at (cx, cz)? */
export function isInsideRing(
  px: number,
  pz: number,
  cx: number,
  cz: number,
  radius: number,
): boolean {
  const dx = px - cx;
  const dz = pz - cz;
  return dx * dx + dz * dz <= radius * radius;
}

export function startTelegraph(
  cx: number,
  cz: number,
  radius: number = BOSS_TELEGRAPH_RADIUS,
  windup: number = BOSS_TELEGRAPH_WINDUP,
): BossTelegraph {
  return {cx, cz, radius, windup, elapsed: 0};
}

/** Advances elapsed by dt (negative dt treated as 0), clamped to windup. */
export function tickTelegraph(t: BossTelegraph, dt: number): BossTelegraph {
  const step = dt < 0 ? 0 : dt;
  return {...t, elapsed: Math.min(t.windup, t.elapsed + step)};
}

export function telegraphProgress(t: BossTelegraph): number {
  if (t.windup <= 0) return 1;
  return Math.min(1, Math.max(0, t.elapsed / t.windup));
}

export function isTelegraphComplete(t: BossTelegraph): boolean {
  return t.elapsed >= t.windup;
}

/**
 * Pause-aware tick: while paused the same object is returned unchanged so no
 * windup time accrues; otherwise delegates to tickTelegraph.
 */
export function advanceTelegraph(
  t: BossTelegraph,
  dt: number,
  paused: boolean,
): BossTelegraph {
  return paused ? t : tickTelegraph(t, dt);
}

/**
 * Only bosses on the melee/slam branch get a ground ring. The crimson
 * archmage's fireball is a single-target projectile with no AoE impact, so it
 * shows no ring; non-bosses never telegraph.
 */
export function usesGroundTelegraph(
  isBoss: boolean,
  archetype: EnemyArchetype,
): boolean {
  return isBoss && archetype !== 'boss_crimson_archmage';
}

/** A telegraphed slam lands only if the player is in range AND inside the ring. */
export function meleeHitLands(inRange: boolean, insideRing: boolean): boolean {
  return inRange && insideRing;
}
