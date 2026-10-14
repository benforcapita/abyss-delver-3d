import {useRef, type ReactNode} from 'react';
import * as THREE from 'three';
import type {EnemyEntity} from '../../types';
import {Part} from './Part';
import {GEO, useEnemyRig, useMaterials, type AnimClock} from './shared';

/** Hovering hooded cultist (~1.75 tall): void face, flared sleeves, claw staff with a pulsing crystal. */
export function CultistModel({enemy, clock, children}: {enemy: EnemyEntity; clock: AnimClock; children?: ReactNode}) {
  const mat = useMaterials(() => ({
    robe: {color: '#3b1361', roughness: 0.92, side: THREE.DoubleSide},
    robeDark: {color: '#1d0933', roughness: 0.95, side: THREE.DoubleSide},
    trim: {color: '#c9a23f', metalness: 0.7, roughness: 0.35},
    skin: {color: '#a89aa8', roughness: 0.8},
    void: {color: '#030105', roughness: 1},
    eye: {basic: '#e2a6ff'},
    wood: {color: '#3a2414', roughness: 0.85},
    crystal: {color: '#d8b4fe', emissive: '#a855f7', emissiveIntensity: 2.2, roughness: 0.15, metalness: 0.1},
    rune: {color: '#a855f7', emissive: '#a855f7', emissiveIntensity: 1.6, transparent: true, opacity: 0.15, depthWrite: false},
  }));

  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const shL = useRef<THREE.Group>(null);
  const shR = useRef<THREE.Group>(null);
  const staff = useRef<THREE.Group>(null);
  const crystal = useRef<THREE.Group>(null);
  const rune = useRef<THREE.Group>(null);

  const root = useEnemyRig(enemy, clock, (m) => {
    if (!body.current || !head.current || !shL.current || !shR.current || !staff.current || !crystal.current || !rune.current) return;
    const gait = Math.min(1, m.walk);
    body.current.position.y = 0.1 + Math.sin(m.t * 2.2) * 0.05;
    body.current.rotation.x = 0.18 * gait - m.hurt * 0.4;
    body.current.rotation.z = Math.sin(m.t * 1.3) * 0.035;

    const thrust = Math.sin(m.strike * Math.PI);
    shR.current.rotation.x = -0.35 - m.windup * 1.15 - thrust * 0.25 + Math.sin(m.phase) * 0.15 * gait;
    staff.current.rotation.x = -shR.current.rotation.x - 0.15 - m.windup * 0.35;
    shL.current.rotation.x = -Math.sin(m.phase) * 0.3 * gait - m.windup * 1.0 - thrust * 0.4;
    shL.current.rotation.z = 0.2 + m.windup * 0.3;

    head.current.rotation.y = Math.sin(m.t * 0.5) * 0.4 * (1 - m.alert);
    head.current.rotation.x = 0.1 * m.alert - m.hurt * 0.3;

    crystal.current.rotation.y += m.dt * (2 + m.windup * 10);
    crystal.current.scale.setScalar(1 + m.windup * 0.9 + Math.sin(m.t * 4) * 0.08);
    (mat.crystal as THREE.MeshStandardMaterial).emissiveIntensity = 2.2 + m.windup * 6 + thrust * 4;

    rune.current.rotation.z += m.dt * (1.2 + m.windup * 6);
    rune.current.scale.setScalar(0.5 + m.alert * 0.1 + m.windup * 0.25);
    (mat.rune as THREE.MeshStandardMaterial).opacity = 0.15 + m.alert * 0.35 + m.windup * 0.4;
  });

  return (
    <group ref={root} scale={enemy.scale}>
      <group ref={body} position={[0, 0.1, 0]}>
        <Part g={GEO.coneOpen} m={mat.robe} p={[0, 0.62, 0]} s={[0.42, 1.2, 0.42]} />
        <Part g={GEO.coneOpen} m={mat.robeDark} p={[0, 0.5, 0]} s={[0.36, 1.0, 0.36]} />
        <Part g={GEO.torusThin} m={mat.trim} p={[0, 0.03, 0]} r={[Math.PI / 2, 0, 0]} s={0.41} />
        <Part g={GEO.box} m={mat.trim} p={[0, 0.45, 0.25]} s={[0.05, 0.75, 0.01]} r={[-0.33, 0, 0]} />
        <Part g={GEO.torusThin} m={mat.trim} p={[0, 0.9, 0]} r={[Math.PI / 2, 0, 0]} s={[0.21, 0.19, 0.6]} />
        <Part g={GEO.sphere} m={mat.robe} p={[0, 1.1, 0]} s={[0.23, 0.3, 0.19]} />
        <Part g={GEO.sphere} m={mat.robeDark} p={[0, 1.28, -0.01]} s={[0.3, 0.12, 0.22]} />

        <group ref={head} position={[0, 1.45, 0]}>
          <Part g={GEO.sphere} m={mat.robe} p={[0, 0.02, -0.01]} s={[0.19, 0.21, 0.21]} />
          <Part g={GEO.cone} m={mat.robe} p={[0, 0.13, -0.15]} r={[-1.0, 0, 0]} s={[0.09, 0.26, 0.09]} />
          <Part g={GEO.sphere} m={mat.void} p={[0, -0.01, 0.12]} s={[0.13, 0.15, 0.08]} />
          <Part g={GEO.sphereLow} m={mat.eye} p={[-0.045, 0.01, 0.19]} s={[0.022, 0.013, 0.01]} />
          <Part g={GEO.sphereLow} m={mat.eye} p={[0.045, 0.01, 0.19]} s={[0.022, 0.013, 0.01]} />
        </group>

        <group ref={shL} position={[-0.25, 1.25, 0]} rotation={[0, 0, 0.2]}>
          <Part g={GEO.coneOpen} m={mat.robe} p={[0, -0.24, 0]} s={[0.09, 0.5, 0.09]} />
          <Part g={GEO.sphereLow} m={mat.skin} p={[0, -0.5, 0]} s={0.045} />
          <Part g={GEO.sphereLow} m={mat.eye} p={[0, -0.56, 0.02]} s={0.02} />
        </group>

        <group ref={shR} position={[0.25, 1.25, 0]} rotation={[0, 0, -0.15]}>
          <Part g={GEO.coneOpen} m={mat.robe} p={[0, -0.24, 0]} s={[0.09, 0.5, 0.09]} />
          <Part g={GEO.sphereLow} m={mat.skin} p={[0, -0.5, 0]} s={0.045} />
          <group ref={staff} position={[0, -0.5, 0.02]}>
            <Part g={GEO.cyl} m={mat.wood} p={[0, 0.2, 0]} s={[0.022, 1.7, 0.022]} />
            <Part g={GEO.torusThin} m={mat.trim} p={[0, 0.95, 0]} r={[Math.PI / 2, 0, 0]} s={0.04} />
            {[0, 1, 2].map((i) => {
              const a = (i / 3) * Math.PI * 2;
              return (
                <Part
                  key={i}
                  g={GEO.cone}
                  m={mat.trim}
                  p={[Math.sin(a) * 0.05, 1.12, Math.cos(a) * 0.05]}
                  r={[Math.cos(a) * 0.45, 0, -Math.sin(a) * 0.45]}
                  s={[0.018, 0.2, 0.018]}
                />
              );
            })}
            <group ref={crystal} position={[0, 1.2, 0]}>
              <Part g={GEO.octa} m={mat.crystal} s={[0.075, 0.13, 0.075]} />
            </group>
          </group>
        </group>

        <group ref={rune} position={[0, 0.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <Part g={GEO.torusThin} m={mat.rune} s={1} />
          <Part g={GEO.torusThin} m={mat.rune} s={0.8} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Part
              key={i}
              g={GEO.octa}
              m={mat.rune}
              p={[Math.cos((i / 6) * Math.PI * 2) * 0.9, Math.sin((i / 6) * Math.PI * 2) * 0.9, 0]}
              s={0.05}
            />
          ))}
        </group>
      </group>
      {children}
    </group>
  );
}
