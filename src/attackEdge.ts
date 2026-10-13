/**
 * Pointer input attack helpers.
 * Ticket AD-24.4: Tap and click attacks must be edge-triggered (exactly one
 * attack per press, no auto-repeat while held), and touches outside the SLASH
 * button must not attack.
 */

/**
 * Determines whether a pointerdown event should initiate an attack.
 * On touch devices, only the dedicated SLASH button attacks (touches on the
 * canvas / look area must not attack). Mouse and pen clicks start an attack.
 */
export function pointerDownStartsAttack(pointerType: string): boolean {
  if (pointerType === 'touch') {
    return false;
  }
  return true;
}
