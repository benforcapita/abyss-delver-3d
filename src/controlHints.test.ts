import {describe, expect, it} from 'vitest';
import {controlHints} from './controlHints';
import {
  DEFAULT_KEY_BINDINGS as D,
  actionsForCode,
  rebind,
  resetBindings,
} from './platform/keybindings';

describe('controlHints', () => {
  it('matches the old hard-coded labels under default bindings', () => {
    expect(controlHints({...D})).toEqual({
      move: 'WASD',
      attack: 'LMB',
      spell: '2/F',
      dash: 'Space/Shift',
      interact: 'E',
      potion: '1/Q',
    });
  });

  it('shows the rebound dash key; Shift stays a live dash alias', () => {
    const b = rebind(resetBindings(), 'dash', 'KeyK').bindings;
    // Nothing claims ShiftLeft, so the legacy alias still triggers dash.
    expect(actionsForCode(b, 'ShiftLeft')).toEqual(['dash']);
    expect(controlHints(b).dash).toBe('K/Shift');
  });

  it('shows just the Shift label when dash is bound to Shift itself', () => {
    const b = rebind(resetBindings(), 'dash', 'ShiftLeft').bindings;
    expect(controlHints(b).dash).toBe('Shift Left');
  });

  it('drops /Shift once another action claims ShiftLeft', () => {
    const b = rebind(resetBindings(), 'potion', 'ShiftLeft').bindings;
    expect(actionsForCode(b, 'ShiftLeft')).toEqual(['potion']);
    expect(controlHints(b).dash).toBe('Space');
  });

  it('shows F without a redundant /F when spell is rebound to KeyF', () => {
    const b = rebind(resetBindings(), 'spell', 'KeyF').bindings;
    // F still casts the spell, now as the primary binding.
    expect(actionsForCode(b, 'KeyF')).toEqual(['spell']);
    expect(controlHints(b).spell).toBe('F');
  });

  it('drops /F once another action claims KeyF', () => {
    const b = rebind(resetBindings(), 'attack', 'KeyF').bindings;
    expect(actionsForCode(b, 'KeyF')).toEqual(['attack']);
    expect(controlHints(b).spell).toBe('2');
  });

  it('keeps /Q while the potion alias is free and drops it when claimed', () => {
    const moved = rebind(resetBindings(), 'potion', 'Digit5').bindings;
    expect(controlHints(moved).potion).toBe('5/Q');
    const claimed = rebind(resetBindings(), 'attack', 'KeyQ').bindings;
    expect(controlHints(claimed).potion).toBe('1');
  });

  it('reflects rebound movement keys in order W-up, A-left, S-down, D-right', () => {
    let b = resetBindings();
    b = rebind(b, 'moveUp', 'ArrowUp').bindings;
    b = rebind(b, 'moveLeft', 'ArrowLeft').bindings;
    b = rebind(b, 'moveDown', 'ArrowDown').bindings;
    b = rebind(b, 'moveRight', 'ArrowRight').bindings;
    expect(controlHints(b).move).toBe('↑←↓→');
  });
});
