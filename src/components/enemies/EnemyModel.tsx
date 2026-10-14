import {useFrame} from '@react-three/fiber';
import {memo, useMemo, useRef} from 'react';
import * as THREE from 'three';
import type {EnemyEntity} from '../../types';
import {BossModel} from './BossModel';
import {CultistModel} from './CultistModel';
import {EnemyHealthBar} from './EnemyHealthBar';
import {GEO, type AnimClock} from './shared';
import {SkeletonModel} from './SkeletonModel';
import {SlimeModel} from './SlimeModel';

interface EnemyModelProps {
  enemy: EnemyEntity;
  clock: AnimClock;
  /** Registers/unregisters the node that hit flash should tint. */
  registerFlash: (id: string, node: THREE.Object3D | null) => void;
}

/**
 * One enemy. Memoized on the (mutable, stable) enemy object: every transform
 * and animation is driven imperatively in useFrame, so React never needs to
 * re-render it while the enemy lives.
 */
export const EnemyModel = memo(function EnemyModel({enemy, clock, registerFlash}: EnemyModelProps) {
  const ring = <WindupRing enemy={enemy} />;
  const Model = enemy.isBoss
    ? BossModel
    : enemy.archetype === 'cultist'
      ? CultistModel
      : enemy.archetype === 'slime'
        ? SlimeModel
        : SkeletonModel;
  return (
    <>
      <group
        ref={(node) => {
          if (node) node.userData.adFlashId = enemy.id;
          registerFlash(enemy.id, node);
        }}>
        <Model enemy={enemy} clock={clock}>
          {!enemy.isBoss && ring}
        </Model>
      </group>
      {/* Outside the flash group so hit flash doesn't tint the bar white. */}
      <EnemyHealthBar enemy={enemy} clock={clock} />
    </>
  );
});

/** Ground ring that expands to the enemy's reach during a (non-boss) attack windup. */
function WindupRing({enemy}: {enemy: EnemyEntity}) {
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ef4444',
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const active = enemy.state === 'windup' && enemy.telegraphTimer > 0;
    mesh.visible = active;
    if (!active) return;
    const progress = THREE.MathUtils.clamp(1 - enemy.telegraphTimer / 0.5, 0.05, 1);
    mesh.scale.setScalar((enemy.attackRange * progress) / enemy.scale);
    material.opacity = 0.35 + progress * 0.45;
  });
  return (
    <mesh ref={ref} geometry={GEO.ring} material={material} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false} />
  );
}
