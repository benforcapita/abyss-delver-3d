import {describe, expect, it} from 'vitest';
import {generateDungeonFloor} from './dungeonGenerator';
import {
  createVisitedMask,
  isVisited,
  revealVisited,
  roomContaining,
  visibleMarkers,
  worldToTile,
  type MinimapChest,
  type MinimapEnemy,
} from './minimap';
import type {DungeonRoom} from './types';

function emptyTiles(size: number): number[][] {
  return Array.from({length: size}, () => Array<number>(size).fill(0));
}

function fillRect(tiles: number[][], x: number, y: number, w: number, h: number, kind: number) {
  for (let gx = x; gx < x + w; gx++) {
    for (let gy = y; gy < y + h; gy++) tiles[gx][gy] = kind;
  }
}

const spawn: DungeonRoom = {x: 2, y: 2, w: 4, h: 3, type: 'spawn', cleared: true};
const combat: DungeonRoom = {x: 10, y: 2, w: 4, h: 3, type: 'combat', cleared: false};

function twoRoomGrid(): number[][] {
  const tiles = emptyTiles(16);
  fillRect(tiles, spawn.x, spawn.y, spawn.w, spawn.h, 1);
  fillRect(tiles, combat.x, combat.y, combat.w, combat.h, 1);
  // Corridor between the rooms, one tile south of both so it is not inside either rect.
  tiles[6][6] = 1;
  tiles[7][6] = 1;
  tiles[5][6] = 2;
  tiles[6][5] = 2;
  tiles[6][7] = 2;
  return tiles;
}

describe('revealVisited', () => {
  it('reveals the whole room the player enters and leaves other rooms dark', () => {
    const tiles = twoRoomGrid();
    const mask = createVisitedMask(tiles.length);
    const rooms = [spawn, combat];

    expect(revealVisited(mask, tiles, rooms, 3, 3)).toBe(true);

    for (let x = spawn.x; x < spawn.x + spawn.w; x++) {
      for (let y = spawn.y; y < spawn.y + spawn.h; y++) {
        expect(isVisited(mask, tiles.length, x, y)).toBe(true);
      }
    }
    expect(isVisited(mask, tiles.length, combat.x + 1, combat.y + 1)).toBe(false);
    expect(roomContaining(rooms, combat.x, combat.y)).toBe(combat);
  });

  it('does not grow the mask when the player is still inside a revealed room', () => {
    const tiles = twoRoomGrid();
    const mask = createVisitedMask(tiles.length);
    revealVisited(mask, tiles, [spawn, combat], 2, 2);
    expect(revealVisited(mask, tiles, [spawn, combat], 5, 4)).toBe(false);
  });

  it('reveals a corridor tile and its walls without opening a distant room', () => {
    const tiles = twoRoomGrid();
    const mask = createVisitedMask(tiles.length);

    expect(revealVisited(mask, tiles, [spawn, combat], 6, 6)).toBe(true);
    expect(isVisited(mask, tiles.length, 6, 6)).toBe(true);
    expect(isVisited(mask, tiles.length, 5, 6)).toBe(true);
    expect(isVisited(mask, tiles.length, 6, 5)).toBe(true);
    expect(isVisited(mask, tiles.length, 6, 7)).toBe(true);
    expect(isVisited(mask, tiles.length, 7, 6)).toBe(false);
    expect(isVisited(mask, tiles.length, spawn.x, spawn.y)).toBe(false);
    expect(isVisited(mask, tiles.length, combat.x, combat.y)).toBe(false);
  });

  it('ignores coordinates outside the grid and tiles that are not floor', () => {
    const tiles = twoRoomGrid();
    const mask = createVisitedMask(tiles.length);
    expect(revealVisited(mask, tiles, [spawn], -1, 2)).toBe(false);
    expect(revealVisited(mask, tiles, [spawn], 1, 1)).toBe(false);
    expect(Array.from(mask).every((cell) => cell === 0)).toBe(true);
  });
});

describe('revealVisited on a generated floor', () => {
  it('opens the spawn room and keeps a later room dark', () => {
    const {floorData} = generateDungeonFloor(1, 0, 42);
    const mask = createVisitedMask(floorData.gridSize);
    const spawnTile = worldToTile(
      floorData.spawnPos[0],
      floorData.spawnPos[2],
      floorData.gridSize,
    );
    expect(revealVisited(mask, floorData.tiles, floorData.rooms, spawnTile.x, spawnTile.y)).toBe(
      true,
    );
    expect(isVisited(mask, floorData.gridSize, spawnTile.x, spawnTile.y)).toBe(true);

    const elsewhere = floorData.rooms.find(
      (room) => roomContaining([room], spawnTile.x, spawnTile.y) === null,
    );
    expect(elsewhere).toBeTruthy();
    expect(isVisited(mask, floorData.gridSize, elsewhere!.x + 1, elsewhere!.y + 1)).toBe(false);
  });
});

describe('visibleMarkers', () => {
  const chest: MinimapChest = {gridX: 12.5, gridY: 3.5, opened: false};
  const hiddenChest: MinimapChest = {gridX: 3.5, gridY: 3.5, opened: false};
  const enemy: MinimapEnemy = {pos: [4, 0, -16], hp: 10, isBoss: false};
  const dead: MinimapEnemy = {pos: [4, 0, -16], hp: 0, isBoss: true};

  it('shows stairs only after their room is revealed', () => {
    const tiles = twoRoomGrid();
    const mask = createVisitedMask(tiles.length);
    const rooms = [spawn, combat];
    // Combat-room center (12, 3) on a 16-wide grid.
    const stairs = {pos: [16, 0, -20] as [number, number, number]};
    expect(worldToTile(stairs.pos[0], stairs.pos[2], tiles.length)).toEqual({x: 12, y: 3});

    expect(visibleMarkers(mask, tiles.length, [], [], stairs)).toEqual([]);

    revealVisited(mask, tiles, rooms, spawn.x + 1, spawn.y + 1);
    expect(visibleMarkers(mask, tiles.length, [], [], stairs)).toEqual([]);

    revealVisited(mask, tiles, rooms, combat.x + 1, combat.y + 1);
    expect(visibleMarkers(mask, tiles.length, [], [], stairs)).toEqual([
      {kind: 'stairs', x: 12, y: 3},
    ]);
  });

  it('shows chests and living enemies only on visited tiles', () => {
    const gridSize = 16;
    // world (4, -16) → tile (floor(4/4 + 8), floor(-16/4 + 8)) = (9, 4)
    expect(worldToTile(4, -16, gridSize)).toEqual({x: 9, y: 4});

    const mask = createVisitedMask(gridSize);
    mask[12 * gridSize + 3] = 1;
    mask[9 * gridSize + 4] = 1;

    expect(visibleMarkers(mask, gridSize, [chest, hiddenChest], [enemy, dead])).toEqual([
      {kind: 'chest', x: 12.5, y: 3.5, opened: false},
      {kind: 'enemy', x: 9, y: 4},
    ]);
  });
});
