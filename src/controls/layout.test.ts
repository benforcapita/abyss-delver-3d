import {describe, expect, it} from 'vitest';
import {
  BUTTON_SIZE,
  CLUSTER_INSET,
  JOYSTICK_MAX_PX,
  JOYSTICK_MIN_PX,
  LAYOUT_GAP,
  buttonScreenRects,
  joystickDiameter,
  layoutActionCluster,
  placeFloatingJoystick,
  rectGap,
  rectsOverlap,
  restingJoystickPosition,
  shouldStartLook,
} from './layout';

const PHONE = {width: 664, height: 390};

describe('joystickDiameter', () => {
  it('lands phone landscape inside the 120–140 band', () => {
    const size = joystickDiameter(PHONE.width, PHONE.height);
    expect(size).toBeGreaterThanOrEqual(JOYSTICK_MIN_PX);
    expect(size).toBeLessThanOrEqual(JOYSTICK_MAX_PX);
    expect(size).toBe(133);
  });

  it('clamps large and tiny viewports to the band', () => {
    expect(joystickDiameter(2000, 2000)).toBe(JOYSTICK_MAX_PX);
    expect(joystickDiameter(100, 80)).toBe(JOYSTICK_MIN_PX);
  });
});

describe('placeFloatingJoystick', () => {
  it('centers the stick on the touch when there is room', () => {
    const diameter = 120;
    const placed = placeFloatingJoystick(200, 180, diameter, PHONE);
    expect(placed).toEqual({x: 200 - diameter / 2, y: 180 - diameter / 2});
  });

  it('clamps a corner touch so the disc stays on screen', () => {
    const placed = placeFloatingJoystick(0, 0, 120, PHONE);
    expect(placed).toEqual({x: 8, y: 8});
  });

  it('pushes the disc out of an obstacle', () => {
    const diameter = 100;
    const touch = {x: 300, y: 200};
    const obstacle = {x: 250, y: 140, width: 100, height: 20};
    const placed = placeFloatingJoystick(touch.x, touch.y, diameter, PHONE, [obstacle]);
    const stick = {x: placed.x, y: placed.y, width: diameter, height: diameter};
    expect(rectsOverlap(stick, obstacle)).toBe(false);
    expect(placed.x).toBe(touch.x - diameter / 2);
    expect(placed.y).toBeGreaterThan(touch.y - diameter / 2);
  });

  it('keeps a padded gap from HUD obstacles', () => {
    const diameter = 100;
    const obstacle = {x: 250, y: 140, width: 100, height: 20};
    const placed = placeFloatingJoystick(300, 200, diameter, PHONE, [obstacle], LAYOUT_GAP);
    const stick = {x: placed.x, y: placed.y, width: diameter, height: diameter};
    expect(rectGap(stick, obstacle)).toBeGreaterThanOrEqual(LAYOUT_GAP);
  });
});

describe('layoutActionCluster', () => {
  it('uses the approved sizes', () => {
    const cluster = layoutActionCluster(true);
    const byId = Object.fromEntries(cluster.buttons.map((button) => [button.id, button]));
    expect(byId.slash.size).toBe(BUTTON_SIZE.slash);
    expect(byId.dash.size).toBe(BUTTON_SIZE.dash);
    expect(byId.spell.size).toBe(56);
    expect(byId.potion.size).toBe(56);
    expect(byId.open.size).toBe(56);
  });

  it('hides OPEN unless a chest or shrine is in range', () => {
    expect(layoutActionCluster(false).buttons.map((button) => button.id)).not.toContain('open');
    expect(layoutActionCluster(true).buttons.map((button) => button.id)).toContain('open');
  });

  it('keeps every pair at least 12px apart and at least 56px', () => {
    for (const showOpen of [false, true]) {
      const buttons = buttonScreenRects(PHONE.width, PHONE.height, showOpen);
      for (const button of buttons) {
        expect(button.width).toBeGreaterThanOrEqual(56);
        expect(button.height).toBeGreaterThanOrEqual(56);
        expect(button.x).toBeGreaterThanOrEqual(0);
        expect(button.y).toBeGreaterThanOrEqual(0);
        expect(button.x + button.width).toBeLessThanOrEqual(PHONE.width - CLUSTER_INSET.right + 0.01);
        expect(button.y + button.height).toBeLessThanOrEqual(PHONE.height - CLUSTER_INSET.bottom + 0.01);
      }
      for (let i = 0; i < buttons.length; i++) {
        for (let j = i + 1; j < buttons.length; j++) {
          expect(rectGap(buttons[i], buttons[j])).toBeGreaterThanOrEqual(LAYOUT_GAP);
        }
      }
    }
  });

  it('puts SLASH in the bottom-right corner and DASH on its inner side', () => {
    const buttons = buttonScreenRects(PHONE.width, PHONE.height, false);
    const slash = buttons.find((button) => button.id === 'slash')!;
    const dash = buttons.find((button) => button.id === 'dash')!;
    const spell = buttons.find((button) => button.id === 'spell')!;
    expect(slash.x + slash.width).toBe(PHONE.width - CLUSTER_INSET.right);
    expect(slash.y + slash.height).toBe(PHONE.height - CLUSTER_INSET.bottom);
    expect(dash.x + dash.width).toBeLessThan(slash.x);
    expect(spell.y + spell.height).toBeLessThanOrEqual(slash.y);
  });

  it('does not overlap the resting joystick at 664×390', () => {
    const diameter = joystickDiameter(PHONE.width, PHONE.height);
    const resting = restingJoystickPosition(PHONE.width, PHONE.height, diameter);
    const stick = {x: resting.x, y: resting.y, width: diameter, height: diameter};
    for (const showOpen of [false, true]) {
      for (const button of buttonScreenRects(PHONE.width, PHONE.height, showOpen)) {
        expect(rectsOverlap(stick, button)).toBe(false);
        expect(rectGap(stick, button)).toBeGreaterThanOrEqual(LAYOUT_GAP);
      }
    }
  });
});

describe('shouldStartLook', () => {
  const button = {x: 568, y: 298, width: 80, height: 80};

  it('rejects a touch inside a control', () => {
    expect(shouldStartLook(600, 330, [button])).toBe(false);
  });

  it('allows a touch in the open look area', () => {
    expect(shouldStartLook(400, 160, [button])).toBe(true);
  });
});
