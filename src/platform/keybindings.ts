/**
 * Pure key-binding logic (no DOM, no storage). Bindings map each game action
 * to exactly one KeyboardEvent.code (layout-independent, e.g. "KeyW") or the
 * pseudo-code "Mouse0" for the left mouse button.
 *
 * Conflict policy: SWAP. Binding a key that another action already uses gives
 * that other action the rebound action's previous key. If that previous key is
 * still in use, the displaced action gets the first free fallback key instead.
 * Every action always keeps exactly one key; no two actions may share a key.
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
  attack: 'Mouse0',
  potion: 'Digit1',
  spell: 'Digit2',
  interact: 'KeyE',
  dash: 'Space',
});

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
  m = /^mouse([0-9])$/.exec(lower);
  if (m) return `Mouse${m[1]}`;
  return NAMED[lower] ?? null;
}

const isBindable = (code: string | null): code is string =>
  code != null && !RESERVED_KEYS.has(code);

/** Keys tried, in order, when a displaced action needs a free key. */
const FALLBACK_KEYS = [
  ...new Set([...Object.values(DEFAULT_KEY_BINDINGS), ...Object.keys(LEGACY_ALIASES)]),
  ...'ZXCVBNMGHJKLPOIUYTR'.split('').map((c) => `Key${c}`),
  ...'34567890'.split('').map((d) => `Digit${d}`),
  // Mouse codes are bindable but never handed out as automatic fallbacks.
].filter((c) => !c.startsWith('Mouse'));

/** Can `action` take `code` given the current (partial) bindings? */
function fits(b: Partial<KeyBindings>, action: BindableAction, code: string): boolean {
  return BINDABLE_ACTIONS.every((o) => o === action || b[o] !== code);
}

function firstFree(b: Partial<KeyBindings>, action: BindableAction): string {
  return FALLBACK_KEYS.find((c) => fits(b, action, c))!;
}

/**
 * Pre-normalization migration for saves written when attack and dash shared
 * the Space default. An attack binding of 'Space' can only be the old shared
 * default (or the pair re-joined on Space), so it is dropped and picks up the
 * new 'Mouse0' default — or the first free fallback if that is taken. Dash
 * keeps 'Space' (still its default), and any custom non-Space bindings are
 * preserved untouched. Pure; returns `raw` unchanged when no migration applies.
 */
export function migrateLegacyBindings(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const src = raw as Record<string, unknown>;
  if (normalizeKeyCode(src.attack) !== 'Space') return raw;
  const next = {...src};
  delete next.attack;
  return next;
}

/**
 * Merge stored (possibly old, partial, or corrupt) bindings with defaults.
 * Legacy saves are migrated first (see migrateLegacyBindings). Invalid entries
 * fall back to the default; duplicates are resolved so the earlier action (in
 * BINDABLE_ACTIONS order) keeps the key and the later one takes its default,
 * or the first free fallback if that is taken too.
 */
export function normalizeBindings(raw: unknown): KeyBindings {
  const migrated = migrateLegacyBindings(raw);
  const src: Record<string, unknown> =
    migrated && typeof migrated === 'object' && !Array.isArray(migrated)
      ? (migrated as Record<string, unknown>)
      : {};
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
  const displaced = BINDABLE_ACTIONS.filter((o) => o !== action && next[o] === code);
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
 * Resolve a code (KeyboardEvent.code or the 'Mouse0' pseudo-code) to its
 * action, honouring aliases. Primary bindings win over fixed/legacy aliases.
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
  const mouse: Record<string, string> = {Mouse0: 'LMB', Mouse1: 'MMB', Mouse2: 'RMB'};
  if (mouse[code]) return mouse[code];
  if (/^Mouse[0-9]$/.test(code)) return code.replace('Mouse', 'Mouse ');
  const arrows: Record<string, string> = {ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→'};
  if (arrows[code]) return arrows[code];
  return code.replace(/(Left|Right)$/, ' $1');
}
