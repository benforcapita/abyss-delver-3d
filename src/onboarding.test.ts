import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {OnboardingEvent} from './onboarding';

// Minimal in-memory localStorage for the node test environment.
const store = new Map<string, string>();
vi.stubGlobal('window', {
  localStorage: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  },
});

const O = await import('./onboarding');
const {DEFAULT_KEY_BINDINGS} = await import('./platform/keybindings');

beforeEach(() => {
  store.clear();
});

describe('onboarding', () => {
  it('fresh storage shows the first step (look)', () => {
    const s = O.loadOnboarding();
    expect(s.finished).toBe(false);
    expect(O.nextStep(s)).toBe('look');
  });

  it('advances through the steps in order', () => {
    let s = O.freshState();
    expect(O.nextStep(s)).toBe('look');

    s = O.advance(s, {type: 'look'});
    expect(O.nextStep(s)).toBe('move');

    // Move requires ~1s of cumulative movement input.
    s = O.advance(s, {type: 'move', dt: 0.6});
    expect(O.nextStep(s)).toBe('move');
    s = O.advance(s, {type: 'move', dt: 0.6});
    expect(O.nextStep(s)).toBe('attack');

    s = O.advance(s, {type: 'attack'});
    expect(O.nextStep(s)).toBe('dash');
    s = O.advance(s, {type: 'dash'});
    expect(O.nextStep(s)).toBe('interact');
    s = O.advance(s, {type: 'interact'});
    expect(O.nextStep(s)).toBeNull();
    expect(s.finished).toBe(true);
  });

  it('records out-of-order events without skipping ahead of the current step', () => {
    // Documented behavior: an event marks its own step done whenever it
    // happens, but the toast still walks in order — the already-done step is
    // skipped when the walkthrough reaches it.
    let s = O.freshState();
    s = O.advance(s, {type: 'attack'});
    expect(O.nextStep(s)).toBe('look');

    s = O.advance(s, {type: 'look'});
    s = O.advance(s, {type: 'move', dt: 2});
    // 'attack' was already completed -> the walkthrough skips it.
    expect(O.nextStep(s)).toBe('dash');
  });

  it('ignores duplicate and finished-state events', () => {
    let s = O.freshState();
    s = O.advance(s, {type: 'look'});
    const before = s;
    s = O.advance(s, {type: 'look'});
    expect(s).toBe(before);

    let done = O.skipAll(O.freshState());
    const afterSkip = O.advance(done, {type: 'dash'});
    expect(afterSkip).toBe(done);
  });

  it('skip marks everything done and persists the seen flag', () => {
    const s = O.skipAll(O.freshState());
    O.saveOnboarding(s);
    expect(store.get(O.ONBOARDING_KEY)).toBe(JSON.stringify({done: true}));
    const loaded = O.loadOnboarding();
    expect(loaded.finished).toBe(true);
    expect(O.nextStep(loaded)).toBeNull();
  });

  it('persists partial progress as the completed step list', () => {
    let s = O.advance(O.freshState(), {type: 'look'});
    s = O.advance(s, {type: 'move', dt: 0.5});
    O.saveOnboarding(s);
    const loaded = O.loadOnboarding();
    expect(loaded.done).toEqual(['look']);
    expect(loaded.moveTime).toBeCloseTo(0.5);
    expect(O.nextStep(loaded)).toBe('move');
  });

  it('a completed profile shows nothing on the next load', () => {
    let s = O.freshState();
    const events: OnboardingEvent[] = [
      {type: 'look'},
      {type: 'move', dt: 1.5},
      {type: 'attack'},
      {type: 'dash'},
      {type: 'interact'},
    ];
    for (const e of events) s = O.advance(s, e);
    O.saveOnboarding(s);

    const again = O.loadOnboarding();
    expect(again.finished).toBe(true);
    expect(O.nextStep(again)).toBeNull();
  });

  it('treats a stored done flag as finished', () => {
    store.set(O.ONBOARDING_KEY, JSON.stringify({done: true}));
    expect(O.nextStep(O.loadOnboarding())).toBeNull();
  });

  it('falls back to a fresh state on corrupt storage', () => {
    store.set(O.ONBOARDING_KEY, '{not json');
    expect(O.nextStep(O.loadOnboarding())).toBe('look');
    store.set(O.ONBOARDING_KEY, JSON.stringify({steps: 'garbage', moveTime: 'x'}));
    expect(O.nextStep(O.loadOnboarding())).toBe('look');
  });

  it('hint text follows the live key bindings', () => {
    expect(O.text('move', DEFAULT_KEY_BINDINGS, false)).toBe('WASD to move');
    expect(O.text('attack', DEFAULT_KEY_BINDINGS, false)).toBe(
      'Space to slash',
    );
    expect(O.text('dash', DEFAULT_KEY_BINDINGS, false)).toBe(
      'Space to dash through attacks',
    );
    expect(O.text('interact', DEFAULT_KEY_BINDINGS, false)).toBe('E to open');
    expect(O.text('look', DEFAULT_KEY_BINDINGS, false)).toBe(
      'Click to look around',
    );
  });

  it('hint text follows rebound keys', () => {
    const bindings = {
      ...DEFAULT_KEY_BINDINGS,
      moveUp: 'KeyI',
      moveLeft: 'KeyJ',
      moveDown: 'KeyK',
      moveRight: 'KeyL',
      attack: 'KeyF',
      interact: 'KeyG',
    };
    expect(O.text('move', bindings, false)).toBe('IJKL to move');
    expect(O.text('attack', bindings, false)).toBe('F to slash');
    expect(O.text('interact', bindings, false)).toBe('G to open');
  });

  it('hint text uses touch copy on mobile', () => {
    expect(O.text('look', DEFAULT_KEY_BINDINGS, true)).toBe(
      'Drag the right side to look',
    );
    expect(O.text('move', DEFAULT_KEY_BINDINGS, true)).toBe(
      'Left thumb to move',
    );
    expect(O.text('attack', DEFAULT_KEY_BINDINGS, true)).toBe('Tap SLASH');
    expect(O.text('dash', DEFAULT_KEY_BINDINGS, true)).toBe(
      'Tap DASH to dodge',
    );
    expect(O.text('interact', DEFAULT_KEY_BINDINGS, true)).toBe('Tap OPEN');
  });
});
