import {describe, expect, it} from 'vitest';
import {generateDungeonFloor} from './dungeonGenerator';
import type {DungeonRoom} from './types';

const FLOORS = [1, 2, 3, 4, 5];
const SWEEP_SEEDS = [1, 2, 3, 7, 11, 42, 99, 12345];
// These seeds fill the room budget on floors 1–5. The generator only
// tags a room as boss when that final budgeted slot is placed.
const FULL_FLOOR_SEEDS = [2, 5, 6, 8, 11, 12];

const BOSS_ARCHETYPES = [
  'boss_bone_colossus',
  'boss_crimson_archmage',
  'boss_gorgon',
  'boss_shadow_knight',
  'boss_void_overlord',
] as const;

function expectedRoomBudget(floorLevel: number): number {
  return 5 + Math.min(3, floorLevel);
}

function layoutSnapshot(floorLevel: number, playerPower: number, seed: number) {
  const {floorData} = generateDungeonFloor(floorLevel, playerPower, seed);
  return {
    gridSize: floorData.gridSize,
    tiles: floorData.tiles,
    rooms: floorData.rooms,
    spawnPos: floorData.spawnPos,
    stairsPos: floorData.stairs.pos,
  };
}

function keepsOneTileGap(a: DungeonRoom, b: DungeonRoom): boolean {
  return (
    a.x + a.w + 1 <= b.x ||
    b.x + b.w + 1 <= a.x ||
    a.y + a.h + 1 <= b.y ||
    b.y + b.h + 1 <= a.y
  );
}

function reachableFloorTiles(
  tiles: number[][],
  startX: number,
  startY: number,
): boolean[][] {
  const size = tiles.length;
  const seen = Array.from({length: size}, () => Array<boolean>(size).fill(false));
  const queue: Array<[number, number]> = [[startX, startY]];
  seen[startX][startY] = true;

  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      if (seen[nx][ny] || tiles[nx][ny] !== 1) continue;
      seen[nx][ny] = true;
      queue.push([nx, ny]);
    }
  }

  return seen;
}

describe('generateDungeonFloor', () => {
  it('reproduces the same layout for the same seed', () => {
    const first = layoutSnapshot(1, 0, 42);
    expect(layoutSnapshot(1, 0, 42)).toEqual(first);
    expect(layoutSnapshot(1, 40, 42)).toEqual(first);
    expect(layoutSnapshot(3, 0, 11)).toEqual(layoutSnapshot(3, 99, 11));
    expect(layoutSnapshot(1, 0, 43)).not.toEqual(first);
  });

  it('reaches every room from the start over floor tiles', () => {
    for (const floor of FLOORS) {
      for (const seed of SWEEP_SEEDS) {
        const {floorData} = generateDungeonFloor(floor, 0, seed);
        const start = floorData.rooms[0];
        const startX = Math.floor(start.x + start.w / 2);
        const startY = Math.floor(start.y + start.h / 2);
        const seen = reachableFloorTiles(floorData.tiles, startX, startY);

        for (const room of floorData.rooms) {
          for (let x = room.x; x < room.x + room.w; x++) {
            for (let y = room.y; y < room.y + room.h; y++) {
              expect(floorData.tiles[x][y], `floor ${floor} seed ${seed}`).toBe(1);
              expect(seen[x][y], `floor ${floor} seed ${seed} room cell ${x},${y}`).toBe(
                true,
              );
            }
          }
        }
      }
    }
  });

  it('places exactly one boss room across seeds and floors', () => {
    for (const floor of FLOORS) {
      for (const seed of FULL_FLOOR_SEEDS) {
        const {floorData} = generateDungeonFloor(floor, 0, seed);
        const bosses = floorData.rooms.filter((room) => room.type === 'boss');
        expect(floorData.rooms, `floor ${floor} seed ${seed}`).toHaveLength(
          expectedRoomBudget(floor),
        );
        expect(bosses, `floor ${floor} seed ${seed}`).toHaveLength(1);
        expect(bosses[0]).toBe(floorData.rooms[floorData.rooms.length - 1]);
        expect(bosses[0]).not.toBe(floorData.rooms[0]);
      }
    }
  });

  it('keeps every room inside the grid and clear of other rooms', () => {
    for (const floor of FLOORS) {
      for (const seed of SWEEP_SEEDS) {
        const {floorData} = generateDungeonFloor(floor, 0, seed);
        const {rooms, gridSize} = floorData;

        for (const room of rooms) {
          expect(room.w).toBeGreaterThanOrEqual(4);
          expect(room.w).toBeLessThanOrEqual(6);
          expect(room.h).toBeGreaterThanOrEqual(4);
          expect(room.h).toBeLessThanOrEqual(6);
          expect(room.x).toBeGreaterThanOrEqual(0);
          expect(room.y).toBeGreaterThanOrEqual(0);
          expect(room.x + room.w).toBeLessThanOrEqual(gridSize);
          expect(room.y + room.h).toBeLessThanOrEqual(gridSize);
        }

        for (let i = 0; i < rooms.length; i++) {
          for (let j = i + 1; j < rooms.length; j++) {
            expect(keepsOneTileGap(rooms[i], rooms[j])).toBe(true);
          }
        }
      }
    }
  });

  it('has exactly one spawn room and it is not the boss room', () => {
    for (const floor of FLOORS) {
      for (const seed of SWEEP_SEEDS) {
        const {floorData} = generateDungeonFloor(floor, 0, seed);
        const spawns = floorData.rooms.filter((room) => room.type === 'spawn');
        expect(spawns).toHaveLength(1);
        expect(spawns[0]).toBe(floorData.rooms[0]);
        expect(spawns[0].cleared).toBe(true);
        expect(spawns[0].type).not.toBe('boss');
        expect(floorData.stairs.unlocked).toBe(false);
      }
    }
  });

  it('keeps the room count within the configured budget', () => {
    for (const floor of FLOORS) {
      for (const seed of SWEEP_SEEDS) {
        const {floorData} = generateDungeonFloor(floor, 0, seed);
        const budget = expectedRoomBudget(floor);
        expect(floorData.rooms.length).toBeGreaterThanOrEqual(1);
        expect(floorData.rooms.length).toBeLessThanOrEqual(budget);
        expect(floorData.floorLevel).toBe(floor);
        expect(floorData.gridSize).toBe(24);
      }
    }
  });

  it('spawns exactly one boss whose archetype follows the floor', () => {
    for (const floor of FLOORS) {
      for (const seed of SWEEP_SEEDS) {
        const {enemies} = generateDungeonFloor(floor, 12, seed);
        const bosses = enemies.filter((enemy) => enemy.isBoss);
        expect(bosses).toHaveLength(1);
        expect(bosses[0].archetype).toBe(BOSS_ARCHETYPES[(floor - 1) % BOSS_ARCHETYPES.length]);
        expect(bosses[0].id).toBe(`boss_floor_${floor}`);
      }
    }
  });
});
