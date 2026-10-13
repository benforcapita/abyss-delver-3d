# AD-24: Controls UX audit and proposal

Docs only. No code changes in this PR. Evidence screenshots are in `docs/pr-assets/ad-24/` and were captured with Playwright against a local `vite preview` build of `main`.

**Important context:** Abyss Delver is a **first-person** dungeon crawler. The camera sits at the player's eye (`Game.tsx` ~L796–799) and mouse/touch drag sets yaw and pitch. So the right comparison is not top-down Diablo/Hades. It is first-person action games (Ultrakill, Dark Messiah, Skyrim melee) on desktop and mobile FPS/twin-stick (CoD Mobile, Archero-style auto-aim) on touch. Where a Diablo/Hades convention still applies (one primary-attack button, dash on its own button, readable hints), we use it.

## 1. Current mapping

### Desktop (keyboard and mouse)
| Action | Binding | Source |
|---|---|---|
| Move / strafe | W A S D (rebindable, #20); camera-relative | `platform/keybindings.ts` defaults; `Game.tsx` ~L733 |
| Look | Mouse, **only after pointer lock** (click canvas) | `Game.tsx` L285–319 |
| Attack | **Space** + any pointer down on the canvas | `keybindings.ts` `attack: 'Space'`; `Game.tsx` L664–672 |
| Dash | **Space** (same key as attack) | `keybindings.ts` `dash: 'Space'`, `SHARED_KEY` |
| Potion / Fireball / Interact | 1 / 2 / E | `keybindings.ts` |
| Pause | Esc | `input.ts` |

### Mobile (touch, landscape only)
- Fixed 112 px joystick, bottom-left (`VirtualJoystick.tsx`, `size = 112`).
- Right half of the screen: drag to look (`App.tsx` ~L684–705).
- Button cluster, bottom-right: SLASH 64 px, DASH/OPEN/SPELL/POTION 48 px each (`ActionButtons.tsx`).
- Portrait shows only a "rotate" prompt that blocks the start button (`mobile-portrait-390x844-title.png`).

## 2. Top pain points

1. **Space attacks and dashes at the same time.** By default Space is bound to both (`DEFAULT_KEY_BINDINGS`, `canShare`), and App's keydown sets `triggerDashRef` while Game reads `confirm` as attack. Every swing also lunges you forward and spends 20 stamina. Genre norm: dash/dodge gets its own key (Shift or Space) and attack goes on LMB.
2. **The on-screen key hints are wrong.** The hint bar reads `LMB Slash · 2/F Fireball · Space Dash` and the elixir says `Key: Q / 1` (`App.tsx` ~L660–676, `desktop-1280x720-ingame.png`). F and Q are not bound anywhere. Space also attacks. The hints are hard-coded and ignore rebinding (#20).
3. **The first click is spent on pointer lock and also attacks.** `handleCanvasClick` requests lock and `pointerdown` sets `tap`, so the first click swings at nothing. Nothing on screen says "click to look around". After Esc releases lock, the mouse silently stops turning the camera.
4. **Tap or click attack repeats every frame while held.** `actions.tap` stays true until pointerup and `executeAttack()` runs every frame (gated only by the 0.35 s cooldown). On mobile, any touch that reaches the canvas also counts as an attack.
5. **Mobile targets are small and crowded.** Four 48 px buttons plus a 64 px SLASH fill the bottom-right at 664×390 (`mobile-landscape-664x390-ingame.png`). That is near or below the 48 px minimum, and DASH sits next to POTION, so it's easy to hit the wrong one. The joystick is fixed, so a thumb that lands off its edge does nothing. The look area overlaps the button cluster.
6. **No aim assist on touch.** Melee in first person needs precise yaw. Drag-to-look with one thumb while the other thumb is on the stick leaves no thumb free for SLASH.
7. **No first-run teaching.** Controls only live behind the "HOW TO PLAY & CONTROLS" menu item.

## 3. Proposed mapping

### Desktop
| Action | Proposed | Notes |
|---|---|---|
| Move | WASD, **camera-relative** (keep as is) | In first person, camera-relative *is* screen-relative, so no change. Arrow keys as secondary. |
| Look | Mouse with pointer lock | Show a "Click to look · Esc to release" overlay whenever lock is off during PLAYING. The lock click must **not** attack. |
| Attack | **LMB** (hold = repeat at the cooldown rate, which is intended) | Space no longer attacks by default. |
| Heavy/Spell | RMB or 2 (fireball) | RMB is the genre norm for a secondary action. |
| Dash | **Space** (alt: Shift) | Dash goes in the movement direction, not the facing direction (`executeDash` currently uses yaw). This matches the Hades/Diablo IV evade. |
| Potion / Interact | Q (alt 1) / E | Makes the current "Q" hint true. |
| Hints | Generated from `settings.keyBindings` through `keyLabel()` | One source of truth. Also shown on cooldown icons. |

Migration: remove the `SHARED_KEY` exception. Saved bindings that still have attack+dash on Space get migrated to attack=Mouse0 and dash=Space.

### Mobile
- **Floating joystick:** touching anywhere in the left 40% spawns the stick under the thumb. Base 120–140 px (scaled by `min(vw,vh)`), with a faint resting ghost bottom-left.
- **Buttons:** SLASH 80 px in the bottom-right corner. DASH 60 px on its inner arc. SPELL 56 px above it. POTION and OPEN move to small top-right or context buttons (OPEN only appears near a chest or shrine). Keep ≥12 px gaps. Fire on pointerdown (already done).
- **Auto-aim / soft lock:** while SLASH or SPELL is pressed, snap yaw toward the nearest enemy in a ~30° cone within range (setting: Auto-aim On/Off, default On for touch).
- **Camera:** keep drag-to-look in the right half *excluding* the button cluster's rect. Add a sensitivity slider separate from the mouse one (settings #17).
- **Dash:** tap = dash in the stick direction (backwards when the stick is centered).
- **Portrait:** keep the rotate prompt, but it must not intercept the start button's hit-test invisibly (or make it full-screen and explicit).

## 4. First-run onboarding hints
Show these on floor 1, once per profile (flag in `platform/storage`), and allow skipping:
1. "Click to look around" (desktop) / "Drag right side to look" (touch). Dismisses on the first look input.
2. "WASD to move" / "Left thumb to move". Dismisses after 1 s of movement.
3. "LMB to slash" / "Tap SLASH". Dismisses on the first hit.
4. "Space to dash through attacks" / "DASH". Shown when the first enemy telegraphs.
5. "E to open" contextual prompt near chests and shrines (both platforms).
All labels come from the live bindings.

## 5. PR split
| # | Size | Scope | Acceptance check |
|---|---|---|---|
| 1 | easy | Generate the desktop hint bar and elixir label from `keyBindings` + `keyLabel()` | Rebinding Dash to K shows "K Dash". No "F"/"Q" text unless bound. |
| 2 | regular | Split attack/dash: attack=LMB, dash=Space, drop `SHARED_KEY`, migrate saved bindings | Pressing Space dashes without attacking. LMB attacks. keybindings tests updated. |
| 3 | easy | The pointer-lock click does not attack. Show a "Click to look / Esc to release" overlay while unlocked | The first click locks without damage. The overlay is visible after Esc. |
| 4 | easy | Tap/click attack is edge-triggered (or explicitly hold-to-repeat); touches outside SLASH don't attack | e2e: a touch on the look area causes no attack. |
| 5 | regular | Floating joystick + resized/re-laid button cluster; look area excludes buttons | At 664×390 all targets ≥56 px, no overlap, and a stick spawns where the thumb lands. |
| 6 | regular | Touch auto-aim soft lock + setting toggle | Unit test: yaw snaps to the nearest enemy in the cone. The toggle persists. |
| 7 | easy | Dash follows the movement/stick direction | Unit test on the dash vector with strafe input. |
| 8 | regular | First-run onboarding hints (section 4) with a persisted "seen" flag | Fresh storage shows the hints. A second run doesn't. Labels follow the bindings. |
| 9 | easy | Separate touch look sensitivity in Settings | The slider changes touch yaw rate only. |
