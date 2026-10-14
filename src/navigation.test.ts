import {describe, expect, it} from 'vitest';
import {
  gridToWorld,
  hasLineOfSight,
  isAreaFree,
  isWalkableWorld,
  moveWithCollision,
  worldToGrid,
} from './navigation';

const N = 8;
/** 8x8 grid: walls on the border, floor inside, plus a wall at tile (4, 4). */
function makeGrid(): number[][] {
  const tiles = Array.from({length: N}, () => Array(N).fill(1));
  for (let i = 0; i < N; i++) {
    tiles[0][i] = tiles[N - 1][i] = tiles[i][0] = tiles[i][N - 1] = 2;
  }
  tiles[4][4] = 2;
  return tiles;
}
const w = (g: number) => gridToWorld(g, N);

describe('worldToGrid', () => {
  it('maps a tile centre and anything within ±half a tile to that tile', () => {
    expect(worldToGrid(w(3), N)).toBe(3);
    expect(worldToGrid(w(3) + 1.9, N)).toBe(3);
    expect(worldToGrid(w(3) - 1.9, N)).toBe(3);
    expect(worldToGrid(w(3) + 2.1, N)).toBe(4);
  });

  it('matches the rendered wall box (centred on the tile)', () => {
    const tiles = makeGrid();
    // Wall (4,4) spans w(4) ± 2 on both axes.
    expect(isWalkableWorld(tiles, w(4) - 1.9, w(4))).toBe(false);
    expect(isWalkableWorld(tiles, w(4) + 1.9, w(4))).toBe(false);
    expect(isWalkableWorld(tiles, w(4) - 2.1, w(4))).toBe(true);
  });
});

describe('moveWithCollision', () => {
  it('moves freely in open floor', () => {
    const p = moveWithCollision(makeGrid(), w(2), w(2), 1, 0.5, 0.35);
    expect(p.x).toBeCloseTo(w(2) + 1);
    expect(p.z).toBeCloseTo(w(2) + 0.5);
  });

  it('stops at a wall keeping the body radius clear', () => {
    const tiles = makeGrid();
    const p = moveWithCollision(tiles, w(3), w(4), 10, 0, 0.35);
    expect(p.x).toBeLessThan(w(4) - 2);
    expect(isAreaFree(tiles, p.x, p.z, 0.35)).toBe(true);
  });

  it('slides along a wall when moving diagonally into it', () => {
    const p = moveWithCollision(makeGrid(), w(3), w(4), 3, 1, 0.35);
    expect(p.z).toBeCloseTo(w(4) + 1);
  });

  it('does not tunnel through a wall on a single large step', () => {
    const p = moveWithCollision(makeGrid(), w(3), w(4), 12, 0, 0.35);
    expect(p.x).toBeLessThan(w(4));
  });
});

describe('hasLineOfSight', () => {
  it('is clear across open floor', () => {
    expect(hasLineOfSight(makeGrid(), w(1), w(1), w(6), w(2))).toBe(true);
  });

  it('is blocked by a wall tile in between', () => {
    expect(hasLineOfSight(makeGrid(), w(2), w(4), w(6), w(4))).toBe(false);
  });

  it('is symmetric', () => {
    const tiles = makeGrid();
    expect(hasLineOfSight(tiles, w(6), w(4), w(2), w(4))).toBe(false);
    expect(hasLineOfSight(tiles, w(6), w(2), w(1), w(1))).toBe(true);
  });
});
