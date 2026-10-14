import {describe, expect, it} from 'vitest';
import {
  alertTo,
  canSeePlayer,
  MEMORY_SECONDS,
  perceive,
  SIGHT_RANGE,
  type Awareness,
} from './enemyPerception';
import {gridToWorld} from './navigation';

const N = 12;
/** Open 12x12 room with a border wall and a wall at tile (6, 6). */
function makeGrid(): number[][] {
  const tiles = Array.from({length: N}, () => Array(N).fill(1));
  for (let i = 0; i < N; i++) {
    tiles[0][i] = tiles[N - 1][i] = tiles[i][0] = tiles[i][N - 1] = 2;
  }
  tiles[6][6] = 2;
  return tiles;
}
const w = (g: number) => gridToWorld(g, N);
/** Yaw facing +X (model faces (sin yaw, cos yaw)). */
const FACE_POS_X = Math.PI / 2;

describe('canSeePlayer', () => {
  const tiles = makeGrid();

  it('sees a player in front, in range, with a clear line', () => {
    expect(canSeePlayer({x: w(2), z: w(3), yaw: FACE_POS_X, alerted: false}, w(5), w(3), tiles)).toBe(true);
  });

  it('does not see through walls', () => {
    expect(canSeePlayer({x: w(4), z: w(6), yaw: FACE_POS_X, alerted: true}, w(8), w(6), tiles)).toBe(false);
  });

  it('does not see an unaware player behind it', () => {
    expect(canSeePlayer({x: w(5), z: w(3), yaw: FACE_POS_X, alerted: false}, w(2), w(3), tiles)).toBe(false);
  });

  it('once alerted, tracks the player in any direction', () => {
    expect(canSeePlayer({x: w(5), z: w(3), yaw: FACE_POS_X, alerted: true}, w(2), w(3), tiles)).toBe(true);
  });

  it('notices a player right behind it (proximity) when the line is clear', () => {
    expect(canSeePlayer({x: w(5), z: w(3), yaw: FACE_POS_X, alerted: false}, w(5) - 2, w(3), tiles)).toBe(true);
  });

  it('ignores players beyond sight range', () => {
    const big = Array.from({length: 40}, () => Array(40).fill(1));
    expect(canSeePlayer({x: 0, z: 0, yaw: FACE_POS_X, alerted: true}, SIGHT_RANGE + 1, 0, big)).toBe(false);
  });
});

describe('perceive / alertTo', () => {
  it('records the last known position and refreshes memory while seen, then decays', () => {
    const tiles = makeGrid();
    const a: Awareness = {seesPlayer: false, memory: 0};
    const viewer = {x: w(2), z: w(3), yaw: FACE_POS_X, alerted: false};
    expect(perceive(a, viewer, w(5), w(3), tiles, 0.1)).toBe(true);
    expect(a.lastKnownPos).toEqual([w(5), w(3)]);
    expect(a.memory).toBe(MEMORY_SECONDS);

    // Player steps behind the pillar.
    const hidden = {x: w(4), z: w(6), yaw: FACE_POS_X, alerted: true};
    expect(perceive(a, hidden, w(8), w(6), tiles, 1)).toBe(false);
    expect(a.seesPlayer).toBe(false);
    expect(a.memory).toBeCloseTo(MEMORY_SECONDS - 1);
    expect(a.lastKnownPos).toEqual([w(5), w(3)]);
  });

  it('alertTo points the enemy at the attacker', () => {
    const a: Awareness = {seesPlayer: false, memory: 0};
    alertTo(a, 3, 4);
    expect(a.lastKnownPos).toEqual([3, 4]);
    expect(a.memory).toBe(MEMORY_SECONDS);
  });
});
