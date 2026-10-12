# Roadmap — small, independently shippable items
Every item = one small **draft PR**. Proof required in PR: green CI (from #2 on) + screenshot/recording or live local check as stated. No merge/deploy without Ben's OK.

| # | Item | Difficulty | Acceptance criteria | Proof |
|---|---|---|---|---|
| 1 | **Standalone Vite+React+TS build** (package.json, index.html, tsconfig, vite config, Tailwind, move to src/) | regular | `npm i && npm run dev` serves game; `npm run build` succeeds; `tsc --noEmit` passes (or documented, minimal `// @ts-expect-error`); title screen renders | Build log + screenshot of title & in-game |
| 2 | **CI: GitHub Actions** typecheck + vitest + build | easy | Workflow runs on PR & main; one trivial passing test | Green CI run link |
| 3 | Remove Playground SDK (local no-op lifecycle, config from JSON+localStorage, drop remote script) | regular | No requests to gstatic; game starts/restarts; Exit button hidden | Network tab screenshot + CI |
| 4 | Self-host or replace music; graceful fallback | easy | No requests to assets-gen-playground; licence noted | Screenshot + CI |
| 5 | Fix stairs one-shot latch + stairs unlock via state | easy | Reaching portal triggers summary exactly once | Unit/e2e or recording + CI |
| 6 | Pause game loop while menus/summary open | easy | Enemies don't move/hit when overlay open | Recording + CI |
| 7 | Unit tests for dungeon generator (seeded, connectivity, 1 boss) | regular | ≥5 tests pass | Green CI |
| 8 | Win/lose/score pure functions + tests; Prime Relic victory screen with final score | regular | Floor-5 boss + portal → Victory with score; 0 HP → Game Over once | Tests + screenshots |
| 9 | Debug cheats (`?debug=1`: skip floor, kill boss, god mode) | easy | Only active with flag/DEV | Screenshot + CI |
| 10 | Playwright smoke e2e in CI (load, start, HUD, no console errors) | regular | e2e job green | Green CI |
| 11 | Best score/floor persisted (localStorage), shown on menu & game over | easy | Survives reload | Screenshot |
| 12 | Boss roster per GDD (Floor 3 Abyssal Wyrm charge) | regular | Floor 3 boss name/behaviour matches | Recording |
| 13 | Mobile analog joystick + action buttons, pointercancel fix | regular | Playable at 844x390 touch emulation, no stuck movement | Recording (mobile emulation) + e2e mobile check |
| 14 | Landscape/rotate prompt + safe-area HUD | easy | Portrait shows prompt | Screenshot |
| 15 | Minimap (visited rooms, chests, enemies) | regular | Visible top-right, updates while moving | Screenshot |
| 16 | Boss telegraph ground circles | regular | Red ring appears before boss attack | Recording |
| 17 | Guaranteed potion drop on room clear | easy | Test + floating text | Test + CI |
| 18 | Juice: low-HP vignette, camera shake, hit-stop | regular | Visible effects | Recording |
| 19 | Settings panel (sensitivity, aim assist, volume) persisted | regular | Changes apply & persist | Screenshot |
| 20 | Key rebinding + key `3` ability | regular | Rebind works, persisted | Recording |
| 21 | Performance pass (move per-frame setState to refs; ≥30fps mid mobile) | very-difficult | FPS measured before/after | Perf screenshot |
| 22 | Full-run balance pass (floors 1–5 beatable in ~15–25 min) | very-difficult | Playtest notes, tuned constants | Playtest recording |
| 23 | Vercel deploy config (vercel.json/SPA) — **deploy only with Ben's OK** | easy | Preview build config ready | Config + local `vite preview` check |

Assignment guidance: easy → Anti-Gravity CLI; regular → Devin CLI; very-difficult → Devin CLI with Eng Lead review. Item #1 may start immediately (low risk).
