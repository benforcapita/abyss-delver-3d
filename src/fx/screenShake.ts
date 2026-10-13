import {getSettings, saveSettings} from '../platform/settings';

/** Units of intensity removed per second. Matches the previous in-loop decay. */
export const SHAKE_DECAY_PER_SEC = 2.5;

/** Multiplier from intensity to world-space offset. */
export const SHAKE_AMPLITUDE = 0.3;

/** Camera kick when the player takes a hit. */
export const PLAYER_HURT_SHAKE = 0.35;

/** Extra kick when incoming damage is heavy. */
export const HEAVY_HURT_BONUS = 0.12;

/** Small kick for a heavy hit the player lands. Light swings do not shake. */
export const HEAVY_HIT_SHAKE = 0.18;

/** Outgoing damage at or above this counts as a heavy hit (crits always do). */
export const HEAVY_HIT_DAMAGE = 36;

export interface ShakeState {
  intensity: number;
}

export interface ShakeOffset {
  x: number;
  y: number;
}

export function createShakeState(): ShakeState {
  return {intensity: 0};
}

export function triggerScreenShake(state: ShakeState, amount: number): void {
  if (amount <= 0) return;
  state.intensity = Math.max(state.intensity, amount);
}

export function decayShake(
  intensity: number,
  dt: number,
  decayPerSec = SHAKE_DECAY_PER_SEC,
): number {
  if (intensity <= 0) return 0;
  if (dt <= 0) return intensity;
  return Math.max(0, intensity - dt * decayPerSec);
}

/**
 * World offset for this frame. Toggle off, reduced motion, or a dead shake
 * all produce a zero offset — the camera is not moved.
 */
export function shakeOffset(
  intensity: number,
  enabled: boolean,
  random: () => number = Math.random,
  amplitude = SHAKE_AMPLITUDE,
): ShakeOffset {
  if (!enabled || intensity <= 0) return {x: 0, y: 0};
  const span = intensity * amplitude;
  return {
    x: (random() - 0.5) * span,
    y: (random() - 0.5) * span,
  };
}

export function stepScreenShake(
  state: ShakeState,
  dt: number,
  opts: {enabled: boolean; random?: () => number},
): ShakeOffset {
  if (!opts.enabled) {
    state.intensity = 0;
    return {x: 0, y: 0};
  }
  const offset = shakeOffset(state.intensity, true, opts.random);
  state.intensity = decayShake(state.intensity, dt);
  return offset;
}

export function outgoingShakeAmount(damage: number, isCrit: boolean): number {
  if (isCrit || damage >= HEAVY_HIT_DAMAGE) return HEAVY_HIT_SHAKE;
  return 0;
}

export function playerHurtShake(damage: number): number {
  if (damage >= HEAVY_HIT_DAMAGE) return PLAYER_HURT_SHAKE + HEAVY_HURT_BONUS;
  return PLAYER_HURT_SHAKE;
}

/**
 * Stored toggle wins when it is set. Unset defaults to ON.
 * prefers-reduced-motion forces the effect off either way.
 */
export function resolveScreenShakeEnabled(
  stored: boolean | undefined,
  prefersReducedMotion: boolean,
): boolean {
  if (prefersReducedMotion) return false;
  return stored !== false;
}

let reducedMotionCached: boolean | undefined;

function readReducedMotion(): boolean {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionCached = mq.matches;
    mq.addEventListener?.('change', () => {
      reducedMotionCached = mq.matches;
    });
    return mq.matches;
  } catch {
    return false;
  }
}

export function prefersReducedMotion(): boolean {
  if (reducedMotionCached !== undefined) return reducedMotionCached;
  return readReducedMotion();
}

/** The persisted toggle, defaulting to ON. Ignores reduced-motion. */
export function readScreenShakeSetting(): boolean {
  return getSettings().screenShake !== false;
}

/** Whether the camera should actually shake this frame. */
export function isScreenShakeEnabled(): boolean {
  return resolveScreenShakeEnabled(getSettings().screenShake, prefersReducedMotion());
}

/** Writes the toggle into the shared settings object (`ad3d.settings`). */
export function setScreenShakeEnabled(enabled: boolean): void {
  saveSettings({screenShake: enabled});
}
