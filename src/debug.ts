export interface DebugCheats {
  godMode: boolean;
  killBossRequested: boolean;
}

export const debugCheats: DebugCheats = {
  godMode: false,
  killBossRequested: false,
};

export function isDebugEnabled(search: string, isDev: boolean): boolean {
  if (isDev) return true;
  try {
    const params = new URLSearchParams(search);
    return params.get('debug') === '1';
  } catch {
    return false;
  }
}

export function applyDamage(hp: number, dmg: number, godMode: boolean): number {
  return godMode ? hp : Math.max(0, hp - dmg);
}
