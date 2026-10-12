// tslint:disable
/* eslint-disable */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type Position3D = [number, number, number];

export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type ItemType = 'weapon' | 'armor' | 'ring' | 'potion';

export interface LootItem {
  id: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  level: number;
  iconName: string;
  description: string;
  damage?: number;
  defense?: number;
  maxHpBonus?: number;
  maxManaBonus?: number;
  critChance?: number; // 0..1
  lifeSteal?: number; // 0..1
  moveSpeedBonus?: number;
  healAmount?: number;
  manaAmount?: number;
  modelStyle?: string;
  glowColor?: string;
}

export interface DungeonRoom {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'spawn' | 'combat' | 'treasure' | 'shrine' | 'boss';
  cleared: boolean;
}

export interface ChestEntity {
  id: string;
  gridX: number;
  gridY: number;
  pos: Position3D;
  opened: boolean;
  loot: LootItem;
  tier: ItemRarity;
}

export interface ShrineEntity {
  id: string;
  gridX: number;
  gridY: number;
  pos: Position3D;
  used: boolean;
  type: 'health' | 'mana' | 'buff';
}

export interface TrapEntity {
  id: string;
  gridX: number;
  gridY: number;
  pos: Position3D;
  active: boolean;
  timer: number;
  damage: number;
}

export interface StairsEntity {
  pos: Position3D;
  unlocked: boolean;
}

export interface Projectile {
  id: string;
  isPlayer: boolean;
  pos: Position3D;
  velocity: Position3D;
  damage: number;
  isCrit: boolean;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
  homing?: boolean;
  targetPos?: Position3D;
}

export type EnemyArchetype =
  | 'skeleton'
  | 'cultist'
  | 'slime'
  | 'boss_bone_colossus'
  | 'boss_crimson_archmage'
  | 'boss_gorgon'
  | 'boss_shadow_knight'
  | 'boss_void_overlord';

export interface EnemyEntity {
  id: string;
  archetype: EnemyArchetype;
  name: string;
  pos: Position3D;
  rotY: number;
  hp: number;
  maxHp: number;
  attackPower: number;
  attackSpeed: number;
  attackTimer: number;
  attackRange: number;
  moveSpeed: number;
  state: 'idle' | 'chase' | 'windup' | 'attack' | 'hurt' | 'dead';
  stateTimer: number;
  telegraphTimer: number;
  isBoss: boolean;
  tier: number;
  color: string;
  scale: number;
  dropLoot?: LootItem;
}

export interface FloatingText {
  id: string;
  text: string;
  pos: Position3D;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
  isCrit?: boolean;
}

export interface SparkParticle {
  id: string;
  pos: Position3D;
  vel: Position3D;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  stamina: number;
  maxStamina: number;
  gold: number;
  potions: number;
  keys: number;
  equippedWeapon: LootItem;
  equippedArmor: LootItem;
  equippedRing: LootItem;
  baseAttack: number;
  baseDefense: number;
  baseSpeed: number;
  critChance: number;
  lifeSteal: number;
  dashCooldown: number;
  invulnerableTime: number;
  attackCooldown: number;
  spellCooldown: number;
  swingAnim: number; // 0..1 swing progression
  castAnim: number;
}

export interface DungeonFloorData {
  floorLevel: number;
  gridSize: number;
  tiles: number[][]; // 0: void/empty, 1: floor, 2: wall, 3: door
  rooms: DungeonRoom[];
  spawnPos: Position3D;
  stairs: StairsEntity;
  chests: ChestEntity[];
  shrines: ShrineEntity[];
  traps: TrapEntity[];
  torches: Position3D[];
  pillars: Position3D[];
}

export interface Entity3D {
  id: string | number;
  type?: string;
  position: Vec3 | Position3D;
  rotation?: Vec3 | Position3D;
  scale?: Vec3 | Position3D;
  velocity?: Vec3;
  active?: boolean;
  [key: string]: any;
}

export interface Particle {
  id: string | number;
  position: Vec3 | Position3D;
  velocity?: Vec3 | Position3D;
  life: number;
  maxLife: number;
  color?: string;
  size?: number;
  [key: string]: any;
}
