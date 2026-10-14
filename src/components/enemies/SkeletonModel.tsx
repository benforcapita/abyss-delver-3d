import {useRef, type ReactNode} from 'react';
import * as THREE from 'three';
import type {EnemyEntity} from '../../types';
import {Part} from './Part';
import {chopAngle, GEO, useEnemyRig, useMaterials, type AnimClock} from './shared';

const RIB_ROT: [number, number, number] = [Math.PI / 2, 0, -0.175 * Math.PI];

/** Articulated skeleton warrior (~1.85 tall): rusty sword, wooden buckler, glowing eye sockets. */
export function SkeletonModel({enemy, clock, children}: {enemy: EnemyEntity; clock: AnimClock; children?: ReactNode}) {
  const mat = useMaterials(() => ({
    bone: {color: '#e8e2cf', roughness: 0.72},
    boneDark: {color: '#b3aa90', roughness: 0.85},
    socket: {color: '#120a0a', roughness: 1},
    eye: {basic: '#ff3b2f'},
    rust: {color: '#8a7663', metalness: 0.7, roughness: 0.5},
    iron: {color: '#9ca3af', metalness: 0.9, roughness: 0.3},
    leather: {color: '#4a2f1d', roughness: 0.9},
    wood: {color: '#6b4426', roughness: 0.85},
  }));
  const hasHelm = enemy.id.charCodeAt(enemy.id.length - 1) % 2 === 0;

  const pelvis = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const jaw = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const hipL = useRef<THREE.Group>(null);
  const hipR = useRef<THREE.Group>(null);
  const kneeL = useRef<THREE.Group>(null);
  const kneeR = useRef<THREE.Group>(null);
  const shL = useRef<THREE.Group>(null);
  const shR = useRef<THREE.Group>(null);
  const elR = useRef<THREE.Group>(null);

  const root = useEnemyRig(enemy, clock, (m) => {
    if (!pelvis.current || !torso.current || !head.current || !jaw.current || !eyes.current) return;
    if (!hipL.current || !hipR.current || !kneeL.current || !kneeR.current || !shL.current || !shR.current || !elR.current) return;
    const s = Math.sin(m.phase);
    const gait = Math.min(1, m.walk);
    hipL.current.rotation.x = -s * 0.65 * gait;
    hipR.current.rotation.x = s * 0.65 * gait;
    kneeL.current.rotation.x = Math.max(0, s) * 1.1 * gait;
    kneeR.current.rotation.x = Math.max(0, -s) * 1.1 * gait;
    pelvis.current.position.y = 0.95 - Math.abs(Math.cos(m.phase)) * 0.05 * gait;
    pelvis.current.rotation.y = s * 0.12 * gait;

    const chop = chopAngle(m);
    shL.current.rotation.x = s * 0.5 * gait - m.windup * 0.5;
    shR.current.rotation.x = chop !== 0 ? chop : -s * 0.5 * gait;
    elR.current.rotation.x = -0.35 - m.windup * 0.4;

    torso.current.rotation.x = 0.12 * gait - m.windup * 0.2 + Math.sin(m.strike * Math.PI) * 0.35 - m.hurt * 0.5;
    torso.current.rotation.y = -m.windup * 0.35 + m.strike * 0.35 - s * 0.1 * gait;
    torso.current.rotation.z = Math.sin(m.t * 1.4) * 0.03 * (1 - gait);

    head.current.rotation.y = Math.sin(m.t * 0.6) * 0.5 * (1 - m.alert);
    head.current.rotation.x = Math.sin(m.t * 1.7) * 0.05 - m.hurt * 0.4;
    jaw.current.rotation.x = 0.05 + (Math.sin(m.t * 18) * 0.5 + 0.5) * 0.12 * m.alert + m.windup * 0.5;
    const glow = 1 + m.alert * 0.5 + m.windup * 0.6;
    eyes.current.scale.setScalar(glow);
  });

  return (
    <group ref={root} scale={enemy.scale}>
      <group ref={pelvis} position={[0, 0.95, 0]}>
        <Part g={GEO.box} m={mat.boneDark} s={[0.3, 0.09, 0.14]} />
        <Part g={GEO.box} m={mat.leather} p={[0, -0.06, 0.02]} s={[0.34, 0.1, 0.18]} />
        {(
          [
            [hipL, kneeL, -0.1],
            [hipR, kneeR, 0.1],
          ] as const
        ).map(([hip, knee, x]) => (
          <group key={x} ref={hip} position={[x, -0.04, 0]}>
            <Part g={GEO.sphereLow} m={mat.bone} s={0.045} />
            <Part g={GEO.limb} m={mat.bone} s={[0.034, 0.44, 0.034]} />
            <group ref={knee} position={[0, -0.44, 0]}>
              <Part g={GEO.sphereLow} m={mat.bone} s={0.04} />
              <Part g={GEO.limb} m={mat.bone} s={[0.03, 0.42, 0.03]} />
              <Part g={GEO.box} m={mat.boneDark} p={[0, -0.44, 0.05]} s={[0.08, 0.04, 0.17]} />
            </group>
          </group>
        ))}

        <group ref={torso} position={[0, 0.04, 0]}>
          <Part g={GEO.cyl} m={mat.boneDark} p={[0, 0.27, -0.02]} s={[0.028, 0.55, 0.028]} />
          {[0.08, 0.17, 0.26, 0.35, 0.44].map((y) => (
            <Part key={y} g={GEO.sphereLow} m={mat.bone} p={[0, y, -0.035]} s={[0.035, 0.025, 0.03]} />
          ))}
          {[0.2, 0.28, 0.36, 0.44].map((y, i) => (
            <Part key={y} g={GEO.rib} m={mat.bone} p={[0, y, 0.02]} r={RIB_ROT} s={[0.15 + i * 0.012, 0.12, 0.17]} />
          ))}
          <Part g={GEO.box} m={mat.bone} p={[0, 0.33, 0.13]} s={[0.035, 0.24, 0.02]} />
          <Part g={GEO.box} m={mat.bone} p={[0, 0.52, 0]} s={[0.44, 0.035, 0.05]} />

          <group ref={shL} position={[-0.23, 0.5, 0]}>
            <Part g={GEO.sphereLow} m={mat.bone} s={0.045} />
            <Part g={GEO.limb} m={mat.bone} s={[0.028, 0.3, 0.028]} />
            <group position={[0, -0.3, 0]} rotation={[-0.5, 0, 0]}>
              <Part g={GEO.limb} m={mat.bone} s={[0.024, 0.27, 0.024]} />
              <Part g={GEO.sphereLow} m={mat.bone} p={[0, -0.29, 0]} s={0.04} />
              <group position={[-0.05, -0.18, 0.05]}>
                <Part g={GEO.cyl} m={mat.wood} r={[Math.PI / 2, 0, 0]} s={[0.2, 0.03, 0.2]} />
                <Part g={GEO.torus} m={mat.rust} p={[0, 0, 0.012]} s={[0.2, 0.2, 0.25]} />
                <Part g={GEO.hemi} m={mat.iron} p={[0, 0, 0.015]} r={[Math.PI / 2, 0, 0]} s={0.05} />
              </group>
            </group>
          </group>

          <group ref={shR} position={[0.23, 0.5, 0]}>
            <Part g={GEO.sphereLow} m={mat.bone} s={0.045} />
            <Part g={GEO.limb} m={mat.bone} s={[0.028, 0.3, 0.028]} />
            <group ref={elR} position={[0, -0.3, 0]}>
              <Part g={GEO.limb} m={mat.bone} s={[0.024, 0.27, 0.024]} />
              <group position={[0, -0.29, 0]} rotation={[1.35, 0, 0]}>
                <Part g={GEO.sphereLow} m={mat.bone} s={0.04} />
                <Part g={GEO.cyl} m={mat.leather} s={[0.018, 0.15, 0.018]} />
                <Part g={GEO.sphereLow} m={mat.rust} p={[0, -0.085, 0]} s={0.025} />
                <Part g={GEO.box} m={mat.rust} p={[0, 0.085, 0]} s={[0.17, 0.025, 0.035]} />
                <Part g={GEO.box} m={mat.rust} p={[0, 0.42, 0]} s={[0.05, 0.62, 0.012]} />
                <Part g={GEO.box} m={mat.iron} p={[0, 0.42, 0]} s={[0.012, 0.6, 0.016]} />
              </group>
            </group>
          </group>

          <Part g={GEO.cyl} m={mat.boneDark} p={[0, 0.58, 0]} s={[0.025, 0.1, 0.025]} />
          <group ref={head} position={[0, 0.62, 0]}>
            <Part g={GEO.sphere} m={mat.bone} p={[0, 0.12, 0]} s={[0.13, 0.14, 0.15]} />
            <Part g={GEO.sphere} m={mat.bone} p={[0, 0.05, 0.06]} s={[0.1, 0.07, 0.085]} />
            <Part g={GEO.sphereLow} m={mat.socket} p={[-0.05, 0.11, 0.115]} s={0.036} />
            <Part g={GEO.sphereLow} m={mat.socket} p={[0.05, 0.11, 0.115]} s={0.036} />
            <group ref={eyes} position={[0, 0.11, 0.135]}>
              <Part g={GEO.sphereLow} m={mat.eye} p={[-0.05, 0, 0]} s={0.017} />
              <Part g={GEO.sphereLow} m={mat.eye} p={[0.05, 0, 0]} s={0.017} />
            </group>
            <Part g={GEO.box} m={mat.socket} p={[0, 0.065, 0.145]} s={[0.022, 0.035, 0.01]} />
            <Part g={GEO.box} m={mat.bone} p={[0, 0.02, 0.135]} s={[0.11, 0.018, 0.012]} />
            <group ref={jaw} position={[0, 0.03, 0.02]}>
              <Part g={GEO.box} m={mat.boneDark} p={[0, -0.025, 0.05]} s={[0.13, 0.035, 0.11]} />
              <Part g={GEO.box} m={mat.bone} p={[0, -0.005, 0.1]} s={[0.1, 0.015, 0.012]} />
            </group>
            {hasHelm && (
              <>
                <Part g={GEO.hemi} m={mat.rust} p={[0, 0.15, -0.005]} s={[0.145, 0.11, 0.165]} />
                <Part g={GEO.box} m={mat.rust} p={[0, 0.17, 0.12]} s={[0.025, 0.12, 0.03]} />
              </>
            )}
          </group>
        </group>
      </group>
      {children}
    </group>
  );
}
