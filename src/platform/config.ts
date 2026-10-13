import playgroundConfig from '../../playground_config.json';
import {getJSON} from './storage';

export const SETTINGS_KEY = 'ad3d.settings';

type ConfigMap = Record<string, unknown>;

// Defaults declared by the config schema, overlaid with the shipped values.
const schemaDefaults: ConfigMap = {};
for (const entry of playgroundConfig.schema ?? []) {
  if ('name' in entry && 'default' in entry) {
    schemaDefaults[entry.name] = entry.default;
  }
}

const merged: ConfigMap = {
  ...schemaDefaults,
  ...(playgroundConfig.values ?? {}),
  ...(getJSON<ConfigMap>(SETTINGS_KEY) ?? {}),
};

/**
 * Gets a platform configuration value by key. Defaults are read from
 * playground_config.json and merged with user settings persisted in
 * localStorage ('ad3d.settings'). Returns undefined for unknown keys.
 */
export function getConfig<T = unknown>(key: string): T | undefined {
  return merged[key] as T | undefined;
}
