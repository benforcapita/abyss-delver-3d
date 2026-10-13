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

## 10. Boss roster and abilities
Bosses spawn once per floor in the boss room (`dungeonGenerator.ts`). Boss HP/damage use existing per-floor scaling; numbers below are behaviour targets.

| Floor | Name (archetype) | Signature attack | Wind-up / telegraph | Damage | Cooldown |
|---|---|---|---|---|---|
| 1 | Bone Colossus (`boss_bone_colossus`) | Ground slam, AoE r=3 | 1.0s, red ring r=3 | 20 | 4s |
| 2 | Crimson Archmage (`boss_crimson_archmage`) | 3-bolt fan (±15°) | 0.6s, glow on staff | 12 / bolt | 3s |
| 3 | **Abyssal Wyrm** (`boss_abyssal_wyrm`, replaces `boss_gorgon`) | Charge: straight dash toward player's position at wind-up start, 12 units at 14 u/s, stops on wall | **0.8s**, red ground line (width 1.5, length 12) from wyrm toward target | 30 on contact (once per charge) + knockback 3 | 5s; 1.2s stunned after hitting a wall |
| 4 | Shadow Knight Lord (`boss_shadow_knight`) | Blink behind player (≤8 units) + cleave 120° | 0.7s, dark ring at destination | 25 | 4.5s |
| 5 | **Dungeon Overlord** (`boss_void_overlord`, display name "DUNGEON OVERLORD") — final boss | Phase 1: 8-way void orbs; Phase 2 (<50% HP): adds slam ring r=4 | orbs 0.8s; slam 1.0s red ring | orbs 15 each, slam 30 | orbs 3.5s, slam 6s |

Floors >5 do not exist; boss index = `floorLevel - 1` (no modulo wrap needed).

### Victory
`isVictory`: floor 5 && Overlord defeated → Prime Relic spawns at the boss-room centre; walking over it opens the **Prime Relic screen**: "PRIME RELIC SECURED", final score, best score. Bonus = **+5000 + HP×10** *(pending Ben OK)*. Stairs on floor 5 no longer trigger victory.

### Key 3 ability — Frost Nova
- Effect: instant ring around player r=4; 20 + 5×floor damage, slows enemies 50% for 2s; bosses: damage only, slow 25%.
- Cost: **30 mana** (max mana 60, regen 4/s → ~7.5s to refill cost; fireball stays 15).
- Cooldown: **8s**, tracked as `novaCooldown` in `PlayerStats`, decremented in the same tick as `spellCooldown`. Not castable if mana < 30 ("NOT ENOUGH MANA" floating text, same as fireball). Shown as 3rd HUD slot with cooldown sweep. Rebindable (default `Digit3`).

### Definitions
- **Aim assist**: when enabled (settings), a fireball's direction snaps to the nearest living enemy within `AIM_ASSIST_CONE_DEG` = 20° of the crosshair and `AIM_ASSIST_RANGE` = 20 units with line of sight; ties → smallest angle. Melee and Frost Nova unaffected.
- **Room clear**: a `combat` or `boss` room is cleared when every enemy whose spawn position lies inside the room rect is dead; fires once per room → guaranteed potion drop (#17) + floor-text "ROOM CLEARED". Spawn/treasure/shrine rooms never "clear".
- **#22 difficulty target**: a first-time player using potions reaches floor 3 in ≥60% of runs and beats the Overlord in ~20–30%; a full run takes 15–25 min; no single non-boss hit deals >25% of base max HP; boss fights last 45–120s each.
