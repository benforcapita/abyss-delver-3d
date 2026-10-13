import {afterEach, describe, expect, it} from 'vitest';
import {getSettings} from '../platform/settings';
import {
  HEAVY_HIT_DAMAGE,
  HEAVY_HIT_SHAKE,
  PLAYER_HURT_SHAKE,
  SHAKE_AMPLITUDE,
  SHAKE_DECAY_PER_SEC,
  createShakeState,
  decayShake,
  outgoingShakeAmount,
  playerHurtShake,
  resolveScreenShakeEnabled,
  setScreenShakeEnabled,
  readScreenShakeSetting,
  shakeOffset,
  stepScreenShake,
  triggerScreenShake,
} from './screenShake';

const fullRight = () => 1;

describe('shake decay', () => {
  it('subtracts decay-per-second and clamps at zero', () => {
    expect(decayShake(1, 0.2)).toBeCloseTo(1 - 0.2 * SHAKE_DECAY_PER_SEC);
    expect(decayShake(0.1, 1)).toBe(0);
    expect(decayShake(0, 0.5)).toBe(0);
    expect(decayShake(-1, 0.1)).toBe(0);
    expect(decayShake(0.4, 0)).toBeCloseTo(0.4);
  });

  it('stepScreenShake returns an offset then decays intensity', () => {
    const state = createShakeState();
    triggerScreenShake(state, 1);
    const offset = stepScreenShake(state, 0.2, {enabled: true, random: fullRight});
    expect(offset.x).toBeCloseTo(0.5 * SHAKE_AMPLITUDE);
    expect(offset.y).toBeCloseTo(0.5 * SHAKE_AMPLITUDE);
    expect(state.intensity).toBeCloseTo(decayShake(1, 0.2));
  });
});

describe('screen shake toggle', () => {
  it('toggle off means no offset, even with leftover intensity', () => {
    const state = createShakeState();
    state.intensity = 0.35;
    expect(shakeOffset(0.35, false, fullRight)).toEqual({x: 0, y: 0});
    const stepped = stepScreenShake(state, 0.016, {enabled: false, random: fullRight});
    expect(stepped).toEqual({x: 0, y: 0});
    expect(state.intensity).toBe(0);
  });

  it('zero intensity means no offset while the toggle is on', () => {
    expect(shakeOffset(0, true, fullRight)).toEqual({x: 0, y: 0});
  });

  it('defaults to on, and prefers-reduced-motion forces it off', () => {
    expect(resolveScreenShakeEnabled(undefined, false)).toBe(true);
    expect(resolveScreenShakeEnabled(true, false)).toBe(true);
    expect(resolveScreenShakeEnabled(false, false)).toBe(false);
    expect(resolveScreenShakeEnabled(true, true)).toBe(false);
    expect(resolveScreenShakeEnabled(undefined, true)).toBe(false);
  });

  it('player hits always shake; only heavy or crit outgoing hits do', () => {
    expect(playerHurtShake(10)).toBe(PLAYER_HURT_SHAKE);
    expect(playerHurtShake(HEAVY_HIT_DAMAGE)).toBeGreaterThan(PLAYER_HURT_SHAKE);
    expect(outgoingShakeAmount(10, false)).toBe(0);
    expect(outgoingShakeAmount(HEAVY_HIT_DAMAGE, false)).toBe(HEAVY_HIT_SHAKE);
    expect(outgoingShakeAmount(4, true)).toBe(HEAVY_HIT_SHAKE);
  });
});

describe('screen shake persistence', () => {
  afterEach(() => {
    setScreenShakeEnabled(true);
  });

  it('writes the toggle into the live settings store, defaulting on', () => {
    expect(readScreenShakeSetting()).toBe(true);
    setScreenShakeEnabled(false);
    expect(getSettings().screenShake).toBe(false);
    expect(readScreenShakeSetting()).toBe(false);
    setScreenShakeEnabled(true);
    expect(getSettings().screenShake).toBe(true);
  });
});
