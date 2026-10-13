/**
 * Determines whether a pointerdown event should trigger an attack/tap action.
 *
 * Mouse and pen pointerdown attacks only if pointer lock is active
 * (the click that acquires pointer lock does not attack).
 * Touch always attacks (unchanged behavior).
 */
export function pointerDownAttacks(opts: {
  pointerType: string;
  pointerLocked: boolean;
}): boolean {
  if (opts.pointerType === 'touch') {
    return true;
  }
  return opts.pointerLocked;
}
