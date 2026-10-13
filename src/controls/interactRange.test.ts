import {describe, expect, it} from 'vitest';
import {INTERACT_RANGE, nearChestOrShrine} from './interactRange';

const chest = (x: number, z: number, opened = false) => ({
  pos: [x, 0, z] as const,
  opened,
});
const shrine = (x: number, z: number, used = false) => ({
  pos: [x, 0, z] as const,
  used,
});

describe('nearChestOrShrine', () => {
  it('is true inside the interact range of an unopened chest', () => {
    expect(nearChestOrShrine(0, 0, [chest(INTERACT_RANGE - 0.1, 0)], [])).toBe(true);
  });

  it('is false at or beyond the range, and ignores opened chests and used shrines', () => {
    expect(nearChestOrShrine(0, 0, [chest(INTERACT_RANGE, 0)], [])).toBe(false);
    expect(nearChestOrShrine(0, 0, [chest(1, 0, true)], [])).toBe(false);
    expect(nearChestOrShrine(0, 0, [], [shrine(1, 0, true)])).toBe(false);
  });

  it('is true beside an unused shrine', () => {
    expect(nearChestOrShrine(2, 2, [], [shrine(2, 2)])).toBe(true);
  });
});
