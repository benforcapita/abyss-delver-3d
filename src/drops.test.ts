import { describe, expect, it } from 'vitest';
import { roomClearDrops } from './drops';
import type { DungeonRoom } from './types';

const room = (cleared: boolean, type: DungeonRoom['type'] = 'combat'): DungeonRoom =>
  ({ x: 2, y: 3, w: 5, h: 5, type, cleared });
const fixed = (v: number) => () => v;

describe('roomClearDrops', () => {
  it('yields exactly one potion for a cleared room', () => {
    const drops = roomClearDrops(room(true), fixed(0.5));
    expect(drops).toHaveLength(1);
    expect(drops[0].type).toBe('potion');
    expect(drops[0].healAmount).toBe(50);
  });
  it('yields nothing for an uncleared room', () => {
    expect(roomClearDrops(room(false), fixed(0))).toEqual([]);
    expect(roomClearDrops(room(false))).toEqual([]);
  });
  it('rng edge values 0 and 0.999 both give exactly one potion', () => {
    expect(roomClearDrops(room(true), fixed(0))).toHaveLength(1);
    expect(roomClearDrops(room(true), fixed(0.999))).toHaveLength(1);
  });
  it('is deterministic and independent of rng', () => {
    expect(roomClearDrops(room(true), fixed(0))).toEqual(roomClearDrops(room(true), fixed(0.999)));
  });
  it('guarantees a potion for every room type', () => {
    for (const t of ['spawn', 'combat', 'treasure', 'shrine', 'boss'] as const) {
      expect(roomClearDrops(room(true, t))).toHaveLength(1);
    }
  });
  it('uses floorLevel and works with default rng', () => {
    expect(roomClearDrops(room(true), undefined, 4)[0].level).toBe(4);
  });
});
