import {
  ChestEntity,
  DungeonFloorData,
  DungeonRoom,
  EnemyArchetype,
  EnemyEntity,
  ItemRarity,
  LootItem,
  Position3D,
  ShrineEntity,
  TrapEntity,
} from './types';

// Seeded PRNG
export function createRng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateLootItem(
  floorLevel: number,
  playerPower: number,
  guaranteedRarity?: ItemRarity,
): LootItem {
  const rng = Math.random;
  let rarity: ItemRarity = guaranteedRarity || 'common';
  if (!guaranteedRarity) {
    const roll = rng() + (floorLevel * 0.04) + (playerPower * 0.01);
    if (roll > 1.2) rarity = 'legendary';
    else if (roll > 0.9) rarity = 'epic';
    else if (roll > 0.55) rarity = 'rare';
    else rarity = 'common';
  }

  const types: ('weapon' | 'armor' | 'ring' | 'potion')[] = [
    'weapon',
    'armor',
    'ring',
    'potion',
  ];
  const type = types[Math.floor(rng() * types.length)];

  const rarityMult =
    rarity === 'legendary'
      ? 3.0
      : rarity === 'epic'
        ? 2.2
        : rarity === 'rare'
          ? 1.5
          : 1.0;

  const lvlFactor = 1 + (floorLevel - 1) * 0.35;

  if (type === 'weapon') {
    const weaponNames = [
      'Iron Broadsword',
      'Runic Claymore',
      'Flaming Scimitar',
      'Frostbite Rapier',
      'Abyssal Cleaver',
      'Sunfire Blade',
      'Void Katana',
    ];
    const name = `${rarity.toUpperCase()} ${weaponNames[Math.floor(rng() * weaponNames.length)]}`;
    const damage = Math.round((20 + rng() * 15) * lvlFactor * rarityMult);
    const crit = Math.min(0.5, 0.05 + (rarityMult - 1) * 0.1);
    const lifeSteal = rarity === 'legendary' ? 0.12 : rarity === 'epic' ? 0.06 : 0;
    const glowColors: Record<ItemRarity, string> = {
      common: '#cccccc',
      rare: '#3b82f6',
      epic: '#a855f7',
      legendary: '#f59e0b',
    };

    return {
      id: `loot_w_${Date.now()}_${Math.floor(rng() * 10000)}`,
      name,
      type: 'weapon',
      rarity,
      level: floorLevel,
      iconName: 'sword',
      description: `Deals ${damage} damage with ${Math.round(crit * 100)}% crit chance.`,
      damage,
      critChance: crit,
      lifeSteal,
      glowColor: glowColors[rarity],
    };
  }

  if (type === 'armor') {
    const armorNames = [
      'Hardened Leather',
      'Knight Mail',
      'Dwarven Plate',
      'Dragonscale Aegis',
      'Shadow Cuirass',
      'Paladin Chestplate',
    ];
    const name = `${rarity.toUpperCase()} ${armorNames[Math.floor(rng() * armorNames.length)]}`;
    const defense = Math.round((10 + rng() * 10) * lvlFactor * rarityMult);
    const maxHpBonus = Math.round((20 + rng() * 20) * lvlFactor * rarityMult);

    return {
      id: `loot_a_${Date.now()}_${Math.floor(rng() * 10000)}`,
      name,
      type: 'armor',
      rarity,
      level: floorLevel,
      iconName: 'shield',
      description: `Provides +${defense} Defense and +${maxHpBonus} Max HP.`,
      defense,
      maxHpBonus,
    };
  }

  if (type === 'ring') {
    const ringNames = [
      'Band of Swiftness',
      'Ring of Leeching',
      'Gargoyle Seal',
      'Eye of the Abyss',
      'Crown of Fury',
    ];
    const name = `${rarity.toUpperCase()} ${ringNames[Math.floor(rng() * ringNames.length)]}`;
    const moveSpeedBonus = Math.round((0.5 + rng() * 1.5) * rarityMult * 10) / 10;
    const critBonus = Math.round((0.05 + rng() * 0.08) * rarityMult * 100) / 100;
    const lifeSteal = rarity === 'legendary' ? 0.08 : 0.03;

    return {
      id: `loot_r_${Date.now()}_${Math.floor(rng() * 10000)}`,
      name,
      type: 'ring',
      rarity,
      level: floorLevel,
      iconName: 'ring',
      description: `+${moveSpeedBonus} Move Speed, +${Math.round(critBonus * 100)}% Crit Chance, +${Math.round(lifeSteal * 100)}% Life Steal.`,
      moveSpeedBonus,
      critChance: critBonus,
      lifeSteal,
    };
  }

  // Potion
  const isMana = rng() > 0.5;
  return {
    id: `loot_p_${Date.now()}_${Math.floor(rng() * 10000)}`,
    name: isMana ? 'Greater Mana Draught' : 'Elixir of Restoration',
    type: 'potion',
    rarity: 'common',
    level: floorLevel,
    iconName: isMana ? 'flask-mana' : 'flask-hp',
    description: isMana ? 'Restores 40 Mana immediately.' : 'Restores 50 HP immediately.',
    healAmount: isMana ? 0 : 50,
    manaAmount: isMana ? 40 : 0,
  };
}

export function generateDungeonFloor(
  floorLevel: number,
  playerPower: number,
  seed = Date.now(),
): {
  floorData: DungeonFloorData;
  enemies: EnemyEntity[];
} {
  const rng = createRng(seed);
  const gridSize = 24; // 24x24 tile grid (each tile = 4x4 world units)
  const TILE_SIZE = 4;

  // 0: void, 1: floor, 2: wall, 3: door
  const tiles: number[][] = Array(gridSize)
    .fill(0)
    .map(() => Array(gridSize).fill(0));

  const rooms: DungeonRoom[] = [];
  const minRoomSize = 4;
  const maxRoomSize = 6;
  const roomCount = 5 + Math.min(3, floorLevel);

  let attempts = 0;
  while (rooms.length < roomCount && attempts < 100) {
    attempts++;
    const w = Math.floor(rng() * (maxRoomSize - minRoomSize + 1)) + minRoomSize;
    const h = Math.floor(rng() * (maxRoomSize - minRoomSize + 1)) + minRoomSize;
    const x = Math.floor(rng() * (gridSize - w - 2)) + 1;
    const y = Math.floor(rng() * (gridSize - h - 2)) + 1;

    // Check overlap with 1 tile border
    let overlaps = false;
    for (const r of rooms) {
      if (
        x < r.x + r.w + 1 &&
        x + w + 1 > r.x &&
        y < r.y + r.h + 1 &&
        y + h + 1 > r.y
      ) {
        overlaps = true;
        break;
      }
    }

    if (!overlaps) {
      const type: DungeonRoom['type'] =
        rooms.length === 0
          ? 'spawn'
          : rooms.length === roomCount - 1
            ? 'boss'
            : rng() > 0.6
              ? 'treasure'
              : rng() > 0.8
                ? 'shrine'
                : 'combat';

      rooms.push({x, y, w, h, type, cleared: type === 'spawn'});

      // Carve floor
      for (let rx = x; rx < x + w; rx++) {
        for (let ry = y; ry < y + h; ry++) {
          tiles[rx][ry] = 1;
        }
      }
    }
  }

  // Connect rooms with corridors
  for (let i = 0; i < rooms.length - 1; i++) {
    const r1 = rooms[i];
    const r2 = rooms[i + 1];

    let cx = Math.floor(r1.x + r1.w / 2);
    let cy = Math.floor(r1.y + r1.h / 2);
    const targetX = Math.floor(r2.x + r2.w / 2);
    const targetY = Math.floor(r2.y + r2.h / 2);

    while (cx !== targetX) {
      tiles[cx][cy] = 1;
      cx += cx < targetX ? 1 : -1;
    }
    while (cy !== targetY) {
      tiles[cx][cy] = 1;
      cy += cy < targetY ? 1 : -1;
    }
  }

  // Add surrounding walls to every floor tile
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      if (tiles[x][y] === 0) {
        let hasFloorNeighbor = false;
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
              if (tiles[nx][ny] === 1) {
                hasFloorNeighbor = true;
                break;
              }
            }
          }
          if (hasFloorNeighbor) break;
        }
        if (hasFloorNeighbor) {
          tiles[x][y] = 2; // wall
        }
      }
    }
  }

  const spawnRoom = rooms[0];
  const bossRoom = rooms[rooms.length - 1];

  const toWorld = (gx: number, gy: number, yOffset = 0): Position3D => {
    return [
      (gx - gridSize / 2) * TILE_SIZE,
      yOffset,
      (gy - gridSize / 2) * TILE_SIZE,
    ];
  };

  const spawnPos: Position3D = toWorld(
    Math.floor(spawnRoom.x + spawnRoom.w / 2),
    Math.floor(spawnRoom.y + spawnRoom.h / 2),
    1.2,
  );

  const stairsPos: Position3D = toWorld(
    Math.floor(bossRoom.x + bossRoom.w / 2),
    Math.floor(bossRoom.y + bossRoom.h / 2),
    0,
  );

  const chests: ChestEntity[] = [];
  const shrines: ShrineEntity[] = [];
  const traps: TrapEntity[] = [];
  const torches: Position3D[] = [];
  const pillars: Position3D[] = [];
  const enemies: EnemyEntity[] = [];

  // Populate props per room
  rooms.forEach((room, idx) => {
    const rx = room.x;
    const ry = room.y;
    const rw = room.w;
    const rh = room.h;

    // Torches on room corners
    torches.push(toWorld(rx + 0.2, ry + 0.2, 2.2));
    torches.push(toWorld(rx + rw - 0.2, ry + rh - 0.2, 2.2));

    // Pillars in larger rooms
    if (rw >= 5 && rh >= 5) {
      pillars.push(toWorld(rx + 1.2, ry + 1.2, 0));
      pillars.push(toWorld(rx + rw - 1.2, ry + 1.2, 0));
      pillars.push(toWorld(rx + 1.2, ry + rh - 1.2, 0));
      pillars.push(toWorld(rx + rw - 1.2, ry + rh - 1.2, 0));
    }

    if (room.type === 'treasure') {
      const chestPos = toWorld(rx + rw / 2, ry + rh / 2, 0.4);
      const guaranteedTier: ItemRarity =
        floorLevel >= 4 ? 'epic' : floorLevel >= 2 ? 'rare' : 'common';
      chests.push({
        id: `chest_${idx}`,
        gridX: rx + rw / 2,
        gridY: ry + rh / 2,
        pos: chestPos,
        opened: false,
        loot: generateLootItem(floorLevel, playerPower, guaranteedTier),
        tier: guaranteedTier,
      });
    } else if (room.type === 'shrine') {
      const shrinePos = toWorld(rx + rw / 2, ry + rh / 2, 0);
      shrines.push({
        id: `shrine_${idx}`,
        gridX: rx + rw / 2,
        gridY: ry + rh / 2,
        pos: shrinePos,
        used: false,
        type: rng() > 0.5 ? 'health' : 'mana',
      });
    }

    // Traps in some corridors/combat rooms
    if (room.type === 'combat' && rng() > 0.4) {
      traps.push({
        id: `trap_${idx}`,
        gridX: rx + rw / 2,
        gridY: ry + rh / 2,
        pos: toWorld(rx + rw / 2, ry + rh / 2, 0.05),
        active: false,
        timer: rng() * 3,
        damage: 15 + floorLevel * 5,
      });
    }

    // Spawn enemies in combat rooms
    if (room.type === 'combat') {
      const count = 2 + Math.floor(rng() * 3) + Math.floor(floorLevel * 0.5);
      for (let i = 0; i < count; i++) {
        const ex = rx + 1 + rng() * (rw - 2);
        const ey = ry + 1 + rng() * (rh - 2);
        const enemyPos = toWorld(ex, ey, 0.9);

        const mobRoll = rng();
        let archetype: EnemyArchetype = 'skeleton';
        let name = 'Skeleton Grunt';
        let hp = 45 + floorLevel * 20 + Math.round(playerPower * 2);
        let attackPower = 12 + floorLevel * 4;
        let speed = 2.8 + rng() * 0.8;
        let color = '#d4d4d8';
        let scale = 1.0;

        if (mobRoll > 0.65) {
          archetype = 'cultist';
          name = 'Shadow Cultist';
          hp = 35 + floorLevel * 15;
          attackPower = 18 + floorLevel * 6;
          speed = 2.4;
          color = '#9333ea';
          scale = 0.95;
        } else if (mobRoll > 0.35) {
          archetype = 'slime';
          name = 'Abyssal Slime';
          hp = 60 + floorLevel * 25;
          attackPower = 10 + floorLevel * 3;
          speed = 2.0;
          color = '#22c55e';
          scale = 1.1;
        }

        enemies.push({
          id: `mob_${idx}_${i}`,
          archetype,
          name,
          pos: enemyPos,
          rotY: rng() * Math.PI * 2,
          hp,
          maxHp: hp,
          attackPower,
          attackSpeed: 1.2,
          attackTimer: 0,
          attackRange: archetype === 'cultist' ? 8.0 : 2.0,
          moveSpeed: speed,
          state: 'idle',
          stateTimer: 0,
          telegraphTimer: 0,
          isBoss: false,
          tier: floorLevel,
          color,
          scale,
          dropLoot: rng() > 0.6 ? generateLootItem(floorLevel, playerPower) : undefined,
        });
      }
    }
  });

  // Spawn Floor Boss in the Boss Chamber!
  const bossArchetypes: EnemyArchetype[] = [
    'boss_bone_colossus',
    'boss_crimson_archmage',
    'boss_gorgon',
    'boss_shadow_knight',
    'boss_void_overlord',
  ];
  const bossNames = [
    'BONE COLOSSUS',
    'CRIMSON ARCHMAGE',
    'ABYSSAL GORGON',
    'SHADOW KNIGHT LORD',
    'VOID OVERLORD',
  ];

  const bossIdx = (floorLevel - 1) % bossArchetypes.length;
  const bossArchetype = bossArchetypes[bossIdx];
  const bossName = bossNames[bossIdx];

  const bossHp = 220 + floorLevel * 140 + Math.round(playerPower * 12);
  const bossDmg = 24 + floorLevel * 8 + Math.round(playerPower * 1.5);
  const bossPos = toWorld(
    bossRoom.x + bossRoom.w / 2,
    bossRoom.y + bossRoom.h / 2,
    1.4,
  );

  enemies.push({
    id: `boss_floor_${floorLevel}`,
    archetype: bossArchetype,
    name: bossName,
    pos: bossPos,
    rotY: Math.PI,
    hp: bossHp,
    maxHp: bossHp,
    attackPower: bossDmg,
    attackSpeed: 1.8,
    attackTimer: 0,
    attackRange: 4.5,
    moveSpeed: 3.2,
    state: 'idle',
    stateTimer: 0,
    telegraphTimer: 0,
    isBoss: true,
    tier: floorLevel,
    color: bossIdx === 0 ? '#ef4444' : bossIdx === 1 ? '#e11d48' : bossIdx === 2 ? '#10b981' : bossIdx === 3 ? '#6366f1' : '#a855f7',
    scale: 1.8,
    dropLoot: generateLootItem(floorLevel, playerPower, 'legendary'),
  });

  return {
    floorData: {
      floorLevel,
      gridSize,
      tiles,
      rooms,
      spawnPos,
      stairs: {pos: stairsPos, unlocked: false},
      chests,
      shrines,
      traps,
      torches,
      pillars,
    },
    enemies,
  };
}
