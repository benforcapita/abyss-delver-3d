import {describe, expect, it} from 'vitest';
import * as THREE from 'three';
import {
  HIT_FLASH_MS,
  applyHitFlash,
  createFlashMap,
  hitFlashAmount,
  holdHitFlashes,
  isHitFlashing,
  pruneHitFlashes,
  triggerHitFlash,
} from './hitFlash';

describe('hit flash timing', () => {
  it('stays on for about 100 ms and is off at the deadline', () => {
    const flashes = createFlashMap();
    triggerHitFlash(flashes, 'mob', 1_000);
    expect(flashes.get('mob')).toBe(1_000 + HIT_FLASH_MS);

    expect(isHitFlashing(flashes, 'mob', 1_000)).toBe(true);
    expect(isHitFlashing(flashes, 'mob', 1_099)).toBe(true);
    expect(isHitFlashing(flashes, 'mob', 1_100)).toBe(false);
    expect(isHitFlashing(flashes, 'other', 1_050)).toBe(false);
  });

  it('ramps intensity from 1 down to 0 across the window', () => {
    const flashes = createFlashMap();
    triggerHitFlash(flashes, 'mob', 0);
    expect(hitFlashAmount(flashes, 'mob', 0)).toBe(1);
    expect(hitFlashAmount(flashes, 'mob', 50)).toBeCloseTo(0.5);
    expect(hitFlashAmount(flashes, 'mob', 100)).toBe(0);
    expect(hitFlashAmount(flashes, 'mob', 250)).toBe(0);
  });

  it('a second hit before the first ends keeps the later deadline', () => {
    const flashes = createFlashMap();
    triggerHitFlash(flashes, 'mob', 0);
    triggerHitFlash(flashes, 'mob', 80);
    expect(isHitFlashing(flashes, 'mob', 150)).toBe(true);
    expect(isHitFlashing(flashes, 'mob', 180)).toBe(false);
  });

  it('a pause holds the remaining window, then unpause consumes it', () => {
    const flashes = createFlashMap();
    triggerHitFlash(flashes, 'mob', 1_000);
    expect(hitFlashAmount(flashes, 'mob', 1_040)).toBeCloseTo(0.6);

    holdHitFlashes(flashes, 500);
    expect(hitFlashAmount(flashes, 'mob', 1_540)).toBeCloseTo(0.6);
    expect(isHitFlashing(flashes, 'mob', 1_599)).toBe(true);
    expect(isHitFlashing(flashes, 'mob', 1_600)).toBe(false);
    expect(hitFlashAmount(flashes, 'mob', 1_600)).toBe(0);
  });

  it('prune drops only expired ids', () => {
    const flashes = createFlashMap();
    triggerHitFlash(flashes, 'a', 0);
    triggerHitFlash(flashes, 'b', 50);
    pruneHitFlashes(flashes, 100);
    expect(flashes.has('a')).toBe(false);
    expect(flashes.has('b')).toBe(true);
  });
});

describe('applyHitFlash', () => {
  it('tints emissive and color white, then restores the material', () => {
    const mat = new THREE.MeshStandardMaterial({
      color: '#224488',
      emissive: '#112233',
      emissiveIntensity: 0.25,
    });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    const group = new THREE.Group();
    group.add(mesh);

    applyHitFlash(group, 1);
    expect(mat.color.getHexString()).toBe('ffffff');
    expect(mat.emissive.getHexString()).toBe('ffffff');
    expect(mat.emissiveIntensity).toBeGreaterThan(1);

    applyHitFlash(group, 1);
    applyHitFlash(group, 0);
    expect(mat.color.getHexString()).toBe('224488');
    expect(mat.emissive.getHexString()).toBe('112233');
    expect(mat.emissiveIntensity).toBeCloseTo(0.25);
  });

  it('tints a basic material color and restores it', () => {
    const mat = new THREE.MeshBasicMaterial({color: '#00ff00'});
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    applyHitFlash(mesh, 1);
    expect(mat.color.getHexString()).toBe('ffffff');
    applyHitFlash(mesh, 0);
    expect(mat.color.getHexString()).toBe('00ff00');
  });
});
