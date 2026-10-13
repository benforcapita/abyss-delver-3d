import React, {useCallback, useEffect, useRef, useState} from 'react';
import type {MutableRefObject} from 'react';
import {
  computeJoystickVector,
  resetJoystickVector,
  type JoystickVector,
} from '../input';

interface VirtualJoystickProps {
  /** Shared ref read by the game loop every frame. */
  moveRef: MutableRefObject<JoystickVector>;
  /** Outer base diameter in px. */
  size?: number;
}

/**
 * Analog thumb joystick for touch devices.
 *
 * The knob tracks a single captured pointer and writes a normalized vector
 * into `moveRef` (x = strafe, y = forward). The gesture is torn down — and
 * the vector zeroed — on pointerup, pointercancel, lostpointercapture,
 * window blur, and when the document becomes hidden, so movement can never
 * get stuck if a pointer event is dropped by the browser or OS.
 */
export function VirtualJoystick({moveRef, size = 112}: VirtualJoystickProps) {
  const baseRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [vector, setVector] = useState<JoystickVector>({x: 0, y: 0});
  const [active, setActive] = useState(false);

  const endGesture = useCallback(() => {
    pointerIdRef.current = null;
    resetJoystickVector(moveRef.current);
    setVector({x: 0, y: 0});
    setActive(false);
  }, [moveRef]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') endGesture();
    };
    window.addEventListener('blur', endGesture);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('blur', endGesture);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Unmounting mid-gesture must not leave a stale vector behind.
      endGesture();
    };
  }, [endGesture]);

  const updateVector = useCallback(
    (clientX: number, clientY: number) => {
      const el = baseRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const v = computeJoystickVector(
        clientX - (rect.left + rect.width / 2),
        clientY - (rect.top + rect.height / 2),
        rect.width / 2,
      );
      moveRef.current.x = v.x;
      moveRef.current.y = v.y;
      setVector(v);
    },
    [moveRef],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== null) return;
    pointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic or already-released pointers may not be capturable.
    }
    setActive(true);
    updateVector(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== pointerIdRef.current) return;
    updateVector(e.clientX, e.clientY);
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== pointerIdRef.current) return;
    endGesture();
  };

  const handleLostPointerCapture = (
    e: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (pointerIdRef.current !== null && e.pointerId !== pointerIdRef.current)
      return;
    endGesture();
  };

  const knobTravel = size / 2 - 24;

  return (
    <div
      ref={baseRef}
      data-testid="mobile-joystick"
      data-active={active ? 'true' : 'false'}
      data-vector={`${vector.x},${vector.y}`}
      className="pointer-events-auto relative rounded-full bg-black/60 border-2 border-zinc-700/70 shadow-xl touch-none select-none"
      style={{width: size, height: size}}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handleLostPointerCapture}>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-[9px] font-bold tracking-widest text-zinc-500">
          MOVE
        </span>
      </div>
      <div
        data-testid="mobile-joystick-knob"
        className="absolute left-1/2 top-1/2 w-12 h-12 rounded-full bg-gradient-to-tr from-amber-600 to-yellow-400 border-2 border-white/80 shadow-lg pointer-events-none"
        style={{
          transform: `translate(-50%, -50%) translate(${
            vector.x * knobTravel
          }px, ${-vector.y * knobTravel}px)`,
        }}
      />
    </div>
  );
}
