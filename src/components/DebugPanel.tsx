import React, {useCallback, useEffect, useState} from 'react';
import {debugCheats} from '../debug';

export interface DebugPanelProps {
  onSkipFloor: () => void;
}

export function DebugPanel({onSkipFloor}: DebugPanelProps) {
  const [godMode, setGodMode] = useState(() => debugCheats.godMode);

  const toggleGodMode = useCallback(() => {
    debugCheats.godMode = !debugCheats.godMode;
    setGodMode(debugCheats.godMode);
  }, []);

  const handleKillBoss = useCallback(() => {
    debugCheats.killBossRequested = true;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F6') {
        e.preventDefault();
        onSkipFloor();
      } else if (e.key === 'F7') {
        e.preventDefault();
        handleKillBoss();
      } else if (e.key === 'F8') {
        e.preventDefault();
        toggleGodMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onSkipFloor, handleKillBoss, toggleGodMode]);

  return (
    <div
      data-testid="debug-panel"
      title="DEBUG"
      className="fixed bottom-3 left-3 z-50 bg-black/85 backdrop-blur border border-amber-500/60 rounded-lg p-2.5 shadow-2xl flex flex-col gap-1.5 text-xs text-white pointer-events-auto select-none">
      <div className="font-mono text-[10px] uppercase font-bold text-amber-400">DEBUG</div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={onSkipFloor}
          className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded text-left font-mono text-[11px] transition-colors">
          Skip floor
        </button>
        <button
          type="button"
          onClick={handleKillBoss}
          className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded text-left font-mono text-[11px] transition-colors">
          Kill boss
        </button>
        <button
          type="button"
          onClick={toggleGodMode}
          className={`px-2 py-1 rounded text-left font-mono text-[11px] transition-colors ${
            godMode
              ? 'bg-amber-500/30 text-amber-300 hover:bg-amber-500/40'
              : 'bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300'
          }`}>
          God mode: {godMode ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
}

export default DebugPanel;
