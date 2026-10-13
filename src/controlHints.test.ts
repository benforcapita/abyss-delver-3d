import {describe, expect, it} from 'vitest';
import {controlHints} from './controlHints';
import {
  DEFAULT_KEY_BINDINGS as D,
  actionsForCode,
  rebind,
  resetBindings,
} from './platform/keybindings';

describe('controlHints', () => {
  it('shows only primary keys under default bindings', () => {
    expect(controlHints({...D})).toEqual({
      move: 'WASD',
      attack: 'LMB',
      spell: '2',
      dash: 'Space',
      interact: 'E',
      potion: '1',
    });
  });

  it('shows the rebound dash key only; Shift alias still works but is hidden', () => {
    const b = rebind(resetBindings(), 'dash', 'KeyK').bindings;
    expect(actionsForCode(b, 'ShiftLeft')).toEqual(['dash']);
    expect(controlHints(b).dash).toBe('K');
  });

  it('never displays the F / Q aliases even while they still fire', () => {
    const b = resetBindings();
    expect(actionsForCode(b, 'KeyF')).toEqual(['spell']);
    expect(actionsForCode(b, 'KeyQ')).toEqual(['potion']);
    const h = controlHints(b);
    expect(h.spell).not.toMatch(/F/);
    expect(h.potion).not.toMatch(/Q/);
  });

  it('elixir label follows the primary potion key', () => {
    expect(controlHints(rebind(resetBindings(), 'potion', 'Digit5').bindings).potion).toBe('5');
    expect(controlHints(rebind(resetBindings(), 'potion', 'KeyQ').bindings).potion).toBe('Q');
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
