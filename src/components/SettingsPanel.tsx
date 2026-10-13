import React from 'react';
import {prefersReducedMotion} from '../fx/screenShake';
import {SETTINGS_LIMITS, type UserSettings} from '../platform/settings';

export interface SettingsPanelProps {
  settings: UserSettings;
  onChange: (patch: Partial<UserSettings>) => void;
  onClose: () => void;
}

function Slider(props: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <label htmlFor={props.id} className="flex flex-col gap-1 text-left text-xs">
      <span className="flex justify-between font-bold text-zinc-300">
        <span>{props.label}</span>
        <span data-testid={`${props.id}-value`} className="text-amber-400">
          {props.display}
        </span>
      </span>
      <input
        id={props.id}
        data-testid={props.id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="w-full accent-amber-500"
      />
    </label>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Settings panel: look sensitivity, aim assist, screen shake, music and SFX volume. */
export function SettingsPanel({settings, onChange, onClose}: SettingsPanelProps) {
  const L = SETTINGS_LIMITS;
  return (
    <div
      data-testid="settings-panel"
      className="w-full max-w-md flex flex-col gap-4 bg-zinc-900 border-2 border-amber-500/60 rounded-xl p-6 shadow-2xl">
      <h2 className="text-2xl font-black text-amber-400 text-center">SETTINGS</h2>
      <Slider
        id="setting-sensitivity"
        label="Look Sensitivity"
        value={settings.lookSensitivity}
        {...L.lookSensitivity}
        display={settings.lookSensitivity.toFixed(1)}
        onChange={(v) => onChange({lookSensitivity: v})}
      />
      <label className="flex justify-between items-center text-xs font-bold text-zinc-300">
        <span>Aim Assist</span>
        <input
          type="checkbox"
          data-testid="setting-aim-assist"
          checked={settings.enableAutoAimAssist}
          onChange={(e) => onChange({enableAutoAimAssist: e.target.checked})}
          className="w-5 h-5 accent-amber-500"
        />
      </label>
      <label className="flex justify-between items-center text-xs font-bold text-zinc-300">
        <span>
          Screen Shake
          {prefersReducedMotion() ? (
            <span className="block font-normal text-zinc-500">Off while reduced motion is on</span>
          ) : null}
        </span>
        <input
          type="checkbox"
          data-testid="setting-screen-shake"
          checked={settings.screenShake}
          onChange={(e) => onChange({screenShake: e.target.checked})}
          className="w-5 h-5 accent-amber-500"
        />
      </label>
      <Slider
        id="setting-music-volume"
        label="Music Volume"
        value={settings.musicVolume}
        {...L.musicVolume}
        display={pct(settings.musicVolume)}
        onChange={(v) => onChange({musicVolume: v})}
      />
      <Slider
        id="setting-sfx-volume"
        label="SFX Volume"
        value={settings.sfxVolume}
        {...L.sfxVolume}
        display={pct(settings.sfxVolume)}
        onChange={(v) => onChange({sfxVolume: v})}
      />
      <button
        onClick={onClose}
        autoFocus
        data-testid="settings-close"
        className="w-full bg-amber-500 hover:bg-amber-400 text-black py-2.5 rounded-lg font-black text-sm">
        BACK
      </button>
    </div>
  );
}
