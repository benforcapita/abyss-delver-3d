import {useFrame} from '@react-three/fiber';
import {useMemo, useRef, type RefObject} from 'react';
import * as THREE from 'three';
import {BOSS_TELEGRAPH_WINDUP, usesGroundTelegraph} from '../../bossTelegraph';
import type {EnemyEntity} from '../../types';

/**
 * Unit primitives shared by every enemy instance (scaled per mesh). Sharing
 * geometry keeps GPU buffers to a handful no matter how many enemies spawn.
 * Materials are NOT shared: hit flash tints materials, so each enemy owns its own.
 */
export const GEO = {
  sphere: new THREE.SphereGeometry(1, 18, 14),
  sphereLow: new THREE.SphereGeometry(1, 10, 8),
  hemi: new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  /** Bone: cylinder with its pivot at the top, extending down to y = -1. */
  limb: new THREE.CylinderGeometry(1, 0.8, 1, 8).translate(0, -0.5, 0),
  cone: new THREE.ConeGeometry(1, 1, 16),
  coneOpen: new THREE.ConeGeometry(1, 1, 20, 1, true),
  torus: new THREE.TorusGeometry(1, 0.12, 8, 28),
  torusThin: new THREE.TorusGeometry(1, 0.04, 6, 40),
  rib: new THREE.TorusGeometry(1, 0.09, 6, 20, Math.PI * 1.35),
  octa: new THREE.OctahedronGeometry(1, 0),
  ico: new THREE.IcosahedronGeometry(1, 0),
  ring: new THREE.RingGeometry(0.75, 1, 40),
  disc: new THREE.CircleGeometry(1, 32),
};

export type MatSpec = Record<string, THREE.MeshStandardMaterialParameters | {basic: string}>;

/** Builds one material per key for this enemy instance; `{basic: color}` makes an unlit glow. */
export function useMaterials<T extends MatSpec>(spec: () => T): {[K in keyof T]: THREE.Material} {
  return useMemo(() => {
    const out = {} as {[K in keyof T]: THREE.Material};
    const s = spec();
    for (const key of Object.keys(s) as (keyof T)[]) {
      const p = s[key];
      out[key] =
        'basic' in p
          ? new THREE.MeshBasicMaterial({color: p.basic, toneMapped: false})
          : new THREE.MeshStandardMaterial(p);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Shared frame clock advanced by the game loop (respects pause and hit-stop). */
export interface AnimClock {
  t: number;
  dt: number;
}

export function createAnimClock(): AnimClock {
  return {t: 0, dt: 0};
}

/** Per-frame animation drivers derived from the enemy's simulation state. */
export interface Motion {
  t: number;
  dt: number;
  /** 0 idle … 1 moving at full speed (smoothed). */
  walk: number;
  /** Gait phase in radians; advances with distance travelled. */
  phase: number;
  /** 0 → 1 during the attack windup. */
  windup: number;
  /** 0 → 1 across the strike. */
  strike: number;
  /** 1 → 0 just after being hit. */
  hurt: number;
  /** 1 while the enemy can see the player (smoothed). */
  alert: number;
}

const damp = (cur: number, target: number, rate: number, dt: number) =>
  cur + (target - cur) * (1 - Math.exp(-rate * dt));

/**
 * Drives the enemy root transform straight from the simulation every frame
 * (no React re-render needed), derives Motion, then calls `animate`.
 */
export function useEnemyRig(
  enemy: EnemyEntity,
  clock: AnimClock,
  animate: (m: Motion) => void,
  stride = 6,
): RefObject<THREE.Group | null> {
  const root = useRef<THREE.Group>(null);
  const m = useRef<Motion>({t: 0, dt: 0, walk: 0, phase: Math.random() * 6, windup: 0, strike: 0, hurt: 0, alert: 0});
  const last = useRef<[number, number] | null>(null);

  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const motion = m.current;
    const dt = clock.dt;
    motion.t = clock.t;
    motion.dt = dt;

    const [x, , z] = enemy.pos;
    const prev = last.current;
    const moved = prev ? Math.hypot(x - prev[0], z - prev[1]) : 0;
    last.current = [x, z];
    if (dt > 0) {
      const speedFrac = Math.min(1.2, moved / dt / Math.max(0.1, enemy.moveSpeed));
      motion.walk = damp(motion.walk, speedFrac, 10, dt);
      motion.phase += (moved / Math.max(0.2, enemy.scale)) * stride;
      motion.alert = damp(motion.alert, enemy.seesPlayer ? 1 : 0, 6, dt);
    }

    const windupTotal = usesGroundTelegraph(enemy.isBoss, enemy.archetype) ? BOSS_TELEGRAPH_WINDUP : 0.5;
    motion.windup = enemy.state === 'windup' ? THREE.MathUtils.clamp(1 - enemy.stateTimer / windupTotal, 0, 1) : 0;
    motion.strike = enemy.state === 'attack' ? THREE.MathUtils.clamp(1 - enemy.stateTimer / 0.3, 0, 1) : 0;
    motion.hurt = enemy.state === 'hurt' ? THREE.MathUtils.clamp(enemy.stateTimer / 0.2, 0, 1) : 0;

    g.visible = enemy.hp > 0;
    g.position.set(x, 0, z);
    g.rotation.y = enemy.rotY;
    animate(motion);
  });

  return root;
}

/** Weapon arm angle (rotation.x) for a raise-then-chop attack. Negative = raised. */
export function chopAngle(m: Motion, raised = -2.4, follow = 0.7): number {
  if (m.windup > 0) return raised * easeOut(m.windup);
  if (m.strike > 0) return raised + (follow - raised) * easeOut(Math.min(1, m.strike * 2.2));
  return 0;
}

export function easeOut(x: number): number {
  return 1 - (1 - x) * (1 - x);
}
