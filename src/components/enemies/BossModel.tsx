import {useRef, type ReactNode} from 'react';
import * as THREE from 'three';
import type {EnemyArchetype, EnemyEntity} from '../../types';
import {Part} from './Part';
import {chopAngle, GEO, useEnemyRig, useMaterials, type AnimClock} from './shared';

type Helm = 'horns' | 'crown' | 'snakes' | 'visor' | 'halo';
type Weapon = 'club' | 'staff' | 'spear' | 'greatsword' | 'orbs';
type Lower = 'legs' | 'robe' | 'tail';

interface BossLook {
  armor: string;
  dark: string;
  trim: string;
  helm: Helm;
  weapon: Weapon;
  lower: Lower;
  cape?: boolean;
  orbs?: number;
  /** Melee bosses chop; casters raise the weapon forward. */
  melee: boolean;
}

const LOOKS: Partial<Record<EnemyArchetype, BossLook>> = {
  boss_bone_colossus: {armor: '#d9d1b8', dark: '#3f3a33', trim: '#7f1d1d', helm: 'horns', weapon: 'club', lower: 'legs', melee: true},
  boss_crimson_archmage: {armor: '#7f1d1d', dark: '#2a0a0a', trim: '#f2c14e', helm: 'crown', weapon: 'staff', lower: 'robe', orbs: 3, melee: false},
  boss_gorgon: {armor: '#1f5f3a', dark: '#0f2a1b', trim: '#bef264', helm: 'snakes', weapon: 'spear', lower: 'tail', melee: true},
  boss_shadow_knight: {armor: '#25224f', dark: '#0b0a1c', trim: '#8b93ff', helm: 'visor', weapon: 'greatsword', lower: 'legs', cape: true, melee: true},
  boss_void_overlord: {armor: '#2e1065', dark: '#0c0221', trim: '#d8b4fe', helm: 'halo', weapon: 'orbs', lower: 'robe', orbs: 6, cape: true, melee: true},
};

const SNAKES = 9;

/** Hulking floor boss (~2 units tall before its 1.8× scale) with a per-boss silhouette. */
export function BossModel({enemy, clock, children}: {enemy: EnemyEntity; clock: AnimClock; children?: ReactNode}) {
  const look = LOOKS[enemy.archetype] ?? LOOKS.boss_shadow_knight!;
  const glow = enemy.color;
  const mat = useMaterials(() => ({
    armor: {color: look.armor, metalness: 0.65, roughness: 0.38},
    dark: {color: look.dark, metalness: 0.5, roughness: 0.55, side: THREE.DoubleSide},
    trim: {color: look.trim, metalness: 0.85, roughness: 0.25},
    glow: {basic: glow},
    core: {color: glow, emissive: glow, emissiveIntensity: 2.5, roughness: 0.2},
    cape: {color: look.dark, roughness: 0.9, side: THREE.DoubleSide},
    bone: {color: '#e8e2cf', roughness: 0.7},
    halo: {color: glow, emissive: glow, emissiveIntensity: 1.8, transparent: true, opacity: 0.75, depthWrite: false},
  }));
  const floats = look.lower === 'robe';

  const body = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const hipL = useRef<THREE.Group>(null);
  const hipR = useRef<THREE.Group>(null);
  const kneeL = useRef<THREE.Group>(null);
  const kneeR = useRef<THREE.Group>(null);
  const shL = useRef<THREE.Group>(null);
  const shR = useRef<THREE.Group>(null);
  const cape = useRef<THREE.Group>(null);
  const orbit = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Group>(null);
  const snakes = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const coreGem = useRef<THREE.Group>(null);

  const root = useEnemyRig(
    enemy,
    clock,
    (m) => {
      if (!body.current || !torso.current || !head.current || !shL.current || !shR.current) return;
      const s = Math.sin(m.phase);
      const gait = Math.min(1, m.walk);
      const thrust = Math.sin(m.strike * Math.PI);

      if (hipL.current && hipR.current && kneeL.current && kneeR.current) {
        hipL.current.rotation.x = -s * 0.55 * gait;
        hipR.current.rotation.x = s * 0.55 * gait;
        kneeL.current.rotation.x = Math.max(0, s) * 0.9 * gait;
        kneeR.current.rotation.x = Math.max(0, -s) * 0.9 * gait;
        body.current.position.y = -Math.abs(Math.cos(m.phase)) * 0.06 * gait - m.windup * 0.12;
      } else {
        body.current.position.y = (floats ? 0.22 : 0) + Math.sin(m.t * 1.6) * 0.08;
      }
      if (tail.current) tail.current.rotation.y = Math.sin(m.t * 2 + m.phase) * 0.45;

      const arm = look.melee ? chopAngle(m, -2.7, 0.6) : -0.4 - m.windup * 1.25 - thrust * 0.3;
      shR.current.rotation.x = arm !== 0 ? arm : -s * 0.4 * gait;
      shL.current.rotation.x = s * 0.4 * gait - m.windup * 0.7 + thrust * 0.3;
      shL.current.rotation.z = 0.15 + m.windup * 0.35;

      torso.current.rotation.x = 0.1 * gait - m.windup * 0.25 + thrust * 0.35 - m.hurt * 0.35;
      torso.current.rotation.y = -m.windup * 0.45 + thrust * 0.5;
      torso.current.position.y = 1.0 + Math.sin(m.t * 2) * 0.015;
      head.current.rotation.x = -0.1 * m.alert - m.hurt * 0.3;
      head.current.rotation.y = Math.sin(m.t * 0.5) * 0.3 * (1 - m.alert);

      if (cape.current) cape.current.rotation.x = 0.12 + gait * 0.4 + Math.sin(m.t * 2.3) * 0.05;
      if (orbit.current) {
        orbit.current.rotation.y += m.dt * (1.1 + m.windup * 5);
        orbit.current.position.y = 1.35 + Math.sin(m.t * 1.7) * 0.1;
      }
      if (halo.current) halo.current.rotation.z += m.dt * (0.8 + m.windup * 4);
      if (coreGem.current) coreGem.current.scale.setScalar(1 + m.windup * 0.8 + Math.sin(m.t * 3) * 0.1);
      if (snakes.current) {
        snakes.current.children.forEach((snake, i) => {
          const seg = snake.children[0];
          if (seg) seg.rotation.x = Math.sin(m.t * 4 + i * 1.3) * 0.35 - m.windup * 0.3;
        });
      }
      (mat.core as THREE.MeshStandardMaterial).emissiveIntensity = 2.5 + m.windup * 5;
    },
    4,
  );

  return (
    <group ref={root} scale={enemy.scale}>
      <pointLight position={[0, 2.6, 1.4]} intensity={5} distance={7} color={glow} />
      <group ref={body}>
        {look.lower === 'legs' &&
          (
            [
              [hipL, kneeL, -0.2],
              [hipR, kneeR, 0.2],
            ] as const
          ).map(([hip, knee, x]) => (
            <group key={x} ref={hip} position={[x, 0.95, 0]}>
              <Part g={GEO.limb} m={mat.armor} s={[0.12, 0.48, 0.12]} />
              <group ref={knee} position={[0, -0.48, 0]}>
                <Part g={GEO.sphere} m={mat.trim} s={[0.11, 0.1, 0.12]} p={[0, 0, 0.03]} />
                <Part g={GEO.limb} m={mat.armor} s={[0.1, 0.44, 0.1]} />
                <Part g={GEO.box} m={mat.dark} p={[0, -0.44, 0.06]} s={[0.19, 0.1, 0.32]} />
              </group>
            </group>
          ))}
        {look.lower === 'robe' && (
          <>
            <Part g={GEO.coneOpen} m={mat.dark} p={[0, 0.55, 0]} s={[0.62, 1.1, 0.62]} />
            <Part g={GEO.coneOpen} m={mat.armor} p={[0, 0.7, 0.02]} s={[0.5, 0.85, 0.5]} />
            <Part g={GEO.torusThin} m={mat.trim} p={[0, 0.05, 0]} r={[Math.PI / 2, 0, 0]} s={0.6} />
          </>
        )}
        {look.lower === 'tail' && (
          <>
            <Part g={GEO.cone} m={mat.armor} p={[0, 0.55, 0]} r={[Math.PI, 0, 0]} s={[0.32, 0.9, 0.3]} />
            <group ref={tail} position={[0, 0.15, -0.1]}>
              <Part g={GEO.sphere} m={mat.armor} s={[0.24, 0.16, 0.24]} />
              <Part g={GEO.cone} m={mat.armor} p={[0, 0.0, -0.55]} r={[-Math.PI / 2, 0, 0]} s={[0.2, 1.0, 0.14]} />
              <Part g={GEO.cone} m={mat.trim} p={[0, 0.04, -1.1]} r={[-Math.PI / 2, 0, 0]} s={[0.06, 0.2, 0.06]} />
            </group>
          </>
        )}

        <Part g={GEO.cyl} m={mat.dark} p={[0, 0.98, 0]} s={[0.3, 0.16, 0.22]} />
        <Part g={GEO.box} m={mat.trim} p={[0, 0.98, 0.22]} s={[0.14, 0.11, 0.03]} />

        <group ref={torso} position={[0, 1.0, 0]}>
          <Part g={GEO.box} m={mat.dark} p={[0, 0.14, 0]} s={[0.46, 0.3, 0.3]} />
          <Part g={GEO.sphere} m={mat.armor} p={[0, 0.42, 0]} s={[0.36, 0.33, 0.23]} />
          {enemy.archetype === 'boss_bone_colossus' &&
            [0.3, 0.4, 0.5].map((y) => (
              <Part key={y} g={GEO.rib} m={mat.bone} p={[0, y, 0.06]} r={[Math.PI / 2, 0, -0.175 * Math.PI]} s={[0.3, 0.2, 0.3]} />
            ))}
          <group ref={coreGem} position={[0, 0.45, 0.24]}>
            <Part g={GEO.octa} m={mat.core} s={[0.07, 0.1, 0.04]} />
          </group>
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 0.42, 0.64, 0]}>
              <Part g={GEO.hemi} m={mat.trim} s={[0.2, 0.17, 0.21]} />
              <Part g={GEO.torusThin} m={mat.armor} r={[Math.PI / 2, 0, 0]} s={0.2} />
              {(look.helm === 'horns' || look.helm === 'visor' || look.helm === 'halo') && (
                <>
                  <Part g={GEO.cone} m={mat.trim} p={[side * 0.05, 0.2, 0]} r={[0, 0, -side * 0.35]} s={[0.045, 0.2, 0.045]} />
                  <Part g={GEO.cone} m={mat.trim} p={[side * 0.1, 0.13, -0.08]} r={[-0.3, 0, -side * 0.7]} s={[0.035, 0.15, 0.035]} />
                </>
              )}
            </group>
          ))}

          {look.cape && (
            <group ref={cape} position={[0, 0.66, -0.2]}>
              <Part g={GEO.box} m={mat.cape} p={[0, -0.7, -0.02]} s={[0.78, 1.4, 0.025]} />
              <Part g={GEO.box} m={mat.trim} p={[0, -1.4, -0.02]} s={[0.78, 0.04, 0.03]} />
            </group>
          )}

          <group ref={shL} position={[-0.47, 0.6, 0]}>
            <Part g={GEO.limb} m={mat.armor} s={[0.1, 0.42, 0.1]} />
            <group position={[0, -0.42, 0]} rotation={[-0.35, 0, 0]}>
              <Part g={GEO.sphere} m={mat.trim} s={0.08} />
              <Part g={GEO.limb} m={mat.armor} s={[0.09, 0.38, 0.09]} />
              <Part g={GEO.sphere} m={mat.dark} p={[0, -0.42, 0.02]} s={[0.1, 0.11, 0.11]} />
              {look.weapon === 'orbs' && <Part g={GEO.sphere} m={mat.core} p={[0, -0.55, 0.05]} s={0.11} />}
            </group>
          </group>

          <group ref={shR} position={[0.47, 0.6, 0]}>
            <Part g={GEO.limb} m={mat.armor} s={[0.1, 0.42, 0.1]} />
            <group position={[0, -0.42, 0]} rotation={[-0.35, 0, 0]}>
              <Part g={GEO.sphere} m={mat.trim} s={0.08} />
              <Part g={GEO.limb} m={mat.armor} s={[0.09, 0.38, 0.09]} />
              <Part g={GEO.sphere} m={mat.dark} p={[0, -0.42, 0.02]} s={[0.1, 0.11, 0.11]} />
              <group position={[0, -0.42, 0.04]} rotation={[look.melee ? 1.25 : 0.35, 0, 0]}>
                <BossWeapon weapon={look.weapon} mat={mat} />
              </group>
            </group>
          </group>

          <Part g={GEO.cyl} m={mat.dark} p={[0, 0.76, 0]} s={[0.1, 0.1, 0.1]} />
          <group ref={head} position={[0, 0.8, 0]}>
            {look.helm === 'visor' ? (
              <>
                <Part g={GEO.box} m={mat.armor} p={[0, 0.17, 0]} s={[0.34, 0.38, 0.36]} />
                <Part g={GEO.box} m={mat.glow} p={[0, 0.2, 0.18]} s={[0.26, 0.035, 0.02]} />
                <Part g={GEO.box} m={mat.trim} p={[0, 0.08, 0.181]} s={[0.03, 0.16, 0.02]} />
                <Part g={GEO.cone} m={mat.trim} p={[0, 0.48, -0.05]} r={[-0.5, 0, 0]} s={[0.05, 0.3, 0.12]} />
              </>
            ) : (
              <>
                <Part g={GEO.sphere} m={look.helm === 'horns' ? mat.bone : mat.armor} p={[0, 0.17, 0]} s={[0.19, 0.22, 0.2]} />
                <Part g={GEO.box} m={mat.glow} p={[-0.07, 0.19, 0.185]} s={[0.06, 0.02, 0.02]} />
                <Part g={GEO.box} m={mat.glow} p={[0.07, 0.19, 0.185]} s={[0.06, 0.02, 0.02]} />
              </>
            )}
            {look.helm === 'horns' &&
              [-1, 1].map((side) => (
                <group key={side} position={[side * 0.16, 0.3, 0]} rotation={[0, 0, -side * 0.9]}>
                  <Part g={GEO.cone} m={mat.bone} p={[0, 0.2, 0]} s={[0.07, 0.42, 0.07]} />
                  <Part g={GEO.cone} m={mat.bone} p={[side * -0.06, 0.45, 0]} r={[0, 0, side * 0.9]} s={[0.035, 0.2, 0.035]} />
                </group>
              ))}
            {look.helm === 'crown' && (
              <>
                <Part g={GEO.torusThin} m={mat.trim} p={[0, 0.33, 0]} r={[Math.PI / 2, 0, 0]} s={0.17} />
                {[0, 1, 2, 3, 4, 5].map((i) => {
                  const a = (i / 6) * Math.PI * 2;
                  return <Part key={i} g={GEO.cone} m={mat.trim} p={[Math.sin(a) * 0.16, 0.42, Math.cos(a) * 0.16]} s={[0.03, 0.15, 0.03]} />;
                })}
                <Part g={GEO.octa} m={mat.core} p={[0, 0.36, 0.17]} s={0.035} />
              </>
            )}
            {look.helm === 'snakes' && (
              <group ref={snakes} position={[0, 0.24, -0.02]}>
                {Array.from({length: SNAKES}, (_, i) => {
                  const a = (i / SNAKES) * Math.PI * 1.6 - Math.PI * 0.8;
                  return (
                    <group key={i} rotation={[-0.9 + Math.cos(a) * 0.3, a, 0]} scale={1.5}>
                      <group>
                        <Part g={GEO.limb} m={mat.armor} p={[0, 0, 0]} r={[Math.PI, 0, 0]} s={[0.03, 0.22, 0.03]} />
                        <group position={[0, 0.22, 0]} rotation={[0.7, 0, 0]}>
                          <Part g={GEO.limb} m={mat.armor} r={[Math.PI, 0, 0]} s={[0.025, 0.18, 0.025]} />
                          <Part g={GEO.sphere} m={mat.trim} p={[0, 0.2, 0.02]} s={[0.035, 0.03, 0.05]} />
                          <Part g={GEO.sphereLow} m={mat.glow} p={[0, 0.215, 0.06]} s={0.01} />
                        </group>
                      </group>
                    </group>
                  );
                })}
              </group>
            )}
          </group>
          {look.helm === 'halo' && (
            <group ref={halo} position={[0, 1.05, -0.28]}>
              <Part g={GEO.torus} m={mat.halo} s={0.42} />
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                const a = (i / 8) * Math.PI * 2;
                return <Part key={i} g={GEO.cone} m={mat.halo} p={[Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0]} r={[0, 0, a - Math.PI / 2]} s={[0.04, 0.18, 0.04]} />;
              })}
            </group>
          )}
        </group>
      </group>

      {look.orbs ? (
        <group ref={orbit} position={[0, 1.35, 0]}>
          {Array.from({length: look.orbs}, (_, i) => {
            const a = (i / look.orbs!) * Math.PI * 2;
            return (
              <group key={i} position={[Math.cos(a) * 0.95, Math.sin(a * 2) * 0.15, Math.sin(a) * 0.95]}>
                <Part g={GEO.ico} m={mat.core} s={0.1} />
                <Part g={GEO.sphereLow} m={mat.halo} s={0.16} />
              </group>
            );
          })}
        </group>
      ) : null}
      {children}
    </group>
  );
}

function BossWeapon({weapon, mat}: {weapon: Weapon; mat: Record<string, THREE.Material>}) {
  switch (weapon) {
    case 'club':
      return (
        <>
          <Part g={GEO.cyl} m={mat.bone} p={[0, 0.25, 0]} s={[0.05, 0.8, 0.05]} />
          <Part g={GEO.cyl} m={mat.bone} p={[0, 0.85, 0]} s={[0.15, 0.5, 0.15]} />
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i / 6) * Math.PI * 2;
            return <Part key={i} g={GEO.cone} m={mat.trim} p={[Math.sin(a) * 0.17, 0.85 + (i % 2) * 0.15 - 0.07, Math.cos(a) * 0.17]} r={[Math.cos(a) * 1.57, 0, -Math.sin(a) * 1.57]} s={[0.04, 0.14, 0.04]} />;
          })}
        </>
      );
    case 'staff':
      return (
        <>
          <Part g={GEO.cyl} m={mat.dark} p={[0, 0.4, 0]} s={[0.035, 2.2, 0.035]} />
          <Part g={GEO.torus} m={mat.trim} p={[0, 1.55, 0]} s={0.16} />
          <Part g={GEO.sphere} m={mat.core} p={[0, 1.55, 0]} s={0.11} />
        </>
      );
    case 'spear':
      return (
        <>
          <Part g={GEO.cyl} m={mat.dark} p={[0, 0.5, 0]} s={[0.03, 2.3, 0.03]} />
          <Part g={GEO.cone} m={mat.trim} p={[0, 1.8, 0]} s={[0.07, 0.4, 0.03]} />
          <Part g={GEO.box} m={mat.trim} p={[0, 1.6, 0]} s={[0.22, 0.04, 0.04]} />
        </>
      );
    case 'greatsword':
      return (
        <>
          <Part g={GEO.cyl} m={mat.dark} p={[0, 0, 0]} s={[0.04, 0.34, 0.04]} />
          <Part g={GEO.sphere} m={mat.trim} p={[0, -0.19, 0]} s={0.05} />
          <Part g={GEO.box} m={mat.trim} p={[0, 0.19, 0]} s={[0.46, 0.06, 0.08]} />
          <Part g={GEO.box} m={mat.armor} p={[0, 1.0, 0]} s={[0.13, 1.55, 0.03]} />
          <Part g={GEO.box} m={mat.glow} p={[0, 0.95, 0]} s={[0.025, 1.3, 0.036]} />
          <Part g={GEO.cone} m={mat.armor} p={[0, 1.85, 0]} s={[0.092, 0.16, 0.021]} r={[0, Math.PI / 4, 0]} />
        </>
      );
    default:
      return null;
  }
}
