# Abyss Delver 3D — Low-Level Design

## 1. Repo layout (after ROADMAP #1–#2)
```
index.html, package.json, vite.config.ts, tsconfig.json, tailwind/postcss config
src/main.tsx (was index.tsx), src/App.tsx, src/Game.tsx, src/types.ts, src/constants.ts,
src/dungeonGenerator.ts, src/input.ts, src/utils.ts, src/components/*, src/utils/*
src/platform/{storage.ts,config.ts,lifecycle.ts}
public/music/*.mp3 (self-hosted, licence in THIRD_PARTY_NOTICES.md)
tests/unit/*.test.ts, tests/e2e/smoke.spec.ts
.github/workflows/ci.yml
```
Keep moves mechanical in #1 (git mv) so later diffs stay readable.

## 2. Dependencies
react, react-dom, three, @react-three/fiber, @react-three/postprocessing, lucide-react, tailwindcss; dev: vite, @vitejs/plugin-react, typescript, @types/*, vitest, jsdom, @playwright/test. Pin versions that satisfy current imports (R3F v8 ↔ React 18 or R3F v9 ↔ React 19 — pick one, verify typecheck).

## 3. Platform replacement
- `usePlayground()` → `src/platform/lifecycle.ts` exporting a no-op `sdk` with `startGame()`, `gameOver(score)` that writes best score to localStorage. Delete remote script load. `useRpc('ExitChat')` → no-op / hide "Exit" button.
- `getConfig(key)` → reads defaults from `playground_config.json` values, merged with `localStorage['ad3d.settings']`.
- Music: download/replace tracks with CC0/self-made files under `public/music`, or fall back to the WebAudio synth. Missing music must never block gameplay.

## 4. Game state machine (App)
`MENU → PLAYING ⇄ PAUSED(menu/how-to) → FLOOR_SUMMARY → PLAYING(level+1) … → VICTORY | GAME_OVER → MENU/restart`
- Add explicit `PAUSED`/`FLOOR_SUMMARY` handling: Game `useFrame` early-returns when status ≠ PLAYING.
- Victory rule (pure fn `isVictory(level, bossDefeated, reachedPortal)`): level === 5 && boss defeated && player enters portal → show "Prime Relic secured" + final score.
- Lose rule: `hp <= 0` → GAME_OVER once (latched).

## 5. Fixes
- Stairs latch: `const floorClearedRef = useRef(false)`; reset on floor init; call `onFloorClear` only on first entry.
- Stairs unlocked: store in React state (`setStairsUnlocked(true)`), not mutation.
- Boss table: floor 3 = Abyssal Wyrm (charge attack); boss names/archetypes in `constants.ts`.
- Touch: replace D-pad with analog joystick component (pointer capture, pointercancel/leave reset, normalized vector into `joystickMoveRef`). Action buttons: Attack, Spell, Dash, Interact, Potion.

## 6. Scoring (pure, tested)
`kill = 150*floor`, `boss = 1000*floor`, `floorClear = 500*floor`, `victoryBonus = 5000 + hp*10` (new). Best score + best floor in localStorage `ad3d.best`.

## 7. New features (later items)
Minimap (canvas 2D overlay from `floorData.tiles` + visited mask), boss telegraph rings (ring mesh with fill-progress before `windup→attack`), guaranteed potion drop on room clear, low-HP vignette, camera shake/hit-stop, settings panel (sensitivity, aim assist, volume, rebinding), key `3` item.

## 8. Testing
- Vitest: generator (seeded: rooms connected via BFS, spawn & stairs reachable, exactly 1 boss, boss archetype per floor), scoring, victory/lose rules, config merge.
- Playwright smoke: page loads, canvas present, click Start → HUD "FLOOR 1 / 5" visible, no console errors; mobile viewport shows joystick.
- Dev cheat (only `import.meta.env.DEV` or `?debug=1`): jump to floor N / kill boss — enables e2e victory test.

## 9. CI
`.github/workflows/ci.yml` on push/PR: node 20, `npm ci`, `npm run typecheck`, `npm test -- --run`, `npm run build`; later job `e2e` with `npx playwright install --with-deps chromium`.
