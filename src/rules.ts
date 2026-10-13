/**
 * Pure, side-effect-free game rules (LLD §4 and §6).
 * Constants mirror the existing code:
 *  - kill / boss: src/Game.tsx (scoreEarned = isBoss ? 1000*floor : 150*floor)
 *  - floor clear: src/App.tsx (score + 500*level)
 *  - victory bonus: new per LLD §6 (5000 + hp*10)
 */

export const FINAL_FLOOR = 5;

export const SCORE = {
  KILL_PER_FLOOR: 150,
  BOSS_PER_FLOOR: 1000,
  FLOOR_CLEAR_PER_FLOOR: 500,
  VICTORY_BASE: 5000,
  VICTORY_PER_HP: 10,
} as const;

export const killScore = (floor: number): number => SCORE.KILL_PER_FLOOR * floor;
export const bossScore = (floor: number): number => SCORE.BOSS_PER_FLOOR * floor;
export const floorClearScore = (floor: number): number => SCORE.FLOOR_CLEAR_PER_FLOOR * floor;
/** Remaining HP is clamped at 0 so a negative HP never reduces the bonus below the base. */
export const victoryBonus = (hp: number): number =>
  SCORE.VICTORY_BASE + Math.max(0, hp) * SCORE.VICTORY_PER_HP;

/** Score for a defeated enemy on the given floor. */
export const enemyKillScore = (floor: number, isBoss: boolean): number =>
  isBoss ? bossScore(floor) : killScore(floor);

/** LLD §4: level === 5 && boss defeated && player entered the portal. */
export const isVictory = (level: number, bossDefeated: boolean, reachedPortal: boolean): boolean =>
  level === FINAL_FLOOR && bossDefeated && reachedPortal;

/** LLD §4: hp <= 0. */
export const isGameOver = (hp: number): boolean => hp <= 0;
