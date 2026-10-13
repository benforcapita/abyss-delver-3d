import type { DungeonRoom, LootItem } from './types';

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
