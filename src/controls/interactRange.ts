/** Same reach executeInteract uses for chests and shrines. */
export const INTERACT_RANGE = 3.2;

interface PlacedProp {
  pos: readonly [number, number, number];
}

/**
 * True when the player is close enough to an unopened chest or an unused shrine
 * for the contextual OPEN button to appear.
 */
export function nearChestOrShrine(
  playerX: number,
  playerZ: number,
  chests: readonly (PlacedProp & {opened: boolean})[],
  shrines: readonly (PlacedProp & {used: boolean})[],
  range = INTERACT_RANGE,
): boolean {
  const rangeSq = range * range;
  for (const chest of chests) {
    if (chest.opened) continue;
    const dx = chest.pos[0] - playerX;
    const dz = chest.pos[2] - playerZ;
    if (dx * dx + dz * dz < rangeSq) return true;
  }
  for (const shrine of shrines) {
    if (shrine.used) continue;
    const dx = shrine.pos[0] - playerX;
    const dz = shrine.pos[2] - playerZ;
    if (dx * dx + dz * dz < rangeSq) return true;
  }
  return false;
}
