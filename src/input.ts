import {useEffect, useRef, type MutableRefObject, type RefObject} from 'react';
import {actionsForCode, type BindableAction} from './platform/keybindings';
import {getSettings} from './platform/settings';

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

/** Resolve a key event to an InputAction using the live key bindings. */
function inputActionFor(event: KeyboardEvent): InputAction | undefined {
  if (event.code === 'Escape' || event.key === 'Escape') return 'cancel';
  for (const bound of actionsForCode(getSettings().keyBindings, event.code)) {
    const action = BOUND_TO_INPUT[bound];
    if (action) return action;
  }
  return undefined;
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
      inputRef.current.actions.tap = true;
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
      inputRef.current.actions.tap = false;
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
