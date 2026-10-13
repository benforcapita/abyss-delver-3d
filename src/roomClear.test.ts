import { describe, expect, it } from 'vitest';
import { enemyRoomIndex, roomClearChests, TILE_SIZE } from './drops';
import { generateDungeonFloor } from './dungeonGenerator';
import type { DungeonRoom, EnemyEntity } from './types';

const mob = (id: string, hp = 0, isBoss = false) => ({ id, hp, isBoss }) as EnemyEntity;
const floorWith = (rooms: DungeonRoom[]) => ({ rooms, gridSize: 24, floorLevel: 2 });
const r = (type: DungeonRoom['type'] = 'combat'): DungeonRoom => ({ x: 4, y: 6, w: 5, h: 4, type, cleared: false });

describe('enemyRoomIndex', () => {
  it('parses mob ids and maps the boss to the last room', () => {
    expect(enemyRoomIndex(mob('mob_3_1'), 6)).toBe(3);
    expect(enemyRoomIndex(mob('boss_floor_1', 0, true), 6)).toBe(5);
    expect(enemyRoomIndex(mob('mob_9_0'), 6)).toBeNull();
    expect(enemyRoomIndex(mob('weird'), 6)).toBeNull();
  });
});

describe('roomClearChests', () => {
  it('drops nothing while room-mates are alive', () => {
    const f = floorWith([r('spawn'), r()]);
    const a = mob('mob_1_0', 0), b = mob('mob_1_1', 10);
    expect(roomClearChests(f, [a, b], a)).toEqual([]);
    expect(f.rooms[1].cleared).toBe(false);
  });

  it('drops one potion chest when the last enemy dies, once', () => {
    const f = floorWith([r('spawn'), r()]);
    const a = mob('mob_1_0', 0), b = mob('mob_1_1', 0), other = mob('mob_0_0', 50);
    const chests = roomClearChests(f, [a, b, other], b);
    expect(chests).toHaveLength(1);
    expect(chests[0]).toMatchObject({ opened: false, loot: { type: 'potion', healAmount: 50, level: 2 } });
    expect(chests[0].pos).toEqual([(4 + 2.5 - 1 - 12) * TILE_SIZE, 0.4, (6 + 2 - 12) * TILE_SIZE]);
    expect(f.rooms[1].cleared).toBe(true);
    expect(roomClearChests(f, [a, b], a)).toEqual([]);
  });

  it('boss death clears the boss room', () => {
    const f = floorWith([r('spawn'), r('boss')]);
    const boss = mob('boss_floor_2', 0, true);
    expect(roomClearChests(f, [boss], boss)).toHaveLength(1);
  });

  it('works with real generator ids: killing every mob of a combat room drops a potion', () => {
    const { floorData, enemies } = generateDungeonFloor(1, 0, 12345);
    const idx = floorData.rooms.findIndex((x) => x.type === 'combat');
    expect(idx).toBeGreaterThan(-1);
    const roomMobs = enemies.filter((e) => enemyRoomIndex(e, floorData.rooms.length) === idx);
    expect(roomMobs.length).toBeGreaterThan(0);
    const out = roomMobs.map((e) => { e.hp = 0; return roomClearChests(floorData, enemies, e); });
    expect(out.flat()).toHaveLength(1);
    expect(out.at(-1)).toHaveLength(1);
  });
});
