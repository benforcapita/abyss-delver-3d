import {describe, expect, it} from 'vitest';
import {
  computeJoystickVector,
  JOYSTICK_DEAD_ZONE,
  resetJoystickVector,
} from './input';

const RADIUS = 56;

describe('computeJoystickVector', () => {
  it('returns zero for a centered pointer', () => {
    expect(computeJoystickVector(0, 0, RADIUS)).toEqual({x: 0, y: 0});
  });

  it('returns zero inside the dead zone', () => {
    const edge = RADIUS * JOYSTICK_DEAD_ZONE;
    expect(computeJoystickVector(edge * 0.9, 0, RADIUS)).toEqual({x: 0, y: 0});
    expect(computeJoystickVector(0, -edge * 0.9, RADIUS)).toEqual({x: 0, y: 0});
  });

  it('maps a push upward to +y (forward)', () => {
    const v = computeJoystickVector(0, -RADIUS, RADIUS);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(1);
  });

  it('maps a push downward to -y (backward)', () => {
    const v = computeJoystickVector(0, RADIUS, RADIUS);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(-1);
  });

  it('maps a push right to +x and left to -x', () => {
    expect(computeJoystickVector(RADIUS, 0, RADIUS).x).toBeCloseTo(1);
    expect(computeJoystickVector(-RADIUS, 0, RADIUS).x).toBeCloseTo(-1);
  });

  it('preserves analog magnitude for partial deflection', () => {
    const v = computeJoystickVector(RADIUS / 2, 0, RADIUS);
    expect(v.x).toBeCloseTo(0.5);
    expect(v.y).toBeCloseTo(0);
  });

  it('clamps magnitude to 1 when dragged beyond the radius', () => {
    const v = computeJoystickVector(0, -RADIUS * 5, RADIUS);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
    expect(v.y).toBeCloseTo(1);
  });

  it('keeps diagonals on the unit circle', () => {
    const v = computeJoystickVector(RADIUS, -RADIUS, RADIUS);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
    expect(v.x).toBeCloseTo(Math.SQRT1_2);
    expect(v.y).toBeCloseTo(Math.SQRT1_2);
  });

  it('returns zero for a degenerate radius', () => {
    expect(computeJoystickVector(10, 10, 0)).toEqual({x: 0, y: 0});
    expect(computeJoystickVector(10, 10, -1)).toEqual({x: 0, y: 0});
  });
});

describe('resetJoystickVector', () => {
  it('zeroes the vector in place', () => {
    const v = {x: 0.7, y: -0.7};
    resetJoystickVector(v);
    expect(v).toEqual({x: 0, y: 0});
  });
});
