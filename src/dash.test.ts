import { describe, expect, it } from 'vitest';
import { dashDirection, moveInputFrom } from './dash';

const close = (v: { x: number; z: number }, x: number, z: number) => {
  expect(v.x).toBeCloseTo(x);
  expect(v.z).toBeCloseTo(z);
};
const facing = (yaw: number) => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });

describe('dashDirection', () => {
  it('forward input dashes along the camera facing at any yaw', () => {
    for (const yaw of [0, 0.7, Math.PI / 2, Math.PI, -2]) {
      const f = facing(yaw);
      close(dashDirection({ x: 0, z: -1 }, yaw), f.x, f.z);
    }
  });

  it('strafe input dashes sideways relative to the camera', () => {
    close(dashDirection({ x: 1, z: 0 }, 0), 1, 0);
    close(dashDirection({ x: -1, z: 0 }, 0), -1, 0);
    // Facing -X (yaw 90°): right is -Z.
    close(dashDirection({ x: 1, z: 0 }, Math.PI / 2), 0, -1);
  });

  it('diagonal input is normalized', () => {
    const d = dashDirection(moveInputFrom({ up: true, right: true }, { x: 0, y: 0 }), 0);
    expect(Math.hypot(d.x, d.z)).toBeCloseTo(1);
    close(d, Math.SQRT1_2, -Math.SQRT1_2);
  });

  it('idle (or tiny stick drift) back-dodges opposite the facing', () => {
    for (const yaw of [0, 1.2]) {
      const f = facing(yaw);
      close(dashDirection({ x: 0, z: 0 }, yaw), -f.x, -f.z);
      close(dashDirection({ x: 0.01, z: -0.01 }, yaw), -f.x, -f.z);
    }
  });

  it('uses the joystick vector (stick up = forward)', () => {
    close(dashDirection(moveInputFrom(undefined, { x: 0, y: 1 }), 0), 0, -1);
    close(dashDirection(moveInputFrom(undefined, { x: 0.5, y: 0 }), 0), 1, 0);
  });

  it('combines keys and stick like movement does; opposite keys cancel', () => {
    expect(moveInputFrom({ left: true, right: true }, { x: 0, y: 0 })).toEqual({ x: 0, z: 0 });
    expect(moveInputFrom({ down: true }, { x: 0.3, y: 0.2 })).toEqual({ x: 0.3, z: 0.8 });
  });
});
