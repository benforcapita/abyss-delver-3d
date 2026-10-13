import {describe, expect, it} from 'vitest';
import {
  BOSS_TELEGRAPH_RADIUS,
  BOSS_TELEGRAPH_WINDUP,
  isInsideRing,
  isTelegraphComplete,
  startTelegraph,
  telegraphProgress,
  tickTelegraph,
} from './bossTelegraph';

describe('bossTelegraph', () => {
  describe('isInsideRing', () => {
    it('is true at the center and inside', () => {
      expect(isInsideRing(0, 0, 0, 0, BOSS_TELEGRAPH_RADIUS)).toBe(true);
      expect(isInsideRing(1, 1, 0, 0, BOSS_TELEGRAPH_RADIUS)).toBe(true);
      expect(isInsideRing(-2, -1, 0, 0, BOSS_TELEGRAPH_RADIUS)).toBe(true);
    });
    it('is inclusive on the edge', () => {
      expect(isInsideRing(BOSS_TELEGRAPH_RADIUS, 0, 0, 0, BOSS_TELEGRAPH_RADIUS)).toBe(true);
      expect(isInsideRing(0, -BOSS_TELEGRAPH_RADIUS, 0, 0, BOSS_TELEGRAPH_RADIUS)).toBe(true);
      // Diagonal edge: 3-4-5 triangle scaled to radius 5
      expect(isInsideRing(3, 4, 0, 0, 5)).toBe(true);
    });
    it('is false outside', () => {
      expect(isInsideRing(BOSS_TELEGRAPH_RADIUS + 0.01, 0, 0, 0, BOSS_TELEGRAPH_RADIUS)).toBe(false);
      expect(isInsideRing(10, 10, 0, 0, BOSS_TELEGRAPH_RADIUS)).toBe(false);
    });
    it('ignores Y entirely (XZ plane only)', () => {
      // Off-center ring: same XZ distance, height irrelevant by signature
      expect(isInsideRing(5, 5, 5, 5, 1)).toBe(true);
      expect(isInsideRing(6.5, 5, 5, 5, 1)).toBe(false);
    });
  });

  describe('startTelegraph', () => {
    it('uses exported defaults', () => {
      const t = startTelegraph(3, -2);
      expect(t).toEqual({
        cx: 3,
        cz: -2,
        radius: BOSS_TELEGRAPH_RADIUS,
        windup: BOSS_TELEGRAPH_WINDUP,
        elapsed: 0,
      });
    });
    it('accepts overrides', () => {
      const t = startTelegraph(0, 0, 4, 1.5);
      expect(t.radius).toBe(4);
      expect(t.windup).toBe(1.5);
      expect(t.elapsed).toBe(0);
    });
  });

  describe('tickTelegraph / progress / completion', () => {
    it('advances elapsed and reports progress in [0,1]', () => {
      let t = startTelegraph(0, 0);
      expect(telegraphProgress(t)).toBe(0);
      expect(isTelegraphComplete(t)).toBe(false);
      t = tickTelegraph(t, BOSS_TELEGRAPH_WINDUP / 2);
      expect(telegraphProgress(t)).toBeCloseTo(0.5);
      expect(isTelegraphComplete(t)).toBe(false);
      t = tickTelegraph(t, BOSS_TELEGRAPH_WINDUP / 2);
      expect(telegraphProgress(t)).toBe(1);
      expect(isTelegraphComplete(t)).toBe(true);
    });
    it('clamps elapsed to windup', () => {
      let t = startTelegraph(0, 0);
      t = tickTelegraph(t, BOSS_TELEGRAPH_WINDUP * 10);
      expect(t.elapsed).toBe(BOSS_TELEGRAPH_WINDUP);
      expect(telegraphProgress(t)).toBe(1);
      expect(isTelegraphComplete(t)).toBe(true);
    });
    it('treats negative dt as 0', () => {
      let t = startTelegraph(0, 0);
      t = tickTelegraph(t, 0.3);
      t = tickTelegraph(t, -5);
      expect(t.elapsed).toBeCloseTo(0.3);
    });
    it('returns a new object without mutating input', () => {
      const t = startTelegraph(1, 2);
      const next = tickTelegraph(t, 0.1);
      expect(next).not.toBe(t);
      expect(t.elapsed).toBe(0);
    });
  });
});
