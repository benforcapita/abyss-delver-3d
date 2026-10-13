import {describe, expect, it} from 'vitest';
import {frameDelta, isGamePaused} from './pause';

describe('isGamePaused', () => {
  it('returns false only when status is PLAYING and all overlays are closed', () => {
    expect(
      isGamePaused({
        status: 'PLAYING',
        menuOpen: false,
        howToOpen: false,
        floorSummaryOpen: false,
      }),
    ).toBe(false);
  });

  it('returns true when status is not PLAYING even if no overlay is open', () => {
    for (const status of ['START', 'GAME_OVER', 'VICTORY', 'PAUSED', 'LOADING', '']) {
      expect(
        isGamePaused({
          status,
          menuOpen: false,
          howToOpen: false,
          floorSummaryOpen: false,
        }),
      ).toBe(true);
    }
  });

  it('returns true when menu is open during PLAYING', () => {
    expect(
      isGamePaused({
        status: 'PLAYING',
        menuOpen: true,
        howToOpen: false,
        floorSummaryOpen: false,
      }),
    ).toBe(true);
  });

  it('returns true when how-to-play overlay is open during PLAYING', () => {
    expect(
      isGamePaused({
        status: 'PLAYING',
        menuOpen: false,
        howToOpen: true,
        floorSummaryOpen: false,
      }),
    ).toBe(true);
  });

  it('returns true when floor summary is open during PLAYING', () => {
    expect(
      isGamePaused({
        status: 'PLAYING',
        menuOpen: false,
        howToOpen: false,
        floorSummaryOpen: true,
      }),
    ).toBe(true);
  });

  it('returns true when multiple overlays are open simultaneously', () => {
    expect(
      isGamePaused({
        status: 'PLAYING',
        menuOpen: true,
        howToOpen: true,
        floorSummaryOpen: true,
      }),
    ).toBe(true);
  });

  it('returns true when not PLAYING and overlays are open', () => {
    expect(
      isGamePaused({
        status: 'START',
        menuOpen: true,
        howToOpen: false,
        floorSummaryOpen: false,
      }),
    ).toBe(true);
  });
});

describe('frameDelta', () => {
  it('returns 0 on the first frame after resume', () => {
    expect(frameDelta(0.016, true)).toBe(0);
    expect(frameDelta(0.5, true)).toBe(0);
    expect(frameDelta(1.0, true, 0.2)).toBe(0);
  });

  it('returns delta when delta <= maxDt and not resumed this frame', () => {
    expect(frameDelta(0.016, false)).toBeCloseTo(0.016);
    expect(frameDelta(0.05, false)).toBeCloseTo(0.05);
    expect(frameDelta(0.1, false)).toBeCloseTo(0.1);
  });

  it('clamps delta to default maxDt (0.1) when delta exceeds 0.1', () => {
    expect(frameDelta(0.2, false)).toBe(0.1);
    expect(frameDelta(1.5, false)).toBe(0.1);
    expect(frameDelta(100, false)).toBe(0.1);
  });

  it('supports custom maxDt', () => {
    expect(frameDelta(0.15, false, 0.25)).toBeCloseTo(0.15);
    expect(frameDelta(0.35, false, 0.25)).toBe(0.25);
    expect(frameDelta(0.08, false, 0.05)).toBe(0.05);
  });

  it('returns 0 for zero delta', () => {
    expect(frameDelta(0, false)).toBe(0);
  });

  it('never returns negative numbers', () => {
    expect(frameDelta(-0.016, false)).toBe(0);
    expect(frameDelta(-100, false)).toBe(0);
    expect(frameDelta(-Infinity, false)).toBe(0);
    expect(Object.is(frameDelta(-0, false), 0)).toBe(true);
  });

  it('never returns NaN', () => {
    expect(frameDelta(NaN, false)).toBe(0);
    expect(frameDelta(NaN, true)).toBe(0);
    expect(frameDelta(0.016, false, NaN)).toBe(0);
    expect(frameDelta(0.016, false, -0.5)).toBe(0);
  });
});
