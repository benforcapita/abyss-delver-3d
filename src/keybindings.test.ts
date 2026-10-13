import {describe, expect, it} from 'vitest';
import {
  BINDABLE_ACTIONS,
  DEFAULT_KEY_BINDINGS as D,
  actionsForCode,
  canShare,
  keyLabel,
  normalizeBindings,
  normalizeKeyCode,
  rebind,
  resetBindings,
  type KeyBindings,
} from './platform/keybindings';

/** No key is bound twice, except the allowed Space attack+dash pair. */
function valid(b: KeyBindings): boolean {
  return BINDABLE_ACTIONS.every((a) =>
    BINDABLE_ACTIONS.every((o) => a === o || b[a] !== b[o] || canShare(b[a], a, o)),
  );
}

describe('keybindings', () => {
  it('defaults match today\'s controls (Space = attack + dash), no key-3 slot', () => {
    expect(D).toEqual({
      moveUp: 'KeyW', moveDown: 'KeyS', moveLeft: 'KeyA', moveRight: 'KeyD',
      attack: 'Space', potion: 'Digit1', spell: 'Digit2', interact: 'KeyE', dash: 'Space',
    });
    expect(BINDABLE_ACTIONS).not.toContain('item3');
    expect(valid(D)).toBe(true);
    expect(actionsForCode(D, 'Space')).toEqual(['attack', 'dash']);
    // Today's secondary keys still work.
    expect(actionsForCode(D, 'Enter')).toEqual(['attack']);
    expect(actionsForCode(D, 'KeyQ')).toEqual(['potion']);
    expect(actionsForCode(D, 'KeyF')).toEqual(['spell']);
    expect(actionsForCode(D, 'ShiftLeft')).toEqual(['dash']);
    expect(actionsForCode(D, 'ArrowUp')).toEqual(['moveUp']);
  });

  it('only the Space attack+dash pair may share', () => {
    expect(canShare('Space', 'attack', 'dash')).toBe(true);
    expect(canShare('KeyF', 'attack', 'dash')).toBe(false);
    expect(canShare('Space', 'attack', 'interact')).toBe(false);
    expect(canShare('Space', 'attack', 'attack')).toBe(false);
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
    for (const bad of ['', 'nope', 42, null, undefined, {}]) expect(normalizeKeyCode(bad)).toBeNull();
  });

  it('rebinding attack splits the Space pair without touching dash', () => {
    const r = rebind(resetBindings(), 'attack', 'f');
    expect(r).toMatchObject({ok: true, bindings: {...D, attack: 'KeyF'}});
    expect(r.ok && r.swappedWith).toBeUndefined();
    expect(actionsForCode(r.bindings, 'Space')).toEqual(['dash']);
    expect(actionsForCode(r.bindings, 'KeyF')).toEqual(['attack']);
  });

  it('rebinding dash splits the pair too', () => {
    const r = rebind(resetBindings(), 'dash', 'ShiftLeft');
    expect(r.bindings).toEqual({...D, dash: 'ShiftLeft'});
    expect(r.ok && r.swappedWith).toBeUndefined();
  });

  it('re-joining the pair on Space is allowed (no swap)', () => {
    const split = rebind(resetBindings(), 'attack', 'KeyF').bindings;
    const r = rebind(split, 'attack', 'space');
    expect(r.bindings).toEqual(D);
    expect(r.ok && r.swappedWith).toBeUndefined();
  });

  it('swaps on an ordinary conflict', () => {
    const r = rebind(resetBindings(), 'potion', 'KeyE');
    expect(r).toMatchObject({ok: true, swappedWith: 'interact'});
    expect(r.bindings).toEqual({...D, potion: 'KeyE', interact: 'Digit1'});
  });

  it('a displaced action does not inherit the still-shared Space', () => {
    const r = rebind(resetBindings(), 'attack', 'KeyE');
    expect(r).toMatchObject({ok: true, swappedWith: 'interact'});
    expect(r.bindings.attack).toBe('KeyE');
    expect(r.bindings.dash).toBe('Space');
    expect(r.bindings.interact).not.toBe('Space');
    expect(r.bindings.interact).toBe('Enter'); // first free fallback key
    expect(valid(r.bindings)).toBe(true);
  });

  it('binding a third action to Space displaces both pair members', () => {
    const r = rebind(resetBindings(), 'interact', 'Space');
    expect(r.bindings.interact).toBe('Space');
    expect(r.bindings.attack).toBe('KeyE');
    expect(r.bindings.dash).not.toBe('Space');
    expect(valid(r.bindings)).toBe(true);
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
    expect(D.attack).toBe('Space');
    expect(resetBindings()).toEqual(D);
  });

  it('tolerates corrupt or old data, keeping the shared default pair', () => {
    for (const raw of [undefined, null, 'x', 7, [], {}]) expect(normalizeBindings(raw)).toEqual(D);
    expect(normalizeBindings({attack: 'f', bogus: 'KeyZ', spell: 123, dash: 'Escape', item3: 'Digit3'}))
      .toEqual({...D, attack: 'KeyF'});
    expect(normalizeBindings({attack: 'Space', dash: 'Space'})).toEqual(D);
  });

  it('resolves disallowed duplicates in stored data', () => {
    const b = normalizeBindings({moveUp: 'KeyE', interact: 'KeyE'});
    expect(b.moveUp).toBe('KeyE');
    expect(b.interact).not.toBe('KeyE');
    expect(valid(b)).toBe(true);
    const s = normalizeBindings({attack: 'Space', interact: 'Space'});
    expect(s.attack).toBe('Space');
    expect(s.dash).toBe('Space');
    expect(s.interact).not.toBe('Space');
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
  });
});
