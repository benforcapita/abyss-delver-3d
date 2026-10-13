import React, {useEffect, useState} from 'react';
import {prefersReducedMotion} from '../fx/screenShake';
import {
  ACTION_LABELS,
  BINDABLE_ACTIONS,
  keyLabel,
  rebind,
  resetBindings,
  type BindableAction,
} from '../platform/keybindings';
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
  const [listening, setListening] = useState<BindableAction | null>(null);
  const [notice, setNotice] = useState('');

  // While waiting for a key, capture the next keydown (Escape cancels) or the
  // next left mouse press (binds 'Mouse0'). preventDefault suppresses the
  // click so other buttons aren't activated while listening.
  useEffect(() => {
    if (!listening) return;
    const apply = (key: unknown) => {
      const res = rebind(settings.keyBindings, listening, key);
      if (res.ok) {
        onChange({keyBindings: res.bindings});
        setNotice(
          res.swappedWith
            ? `Swapped with ${ACTION_LABELS[res.swappedWith]} (now ${keyLabel(res.bindings[res.swappedWith])})`
            : '',
        );
      } else {
        setNotice(res.reason === 'reserved' ? 'That key is reserved.' : 'Unsupported key.');
      }
      setListening(null);
    };
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code === 'Escape') {
        setListening(null);
        return;
      }
      apply(e.code);
    };
    const onPointer = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      apply('Mouse0');
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer, true);
    };
  }, [listening, settings.keyBindings, onChange]);

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
      <div className="flex flex-col gap-1 text-xs">
        <span className="font-bold text-zinc-300">Key Bindings</span>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 max-h-48 overflow-y-auto pr-1">
          {BINDABLE_ACTIONS.map((a) => (
            <div key={a} className="flex items-center justify-between gap-2">
              <span className="text-zinc-400 truncate">{ACTION_LABELS[a]}</span>
              <button
                data-testid={`bind-${a}`}
                onClick={() => {
                  setNotice('');
                  setListening(a);
                }}
                className={`min-w-14 px-2 py-1 rounded border font-mono font-bold ${
                  listening === a
                    ? 'border-amber-400 text-amber-300 animate-pulse'
                    : 'border-zinc-600 text-zinc-100 bg-zinc-800'
                }`}>
                {listening === a ? '…' : keyLabel(settings.keyBindings[a])}
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center mt-1">
          <span data-testid="bind-notice" className="text-amber-300 text-[10px]">
            {notice || 'Click a binding, then press a key or LMB (Esc cancels). Conflicts swap.'}
          </span>
          <button
            data-testid="bind-reset"
            onClick={() => {
              setListening(null);
              setNotice('');
              onChange({keyBindings: resetBindings()});
            }}
            className="shrink-0 px-2 py-1 rounded border border-zinc-600 text-zinc-300 hover:bg-zinc-800 font-bold">
            RESET KEYS
          </button>
        </div>
      </div>
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
