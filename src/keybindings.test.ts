import {describe, expect, it} from 'vitest';
import {
  BINDABLE_ACTIONS,
  DEFAULT_KEY_BINDINGS as D,
  actionForCode,
  keyLabel,
  normalizeBindings,
  normalizeKeyCode,
  rebind,
  resetBindings,
} from './platform/keybindings';

const unique = (b: Record<string, string>) => new Set(Object.values(b)).size === Object.values(b).length;

describe('keybindings', () => {
  it('has unique defaults covering every action, including key-3 slot', () => {
    expect(Object.keys(D).sort()).toEqual([...BINDABLE_ACTIONS].sort());
    expect(unique(D)).toBe(true);
    expect(D).toMatchObject({moveUp: 'KeyW', attack: 'Enter', potion: 'Digit1', spell: 'Digit2', item3: 'Digit3', dash: 'Space'});
  });

  it('normalizes key codes and names regardless of case', () => {
    expect(normalizeKeyCode('f')).toBe('KeyF');
    expect(normalizeKeyCode('F')).toBe('KeyF');
    expect(normalizeKeyCode('keyf')).toBe('KeyF');
    expect(normalizeKeyCode('KEYF')).toBe('KeyF');
    expect(normalizeKeyCode('KeyF')).toBe('KeyF');
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

  it('rebinds to a free key', () => {
    const r = rebind(resetBindings(), 'attack', 'f');
    expect(r.ok).toBe(true);
    expect(r.bindings.attack).toBe('KeyF');
    expect(r.ok && r.swappedWith).toBeUndefined();
    expect(unique(r.bindings)).toBe(true);
  });

  it('swaps on conflict', () => {
    const r = rebind(resetBindings(), 'attack', 'KeyE');
    expect(r).toMatchObject({ok: true, swappedWith: 'interact'});
    expect(r.bindings.attack).toBe('KeyE');
    expect(r.bindings.interact).toBe('Enter');
    expect(unique(r.bindings)).toBe(true);
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
    expect(D.attack).toBe('Enter');
    expect(resetBindings()).toEqual(D);
  });

  it('tolerates corrupt or old data', () => {
    for (const raw of [undefined, null, 'x', 7, [], {}]) expect(normalizeBindings(raw)).toEqual(D);
    const partial = normalizeBindings({attack: 'f', bogus: 'KeyZ', spell: 123, dash: 'Escape'});
    expect(partial).toEqual({...D, attack: 'KeyF'});
  });

  it('resolves duplicates in stored data to unique keys', () => {
    const b = normalizeBindings({moveUp: 'KeyE', interact: 'KeyE'});
    expect(b.moveUp).toBe('KeyE');
    expect(unique(b)).toBe(true);
    expect(Object.keys(b).sort()).toEqual([...BINDABLE_ACTIONS].sort());
  });

  it('looks up actions live with arrows and legacy aliases', () => {
    const b = rebind(resetBindings(), 'attack', 'KeyF').bindings;
    expect(actionForCode(b, 'KeyF')).toBe('attack'); // primary beats legacy F=spell
    expect(actionForCode(b, 'Enter')).toBeNull();
    expect(actionForCode(b, 'ArrowUp')).toBe('moveUp');
    expect(actionForCode(b, 'KeyQ')).toBe('potion');
    expect(actionForCode(resetBindings(), 'KeyF')).toBe('spell');
    expect(actionForCode(b, 'KeyZ')).toBeNull();
  });

  it('labels keys for display', () => {
    expect(keyLabel('KeyF')).toBe('F');
    expect(keyLabel('Digit3')).toBe('3');
    expect(keyLabel('ArrowUp')).toBe('↑');
    expect(keyLabel('ShiftLeft')).toBe('Shift Left');
  });
});
