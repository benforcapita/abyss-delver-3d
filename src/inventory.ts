/**
 * Inventory & equipment rules (pure, no React). Gear lives in
 * `PlayerStats.inventory` (the bag) or in one of the three equipment slots;
 * stats that depend on gear (crit, life steal, max HP) are always re-derived
 * from what is equipped, so swapping items back and forth can never stack
 * bonuses or heal you.
 */
import type {ItemType, LootItem, PlayerStats} from './types';

export const INVENTORY_CAPACITY = 18;

export type GearType = Exclude<ItemType, 'potion'>;
export type GearSlot = 'equippedWeapon' | 'equippedArmor' | 'equippedRing';

export const SLOT_FOR: Record<GearType, GearSlot> = {
  weapon: 'equippedWeapon',
  armor: 'equippedArmor',
  ring: 'equippedRing',
};

export function isGear(item: LootItem): item is LootItem & {type: GearType} {
  return item.type === 'weapon' || item.type === 'armor' || item.type === 'ring';
}

/** Single number used to rank items of the same type (higher is better). */
export function itemPower(item: LootItem): number {
  return (
    (item.damage ?? 0) +
    (item.defense ?? 0) +
    (item.maxHpBonus ?? 0) * 0.25 +
    (item.critChance ?? 0) * 100 +
    (item.lifeSteal ?? 0) * 100 +
    (item.moveSpeedBonus ?? 0) * 6
  );
}

/** Recompute gear-derived stats. HP keeps the same amount missing (min 1) when max HP changes. */
export function withDerivedStats(stats: PlayerStats, baseMaxHp: number): PlayerStats {
  const {equippedWeapon: w, equippedArmor: a, equippedRing: r} = stats;
  const maxHp = baseMaxHp + (a.maxHpBonus ?? 0);
  const hp =
    stats.hp <= 0 ? stats.hp : Math.max(1, Math.min(maxHp, stats.hp + (maxHp - stats.maxHp)));
  return {
    ...stats,
    maxHp,
    hp,
    critChance: (w.critChance ?? 0) + (r.critChance ?? 0),
    lifeSteal: (w.lifeSteal ?? 0) + (r.lifeSteal ?? 0),
  };
}

/** Equip a bag item; whatever was in that slot goes back into the bag at the same position. */
export function equipFromBag(stats: PlayerStats, itemId: string, baseMaxHp: number): PlayerStats {
  const idx = stats.inventory.findIndex((i) => i.id === itemId);
  if (idx < 0) return stats;
  const item = stats.inventory[idx];
  if (!isGear(item)) return stats;
  const slot = SLOT_FOR[item.type];
  const inventory = [...stats.inventory];
  inventory[idx] = stats[slot];
  return withDerivedStats({...stats, [slot]: item, inventory}, baseMaxHp);
}

export function discardFromBag(stats: PlayerStats, itemId: string): PlayerStats {
  const inventory = stats.inventory.filter((i) => i.id !== itemId);
  return inventory.length === stats.inventory.length ? stats : {...stats, inventory};
}

export type LootOutcome = 'equipped' | 'stored' | 'bag-full' | 'consumed';

/**
 * Picking up loot: potions are consumed/stacked as before; gear is
 * auto-equipped when it beats the current item (the old one goes to the bag),
 * otherwise it is stored in the bag (or lost if the bag is full).
 */
export function pickUpLoot(
  stats: PlayerStats,
  item: LootItem,
  baseMaxHp: number,
): {stats: PlayerStats; outcome: LootOutcome} {
  if (!isGear(item)) {
    return {
      outcome: 'consumed',
      stats: {
        ...stats,
        potions: Math.min(9, stats.potions + 1),
        hp: item.healAmount ? Math.min(stats.maxHp, stats.hp + item.healAmount) : stats.hp,
        mana: item.manaAmount ? Math.min(stats.maxMana, stats.mana + item.manaAmount) : stats.mana,
      },
    };
  }
  const slot = SLOT_FOR[item.type];
  const current = stats[slot];
  if (itemPower(item) > itemPower(current)) {
    const inventory =
      stats.inventory.length < INVENTORY_CAPACITY ? [...stats.inventory, current] : stats.inventory;
    return {
      outcome: 'equipped',
      stats: withDerivedStats({...stats, [slot]: item, inventory}, baseMaxHp),
    };
  }
  if (stats.inventory.length >= INVENTORY_CAPACITY) return {stats, outcome: 'bag-full'};
  return {stats: {...stats, inventory: [...stats.inventory, item]}, outcome: 'stored'};
}

export interface StatDelta {
  label: string;
  value: number;
  /** Display formatter for the signed value. */
  format: (v: number) => string;
}

const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
const num = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 10) / 10}`;

/** Per-stat difference if `item` replaced what is currently equipped in its slot (non-zero only). */
export function compareWithEquipped(stats: PlayerStats, item: LootItem): StatDelta[] {
  if (!isGear(item)) return [];
  const cur = stats[SLOT_FOR[item.type]];
  const rows: StatDelta[] = [
    {label: 'Damage', value: (item.damage ?? 0) - (cur.damage ?? 0), format: num},
    {label: 'Defense', value: (item.defense ?? 0) - (cur.defense ?? 0), format: num},
    {label: 'Max HP', value: (item.maxHpBonus ?? 0) - (cur.maxHpBonus ?? 0), format: num},
    {label: 'Crit', value: (item.critChance ?? 0) - (cur.critChance ?? 0), format: pct},
    {label: 'Life Steal', value: (item.lifeSteal ?? 0) - (cur.lifeSteal ?? 0), format: pct},
    {label: 'Speed', value: (item.moveSpeedBonus ?? 0) - (cur.moveSpeedBonus ?? 0), format: num},
  ];
  return rows.filter((r) => Math.abs(r.value) > 1e-6);
}
