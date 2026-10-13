import {describe, expect, it} from 'vitest';
import {
  advanceTelegraph,
  BOSS_TELEGRAPH_RADIUS,
  BOSS_TELEGRAPH_WINDUP,
  isInsideRing,
  isTelegraphComplete,
  meleeHitLands,
  shouldResolveTelegraph,
  startTelegraph,
  telegraphProgress,
  tickTelegraph,
  usesGroundTelegraph,
} from './bossTelegraph';
import {isGamePaused} from './pause';

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

  describe('advanceTelegraph', () => {
    it('returns the same object and does not advance elapsed while paused', () => {
      const t = tickTelegraph(startTelegraph(0, 0), 0.3);
      const next = advanceTelegraph(t, 0.5, true);
      expect(next).toBe(t);
      expect(next.elapsed).toBeCloseTo(0.3);
      expect(telegraphProgress(next)).toBeCloseTo(0.3 / BOSS_TELEGRAPH_WINDUP);
    });
    it('advances elapsed when not paused', () => {
      let t = startTelegraph(0, 0);
      t = advanceTelegraph(t, BOSS_TELEGRAPH_WINDUP / 2, false);
      expect(t.elapsed).toBeCloseTo(BOSS_TELEGRAPH_WINDUP / 2);
      t = advanceTelegraph(t, BOSS_TELEGRAPH_WINDUP / 2, false);
      expect(t.elapsed).toBe(BOSS_TELEGRAPH_WINDUP);
      expect(isTelegraphComplete(t)).toBe(true);
    });
  });

  describe('shouldResolveTelegraph', () => {
    it('is false while paused even when the windup completed', () => {
      const t = tickTelegraph(startTelegraph(0, 0), BOSS_TELEGRAPH_WINDUP);
      expect(isTelegraphComplete(t)).toBe(true);
      expect(shouldResolveTelegraph(t, true)).toBe(false);
    });
    it('matches isTelegraphComplete when not paused', () => {
      const incomplete = startTelegraph(0, 0);
      const complete = tickTelegraph(startTelegraph(0, 0), BOSS_TELEGRAPH_WINDUP);
      expect(shouldResolveTelegraph(incomplete, false)).toBe(false);
      expect(shouldResolveTelegraph(complete, false)).toBe(true);
    });
  });

  describe('pause integration (isGamePaused)', () => {
    const pausedState = {
      status: 'PLAYING',
      menuOpen: true,
      howToOpen: false,
      floorSummaryOpen: false,
    };
    const playingState = {
      status: 'PLAYING',
      menuOpen: false,
      howToOpen: false,
      floorSummaryOpen: false,
    };

    it('freezes telegraph progress while an overlay is open', () => {
      const paused = isGamePaused(pausedState);
      expect(paused).toBe(true);
      let t = startTelegraph(0, 0);
      const before = t;
      t = advanceTelegraph(t, 0.4, paused);
      expect(t).toBe(before);
      expect(t.elapsed).toBe(0);
      expect(shouldResolveTelegraph(t, paused)).toBe(false);
    });

    it('advances and resolves normally while playing with no overlays', () => {
      const paused = isGamePaused(playingState);
      expect(paused).toBe(false);
      let t = startTelegraph(0, 0);
      t = advanceTelegraph(t, BOSS_TELEGRAPH_WINDUP, paused);
      expect(t.elapsed).toBe(BOSS_TELEGRAPH_WINDUP);
      expect(shouldResolveTelegraph(t, paused)).toBe(true);
    });

    it('a completed windup still cannot resolve while paused', () => {
      const complete = tickTelegraph(startTelegraph(0, 0), BOSS_TELEGRAPH_WINDUP);
      expect(shouldResolveTelegraph(complete, isGamePaused(pausedState))).toBe(
        false,
      );
      expect(shouldResolveTelegraph(complete, isGamePaused(playingState))).toBe(
        true,
      );
    });
  });

  describe('usesGroundTelegraph', () => {
    it('is true for melee/slam bosses', () => {
      for (const archetype of [
        'boss_bone_colossus',
        'boss_gorgon',
        'boss_shadow_knight',
        'boss_void_overlord',
      ] as const) {
        expect(usesGroundTelegraph(true, archetype)).toBe(true);
      }
    });
    it('is false for the crimson archmage (single-target fireball, no AoE ring)', () => {
      expect(usesGroundTelegraph(true, 'boss_crimson_archmage')).toBe(false);
    });
    it('is false for non-bosses', () => {
      for (const archetype of [
        'skeleton',
        'cultist',
        'slime',
      ] as const) {
        expect(usesGroundTelegraph(false, archetype)).toBe(false);
      }
      // A non-boss flag always wins, even with a boss archetype
      expect(usesGroundTelegraph(false, 'boss_bone_colossus')).toBe(false);
    });
  });

  describe('meleeHitLands', () => {
    it('lands only when in range and inside the ring', () => {
      expect(meleeHitLands(true, true)).toBe(true);
      expect(meleeHitLands(true, false)).toBe(false);
      expect(meleeHitLands(false, true)).toBe(false);
      expect(meleeHitLands(false, false)).toBe(false);
    });
  });
});
