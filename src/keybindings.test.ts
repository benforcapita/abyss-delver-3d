import {describe, expect, it} from 'vitest';
import {
  BINDABLE_ACTIONS,
  DEFAULT_KEY_BINDINGS as D,
  actionsForCode,
  keyLabel,
  migrateLegacyBindings,
  normalizeBindings,
  normalizeKeyCode,
  rebind,
  resetBindings,
  type KeyBindings,
} from './platform/keybindings';

/** No key is ever bound to two actions. */
function valid(b: KeyBindings): boolean {
  return BINDABLE_ACTIONS.every((a) =>
    BINDABLE_ACTIONS.every((o) => a === o || b[a] !== b[o]),
  );
}

describe('keybindings', () => {
  it('defaults to LMB attack + Space dash, no key-3 slot', () => {
    expect(D).toEqual({
      moveUp: 'KeyW', moveDown: 'KeyS', moveLeft: 'KeyA', moveRight: 'KeyD',
      attack: 'Mouse0', potion: 'Digit1', spell: 'Digit2', interact: 'KeyE', dash: 'Space',
    });
    expect(BINDABLE_ACTIONS).not.toContain('item3');
    expect(valid(D)).toBe(true);
    expect(actionsForCode(D, 'Mouse0')).toEqual(['attack']);
    expect(actionsForCode(D, 'Space')).toEqual(['dash']);
    // Secondary keys still work.
    expect(actionsForCode(D, 'Enter')).toEqual(['attack']);
    expect(actionsForCode(D, 'KeyQ')).toEqual(['potion']);
    expect(actionsForCode(D, 'KeyF')).toEqual(['spell']);
    expect(actionsForCode(D, 'ShiftLeft')).toEqual(['dash']);
    expect(actionsForCode(D, 'ArrowUp')).toEqual(['moveUp']);
  });

  it('no two actions may share a key', () => {
    // Every attempted collision swaps instead of sharing.
    for (const [action, key] of [
      ['attack', 'Space'],
      ['dash', 'Mouse0'],
      ['interact', 'KeyW'],
      ['potion', 'Digit2'],
    ] as const) {
      const r = rebind(resetBindings(), action, key);
      expect(r.ok).toBe(true);
      expect(valid(r.bindings)).toBe(true);
    }
  });

  it('Shift stays a dash alias unless another action claims the key', () => {
    expect(actionsForCode(D, 'ShiftLeft')).toEqual(['dash']);
    expect(actionsForCode(D, 'ShiftRight')).toEqual(['dash']);
    const b = rebind(resetBindings(), 'potion', 'ShiftLeft').bindings;
    expect(actionsForCode(b, 'ShiftLeft')).toEqual(['potion']);
    expect(actionsForCode(b, 'ShiftRight')).toEqual(['dash']);
  });

  it('normalizes key codes and names regardless of case', () => {
    expect(normalizeKeyCode('f')).toBe('KeyF');
    expect(normalizeKeyCode('F')).toBe('KeyF');
    expect(normalizeKeyCode('keyf')).toBe('KeyF');
    expect(normalizeKeyCode('KEYF')).toBe('KeyF');
    expect(normalizeKeyCode('3')).toBe('Digit3');
    expect(normalizeKeyCode('digit3')).toBe('Digit3');
    expect(normalizeKeyCode(' ')).toBe('Space');
    expect(normalizeKeyCode('SPACE')).toBe('Space');
    expect(normalizeKeyCode('arrowup')).toBe('ArrowUp');
    expect(normalizeKeyCode('shift')).toBe('ShiftLeft');
    expect(normalizeKeyCode('f5')).toBe('F5');
    expect(normalizeKeyCode('  e  ')).toBe('KeyE');
    expect(normalizeKeyCode('Mouse0')).toBe('Mouse0');
    expect(normalizeKeyCode('mouse0')).toBe('Mouse0');
    expect(normalizeKeyCode('MOUSE0')).toBe('Mouse0');
    for (const bad of ['', 'nope', 42, null, undefined, {}]) expect(normalizeKeyCode(bad)).toBeNull();
  });

  it('rebinding attack to a keyboard key leaves dash on Space', () => {
    const r = rebind(resetBindings(), 'attack', 'f');
    expect(r).toMatchObject({ok: true, bindings: {...D, attack: 'KeyF'}});
    expect(r.ok && r.swappedWith).toBeUndefined();
    expect(actionsForCode(r.bindings, 'Space')).toEqual(['dash']);
    expect(actionsForCode(r.bindings, 'Mouse0')).toEqual([]);
    expect(actionsForCode(r.bindings, 'KeyF')).toEqual(['attack']);
  });

  it('binding attack to Space swaps with dash onto Mouse0', () => {
    const r = rebind(resetBindings(), 'attack', 'space');
    expect(r).toMatchObject({ok: true, swappedWith: 'dash'});
    expect(r.bindings).toEqual({...D, attack: 'Space', dash: 'Mouse0'});
    expect(valid(r.bindings)).toBe(true);
  });

  it('binding another action to Mouse0 swaps with attack', () => {
    const r = rebind(resetBindings(), 'potion', 'Mouse0');
    expect(r).toMatchObject({ok: true, swappedWith: 'attack'});
    expect(r.bindings).toEqual({...D, potion: 'Mouse0', attack: 'Digit1'});
    expect(valid(r.bindings)).toBe(true);
    // Mouse0 also normalizes from lowercase input.
    const r2 = rebind(resetBindings(), 'dash', 'mouse0');
    expect(r2).toMatchObject({ok: true, swappedWith: 'attack'});
    expect(r2.bindings).toEqual({...D, dash: 'Mouse0', attack: 'Space'});
  });

  it('swaps on an ordinary conflict', () => {
    const r = rebind(resetBindings(), 'potion', 'KeyE');
    expect(r).toMatchObject({ok: true, swappedWith: 'interact'});
    expect(r.bindings).toEqual({...D, potion: 'KeyE', interact: 'Digit1'});
  });

  it('a displaced action takes a free fallback, never a mouse code', () => {
    const b = normalizeBindings({moveUp: 'KeyE', interact: 'KeyE'});
    expect(b.moveUp).toBe('KeyE');
    expect(b.interact).toBe('KeyW'); // first free fallback key (moveUp's vacated default)
    expect(b.interact).not.toBe('Mouse0');
    expect(valid(b)).toBe(true);
  });

  it('rejects reserved and invalid keys without changes', () => {
    const b = resetBindings();
    expect(rebind(b, 'attack', 'Escape')).toEqual({ok: false, bindings: b, reason: 'reserved'});
    expect(rebind(b, 'attack', '???')).toEqual({ok: false, bindings: b, reason: 'invalid'});
  });

  it('does not mutate input and reset returns fresh defaults', () => {
    const b = resetBindings();
    rebind(b, 'dash', 'KeyX');
    expect(b).toEqual(D);
    const r = resetBindings();
    r.attack = 'KeyZ';
    expect(D.attack).toBe('Mouse0');
    expect(resetBindings()).toEqual(D);
  });

  it('tolerates corrupt or old data', () => {
    for (const raw of [undefined, null, 'x', 7, [], {}]) expect(normalizeBindings(raw)).toEqual(D);
    expect(normalizeBindings({attack: 'f', bogus: 'KeyZ', spell: 123, dash: 'Escape', item3: 'Digit3'}))
      .toEqual({...D, attack: 'KeyF'});
  });

  it('resolves disallowed duplicates in stored data', () => {
    const b = normalizeBindings({moveUp: 'KeyE', interact: 'KeyE'});
    expect(b.moveUp).toBe('KeyE');
    expect(b.interact).not.toBe('KeyE');
    expect(valid(b)).toBe(true);
    const s = normalizeBindings({potion: 'KeyE', interact: 'KeyE'});
    expect(s.potion).toBe('KeyE');
    expect(s.interact).not.toBe('KeyE');
    expect(valid(s)).toBe(true);
  });

  it('primary bindings take priority over legacy aliases', () => {
    const b = rebind(resetBindings(), 'attack', 'KeyF').bindings;
    expect(actionsForCode(b, 'KeyF')).toEqual(['attack']);
    expect(actionsForCode(b, 'KeyZ')).toEqual([]);
  });

  it('labels keys for display', () => {
    expect(keyLabel('KeyF')).toBe('F');
    expect(keyLabel('Digit3')).toBe('3');
    expect(keyLabel('ArrowUp')).toBe('↑');
    expect(keyLabel('ShiftLeft')).toBe('Shift Left');
    expect(keyLabel('Mouse0')).toBe('LMB');
  });
});

describe('migrateLegacyBindings', () => {
  it('migrates the old Space attack+dash pair to Mouse0 + Space', () => {
    const raw = {attack: 'Space', dash: 'Space'};
    expect(migrateLegacyBindings(raw)).toEqual({dash: 'Space'});
    expect(normalizeBindings(raw)).toEqual(D);
  });

  it('keeps a customized dash and gives attack the new default', () => {
    expect(normalizeBindings({attack: 'Space', dash: 'ShiftLeft'})).toEqual({...D, dash: 'ShiftLeft'});
  });

  it('keeps a customized attack and lets dash stay on Space', () => {
    expect(normalizeBindings({attack: 'KeyF', dash: 'Space'})).toEqual({...D, attack: 'KeyF'});
    expect(normalizeBindings({attack: 'KeyF', dash: 'KeyX'})).toEqual({
      ...D,
      attack: 'KeyF',
      dash: 'KeyX',
    });
  });

  it('is a no-op for new-format and non-binding data', () => {
    for (const raw of [undefined, null, 'x', 7, [], {}, {...D}]) {
      expect(migrateLegacyBindings(raw)).toBe(raw);
    }
    expect(normalizeBindings({attack: 'Mouse0', dash: 'Space'})).toEqual(D);
    expect(normalizeBindings({attack: 'space', dash: 'KeyX'})).toEqual({...D, dash: 'KeyX'});
  });

  it('still resolves other duplicates after migration', () => {
    const b = normalizeBindings({attack: 'Space', dash: 'Space', interact: 'Mouse0'});
    expect(b.interact).toBe('Mouse0');
    expect(b.attack).not.toBe('Mouse0');
    expect(b.dash).toBe('Space');
    expect(valid(b)).toBe(true);
  });
});
