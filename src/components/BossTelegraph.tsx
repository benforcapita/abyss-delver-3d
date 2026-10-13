import * as THREE from 'three';
import type {BossTelegraph as BossTelegraphState} from '../bossTelegraph';
import {telegraphProgress} from '../bossTelegraph';

interface BossTelegraphProps {
  telegraph: BossTelegraphState | null;
}

/**
 * Boss attack telegraph: a flat red warning ring on the ground plus an inner
 * fill disc that grows with windup progress. Positioned in world space at the
 * telegraph's (cx, cz) center.
 */
export function BossTelegraph({telegraph}: BossTelegraphProps) {
  if (!telegraph) return null;
  const progress = telegraphProgress(telegraph);
  const {cx, cz, radius} = telegraph;

  return (
    <group position={[cx, 0.05, cz]}>
      {/* Outer warning ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.85, radius, 48]} />
        <meshBasicMaterial
          color="#ef4444"
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Inner fill disc grows with windup progress */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        scale={Math.max(progress, 0.001)}>
        <circleGeometry args={[radius, 48]} />
        <meshBasicMaterial
          color="#ef4444"
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
