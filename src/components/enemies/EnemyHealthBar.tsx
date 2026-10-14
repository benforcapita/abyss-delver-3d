import {useFrame} from '@react-three/fiber';
import {useMemo, useRef} from 'react';
import * as THREE from 'three';
import type {EnemyEntity} from '../../types';
import type {AnimClock} from './shared';

/** Seconds the bar stays fully visible after the latest hit, then it fades. */
export const HEALTH_BAR_SHOW_S = 3;
const FADE_S = 0.5;
const WIDTH = 1.0;
const HEIGHT = 0.11;

/** World height (before enemy.scale) of the bar above each archetype's feet. */
function barHeight(enemy: EnemyEntity): number {
  if (enemy.isBoss) return 2.55;
  if (enemy.archetype === 'slime') return 1.15;
  return 2.1;
}

const plane = new THREE.PlaneGeometry(1, 1);

/**
 * Billboarded health bar that pops up over an enemy when it takes damage:
 * a red fill that drops instantly plus a pale "recent damage" chip that
 * drains after it. Driven per frame from the mutable enemy; no React renders.
 */
export function EnemyHealthBar({enemy, clock}: {enemy: EnemyEntity; clock: AnimClock}) {
  const group = useRef<THREE.Group>(null);
  const fill = useRef<THREE.Mesh>(null);
  const chip = useRef<THREE.Mesh>(null);
  const state = useRef({lastHp: enemy.hp, shown: 0, chipFrac: 1});

  const mats = useMemo(
    () => ({
      frame: new THREE.MeshBasicMaterial({color: '#09090b', transparent: true, depthWrite: false, toneMapped: false}),
      back: new THREE.MeshBasicMaterial({color: '#3f0d0d', transparent: true, depthWrite: false, toneMapped: false}),
      chip: new THREE.MeshBasicMaterial({color: '#fde68a', transparent: true, depthWrite: false, toneMapped: false}),
      fill: new THREE.MeshBasicMaterial({color: '#ef4444', transparent: true, depthWrite: false, toneMapped: false}),
    }),
    [],
  );

  useFrame(({camera}) => {
    const delta = clock.dt;
    const g = group.current;
    if (!g || !fill.current || !chip.current) return;
    const s = state.current;
    if (enemy.hp < s.lastHp) s.shown = HEALTH_BAR_SHOW_S + FADE_S;
    s.lastHp = enemy.hp;
    s.shown = Math.max(0, s.shown - delta);

    const alpha = enemy.hp > 0 ? Math.min(1, s.shown / FADE_S) : 0;
    g.visible = alpha > 0;
    if (!g.visible) return;

    const frac = THREE.MathUtils.clamp(enemy.hp / enemy.maxHp, 0, 1);
    // The chip lingers briefly, then catches up with the real HP.
    if (s.chipFrac < frac) s.chipFrac = frac;
    else if (s.shown < HEALTH_BAR_SHOW_S + FADE_S - 0.35) s.chipFrac = Math.max(frac, s.chipFrac - delta * 0.8);

    const scale = enemy.isBoss ? 1.6 : 1;
    g.position.set(enemy.pos[0], barHeight(enemy) * enemy.scale, enemy.pos[2]);
    g.quaternion.copy(camera.quaternion);
    g.scale.setScalar(scale);

    const inner = WIDTH - 0.04;
    fill.current.scale.set(Math.max(0.0001, inner * frac), HEIGHT - 0.04, 1);
    fill.current.position.x = (-inner + inner * frac) / 2;
    chip.current.scale.set(Math.max(0.0001, inner * s.chipFrac), HEIGHT - 0.04, 1);
    chip.current.position.x = (-inner + inner * s.chipFrac) / 2;
    mats.fill.color.set(frac > 0.5 ? '#ef4444' : frac > 0.25 ? '#f97316' : '#dc2626');
    for (const m of Object.values(mats)) m.opacity = alpha * (m === mats.frame ? 0.85 : 1);
  });

  return (
    <group ref={group} visible={false}>
      <mesh geometry={plane} material={mats.frame} scale={[WIDTH + 0.04, HEIGHT + 0.04, 1]} renderOrder={10} />
      <mesh geometry={plane} material={mats.back} scale={[WIDTH - 0.04, HEIGHT - 0.04, 1]} position={[0, 0, 0.001]} renderOrder={11} />
      <mesh ref={chip} geometry={plane} material={mats.chip} position={[0, 0, 0.002]} renderOrder={12} />
      <mesh ref={fill} geometry={plane} material={mats.fill} position={[0, 0, 0.003]} renderOrder={13} />
    </group>
  );
}
