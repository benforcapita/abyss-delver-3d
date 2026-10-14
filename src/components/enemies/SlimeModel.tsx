import {useRef, type ReactNode} from 'react';
import * as THREE from 'three';
import type {EnemyEntity} from '../../types';
import {Part} from './Part';
import {GEO, useEnemyRig, useMaterials, type AnimClock} from './shared';

const BUBBLES: [number, number, number][] = [
  [0.14, 0.05, 0.1],
  [-0.18, 0.04, -0.05],
  [0.05, 0.035, -0.2],
  [-0.06, 0.03, 0.18],
];

/** Translucent hopping slime with squash & stretch, googly eyes and a half-digested skeleton inside. */
export function SlimeModel({enemy, clock, children}: {enemy: EnemyEntity; clock: AnimClock; children?: ReactNode}) {
  const mat = useMaterials(() => ({
    gel: {
      color: '#3ddc84',
      emissive: '#0b6b3a',
      emissiveIntensity: 0.55,
      roughness: 0.12,
      metalness: 0,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    },
    puddle: {color: '#14532d', emissive: '#166534', emissiveIntensity: 0.4, transparent: true, opacity: 0.55, depthWrite: false},
    core: {color: '#14532d', emissive: '#4ade80', emissiveIntensity: 0.9, roughness: 0.4},
    eyeWhite: {color: '#f0fdf4', roughness: 0.25},
    pupil: {color: '#050505', roughness: 0.2},
    mouth: {color: '#052e16', roughness: 0.6},
    bone: {color: '#ddd6c1', roughness: 0.8},
    bubble: {color: '#d9f99d', transparent: true, opacity: 0.55, roughness: 0.05, depthWrite: false},
  }));

  const body = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const bubbles = useRef<THREE.Group>(null);
  const puddle = useRef<THREE.Mesh>(null);

  const root = useEnemyRig(
    enemy,
    clock,
    (m) => {
      if (!body.current || !eyes.current || !mouth.current || !bubbles.current || !puddle.current) return;
      const gait = Math.min(1, m.walk);
      const hop = Math.abs(Math.sin(m.phase * 0.5));
      const lunge = Math.sin(m.strike * Math.PI);
      let sy =
        1 +
        Math.sin(m.t * 3.2) * 0.04 +
        (hop - 0.4) * 0.35 * gait -
        m.windup * 0.38 +
        lunge * 0.35 -
        m.hurt * 0.25;
      sy = Math.max(0.5, sy);
      const sxz = 1 / Math.sqrt(sy);
      body.current.scale.set(sxz, sy, sxz);
      body.current.position.set(0, 0.45 * sy + hop * 0.32 * gait + lunge * 0.15, lunge * 0.45);
      body.current.rotation.x = 0.15 * gait + lunge * 0.3;
      puddle.current.scale.setScalar(0.55 * sxz * (1 - hop * 0.4 * gait));

      const blink = m.t % 3.3 < 0.12 ? 0.15 : 1;
      eyes.current.scale.set(1, blink, 1);
      eyes.current.rotation.x = -0.15 * m.alert;
      mouth.current.scale.set(0.15 + m.windup * 0.05, 0.03 + m.windup * 0.09 + lunge * 0.06, 0.04);

      bubbles.current.children.forEach((b, i) => {
        b.position.y = (((m.t * 0.35 + i * 0.27) % 1) - 0.5) * 0.6;
      });
    },
    3,
  );

  return (
    <group ref={root} scale={enemy.scale}>
      <mesh ref={puddle} geometry={GEO.disc} material={mat.puddle} position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={0.55} />
      <group ref={body} position={[0, 0.45, 0]}>
        <Part g={GEO.sphere} m={mat.gel} s={[0.52, 0.45, 0.52]} />
        <Part g={GEO.sphereLow} m={mat.core} p={[0, -0.04, -0.06]} s={0.15} />
        <Part g={GEO.limb} m={mat.bone} p={[0.1, 0.12, -0.12]} r={[0.3, 0, 1.1]} s={[0.022, 0.26, 0.022]} />
        <Part g={GEO.sphere} m={mat.bone} p={[-0.17, -0.12, 0.02]} s={[0.07, 0.07, 0.08]} />
        <group ref={bubbles}>
          {BUBBLES.map(([x, r, z], i) => (
            <Part key={i} g={GEO.sphereLow} m={mat.bubble} p={[x, 0, z]} s={r} />
          ))}
        </group>
        <group ref={eyes} position={[0, 0.17, 0]}>
          {[-0.16, 0.16].map((x) => (
            <group key={x} position={[x, 0, 0.42]}>
              <Part g={GEO.sphere} m={mat.eyeWhite} s={[0.095, 0.115, 0.07]} />
              <Part g={GEO.sphereLow} m={mat.pupil} p={[0, -0.01, 0.06]} s={[0.045, 0.055, 0.03]} />
            </group>
          ))}
        </group>
        <mesh ref={mouth} geometry={GEO.sphereLow} material={mat.mouth} position={[0, -0.03, 0.49]} scale={[0.15, 0.03, 0.04]} />
      </group>
      {children}
    </group>
  );
}
