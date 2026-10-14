import {useFrame} from '@react-three/fiber';
import {memo, useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {gridToWorld, TILE_SIZE} from '../navigation';
import type {DungeonFloorData, Position3D} from '../types';

const WALL_HEIGHT = 5;

// Procedural Cobblestone Texture Generator
function createDungeonCobblestoneTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#1e1e24';
    ctx.fillRect(0, 0, 512, 512);

    // Stone tiles
    const rows = 16;
    const cols = 16;
    const tileW = 512 / cols;
    const tileH = 512 / rows;

    for (let r = 0; r < rows; r++) {
      const offsetX = (r % 2) * (tileW / 2);
      for (let c = -1; c < cols + 1; c++) {
        const x = c * tileW + offsetX + 2;
        const y = r * tileH + 2;
        const shade = Math.floor(35 + Math.random() * 25);
        ctx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 5})`;
        ctx.fillRect(x, y, tileW - 4, tileH - 4);

        // Edge highlights
        ctx.strokeStyle = `rgba(255, 255, 255, 0.08)`;
        ctx.strokeRect(x, y, tileW - 4, tileH - 4);

        // Cracks & noise
        for (let n = 0; n < 4; n++) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
          ctx.fillRect(
            x + Math.random() * (tileW - 8),
            y + Math.random() * (tileH - 8),
            Math.random() * 6,
            Math.random() * 6,
          );
        }
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12);
  texture.anisotropy = 8;
  return texture;
}

// Procedural Wall Brick Texture Generator
function createDungeonWallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#14141a';
    ctx.fillRect(0, 0, 512, 512);

    const rows = 12;
    const cols = 8;
    const tileW = 512 / cols;
    const tileH = 512 / rows;

    for (let r = 0; r < rows; r++) {
      const offsetX = (r % 2) * (tileW / 2);
      for (let c = -1; c < cols + 1; c++) {
        const x = c * tileW + offsetX + 3;
        const y = r * tileH + 3;
        const shade = Math.floor(40 + Math.random() * 30);
        ctx.fillStyle = `rgb(${shade + 5}, ${shade}, ${shade - 5})`;
        ctx.fillRect(x, y, tileW - 6, tileH - 6);

        // Mortar lines
        ctx.strokeStyle = '#0a0a0d';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, tileW - 6, tileH - 6);
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1.25);
  texture.anisotropy = 8;
  return texture;
}

const scratch = new THREE.Object3D();

/** One draw call for many copies of the same mesh. */
function Instances({
  geometry,
  material,
  transforms,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  transforms: {p: Position3D; s?: Position3D}[];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    transforms.forEach(({p, s}, i) => {
      scratch.position.set(p[0], p[1], p[2]);
      scratch.scale.set(s?.[0] ?? 1, s?.[1] ?? 1, s?.[2] ?? 1);
      scratch.updateMatrix();
      mesh.setMatrixAt(i, scratch.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [transforms]);
  if (transforms.length === 0) return null;
  return <instancedMesh ref={ref} args={[geometry, material, transforms.length]} receiveShadow />;
}

/**
 * Static dungeon geometry: floor, ceiling, walls, pillars and torches.
 * Memoized on `floorData` so the per-frame game loop never re-renders it, and
 * walls/pillars are instanced (a few draw calls instead of hundreds).
 */
export const DungeonLevel = memo(function DungeonLevel({floorData}: {floorData: DungeonFloorData}) {
  const res = useMemo(() => {
    const floorTex = createDungeonCobblestoneTexture();
    const ceilTex = floorTex.clone();
    ceilTex.repeat.set(8, 8);
    const wallTex = createDungeonWallTexture();
    return {
      floorTex,
      ceilTex,
      wallGeo: new THREE.BoxGeometry(TILE_SIZE, WALL_HEIGHT, TILE_SIZE),
      wallMat: new THREE.MeshStandardMaterial({map: wallTex, roughness: 0.9, metalness: 0.1}),
      pillarGeo: new THREE.CylinderGeometry(0.5, 0.6, WALL_HEIGHT, 14),
      pillarMat: new THREE.MeshStandardMaterial({color: '#2d2d34', roughness: 0.9}),
      capGeo: new THREE.BoxGeometry(1.4, 0.4, 1.4),
      baseGeo: new THREE.BoxGeometry(1.3, 0.35, 1.3),
      capMat: new THREE.MeshStandardMaterial({color: '#1e1e24', roughness: 0.8}),
    };
  }, []);

  const n = floorData.gridSize;
  const walls = useMemo(() => {
    const out: {p: Position3D}[] = [];
    floorData.tiles.forEach((row, gx) =>
      row.forEach((cell, gz) => {
        if (cell === 2) out.push({p: [gridToWorld(gx, n), WALL_HEIGHT / 2, gridToWorld(gz, n)]});
      }),
    );
    return out;
  }, [floorData, n]);
  const pillars = useMemo(() => floorData.pillars.map((p) => ({p: [p[0], WALL_HEIGHT / 2, p[2]] as Position3D})), [floorData]);
  const caps = useMemo(() => floorData.pillars.map((p) => ({p: [p[0], WALL_HEIGHT - 0.2, p[2]] as Position3D})), [floorData]);
  const bases = useMemo(() => floorData.pillars.map((p) => ({p: [p[0], 0.17, p[2]] as Position3D})), [floorData]);

  const size = n * TILE_SIZE;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-TILE_SIZE / 2, 0, -TILE_SIZE / 2]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial map={res.floorTex} roughness={0.85} metalness={0.1} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[-TILE_SIZE / 2, WALL_HEIGHT, -TILE_SIZE / 2]}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial map={res.ceilTex} color="#5a5560" roughness={0.95} />
      </mesh>

      <Instances geometry={res.wallGeo} material={res.wallMat} transforms={walls} />
      <Instances geometry={res.pillarGeo} material={res.pillarMat} transforms={pillars} />
      <Instances geometry={res.capGeo} material={res.capMat} transforms={caps} />
      <Instances geometry={res.baseGeo} material={res.capMat} transforms={bases} />

      {floorData.torches.map((pos, i) => (
        <Torch key={`torch_${i}`} pos={pos} seed={i} />
      ))}
    </group>
  );
});

/** Wall torch with a flickering flame and light (intensity changes never recompile shaders). */
function Torch({pos, seed}: {pos: Position3D; seed: number}) {
  const light = useRef<THREE.PointLight>(null);
  const flame = useRef<THREE.Group>(null);
  useFrame(({clock}) => {
    const t = clock.elapsedTime + seed * 1.7;
    const f = 0.85 + Math.sin(t * 9.1) * 0.06 + Math.sin(t * 23.7) * 0.05 + Math.sin(t * 4.3) * 0.04;
    if (light.current) light.current.intensity = 18 * f;
    if (flame.current) {
      flame.current.scale.set(1, 0.8 + f * 0.35, 1);
      flame.current.rotation.z = Math.sin(t * 7) * 0.08;
    }
  });
  return (
    <group position={pos}>
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.06, 0.035, 0.45, 8]} />
        <meshStandardMaterial color="#5b3416" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.17, 0]}>
        <cylinderGeometry args={[0.09, 0.06, 0.08, 8]} />
        <meshStandardMaterial color="#3f3f46" metalness={0.8} roughness={0.4} />
      </mesh>
      <group ref={flame} position={[0, 0.22, 0]}>
        <mesh position={[0, 0.1, 0]}>
          <coneGeometry args={[0.08, 0.26, 10]} />
          <meshBasicMaterial color="#ffb347" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.06, 0]}>
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshBasicMaterial color="#ff7a1a" toneMapped={false} />
        </mesh>
      </group>
      <pointLight ref={light} position={[0, 0.35, 0]} intensity={18} distance={9} decay={1.4} color="#ff8c00" />
    </group>
  );
}
