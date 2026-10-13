import {MusicTrack} from './utils/helper';

/** Game configuration schema. */
export const CONFIG = {
  // --- Game Initialization ---
  title: {
    value: 'Abyss Delver 3D',
    type: 'string',
    label: 'Game Title',
    group: 'GAME',
  },
  baseCanvasWidth: {
    value: 1280,
    type: 'number',
    label: 'Base Canvas Width',
    group: 'GAME',
  },
  baseCanvasHeight: {
    value: 720,
    type: 'number',
    label: 'Base Canvas Height',
    group: 'GAME',
  },

  // --- Theme & Style ---
  backgroundColor: {
    value: '#08080d',
    type: 'color',
    label: 'Background Color',
    group: 'THEME',
  },
  primaryColor: {
    value: '#f59e0b',
    type: 'color',
    label: 'Primary Color',
    group: 'THEME',
  },
  fontFamily: {
    value: "'Cinzel', 'MedievalSharp', serif, sans-serif",
    type: 'string',
    label: 'Font Family',
    group: 'THEME',
  },

  // --- Camera & View ---
  fov: {
    value: 75,
    type: 'number',
    label: 'Field of View',
    group: 'Camera',
    min: 50,
    max: 100,
    step: 5,
  },
  cameraX: {
    value: 0,
    type: 'number',
    label: 'Camera X',
    group: 'Camera',
  },
  cameraY: {
    value: 1.5,
    type: 'number',
    label: 'Camera Y',
    group: 'Camera',
  },
  cameraZ: {
    value: 0,
    type: 'number',
    label: 'Camera Z',
    group: 'Camera',
  },

  // --- Visuals & Dungeon Lighting ---
  ambientColor: {
    value: '#151528',
    type: 'color',
    label: 'Ambient Light Color',
    group: 'Visuals',
  },
  ambientIntensity: {
    value: 1.6,
    type: 'number',
    label: 'Ambient Intensity',
    group: 'Visuals',
    min: 0.5,
    max: 5,
    step: 0.1,
  },
  sunColor: {
    value: '#ffb366',
    type: 'color',
    label: 'Sun / Key Color',
    group: 'Visuals',
  },
  sunIntensity: {
    value: 3.2,
    type: 'number',
    label: 'Sun Intensity',
    group: 'Visuals',
    min: 1,
    max: 10,
    step: 0.2,
  },
  hemiSkyColor: {
    value: '#38385e',
    type: 'color',
    label: 'Hemisphere Sky Color',
    group: 'Visuals',
  },
  hemiGroundColor: {
    value: '#1a140d',
    type: 'color',
    label: 'Hemisphere Ground Color',
    group: 'Visuals',
  },
  hemiIntensity: {
    value: 0.8,
    type: 'number',
    label: 'Hemisphere Intensity',
    group: 'Visuals',
    min: 0,
    max: 3,
    step: 0.1,
  },

  // --- Physics & Engine ---
  gravity: {
    value: -15.0,
    type: 'number',
    label: 'Gravity',
    group: 'Physics',
    min: -30,
    max: 0,
    step: 0.5,
  },
  targetFPS: {
    value: 60,
    type: 'number',
    label: 'Target FPS',
    group: 'SYSTEM',
  },
  stepMs: {
    value: 1000 / 60,
    type: 'number',
    label: 'Step MS',
    group: 'SYSTEM',
  },
  maxSubSteps: {
    value: 5,
    type: 'number',
    label: 'Max Sub Steps',
    group: 'SYSTEM',
  },

  // --- Player Gameplay Tuning (Configurable) ---
  playerSpeed: {
    value: 6.5,
    type: 'number',
    label: 'Player Speed',
    group: 'Rules',
    min: 4.0,
    max: 12.0,
    step: 0.5,
  },
  playerMaxHp: {
    value: 100,
    type: 'number',
    label: 'Player Max Health',
    group: 'Rules',
    min: 50,
    max: 300,
    step: 10,
  },
  playerMaxMana: {
    value: 60,
    type: 'number',
    label: 'Player Max Mana',
    group: 'Rules',
    min: 20,
    max: 150,
    step: 10,
  },
  baseSwordDamage: {
    value: 28,
    type: 'number',
    label: 'Base Sword Damage',
    group: 'Rules',
    min: 10,
    max: 80,
    step: 2,
  },
  spellDamage: {
    value: 45,
    type: 'number',
    label: 'Spell Fireball Damage',
    group: 'Rules',
    min: 20,
    max: 120,
    step: 5,
  },
  lookSensitivity: {
    value: 1.8,
    type: 'number',
    label: 'Look Sensitivity',
    group: 'Controls',
    min: 0.5,
    max: 4.0,
    step: 0.1,
  },
  enableAutoAimAssist: {
    value: true,
    type: 'boolean',
    label: 'Auto-Aim Assist',
    group: 'Controls',
  },

  // --- Audio ---
  defaultMusicVolume: {
    value: 0.45,
    type: 'number',
    label: 'Default Music Volume',
    group: 'AUDIO',
    min: 0,
    max: 1,
    step: 0.05,
  },
  defaultSfxVolume: {
    value: 0.7,
    type: 'number',
    label: 'Default SFX Volume',
    group: 'AUDIO',
    min: 0,
    max: 1,
    step: 0.05,
  },
  backgroundMusicUrl: {
    value:
      'https://storage.googleapis.com/assets-gen-playground/musiclibrary/automated_dream.mp3',
    type: 'string',
    label: 'Background Music URL',
    group: 'AUDIO',
  },
};

// Merge customized config values if present (injected by Playground)
const {playgroundConfig} = globalThis as {
  playgroundConfig?: Record<string, unknown>;
};
if (playgroundConfig) {
  for (const [key, value] of Object.entries(playgroundConfig)) {
    if (key in CONFIG) {
      Object.assign(CONFIG[key as keyof typeof CONFIG], {value});
    }
  }
}

/** Type helper for reading values in game code. */
export type ConfigKey = keyof typeof CONFIG;

/**
 * Gets a configuration value by key.
 * @param key The configuration key.
 * @return The configuration value.
 */
export function getConfig<K extends ConfigKey>(
  key: K,
): (typeof CONFIG)[K]['value'] {
  return CONFIG[key].value;
}

/** Background music tracks available for the game to use. */
export const AVAILABLE_MUSIC_TRACKS: readonly MusicTrack[] = [
  {
    name: 'automated_dream',
    url: 'https://storage.googleapis.com/assets-gen-playground/musiclibrary/automated_dream.mp3',
    description: 'Mysterious dungeon exploration atmosphere with rich medieval ambient tension.',
  },
  {
    name: 'grid_runner',
    url: 'https://storage.googleapis.com/assets-gen-playground/musiclibrary/grid_runner.mp3',
    description: 'High octane boss battle encounter theme.',
  },
  {
    name: 'deep_pocket',
    url: 'https://storage.googleapis.com/assets-gen-playground/musiclibrary/deep_pocket.mp3',
    description: 'Cryptic crypt depths and eerie subterranean dungeon corridors.',
  },
];
