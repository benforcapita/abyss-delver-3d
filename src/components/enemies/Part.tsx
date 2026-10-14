import type * as THREE from 'three';

type V3 = [number, number, number];

/** Compact mesh: shared unit geometry `g`, instance material `m`, transform via p/s/r. */
export function Part({
  g,
  m,
  p,
  s,
  r,
}: {
  g: THREE.BufferGeometry;
  m: THREE.Material;
  p?: V3;
  s?: V3 | number;
  r?: V3;
}) {
  return <mesh geometry={g} material={m} position={p} scale={s} rotation={r} />;
}
