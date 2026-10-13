import {useEffect, useRef} from 'react';
import {getJSON, setJSON} from './storage';

export const BEST_SCORE_KEY = 'ad3d.best';

export interface BestScore {
  score: number;
  floor?: number;
}

/**
 * Local no-op replacement for the Playground SDK. `startGame` does nothing;
 * `gameOver` persists the best score to localStorage ('ad3d.best').
 */
export const sdk = {
  startGame(): void {},
  gameOver(score: number, floor?: number): void {
    const prev = getJSON<BestScore>(BEST_SCORE_KEY);
    if (!prev || score > prev.score) {
      setJSON(BEST_SCORE_KEY, {
        score,
        ...(floor !== undefined ? {floor} : {}),
      });
    }
  },
};

export type GameLifecycleSdk = typeof sdk;

export interface LifecycleGameState {
  status: string;
  score: number;
  level?: number | string;
}

const TERMINAL_STATUSES = new Set([
  'GAME_OVER',
  'DEFEAT',
  'LOST',
  'VICTORY',
  'WIN',
  'LEVEL_COMPLETE',
]);

/**
 * Reports a finished run to the local sdk exactly once per run (latched),
 * resetting when a new run starts.
 */
export function useGameLifecycle(
  gameState: LifecycleGameState,
  activeSdk: GameLifecycleSdk = sdk,
): void {
  const hasEnded = useRef(false);

  useEffect(() => {
    const status = (gameState.status || '').toUpperCase();
    if (status === 'PLAYING') {
      hasEnded.current = false;
      return;
    }
    if (TERMINAL_STATUSES.has(status) && !hasEnded.current) {
      hasEnded.current = true;
      const floor = Number(gameState.level);
      activeSdk.gameOver(
        gameState.score,
        Number.isFinite(floor) ? floor : undefined,
      );
    }
  }, [gameState.status, gameState.score, gameState.level, activeSdk]);
}
