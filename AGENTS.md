# Abyss Delver 3D — agent notes

## Verify
- `npx tsc --noEmit` — typecheck
- `npx vitest --run` — unit tests
- `npm run build` — production build
- `npx playwright test` — e2e (first time: `npx playwright install chromium`).
  The config reuses any server already on port 4173; if another local app owns that port the
  tests hit the wrong page. Use a temporary config pointing `baseURL`/`webServer` at a free port.

## Architecture notes
- Tile (gx, gz) is centred at `(g - gridSize/2) * 4` world units: map world → tile with
  `navigation.ts#worldToGrid` (rounds). Collision, line of sight and projectile/wall checks live there.
- Enemy perception (sight range, view cone, LOS, memory) is in `enemyPerception.ts`; enemies only
  chase/attack while they can see the player.
- Enemy/boss models are in `src/components/enemies/`; they are memoized and animated imperatively in
  `useFrame` (never re-rendered per frame). Hit flash tints materials, so materials are per instance.
- Avoid per-frame React state updates in the game loop (cooldowns are refs; HUD stats sync at 20 Hz),
  and avoid mounting/unmounting lights at runtime (changes light count → every shader recompiles).
