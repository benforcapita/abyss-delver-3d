import {keyLabel, type KeyBindings} from './platform/keybindings';
import {getJSON, setJSON} from './platform/storage';

/**
 * First-run onboarding hints (ticket AD-24.8).
 *
 * On floor 1 while PLAYING, a small non-blocking toast walks a brand-new
 * profile through look -> move -> attack -> dash -> interact. Progress is
 * persisted once per profile under 'ad3d.onboarding'; once every step is done
 * or the player taps Skip, the hints never show again.
 */

/** Hint steps, shown in this order. */
export const ONBOARDING_STEPS = [
  'look',
  'move',
  'attack',
  'dash',
  'interact',
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Seconds of cumulative movement input needed to clear the move step. */
export const MOVE_SECONDS = 1;

/** localStorage key (accessed via platform/storage helpers). */
export const ONBOARDING_KEY = 'ad3d.onboarding';

/**
 * Signals the game loop reports to the UI. `move` carries the frame delta in
 * seconds; every other event is a one-shot.
 */
export type OnboardingEvent =
  | {type: 'look'}
  | {type: 'move'; dt: number}
  | {type: 'attack'}
  | {type: 'dash'}
  | {type: 'interact'};

export interface OnboardingState {
  /**
   * Steps completed so far, in completion order. Events count whenever they
   * happen — even out of order. An attack performed while the toast still
   * shows `look`/`move` already marks 'attack' done, so that step is skipped
   * when the walkthrough reaches it.
   */
  done: OnboardingStep[];
  /** Cumulative seconds of movement input toward the move step. */
  moveTime: number;
  /** True once every step is done or the player skipped — never show again. */
  finished: boolean;
}

export function freshState(): OnboardingState {
  return {done: [], moveTime: 0, finished: false};
}

/** First incomplete step in ONBOARDING_STEPS order; null when finished. */
export function nextStep(s: OnboardingState): OnboardingStep | null {
  if (s.finished) return null;
  for (const step of ONBOARDING_STEPS) {
    if (!s.done.includes(step)) return step;
  }
  return null;
}

function complete(s: OnboardingState, step: OnboardingStep): OnboardingState {
  const done = s.done.includes(step) ? s.done : [...s.done, step];
  const finished = ONBOARDING_STEPS.every((st) => done.includes(st));
  return {...s, done, finished};
}

/** Apply one game signal; returns the same object when nothing changed. */
export function advance(
  s: OnboardingState,
  e: OnboardingEvent,
): OnboardingState {
  if (s.finished) return s;
  if (e.type === 'move') {
    if (s.done.includes('move')) return s;
    const dt = Number.isFinite(e.dt) && e.dt > 0 ? e.dt : 0;
    const moveTime = s.moveTime + dt;
    const next = {...s, moveTime};
    return moveTime >= MOVE_SECONDS ? complete(next, 'move') : next;
  }
  if (s.done.includes(e.type)) return s;
  return complete(s, e.type);
}

/** Mark every step done (the toast's Skip button). */
export function skipAll(s: OnboardingState): OnboardingState {
  return {...s, done: [...ONBOARDING_STEPS], finished: true};
}

/** Hint copy for a step; labels come from the live key bindings. */
export function text(
  step: OnboardingStep,
  bindings: KeyBindings,
  isMobile: boolean,
): string {
  switch (step) {
    case 'look':
      return isMobile
        ? 'Drag the right side to look'
        : 'Click to look around';
    case 'move':
      return isMobile
        ? 'Left thumb to move'
        : `${keyLabel(bindings.moveUp)}${keyLabel(bindings.moveLeft)}${keyLabel(
            bindings.moveDown,
          )}${keyLabel(bindings.moveRight)} to move`;
    case 'attack':
      return isMobile ? 'Tap SLASH' : `${keyLabel(bindings.attack)} to slash`;
    case 'dash':
      return isMobile
        ? 'Tap DASH to dodge'
        : `${keyLabel(bindings.dash)} to dash through attacks`;
    case 'interact':
      return isMobile ? 'Tap OPEN' : `${keyLabel(bindings.interact)} to open`;
  }
}

interface StoredOnboarding {
  done?: unknown;
  steps?: unknown;
  moveTime?: unknown;
}

function isStep(v: unknown): v is OnboardingStep {
  return (
    typeof v === 'string' &&
    (ONBOARDING_STEPS as readonly string[]).includes(v)
  );
}

/** Load persisted progress; never throws and defaults to a fresh state. */
export function loadOnboarding(): OnboardingState {
  const raw = getJSON<StoredOnboarding>(ONBOARDING_KEY);
  const s = freshState();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return s;
  if (raw.done === true) {
    return {
      done: [...ONBOARDING_STEPS],
      moveTime: MOVE_SECONDS,
      finished: true,
    };
  }
  const steps = Array.isArray(raw.steps) ? raw.steps : [];
  for (const v of steps) {
    if (isStep(v) && !s.done.includes(v)) s.done.push(v);
  }
  if (
    typeof raw.moveTime === 'number' &&
    Number.isFinite(raw.moveTime) &&
    raw.moveTime > 0
  ) {
    s.moveTime = Math.min(raw.moveTime, MOVE_SECONDS);
  }
  s.finished = nextStep(s) === null;
  return s;
}

/**
 * Persist progress. A finished profile is stored as the compact seen flag
 * `{done: true}`; partial progress is stored as the completed step list.
 */
export function saveOnboarding(s: OnboardingState): void {
  if (s.finished) {
    setJSON(ONBOARDING_KEY, {done: true});
  } else {
    setJSON(ONBOARDING_KEY, {steps: s.done, moveTime: s.moveTime});
  }
}
