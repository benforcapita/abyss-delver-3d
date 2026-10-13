import {useEffect, useRef} from 'react';

export type {BestScore} from '../bestScore';

/**
 * Local no-op replacement for the Playground SDK. Best-score persistence is
 * owned solely by App.tsx via `saveBest` in `src/bestScore.ts` (key
 * `ad3d.best.v1`); `gameOver` deliberately does not write storage, so a
 * finished run is saved exactly once.
 */
export const sdk = {
  startGame(): void {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  gameOver(_score: number, _floor?: number): void {},
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
