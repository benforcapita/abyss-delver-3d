/**
 * Pure key-binding logic (no DOM, no storage). Bindings map each game action
 * to exactly one KeyboardEvent.code (layout-independent, e.g. "KeyW").
 *
 * Conflict policy: SWAP. Binding a key that another action already uses gives
 * that other action the rebound action's previous key. If that previous key is
 * still in use (the shared Space default), the displaced action gets the first
 * free fallback key instead. Every action always keeps exactly one key.
 *
 * Exception: the default pair Space → attack + dash (today's controls) may
 * share one key. Binding either to Space while the other is on Space is not a
 * conflict; rebinding either one away from Space splits them.
 */

export const BINDABLE_ACTIONS = [
  'moveUp',
  'moveDown',
  'moveLeft',
  'moveRight',
  'attack',
  'potion',
  'spell',
  'interact',
  'dash',
] as const;

export type BindableAction = (typeof BINDABLE_ACTIONS)[number];
export type KeyBindings = Record<BindableAction, string>;

export const ACTION_LABELS: Record<BindableAction, string> = {
  moveUp: 'Move Forward',
  moveDown: 'Move Back',
  moveLeft: 'Strafe Left',
  moveRight: 'Strafe Right',
  attack: 'Attack',
  potion: 'Potion (slot 1)',
  spell: 'Fireball (slot 2)',
  interact: 'Interact',
  dash: 'Dash',
};

export const DEFAULT_KEY_BINDINGS: Readonly<KeyBindings> = Object.freeze({
  moveUp: 'KeyW',
  moveDown: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  attack: 'Space',
  potion: 'Digit1',
  spell: 'Digit2',
  interact: 'KeyE',
  dash: 'Space',
});

/** The one default key allowed to drive two actions at once. */
export const SHARED_KEY = 'Space';
const SHARED_ACTIONS: ReadonlySet<BindableAction> = new Set(['attack', 'dash']);

/** True when `a` and `b` may both be bound to `code` (the default Space pair). */
export function canShare(code: string, a: BindableAction, b: BindableAction): boolean {
  return code === SHARED_KEY && a !== b && SHARED_ACTIONS.has(a) && SHARED_ACTIONS.has(b);
}

/**
 * Fixed secondary keys (not rebindable). Arrows always move. The legacy
 * shortcuts Enter / Q / F / Shift (today's secondary keys) only fire while no
 * primary binding uses that key.
 */
export const FIXED_ALIASES: Readonly<Record<string, BindableAction>> = {
  ArrowUp: 'moveUp',
  ArrowDown: 'moveDown',
  ArrowLeft: 'moveLeft',
  ArrowRight: 'moveRight',
};
export const LEGACY_ALIASES: Readonly<Record<string, BindableAction>> = {
  Enter: 'attack',
  KeyQ: 'potion',
  KeyF: 'spell',
  ShiftLeft: 'dash',
  ShiftRight: 'dash',
};

/** Keys that can never be bound (reserved for menus). */
export const RESERVED_KEYS = new Set(['Escape']);

const NAMED: Record<string, string> = {
  ' ': 'Space',
  space: 'Space',
  spacebar: 'Space',
  enter: 'Enter',
  return: 'Enter',
  tab: 'Tab',
  backspace: 'Backspace',
  escape: 'Escape',
  esc: 'Escape',
  shift: 'ShiftLeft',
  shiftleft: 'ShiftLeft',
  shiftright: 'ShiftRight',
  control: 'ControlLeft',
  ctrl: 'ControlLeft',
  controlleft: 'ControlLeft',
  controlright: 'ControlRight',
  alt: 'AltLeft',
  altleft: 'AltLeft',
  altright: 'AltRight',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  minus: 'Minus',
  equal: 'Equal',
  comma: 'Comma',
  period: 'Period',
  slash: 'Slash',
  semicolon: 'Semicolon',
  quote: 'Quote',
  backquote: 'Backquote',
  bracketleft: 'BracketLeft',
  bracketright: 'BracketRight',
  backslash: 'Backslash',
};

/**
 * Normalize a key code or key name to canonical KeyboardEvent.code form.
 * "f", "F", "keyf", "KEYF" → "KeyF"; "1", "digit1" → "Digit1";
 * " ", "space" → "Space"; "arrowup" → "ArrowUp". Returns null if unknown.
 */
export function normalizeKeyCode(input: unknown): string | null {
  if (typeof input !== 'string' || input.length === 0) return null;
  if (input === ' ') return 'Space';
  const s = input.trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (/^[a-z]$/.test(lower)) return `Key${lower.toUpperCase()}`;
  if (/^[0-9]$/.test(lower)) return `Digit${lower}`;
  let m = /^key([a-z])$/.exec(lower);
  if (m) return `Key${m[1].toUpperCase()}`;
  m = /^digit([0-9])$/.exec(lower);
  if (m) return `Digit${m[1]}`;
  m = /^numpad([0-9])$/.exec(lower);
  if (m) return `Numpad${m[1]}`;
  m = /^f([1-9]|1[0-2])$/.exec(lower);
  if (m) return `F${m[1]}`;
  return NAMED[lower] ?? null;
}

const isBindable = (code: string | null): code is string =>
  code != null && !RESERVED_KEYS.has(code);

/** Keys tried, in order, when a displaced action needs a free key. */
const FALLBACK_KEYS = [
  ...new Set([...Object.values(DEFAULT_KEY_BINDINGS), ...Object.keys(LEGACY_ALIASES)]),
  ...'ZXCVBNMGHJKLPOIUYTR'.split('').map((c) => `Key${c}`),
  ...'34567890'.split('').map((d) => `Digit${d}`),
];

/** Can `action` take `code` given the current (partial) bindings? */
function fits(b: Partial<KeyBindings>, action: BindableAction, code: string): boolean {
  return BINDABLE_ACTIONS.every(
    (o) => o === action || b[o] !== code || canShare(code, action, o),
  );
}

function firstFree(b: Partial<KeyBindings>, action: BindableAction): string {
  return FALLBACK_KEYS.find((c) => fits(b, action, c))!;
}

/**
 * Merge stored (possibly old, partial, or corrupt) bindings with defaults.
 * Invalid entries fall back to the default; disallowed duplicates are resolved
 * so the earlier action (in BINDABLE_ACTIONS order) keeps the key and the later
 * one takes its default, or the first free fallback if that is taken too. The
 * Space attack+dash pair is allowed and left as is.
 */
export function normalizeBindings(raw: unknown): KeyBindings {
  const src: Record<string, unknown> =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: Partial<KeyBindings> = {};
  const pending: BindableAction[] = [];
  for (const a of BINDABLE_ACTIONS) {
    const code = normalizeKeyCode(src[a]);
    if (isBindable(code) && fits(out, a, code)) out[a] = code;
    else pending.push(a);
  }
  for (const a of pending) {
    const d = DEFAULT_KEY_BINDINGS[a];
    out[a] = fits(out, a, d) ? d : firstFree(out, a);
  }
  return out as KeyBindings;
}

export type RebindResult =
  | {ok: true; bindings: KeyBindings; swappedWith?: BindableAction}
  | {ok: false; bindings: KeyBindings; reason: 'invalid' | 'reserved'};

/** Bind `key` to `action`; see the conflict policy at the top of this file. */
export function rebind(bindings: KeyBindings, action: BindableAction, key: unknown): RebindResult {
  const code = normalizeKeyCode(key);
  if (code == null) return {ok: false, bindings, reason: 'invalid'};
  if (RESERVED_KEYS.has(code)) return {ok: false, bindings, reason: 'reserved'};
  const next = {...bindings};
  const prev = next[action];
  next[action] = code;
  const displaced = BINDABLE_ACTIONS.filter(
    (o) => o !== action && next[o] === code && !canShare(code, action, o),
  );
  for (const o of displaced) {
    next[o] = fits(next, o, prev) ? prev : firstFree(next, o);
  }
  return displaced.length
    ? {ok: true, bindings: next, swappedWith: displaced[0]}
    : {ok: true, bindings: next};
}

export function resetBindings(): KeyBindings {
  return {...DEFAULT_KEY_BINDINGS};
}

/**
 * Resolve a KeyboardEvent.code to its action(s), honouring aliases. Returns
 * two actions only for the shared Space attack+dash binding.
 */
export function actionsForCode(bindings: KeyBindings, code: string): BindableAction[] {
  const normalized = normalizeKeyCode(code) ?? code;
  const primary = BINDABLE_ACTIONS.filter((a) => bindings[a] === normalized);
  if (primary.length) return primary;
  const alias = FIXED_ALIASES[normalized] ?? LEGACY_ALIASES[normalized];
  return alias ? [alias] : [];
}

/** Human-readable label for a code ("KeyF" → "F", "Digit1" → "1"). */
export function keyLabel(code: string): string {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  const arrows: Record<string, string> = {ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→'};
  if (arrows[code]) return arrows[code];
  return code.replace(/(Left|Right)$/, ' $1');
}
