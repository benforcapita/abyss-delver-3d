import {Flame, Heart, Sparkles, Sword, Zap} from 'lucide-react';
import React from 'react';

interface ActionButtonsProps {
  onAttack: () => void;
  onSpell: () => void;
  onDash: () => void;
  onInteract: () => void;
  onPotion: () => void;
  potions: number;
}

const BTN =
  'pointer-events-auto active:scale-95 rounded-full font-bold flex flex-col items-center justify-center shadow-lg touch-none select-none';

/**
 * Touch action cluster for mobile play. Buttons fire on pointerdown for
 * immediate response (no click delay).
 */
export function ActionButtons({
  onAttack,
  onSpell,
  onDash,
  onInteract,
  onPotion,
  potions,
}: ActionButtonsProps) {
  const press = (fn: () => void) => (e: React.PointerEvent) => {
    e.preventDefault();
    fn();
  };

  return (
    <div
      data-testid="action-buttons"
      className="pointer-events-auto flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button
          data-testid="btn-interact"
          onPointerDown={press(onInteract)}
          className={`${BTN} w-12 h-12 bg-amber-900/80 border-2 border-amber-500 text-amber-300 text-xs`}>
          <Sparkles className="w-4 h-4" />
          <span className="text-[8px]">OPEN</span>
        </button>
        <button
          data-testid="btn-spell"
          onPointerDown={press(onSpell)}
          className={`${BTN} w-12 h-12 bg-sky-950/80 border-2 border-sky-400 text-sky-200 text-xs`}>
          <Flame className="w-4 h-4 fill-sky-400" />
          <span className="text-[8px]">SPELL</span>
        </button>
        <button
          data-testid="btn-potion"
          onPointerDown={press(onPotion)}
          className={`${BTN} w-12 h-12 bg-red-950/80 border-2 border-red-500 text-red-200 text-xs`}>
          <Heart className="w-4 h-4 fill-red-500" />
          <span className="text-[8px]">x{potions}</span>
        </button>
      </div>
      <div className="flex gap-2 items-center">
        <button
          data-testid="btn-dash"
          onPointerDown={press(onDash)}
          className={`${BTN} w-12 h-12 bg-emerald-950/80 border-2 border-emerald-500 text-emerald-300 text-xs`}>
          <Zap className="w-4 h-4" />
          <span className="text-[8px]">DASH</span>
        </button>
        <button
          data-testid="btn-attack"
          onPointerDown={press(onAttack)}
          className={`${BTN} w-16 h-16 bg-gradient-to-tr from-amber-600 to-yellow-400 text-black text-sm border-2 border-white shadow-2xl`}>
          <Sword className="w-6 h-6 fill-black" />
          <span className="text-[9px] font-black">SLASH</span>
        </button>
      </div>
    </div>
  );
}
