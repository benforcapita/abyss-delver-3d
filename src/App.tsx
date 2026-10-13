// tslint:disable
/* eslint-disable */
import {
  Activity,
  Award,
  BookOpen,
  ChevronRight,
  Flame,
  Gamepad,
  Heart,
  HelpCircle,
  Info,
  Menu as MenuIcon,
  Play,
  RotateCw,
  Settings,
  Shield,
  Sparkles,
  Sword,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AVAILABLE_MUSIC_TRACKS, getConfig} from './constants';
import {ActionButtons} from './components/ActionButtons';
import {VirtualJoystick} from './components/VirtualJoystick';
import {Game} from './Game';
import {DebugPanel} from './components/DebugPanel';
import {Minimap} from './components/Minimap';
import {RotatePrompt} from './components/RotatePrompt';
import {isDebugEnabled} from './debug';
import {createMinimapBridge} from './minimap';
import {
  DungeonFloorData,
  EnemyEntity,
  ItemRarity,
  LootItem,
  PlayerStats,
} from './types';
import {formatTime, gameAudio} from './utils';
import BackgroundMusic from './utils/BackgroundMusic';
import {
  BestScoreLine,
  GameState,
  MenuOverlay,
  Overlay,
  useIsMobile,
} from './utils/helper';
import {sdk, useGameLifecycle} from './platform/lifecycle';
import {getSettings, saveSettings, subscribeSettings} from './platform/settings';
import {actionsForCode, type BindableAction} from './platform/keybindings';
import {markTouchAim} from './softLock';
import {controlHints} from './controlHints';
import {SettingsPanel} from './components/SettingsPanel';
import {FINAL_FLOOR, floorClearScore, isVictory, victoryBonus} from './rules';
import {loadBest, saveBest, type BestScore} from './bestScore';
import {isGamePaused} from './pause';
import {
  advance as advanceOnboarding,
  loadOnboarding,
  nextStep as nextOnboardingStep,
  saveOnboarding,
  skipAll as skipOnboarding,
  text as onboardingText,
  type OnboardingEvent,
  type OnboardingState,
} from './onboarding';
import {useLowHpVignette} from './fx/lowHpVignette';

interface CustomWindow extends Window {
  canHandleBackKey?: boolean;
}

const DEFAULT_WEAPON: LootItem = {
  id: 'w_init',
  name: 'Novice Steel Sword',
  type: 'weapon',
  rarity: 'common',
  level: 1,
  iconName: 'sword',
  description: 'A trusty blade from the Delvers Guild.',
  damage: 28,
  critChance: 0.1,
  lifeSteal: 0,
  glowColor: '#38bdf8',
};

const DEFAULT_ARMOR: LootItem = {
  id: 'a_init',
  name: 'Leather Vest',
  type: 'armor',
  rarity: 'common',
  level: 1,
  iconName: 'shield',
  description: 'Basic hardened leather padding.',
  defense: 12,
  maxHpBonus: 20,
};

const DEFAULT_RING: LootItem = {
  id: 'r_init',
  name: 'Delver Signet Ring',
  type: 'ring',
  rarity: 'common',
  level: 1,
  iconName: 'ring',
  description: 'Slightly enhances focus and footwork.',
  moveSpeedBonus: 0.5,
  critChance: 0.05,
  lifeSteal: 0,
};

export default function App() {
  const isMobile = useIsMobile();
  const debugEnabled = useMemo(
    () => isDebugEnabled(window.location.search, import.meta.env.DEV),
    [],
  );

  const [gameState, setGameState] = useState<GameState>({
    status: 'START',
    score: 0,
    level: 1,
  });

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // Audio settings
  const [sfxMuted, setSfxMuted] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(getSettings);
  useEffect(() => subscribeSettings(setSettings), []);
  // SFX volume is applied live to the procedural WebAudio master.
  useEffect(() => {
    gameAudio.setVolume(settings.sfxVolume);
  }, [settings.sfxVolume]);
  const [howToPlaySource, setHowToPlaySource] = useState<'main' | 'game'>('main');

  // Track pointer lock on desktop
  const [pointerLocked, setPointerLocked] = useState(
    () => typeof document !== 'undefined' && document.pointerLockElement != null,
  );
  useEffect(() => {
    const handlePointerLockChange = () => {
      setPointerLocked(document.pointerLockElement != null);
    };
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, []);

  // Player RPG stats
  const [playerStats, setPlayerStats] = useState<PlayerStats>({
    hp: getConfig('playerMaxHp'),
    maxHp: getConfig('playerMaxHp'),
    mana: getConfig('playerMaxMana'),
    maxMana: getConfig('playerMaxMana'),
    stamina: 100,
    maxStamina: 100,
    gold: 0,
    potions: 3,
    keys: 1,
    equippedWeapon: DEFAULT_WEAPON,
    equippedArmor: DEFAULT_ARMOR,
    equippedRing: DEFAULT_RING,
    baseAttack: 0,
    baseDefense: 0,
    baseSpeed: 0,
    critChance: 0.1,
    lifeSteal: 0,
    dashCooldown: 0,
    invulnerableTime: 0,
    attackCooldown: 0,
    spellCooldown: 0,
    swingAnim: 0,
    castAnim: 0,
  });

  // Loot popup notification
  const [recentLoot, setRecentLoot] = useState<LootItem | null>(null);
  const lootTimeoutRef = useRef<any>(null);

  // Floor transition modal
  const [showFloorSummary, setShowFloorSummary] = useState(false);

  // Boss defeat & victory bonus tracking (per floor / per run)
  const [bossDefeated, setBossDefeated] = useState(false);
  const [victoryBonusAmount, setVictoryBonusAmount] = useState(0);
  const victoryLatchedRef = useRef(false);

  const paused = isGamePaused({
    status: gameState.status,
    menuOpen: isGameMenuOpen,
    howToOpen: isHowToPlayOpen,
    floorSummaryOpen: showFloorSummary,
  });

  // Live key-hint labels; `settings` is kept fresh via subscribeSettings above.
  const hints = controlHints(settings.keyBindings);

  const showPointerLockHint =
    gameState.status === 'PLAYING' &&
    !isMobile &&
    !pointerLocked &&
    !isGameMenuOpen &&
    !isHowToPlayOpen &&
    !showFloorSummary;

  const vignetteRef = useRef<HTMLDivElement>(null);
  useLowHpVignette(
    vignetteRef,
    playerStats.hp,
    playerStats.maxHp,
    gameState.status === 'PLAYING',
    paused,
  );

  // Action refs triggered from UI & mobile controls
  const triggerAttackRef = useRef(false);
  const triggerSpellRef = useRef(false);
  const triggerDashRef = useRef(false);
  const triggerInteractRef = useRef(false);
  const joystickMoveRef = useRef({x: 0, y: 0});
  const touchLookDeltaRef = useRef({dx: 0, dy: 0});

  // Current boss & dungeon floor data for HUD
  const currentBossRef = useRef<EnemyEntity | null>(null);
  const [bossHudState, setBossHudState] = useState<EnemyEntity | null>(null);
  const activeEnemiesCountRef = useRef(0);
  const floorDataRef = useRef<DungeonFloorData | null>(null);
  const minimapBridgeRef = useRef(createMinimapBridge());

  // Best score (persisted in localStorage `ad3d.best.v1`). Saved once per
  // terminal transition (GAME_OVER / VICTORY), latched until a new run starts.
  const [best, setBest] = useState<BestScore>(() => loadBest());
  const bestSavedRef = useRef(false);
  useEffect(() => {
    const status = gameState.status;
    if (status === 'PLAYING') {
      bestSavedRef.current = false;
      return;
    }
    if ((status === 'GAME_OVER' || status === 'VICTORY') && !bestSavedRef.current) {
      bestSavedRef.current = true;
      setBest(saveBest({score: gameState.score, floor: gameState.level}));
    }
  }, [gameState.status, gameState.score, gameState.level]);

  // First-run onboarding hints (once per profile, 'ad3d.onboarding'). The
  // authoritative state lives in a ref because 'move' events arrive per frame;
  // React state only updates when the visible step changes.
  const [onboarding, setOnboarding] = useState<OnboardingState>(() =>
    loadOnboarding(),
  );
  const onboardingRef = useRef(onboarding);

  const handleOnboardingEvent = useCallback((e: OnboardingEvent) => {
    const prev = onboardingRef.current;
    if (prev.finished) return;
    const next = advanceOnboarding(prev, e);
    if (next === prev) return;
    onboardingRef.current = next;
    if (nextOnboardingStep(next) !== nextOnboardingStep(prev)) {
      saveOnboarding(next);
      setOnboarding(next);
    }
  }, []);

  const handleOnboardingSkip = useCallback(() => {
    const next = skipOnboarding(onboardingRef.current);
    onboardingRef.current = next;
    saveOnboarding(next);
    setOnboarding(next);
  }, []);

  // Onboarding hints only show during a fresh floor-1 run.
  const onboardingStep =
    gameState.status === 'PLAYING' && gameState.level === 1
      ? nextOnboardingStep(onboarding)
      : null;

  // Back key support
  useEffect(() => {
    (window as CustomWindow).canHandleBackKey = ['PLAYING', 'PAUSED'].includes(
      gameState.status,
    );
  }, [gameState.status]);

  // Sync boss state for HUD
  useEffect(() => {
    const interval = setInterval(() => {
      setBossHudState(currentBossRef.current);
    }, 150);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut for Escape -> Toggle Game Menu & 1/2/3 Hotkeys
  useEffect(() => {
    const dispatchBoundAction = (action: BindableAction) => {
      if (action === 'potion') {
        // Drink Potion
        drinkPotion();
      } else if (action === 'spell') {
        // Cast Fireball Spell
        triggerSpellRef.current = true;
      } else if (action === 'interact') {
        // Interact
        triggerInteractRef.current = true;
      } else if (action === 'dash') {
        // Dash
        triggerDashRef.current = true;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isHowToPlayOpen) {
          setIsHowToPlayOpen(false);
          return;
        }
        if (gameState.status === 'PLAYING') {
          setIsGameMenuOpen((prev) => !prev);
        }
      }

      if (gameState.status === 'PLAYING' && !isGameMenuOpen && !isHowToPlayOpen) {
        // Attack itself is read from the input snapshot in Game.
        for (const action of actionsForCode(getSettings().keyBindings, e.code)) {
          dispatchBoundAction(action);
        }
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      // Pointer-lock click guard (minimal; duplicates #34, drop whichever merges second).
      if (!document.pointerLockElement) return;
      if (gameState.status === 'PLAYING' && !isGameMenuOpen && !isHowToPlayOpen) {
        for (const action of actionsForCode(getSettings().keyBindings, 'Mouse0')) {
          dispatchBoundAction(action);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [gameState.status, isGameMenuOpen, isHowToPlayOpen, playerStats.potions]);

  // Potion Drinking Handler
  const drinkPotion = () => {
    if (playerStats.potions > 0 && playerStats.hp < playerStats.maxHp) {
      gameAudio.playPotionGulp();
      const heal = Math.round(playerStats.maxHp * 0.5);
      setPlayerStats((prev) => ({
        ...prev,
        hp: Math.min(prev.maxHp, prev.hp + heal),
        potions: prev.potions - 1,
      }));
    }
  };

  // Loot Found Callback (Auto-equip if superior or update stats)
  const handleLootFound = useCallback((item: LootItem) => {
    setRecentLoot(item);
    if (lootTimeoutRef.current) clearTimeout(lootTimeoutRef.current);
    lootTimeoutRef.current = setTimeout(() => {
      setRecentLoot(null);
    }, 3500);

    setPlayerStats((prev) => {
      let updated = {...prev};
      if (item.type === 'weapon') {
        const curDmg = prev.equippedWeapon.damage || 0;
        if ((item.damage || 0) >= curDmg) {
          updated.equippedWeapon = item;
          updated.critChance = 0.05 + (item.critChance || 0);
          updated.lifeSteal = item.lifeSteal || 0;
        }
      } else if (item.type === 'armor') {
        const curDef = prev.equippedArmor.defense || 0;
        if ((item.defense || 0) >= curDef) {
          updated.equippedArmor = item;
          updated.maxHp =
            getConfig('playerMaxHp') + (item.maxHpBonus || 0);
          updated.hp = Math.min(updated.maxHp, prev.hp + (item.maxHpBonus || 0));
        }
      } else if (item.type === 'ring') {
        updated.equippedRing = item;
      } else if (item.type === 'potion') {
        updated.potions = Math.min(9, prev.potions + 1);
        if (item.healAmount) {
          updated.hp = Math.min(prev.maxHp, prev.hp + item.healAmount);
        }
        if (item.manaAmount) {
          updated.mana = Math.min(prev.maxMana, prev.mana + item.manaAmount);
        }
      }
      return updated;
    });
  }, []);

  const handleBossDefeated = useCallback(() => {
    setBossDefeated(true);
  }, []);

  // Floor Clear / Next Level Flow
  const handleFloorClear = useCallback(() => {
    if (isVictory(gameState.level, bossDefeated, true)) {
      // Victory! Slayed final Void Overlord.
      // Latch so the per-frame portal check only applies the bonus once.
      if (victoryLatchedRef.current) return;
      victoryLatchedRef.current = true;
      const bonus = victoryBonus(playerStats.hp);
      setVictoryBonusAmount(bonus);
      setGameState((prev) => ({
        ...prev,
        status: 'VICTORY',
        score: prev.score + bonus,
      }));
      gameAudio.playVictoryFanfare();
    } else if (gameState.level < FINAL_FLOOR) {
      setShowFloorSummary(true);
    }
  }, [gameState.level, bossDefeated, playerStats.hp]);

  const advanceToNextFloor = () => {
    setShowFloorSummary(false);
    setBossDefeated(false);
    setGameState((prev) => ({
      ...prev,
      level: prev.level + 1,
      score: prev.score + floorClearScore(prev.level),
    }));
    // Restore partial health on descending
    setPlayerStats((prev) => ({
      ...prev,
      hp: Math.min(prev.maxHp, prev.hp + Math.round(prev.maxHp * 0.4)),
      mana: prev.maxMana,
      stamina: prev.maxStamina,
    }));
  };

  // Init Game / Restart Run
  const initGame = useCallback(() => {
    setGameState({
      status: 'PLAYING',
      score: 0,
      level: 1,
    });
    setPlayerStats({
      hp: getConfig('playerMaxHp'),
      maxHp: getConfig('playerMaxHp'),
      mana: getConfig('playerMaxMana'),
      maxMana: getConfig('playerMaxMana'),
      stamina: 100,
      maxStamina: 100,
      gold: 0,
      potions: 3,
      keys: 1,
      equippedWeapon: DEFAULT_WEAPON,
      equippedArmor: DEFAULT_ARMOR,
      equippedRing: DEFAULT_RING,
      baseAttack: 0,
      baseDefense: 0,
      baseSpeed: 0,
      critChance: 0.1,
      lifeSteal: 0,
      dashCooldown: 0,
      invulnerableTime: 0,
      attackCooldown: 0,
      spellCooldown: 0,
      swingAnim: 0,
      castAnim: 0,
    });
    setIsGameMenuOpen(false);
    setIsHowToPlayOpen(false);
    setShowFloorSummary(false);
    setBossDefeated(false);
    setVictoryBonusAmount(0);
    victoryLatchedRef.current = false;

    sdk.startGame();
  }, []);

  // Lifecycle reporting
  useGameLifecycle(gameState, sdk);

  // Auto-start check for previews
  const hasAutoplayed = useRef(false);
  useEffect(() => {
    if (
      !hasAutoplayed.current &&
      new URLSearchParams(window.location.search).has('autoplay')
    ) {
      hasAutoplayed.current = true;
      initGame();
    }
  }, [initGame]);

  const isMusicPlaying =
    ['PLAYING', 'PAUSED', 'LEVEL_COMPLETE'].includes(gameState.status) &&
    !musicMuted;

  // Touch look drag handler on mobile
  const touchLookStartRef = useRef<{x: number; y: number} | null>(null);

  const getRarityBadge = (rarity: ItemRarity) => {
    switch (rarity) {
      case 'legendary':
        return 'bg-amber-500/20 text-amber-400 border-amber-500';
      case 'epic':
        return 'bg-purple-500/20 text-purple-400 border-purple-500';
      case 'rare':
        return 'bg-blue-500/20 text-blue-400 border-blue-500';
      default:
        return 'bg-zinc-700/40 text-zinc-300 border-zinc-600';
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden touch-none flex flex-col bg-zinc-950 text-white font-sans select-none">
      <RotatePrompt />
      <BackgroundMusic
        url={
          gameState.level >= 5
            ? AVAILABLE_MUSIC_TRACKS[1].url
            : AVAILABLE_MUSIC_TRACKS[0].url
        }
        isPlaying={isMusicPlaying}
        isMuted={musicMuted}
        volume={settings.musicVolume}
      />

      {/* 3D WebGL Canvas Viewport */}
      <div className="flex-1 w-full min-h-0 relative flex items-center justify-center">
        <Game
          paused={paused}
          gameState={gameState}
          setGameState={setGameState}
          gameStateRef={gameStateRef}
          playerStats={playerStats}
          setPlayerStats={setPlayerStats}
          onLootFound={handleLootFound}
          onFloorClear={handleFloorClear}
          onBossDefeated={handleBossDefeated}
          onOnboardingEvent={handleOnboardingEvent}
          triggerAttackRef={triggerAttackRef}
          triggerSpellRef={triggerSpellRef}
          triggerDashRef={triggerDashRef}
          triggerInteractRef={triggerInteractRef}
          joystickMoveRef={joystickMoveRef}
          touchLookDeltaRef={touchLookDeltaRef}
          currentBossRef={currentBossRef}
          activeEnemiesCountRef={activeEnemiesCountRef}
          floorDataRef={floorDataRef}
          minimapBridgeRef={minimapBridgeRef}
        />

        <div
          ref={vignetteRef}
          className="low-hp-vignette"
          data-testid="low-hp-vignette"
          aria-hidden="true"
        />

        {/* HUD: Active Gameplay Safe Zones */}
        {gameState.status === 'PLAYING' && (
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 md:p-4 z-20 hud-safe">
            {/* Top Bar: Floor, Gold, Score, and Mandatory Game Menu Button */}
            <div className="w-full flex items-start justify-between gap-2">
              {/* Left Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="bg-black/70 backdrop-blur border border-amber-500/40 px-3 py-1 rounded-lg flex items-center gap-2 shadow-lg">
                  <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span className="text-xs md:text-sm font-bold tracking-wider text-amber-400">
                    FLOOR {gameState.level} / 5
                  </span>
                </div>

                <div className="bg-black/70 backdrop-blur border border-yellow-500/40 px-3 py-1 rounded-lg flex items-center gap-2 shadow-lg">
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs md:text-sm font-bold text-yellow-300">
                    {playerStats.gold} Gold
                  </span>
                </div>

                <div className="bg-black/70 backdrop-blur border border-zinc-700 px-3 py-1 rounded-lg flex items-center gap-1.5 shadow-lg">
                  <Trophy className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-xs text-zinc-300">
                    Score: {gameState.score}
                  </span>
                </div>
              </div>

              {/* Top Center: Floor Boss Health Bar */}
              {bossHudState && bossHudState.hp > 0 && (
                <div className="flex-1 min-w-0 max-w-xs md:max-w-md mx-2 flex flex-col items-center animate-fade-in">
                  <div className="flex items-center gap-2 mb-1">
                    <Flame className="w-4 h-4 text-red-500" />
                    <span className="text-xs md:text-sm font-black tracking-widest text-red-400 uppercase">
                      {bossHudState.name}
                    </span>
                  </div>
                  <div className="w-full bg-zinc-900/90 border-2 border-red-600 rounded-full h-3 md:h-4 overflow-hidden shadow-red-900/40 shadow-lg">
                    <div
                      className="bg-gradient-to-r from-red-600 via-orange-500 to-amber-400 h-full transition-all duration-200"
                      style={{
                        width: `${Math.max(0, (bossHudState.hp / bossHudState.maxHp) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* TOP RIGHT: menu, then the minimap in its own slot under it */}
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <div className="pointer-events-auto">
                  <button
                    onClick={() => setIsGameMenuOpen(true)}
                    className="bg-black/80 hover:bg-zinc-800 active:scale-95 text-amber-400 border border-amber-500/50 px-3 py-1.5 rounded-lg font-bold text-xs md:text-sm flex items-center gap-1.5 shadow-xl transition-all">
                    <MenuIcon className="w-4 h-4" />
                    <span>MENU</span>
                  </button>
                </div>
                <Minimap bridge={minimapBridgeRef} active />
              </div>
            </div>

            {/* First-Run Onboarding Hint (top-center, under the boss bar) */}
            {onboardingStep && (
              <div
                data-testid="onboarding-hint"
                className="pointer-events-none absolute left-1/2 top-14 md:top-16 -translate-x-1/2 flex items-center gap-2 bg-black/80 backdrop-blur border border-amber-500/50 px-3 py-1.5 rounded-lg shadow-xl animate-fade-in">
                <Info className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs md:text-sm font-bold text-amber-200 whitespace-nowrap">
                  {onboardingText(
                    onboardingStep,
                    settings.keyBindings,
                    isMobile,
                  )}
                </span>
                <button
                  type="button"
                  data-testid="onboarding-skip"
                  onClick={handleOnboardingSkip}
                  className="pointer-events-auto shrink-0 text-[10px] md:text-xs font-bold text-zinc-400 hover:text-white underline underline-offset-2 transition-colors">
                  Skip
                </button>
              </div>
            )}

            {/* Crosshair in Center Viewport */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-3 h-3 relative opacity-60">
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-amber-300" />
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-amber-300" />
              </div>
            </div>

            {/* Recent Loot Toast Notification */}
            {recentLoot && (
              <div className="self-center bg-black/90 backdrop-blur border-2 border-amber-500 px-4 py-2 rounded-xl flex items-center gap-3 shadow-2xl animate-bounce pointer-events-auto">
                <Award className="w-5 h-5 text-amber-400" />
                <div>
                  <div className="text-[10px] uppercase font-bold text-amber-400">
                    Discovered {recentLoot.rarity} Item
                  </div>
                  <div className="text-xs md:text-sm font-black text-white">
                    {recentLoot.name}
                  </div>
                  <div className="text-[10px] text-zinc-300">
                    {recentLoot.description}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Bar: Health, Mana, Stamina, Equipment & Action Controls */}
            <div
              className={
                isMobile
                  ? 'w-full flex justify-center'
                  : 'w-full flex flex-col md:flex-row items-end md:items-center justify-between gap-3'
              }>
              {/* Health & Mana Orbs / Gauges */}
              <div
                data-testid="hud-vitals"
                className="flex flex-col gap-1.5 bg-black/80 backdrop-blur border border-zinc-800 p-2.5 rounded-xl shadow-xl w-48 md:w-56">
                {/* Health Bar */}
                <div>
                  <div className="flex justify-between text-[11px] font-bold mb-0.5 text-red-400">
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3 fill-red-500" /> HP
                    </span>
                    <span>
                      {playerStats.hp} / {playerStats.maxHp}
                    </span>
                  </div>
                  <div className="w-full bg-zinc-900 rounded-full h-2.5 overflow-hidden border border-red-950">
                    <div
                      className="bg-red-500 h-full transition-all duration-150"
                      style={{
                        width: `${Math.max(0, (playerStats.hp / playerStats.maxHp) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Mana Bar */}
                <div>
                  <div className="flex justify-between text-[11px] font-bold mb-0.5 text-sky-400">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3 fill-sky-500" /> MANA
                    </span>
                    <span>
                      {Math.floor(playerStats.mana)} / {playerStats.maxMana}
                    </span>
                  </div>
                  <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-sky-950">
                    <div
                      className="bg-sky-500 h-full transition-all duration-150"
                      style={{
                        width: `${Math.max(0, (playerStats.mana / playerStats.maxMana) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Stamina / Dash Gauge */}
                <div>
                  <div className="flex justify-between text-[10px] text-emerald-400">
                    <span>STAMINA</span>
                    <span>{Math.floor(playerStats.stamina)}%</span>
                  </div>
                  <div className="w-full bg-zinc-900 rounded-full h-1 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full"
                      style={{
                        width: `${(playerStats.stamina / playerStats.maxStamina) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Equipment Hotbar Display */}
              {!isMobile && (
                <div className="hidden md:flex items-center gap-2 bg-black/80 backdrop-blur border border-zinc-800 p-2 rounded-xl">
                <div
                  className={`border px-2.5 py-1.5 rounded-lg flex items-center gap-2 ${getRarityBadge(
                    playerStats.equippedWeapon.rarity,
                  )}`}>
                  <Sword className="w-4 h-4" />
                  <div>
                    <div className="text-[10px] font-bold">
                      {playerStats.equippedWeapon.name}
                    </div>
                    <div className="text-[9px] opacity-80">
                      +{playerStats.equippedWeapon.damage} Dmg
                    </div>
                  </div>
                </div>

                <div
                  className={`border px-2.5 py-1.5 rounded-lg flex items-center gap-2 ${getRarityBadge(
                    playerStats.equippedArmor.rarity,
                  )}`}>
                  <Shield className="w-4 h-4" />
                  <div>
                    <div className="text-[10px] font-bold">
                      {playerStats.equippedArmor.name}
                    </div>
                    <div className="text-[9px] opacity-80">
                      +{playerStats.equippedArmor.defense} Def
                    </div>
                  </div>
                </div>

                <button
                  onClick={drinkPotion}
                  className="pointer-events-auto bg-red-950/80 hover:bg-red-900 border border-red-600 px-3 py-1.5 rounded-lg flex items-center gap-2 text-red-200 transition-all">
                  <Heart className="w-4 h-4 fill-red-500" />
                  <div className="text-left">
                    <div className="text-[10px] font-black">
                      ELIXIR ({playerStats.potions})
                    </div>
                    <div
                      className="text-[9px] text-red-300"
                      data-testid="elixir-key">
                      Key: {hints.potion}
                    </div>
                  </div>
                </button>
                </div>
              )}

              {/* Desktop Key Controls Helper */}
              {!isMobile && (
                <div
                  data-testid="key-hints"
                  className="bg-black/60 backdrop-blur border border-zinc-800/80 px-3 py-1.5 rounded-lg text-[10px] text-zinc-400">
                  <span className="text-amber-400 font-bold">{hints.move}</span>{' '}
                  Move ·{' '}
                  <span className="text-amber-400 font-bold">{hints.attack}</span>{' '}
                  Slash ·{' '}
                  <span className="text-sky-400 font-bold">{hints.spell}</span>{' '}
                  Fireball ·{' '}
                  <span className="text-emerald-400 font-bold">{hints.dash}</span>{' '}
                  Dash ·{' '}
                  <span className="text-yellow-400 font-bold">
                    {hints.interact}
                  </span>{' '}
                  Interact
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pointer Lock Hint */}
        {showPointerLockHint && (
          <div
            data-testid="pointer-lock-hint"
            className="absolute inset-0 pointer-events-none flex items-center justify-center z-20"
          >
            <div className="pointer-events-none bg-black/75 backdrop-blur border border-amber-500/40 px-4 py-2 rounded-xl flex flex-col items-center gap-0.5 shadow-lg text-center">
              <span className="text-sm md:text-base font-bold tracking-wide text-amber-400">
                Click to look
              </span>
              <span className="text-[10px] md:text-xs text-zinc-400">
                Esc to release
              </span>
            </div>
          </div>
        )}

        {/* Mobile Touch Drag Look Area (Right Side of Screen) */}
        {isMobile && gameState.status === 'PLAYING' && (
          <div
            className="absolute inset-y-0 right-0 w-1/2 pointer-events-auto touch-none z-10"
            onPointerDown={(e) => {
              touchLookStartRef.current = {x: e.clientX, y: e.clientY};
            }}
            onPointerMove={(e) => {
              if (touchLookStartRef.current) {
                const dx = e.clientX - touchLookStartRef.current.x;
                const dy = e.clientY - touchLookStartRef.current.y;
                touchLookDeltaRef.current = {dx, dy};
                touchLookStartRef.current = {x: e.clientX, y: e.clientY};
              }
            }}
            onPointerUp={() => {
              touchLookStartRef.current = null;
            }}
            onPointerCancel={() => {
              touchLookStartRef.current = null;
            }}
          />
        )}

        {/* Mobile Virtual Joystick & Action Buttons Overlay */}
        {isMobile && gameState.status === 'PLAYING' && (
          <div className="absolute inset-x-0 bottom-3 px-6 pointer-events-none flex justify-between items-end z-30 hud-safe-controls" data-testid="mobile-controls">
            <VirtualJoystick moveRef={joystickMoveRef} />
            <ActionButtons
              onAttack={() => {
                markTouchAim();
                triggerAttackRef.current = true;
              }}
              onSpell={() => {
                markTouchAim();
                triggerSpellRef.current = true;
              }}
              onDash={() => (triggerDashRef.current = true)}
              onInteract={() => (triggerInteractRef.current = true)}
              onPotion={drinkPotion}
              potions={playerStats.potions}
            />
          </div>
        )}
      </div>

      {/* Main Menu Start Screen */}
      {gameState.status === 'START' && (
        <MenuOverlay tone="neutral">
          <div className="bg-zinc-950 border-2 border-amber-500/60 p-6 md:p-8 rounded-2xl shadow-2xl flex flex-col items-center w-full max-w-md text-center">
            <div className="w-14 h-14 bg-amber-500/20 rounded-full flex items-center justify-center mb-4 border border-amber-500/40">
              <Sword className="w-8 h-8 text-amber-400" />
            </div>

            <h1 className="text-3xl md:text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500">
              {getConfig('title') || 'ABYSS DELVER 3D'}
            </h1>

            <p className="text-xs md:text-sm text-zinc-300 mb-6 max-w-xs">
              Conquer 5 procedurally generated dungeon depths. Slay fearsome
              bosses, collect tiered enchanted loot, and survive the Abyss.
            </p>

            <BestScoreLine best={best} className="mb-4" />

            <button
              onClick={initGame}
              autoFocus
              data-testid="start-button"
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black px-6 py-3.5 rounded-full font-black text-base md:text-lg transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-xl mb-3">
              <Play className="w-5 h-5 fill-black" />
              START DUNGEON RUN
            </button>

            <button
              onClick={() => {
                setHowToPlaySource('main');
                setIsHowToPlayOpen(true);
              }}
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 px-4 py-2.5 rounded-full font-bold text-xs md:text-sm transition-colors flex items-center justify-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-400" />
              HOW TO PLAY & CONTROLS
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              data-testid="settings-button"
              className="w-full mt-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 px-4 py-2.5 rounded-full font-bold text-xs md:text-sm transition-colors flex items-center justify-center gap-2">
              <Settings className="w-4 h-4 text-amber-400" />
              SETTINGS
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* Settings Panel (from main menu) */}
      {isSettingsOpen && (
        <MenuOverlay tone="neutral" zIndex={50}>
          <SettingsPanel
            settings={settings}
            onChange={(patch) => saveSettings(patch)}
            onClose={() => setIsSettingsOpen(false)}
          />
        </MenuOverlay>
      )}

      {/* Floor Cleared Summary Modal */}
      {showFloorSummary && (
        <MenuOverlay tone="victory">
          <div className="bg-zinc-950 border-2 border-emerald-500 p-6 md:p-8 rounded-2xl shadow-2xl flex flex-col items-center w-full max-w-md text-center">
            <Trophy className="w-12 h-12 text-emerald-400 mb-3 animate-bounce" />
            <h2 className="text-2xl md:text-4xl font-black text-emerald-400 mb-2">
              FLOOR {gameState.level} CONQUERED!
            </h2>
            <p className="text-xs md:text-sm text-zinc-300 mb-6">
              The Boss has fallen and the stairs to the deeper crypt are now
              unlocked.
            </p>

            <div className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 mb-6 text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-zinc-400">Total Score:</span>
                <span className="font-bold text-yellow-400">
                  {gameState.score}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Gold Hoarded:</span>
                <span className="font-bold text-amber-300">
                  {playerStats.gold}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Equipped Weapon:</span>
                <span className="font-bold text-sky-400">
                  {playerStats.equippedWeapon.name} (+
                  {playerStats.equippedWeapon.damage} Dmg)
                </span>
              </div>
            </div>

            <button
              onClick={advanceToNextFloor}
              autoFocus
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-3 rounded-full font-black text-sm md:text-base transition-all flex items-center justify-center gap-2 shadow-lg">
              <span>DESCEND TO FLOOR {gameState.level + 1}</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* Pause / In-Game Menu Overlay */}
      {isGameMenuOpen && (
        <MenuOverlay tone="neutral" zIndex={40}>
          <div className="w-full max-w-md flex flex-col items-center bg-zinc-900 border-2 border-amber-500/60 rounded-xl p-6 shadow-2xl">
            <h2 className="text-2xl md:text-3xl font-black mb-6 text-amber-400">
              GAME MENU
            </h2>

            <div className="w-full flex flex-col gap-3 mb-6">
              {/* Resume */}
              <button
                onClick={() => setIsGameMenuOpen(false)}
                autoFocus
                className="w-full bg-amber-500 hover:bg-amber-400 text-black py-2.5 rounded-lg font-black text-sm md:text-base flex items-center justify-center gap-2 transition-all">
                <Play className="w-4 h-4 fill-black" />
                RESUME GAME
              </button>

              {/* Sound & Music Toggles */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    const newMuted = gameAudio.toggleMute();
                    setSfxMuted(newMuted);
                  }}
                  className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2">
                  {sfxMuted ? (
                    <VolumeX className="w-4 h-4 text-red-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  )}
                  SFX: {sfxMuted ? 'OFF' : 'ON'}
                </button>

                <button
                  onClick={() => setMusicMuted(!musicMuted)}
                  className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2">
                  {musicMuted ? (
                    <VolumeX className="w-4 h-4 text-red-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  )}
                  MUSIC: {musicMuted ? 'OFF' : 'ON'}
                </button>
              </div>

              {/* Restart Floor */}
              <button
                onClick={initGame}
                className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 py-2.5 rounded-lg font-bold text-xs md:text-sm flex items-center justify-center gap-2">
                <RotateCw className="w-4 h-4 text-amber-400" />
                RESTART RUN
              </button>

              {/* How to play */}
              <button
                onClick={() => {
                  setHowToPlaySource('game');
                  setIsHowToPlayOpen(true);
                }}
                className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 py-2.5 rounded-lg font-bold text-xs md:text-sm flex items-center justify-center gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-400" />
                  HOW TO PLAY
                </button>
            </div>

            {/* Quit to Main Menu */}
            <button
              onClick={() => {
                setIsGameMenuOpen(false);
                setGameState((prev) => ({...prev, status: 'START'}));
              }}
              className="text-xs text-zinc-400 hover:text-red-400 underline transition-colors">
              Quit to Title Screen
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* How To Play Overlay */}
      {isHowToPlayOpen && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 overflow-y-auto touch-auto"
          style={{zIndex: 1001}}>
          <div className="w-full max-w-md bg-zinc-950 border-2 border-amber-500 rounded-2xl p-6 shadow-2xl text-left">
            <h2 className="text-xl md:text-2xl font-black text-amber-400 mb-4 flex items-center gap-2">
              <BookOpen className="w-6 h-6" />
              HOW TO PLAY & SURVIVE
            </h2>

            <div className="space-y-3 text-xs md:text-sm text-zinc-300 mb-6">
              <p>
                ⚔️ <strong className="text-white">Combat:</strong> Left-click or
                tap <em>SLASH</em> for melee sword swings. Press 2 / F or tap{' '}
                <em>SPELL</em> to launch a fireball using Mana.
              </p>
              <p>
                🛡️ <strong className="text-white">Evasion:</strong> Spacebar or{' '}
                <em>DASH</em> provides instant invulnerability frames to dodge
                boss shockwaves.
              </p>
              <p>
                💎 <strong className="text-white">Loot & Scaling:</strong> Open
                treasure chests to find Weapons, Armor, and Rings. Better loot
                boosts your stats and prepares you for evolving floor boss
                threats!
              </p>
              <p>
                🧪 <strong className="text-white">Elixirs & Shrines:</strong>{' '}
                Press Q or 1 to drink healing potions. Blue/Red Shrines restore
                Mana and HP to full.
              </p>
            </div>

            <button
              onClick={() => setIsHowToPlayOpen(false)}
              autoFocus
              className="w-full bg-amber-500 hover:bg-amber-400 text-black py-2.5 rounded-full font-black text-sm transition-colors">
              CLOSE GUIDE
            </button>
          </div>
        </div>
      )}

      {/* Victory Screen */}
      {gameState.status === 'VICTORY' && (
        <Overlay
          title="PRIME RELIC SECURED!"
          description={`You conquered all ${FINAL_FLOOR} floors and defeated the Void Overlord! Final Score: ${gameState.score} (incl. Victory Bonus +${victoryBonusAmount})`}
          actionLabel="NEW ADVENTURE"
          onAction={initGame}
          icon={<Trophy className="w-6 h-6 text-black" />}
          tone="victory">
          <BestScoreLine best={best} className="mb-6" />
        </Overlay>
      )}

      {/* Game Over Screen */}
      {gameState.status === 'GAME_OVER' && (
        <Overlay
          title="YOU PERISHED IN THE ABYSS"
          description={`Reached Floor ${gameState.level} · Final Score: ${gameState.score}`}
          actionLabel="TRY AGAIN"
          onAction={initGame}
          icon={<RotateCw className="w-6 h-6 text-black" />}
          tone="danger">
          <BestScoreLine best={best} className="mb-6" />
        </Overlay>
      )}

      {debugEnabled && gameState.status === 'PLAYING' && (
        <DebugPanel
          onSkipFloor={() => {
            if (gameState.level < FINAL_FLOOR) {
              advanceToNextFloor();
            }
          }}
        />
      )}
    </div>
  );
}
