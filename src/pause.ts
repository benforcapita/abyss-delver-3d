/**
 * Pause state detection and frame delta timing utilities.
 * Ensures the game loop pauses cleanly across all modal overlays and screens,
 * and resumes without temporal leap spikes.
 */

export interface PauseState {
  status: string;
  menuOpen: boolean;
  howToOpen: boolean;
  floorSummaryOpen: boolean;
}

/**
 * Returns true unless gameState status is 'PLAYING' and no overlay is open.
 */
export function isGamePaused(s: {
  status: string;
  menuOpen: boolean;
  howToOpen: boolean;
  floorSummaryOpen: boolean;
}): boolean {
  return (
    s.status !== 'PLAYING' ||
    s.menuOpen ||
    s.howToOpen ||
    s.floorSummaryOpen
  );
}

/**
 * Computes the frame delta time (dt) in seconds.
 * Returns 0 on the first frame after resume to prevent a time jump,
 * otherwise clamps to Math.min(delta, maxDt).
 * Output is guaranteed to never be negative or NaN.
 */
export function frameDelta(
  delta: number,
  resumedThisFrame: boolean,
  maxDt = 0.1,
): number {
  if (resumedThisFrame) {
    return 0;
  }
  if (Number.isNaN(delta) || delta <= 0) {
    return 0;
  }
  const cap = Number.isNaN(maxDt) || maxDt <= 0 ? 0 : maxDt;
  return Math.min(delta, cap);
}
