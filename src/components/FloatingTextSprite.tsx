import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { textOpacity } from '../floatingText';
import type { FloatingText } from '../types';

/** Billboard sprite drawing one floating text via a canvas texture. */
export function FloatingTextSprite({ ft }: { ft: FloatingText }) {
  const { texture, aspect } = useMemo(() => {
    const font = `900 ${ft.isCrit ? 56 : 44}px sans-serif`;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let w = 256;
    const h = 72;
    if (ctx) {
      ctx.font = font;
      w = Math.ceil(ctx.measureText(ft.text).width) + 24;
    }
    canvas.width = w;
    canvas.height = h;
    if (ctx) {
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(ft.text, w / 2, h / 2);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, w / 2, h / 2);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { texture: tex, aspect: w / h };
  }, [ft.text, ft.color, ft.isCrit]);

  useEffect(() => () => texture.dispose(), [texture]);

  const height = 0.45 * ft.scale;
  return (
    <sprite position={ft.pos} scale={[height * aspect, height, 1]} renderOrder={999}>
      <spriteMaterial
        map={texture}
        transparent
        opacity={textOpacity(ft)}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  );
}
