import {Flame, Heart, Sparkles, Sword, Zap} from 'lucide-react';
import React, {useEffect, useState} from 'react';
import type {RefObject} from 'react';
import {
  CLUSTER_INSET,
  layoutActionCluster,
  type ActionButtonId,
} from '../controls/layout';

interface ActionButtonsProps {
  onAttack: () => void;
  onSpell: () => void;
  onDash: () => void;
  onInteract: () => void;
  onPotion: () => void;
  potions: number;
  /** Written by the game loop. OPEN is shown only while this is true. */
  interactAvailableRef?: RefObject<boolean>;
}

const BTN =
  'pointer-events-auto absolute active:scale-95 rounded-full font-bold flex flex-col items-center justify-center shadow-lg touch-none select-none box-border';

const STYLE: Record<ActionButtonId, string> = {
  slash:
    'bg-gradient-to-tr from-amber-600 to-yellow-400 text-black border-2 border-white shadow-2xl',
  dash: 'bg-emerald-950/80 border-2 border-emerald-500 text-emerald-300',
  spell: 'bg-sky-950/80 border-2 border-sky-400 text-sky-200',
  potion: 'bg-red-950/80 border-2 border-red-500 text-red-200',
  open: 'bg-amber-900/80 border-2 border-amber-500 text-amber-300',
};

/**
 * Touch action cluster. SLASH is the corner button, DASH sits on its inner
 * side, and OPEN appears only while a chest or shrine is in range.
 * Buttons fire on pointerdown and stop the event so the look pad cannot
 * treat the press as a camera drag.
 */
export function ActionButtons({
  onAttack,
  onSpell,
  onDash,
  onInteract,
  onPotion,
  potions,
  interactAvailableRef,
}: ActionButtonsProps) {
  const [showOpen, setShowOpen] = useState(false);

  useEffect(() => {
    const ref = interactAvailableRef;
    if (!ref) return;
    const tick = () => {
      const next = Boolean(ref.current);
      setShowOpen((prev) => (prev === next ? prev : next));
    };
    tick();
    const id = window.setInterval(tick, 150);
    return () => window.clearInterval(id);
  }, [interactAvailableRef]);

  const press = (fn: () => void) => (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    fn();
  };

  const cluster = layoutActionCluster(showOpen);
  const handlers: Record<ActionButtonId, () => void> = {
    slash: onAttack,
    dash: onDash,
    spell: onSpell,
    potion: onPotion,
    open: onInteract,
  };
  const testIds: Record<ActionButtonId, string> = {
    slash: 'btn-attack',
    dash: 'btn-dash',
    spell: 'btn-spell',
    potion: 'btn-potion',
    open: 'btn-interact',
  };

  return (
    <div
      data-testid="action-buttons"
      className="pointer-events-none absolute z-30"
      style={{
        right: `max(${CLUSTER_INSET.right}px, env(safe-area-inset-right, 0px))`,
        bottom: `max(${CLUSTER_INSET.bottom}px, env(safe-area-inset-bottom, 0px))`,
        width: cluster.width,
        height: cluster.height,
      }}>
      {cluster.buttons.map((button) => (
        <button
          key={button.id}
          type="button"
          data-testid={testIds[button.id]}
          data-touch-control="true"
          data-layout-obstacle="true"
          onPointerDown={press(handlers[button.id])}
          className={`${BTN} ${STYLE[button.id]}`}
          style={{
            left: button.x,
            top: button.y,
            width: button.size,
            height: button.size,
          }}>
          {button.id === 'slash' && (
            <>
              <Sword className="w-6 h-6 fill-black" />
              <span className="text-[9px] font-black">SLASH</span>
            </>
          )}
          {button.id === 'dash' && (
            <>
              <Zap className="w-4 h-4" />
              <span className="text-[8px]">DASH</span>
            </>
          )}
          {button.id === 'spell' && (
            <>
              <Flame className="w-4 h-4 fill-sky-400" />
              <span className="text-[8px]">SPELL</span>
            </>
          )}
          {button.id === 'potion' && (
            <>
              <Heart className="w-4 h-4 fill-red-500" />
              <span className="text-[8px]">x{potions}</span>
            </>
          )}
          {button.id === 'open' && (
            <>
              <Sparkles className="w-4 h-4" />
              <span className="text-[8px]">OPEN</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
