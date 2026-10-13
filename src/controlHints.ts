import {
  actionsForCode,
  keyLabel,
  type BindableAction,
  type KeyBindings,
} from './platform/keybindings';

/** Display strings for the desktop HUD key-hint bar and the elixir label. */
export interface ControlHints {
  move: string;
  attack: string;
  spell: string;
  dash: string;
  interact: string;
  potion: string;
}

const isShiftCode = (code: string) => code === 'ShiftLeft' || code === 'ShiftRight';

/**
 * `keyLabel(primary)` plus `/alias` while `aliasCode` still resolves to
 * `action` via actionsForCode (legacy alias or primary) and `action` isn't
 * already bound to `aliasCode` itself.
 */
function hintWithAlias(
  bindings: KeyBindings,
  action: BindableAction,
  aliasCode: string,
  aliasLabel: string,
): string {
  let label = keyLabel(bindings[action]);
  if (
    bindings[action] !== aliasCode &&
    actionsForCode(bindings, aliasCode).includes(action)
  ) {
    label += `/${aliasLabel}`;
  }
  return label;
}

/**
 * Derive the HUD hint labels from the current bindings. Legacy secondary keys
 * are shown only while they still trigger the action: "/Shift" while Shift
 * dashes, "/Q" while Q drinks a potion, "/F" while F casts the spell.
 */
export function controlHints(bindings: KeyBindings): ControlHints {
  const move = (['moveUp', 'moveLeft', 'moveDown', 'moveRight'] as const)
    .map((a) => keyLabel(bindings[a]))
    .join('');

  // Dash may itself be bound to a Shift key, so it checks both Shift codes.
  let dash = keyLabel(bindings.dash);
  if (
    !isShiftCode(bindings.dash) &&
    actionsForCode(bindings, 'ShiftLeft').includes('dash')
  ) {
    dash += '/Shift';
  }

  return {
    move,
    attack: keyLabel(bindings.attack),
    spell: hintWithAlias(bindings, 'spell', 'KeyF', 'F'),
    dash,
    interact: keyLabel(bindings.interact),
    potion: hintWithAlias(bindings, 'potion', 'KeyQ', 'Q'),
  };
}
