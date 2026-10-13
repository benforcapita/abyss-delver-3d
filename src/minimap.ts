import type {DungeonRoom, Position3D} from './types';

/**
 * World-unit size of one dungeon tile.
 * Matches `dungeonGenerator.ts` (`TILE_SIZE = 4`) and the grid collision in `Game.tsx`.
 */
export const MINIMAP_TILE_SIZE = 4;

/** How often the overlay repaints. Enemy dots move; the mask only grows on a new tile. */
export const MINIMAP_REDRAW_MS = 100;

export interface MinimapEnemy {
  pos: Position3D;
  hp: number;
  isBoss: boolean;
}

export interface MinimapChest {
  gridX: number;
  gridY: number;
  opened: boolean;
}

/**
 * Mutable bag the game loop writes and the overlay reads.
 * Fields are replaced in place so publishing never triggers a React render.
 */
export interface MinimapBridge {
  tiles: number[][] | null;
  rooms: readonly DungeonRoom[];
  gridSize: number;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  enemies: readonly MinimapEnemy[];
  chests: readonly MinimapChest[];
  /** Increments when the floor layout is replaced so fog-of-war resets. */
  floorSerial: number;
}

export function createMinimapBridge(): MinimapBridge {
  return {
    tiles: null,
    rooms: [],
    gridSize: 0,
    playerX: 0,
    playerZ: 0,
    playerYaw: 0,
    enemies: [],
    chests: [],
    floorSerial: 0,
  };
}

export interface MinimapSample {
  tiles: number[][];
  rooms: readonly DungeonRoom[];
  gridSize: number;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  enemies: readonly MinimapEnemy[];
  chests: readonly MinimapChest[];
}

/** Copy the latest sample into the bridge. A new tile grid bumps `floorSerial`. */
export function syncMinimapBridge(bridge: MinimapBridge, sample: MinimapSample): void {
  if (bridge.tiles !== sample.tiles) {
    bridge.tiles = sample.tiles;
    bridge.rooms = sample.rooms;
    bridge.gridSize = sample.gridSize;
    bridge.floorSerial += 1;
  }
  bridge.playerX = sample.playerX;
  bridge.playerZ = sample.playerZ;
  bridge.playerYaw = sample.playerYaw;
  bridge.enemies = sample.enemies;
  bridge.chests = sample.chests;
}

export function createVisitedMask(gridSize: number): Uint8Array {
  return new Uint8Array(gridSize * gridSize);
}

export function worldToTile(
  worldX: number,
  worldZ: number,
  gridSize: number,
  tileSize = MINIMAP_TILE_SIZE,
): {x: number; y: number} {
  return {
    x: Math.floor(worldX / tileSize + gridSize / 2),
    y: Math.floor(worldZ / tileSize + gridSize / 2),
  };
}

/** Continuous tile coordinates so the player and enemies can sit between cell centers. */
export function worldToTileFloat(
  worldX: number,
  worldZ: number,
  gridSize: number,
  tileSize = MINIMAP_TILE_SIZE,
): {x: number; y: number} {
  return {
    x: worldX / tileSize + gridSize / 2,
    y: worldZ / tileSize + gridSize / 2,
  };
}

export function isVisited(
  mask: Uint8Array,
  gridSize: number,
  x: number,
  y: number,
): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  return mask[x * gridSize + y] === 1;
}

function markTile(
  mask: Uint8Array,
  tiles: number[][],
  x: number,
  y: number,
): boolean {
  const gridSize = tiles.length;
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  if (tiles[x][y] === 0) return false;
  const index = x * gridSize + y;
  if (mask[index] === 1) return false;
  mask[index] = 1;
  return true;
}

export function roomContaining(
  rooms: readonly DungeonRoom[],
  x: number,
  y: number,
): DungeonRoom | null {
  for (const room of rooms) {
    if (x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h) {
      return room;
    }
  }
  return null;
}

/**
 * Fog of war. Standing in a room reveals that room (floor plus the wall ring).
 * Standing in a corridor reveals that floor tile and the walls touching it.
 * Returns whether the mask gained any tile.
 */
export function revealVisited(
  mask: Uint8Array,
  tiles: number[][],
  rooms: readonly DungeonRoom[],
  tileX: number,
  tileY: number,
): boolean {
  const gridSize = tiles.length;
  if (tileX < 0 || tileY < 0 || tileX >= gridSize || tileY >= gridSize) return false;
  if (tiles[tileX]?.[tileY] !== 1) return false;

  const room = roomContaining(rooms, tileX, tileY);
  let changed = false;
  if (room) {
    for (let x = room.x - 1; x <= room.x + room.w; x++) {
      for (let y = room.y - 1; y <= room.y + room.h; y++) {
        if (markTile(mask, tiles, x, y)) changed = true;
      }
    }
    return changed;
  }

  if (markTile(mask, tiles, tileX, tileY)) changed = true;
  const neighbors: ReadonlyArray<readonly [number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [dx, dy] of neighbors) {
    const nx = tileX + dx;
    const ny = tileY + dy;
    const kind = tiles[nx]?.[ny];
    if (kind === 2 || kind === 3) {
      if (markTile(mask, tiles, nx, ny)) changed = true;
    }
  }
  return changed;
}

export type MinimapMarkerKind = 'chest' | 'enemy' | 'boss';

export interface MinimapMarker {
  kind: MinimapMarkerKind;
  x: number;
  y: number;
  opened?: boolean;
}

/** Chests and living enemies whose tile has been visited. Dead enemies are omitted. */
export function visibleMarkers(
  mask: Uint8Array,
  gridSize: number,
  chests: readonly MinimapChest[],
  enemies: readonly MinimapEnemy[],
  tileSize = MINIMAP_TILE_SIZE,
): MinimapMarker[] {
  const markers: MinimapMarker[] = [];
  for (const chest of chests) {
    const tx = Math.floor(chest.gridX);
    const ty = Math.floor(chest.gridY);
    if (!isVisited(mask, gridSize, tx, ty)) continue;
    markers.push({kind: 'chest', x: chest.gridX, y: chest.gridY, opened: chest.opened});
  }
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    const pos = worldToTileFloat(enemy.pos[0], enemy.pos[2], gridSize, tileSize);
    if (!isVisited(mask, gridSize, Math.floor(pos.x), Math.floor(pos.y))) continue;
    markers.push({
      kind: enemy.isBoss ? 'boss' : 'enemy',
      x: pos.x,
      y: pos.y,
    });
  }
  return markers;
}
