import {useLayoutEffect, type RefObject} from 'react';

/** Vignette starts once HP falls below this fraction of max HP. */
export const LOW_HP_THRESHOLD = 0.3;

/** Opacity at 0 HP. The curve below scales this. */
export const VIGNETTE_MAX_OPACITY = 0.92;

/** Gentle pulse. Reduced-motion skips it and holds the still vignette. */
export const VIGNETTE_PULSE_MS = 1600;

export interface VignettePaint {
  /** 0 when healthy. 1 at 0 HP, before opacity scaling. */
  intensity: number;
  opacity: number;
  /** Inner transparent stop. Smaller means the red reaches further in. */
  clearPercent: number;
  /** Mid red stop. */
  midPercent: number;
  /** False under prefers-reduced-motion, and whenever the vignette is off. */
  pulse: boolean;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * 0 at or above ~30% HP, rising to 1 at 0 HP.
 * Ease-out: the edge is readable just under the threshold, then strengthens
 * as HP keeps falling.
 */
export function vignetteIntensity(hp: number, maxHp: number): number {
  if (!(maxHp > 0) || !Number.isFinite(hp) || !Number.isFinite(maxHp)) return 0;
  const ratio = Math.max(0, hp) / maxHp;
  if (ratio >= LOW_HP_THRESHOLD) return 0;
  const t = (LOW_HP_THRESHOLD - ratio) / LOW_HP_THRESHOLD;
  return clamp01(1 - (1 - t) * (1 - t));
}

/** Intensity plus the opacity, gradient stops, and whether to pulse. */
export function vignettePaint(
  hp: number,
  maxHp: number,
  reducedMotion: boolean,
): VignettePaint {
  const intensity = vignetteIntensity(hp, maxHp);
  return {
    intensity,
    opacity: intensity * VIGNETTE_MAX_OPACITY,
    clearPercent: 64 - intensity * 26,
    midPercent: 84 - intensity * 16,
    pulse: !reducedMotion && intensity > 0,
  };
}

export function readPrefersReducedMotion(): boolean {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Writes the overlay from a ref. Callers must not mirror this into React
 * state — the pulse is a CSS animation, so a healthy frame loop never
 * re-renders to animate it.
 */
export function applyLowHpVignette(
  el: HTMLElement | null,
  hp: number,
  maxHp: number,
  reducedMotion: boolean,
): void {
  if (!el) return;
  const paint = vignettePaint(hp, maxHp, reducedMotion);
  el.style.setProperty('--vignette-opacity', paint.opacity.toFixed(4));
  el.style.setProperty('--vignette-clear', `${paint.clearPercent.toFixed(2)}%`);
  el.style.setProperty('--vignette-mid', `${paint.midPercent.toFixed(2)}%`);
  el.style.animation = paint.pulse
    ? `ad-low-hp-pulse ${VIGNETTE_PULSE_MS}ms ease-in-out infinite`
    : 'none';
}

/**
 * Paints `ref` when HP changes, and again if the reduced-motion preference
 * flips. HP ticks that do not change the ratio do not touch the DOM.
 */
export function useLowHpVignette(
  ref: RefObject<HTMLElement | null>,
  hp: number,
  maxHp: number,
  active = true,
): void {
  useLayoutEffect(() => {
    const el = ref.current;
    const paint = () => {
      if (!active) {
        const full = maxHp > 0 ? maxHp : 1;
        applyLowHpVignette(el, full, full, true);
        return;
      }
      applyLowHpVignette(el, hp, maxHp, readPrefersReducedMotion());
    };
    paint();
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener?.('change', paint);
    return () => mq.removeEventListener?.('change', paint);
  }, [ref, hp, maxHp, active]);
}
