import { describe, expect, it } from 'vitest';
import {
  SCORE, bossScore, enemyKillScore, floorClearScore, isGameOver, isVictory, killScore, victoryBonus,
} from './rules';

describe('scoring', () => {
  it('uses constants from existing code', () => {
    expect(SCORE).toEqual({ KILL_PER_FLOOR: 150, BOSS_PER_FLOOR: 1000, FLOOR_CLEAR_PER_FLOOR: 500, VICTORY_BASE: 5000, VICTORY_PER_HP: 10 });
  });
  it('scales kill/boss/floorClear by floor', () => {
    expect(killScore(3)).toBe(450);
    expect(bossScore(5)).toBe(5000);
    expect(floorClearScore(2)).toBe(1000);
    expect(enemyKillScore(4, true)).toBe(4000);
    expect(enemyKillScore(4, false)).toBe(600);
  });
  it('returns 0 for floor 0', () => {
    expect(killScore(0)).toBe(0);
    expect(bossScore(0)).toBe(0);
    expect(floorClearScore(0)).toBe(0);
  });
  it('victory bonus = 5000 + hp*10, hp clamped at 0', () => {
    expect(victoryBonus(100)).toBe(6000);
    expect(victoryBonus(0)).toBe(5000);
    expect(victoryBonus(-20)).toBe(5000);
  });
});

describe('isVictory', () => {
  it('true on floor 5 with boss dead and portal reached', () => {
    expect(isVictory(5, true, true)).toBe(true);
  });
  it('false when boss dead but portal not reached', () => {
    expect(isVictory(5, true, false)).toBe(false);
  });
  it('false when portal reached but boss alive', () => {
    expect(isVictory(5, false, true)).toBe(false);
  });
  it('false on floors other than 5', () => {
    for (const f of [0, 1, 4, 6]) expect(isVictory(f, true, true)).toBe(false);
  });
});

describe('isGameOver', () => {
  it('true at exactly 0 HP', () => expect(isGameOver(0)).toBe(true));
  it('true at negative HP', () => expect(isGameOver(-5)).toBe(true));
  it('false at positive HP, including fractional', () => {
    expect(isGameOver(1)).toBe(false);
    expect(isGameOver(0.1)).toBe(false);
  });
});
