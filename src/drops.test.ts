import { describe, expect, it } from 'vitest';
import { BONUS_POTION_CHANCE, roomClearDrops } from './drops';
import type { DungeonRoom } from './types';

const room = (cleared: boolean): DungeonRoom => ({ x: 2, y: 3, w: 5, h: 5, type: 'combat', cleared });
const fixed = (v: number) => () => v;

describe('roomClearDrops', () => {
  it('always yields a potion for a cleared room', () => {
    const drops = roomClearDrops(room(true), fixed(0.5));
    expect(drops.length).toBeGreaterThanOrEqual(1);
    expect(drops[0].type).toBe('potion');
  });
  it('yields nothing for an uncleared room', () => {
    expect(roomClearDrops(room(false), fixed(0))).toEqual([]);
  });
  it('rng 0 gives the bonus potion', () => {
    const drops = roomClearDrops(room(true), fixed(0));
    expect(drops).toHaveLength(2);
    expect(drops.every((d) => d.type === 'potion')).toBe(true);
    expect(new Set(drops.map((d) => d.id)).size).toBe(2);
  });
  it('rng 0.999 gives exactly one potion', () => {
    expect(roomClearDrops(room(true), fixed(0.999))).toHaveLength(1);
  });
  it('bonus threshold is exclusive', () => {
    expect(roomClearDrops(room(true), fixed(BONUS_POTION_CHANCE))).toHaveLength(1);
    expect(roomClearDrops(room(true), fixed(BONUS_POTION_CHANCE - 0.0001))).toHaveLength(2);
  });
  it('uses floorLevel and default rng', () => {
    const drops = roomClearDrops(room(true), undefined, 4);
    expect(drops[0].level).toBe(4);
    expect(drops[0].healAmount).toBe(50);
  });
});
