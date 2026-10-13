import type { FloatingText, Position3D } from './types';

/** Max simultaneous floating texts; the oldest are dropped first. */
export const FLOATING_TEXT_CAP = 16;
/** Seconds a text lives. */
export const FLOATING_TEXT_LIFE = 1.2;
/** World units per second a text rises. */
export const FLOATING_TEXT_RISE = 1.5;
/** Fraction of life (at the end) over which a text fades out. */
export const FLOATING_TEXT_FADE = 0.4;

let seq = 0;

export function createFloatingText(
  text: string,
  pos: Position3D,
  color = '#ffffff',
  isCrit = false,
): FloatingText {
  seq += 1;
  return {
    id: `ft_${seq}`,
    text,
    pos: [pos[0], pos[1] + 0.5, pos[2]],
    color,
    life: 0,
    maxLife: FLOATING_TEXT_LIFE,
    scale: isCrit ? 1.4 : 1.0,
    isCrit,
  };
}

/** Append a text, keeping at most `cap` (oldest dropped). Pure. */
export function spawnText(
  list: readonly FloatingText[],
  ft: FloatingText,
  cap = FLOATING_TEXT_CAP,
): FloatingText[] {
  const next = [...list, ft];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** Age, rise and expire texts. Pure: returns new objects, never mutates. */
export function updateTexts(list: readonly FloatingText[], dt: number): FloatingText[] {
  const out: FloatingText[] = [];
  for (const ft of list) {
    const life = ft.life + dt;
    if (life >= ft.maxLife) continue;
    out.push({ ...ft, life, pos: [ft.pos[0], ft.pos[1] + dt * FLOATING_TEXT_RISE, ft.pos[2]] });
  }
  return out;
}

/** Opacity 1 → 0 over the last FLOATING_TEXT_FADE of life. */
export function textOpacity(ft: Pick<FloatingText, 'life' | 'maxLife'>): number {
  const t = ft.life / ft.maxLife;
  const fadeStart = 1 - FLOATING_TEXT_FADE;
  if (t <= fadeStart) return 1;
  return Math.max(0, 1 - (t - fadeStart) / FLOATING_TEXT_FADE);
}

/**
 * Mutable holder used by the game: spawns and per-frame updates both act on
 * the latest list, so a text spawned in the same frame as an update (before
 * or after it) is never lost. React state is only a render snapshot of it.
 */
export class FloatingTextStore {
  private items: FloatingText[] = [];
  constructor(private readonly cap = FLOATING_TEXT_CAP) {}
  get list(): readonly FloatingText[] {
    return this.items;
  }
  spawn(text: string, pos: Position3D, color?: string, isCrit?: boolean): FloatingText {
    const ft = createFloatingText(text, pos, color, isCrit);
    this.items = spawnText(this.items, ft, this.cap);
    return ft;
  }
  /** Returns true when there was anything to update (caller re-renders). */
  update(dt: number): boolean {
    if (this.items.length === 0) return false;
    this.items = updateTexts(this.items, dt);
    return true;
  }
  clear(): void {
    this.items = [];
  }
}
