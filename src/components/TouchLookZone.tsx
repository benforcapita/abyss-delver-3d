import React, {useCallback, useEffect, useRef, useState} from 'react';
import type {MutableRefObject} from 'react';
import {shouldStartLook, type Rect} from '../controls/layout';

interface TouchLookZoneProps {
  deltaRef: MutableRefObject<{dx: number; dy: number}>;
}

function blockedClientRects(): Rect[] {
  const nodes = document.querySelectorAll('[data-touch-control], [data-layout-obstacle]');
  const rects: Rect[] = [];
  nodes.forEach((node) => {
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    rects.push({x: rect.left, y: rect.top, width: rect.width, height: rect.height});
  });
  return rects;
}

/**
 * Drag-to-look pad for the right half of the screen.
 * Touches that land on a control or HUD obstacle never start a look drag,
 * so a button press cannot rotate the camera.
 */
export function TouchLookZone({deltaRef}: TouchLookZoneProps) {
  const pointerIdRef = useRef<number | null>(null);
  const lastRef = useRef<{x: number; y: number} | null>(null);
  const [looking, setLooking] = useState(false);

  const endLook = useCallback(() => {
    pointerIdRef.current = null;
    lastRef.current = null;
    setLooking(false);
  }, []);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') endLook();
    };
    window.addEventListener('blur', endLook);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('blur', endLook);
      document.removeEventListener('visibilitychange', onHide);
      endLook();
    };
  }, [endLook]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== null) return;
    const target = event.target;
    if (target instanceof Element && target.closest('[data-touch-control], [data-layout-obstacle]')) {
      return;
    }
    if (!shouldStartLook(event.clientX, event.clientY, blockedClientRects())) return;
    pointerIdRef.current = event.pointerId;
    lastRef.current = {x: event.clientX, y: event.clientY};
    setLooking(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointers may not be capturable.
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointerIdRef.current || !lastRef.current) return;
    const dx = event.clientX - lastRef.current.x;
    const dy = event.clientY - lastRef.current.y;
    deltaRef.current = {dx, dy};
    lastRef.current = {x: event.clientX, y: event.clientY};
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointerIdRef.current) return;
    endLook();
  };

  return (
    <div
      data-testid="touch-look"
      data-looking={looking ? 'true' : 'false'}
      className="absolute inset-y-0 right-0 w-1/2 z-10 pointer-events-auto touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    />
  );
}
