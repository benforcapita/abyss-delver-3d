import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { cameraForward, cameraMoveVector, cameraRight, localToWorld } from './cameraBasis';

const D = Math.PI / 180;
// Local input as Game.tsx builds it: W → z-1, S → z+1, A → x-1, D → x+1.
const KEYS = { W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0] } as const;

// Expected world (x, z) per yaw: camera looks along (-sin, -cos).
const EXPECTED: Record<number, Record<keyof typeof KEYS, [number, number]>> = {
  0: { W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0] },
  90: { W: [-1, 0], S: [1, 0], A: [0, 1], D: [0, -1] },
  180: { W: [0, 1], S: [0, -1], A: [1, 0], D: [-1, 0] },
  270: { W: [1, 0], S: [-1, 0], A: [0, -1], D: [0, 1] },
};

const close = (v: { x: number; z: number }, x: number, z: number) => {
  expect(v.x).toBeCloseTo(x);
  expect(v.z).toBeCloseTo(z);
};

describe('cameraMoveVector', () => {
  for (const yawDeg of [0, 90, 180, 270]) {
    for (const key of ['W', 'A', 'S', 'D'] as const) {
      it(`${key} at yaw ${yawDeg}°`, () => {
        const [mx, mz] = KEYS[key];
        const [ex, ez] = EXPECTED[yawDeg][key];
        close(cameraMoveVector(mx, mz, yawDeg * D), ex, ez);
      });
    }
  }

  it('W matches the real three.js camera look direction (rotation order YXZ)', () => {
    const cam = new THREE.PerspectiveCamera();
    cam.rotation.order = 'YXZ';
    for (const yaw of [0, 0.4, 1.3, Math.PI / 2, 2.5, -1]) {
      cam.rotation.set(0, yaw, 0);
      cam.updateMatrixWorld();
      const dir = new THREE.Vector3();
      cam.getWorldDirection(dir);
      close(cameraMoveVector(0, -1, yaw), dir.x, dir.z);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
      close(cameraMoveVector(1, 0, yaw), right.x, right.z);
    }
  });

  it('normalizes diagonals and is zero when idle', () => {
    const v = cameraMoveVector(1, -1, 0.7);
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(1);
    expect(cameraMoveVector(0, 0, 1)).toEqual({ x: 0, z: 0 });
  });

  it('basis helpers agree with localToWorld', () => {
    const yaw = 1.1;
    const f = cameraForward(yaw);
    const r = cameraRight(yaw);
    close(localToWorld(0, -1, yaw), f.x, f.z);
    close(localToWorld(1, 0, yaw), r.x, r.z);
  });

  it('agrees with dash.ts (PR #29) for the same input', () => {
    // Copied from PR #29's dashDirection(): x' = x*cos + z*sin, z' = -x*sin + z*cos,
    // e.g. its test "strafe right at yaw 90° → (0, -1)" and "forward → facing".
    close(cameraMoveVector(1, 0, Math.PI / 2), 0, -1);
    const yaw = 0.7;
    close(cameraMoveVector(0, -1, yaw), -Math.sin(yaw), -Math.cos(yaw));
    const dashDiag = { x: Math.SQRT1_2, z: -Math.SQRT1_2 }; // dash.test: up+right at yaw 0
    close(cameraMoveVector(1, -1, 0), dashDiag.x, dashDiag.z);
  });
});
