import {keyLabel, type KeyBindings} from './platform/keybindings';

/** Display strings for the desktop HUD key-hint bar and the elixir label. */
export interface ControlHints {
  move: string;
  attack: string;
  spell: string;
  dash: string;
  interact: string;
  potion: string;
  inventory: string;
}

/**
 * Derive the HUD hint labels from the current bindings. Only the PRIMARY bound
 * key is shown; legacy aliases (Shift / F / Q / Enter) keep working but are
 * intentionally not displayed.
 */
export function controlHints(bindings: KeyBindings): ControlHints {
  const move = (['moveUp', 'moveLeft', 'moveDown', 'moveRight'] as const)
    .map((a) => keyLabel(bindings[a]))
    .join('');
  return {
    move,
    attack: keyLabel(bindings.attack),
    spell: keyLabel(bindings.spell),
    dash: keyLabel(bindings.dash),
    interact: keyLabel(bindings.interact),
    potion: keyLabel(bindings.potion),
    inventory: keyLabel(bindings.inventory),
  };
}
