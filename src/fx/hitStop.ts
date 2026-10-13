import {HEAVY_HIT_DAMAGE} from './screenShake';

/** Heavy-hit freeze. Sits in the 50–80 ms band. */
export const HIT_STOP_MS = 64;

/**
 * Hard cap. A single request longer than this is clamped, and a freeze that
 * is already running ignores further triggers so hits cannot stack.
 */
export const HIT_STOP_CAP_MS = 80;

export interface HitStopState {
  /** Remaining freeze, in milliseconds. */
  remainingMs: number;
}

export interface HitStopStep {
  /** Game delta after scaling. 0 while the freeze covers the whole frame. */
  dt: number;
  /** 0 during a full freeze, 1 when hit-stop is idle. */
  scale: number;
}

export function createHitStopState(): HitStopState {
  return {remainingMs: 0};
}

/** Crits and hits at or above the shared heavy-hit damage threshold. */
export function isHeavyHit(damage: number, isCrit = false): boolean {
  return isCrit || damage >= HEAVY_HIT_DAMAGE;
}

/**
 * Arm a freeze. While one is already running, further calls do nothing —
 * durations are not added, and a later hit cannot extend the window.
 * A request above the cap is clamped to {@link HIT_STOP_CAP_MS}.
 */
export function triggerHitStop(state: HitStopState, durationMs = HIT_STOP_MS): void {
  if (state.remainingMs > 0) return;
  if (!(durationMs > 0) || !Number.isFinite(durationMs)) return;
  state.remainingMs = Math.min(HIT_STOP_CAP_MS, durationMs);
}

/**
 * Scale this frame's delta by the remaining freeze.
 *
 * Pass `paused` from `isGamePaused()`. A pause holds the freeze: remaining
 * time does not tick, and the returned dt is 0 so the menu cannot be
 * skipped by leftover frame time. Unpause continues the same window.
 */
export function stepHitStop(
  state: HitStopState,
  dtSeconds: number,
  paused: boolean,
): HitStopStep {
  const dt = Number.isFinite(dtSeconds) && dtSeconds > 0 ? dtSeconds : 0;
  if (paused) return {dt: 0, scale: 0};
  if (!(state.remainingMs > 0)) return {dt, scale: 1};

  const frameMs = dt * 1000;
  if (frameMs <= state.remainingMs) {
    state.remainingMs -= frameMs;
    if (state.remainingMs < 0.0001) state.remainingMs = 0;
    return {dt: 0, scale: 0};
  }

  const leftoverMs = frameMs - state.remainingMs;
  state.remainingMs = 0;
  const scaled = leftoverMs / 1000;
  return {dt: scaled, scale: dt > 0 ? scaled / dt : 1};
}
