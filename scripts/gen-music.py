#!/usr/bin/env python3
"""
Procedural music loop generator for Abyss Delver 3D.
Synthesizes deterministic, seamless audio loops (dark dungeon drone for explore,
faster pulsing loop for boss battle) using Python 3 standard library only,
and encodes them to mono ~64kbps MP3 via ffmpeg.
"""

import math
import os
from pathlib import Path
import struct
import subprocess
import tempfile
import wave


def generate_dungeon_drone(duration: float = 16.0, sample_rate: int = 44100) -> list[float]:
    """
    Synthesize an atmospheric, dark dungeon ambient drone loop (~16 seconds).
    All oscillator frequencies and LFO rates are exact harmonic multiples of (1 / duration),
    ensuring mathematical phase continuity across the loop boundary.
    """
    total_samples = int(duration * sample_rate)
    samples = [0.0] * total_samples
    two_pi = 2.0 * math.pi

    # Harmonic components: (frequency in Hz, amplitude, lfo_cycles, lfo_phase, lfo_depth)
    # Fundamental step f0 = 1 / 16 = 0.0625 Hz
    harmonics = [
        (36.75, 0.35, 1, 0.0, 0.25),    # D1 deep sub rumble (k=588)
        (36.875, 0.22, 2, 0.5, 0.30),   # D1 detuned beating oscillator (k=590)
        (55.00, 0.30, 2, 1.0, 0.35),    # A1 cavern fifth (k=880)
        (73.50, 0.24, 1, 2.0, 0.30),    # D2 root octave (k=1176)
        (87.50, 0.20, 3, 0.0, 0.45),    # F2 minor third tension (k=1400)
        (110.00, 0.18, 2, 1.5, 0.40),   # A2 fifth (k=1760)
        (130.875, 0.12, 4, 3.0, 0.50),  # C3 minor seventh (k=2094)
        (147.00, 0.15, 1, 4.0, 0.35),   # D3 octave (k=2352)
        (220.00, 0.08, 3, 0.5, 0.55),   # A3 mid harmony (k=3520)
        (294.00, 0.06, 2, 2.5, 0.60),   # D4 upper harmonic (k=4704)
        (440.00, 0.04, 1, 1.0, 0.75),   # A4 high resonant shimmer (k=7040)
        (587.25, 0.03, 2, 0.0, 0.85),   # D5 crystalline bell overtone (k=9396)
    ]

    components = []
    for freq, amp, lfo_cyc, lfo_ph, lfo_dep in harmonics:
        k = int(round(freq * duration))
        components.append((k, amp, lfo_cyc, lfo_ph, lfo_dep))

    for i in range(total_samples):
        norm_t = i / total_samples
        val = 0.0
        for k, amp, lfo_cyc, lfo_ph, lfo_dep in components:
            lfo = 1.0 - lfo_dep * 0.5 + lfo_dep * 0.5 * math.sin(two_pi * lfo_cyc * norm_t + lfo_ph)
            val += amp * lfo * math.sin(two_pi * k * norm_t)

        # Warm soft clipping / saturation
        samples[i] = math.tanh(val * 1.5) * 0.8

    # Peak normalize to -1.4 dBFS (0.85 peak)
    peak = max(abs(x) for x in samples)
    if peak > 0:
        samples = [x * (0.85 / peak) for x in samples]
    return samples


def generate_boss_pulse(duration: float = 8.0, sample_rate: int = 44100) -> list[float]:
    """
    Synthesize an intense, rhythmic boss battle pulse loop (~8 seconds).
    120 BPM, 16 beats / 32 eighth notes across 4 bars.
    Includes driving bass synth, punchy war kicks, tension stabs, and crisp ticking.
    Exact cycle alignment ensures seamless loop turnaround.
    """
    total_samples = int(duration * sample_rate)
    samples = [0.0] * total_samples
    two_pi = 2.0 * math.pi

    bpm = 120.0
    beat_sec = 60.0 / bpm          # 0.5s per beat
    subdiv_sec = beat_sec / 2.0     # 0.25s per eighth note
    total_subdivs = int(round(duration / subdiv_sec))  # 32

    # 4-bar progression in 8s (2s per bar):
    # Bar 1: D2 (73.5 Hz)
    # Bar 2: F2 (87.5 Hz)
    # Bar 3: G2 (98.0 Hz)
    # Bar 4: G#2 / A2 (104.0 / 110.0 Hz)
    bass_notes = []
    for bar in range(4):
        if bar == 0:
            root = 73.5
        elif bar == 1:
            root = 87.5
        elif bar == 2:
            root = 98.0
        else:
            root = 104.0
        for s in range(8):
            # Alternating octave jump on offbeats
            pitch = root * 2.0 if (s % 2 == 1) else root
            bass_notes.append(pitch)

    for i in range(total_samples):
        t = i / sample_rate
        norm_t = i / total_samples
        subdiv_idx = int(t / subdiv_sec) % total_subdivs
        subdiv_t = t % subdiv_sec
        beat_t = t % beat_sec

        # 1. Driving Bass synth with decay
        pitch = bass_notes[subdiv_idx]
        k_pitch = int(round(pitch * duration))
        decay = math.exp(-12.0 * subdiv_t)

        bass = (
            math.sin(two_pi * k_pitch * norm_t)
            + 0.50 * math.sin(two_pi * 2 * k_pitch * norm_t)
            + 0.25 * math.sin(two_pi * 3 * k_pitch * norm_t)
            + 0.12 * math.sin(two_pi * 4 * k_pitch * norm_t)
        ) * (0.35 * decay + 0.15)

        # 2. Punchy Kick drum on each downbeat (0.5s)
        kick_decay = math.exp(-22.0 * beat_t)
        kick_freq = 42.0 + 90.0 * math.exp(-35.0 * beat_t)
        kick = math.sin(two_pi * kick_freq * beat_t) * kick_decay * 0.70

        # 3. Off-beat tension screech / stab (syncopated at 8th note offbeat)
        stab_decay = math.exp(-25.0 * (beat_t % 0.25)) if (beat_t >= 0.25) else 0.0
        # Tritone interval: D4 (294 Hz) + G#4 (416 Hz), both exact multiples of 1/8
        stab = (math.sin(two_pi * 294.0 * t) + math.sin(two_pi * 416.0 * t)) * stab_decay * 0.22

        # 4. Hi-hat / metallic tick on 16th notes (0.125s)
        tick_t = t % (subdiv_sec / 2.0)
        tick_decay = math.exp(-65.0 * tick_t)
        tick = math.sin(two_pi * 3500.0 * t) * tick_decay * 0.12

        # Overdrive and saturate for punchy grit
        mix = bass + kick + stab + tick
        samples[i] = math.tanh(mix * 1.6) * 0.85

    peak = max(abs(x) for x in samples)
    if peak > 0:
        samples = [x * (0.85 / peak) for x in samples]
    return samples


def save_wav(samples: list[float], wav_path: str, sample_rate: int = 44100) -> None:
    """Save 16-bit PCM mono WAV file."""
    with wave.open(wav_path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        raw_bytes = bytearray()
        for sample in samples:
            clamped = max(-1.0, min(1.0, sample))
            val = int(clamped * 32767.0)
            raw_bytes.extend(struct.pack("<h", val))
        wf.writeframes(raw_bytes)


def encode_mp3(wav_path: str, mp3_path: str) -> None:
    """Encode WAV to mono 64kbps MP3 via ffmpeg."""
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        wav_path,
        "-vn",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        "64k",
        "-ac",
        "1",
        mp3_path,
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    audio_dir = repo_root / "public" / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)

    tracks = [
        ("dungeon_drone.mp3", 16.0, generate_dungeon_drone),
        ("boss_pulse.mp3", 8.0, generate_boss_pulse),
    ]

    with tempfile.TemporaryDirectory() as tmp_dir:
        for filename, duration, generator in tracks:
            print(f"Generating {filename} (duration: {duration:.1f}s)...")
            samples = generator(duration=duration, sample_rate=44100)
            temp_wav = os.path.join(tmp_dir, f"{filename}.wav")
            out_mp3 = audio_dir / filename

            save_wav(samples, temp_wav, sample_rate=44100)
            encode_mp3(temp_wav, str(out_mp3))

            size_bytes = out_mp3.stat().st_size
            size_kb = size_bytes / 1024.0
            print(f" -> Wrote {out_mp3} ({size_kb:.1f} KB)")

            max_kb = 300.0
            if size_kb >= max_kb:
                raise RuntimeError(
                    f"Generated file {filename} exceeds {max_kb} KB limit: {size_kb:.1f} KB"
                )

    print("Audio generation completed successfully.")


if __name__ == "__main__":
    main()
