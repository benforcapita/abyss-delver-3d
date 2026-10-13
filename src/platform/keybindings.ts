/**
 * Pure key-binding logic (no DOM, no storage). Bindings map each game action
 * to exactly one KeyboardEvent.code (layout-independent, e.g. "KeyW").
 *
 * Conflict policy: SWAP. Binding a key that another action already uses gives
 * that other action the rebound action's previous key, so every action always
 * keeps exactly one key and no key is bound twice.
 */

export const BINDABLE_ACTIONS = [
  'moveUp',
  'moveDown',
  'moveLeft',
  'moveRight',
  'attack',
  'potion',
  'spell',
  'item3',
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
  item3: 'Item Ability (slot 3)',
  interact: 'Interact',
  dash: 'Dash',
};

export const DEFAULT_KEY_BINDINGS: Readonly<KeyBindings> = Object.freeze({
  moveUp: 'KeyW',
  moveDown: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  attack: 'Enter',
  potion: 'Digit1',
  spell: 'Digit2',
  item3: 'Digit3',
  interact: 'KeyE',
  dash: 'Space',
});

/**
 * Fixed secondary keys (not rebindable). Arrows always move. The legacy
 * shortcuts Q / F / Shift only fire while no primary binding uses that key.
 */
export const FIXED_ALIASES: Readonly<Record<string, BindableAction>> = {
  ArrowUp: 'moveUp',
  ArrowDown: 'moveDown',
  ArrowLeft: 'moveLeft',
  ArrowRight: 'moveRight',
};
export const LEGACY_ALIASES: Readonly<Record<string, BindableAction>> = {
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

/**
 * Merge stored (possibly old, partial, or corrupt) bindings with defaults.
 * Invalid entries fall back to the default; duplicates are resolved so the
 * earlier action (in BINDABLE_ACTIONS order) keeps the key and the later one
 * takes its default, or the first free default if that is taken too.
 */
export function normalizeBindings(raw: unknown): KeyBindings {
  const src: Record<string, unknown> =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out = {} as KeyBindings;
  const used = new Set<string>();
  const pending: BindableAction[] = [];
  for (const a of BINDABLE_ACTIONS) {
    const code = normalizeKeyCode(src[a]);
    if (isBindable(code) && !used.has(code)) {
      out[a] = code;
      used.add(code);
    } else {
      pending.push(a);
    }
  }
  for (const a of pending) {
    let code: string | undefined = DEFAULT_KEY_BINDINGS[a];
    if (used.has(code)) {
      code = Object.values(DEFAULT_KEY_BINDINGS).find((c) => !used.has(c));
    }
    // There are as many defaults as actions, so a free one always exists.
    out[a] = code!;
    used.add(code!);
  }
  return out;
}

export type RebindResult =
  | {ok: true; bindings: KeyBindings; swappedWith?: BindableAction}
  | {ok: false; bindings: KeyBindings; reason: 'invalid' | 'reserved'};

/** Bind `key` to `action`, swapping with any action that already uses it. */
export function rebind(bindings: KeyBindings, action: BindableAction, key: unknown): RebindResult {
  const code = normalizeKeyCode(key);
  if (code == null) return {ok: false, bindings, reason: 'invalid'};
  if (RESERVED_KEYS.has(code)) return {ok: false, bindings, reason: 'reserved'};
  const next = {...bindings};
  const prev = next[action];
  const other = BINDABLE_ACTIONS.find((a) => a !== action && next[a] === code);
  next[action] = code;
  if (other) next[other] = prev;
  return other ? {ok: true, bindings: next, swappedWith: other} : {ok: true, bindings: next};
}

export function resetBindings(): KeyBindings {
  return {...DEFAULT_KEY_BINDINGS};
}

/** Resolve a KeyboardEvent.code to its action, honouring aliases. */
export function actionForCode(bindings: KeyBindings, code: string): BindableAction | null {
  const normalized = normalizeKeyCode(code) ?? code;
  const primary = BINDABLE_ACTIONS.find((a) => bindings[a] === normalized);
  if (primary) return primary;
  return FIXED_ALIASES[normalized] ?? LEGACY_ALIASES[normalized] ?? null;
}

/** Human-readable label for a code ("KeyF" → "F", "Digit1" → "1"). */
export function keyLabel(code: string): string {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  const arrows: Record<string, string> = {ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→'};
  if (arrows[code]) return arrows[code];
  return code.replace(/(Left|Right)$/, ' $1');
}
