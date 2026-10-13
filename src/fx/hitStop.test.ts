import {describe, expect, it} from 'vitest';
import {frameDelta, isGamePaused} from '../pause';
import {HEAVY_HIT_DAMAGE} from './screenShake';
import {
  HIT_STOP_CAP_MS,
  HIT_STOP_MS,
  createHitStopState,
  isHeavyHit,
  stepHitStop,
  triggerHitStop,
} from './hitStop';

const playing = {
  status: 'PLAYING',
  menuOpen: false,
  howToOpen: false,
  floorSummaryOpen: false,
};

describe('hit-stop duration cap and stacking', () => {
  it('uses a short freeze inside 50–80 ms', () => {
    expect(HIT_STOP_MS).toBeGreaterThanOrEqual(50);
    expect(HIT_STOP_MS).toBeLessThanOrEqual(80);
    expect(HIT_STOP_CAP_MS).toBeLessThanOrEqual(80);
    expect(HIT_STOP_CAP_MS).toBeGreaterThanOrEqual(HIT_STOP_MS);

    const state = createHitStopState();
    triggerHitStop(state);
    expect(state.remainingMs).toBe(HIT_STOP_MS);
  });

  it('clamps a single request to the cap', () => {
    const state = createHitStopState();
    triggerHitStop(state, 500);
    expect(state.remainingMs).toBe(HIT_STOP_CAP_MS);
    triggerHitStop(state, 10_000);
    expect(state.remainingMs).toBe(HIT_STOP_CAP_MS);
  });

  it('does not stack hits into a longer freeze', () => {
    const state = createHitStopState();
    triggerHitStop(state);
    triggerHitStop(state);
    triggerHitStop(state, HIT_STOP_CAP_MS);
    triggerHitStop(state, 500);
    expect(state.remainingMs).toBe(HIT_STOP_MS);

    stepHitStop(state, 0.02, false);
    const mid = state.remainingMs;
    expect(mid).toBeCloseTo(HIT_STOP_MS - 20);
    triggerHitStop(state, HIT_STOP_CAP_MS);
    expect(state.remainingMs).toBeCloseTo(mid);
  });

  it('ignores a non-positive duration and only arms heavy hits', () => {
    const state = createHitStopState();
    triggerHitStop(state, 0);
    triggerHitStop(state, -20);
    triggerHitStop(state, Number.NaN);
    expect(state.remainingMs).toBe(0);

    expect(isHeavyHit(HEAVY_HIT_DAMAGE - 1, false)).toBe(false);
    expect(isHeavyHit(HEAVY_HIT_DAMAGE, false)).toBe(true);
    expect(isHeavyHit(4, true)).toBe(true);
  });

  it('scales delta to 0 for the window, then returns the leftover slice', () => {
    const state = createHitStopState();
    triggerHitStop(state);

    const frozen = stepHitStop(state, 0.016, false);
    expect(frozen).toEqual({dt: 0, scale: 0});
    expect(state.remainingMs).toBeCloseTo(HIT_STOP_MS - 16);

    const rest = stepHitStop(state, 1, false);
    expect(state.remainingMs).toBe(0);
    expect(rest.dt).toBeCloseTo(1 - (HIT_STOP_MS - 16) / 1000);
    expect(rest.scale).toBeCloseTo(rest.dt);

    const after = stepHitStop(state, 0.016, false);
    expect(after).toEqual({dt: 0.016, scale: 1});
  });
});

describe('hit-stop pause interaction', () => {
  it('holds the freeze while isGamePaused() is true, then resumes it', () => {
    const state = createHitStopState();
    triggerHitStop(state);

    const menu = {...playing, menuOpen: true};
    expect(isGamePaused(menu)).toBe(true);
    const held = stepHitStop(state, frameDelta(0.5, false), isGamePaused(menu));
    expect(held).toEqual({dt: 0, scale: 0});
    expect(state.remainingMs).toBe(HIT_STOP_MS);

    const howTo = {...playing, howToOpen: true};
    stepHitStop(state, 0.2, isGamePaused(howTo));
    const summary = {...playing, floorSummaryOpen: true};
    stepHitStop(state, 0.2, isGamePaused(summary));
    const gameOver = {...playing, status: 'GAME_OVER'};
    stepHitStop(state, 0.2, isGamePaused(gameOver));
    expect(state.remainingMs).toBe(HIT_STOP_MS);

    expect(isGamePaused(playing)).toBe(false);
    const resumeFrame = stepHitStop(state, frameDelta(0.05, true), isGamePaused(playing));
    expect(resumeFrame.dt).toBe(0);
    expect(state.remainingMs).toBe(HIT_STOP_MS);

    const next = stepHitStop(state, frameDelta(0.016, false), isGamePaused(playing));
    expect(next.dt).toBe(0);
    expect(state.remainingMs).toBeCloseTo(HIT_STOP_MS - 16);
  });
});
