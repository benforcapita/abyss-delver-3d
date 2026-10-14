import {describe, expect, it} from 'vitest';
import {
  compareWithEquipped,
  discardFromBag,
  equipFromBag,
  INVENTORY_CAPACITY,
  pickUpLoot,
  withDerivedStats,
} from './inventory';
import type {LootItem, PlayerStats} from './types';

const BASE_HP = 100;
const sword = (id: string, damage: number, extra: Partial<LootItem> = {}): LootItem => ({
  id, name: id, type: 'weapon', rarity: 'common', level: 1, iconName: 'sword', description: '', damage, critChance: 0.1, ...extra,
});
const armor = (id: string, defense: number, maxHpBonus: number): LootItem => ({
  id, name: id, type: 'armor', rarity: 'common', level: 1, iconName: 'shield', description: '', defense, maxHpBonus,
});
const ring: LootItem = {id: 'r', name: 'r', type: 'ring', rarity: 'common', level: 1, iconName: 'ring', description: '', critChance: 0.05, lifeSteal: 0.03};

function makeStats(over: Partial<PlayerStats> = {}): PlayerStats {
  return withDerivedStats(
    {
      hp: 120, maxHp: 120, mana: 60, maxMana: 60, stamina: 100, maxStamina: 100, gold: 0, potions: 3, keys: 1,
      equippedWeapon: sword('w0', 28), equippedArmor: armor('a0', 12, 20), equippedRing: ring, inventory: [],
      baseAttack: 0, baseDefense: 0, baseSpeed: 0, critChance: 0, lifeSteal: 0, dashCooldown: 0, invulnerableTime: 0,
      attackCooldown: 0, spellCooldown: 0, swingAnim: 0, castAnim: 0,
      ...over,
    },
    BASE_HP,
  );
}

describe('pickUpLoot', () => {
  it('auto-equips a better weapon and puts the old one in the bag', () => {
    const {stats, outcome} = pickUpLoot(makeStats(), sword('w1', 40), BASE_HP);
    expect(outcome).toBe('equipped');
    expect(stats.equippedWeapon.id).toBe('w1');
    expect(stats.inventory.map((i) => i.id)).toEqual(['w0']);
  });

  it('stores a worse item in the bag without equipping it', () => {
    const {stats, outcome} = pickUpLoot(makeStats(), sword('w1', 10, {critChance: 0}), BASE_HP);
    expect(outcome).toBe('stored');
    expect(stats.equippedWeapon.id).toBe('w0');
    expect(stats.inventory.map((i) => i.id)).toEqual(['w1']);
  });

  it('reports a full bag and keeps the item out', () => {
    const full = makeStats({inventory: Array.from({length: INVENTORY_CAPACITY}, (_, i) => sword(`x${i}`, 1))});
    const {stats, outcome} = pickUpLoot(full, sword('w1', 1), BASE_HP);
    expect(outcome).toBe('bag-full');
    expect(stats.inventory).toHaveLength(INVENTORY_CAPACITY);
  });

  it('consumes potions as before', () => {
    const potion: LootItem = {id: 'p', name: 'p', type: 'potion', rarity: 'common', level: 1, iconName: '', description: '', healAmount: 50};
    const {stats, outcome} = pickUpLoot(makeStats({hp: 30}), potion, BASE_HP);
    expect(outcome).toBe('consumed');
    expect(stats.potions).toBe(4);
    expect(stats.hp).toBe(80);
    expect(stats.inventory).toHaveLength(0);
  });
});

describe('equipFromBag', () => {
  it('swaps the bag item with the equipped one in place', () => {
    const s = makeStats({inventory: [ring, sword('w1', 10)]});
    const next = equipFromBag(s, 'w1', BASE_HP);
    expect(next.equippedWeapon.id).toBe('w1');
    expect(next.inventory.map((i) => i.id)).toEqual(['r', 'w0']);
  });

  it('re-derives crit and life steal from weapon + ring', () => {
    const next = equipFromBag(makeStats({inventory: [sword('w1', 10, {critChance: 0.3, lifeSteal: 0.1})]}), 'w1', BASE_HP);
    expect(next.critChance).toBeCloseTo(0.35);
    expect(next.lifeSteal).toBeCloseTo(0.13);
  });

  it('armor swaps change max HP without healing when swapped back and forth', () => {
    const s = makeStats({hp: 70, inventory: [armor('a1', 30, 60)]});
    const on = equipFromBag(s, 'a1', BASE_HP);
    expect(on.maxHp).toBe(160);
    expect(on.hp).toBe(110);
    const back = equipFromBag(on, 'a0', BASE_HP);
    expect(back.maxHp).toBe(120);
    expect(back.hp).toBe(70);
  });

  it('never kills the player by unequipping armor', () => {
    const s = makeStats({hp: 5, inventory: [armor('a1', 1, 0)]});
    expect(equipFromBag(s, 'a1', BASE_HP).hp).toBe(1);
  });

  it('ignores unknown ids', () => {
    const s = makeStats();
    expect(equipFromBag(s, 'nope', BASE_HP)).toBe(s);
  });
});

describe('discardFromBag / compareWithEquipped', () => {
  it('removes only the chosen item', () => {
    const s = makeStats({inventory: [sword('a', 1), sword('b', 2)]});
    expect(discardFromBag(s, 'a').inventory.map((i) => i.id)).toEqual(['b']);
  });

  it('lists only the stats that change', () => {
    const rows = compareWithEquipped(makeStats(), sword('w1', 35));
    expect(rows.map((r) => [r.label, r.value])).toEqual([['Damage', 7]]);
  });
});
