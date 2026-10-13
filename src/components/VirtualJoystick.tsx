import React, {useCallback, useEffect, useRef, useState} from 'react';
import type {MutableRefObject} from 'react';
import {
  JOYSTICK_MIN_PX,
  LAYOUT_GAP,
  MOVE_ZONE_FRACTION,
  joystickDiameter,
  placeFloatingJoystick,
  restingJoystickPosition,
  type Rect,
} from '../controls/layout';
import {
  computeJoystickVector,
  resetJoystickVector,
  type JoystickVector,
} from '../input';

interface VirtualJoystickProps {
  /** Shared ref read by the game loop every frame. */
  moveRef: MutableRefObject<JoystickVector>;
}

interface Viewport {
  width: number;
  height: number;
}

function readViewport(): Viewport {
  if (typeof window === 'undefined') return {width: 664, height: 390};
  return {width: window.innerWidth, height: window.innerHeight};
}

function obstacleRects(origin: DOMRect, zone: HTMLElement): Rect[] {
  const nodes = document.querySelectorAll('[data-layout-obstacle], [data-touch-control]');
  const rects: Rect[] = [];
  nodes.forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    if (zone.contains(node)) return;
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    rects.push({
      x: rect.left - origin.left,
      y: rect.top - origin.top,
      width: rect.width,
      height: rect.height,
    });
  });
  return rects;
}

/**
 * Floating analog stick. A touch anywhere in the left movement zone spawns
 * the base under the thumb. A faint ghost stays at the resting corner.
 * The gesture is torn down on pointerup, pointercancel, blur, and hide.
 */
export function VirtualJoystick({moveRef}: VirtualJoystickProps) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const centerRef = useRef({x: 0, y: 0});
  const boundsRef = useRef<DOMRect | null>(null);
  const diameterRef = useRef(JOYSTICK_MIN_PX);
  const [viewport, setViewport] = useState<Viewport>(readViewport);
  const [vector, setVector] = useState<JoystickVector>({x: 0, y: 0});
  const [active, setActive] = useState(false);
  const [origin, setOrigin] = useState<{x: number; y: number} | null>(null);

  const diameter = joystickDiameter(viewport.width, viewport.height);
  diameterRef.current = diameter;
  const resting = restingJoystickPosition(viewport.width, viewport.height, diameter);
  const stick = active && origin ? origin : resting;

  const endGesture = useCallback(() => {
    pointerIdRef.current = null;
    resetJoystickVector(moveRef.current);
    setVector({x: 0, y: 0});
    setActive(false);
    setOrigin(null);
  }, [moveRef]);

  useEffect(() => {
    const measure = () => {
      const parent = zoneRef.current?.parentElement;
      if (!parent) return;
      const bounds = parent.getBoundingClientRect();
      boundsRef.current = bounds;
      setViewport({width: bounds.width, height: bounds.height});
    };
    measure();
    window.addEventListener('resize', measure);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') endGesture();
    };
    window.addEventListener('blur', endGesture);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('blur', endGesture);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      endGesture();
    };
  }, [endGesture]);

  const writeVector = useCallback(
    (clientX: number, clientY: number) => {
      const bounds = boundsRef.current;
      if (!bounds) return;
      const dx = clientX - (bounds.left + centerRef.current.x);
      const dy = clientY - (bounds.top + centerRef.current.y);
      const next = computeJoystickVector(dx, dy, diameterRef.current / 2);
      moveRef.current.x = next.x;
      moveRef.current.y = next.y;
      setVector(next);
    },
    [moveRef],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== null) return;
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    const zone = zoneRef.current;
    const parent = zone?.parentElement;
    if (!zone || !parent) return;
    const bounds = parent.getBoundingClientRect();
    boundsRef.current = bounds;
    const size = joystickDiameter(bounds.width, bounds.height);
    diameterRef.current = size;
    const localX = event.clientX - bounds.left;
    const localY = event.clientY - bounds.top;
    const placed = placeFloatingJoystick(
      localX,
      localY,
      size,
      {width: bounds.width, height: bounds.height},
      obstacleRects(bounds, zone),
      LAYOUT_GAP,
    );
    centerRef.current = {x: placed.x + size / 2, y: placed.y + size / 2};
    pointerIdRef.current = event.pointerId;
    setViewport({width: bounds.width, height: bounds.height});
    setOrigin(placed);
    setActive(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic or already-released pointers may not be capturable.
    }
    writeVector(event.clientX, event.clientY);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointerIdRef.current) return;
    writeVector(event.clientX, event.clientY);
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointerIdRef.current) return;
    endGesture();
  };

  const handleLostPointerCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) return;
    endGesture();
  };

  const knobTravel = Math.max(8, diameter / 2 - 24);
  const spawnX = boundsRef.current ? boundsRef.current.left + stick.x + diameter / 2 : stick.x + diameter / 2;
  const spawnY = boundsRef.current ? boundsRef.current.top + stick.y + diameter / 2 : stick.y + diameter / 2;

  return (
    <div
      ref={zoneRef}
      data-testid="mobile-move-zone"
      className="absolute inset-y-0 left-0 z-30 pointer-events-auto touch-none"
      style={{width: `${MOVE_ZONE_FRACTION * 100}%`}}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handleLostPointerCapture}>
      {active && (
        <div
          aria-hidden="true"
          data-testid="mobile-joystick-ghost"
          className="absolute rounded-full border-2 border-zinc-700/50 bg-black/30 pointer-events-none"
          style={{
            left: resting.x,
            top: resting.y,
            width: diameter,
            height: diameter,
          }}
        />
      )}
      <div
        data-testid="mobile-joystick"
        data-touch-control="true"
        data-active={active ? 'true' : 'false'}
        data-vector={`${vector.x},${vector.y}`}
        data-spawn-x={Math.round(spawnX)}
        data-spawn-y={Math.round(spawnY)}
        className="pointer-events-none absolute rounded-full border-2 border-zinc-700/70 bg-black/60 shadow-xl touch-none select-none"
        style={{
          left: stick.x,
          top: stick.y,
          width: diameter,
          height: diameter,
          opacity: active ? 1 : 0.45,
        }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[9px] font-bold tracking-widest text-zinc-500">MOVE</span>
        </div>
        <div
          data-testid="mobile-joystick-knob"
          className="absolute left-1/2 top-1/2 w-12 h-12 rounded-full bg-gradient-to-tr from-amber-600 to-yellow-400 border-2 border-white/80 shadow-lg"
          style={{
            transform: `translate(-50%, -50%) translate(${vector.x * knobTravel}px, ${
              -vector.y * knobTravel
            }px)`,
          }}
        />
      </div>
    </div>
  );
}
