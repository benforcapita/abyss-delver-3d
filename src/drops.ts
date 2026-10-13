import type { DungeonRoom, LootItem } from './types';

export type Rng = () => number;

/** Chance (0..1) of a bonus second potion when a room is cleared. Not specified in LLD. */
export const BONUS_POTION_CHANCE = 0.25;

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
 * Uncleared rooms drop nothing. Cleared rooms always drop one healing potion,
 * plus a bonus potion when rng() < BONUS_POTION_CHANCE.
 */
export function roomClearDrops(room: DungeonRoom, rng: Rng = Math.random, floorLevel = 1): LootItem[] {
  if (!room.cleared) return [];
  const drops = [makePotion(room, floorLevel, 0)];
  if (rng() < BONUS_POTION_CHANCE) drops.push(makePotion(room, floorLevel, 1));
  return drops;
}
