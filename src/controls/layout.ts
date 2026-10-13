/** Shared geometry and mobile-control layout. Pure: no DOM. */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Positive when the boxes are separated, zero when they only touch,
 * negative when they overlap. A single-axis separation is that gap;
 * a diagonal separation is the corner-to-corner distance.
 */
export function rectGap(a: Rect, b: Rect): number {
  const gapX = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width));
  const gapY = Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height));
  if (gapX > 0 && gapY > 0) return Math.hypot(gapX, gapY);
  if (gapX > 0) return gapX;
  if (gapY > 0) return gapY;
  return Math.max(gapX, gapY);
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return rectGap(a, b) < 0;
}

export function pointInRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height;
}

/** Look drags that land on a control or HUD target must not start. */
export function shouldStartLook(x: number, y: number, blocked: readonly Rect[]): boolean {
  return !blocked.some((rect) => pointInRect(x, y, rect));
}

/** Left-hand movement zone: a touch anywhere in here spawns the stick. */
export const MOVE_ZONE_FRACTION = 0.4;

export const JOYSTICK_MIN_PX = 120;
export const JOYSTICK_MAX_PX = 140;
/** Short-edge scale that lands phone landscape (390px) inside the 120–140 band. */
export const JOYSTICK_SHORT_EDGE_SCALE = 0.34;

export const LAYOUT_GAP = 12;
export const VIEW_MARGIN = 8;

export const CLUSTER_INSET = {right: 16, bottom: 12} as const;

export const BUTTON_SIZE = {
  slash: 80,
  dash: 60,
  spell: 56,
  potion: 56,
  open: 56,
} as const;

export function joystickDiameter(viewportWidth: number, viewportHeight: number): number {
  const shortEdge = Math.min(Math.abs(viewportWidth), Math.abs(viewportHeight));
  return clamp(
    Math.round(shortEdge * JOYSTICK_SHORT_EDGE_SCALE),
    JOYSTICK_MIN_PX,
    JOYSTICK_MAX_PX,
  );
}

/** Top-left of the faint resting ghost, anchored bottom-left. */
export function restingJoystickPosition(
  viewportWidth: number,
  viewportHeight: number,
  diameter: number,
): {x: number; y: number} {
  const marginX = 16;
  const marginY = CLUSTER_INSET.bottom;
  return {
    x: marginX,
    y: Math.max(marginY, viewportHeight - marginY - diameter),
  };
}

function inflate(rect: Rect, pad: number): Rect {
  return {
    x: rect.x - pad,
    y: rect.y - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

/** Smallest axis-aligned push that makes `box` stop overlapping `obstacle`. */
function minimumSeparation(box: Rect, obstacle: Rect): {x: number; y: number} {
  const pushLeft = box.x + box.width - obstacle.x;
  const pushRight = obstacle.x + obstacle.width - box.x;
  const pushUp = box.y + box.height - obstacle.y;
  const pushDown = obstacle.y + obstacle.height - box.y;
  const options = [
    {x: -pushLeft, y: 0, d: pushLeft},
    {x: pushRight, y: 0, d: pushRight},
    {x: 0, y: -pushUp, d: pushUp},
    {x: 0, y: pushDown, d: pushDown},
  ];
  options.sort((a, b) => a.d - b.d);
  return options[0];
}

/**
 * Top-left of a floating stick whose center prefers the touch point.
 * The disc stays inside the viewport and is pushed clear of obstacles
 * (expanded by `pad`, so HUD gaps stay at least that wide).
 */
export function placeFloatingJoystick(
  touchX: number,
  touchY: number,
  diameter: number,
  viewport: {width: number; height: number},
  obstacles: readonly Rect[] = [],
  pad = 0,
): {x: number; y: number} {
  const margin = VIEW_MARGIN;
  const maxX = Math.max(margin, viewport.width - margin - diameter);
  const maxY = Math.max(margin, viewport.height - margin - diameter);
  let x = clamp(touchX - diameter / 2, margin, maxX);
  let y = clamp(touchY - diameter / 2, margin, maxY);
  const inflated = obstacles.map((obstacle) => inflate(obstacle, pad));

  for (let i = 0; i < 8; i++) {
    let moved = false;
    for (const obstacle of inflated) {
      const box = {x, y, width: diameter, height: diameter};
      if (!rectsOverlap(box, obstacle)) continue;
      const push = minimumSeparation(box, obstacle);
      x += push.x;
      y += push.y;
      moved = true;
    }
    x = clamp(x, margin, maxX);
    y = clamp(y, margin, maxY);
    if (!moved) break;
  }

  return {x, y};
}

export type ActionButtonId = 'slash' | 'dash' | 'spell' | 'potion' | 'open';

export interface PlacedButton {
  id: ActionButtonId;
  x: number;
  y: number;
  size: number;
}

export interface ActionCluster {
  width: number;
  height: number;
  buttons: PlacedButton[];
}

/**
 * Bottom-right cluster, coordinates relative to the cluster's top-left.
 * SLASH sits in the corner, DASH on its inner (screen-center) side,
 * SPELL above SLASH, POTION and optional OPEN along the top row.
 * Every pair keeps at least LAYOUT_GAP between bounding boxes.
 */
export function layoutActionCluster(showOpen: boolean): ActionCluster {
  const {slash, dash, spell, potion, open} = BUTTON_SIZE;
  const gap = LAYOUT_GAP;
  const width = showOpen ? open + gap + potion + gap + spell : dash + gap + slash;
  const height = spell + gap + slash;

  const slashX = width - slash;
  const slashY = height - slash;
  const spellX = width - spell;
  const potionX = spellX - gap - potion;

  const buttons: PlacedButton[] = [
    {id: 'potion', x: potionX, y: 0, size: potion},
    {id: 'spell', x: spellX, y: 0, size: spell},
    {id: 'dash', x: slashX - gap - dash, y: slashY, size: dash},
    {id: 'slash', x: slashX, y: slashY, size: slash},
  ];
  if (showOpen) {
    buttons.unshift({id: 'open', x: potionX - gap - open, y: 0, size: open});
  }
  return {width, height, buttons};
}

/** Cluster buttons in viewport coordinates, anchored to the bottom-right inset. */
export function buttonScreenRects(
  viewportWidth: number,
  viewportHeight: number,
  showOpen: boolean,
): (Rect & {id: ActionButtonId})[] {
  const cluster = layoutActionCluster(showOpen);
  const originX = viewportWidth - CLUSTER_INSET.right - cluster.width;
  const originY = viewportHeight - CLUSTER_INSET.bottom - cluster.height;
  return cluster.buttons.map((button) => ({
    id: button.id,
    x: originX + button.x,
    y: originY + button.y,
    width: button.size,
    height: button.size,
  }));
}
