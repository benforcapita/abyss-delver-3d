// tslint:disable
/* eslint-disable */
import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {Bloom, EffectComposer} from '@react-three/postprocessing';
import type {MutableRefObject} from 'react';
import React, {Suspense, useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';
import {getConfig} from './constants';
import {generateDungeonFloor} from './dungeonGenerator';
import {createOneShotLatch} from './floorLatch';
import {InputSnapshot, useInput} from './input';
import {enemyKillScore, isGameOver} from './rules';
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

interface GameProps {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  gameStateRef: MutableRefObject<GameState>;
  playerStats: PlayerStats;
  setPlayerStats: React.Dispatch<React.SetStateAction<PlayerStats>>;
  onLootFound: (item: LootItem) => void;
  onFloorClear: () => void;
  onBossDefeated?: () => void;
  triggerAttackRef: MutableRefObject<boolean>;
  triggerSpellRef: MutableRefObject<boolean>;
  triggerDashRef: MutableRefObject<boolean>;
  triggerInteractRef: MutableRefObject<boolean>;
  joystickMoveRef: MutableRefObject<{x: number; y: number}>;
  touchLookDeltaRef: MutableRefObject<{dx: number; dy: number}>;
  currentBossRef: MutableRefObject<EnemyEntity | null>;
  activeEnemiesCountRef: MutableRefObject<number>;
  floorDataRef: MutableRefObject<DungeonFloorData | null>;
}

// Scratch temporaries for zero-allocation game loop
const scratchVec1 = new THREE.Vector3();
const scratchVec2 = new THREE.Vector3();
const forwardVec = new THREE.Vector3();
const rightVec = new THREE.Vector3();
const cameraRay = new THREE.Ray();

// Procedural Cobblestone Texture Generator
function createDungeonCobblestoneTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#1e1e24';
    ctx.fillRect(0, 0, 512, 512);

    // Stone tiles
    const rows = 16;
    const cols = 16;
    const tileW = 512 / cols;
    const tileH = 512 / rows;

    for (let r = 0; r < rows; r++) {
      const offsetX = (r % 2) * (tileW / 2);
      for (let c = -1; c < cols + 1; c++) {
        const x = c * tileW + offsetX + 2;
        const y = r * tileH + 2;
        const shade = Math.floor(35 + Math.random() * 25);
        ctx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 5})`;
        ctx.fillRect(x, y, tileW - 4, tileH - 4);

        // Edge highlights
        ctx.strokeStyle = `rgba(255, 255, 255, 0.08)`;
        ctx.strokeRect(x, y, tileW - 4, tileH - 4);

        // Cracks & noise
        for (let n = 0; n < 4; n++) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
          ctx.fillRect(
            x + Math.random() * (tileW - 8),
            y + Math.random() * (tileH - 8),
            Math.random() * 6,
            Math.random() * 6,
          );
        }
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12);
  return texture;
}

// Procedural Wall Brick Texture Generator
function createDungeonWallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#14141a';
    ctx.fillRect(0, 0, 512, 512);

    const rows = 12;
    const cols = 8;
    const tileW = 512 / cols;
    const tileH = 512 / rows;

    for (let r = 0; r < rows; r++) {
      const offsetX = (r % 2) * (tileW / 2);
      for (let c = -1; c < cols + 1; c++) {
        const x = c * tileW + offsetX + 3;
        const y = r * tileH + 3;
        const shade = Math.floor(40 + Math.random() * 30);
        ctx.fillStyle = `rgb(${shade + 5}, ${shade}, ${shade - 5})`;
        ctx.fillRect(x, y, tileW - 6, tileH - 6);

        // Mortar lines
        ctx.strokeStyle = '#0a0a0d';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, tileW - 6, tileH - 6);
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  return texture;
}

/** Inner Scene Component handling Camera, Combat, Entities, Lighting, and FX */
function DungeonScene({
  gameState,
  setGameState,
  inputRef,
  playerStats,
  setPlayerStats,
  onLootFound,
  onFloorClear,
  onBossDefeated,
  triggerAttackRef,
  triggerSpellRef,
  triggerDashRef,
  triggerInteractRef,
  joystickMoveRef,
  touchLookDeltaRef,
  currentBossRef,
  activeEnemiesCountRef,
  floorDataRef,
}: GameProps & {inputRef: MutableRefObject<InputSnapshot>}): React.ReactElement {
  const {camera, gl} = useThree();

  // Textures
  const floorTexture = useMemo(() => createDungeonCobblestoneTexture(), []);
  const wallTexture = useMemo(() => createDungeonWallTexture(), []);

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
  const floatingTextsRef = useRef<FloatingText[]>([]);
  floatingTextsRef.current = floatingTexts;

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
  const screenShake = useRef(0);
  const lastFootstepDist = useRef(0);

  // Weapon Viewmodel Swing Animation Ref
  const viewmodelRef = useRef<THREE.Group>(null);
  const wandGlowRef = useRef<THREE.PointLight>(null);
  const swingProgress = useRef(0);
  const castProgress = useRef(0);

  // Latch so GAME_OVER status & defeat motif fire exactly once per run
  const gameOverLatchedRef = useRef(false);

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
    setFloatingTexts([]);
    setParticles([]);

    // Set player position to spawn room center
    const sp = generated.floorData.spawnPos;
    playerPos.current.set(sp[0], 1.5, sp[2]);
    camera.position.set(sp[0], 1.5, sp[2]);
    playerYaw.current = 0;
    playerPitch.current = 0;

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
      }
    };

    const handleCanvasClick = () => {
      if (gameState.status === 'PLAYING' && document.pointerLockElement !== gl.domElement) {
        gl.domElement.requestPointerLock?.();
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
    const id = `ft_${Date.now()}_${Math.random()}`;
    const newText: FloatingText = {
      id,
      text,
      pos: [pos[0], pos[1] + 0.5, pos[2]],
      color,
      life: 0,
      maxLife: 1.2,
      scale: isCrit ? 1.4 : 1.0,
      isCrit,
    };
    setFloatingTexts((prev) => [...prev.slice(-15), newText]);
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
  const executeAttack = () => {
    if (playerStats.attackCooldown > 0) return;
    swingProgress.current = 1.0;
    gameAudio.playSwordClash();

    setPlayerStats((prev) => ({
      ...prev,
      attackCooldown: 0.35,
    }));

    // Check hit against enemies in front
    const pPos = playerPos.current;
    const pYaw = playerYaw.current;
    forwardVec.set(-Math.sin(pYaw), 0, -Math.cos(pYaw)).normalize();

    let hitAny = false;
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
          hitAny = true;
          const isCrit = Math.random() < playerStats.critChance;
          const dmg = Math.round(
            baseDmg * (isCrit ? 1.8 : 1.0) * (0.9 + Math.random() * 0.2),
          );

          enemy.hp -= dmg;
          enemy.state = 'hurt';
          enemy.stateTimer = 0.2;

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

    if (hitAny) {
      screenShake.current = 0.15;
    }
  };

  // Player Magic Fireball Cast
  const executeSpell = () => {
    if (playerStats.spellCooldown > 0 || playerStats.mana < 15) {
      if (playerStats.mana < 15) {
        gameAudio.playShieldBlock();
      }
      return;
    }
    castProgress.current = 1.0;
    gameAudio.playArcadeLaser();

    setPlayerStats((prev) => ({
      ...prev,
      mana: Math.max(0, prev.mana - 15),
      spellCooldown: 0.6,
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
    if (playerStats.dashCooldown > 0 || playerStats.stamina < 20) return;
    gameAudio.playPowerupChime();

    setPlayerStats((prev) => ({
      ...prev,
      stamina: Math.max(0, prev.stamina - 20),
      dashCooldown: 1.2,
      invulnerableTime: 0.35,
    }));

    isDashing.current = true;
    dashTimer.current = 0.22;

    const pYaw = playerYaw.current;
    dashDir.current.set(-Math.sin(pYaw), 0, -Math.cos(pYaw)).normalize();
    spawnSparks(
      [playerPos.current.x, playerPos.current.y - 0.5, playerPos.current.z],
      '#60a5fa',
      12,
    );
  };

  // Interact with nearby props (chests, shrines, stairs)
  const executeInteract = () => {
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

    if (enemy.isBoss) {
      setStairsUnlocked(true);
      spawnFloatingText('STAIRS TO NEXT FLOOR OPEN!', enemy.pos, '#10b981');
      onBossDefeated?.();
    }
  };

  // Main 60FPS Game & Physics Loop
  useFrame((_, delta) => {
    if (gameState.status !== 'PLAYING') return;
    const dt = Math.min(delta, 0.1);

    // Handle touch look delta from mobile
    if (touchLookDeltaRef.current.dx !== 0 || touchLookDeltaRef.current.dy !== 0) {
      const sens = getConfig('lookSensitivity') * 0.0035;
      playerYaw.current -= touchLookDeltaRef.current.dx * sens;
      playerPitch.current -= touchLookDeltaRef.current.dy * sens;
      playerPitch.current = Math.max(
        -Math.PI / 2.2,
        Math.min(Math.PI / 2.2, playerPitch.current),
      );
      touchLookDeltaRef.current = {dx: 0, dy: 0};
    }

    // Trigger action refs from UI / keyboard
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
      if (input.confirm && !triggerAttackRef.current) {
        executeAttack();
      }
      if (input.tap) {
        // pointer click / tap attack
        executeAttack();
      }
    }

    // Update Player Cooldowns & Stats Regeneration
    setPlayerStats((prev) => {
      const newDashCd = Math.max(0, prev.dashCooldown - dt);
      const newAttackCd = Math.max(0, prev.attackCooldown - dt);
      const newSpellCd = Math.max(0, prev.spellCooldown - dt);
      const newInvul = Math.max(0, prev.invulnerableTime - dt);
      const newStamina = Math.min(prev.maxStamina, prev.stamina + 22 * dt);
      const newMana = Math.min(prev.maxMana, prev.mana + 4 * dt);

      return {
        ...prev,
        dashCooldown: newDashCd,
        attackCooldown: newAttackCd,
        spellCooldown: newSpellCd,
        invulnerableTime: newInvul,
        stamina: newStamina,
        mana: newMana,
      };
    });

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
    const baseSpeed =
      getConfig('playerSpeed') + (playerStats.equippedRing.moveSpeedBonus || 0);

    const cosY = Math.cos(playerYaw.current);
    const sinY = Math.sin(playerYaw.current);

    if (isDashing.current) {
      dashTimer.current -= dt;
      const dashSpeed = baseSpeed * 2.8;
      pPos.x += dashDir.current.x * dashSpeed * dt;
      pPos.z += dashDir.current.z * dashSpeed * dt;
      if (dashTimer.current <= 0) {
        isDashing.current = false;
      }
    } else if (isMoving) {
      const len = Math.hypot(moveX, moveZ);
      const nx = moveX / len;
      const nz = moveZ / len;

      // Transform movement relative to camera yaw
      const worldDx = (nx * cosY - nz * sinY) * baseSpeed * dt;
      const worldDz = (nx * sinY + nz * cosY) * baseSpeed * dt;

      // Wall collision check against grid
      const TILE_SIZE = 4;
      const targetX = pPos.x + worldDx;
      const targetZ = pPos.z + worldDz;
      const gridX = Math.floor(targetX / TILE_SIZE + floorData.gridSize / 2);
      const gridZ = Math.floor(targetZ / TILE_SIZE + floorData.gridSize / 2);

      const canMove =
        gridX >= 0 &&
        gridX < floorData.gridSize &&
        gridZ >= 0 &&
        gridZ < floorData.gridSize &&
        floorData.tiles[gridX][gridZ] === 1;

      if (canMove) {
        pPos.x = targetX;
        pPos.z = targetZ;
      } else {
        // Slide along axes
        const gridXOnly = Math.floor(targetX / TILE_SIZE + floorData.gridSize / 2);
        const curGridZ = Math.floor(pPos.z / TILE_SIZE + floorData.gridSize / 2);
        if (
          gridXOnly >= 0 &&
          gridXOnly < floorData.gridSize &&
          floorData.tiles[gridXOnly][curGridZ] === 1
        ) {
          pPos.x = targetX;
        }

        const curGridX = Math.floor(pPos.x / TILE_SIZE + floorData.gridSize / 2);
        const gridZOnly = Math.floor(targetZ / TILE_SIZE + floorData.gridSize / 2);
        if (
          gridZOnly >= 0 &&
          gridZOnly < floorData.gridSize &&
          floorData.tiles[curGridX][gridZOnly] === 1
        ) {
          pPos.z = targetZ;
        }
      }

      // Footstep sound & head bob
      headBob.current += dt * 12;
      lastFootstepDist.current += Math.hypot(worldDx, worldDz);
      if (lastFootstepDist.current > 2.5) {
        gameAudio.playFootstepStone();
        lastFootstepDist.current = 0;
      }
    }

    // Camera Positioning & Orientation
    const bobOffset = isMoving ? Math.sin(headBob.current) * 0.06 : 0;
    let shakeX = 0;
    let shakeY = 0;
    if (screenShake.current > 0) {
      screenShake.current -= dt * 2.5;
      shakeX = (Math.random() - 0.5) * screenShake.current * 0.3;
      shakeY = (Math.random() - 0.5) * screenShake.current * 0.3;
    }

    camera.position.set(pPos.x + shakeX, pPos.y + bobOffset + shakeY, pPos.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = playerYaw.current;
    camera.rotation.x = playerPitch.current;

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
    }

    // Update Spike Traps
    trapsRef.current.forEach((trap) => {
      trap.timer += dt;
      trap.active = Math.sin(trap.timer * 2.5) > 0.3;
      if (trap.active) {
        scratchVec1.set(trap.pos[0], 0, trap.pos[2]);
        if (pPos.distanceTo(scratchVec1) < 1.4 && playerStats.invulnerableTime <= 0) {
          applyPlayerDamage(trap.damage, 'Spike Trap');
        }
      }
    });

    // Update Enemies AI & Combat Loops
    let aliveCount = 0;
    let bossFound: EnemyEntity | null = null;

    enemiesRef.current.forEach((enemy) => {
      if (enemy.hp <= 0) return;
      aliveCount++;
      if (enemy.isBoss) bossFound = enemy;

      scratchVec1.set(enemy.pos[0], enemy.pos[1], enemy.pos[2]);
      const distToPlayer = pPos.distanceTo(scratchVec1);

      // Look at player
      const angleToPlayer = Math.atan2(
        pPos.x - enemy.pos[0],
        pPos.z - enemy.pos[2],
      );
      enemy.rotY = angleToPlayer;

      // Enemy AI States
      if (distToPlayer < 20.0) {
        if (enemy.state === 'idle') {
          enemy.state = 'chase';
        }

        if (enemy.state === 'chase') {
          if (distToPlayer > enemy.attackRange) {
            // Move toward player
            const speed = enemy.moveSpeed * dt;
            enemy.pos[0] += Math.sin(angleToPlayer) * speed;
            enemy.pos[2] += Math.cos(angleToPlayer) * speed;
          } else {
            enemy.state = 'windup';
            enemy.stateTimer = 0.5;
            enemy.telegraphTimer = 0.5;
          }
        } else if (enemy.state === 'windup') {
          enemy.stateTimer -= dt;
          enemy.telegraphTimer = enemy.stateTimer;
          if (enemy.stateTimer <= 0) {
            enemy.state = 'attack';
            enemy.stateTimer = 0.3;

            // Execute attack
            if (enemy.archetype === 'cultist' || enemy.archetype === 'boss_crimson_archmage') {
              // Ranged homing fireball
              gameAudio.playArcadeLaser();
              const targetX = pPos.x;
              const targetY = pPos.y;
              const targetZ = pPos.z;
              const dx = targetX - enemy.pos[0];
              const dz = targetZ - enemy.pos[2];
              const len = Math.hypot(dx, dz) || 1;
              const spd = 10.0;

              const enemyProj: Projectile = {
                id: `proj_e_${Date.now()}_${Math.random()}`,
                isPlayer: false,
                pos: [enemy.pos[0], enemy.pos[1] + 0.5, enemy.pos[2]],
                velocity: [(dx / len) * spd, 0, (dz / len) * spd],
                damage: enemy.attackPower,
                isCrit: false,
                radius: 0.5,
                life: 0,
                maxLife: 4.0,
                color: '#ef4444',
              };
              setProjectiles((prev) => [...prev, enemyProj]);
            } else {
              // Melee Strike
              if (distToPlayer <= enemy.attackRange + 1.0) {
                applyPlayerDamage(enemy.attackPower, enemy.name);
                gameAudio.playMeleePunch();
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
          if (scratchVec1.distanceTo(pPos) < 1.2 && playerStats.invulnerableTime <= 0) {
            collided = true;
            applyPlayerDamage(proj.damage, 'Dark Magic');
            gameAudio.playShieldBlock();
          }
        }

        if (!collided && proj.life < proj.maxLife) {
          activeProj.push(proj);
        }
      });
      setProjectiles(activeProj);
    }

    // Update Floating Texts
    if (floatingTextsRef.current.length > 0) {
      const activeTexts: FloatingText[] = [];
      floatingTextsRef.current.forEach((ft) => {
        ft.life += dt;
        ft.pos[1] += dt * 1.5; // Float upwards
        if (ft.life < ft.maxLife) {
          activeTexts.push(ft);
        }
      });
      setFloatingTexts(activeTexts);
    }

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
    screenShake.current = 0.35;

    setPlayerStats((prev) => {
      const newHp = Math.max(0, prev.hp - finalDmg);
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

  const TILE_SIZE = 4;
  const halfGrid = floorData.gridSize / 2;

  return (
    <group>
      {/* Player Torch Aura Light */}
      <pointLight
        position={[
          playerPos.current.x,
          playerPos.current.y + 0.5,
          playerPos.current.z,
        ]}
        intensity={35}
        distance={14}
        decay={1.2}
        color="#ffedd5"
      />

      {/* First-Person Animated Viewmodel: Sword & Magic Glow */}
      <group ref={viewmodelRef} position={[0.35, -0.3, -0.6]}>
        {/* Sword Blade */}
        <mesh position={[0, 0.4, 0]} rotation={[0, 0, 0.1]}>
          <boxGeometry args={[0.08, 0.7, 0.02]} />
          <meshStandardMaterial
            color="#e2e8f0"
            metalness={0.9}
            roughness={0.2}
            emissive={playerStats.equippedWeapon.glowColor || '#3b82f6'}
            emissiveIntensity={0.6}
          />
        </mesh>
        {/* Sword Crossguard */}
        <mesh position={[0, 0.08, 0]}>
          <boxGeometry args={[0.26, 0.04, 0.06]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Sword Hilt */}
        <mesh position={[0, -0.06, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.22, 8]} />
          <meshStandardMaterial color="#78350f" roughness={0.8} />
        </mesh>
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

      {/* Dungeon Floor Slabs */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow>
        <planeGeometry args={[floorData.gridSize * TILE_SIZE, floorData.gridSize * TILE_SIZE]} />
        <meshStandardMaterial
          map={floorTexture}
          roughness={0.85}
          metalness={0.1}
        />
      </mesh>

      {/* Dungeon Stone Walls */}
      {floorData.tiles.map((row, gx) =>
        row.map((cell, gy) => {
          if (cell === 2) {
            const wx = (gx - halfGrid) * TILE_SIZE;
            const wz = (gy - halfGrid) * TILE_SIZE;
            return (
              <mesh
                key={`wall_${gx}_${gy}`}
                position={[wx, 2.5, wz]}
                castShadow
                receiveShadow>
                <boxGeometry args={[TILE_SIZE, 5.0, TILE_SIZE]} />
                <meshStandardMaterial
                  map={wallTexture}
                  roughness={0.9}
                  metalness={0.1}
                />
              </mesh>
            );
          }
          return null;
        }),
      )}

      {/* Pillars */}
      {floorData.pillars.map((pos, i) => (
        <group key={`pillar_${i}`} position={[pos[0], 0, pos[2]]}>
          <mesh position={[0, 2.5, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.5, 0.6, 5.0, 12]} />
            <meshStandardMaterial color="#2d2d34" roughness={0.9} />
          </mesh>
          <mesh position={[0, 4.8, 0]} castShadow>
            <boxGeometry args={[1.4, 0.4, 1.4]} />
            <meshStandardMaterial color="#1e1e24" roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Torches with Flickering Warm Lights */}
      {floorData.torches.map((pos, i) => (
        <group key={`torch_${i}`} position={pos}>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.06, 0.04, 0.4, 8]} />
            <meshStandardMaterial color="#78350f" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshStandardMaterial
              color="#f97316"
              emissive="#ea580c"
              emissiveIntensity={2.5}
            />
          </mesh>
          <pointLight
            position={[0, 0.3, 0]}
            intensity={18}
            distance={9}
            decay={1.4}
            color="#ff8c00"
          />
        </group>
      ))}

      {/* Treasure Chests */}
      {chests.map((chest) => (
        <group key={chest.id} position={chest.pos}>
          {/* Base */}
          <mesh position={[0, 0, 0]} castShadow>
            <boxGeometry args={[1.0, 0.6, 0.7]} />
            <meshStandardMaterial
              color={chest.opened ? '#52525b' : '#854d0e'}
              roughness={0.6}
              metalness={0.2}
            />
          </mesh>
          {/* Lid */}
          <mesh
            position={[0, chest.opened ? 0.6 : 0.35, chest.opened ? -0.3 : 0]}
            rotation={[chest.opened ? -0.8 : 0, 0, 0]}
            castShadow>
            <boxGeometry args={[1.04, 0.2, 0.74]} />
            <meshStandardMaterial
              color={chest.opened ? '#71717a' : '#a16207'}
              metalness={0.5}
              roughness={0.4}
            />
          </mesh>
          {/* Rarity Glow Halo */}
          {!chest.opened && (
            <pointLight
              position={[0, 0.4, 0]}
              intensity={8}
              distance={4}
              color={
                chest.tier === 'legendary'
                  ? '#f59e0b'
                  : chest.tier === 'epic'
                    ? '#a855f7'
                    : '#3b82f6'
              }
            />
          )}
        </group>
      ))}

      {/* Shrines */}
      {shrines.map((shrine) => (
        <group key={shrine.id} position={shrine.pos}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <cylinderGeometry args={[0.8, 1.0, 1.0, 10]} />
            <meshStandardMaterial color="#1e1e24" roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.4, 0]} rotation={[0.2, Date.now() * 0.001, 0]}>
            <octahedronGeometry args={[0.35]} />
            <meshStandardMaterial
              color={shrine.type === 'health' ? '#ef4444' : '#38bdf8'}
              emissive={shrine.type === 'health' ? '#b91c1c' : '#0284c7'}
              emissiveIntensity={shrine.used ? 0.2 : 2.0}
            />
          </mesh>
          {!shrine.used && (
            <pointLight
              position={[0, 1.5, 0]}
              intensity={12}
              distance={6}
              color={shrine.type === 'health' ? '#ef4444' : '#38bdf8'}
            />
          )}
        </group>
      ))}

      {/* Animated Floor Spike Traps */}
      {traps.map((trap) => (
        <group key={trap.id} position={trap.pos}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[1.8, 0.05, 1.8]} />
            <meshStandardMaterial
              color={trap.active ? '#ef4444' : '#3f3f46'}
              emissive={trap.active ? '#991b1b' : '#000000'}
              emissiveIntensity={trap.active ? 1.0 : 0}
            />
          </mesh>
          {trap.active && (
            <group position={[0, 0.35, 0]}>
              {[-0.5, 0, 0.5].map((x) =>
                [-0.5, 0, 0.5].map((z) => (
                  <mesh key={`spike_${x}_${z}`} position={[x, 0, z]}>
                    <coneGeometry args={[0.08, 0.7, 6]} />
                    <meshStandardMaterial
                      color="#d4d4d8"
                      metalness={0.8}
                      roughness={0.2}
                    />
                  </mesh>
                )),
              )}
            </group>
          )}
        </group>
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
        {stairsUnlocked && (
          <pointLight
            position={[0, 1.2, 0]}
            intensity={20}
            distance={8}
            color="#10b981"
          />
        )}
      </group>

      {/* 3D Enemies & Bosses */}
      {enemies.map((enemy) => {
        if (enemy.hp <= 0) return null;
        const s = enemy.scale;
        const isHurt = enemy.state === 'hurt';

        return (
          <group
            key={enemy.id}
            position={enemy.pos}
            rotation={[0, enemy.rotY, 0]}
            scale={[s, s, s]}>
            {/* Enemy Telegraph Indicator Ring */}
            {enemy.telegraphTimer > 0 && (
              <mesh
                position={[0, -0.85, 0]}
                rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry
                  args={[
                    0.2,
                    enemy.attackRange * (1.1 - enemy.telegraphTimer),
                    24,
                  ]}
                />
                <meshBasicMaterial
                  color="#ef4444"
                  transparent
                  opacity={0.6}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}

            {/* Boss / Mob Procedural 3D Mesh */}
            {enemy.archetype === 'skeleton' && (
              <group position={[0, 0, 0]}>
                {/* Skull */}
                <mesh position={[0, 0.6, 0]}>
                  <boxGeometry args={[0.3, 0.35, 0.3]} />
                  <meshStandardMaterial
                    color={isHurt ? '#ef4444' : '#e4e4e7'}
                    roughness={0.7}
                  />
                </mesh>
                {/* Ribcage */}
                <mesh position={[0, 0.15, 0]}>
                  <cylinderGeometry args={[0.22, 0.16, 0.5, 8]} />
                  <meshStandardMaterial
                    color={isHurt ? '#ef4444' : '#d4d4d8'}
                    roughness={0.8}
                  />
                </mesh>
                {/* Glowing Eyes */}
                <mesh position={[0.08, 0.65, 0.16]}>
                  <sphereGeometry args={[0.04, 6, 6]} />
                  <meshBasicMaterial color="#ef4444" />
                </mesh>
                <mesh position={[-0.08, 0.65, 0.16]}>
                  <sphereGeometry args={[0.04, 6, 6]} />
                  <meshBasicMaterial color="#ef4444" />
                </mesh>
                {/* Rusty Sword */}
                <mesh position={[0.35, 0.15, 0.2]} rotation={[0.4, 0, -0.2]}>
                  <boxGeometry args={[0.06, 0.6, 0.02]} />
                  <meshStandardMaterial color="#71717a" metalness={0.8} />
                </mesh>
              </group>
            )}

            {enemy.archetype === 'cultist' && (
              <group position={[0, 0, 0]}>
                {/* Hooded Robe */}
                <mesh position={[0, 0.3, 0]}>
                  <coneGeometry args={[0.4, 1.2, 10]} />
                  <meshStandardMaterial
                    color={isHurt ? '#ef4444' : '#581c87'}
                    roughness={0.9}
                  />
                </mesh>
                {/* Glowing Mask */}
                <mesh position={[0, 0.65, 0.15]}>
                  <sphereGeometry args={[0.12, 8, 8]} />
                  <meshBasicMaterial color="#c084fc" />
                </mesh>
                {/* Magic Staff */}
                <mesh position={[0.4, 0.3, 0.1]}>
                  <cylinderGeometry args={[0.03, 0.03, 1.4, 6]} />
                  <meshStandardMaterial color="#451a03" />
                </mesh>
                <mesh position={[0.4, 1.0, 0.1]}>
                  <octahedronGeometry args={[0.15]} />
                  <meshStandardMaterial
                    color="#a855f7"
                    emissive="#9333ea"
                    emissiveIntensity={2.0}
                  />
                </mesh>
              </group>
            )}

            {enemy.archetype === 'slime' && (
              <group position={[0, 0, 0]}>
                <mesh position={[0, 0.2, 0]}>
                  <sphereGeometry args={[0.45, 12, 12]} />
                  <meshStandardMaterial
                    color={isHurt ? '#ef4444' : '#22c55e'}
                    emissive="#15803d"
                    emissiveIntensity={0.6}
                    transparent
                    opacity={0.85}
                  />
                </mesh>
                {/* Slime Nucleus */}
                <mesh position={[0, 0.2, 0]}>
                  <sphereGeometry args={[0.18, 8, 8]} />
                  <meshStandardMaterial color="#166534" />
                </mesh>
              </group>
            )}

            {/* Boss Colossus / Overlord / Archmage */}
            {enemy.isBoss && (
              <group position={[0, 0, 0]}>
                {/* Colossus Torso & Armor */}
                <mesh position={[0, 0.8, 0]} castShadow>
                  <boxGeometry args={[0.9, 1.1, 0.6]} />
                  <meshStandardMaterial
                    color={isHurt ? '#ef4444' : enemy.color}
                    metalness={0.7}
                    roughness={0.3}
                  />
                </mesh>
                {/* Horned Helmet */}
                <mesh position={[0, 1.6, 0]} castShadow>
                  <boxGeometry args={[0.5, 0.55, 0.5]} />
                  <meshStandardMaterial
                    color="#1e1e24"
                    metalness={0.9}
                    roughness={0.2}
                  />
                </mesh>
                {/* Glowing Crown / Horns */}
                <mesh position={[0.3, 1.95, 0]} rotation={[0, 0, 0.4]}>
                  <coneGeometry args={[0.1, 0.5, 6]} />
                  <meshStandardMaterial color="#fbbf24" emissive="#d97706" />
                </mesh>
                <mesh position={[-0.3, 1.95, 0]} rotation={[0, 0, -0.4]}>
                  <coneGeometry args={[0.1, 0.5, 6]} />
                  <meshStandardMaterial color="#fbbf24" emissive="#d97706" />
                </mesh>
                {/* Giant Boss Weapon */}
                <mesh position={[0.75, 0.8, 0.4]} rotation={[0.4, 0, -0.3]}>
                  <boxGeometry args={[0.18, 1.6, 0.08]} />
                  <meshStandardMaterial
                    color="#475569"
                    metalness={0.9}
                    emissive={enemy.color}
                    emissiveIntensity={0.8}
                  />
                </mesh>
                <pointLight
                  position={[0, 1.5, 0]}
                  intensity={15}
                  distance={8}
                  color={enemy.color}
                />
              </group>
            )}
          </group>
        );
      })}

      {/* Projectiles */}
      {projectiles.map((proj) => (
        <group key={proj.id} position={proj.pos}>
          <mesh>
            <sphereGeometry args={[proj.radius, 12, 12]} />
            <meshStandardMaterial
              color={proj.color}
              emissive={proj.color}
              emissiveIntensity={2.5}
            />
          </mesh>
          <pointLight
            intensity={10}
            distance={5}
            color={proj.color}
          />
        </group>
      ))}

      {/* Particle Sparks */}
      {particles.map((p) => (
        <mesh key={p.id} position={p.pos}>
          <sphereGeometry args={[p.size, 6, 6]} />
          <meshBasicMaterial color={p.color} />
        </mesh>
      ))}
    </group>
  );
}

/** Main Game Canvas Export */
export function Game(props: GameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useInput(containerRef, {enabled: true});

  return (
    <div ref={containerRef} className="w-full h-full canvas-wrapper relative">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{
          fov: getConfig('fov'),
          near: 0.1,
          far: 1000,
          position: [0, 1.5, 0],
        }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
        scene={{
          background: new THREE.Color(getConfig('backgroundColor')),
          fog: new THREE.FogExp2(getConfig('backgroundColor'), 0.04),
        }}>
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
