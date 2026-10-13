import {useEffect, useRef, type MutableRefObject, type RefObject} from 'react';
import {actionsForCode, type BindableAction} from './platform/keybindings';
import {getSettings} from './platform/settings';
import {pointerDownAttacks} from './pointerAttack';

/** Actions that can be triggered by the user. */
export type InputAction =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'confirm'
  | 'cancel'
  | 'tap';

/** Represents the state of the pointer (mouse/touch). */
export interface PointerState {
  /** Pointer position in NDC (-1..1) for raycasting. */
  nx: number;
  ny: number;
  /** Pointer position in client pixels (relative to container). */
  clientX: number;
  clientY: number;
  down: boolean;
}

/** Snapshot of the input state at a given frame. */
export interface InputSnapshot {
  actions: Record<InputAction, boolean>;
  pointer: PointerState;
}

/** Bindable game actions that feed the per-frame snapshot. */
const BOUND_TO_INPUT: Partial<Record<BindableAction, InputAction>> = {
  moveUp: 'up',
  moveDown: 'down',
  moveLeft: 'left',
  moveRight: 'right',
  attack: 'confirm',
};

/** Resolve a bound code (KeyboardEvent.code or 'Mouse0') to an InputAction. */
function inputActionForCode(code: string): InputAction | undefined {
  for (const bound of actionsForCode(getSettings().keyBindings, code)) {
    const action = BOUND_TO_INPUT[bound];
    if (action) return action;
  }
  return undefined;
}

/** Resolve a key event to an InputAction using the live key bindings. */
function inputActionFor(event: KeyboardEvent): InputAction | undefined {
  if (event.code === 'Escape' || event.key === 'Escape') return 'cancel';
  return inputActionForCode(event.code);
}

function createEmptyActions(): Record<InputAction, boolean> {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    confirm: false,
    cancel: false,
    tap: false,
  };
}

/** Normalized analog joystick output. y = +1 means pushed up (forward). */
export interface JoystickVector {
  x: number;
  y: number;
}

/** Fraction of the stick radius treated as dead zone around the center. */
export const JOYSTICK_DEAD_ZONE = 0.12;

/**
 * Converts a pointer offset (px) from the joystick center into a normalized
 * analog vector. Magnitude is 0 inside the dead zone, scales linearly up to
 * the radius, and clamps to 1 beyond it so diagonal pushes never exceed a
 * unit vector.
 */
export function computeJoystickVector(
  dx: number,
  dy: number,
  radius: number,
  deadZone: number = JOYSTICK_DEAD_ZONE,
): JoystickVector {
  if (!(radius > 0)) return {x: 0, y: 0};
  const nx = dx / radius;
  // Screen Y grows downward; joystick "up" must map to forward (+y).
  const ny = -dy / radius;
  const magnitude = Math.hypot(nx, ny);
  if (magnitude === 0 || magnitude <= deadZone) return {x: 0, y: 0};
  const clamped = Math.min(1, magnitude);
  return {x: (nx / magnitude) * clamped, y: (ny / magnitude) * clamped};
}

/** Zeroes a joystick vector in place (used by every reset path). */
export function resetJoystickVector(target: JoystickVector): void {
  target.x = 0;
  target.y = 0;
}

/**
 * Converts a pointer event on the renderer container to NDC coordinates (-1..1).
 * These can be passed directly to raycastGround() or Raycaster.setFromCamera().
 */
function getPointerNDC(
  event: PointerEvent,
  container: HTMLElement,
): {nx: number; ny: number; clientX: number; clientY: number} {
  const rect = container.getBoundingClientRect();
  const clientX = event.clientX - rect.left;
  const clientY = event.clientY - rect.top;
  const nx = (clientX / rect.width) * 2 - 1;
  const ny = -(clientY / rect.height) * 2 + 1;
  return {nx, ny, clientX, clientY};
}

/**
 * Unified input hook for 3D games.
 *
 * pointer.nx / pointer.ny are in NDC (-1..1) — ready for raycasting.
 * Keyboard inputs are handled.
 *
 * Works both with the R3F Canvas container and standalone divs.
 *
 * @param containerRef — ref to the div wrapping the Canvas / renderer
 * @param options — configuration options (enabled: disable input when game is paused / in menus)
 */
export function useInput(
  containerRef: RefObject<HTMLDivElement | null>,
  options: {enabled?: boolean} = {},
): MutableRefObject<InputSnapshot> {
  const {enabled = true} = options;
  const inputRef = useRef<InputSnapshot>({
    actions: createEmptyActions(),
    pointer: {nx: 0, ny: 0, clientX: 0, clientY: 0, down: false},
  });

  useEffect(() => {
    if (!enabled) {
      inputRef.current.actions = createEmptyActions();
      inputRef.current.pointer = {
        nx: 0,
        ny: 0,
        clientX: 0,
        clientY: 0,
        down: false,
      };
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const action = inputActionFor(event);
      if (!action) return;
      inputRef.current.actions[action] = true;
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const action = inputActionFor(event);
      if (!action) return;
      inputRef.current.actions[action] = false;
    };

    const container = containerRef.current;
    const handlePointerDown = (event: PointerEvent) => {
      if (!container) return;
      const pos = getPointerNDC(event, container);
      inputRef.current.pointer = {...pos, down: true};
      const locked = document.pointerLockElement != null;
      // Pointer-lock gate (#34): the click that acquires pointer lock never attacks.
      if (
        !pointerDownAttacks({
          pointerType: event.pointerType,
          pointerLocked: locked,
        })
      ) {
        return;
      }
      if (event.pointerType === 'mouse') {
        // The left button acts as the bound 'Mouse0' key.
        if (event.button === 0) {
          const action = inputActionForCode('Mouse0');
          if (action) inputRef.current.actions[action] = true;
        }
      } else {
        inputRef.current.actions.tap = true;
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!container) return;
      const pos = getPointerNDC(event, container);
      inputRef.current.pointer = {...pos, down: inputRef.current.pointer.down};
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!container) return;
      const pos = getPointerNDC(event, container);
      inputRef.current.pointer = {...pos, down: false};
      if (event.pointerType === 'mouse') {
        if (event.button === 0 || event.type === 'pointercancel') {
          const action = inputActionForCode('Mouse0');
          if (action) inputRef.current.actions[action] = false;
        }
      } else {
        inputRef.current.actions.tap = false;
      }
    };

    const handleBlur = () => {
      inputRef.current.actions = createEmptyActions();
      inputRef.current.pointer = {
        nx: 0,
        ny: 0,
        clientX: 0,
        clientY: 0,
        down: false,
      };
      inputRef.current.actions.tap = false;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleBlur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (container) {
      container.addEventListener('pointerdown', handlePointerDown);
      container.addEventListener('pointermove', handlePointerMove);
      container.addEventListener('pointerup', handlePointerUp);
      container.addEventListener('pointercancel', handlePointerUp);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (container) {
        container.removeEventListener('pointerdown', handlePointerDown);
        container.removeEventListener('pointermove', handlePointerMove);
        container.removeEventListener('pointerup', handlePointerUp);
        container.removeEventListener('pointercancel', handlePointerUp);
      }
    };
  }, [containerRef, enabled]);

  return inputRef;
}
