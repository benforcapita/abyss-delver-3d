import type { ChestEntity, DungeonFloorData, DungeonRoom, EnemyEntity, LootItem } from './types';

export type Rng = () => number;

function makePotion(room: DungeonRoom, floorLevel: number, index: number): LootItem {
  return {
    id: `loot_p_room_${room.x}_${room.y}_${index}`,
    name: 'Elixir of Restoration',
    type: 'potion',
    rarity: 'common',
    level: floorLevel,
    iconName: 'flask-hp',
    description: 'Restores 50 HP immediately.',
    healAmount: 50,
    manaAmount: 0,
  };
}

/**
 * LLD §7: guaranteed potion drop on room clear.
 * Uncleared rooms drop nothing. Cleared rooms always drop exactly one healing potion.
 * `rng` is kept (optional, currently unused) so randomized drops can be added
 * later without changing the signature.
 */
export function roomClearDrops(room: DungeonRoom, _rng: Rng = Math.random, floorLevel = 1): LootItem[] {
  if (!room.cleared) return [];
  return [makePotion(room, floorLevel, 0)];
}

/** World units per grid tile (mirrors dungeonGenerator's TILE_SIZE). */
export const TILE_SIZE = 4;

/**
 * Index of the room an enemy belongs to. Room mobs are generated with ids
 * `mob_<roomIndex>_<n>`; the floor boss lives in the last room.
 */
export function enemyRoomIndex(enemy: Pick<EnemyEntity, 'id' | 'isBoss'>, roomCount: number): number | null {
  if (enemy.isBoss) return roomCount > 0 ? roomCount - 1 : null;
  const m = /^mob_(\d+)_/.exec(enemy.id);
  if (!m) return null;
  const idx = Number(m[1]);
  return idx < roomCount ? idx : null;
}

/**
 * Called when `defeated` dies. If that was the last living enemy of its room,
 * marks the room cleared (mutates `floor.rooms[i].cleared`, like the existing
 * `stairs.unlocked` latch) and returns the room-clear drops as unopened chests
 * placed one tile left of the room centre, so they use the existing chest
 * pickup (Interact). Returns [] otherwise, and never fires twice for a room.
 */
export function roomClearChests(
  floor: Pick<DungeonFloorData, 'rooms' | 'gridSize' | 'floorLevel'>,
  enemies: readonly EnemyEntity[],
  defeated: EnemyEntity,
  rng: Rng = Math.random,
): ChestEntity[] {
  const idx = enemyRoomIndex(defeated, floor.rooms.length);
  if (idx == null) return [];
  const room = floor.rooms[idx];
  if (room.cleared) return [];
  const stillAlive = enemies.some(
    (e) => e.id !== defeated.id && e.hp > 0 && enemyRoomIndex(e, floor.rooms.length) === idx,
  );
  if (stillAlive) return [];
  room.cleared = true;
  const gx = room.x + room.w / 2 - 1;
  const gy = room.y + room.h / 2;
  return roomClearDrops(room, rng, floor.floorLevel).map((loot) => ({
    id: `chest_${loot.id}`,
    gridX: gx,
    gridY: gy,
    pos: [(gx - floor.gridSize / 2) * TILE_SIZE, 0.4, (gy - floor.gridSize / 2) * TILE_SIZE],
    opened: false,
    loot,
    tier: loot.rarity,
  }));
}
