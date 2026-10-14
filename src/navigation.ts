/**
 * Grid navigation helpers shared by the player, enemies and projectiles.
 *
 * Tile (gx, gz) is rendered as a TILE_SIZE box centred on
 * ((gx - gridSize / 2) * TILE_SIZE, (gz - gridSize / 2) * TILE_SIZE), so the
 * world → tile mapping must round, not floor. Flooring shifted the collision
 * grid half a tile off the rendered walls (you could walk into walls on one
 * side and stop short of them on the other).
 */

export const TILE_SIZE = 4;

/** Step (world units) used when sampling a sight line. Well under TILE_SIZE. */
const LOS_STEP = 0.5;

export type TileGrid = readonly (readonly number[])[];

export function worldToGrid(world: number, gridSize: number): number {
  return Math.round(world / TILE_SIZE + gridSize / 2);
}

export function gridToWorld(grid: number, gridSize: number): number {
  return (grid - gridSize / 2) * TILE_SIZE;
}

/** Floor (1) and door (3) tiles are walkable; void and walls are not. */
export function isWalkableTile(tiles: TileGrid, gx: number, gz: number): boolean {
  const kind = tiles[gx]?.[gz];
  return kind === 1 || kind === 3;
}

export function isWalkableWorld(tiles: TileGrid, x: number, z: number): boolean {
  const n = tiles.length;
  return isWalkableTile(tiles, worldToGrid(x, n), worldToGrid(z, n));
}

/** True when a square body of half-extent `radius` centred at (x, z) touches no wall. */
export function isAreaFree(tiles: TileGrid, x: number, z: number, radius: number): boolean {
  return (
    isWalkableWorld(tiles, x - radius, z - radius) &&
    isWalkableWorld(tiles, x + radius, z - radius) &&
    isWalkableWorld(tiles, x - radius, z + radius) &&
    isWalkableWorld(tiles, x + radius, z + radius)
  );
}

/**
 * Moves a body by (dx, dz) and slides along walls. Large moves are split into
 * sub-steps no longer than `radius` so fast bodies (dash) cannot tunnel.
 */
export function moveWithCollision(
  tiles: TileGrid,
  x: number,
  z: number,
  dx: number,
  dz: number,
  radius: number,
): {x: number; z: number} {
  const dist = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(dist / Math.max(0.05, radius)));
  const sx = dx / steps;
  const sz = dz / steps;
  for (let i = 0; i < steps; i++) {
    if (isAreaFree(tiles, x + sx, z + sz, radius)) {
      x += sx;
      z += sz;
      continue;
    }
    if (sx !== 0 && isAreaFree(tiles, x + sx, z, radius)) x += sx;
    if (sz !== 0 && isAreaFree(tiles, x, z + sz, radius)) z += sz;
  }
  return {x, z};
}

/** True when the straight segment between two world points crosses no wall tile. */
export function hasLineOfSight(
  tiles: TileGrid,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): boolean {
  const dist = Math.hypot(bx - ax, bz - az);
  const steps = Math.max(1, Math.ceil(dist / LOS_STEP));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!isWalkableWorld(tiles, ax + (bx - ax) * t, az + (bz - az) * t)) return false;
  }
  return true;
}
