// tslint:disable
/* eslint-disable */
import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {Bloom, EffectComposer} from '@react-three/postprocessing';
import type {MutableRefObject} from 'react';
import React, {Suspense, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';
import {
  advanceTelegraph,
  BOSS_TELEGRAPH_WINDUP,
  isInsideRing,
  meleeHitLands,
  startTelegraph,
  usesGroundTelegraph,
} from './bossTelegraph';
import {LiveBossTelegraph} from './components/BossTelegraph';
import {DungeonLevel} from './components/DungeonLevel';
import {EnemyModel} from './components/enemies/EnemyModel';
import {createAnimClock} from './components/enemies/shared';
import {alertTo, perceive} from './enemyPerception';
import {isWalkableWorld, moveWithCollision} from './navigation';
import {angleDiff} from './softLock';
import {getTouchLookSensitivity} from './platform/settings';
import {takeTouchAimYaw} from './softLock';
import {cameraMoveVector} from './cameraBasis';
import {AIM_ASSIST_CONE_DEG, AIM_ASSIST_RANGE, getConfig} from './constants';
import {dashDirection, moveInputFrom} from './dash';
import {applyCameraLocalPose, createFlashMap, holdHitFlashes, PLAYER_FLASH_ID, syncHitFlashes, triggerHitFlash} from './fx/hitFlash';
import {createHitStopState, isHeavyHit, stepHitStop, triggerHitStop} from './fx/hitStop';
import {
  createShakeState,
  isScreenShakeEnabled,
  outgoingShakeAmount,
  playerHurtShake,
  stepScreenShake,
  triggerScreenShake,
} from './fx/screenShake';
import {FloatingTextStore} from './floatingText';
import {FloatingTextSprite} from './components/FloatingTextSprite';
import {roomClearChests} from './drops';
import {generateDungeonFloor} from './dungeonGenerator';
import {createOneShotLatch} from './floorLatch';
import {InputSnapshot, useInput} from './input';
import {syncMinimapBridge, type MinimapBridge} from './minimap';
import type {OnboardingEvent} from './onboarding';
import {enemyKillScore, isGameOver} from './rules';
import {applyDamage, debugCheats} from './debug';
import {
  ChestEntity,
  DungeonFloorData,
  EnemyEntity,
  FloatingText,
  LootItem,
  PlayerStats,
  Position3D,
  Projectile,
  ShrineEntity,
  SparkParticle,
  TrapEntity,
} from './types';
import {gameAudio} from './utils';
import {GameState} from './utils/helper';
import {frameDelta} from './pause';
import {nearChestOrShrine} from './controls/interactRange';

interface GameProps {
  paused: boolean;
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  gameStateRef: MutableRefObject<GameState>;
  playerStats: PlayerStats;
  setPlayerStats: React.Dispatch<React.SetStateAction<PlayerStats>>;
  onLootFound: (item: LootItem) => void;
  onFloorClear: () => void;
  onBossDefeated?: () => void;
  onOnboardingEvent?: (e: OnboardingEvent) => void;
  triggerAttackRef: MutableRefObject<boolean>;
  triggerSpellRef: MutableRefObject<boolean>;
  triggerDashRef: MutableRefObject<boolean>;
  triggerInteractRef: MutableRefObject<boolean>;
  joystickMoveRef: MutableRefObject<{x: number; y: number}>;
  touchLookDeltaRef: MutableRefObject<{dx: number; dy: number}>;
  /** Set each frame when a chest or shrine is within interact range. */
  interactAvailableRef?: MutableRefObject<boolean>;
  currentBossRef: MutableRefObject<EnemyEntity | null>;
  activeEnemiesCountRef: MutableRefObject<number>;
  floorDataRef: MutableRefObject<DungeonFloorData | null>;
  minimapBridgeRef: MutableRefObject<MinimapBridge>;
}

// Scratch temporaries for zero-allocation game loop
const scratchVec1 = new THREE.Vector3();
const scratchVec2 = new THREE.Vector3();
const forwardVec = new THREE.Vector3();

/** Player body half-extent used for wall collision (keeps the camera out of walls). */
const PLAYER_RADIUS = 0.4;
/** A press during the attack cooldown is remembered this long and fires as soon as it ends. */
const ATTACK_BUFFER_S = 0.2;
/** Regen/cooldown HUD state is pushed to React at this rate instead of every frame. */
const STATS_SYNC_S = 1 / 20;
/** Max enemy turn speed (rad/s) so heads and bodies swing round smoothly. */
const ENEMY_TURN_RATE = 9;
/** Idle enemies slowly scan left/right (rad/s amplitude). */
const IDLE_SCAN_RATE = 0.35;

const projectileGeo = new THREE.SphereGeometry(1, 14, 10);
const sparkGeo = new THREE.SphereGeometry(1, 6, 5);

function turnToward(current: number, target: number, maxStep: number): number {
  const d = angleDiff(target, current);
  return current + Math.max(-maxStep, Math.min(maxStep, d));
}

/** Inner Scene Component handling Camera, Combat, Entities, Lighting, and FX */
function DungeonScene({
  paused,
  gameState,
  setGameState,
  inputRef,
  playerStats,
  setPlayerStats,
  onLootFound,
  onFloorClear,
  onBossDefeated,
  onOnboardingEvent,
  triggerAttackRef,
  triggerSpellRef,
  triggerDashRef,
  triggerInteractRef,
  joystickMoveRef,
  touchLookDeltaRef,
  interactAvailableRef,
  currentBossRef,
  activeEnemiesCountRef,
  floorDataRef,
  minimapBridgeRef,
}: GameProps & {inputRef: MutableRefObject<InputSnapshot>}): React.ReactElement {
  const {camera, gl} = useThree();

  // Floor and mob data
  const floorLevel = gameState.level;
  const [stairsUnlocked, setStairsUnlocked] = useState(false);
  const floorLatchRef = useRef(createOneShotLatch());
  const [floorData, setFloorData] = useState<DungeonFloorData>(() => {
    const {floorData} = generateDungeonFloor(floorLevel, 0);
    return floorData;
  });

  const [enemies, setEnemies] = useState<EnemyEntity[]>([]);
  const enemiesRef = useRef<EnemyEntity[]>([]);
  enemiesRef.current = enemies;

  const [chests, setChests] = useState<ChestEntity[]>([]);
  const chestsRef = useRef<ChestEntity[]>([]);
  chestsRef.current = chests;

  const [shrines, setShrines] = useState<ShrineEntity[]>([]);
  const shrinesRef = useRef<ShrineEntity[]>([]);
  shrinesRef.current = shrines;

  const [traps, setTraps] = useState<TrapEntity[]>([]);
  const trapsRef = useRef<TrapEntity[]>([]);
  trapsRef.current = traps;

  // Projectiles, Floating texts, Particles
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  projectilesRef.current = projectiles;

  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const textStore = useRef(new FloatingTextStore()).current;

  const [particles, setParticles] = useState<SparkParticle[]>([]);
  const particlesRef = useRef<SparkParticle[]>([]);
  particlesRef.current = particles;

  // First-person Player Kinematics
  const playerPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.5, 0));
  const playerYaw = useRef(0);
  const playerPitch = useRef(0);
  const headBob = useRef(0);
  const dashTimer = useRef(0);
  const isDashing = useRef(false);
  const dashDir = useRef<THREE.Vector3>(new THREE.Vector3());
  const screenShake = useRef(createShakeState());
  const lastShake = useRef({x: 0, y: 0});
  const hitStop = useRef(createHitStopState());
  const hitFlashes = useRef(createFlashMap());
  const lastFxNow = useRef(0);
  const flashTargets = useRef(new Map<string, THREE.Object3D>());
  const registerFlash = useCallback((id: string, node: THREE.Object3D | null) => {
    if (node) flashTargets.current.set(id, node);
    else flashTargets.current.delete(id);
  }, []);
  const lastFootstepDist = useRef(0);
  const torchLightRef = useRef<THREE.PointLight>(null);
  /** Frame clock for enemy animation; frozen by pause and hit-stop. */
  const animClock = useRef(createAnimClock()).current;
  /**
   * Authoritative cooldowns, ticked every frame. Gating actions on these
   * (rather than on React state) keeps input response frame-exact while the
   * HUD copy in playerStats is only synced at STATS_SYNC_S.
   */
  const cooldowns = useRef({attack: 0, spell: 0, dash: 0, invul: 0});
  const attackBuffer = useRef(0);
  const statsSyncTimer = useRef(0);

  // Weapon Viewmodel Swing Animation Ref
  const viewmodelRef = useRef<THREE.Group>(null);
  const wandGlowRef = useRef<THREE.PointLight>(null);
  const swingProgress = useRef(0);
  const castProgress = useRef(0);

  // Latch so GAME_OVER status & defeat motif fire exactly once per run
  const gameOverLatchedRef = useRef(false);
  const wasPausedRef = useRef(true);

  // Initialize floor layout and player spawn
  useEffect(() => {
    const totalPower =
      (playerStats.equippedWeapon.damage || 20) +
      (playerStats.equippedArmor.defense || 10) +
      (playerStats.equippedRing.critChance || 0) * 100;

    const generated = generateDungeonFloor(floorLevel, totalPower, Date.now() + floorLevel * 1000);
    setFloorData(generated.floorData);
    setStairsUnlocked(false);
    floorLatchRef.current.reset();
    floorDataRef.current = generated.floorData;
    setEnemies(generated.enemies);
    setChests(generated.floorData.chests);
    setShrines(generated.floorData.shrines);
    setTraps(generated.floorData.traps);
    setProjectiles([]);
    textStore.clear();
    setFloatingTexts([]);
    setParticles([]);

    // Set player position to spawn room center
    const sp = generated.floorData.spawnPos;
    playerPos.current.set(sp[0], 1.5, sp[2]);
    camera.position.set(sp[0], 1.5, sp[2]);
    playerYaw.current = 0;
    playerPitch.current = 0;
    syncMinimapBridge(minimapBridgeRef.current, {
      tiles: generated.floorData.tiles,
      rooms: generated.floorData.rooms,
      gridSize: generated.floorData.gridSize,
      playerX: sp[0],
      playerZ: sp[2],
      playerYaw: 0,
      enemies: generated.enemies,
      chests: generated.floorData.chests,
      stairs: generated.floorData.stairs,
    });

    gameAudio.playFootstepStone();
  }, [floorLevel]);

  // Reset the game-over latch whenever a new run begins
  useEffect(() => {
    if (gameState.status === 'PLAYING') {
      gameOverLatchedRef.current = false;
    }
  }, [gameState.status]);

  // Pointer lock for Desktop First Person FPS mouse look
  useEffect(() => {
    const handlePointerLockChange = () => {
      // track lock state
      if (document.pointerLockElement === gl.domElement) {
        onOnboardingEvent?.({type: 'look'});
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === gl.domElement) {
        const sens = getConfig('lookSensitivity') * 0.0022;
        playerYaw.current -= e.movementX * sens;
        playerPitch.current -= e.movementY * sens;
        // Clamp pitch to [-80deg, 80deg]
        playerPitch.current = Math.max(
          -Math.PI / 2.2,
          Math.min(Math.PI / 2.2, playerPitch.current),
        );
        if (e.movementX !== 0 || e.movementY !== 0) {
          onOnboardingEvent?.({type: 'look'});
        }
      }
    };

    const handleCanvasClick = () => {
      if (gameState.status === 'PLAYING' && document.pointerLockElement !== gl.domElement) {
        // Raw mouse deltas (no OS acceleration/smoothing) where supported, for the most direct aim.
        const el = gl.domElement;
        const fallback = () => Promise.resolve(el.requestPointerLock?.()).catch(() => {});
        try {
          Promise.resolve(el.requestPointerLock?.({unadjustedMovement: true})).catch(fallback);
        } catch {
          void fallback();
        }
      }
    };

    document.addEventListener('pointerlockchange', handlePointerLockChange);
    window.addEventListener('mousemove', handleMouseMove);
    gl.domElement.addEventListener('click', handleCanvasClick);

    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      window.removeEventListener('mousemove', handleMouseMove);
      gl.domElement.removeEventListener('click', handleCanvasClick);
    };
  }, [gl, gameState.status]);

  // Spawn visual floating damage / loot text
  const spawnFloatingText = (
    text: string,
    pos: Position3D,
    color = '#ffffff',
    isCrit = false,
  ) => {
    textStore.spawn(text, pos, color, isCrit);
    setFloatingTexts([...textStore.list]);
  };

  // Spawn spark hit particles
  const spawnSparks = (pos: Position3D, color = '#f59e0b', count = 8) => {
    const newParticles: SparkParticle[] = [];
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: `p_${Date.now()}_${Math.random()}`,
        pos: [...pos],
        vel: [
          (Math.random() - 0.5) * 6,
          Math.random() * 5 + 1,
          (Math.random() - 0.5) * 6,
        ],
        color,
        size: Math.random() * 0.15 + 0.08,
        life: 0,
        maxLife: Math.random() * 0.4 + 0.3,
      });
    }
    setParticles((prev) => [...prev.slice(-40), ...newParticles]);
  };

  // Player Melee Sword Strike
  const confirmHeldRef = useRef(false);
  const executeAttack = () => {
    if (cooldowns.current.attack > 0) {
      attackBuffer.current = ATTACK_BUFFER_S;
      return;
    }
    attackBuffer.current = 0;
    cooldowns.current.attack = 0.35;
    onOnboardingEvent?.({type: 'attack'});
    window.dispatchEvent(new CustomEvent('player-attack')); // Lightweight hook used by e2e to count attacks
    swingProgress.current = 1.0;
    castProgress.current = 0;
    gameAudio.playSwordClash();

    // Check hit against enemies in front
    const pPos = playerPos.current;
    const pYaw = playerYaw.current;
    forwardVec.set(-Math.sin(pYaw), 0, -Math.cos(pYaw)).normalize();

    const reach = 3.5;
    const baseDmg =
      (playerStats.equippedWeapon.damage || getConfig('baseSwordDamage')) +
      playerStats.baseAttack;

    enemiesRef.current.forEach((enemy) => {
      if (enemy.hp <= 0) return;
      scratchVec1.set(enemy.pos[0], enemy.pos[1], enemy.pos[2]);
      const dist = pPos.distanceTo(scratchVec1);
      if (dist <= reach) {
        scratchVec2.subVectors(scratchVec1, pPos).normalize();
        const dot = forwardVec.dot(scratchVec2);
        if (dot > 0.4) {
          const isCrit = Math.random() < playerStats.critChance;
          const dmg = Math.round(
            baseDmg * (isCrit ? 1.8 : 1.0) * (0.9 + Math.random() * 0.2),
          );

          enemy.hp -= dmg;
          enemy.state = 'hurt';
          enemy.stateTimer = 0.2;
          alertTo(enemy, pPos.x, pPos.z);
          triggerHitFlash(hitFlashes.current, enemy.id, performance.now());
          triggerScreenShake(screenShake.current, outgoingShakeAmount(dmg, isCrit));
          if (isHeavyHit(dmg, isCrit)) triggerHitStop(hitStop.current);

          spawnFloatingText(
            isCrit ? `${dmg}! CRIT` : `${dmg}`,
            enemy.pos,
            isCrit ? '#f59e0b' : '#ef4444',
            isCrit,
          );
          spawnSparks(enemy.pos, isCrit ? '#fbbf24' : '#ef4444', 10);

          // Life steal
          if (playerStats.lifeSteal > 0) {
            const heal = Math.max(1, Math.round(dmg * playerStats.lifeSteal));
            setPlayerStats((prev) => ({
              ...prev,
              hp: Math.min(prev.maxHp, prev.hp + heal),
            }));
            spawnFloatingText(`+${heal} HP`, [pPos.x, pPos.y + 0.8, pPos.z], '#22c55e');
          }

          if (enemy.hp <= 0) {
            handleEnemyDefeated(enemy);
          }
        }
      }
    });

  };

  // Player Magic Fireball Cast
  const executeSpell = () => {
    if (cooldowns.current.spell > 0 || playerStats.mana < 15) {
      if (playerStats.mana < 15) {
        gameAudio.playShieldBlock();
      }
      return;
    }
    cooldowns.current.spell = 0.6;
    castProgress.current = 1.0;
    gameAudio.playArcadeLaser();

    setPlayerStats((prev) => ({
      ...prev,
      mana: Math.max(0, prev.mana - 15),
    }));

    const pPos = playerPos.current;
    const pYaw = playerYaw.current;
    const pPitch = playerPitch.current;

    forwardVec
      .set(
        -Math.sin(pYaw) * Math.cos(pPitch),
        Math.sin(pPitch),
        -Math.cos(pYaw) * Math.cos(pPitch),
      )
      .normalize();

    // Aim assist: nudge toward the closest live enemy within a narrow cone.
    if (getConfig('enableAutoAimAssist')) {
      const minDot = Math.cos((AIM_ASSIST_CONE_DEG * Math.PI) / 180);
      let best = minDot;
      const aimDir = new THREE.Vector3();
      enemiesRef.current.forEach((enemy) => {
        if (enemy.hp <= 0) return;
        scratchVec1.set(enemy.pos[0], enemy.pos[1] + 0.8, enemy.pos[2]);
        if (pPos.distanceTo(scratchVec1) > AIM_ASSIST_RANGE) return;
        scratchVec2.subVectors(scratchVec1, pPos).normalize();
        const dot = forwardVec.dot(scratchVec2);
        if (dot > best) {
          best = dot;
          aimDir.copy(scratchVec2);
        }
      });
      if (best > minDot) forwardVec.copy(aimDir);
    }

    const speed = 18.0;
    const newProj: Projectile = {
      id: `proj_p_${Date.now()}_${Math.random()}`,
      isPlayer: true,
      pos: [
        pPos.x + forwardVec.x * 0.8,
        pPos.y + forwardVec.y * 0.8 - 0.2,
        pPos.z + forwardVec.z * 0.8,
      ],
      velocity: [
        forwardVec.x * speed,
        forwardVec.y * speed,
        forwardVec.z * speed,
      ],
      damage: getConfig('spellDamage') + playerStats.baseAttack,
      isCrit: Math.random() < playerStats.critChance,
      radius: 0.6,
      life: 0,
      maxLife: 3.0,
      color: '#f97316',
    };

    setProjectiles((prev) => [...prev, newProj]);
  };

  // Player Evasion Dash
  const executeDash = () => {
    if (cooldowns.current.dash > 0 || playerStats.stamina < 20) return;
    cooldowns.current.dash = 1.2;
    cooldowns.current.invul = Math.max(cooldowns.current.invul, 0.35);
    onOnboardingEvent?.({type: 'dash'});
    gameAudio.playPowerupChime();

    setPlayerStats((prev) => ({
      ...prev,
      stamina: Math.max(0, prev.stamina - 20),
    }));

    isDashing.current = true;
    dashTimer.current = 0.22;

    const pYaw = playerYaw.current;
    const dash = dashDirection(
      moveInputFrom(inputRef.current?.actions, joystickMoveRef.current),
      pYaw,
    );
    dashDir.current.set(dash.x, 0, dash.z);
    spawnSparks(
      [playerPos.current.x, playerPos.current.y - 0.5, playerPos.current.z],
      '#60a5fa',
      12,
    );
  };

  // Interact with nearby props (chests, shrines, stairs)
  const executeInteract = () => {
    onOnboardingEvent?.({type: 'interact'});
    const pPos = playerPos.current;

    // Check Chests
    chestsRef.current.forEach((chest) => {
      if (!chest.opened) {
        scratchVec1.set(chest.pos[0], chest.pos[1], chest.pos[2]);
        if (pPos.distanceTo(scratchVec1) < 3.2) {
          chest.opened = true;
          gameAudio.playCoinPickup();
          spawnFloatingText(
            `+ ${chest.loot.name}`,
            chest.pos,
            chest.tier === 'legendary'
              ? '#f59e0b'
              : chest.tier === 'epic'
                ? '#a855f7'
                : '#3b82f6',
          );
          spawnSparks(chest.pos, '#f59e0b', 20);
          onLootFound(chest.loot);
          setChests([...chestsRef.current]);
        }
      }
    });

    // Check Shrines
    shrinesRef.current.forEach((shrine) => {
      if (!shrine.used) {
        scratchVec1.set(shrine.pos[0], shrine.pos[1], shrine.pos[2]);
        if (pPos.distanceTo(scratchVec1) < 3.2) {
          shrine.used = true;
          gameAudio.playPotionGulp();
          if (shrine.type === 'health') {
            setPlayerStats((prev) => ({
              ...prev,
              hp: prev.maxHp,
            }));
            spawnFloatingText('FULL HEALTH RESTORED!', shrine.pos, '#22c55e');
          } else {
            setPlayerStats((prev) => ({
              ...prev,
              mana: prev.maxMana,
            }));
            spawnFloatingText('FULL MANA RESTORED!', shrine.pos, '#3b82f6');
          }
          spawnSparks(shrine.pos, '#38bdf8', 16);
          setShrines([...shrinesRef.current]);
        }
      }
    });

    // Check Stairs / Floor Exit Portal
    const stairs = floorData.stairs;
    scratchVec1.set(stairs.pos[0], stairs.pos[1], stairs.pos[2]);
    const distance = pPos.distanceTo(scratchVec1);
    if (stairsUnlocked && distance < 3.5 && floorLatchRef.current.tryFire()) {
      gameAudio.playPowerupChime();
      onFloorClear();
    }
  };

  // Enemy Defeated Logic
  const handleEnemyDefeated = (enemy: EnemyEntity) => {
    gameAudio.playChiptuneExplosion();
    const goldEarned = enemy.isBoss ? 150 : 25 + floorLevel * 5;
    const scoreEarned = enemyKillScore(floorLevel, enemy.isBoss);

    setGameState((prev) => ({
      ...prev,
      score: prev.score + scoreEarned,
    }));

    setPlayerStats((prev) => ({
      ...prev,
      gold: prev.gold + goldEarned,
    }));

    spawnFloatingText(`+${goldEarned} Gold`, enemy.pos, '#fbbf24');
    spawnSparks(enemy.pos, '#fbbf24', 25);

    if (enemy.dropLoot) {
      onLootFound(enemy.dropLoot);
      spawnFloatingText(`Loot: ${enemy.dropLoot.name}`, [
        enemy.pos[0],
        enemy.pos[1] + 0.8,
        enemy.pos[2],
      ], '#f59e0b');
    }

    const roomDrops = roomClearChests(floorData, enemiesRef.current, enemy);
    if (roomDrops.length) {
      setChests((prev) => [...prev, ...roomDrops]);
      spawnFloatingText('Potion!', roomDrops[0].pos, '#22c55e');
    }

    // Drop the dead enemy's model right away (it is otherwise hidden by its rig).
    setEnemies([...enemiesRef.current]);

    if (enemy.isBoss) {
      setStairsUnlocked(true);
      spawnFloatingText('STAIRS TO NEXT FLOOR OPEN!', enemy.pos, '#10b981');
      onBossDefeated?.();
    }
  };

  // Main 60FPS Game & Physics Loop
  useFrame((_, delta) => {
    if (paused) {
      wasPausedRef.current = true;
      const now = performance.now();
      const prevNow = lastFxNow.current;
      if (prevNow > 0) holdHitFlashes(hitFlashes.current, now - prevNow);
      syncHitFlashes(hitFlashes.current, flashTargets.current, now);
      lastFxNow.current = now;
      const applied = lastShake.current;
      if (applied.x !== 0 || applied.y !== 0) {
        camera.position.x -= applied.x;
        camera.position.y -= applied.y;
        if (viewmodelRef.current) {
          viewmodelRef.current.position.x -= applied.x;
          viewmodelRef.current.position.y -= applied.y;
        }
        applied.x = 0;
        applied.y = 0;
      }
      stepScreenShake(screenShake.current, 0, {enabled: isScreenShakeEnabled(), paused: true});
      stepHitStop(hitStop.current, delta, paused);
      animClock.dt = 0;
      return;
    }
    const dt = stepHitStop(hitStop.current, frameDelta(delta, wasPausedRef.current), paused).dt;
    wasPausedRef.current = false;
    animClock.dt = dt;
    animClock.t += dt;

    const cd = cooldowns.current;
    cd.attack = Math.max(0, cd.attack - dt);
    cd.spell = Math.max(0, cd.spell - dt);
    cd.dash = Math.max(0, cd.dash - dt);
    cd.invul = Math.max(0, cd.invul - dt);
    if (attackBuffer.current > 0) {
      attackBuffer.current = Math.max(0, attackBuffer.current - dt);
      if (cd.attack <= 0 && attackBuffer.current > 0) executeAttack();
    }

    if (debugCheats.killBossRequested) {
      debugCheats.killBossRequested = false;
      const boss = enemiesRef.current.find((e) => e.isBoss && e.hp > 0);
      if (boss) {
        boss.hp = 0;
        handleEnemyDefeated(boss);
        setEnemies([...enemiesRef.current]);
      }
    }

    // Handle touch look delta from mobile
    if (touchLookDeltaRef.current.dx !== 0 || touchLookDeltaRef.current.dy !== 0) {
      const sens = getTouchLookSensitivity() * 0.0035;
      playerYaw.current -= touchLookDeltaRef.current.dx * sens;
      playerPitch.current -= touchLookDeltaRef.current.dy * sens;
      playerPitch.current = Math.max(
        -Math.PI / 2.2,
        Math.min(Math.PI / 2.2, playerPitch.current),
      );
      touchLookDeltaRef.current = {dx: 0, dy: 0};
      onOnboardingEvent?.({type: 'look'});
    }

    // Trigger action refs from UI / keyboard
    if (triggerAttackRef.current || triggerSpellRef.current) {
      const p = playerPos.current;
      const lockYaw = takeTouchAimYaw({x: p.x, z: p.z}, playerYaw.current, enemiesRef.current);
      if (lockYaw !== null) playerYaw.current = lockYaw;
    }
    if (triggerAttackRef.current) {
      executeAttack();
      triggerAttackRef.current = false;
    }
    if (triggerSpellRef.current) {
      executeSpell();
      triggerSpellRef.current = false;
    }
    if (triggerDashRef.current) {
      executeDash();
      triggerDashRef.current = false;
    }
    if (triggerInteractRef.current) {
      executeInteract();
      triggerInteractRef.current = false;
    }

    // Input actions from useInput
    const input = inputRef.current?.actions;
    if (input) {
      // Edge-triggered: LMB (bound 'Mouse0') / attack key attacks once per press.
      if (input.confirm && !confirmHeldRef.current && !triggerAttackRef.current) {
        executeAttack();
      }
      confirmHeldRef.current = input.confirm;
      if (input.tap) {
        // pointer click / tap attack
        executeAttack();
        input.tap = false;
      }
    }

    // Update Player Cooldowns & Stats Regeneration
    // Throttled: re-rendering the whole App (HUD + scene) every frame was the main source of jank.
    statsSyncTimer.current += dt;
    if (statsSyncTimer.current >= STATS_SYNC_S) {
      const step = statsSyncTimer.current;
      statsSyncTimer.current = 0;
      const snap = {...cd};
      setPlayerStats((prev) => {
        const stamina = Math.min(prev.maxStamina, prev.stamina + 22 * step);
        const mana = Math.min(prev.maxMana, prev.mana + 4 * step);
        if (
          stamina === prev.stamina &&
          mana === prev.mana &&
          snap.attack === prev.attackCooldown &&
          snap.spell === prev.spellCooldown &&
          snap.dash === prev.dashCooldown &&
          snap.invul === prev.invulnerableTime
        ) {
          return prev;
        }
        return {
          ...prev,
          dashCooldown: snap.dash,
          attackCooldown: snap.attack,
          spellCooldown: snap.spell,
          invulnerableTime: snap.invul,
          stamina,
          mana,
        };
      });
    }

    // Player Movement Integration
    const pPos = playerPos.current;
    let moveX = 0;
    let moveZ = 0;

    if (input) {
      if (input.left) moveX -= 1;
      if (input.right) moveX += 1;
      if (input.up) moveZ -= 1;
      if (input.down) moveZ += 1;
    }

    // Add virtual joystick input
    if (joystickMoveRef.current.x !== 0 || joystickMoveRef.current.y !== 0) {
      moveX += joystickMoveRef.current.x;
      moveZ -= joystickMoveRef.current.y;
    }

    const isMoving = moveX !== 0 || moveZ !== 0;
    if (isMoving) onOnboardingEvent?.({type: 'move', dt});
    const baseSpeed =
      getConfig('playerSpeed') + (playerStats.equippedRing.moveSpeedBonus || 0);

    let stepX = 0;
    let stepZ = 0;
    if (isDashing.current) {
      dashTimer.current -= dt;
      const dashSpeed = baseSpeed * 2.8;
      stepX = dashDir.current.x * dashSpeed * dt;
      stepZ = dashDir.current.z * dashSpeed * dt;
      if (dashTimer.current <= 0) {
        isDashing.current = false;
      }
    } else if (isMoving) {
      // Camera-relative: W toward where the camera looks (AD-24.10).
      const move = cameraMoveVector(moveX, moveZ, playerYaw.current);
      stepX = move.x * baseSpeed * dt;
      stepZ = move.z * baseSpeed * dt;

      // Footstep sound & head bob
      headBob.current += dt * 12;
      lastFootstepDist.current += Math.hypot(stepX, stepZ);
      if (lastFootstepDist.current > 2.5) {
        gameAudio.playFootstepStone();
        lastFootstepDist.current = 0;
      }
    }
    if (stepX !== 0 || stepZ !== 0) {
      // Wall collision with a body radius; slides along walls and never tunnels (dash included).
      const next = moveWithCollision(floorData.tiles, pPos.x, pPos.z, stepX, stepZ, PLAYER_RADIUS);
      pPos.x = next.x;
      pPos.z = next.z;
    }

    if (interactAvailableRef) {
      interactAvailableRef.current = nearChestOrShrine(
        pPos.x,
        pPos.z,
        chestsRef.current,
        shrinesRef.current,
      );
    }

    // Camera Positioning & Orientation
    const bobOffset = isMoving ? Math.sin(headBob.current) * 0.06 : 0;
    const shake = stepScreenShake(screenShake.current, dt, {
      enabled: isScreenShakeEnabled(),
    });
    lastShake.current.x = shake.x;
    lastShake.current.y = shake.y;

    camera.position.set(pPos.x + shake.x, pPos.y + bobOffset + shake.y, pPos.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = playerYaw.current;
    camera.rotation.x = playerPitch.current;
    torchLightRef.current?.position.set(pPos.x, pPos.y + 0.5, pPos.z);

    // First-person viewmodel animation
    if (viewmodelRef.current) {
      if (swingProgress.current > 0) {
        swingProgress.current -= dt * 4.5;
        const sw = Math.sin((1 - swingProgress.current) * Math.PI);
        viewmodelRef.current.position.set(0.35 - sw * 0.3, -0.3 + sw * 0.15, -0.6 - sw * 0.2);
        viewmodelRef.current.rotation.set(-sw * 0.8, sw * 1.2, -sw * 0.9);
      } else if (castProgress.current > 0) {
        castProgress.current -= dt * 3.5;
        const cs = Math.sin((1 - castProgress.current) * Math.PI);
        viewmodelRef.current.position.set(0.35, -0.3 + cs * 0.2, -0.6 + cs * 0.3);
        viewmodelRef.current.rotation.set(cs * 0.5, 0, cs * 0.3);
      } else {
        // Idle breathing bob
        const breathe = Math.sin(Date.now() * 0.003) * 0.02;
        viewmodelRef.current.position.set(0.35, -0.3 + breathe, -0.6);
        viewmodelRef.current.rotation.set(0, 0, 0);
      }
      applyCameraLocalPose(viewmodelRef.current, camera);
      flashTargets.current.set(PLAYER_FLASH_ID, viewmodelRef.current);
    }

    const fxNow = performance.now();
    syncHitFlashes(hitFlashes.current, flashTargets.current, fxNow);
    lastFxNow.current = fxNow;

    // Update Spike Traps
    trapsRef.current.forEach((trap) => {
      trap.timer += dt;
      trap.active = Math.sin(trap.timer * 2.5) > 0.3;
      if (trap.active) {
        scratchVec1.set(trap.pos[0], 0, trap.pos[2]);
        if (pPos.distanceTo(scratchVec1) < 1.4 && cd.invul <= 0) {
          applyPlayerDamage(trap.damage, 'Spike Trap');
        }
      }
    });

    // Update Enemies AI & Combat Loops
    // Enemies only notice, chase and attack the player when they can SEE them
    // (range + view cone + no wall in between). When sight is lost they walk to
    // the last known position for a few seconds, then give up.
    let aliveCount = 0;
    let bossFound: EnemyEntity | null = null;
    const tiles = floorData.tiles;
    const allEnemies = enemiesRef.current;

    allEnemies.forEach((enemy, idx) => {
      if (enemy.hp <= 0) return;
      aliveCount++;
      if (enemy.isBoss) bossFound = enemy;

      const ex = enemy.pos[0];
      const ez = enemy.pos[2];
      scratchVec1.set(ex, enemy.pos[1], ez);
      const distToPlayer = pPos.distanceTo(scratchVec1);
      const angleToPlayer = Math.atan2(pPos.x - ex, pPos.z - ez);

      // Clear a boss telegraph if the enemy was knocked out of windup (e.g. hurt)
      if (enemy.telegraph && enemy.state !== 'windup') {
        enemy.telegraph = undefined;
      }

      const wasIdle = enemy.state === 'idle';
      const sees = perceive(
        enemy,
        {x: ex, z: ez, yaw: enemy.rotY, alerted: !wasIdle},
        pPos.x,
        pPos.z,
        tiles,
        dt,
      );

      let faceYaw: number | null = sees ? angleToPlayer : null;
      let moveTarget: [number, number] | null = null;

      if (enemy.state === 'idle') {
        if (sees || (enemy.memory ?? 0) > 0) {
          enemy.state = 'chase';
          if (sees) spawnFloatingText('!', [ex, enemy.pos[1] + 1.2 * enemy.scale, ez], '#facc15', true);
        } else {
          // Idle guard slowly scans the room.
          enemy.rotY += Math.sin(animClock.t * 0.6 + idx * 1.7) * IDLE_SCAN_RATE * dt;
        }
      }

      if (enemy.state === 'chase') {
        if (sees) {
          if (distToPlayer > enemy.attackRange) {
            moveTarget = [pPos.x, pPos.z];
          } else {
            enemy.state = 'windup';
            const groundTelegraph = usesGroundTelegraph(
              enemy.isBoss,
              enemy.archetype,
            );
            enemy.stateTimer = groundTelegraph ? BOSS_TELEGRAPH_WINDUP : 0.5;
            enemy.telegraphTimer = enemy.stateTimer;
            if (groundTelegraph) {
              // Telegraph locks onto the player's current position
              enemy.telegraph = startTelegraph(pPos.x, pPos.z);
            }
          }
        } else if ((enemy.memory ?? 0) > 0 && enemy.lastKnownPos) {
          // Investigate where the player was last seen.
          const [lx, lz] = enemy.lastKnownPos;
          if (Math.hypot(lx - ex, lz - ez) < 0.6) enemy.memory = 0;
          else moveTarget = [lx, lz];
        } else {
          enemy.state = 'idle';
          enemy.lastKnownPos = undefined;
        }
      } else if (enemy.state === 'windup') {
        // Lost sight mid-windup: abort (a boss slam already locked onto the ground still lands).
        if (!sees && !enemy.telegraph) {
          enemy.state = 'chase';
          enemy.telegraphTimer = 0;
          enemy.stateTimer = 0;
        } else {
          enemy.stateTimer -= dt;
          enemy.telegraphTimer = enemy.stateTimer;
          if (enemy.telegraph) {
            enemy.telegraph = advanceTelegraph(enemy.telegraph, dt, paused);
          }
          if (enemy.stateTimer <= 0) {
            enemy.state = 'attack';
            enemy.stateTimer = 0.3;
            enemy.telegraphTimer = 0;
            const tel = enemy.telegraph;
            enemy.telegraph = undefined;

            // Execute attack
            if (enemy.archetype === 'cultist' || enemy.archetype === 'boss_crimson_archmage') {
              // Aimed fireball (only fired with the player in sight)
              gameAudio.playArcadeLaser();
              const dx = pPos.x - ex;
              const dz = pPos.z - ez;
              const len = Math.hypot(dx, dz) || 1;
              const spd = 10.0;
              const spawnY = enemy.pos[1] + 0.5;

              const enemyProj: Projectile = {
                id: `proj_e_${Date.now()}_${Math.random()}`,
                isPlayer: false,
                pos: [ex + (dx / len) * 0.6, spawnY, ez + (dz / len) * 0.6],
                velocity: [(dx / len) * spd, ((pPos.y - spawnY) / len) * spd, (dz / len) * spd],
                damage: enemy.attackPower,
                isCrit: false,
                radius: 0.5,
                life: 0,
                maxLife: 4.0,
                color: '#ef4444',
              };
              setProjectiles((prev) => [...prev, enemyProj]);
            } else {
              // Melee Strike: needs the player in sight, or inside a visible boss slam ring
              const insideRing = tel
                ? isInsideRing(pPos.x, pPos.z, tel.cx, tel.cz, tel.radius)
                : sees;
              if (meleeHitLands(distToPlayer <= enemy.attackRange + 1.0, insideRing)) {
                applyPlayerDamage(enemy.attackPower, enemy.name);
                gameAudio.playMeleePunch();
              }
            }
          }
        }
      } else if (enemy.state === 'attack') {
        enemy.stateTimer -= dt;
        if (enemy.stateTimer <= 0) {
          enemy.state = 'chase';
        }
      } else if (enemy.state === 'hurt') {
        enemy.stateTimer -= dt;
        if (enemy.stateTimer <= 0) {
          enemy.state = 'chase';
        }
      }

      // Locomotion: steer to the target, keep apart from other enemies, collide with walls.
      if (moveTarget) {
        let vx = moveTarget[0] - ex;
        let vz = moveTarget[1] - ez;
        const len = Math.hypot(vx, vz);
        if (len > 0.01) {
          vx /= len;
          vz /= len;
          let sepX = 0;
          let sepZ = 0;
          for (const other of allEnemies) {
            if (other === enemy || other.hp <= 0) continue;
            const ox = ex - other.pos[0];
            const oz = ez - other.pos[2];
            const minDist = 0.9 * (enemy.scale + other.scale);
            const d = Math.hypot(ox, oz);
            if (d > 0.001 && d < minDist) {
              const push = (minDist - d) / minDist;
              sepX += (ox / d) * push;
              sepZ += (oz / d) * push;
            }
          }
          vx += sepX * 1.5;
          vz += sepZ * 1.5;
          const vlen = Math.hypot(vx, vz);
          if (vlen > 1) {
            vx /= vlen;
            vz /= vlen;
          }
          const step = enemy.moveSpeed * dt;
          const next = moveWithCollision(tiles, ex, ez, vx * step, vz * step, 0.35 * enemy.scale);
          enemy.pos[0] = next.x;
          enemy.pos[2] = next.z;
          if (faceYaw === null) faceYaw = Math.atan2(vx, vz);
        }
      }

      if (faceYaw !== null) {
        enemy.rotY = turnToward(enemy.rotY, faceYaw, ENEMY_TURN_RATE * dt);
      }
    });

    currentBossRef.current = bossFound;
    activeEnemiesCountRef.current = aliveCount;

    // Update Projectiles
    if (projectilesRef.current.length > 0) {
      const activeProj: Projectile[] = [];
      projectilesRef.current.forEach((proj) => {
        proj.life += dt;
        proj.pos[0] += proj.velocity[0] * dt;
        proj.pos[1] += proj.velocity[1] * dt;
        proj.pos[2] += proj.velocity[2] * dt;

        let collided = false;

        if (proj.isPlayer) {
          // Check collision with enemies
          scratchVec1.set(proj.pos[0], proj.pos[1], proj.pos[2]);
          enemiesRef.current.forEach((enemy) => {
            if (enemy.hp <= 0 || collided) return;
            scratchVec2.set(enemy.pos[0], enemy.pos[1], enemy.pos[2]);
            if (scratchVec1.distanceTo(scratchVec2) < proj.radius + enemy.scale * 0.8) {
              collided = true;
              const isCrit = proj.isCrit;
              const dmg = Math.round(proj.damage * (isCrit ? 1.8 : 1.0));
              enemy.hp -= dmg;
              enemy.state = 'hurt';
              enemy.stateTimer = 0.2;
              alertTo(enemy, pPos.x, pPos.z);
              triggerHitFlash(hitFlashes.current, enemy.id, performance.now());
              triggerScreenShake(screenShake.current, outgoingShakeAmount(dmg, isCrit));
              if (isHeavyHit(dmg, isCrit)) triggerHitStop(hitStop.current);

              spawnFloatingText(
                isCrit ? `${dmg}! CRIT` : `${dmg}`,
                enemy.pos,
                isCrit ? '#f59e0b' : '#38bdf8',
                isCrit,
              );
              spawnSparks(enemy.pos, '#f97316', 15);
              gameAudio.playChiptuneExplosion();

              if (enemy.hp <= 0) {
                handleEnemyDefeated(enemy);
              }
            }
          });
        } else {
          // Check collision with player
          scratchVec1.set(proj.pos[0], proj.pos[1], proj.pos[2]);
          if (scratchVec1.distanceTo(pPos) < 1.2 && cd.invul <= 0) {
            collided = true;
            applyPlayerDamage(proj.damage, 'Dark Magic');
            gameAudio.playShieldBlock();
          }
        }

        // Walls, floor and ceiling stop every projectile (no shots through walls).
        if (
          !collided &&
          (!isWalkableWorld(tiles, proj.pos[0], proj.pos[2]) || proj.pos[1] < 0 || proj.pos[1] > 5)
        ) {
          collided = true;
          spawnSparks(proj.pos, proj.color, 8);
        }

        if (!collided && proj.life < proj.maxLife) {
          activeProj.push(proj);
        }
      });
      setProjectiles(activeProj);
    }

    // Update Floating Texts
    if (textStore.update(dt)) setFloatingTexts([...textStore.list]);

    // Update Particles
    if (particlesRef.current.length > 0) {
      const activeParts: SparkParticle[] = [];
      particlesRef.current.forEach((p) => {
        p.life += dt;
        p.pos[0] += p.vel[0] * dt;
        p.pos[1] += p.vel[1] * dt;
        p.pos[2] += p.vel[2] * dt;
        p.vel[1] -= 9.8 * dt; // Gravity
        if (p.life < p.maxLife) {
          activeParts.push(p);
        }
      });
      setParticles(activeParts);
    }

    syncMinimapBridge(minimapBridgeRef.current, {
      tiles: floorData.tiles,
      rooms: floorData.rooms,
      gridSize: floorData.gridSize,
      playerX: playerPos.current.x,
      playerZ: playerPos.current.z,
      playerYaw: playerYaw.current,
      enemies: enemiesRef.current,
      chests: chestsRef.current,
      stairs: floorData.stairs,
    });
  });

  // Player Damage Application
  const applyPlayerDamage = (rawDamage: number, source: string) => {
    const defense =
      (playerStats.equippedArmor.defense || 10) + playerStats.baseDefense;
    const dmgReduction = defense / (defense + 60);
    const finalDmg = Math.max(
      4,
      Math.round(rawDamage * (1 - dmgReduction) * (0.9 + Math.random() * 0.2)),
    );

    gameAudio.playMeleePunch();
    triggerHitFlash(hitFlashes.current, PLAYER_FLASH_ID, performance.now());
    triggerScreenShake(screenShake.current, playerHurtShake(finalDmg));
    if (isHeavyHit(finalDmg)) triggerHitStop(hitStop.current);
    cooldowns.current.invul = 0.5;

    setPlayerStats((prev) => {
      const newHp = applyDamage(prev.hp, finalDmg, debugCheats.godMode);
      if (isGameOver(newHp) && !gameOverLatchedRef.current) {
        gameOverLatchedRef.current = true;
        setGameState((g) => ({...g, status: 'GAME_OVER'}));
        gameAudio.playDefeatMotif();
      }
      return {
        ...prev,
        hp: newHp,
        invulnerableTime: 0.5,
      };
    });

    spawnFloatingText(
      `-${finalDmg}`,
      [playerPos.current.x, playerPos.current.y, playerPos.current.z],
      '#ef4444',
    );
  };

  const weaponGlow = playerStats.equippedWeapon.glowColor || '#3b82f6';
  const tierColor = (tier: ChestEntity['tier']) =>
    tier === 'legendary' ? '#f59e0b' : tier === 'epic' ? '#a855f7' : '#3b82f6';

  return (
    <group>
      {/* Player Torch Aura Light (moved every frame in the loop) */}
      <pointLight
        ref={torchLightRef}
        position={[playerPos.current.x, playerPos.current.y + 0.5, playerPos.current.z]}
        intensity={35}
        distance={14}
        decay={1.2}
        color="#ffedd5"
      />

      {/* First-Person Animated Viewmodel: Sword & Magic Glow */}
      <group
        ref={(node) => {
          viewmodelRef.current = node;
          if (node) flashTargets.current.set(PLAYER_FLASH_ID, node);
          else flashTargets.current.delete(PLAYER_FLASH_ID);
        }}
        position={[0.35, -0.3, -0.6]}>
        <group position={[0.02, -0.04, 0]} rotation={[-0.6, 0.15, 0.12]} scale={0.8}>
          {/* Blade */}
          <mesh position={[0, 0.42, 0]}>
            <boxGeometry args={[0.07, 0.64, 0.014]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.18} />
          </mesh>
          {/* Glowing fuller */}
          <mesh position={[0, 0.4, 0]}>
            <boxGeometry args={[0.016, 0.56, 0.018]} />
            <meshStandardMaterial color={weaponGlow} emissive={weaponGlow} emissiveIntensity={1.6} />
          </mesh>
          {/* Tip */}
          <mesh position={[0, 0.8, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1, 1, 0.2]}>
            <coneGeometry args={[0.05, 0.14, 4]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.18} />
          </mesh>
          {/* Crossguard */}
          <mesh position={[0, 0.09, 0]}>
            <boxGeometry args={[0.28, 0.035, 0.05]} />
            <meshStandardMaterial color="#f59e0b" metalness={0.85} roughness={0.28} />
          </mesh>
          {[-0.14, 0.14].map((x) => (
            <mesh key={x} position={[x, 0.09, 0]}>
              <sphereGeometry args={[0.028, 10, 8]} />
              <meshStandardMaterial color="#f59e0b" metalness={0.85} roughness={0.28} />
            </mesh>
          ))}
          <mesh position={[0, 0.09, 0.03]}>
            <octahedronGeometry args={[0.025]} />
            <meshStandardMaterial color={weaponGlow} emissive={weaponGlow} emissiveIntensity={2} />
          </mesh>
          {/* Leather-wrapped grip with bands */}
          <mesh position={[0, -0.04, 0]}>
            <cylinderGeometry args={[0.024, 0.026, 0.2, 10]} />
            <meshStandardMaterial color="#5b2e0e" roughness={0.85} />
          </mesh>
          {[0.03, -0.04, -0.11].map((y) => (
            <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.027, 0.005, 6, 14]} />
              <meshStandardMaterial color="#b45309" metalness={0.8} roughness={0.3} />
            </mesh>
          ))}
          {/* Pommel */}
          <mesh position={[0, -0.16, 0]}>
            <sphereGeometry args={[0.035, 12, 10]} />
            <meshStandardMaterial color="#f59e0b" metalness={0.85} roughness={0.28} />
          </mesh>
          {/* Gauntlet */}
          <mesh position={[0.005, -0.05, 0.01]} scale={[0.055, 0.07, 0.06]}>
            <sphereGeometry args={[1, 14, 10]} />
            <meshStandardMaterial color="#3b2a1f" metalness={0.2} roughness={0.85} />
          </mesh>
        </group>
        {/* Magic Aura Orb on Left Off-Hand */}
        <mesh position={[-0.7, -0.1, 0.1]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#0284c7"
            emissiveIntensity={1.8}
            transparent
            opacity={0.85}
          />
        </mesh>
        <pointLight
          ref={wandGlowRef}
          position={[-0.7, -0.1, 0.1]}
          intensity={8}
          distance={4}
          color="#38bdf8"
        />
      </group>

      {/* Floor, ceiling, walls, pillars, torches (memoized + instanced) */}
      <DungeonLevel floorData={floorData} />

      {floatingTexts.map((ft) => (
        <FloatingTextSprite key={ft.id} ft={ft} />
      ))}

      {/* Treasure Chests */}
      {chests.map((chest) => (
        <group key={chest.id} position={chest.pos}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[1.0, 0.6, 0.7]} />
            <meshStandardMaterial
              color={chest.opened ? '#52525b' : '#7c4a12'}
              roughness={0.75}
              metalness={0.1}
            />
          </mesh>
          {[-0.36, 0.36].map((x) => (
            <mesh key={x} position={[x, 0.02, 0]}>
              <boxGeometry args={[0.07, 0.64, 0.74]} />
              <meshStandardMaterial color="#3f3f46" metalness={0.85} roughness={0.35} />
            </mesh>
          ))}
          <group
            position={[0, 0.3, chest.opened ? -0.35 : 0]}
            rotation={[chest.opened ? -1.1 : 0, 0, 0]}>
            <group position={[0, 0, chest.opened ? 0.35 : 0]}>
              <mesh position={[0, 0.08, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.7]}>
                <cylinderGeometry args={[0.2, 0.2, 1.04, 16, 1, false, 0, Math.PI]} />
                <meshStandardMaterial
                  color={chest.opened ? '#71717a' : '#a16207'}
                  roughness={0.6}
                  metalness={0.25}
                  side={THREE.DoubleSide}
                />
              </mesh>
              <mesh position={[0, 0.02, 0.37]}>
                <boxGeometry args={[0.14, 0.18, 0.04]} />
                <meshStandardMaterial color="#facc15" metalness={0.9} roughness={0.25} />
              </mesh>
            </group>
          </group>
          {/* Rarity Glow Halo (kept mounted: toggling lights recompiles every shader) */}
          <pointLight
            position={[0, 0.6, 0]}
            intensity={chest.opened ? 0 : 8}
            distance={4}
            color={tierColor(chest.tier)}
          />
        </group>
      ))}

      {/* Shrines */}
      {shrines.map((shrine) => (
        <group key={shrine.id} position={shrine.pos}>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.8, 1.0, 1.0, 10]} />
            <meshStandardMaterial color="#1e1e24" roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.62, 0.05, 8, 32]} />
            <meshStandardMaterial color="#a1a1aa" metalness={0.8} roughness={0.3} />
          </mesh>
          <SpinningCrystal shrine={shrine} />
          <pointLight
            position={[0, 1.5, 0]}
            intensity={shrine.used ? 0 : 12}
            distance={6}
            color={shrine.type === 'health' ? '#ef4444' : '#38bdf8'}
          />
        </group>
      ))}

      {/* Animated Floor Spike Traps */}
      {traps.map((trap) => (
        <SpikeTrap key={trap.id} trap={trap} />
      ))}

      {/* Exit Stairs / Portal */}
      <group position={floorData.stairs.pos}>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[1.8, 2.0, 0.4, 16]} />
          <meshStandardMaterial color="#18181b" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.45, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.2, 1.5, 24]} />
          <meshStandardMaterial
            color={stairsUnlocked ? '#10b981' : '#64748b'}
            emissive={stairsUnlocked ? '#059669' : '#0f172a'}
            emissiveIntensity={stairsUnlocked ? 2.5 : 0.2}
            side={THREE.DoubleSide}
          />
        </mesh>
        <pointLight
          position={[0, 1.2, 0]}
          intensity={stairsUnlocked ? 20 : 0}
          distance={8}
          color="#10b981"
        />
      </group>

      {/* 3D Enemies & Bosses (animated imperatively; never re-rendered while alive) */}
      {enemies.map(
        (enemy) =>
          enemy.hp > 0 && (
            <EnemyModel key={enemy.id} enemy={enemy} clock={animClock} registerFlash={registerFlash} />
          ),
      )}

      {/* Boss Attack Telegraphs (world-space, locked at windup start) */}
      {enemies.map(
        (enemy) =>
          enemy.hp > 0 &&
          enemy.isBoss && <LiveBossTelegraph key={`tel_${enemy.id}`} source={enemy} />,
      )}

      {/* Projectiles: emissive core + additive halo, picked up by bloom (no per-shot lights) */}
      {projectiles.map((proj) => (
        <group key={proj.id} position={proj.pos}>
          <mesh geometry={projectileGeo} scale={proj.radius * 0.55}>
            <meshBasicMaterial color="#fff7ed" toneMapped={false} />
          </mesh>
          <mesh geometry={projectileGeo} scale={proj.radius}>
            <meshBasicMaterial
              color={proj.color}
              toneMapped={false}
              transparent
              opacity={0.75}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}

      {/* Particle Sparks */}
      {particles.map((p) => (
        <mesh key={p.id} geometry={sparkGeo} position={p.pos} scale={p.size}>
          <meshBasicMaterial color={p.color} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Shrine crystal: spins and bobs every frame without re-rendering the scene. */
function SpinningCrystal({shrine}: {shrine: ShrineEntity}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({clock}) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.elapsedTime;
    m.rotation.y = t * (shrine.used ? 0.3 : 1.2);
    m.position.y = 1.45 + Math.sin(t * 1.8) * (shrine.used ? 0.02 : 0.1);
  });
  return (
    <mesh ref={ref} position={[0, 1.45, 0]} rotation={[0.2, 0, 0]}>
      <octahedronGeometry args={[0.35]} />
      <meshStandardMaterial
        color={shrine.type === 'health' ? '#ef4444' : '#38bdf8'}
        emissive={shrine.type === 'health' ? '#b91c1c' : '#0284c7'}
        emissiveIntensity={shrine.used ? 0.2 : 2.0}
      />
    </mesh>
  );
}

/** Spike trap: reads `trap.active` every frame and slides the spikes up/down. */
function SpikeTrap({trap}: {trap: TrapEntity}) {
  const spikes = useRef<THREE.Group>(null);
  const plate = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((_, delta) => {
    const g = spikes.current;
    if (!g) return;
    const target = trap.active ? 0.35 : -0.4;
    g.position.y += (target - g.position.y) * Math.min(1, delta * (trap.active ? 30 : 8));
    g.visible = g.position.y > -0.38;
    if (plate.current) {
      plate.current.color.set(trap.active ? '#7f1d1d' : '#3f3f46');
      plate.current.emissiveIntensity = trap.active ? 1.0 : 0;
    }
  });
  return (
    <group position={trap.pos}>
      <mesh>
        <boxGeometry args={[1.8, 0.05, 1.8]} />
        <meshStandardMaterial ref={plate} color="#3f3f46" emissive="#991b1b" emissiveIntensity={0} />
      </mesh>
      <group ref={spikes} position={[0, -0.4, 0]} visible={false}>
        {[-0.5, 0, 0.5].map((x) =>
          [-0.5, 0, 0.5].map((z) => (
            <mesh key={`spike_${x}_${z}`} position={[x, 0, z]}>
              <coneGeometry args={[0.08, 0.7, 6]} />
              <meshStandardMaterial color="#d4d4d8" metalness={0.8} roughness={0.2} />
            </mesh>
          )),
        )}
      </group>
    </group>
  );
}

/** Main Game Canvas Export */
export function Game(props: GameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useInput(containerRef, {enabled: true});
  const sceneProps = useMemo(
    () => ({
      background: new THREE.Color(getConfig('backgroundColor')),
      fog: new THREE.FogExp2(getConfig('backgroundColor'), 0.04),
    }),
    [],
  );

  return (
    <div ref={containerRef} className="w-full h-full canvas-wrapper relative">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{
          fov: getConfig('fov'),
          near: 0.1,
          far: 120,
          position: [0, 1.5, 0],
        }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
        scene={sceneProps}>
        <Suspense fallback={null}>
          {/* Ambient Lighting */}
          <ambientLight
            color={getConfig('ambientColor')}
            intensity={getConfig('ambientIntensity')}
          />
          <hemisphereLight
            color={getConfig('hemiSkyColor')}
            groundColor={getConfig('hemiGroundColor')}
            intensity={getConfig('hemiIntensity')}
          />

          <DungeonScene {...props} inputRef={inputRef} />

          <EffectComposer>
            <Bloom
              luminanceThreshold={0.85}
              luminanceSmoothing={0.9}
              intensity={0.6}
              mipmapBlur
            />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
