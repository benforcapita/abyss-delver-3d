# Abyss Delver 3D — High-Level Design

## 1. Purpose
First-person procedural dungeon-crawler RPG (React + TypeScript + three.js via @react-three/fiber). Goal: a standalone, fully playable, deployable (Vercel, later) web game matching `design/game_design_document.json`.

## 2. Current state (as imported)
- ~7.2k LOC exported from a "game playground" platform. **No package.json, index.html, tsconfig, bundler, tests or CI.**
- Implemented: procedural floor generator (rooms/corridors/boss room, chests, shrines, traps, torches, stairs), first-person movement with grid collision, melee + fireball spell, dash, potions, loot tiers & equipment, 5 boss archetypes, floor summary modal, Victory / Game Over overlays, HUD (HP/mana/stamina/boss bar), procedural audio (`gameAudio`) + remote background music, basic mobile D-pad + look area.
- Platform coupling: `utils/usePlayground.ts` loads `gstatic.com/.../playground.js` SDK (startGame / lifecycle / `useRpc('ExitChat')`), `utils/playground-fake.ts`, `playground_config.json` + `getConfig()`, music hosted on `storage.googleapis.com/assets-gen-playground`, Tailwind classes assumed present (no Tailwind config).

## 3. Gaps vs GDD
| GDD requirement | Status |
|---|---|
| Win: defeat Overlord on Floor 5 | Partial — victory fires when player reaches unlocked stairs on floor 5; no "Prime Relic" moment; bosses map: Floor 3 is `boss_gorgon`, GDD says Abyssal Wyrm |
| Lose at 0 HP | Present (Game.tsx sets GAME_OVER) — needs test coverage |
| Score (points, higher better) | Present in state; no persistent best score / leaderboard (GDD's Playground leaderboard → replace with localStorage) |
| Keyboard + mouse | Present (pointer lock, WASD, LMB, Q/1, 2/F, E, Space/Shift). Item key 3 missing |
| Touch / mobile playable | Weak — 4-button D-pad instead of analog joystick, no pointerleave/cancel handling (stuck movement), no landscape prompt |
| Minimap, boss telegraph circles, guaranteed potion drops | Missing / unverified |
| Low-HP vignette, hit-stop, camera shake, damage numbers | Partial (floating text exists) |
| Settings: sensitivity, aim assist, rebinding | Config exists only as static JSON; no in-game settings UI |
| State flow Menu→Floor→Boss→Summary→Next/Victory/GameOver, best-run persistence | Mostly present; no best-run persistence |

## 4. Known bugs / risks (to verify once it builds)
1. `onFloorClear()` is called **every frame** while the player stands within 3.5u of unlocked stairs → repeated chime + repeated summary/victory triggers. Needs a one-shot latch.
2. Floor data is mutated in place (`floorData.stairs.unlocked = true`) instead of via state → render may not update stairs glow reliably.
3. Game loop continues while floor-summary / menu overlays are open (enemies can still hit).
4. Mobile D-pad sets axis on pointerdown and resets only on pointerup → stuck movement when finger slides off.
5. Remote SDK script & music URLs on third-party platform buckets may disappear → silent failures / CORS.
6. Heavy per-frame `setState` (player stats, enemies) inside `useFrame` → perf on mobile.

## 5. Target architecture
```
index.html → src/main.tsx → <App/>
  App (UI state machine, HUD, overlays, touch controls)
    ├─ platform/ (NEW) : storage.ts (localStorage best score/settings), config.ts (defaults + overrides), no external SDK
    ├─ Game (R3F Canvas, useFrame loop: input → player → enemies → projectiles → interactions)
    ├─ game/logic/ (pure TS, unit-tested): dungeonGenerator, combat/damage, scoring, progression/victory rules
    ├─ input.ts / helper useInput (keyboard, mouse, touch joystick)
    └─ audio: gameAudio (WebAudio synth) + BackgroundMusic (self-hosted assets in /public)
```
- Tooling: Vite + React 18/19 + TS (strict-ish), Tailwind CSS v4 (or v3) via PostCSS, Vitest + @testing-library for unit, Playwright for smoke (headless WebGL via SwiftShader), ESLint optional.
- CI: GitHub Actions — `npm ci`, `tsc --noEmit`, `vitest run`, `vite build`, upload `dist` artifact; Playwright smoke later.
- Deploy (later, not now): Vercel static (`vite build` → `dist`), preview deploys per PR only after Ben's OK.
- No paid services. Leaderboard = local only.

## 6. Non-functional
- 60fps desktop, ≥30fps mid-range mobile; landscape; first load < 3 MB gz.
- Deterministic generator given seed (testability).
