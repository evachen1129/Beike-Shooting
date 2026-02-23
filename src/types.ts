export type Point = { x: number; y: number };

export enum GameStatus {
  START = 'START',
  PLAYING = 'PLAYING',
  WON = 'WON',
  LOST = 'LOST',
  ROUND_END = 'ROUND_END'
}

export interface Entity {
  id: string;
  x: number;
  y: number;
}

export interface EnemyRocket extends Entity {
  targetX: number;
  targetY: number;
  speed: number;
  progress: number; // 0 to 1
  isIntercepted?: boolean;
  alienType: number;
  hp: number;
  maxHp: number;
  hasShield?: boolean;
  isBoss?: boolean;
}

export interface InterceptorMissile extends Entity {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  speed: number;
  progress: number; // 0 to 1
  isExploding: boolean;
  explosionRadius: number;
  maxExplosionRadius: number;
  explosionSpeed: number;
}

export interface Battery extends Entity {
  missiles: number;
  maxMissiles: number;
  isDestroyed: boolean;
}

export interface City extends Entity {
  isDestroyed: boolean;
}

export interface GameState {
  score: number;
  status: GameStatus;
  round: number;
  enemies: EnemyRocket[];
  missiles: InterceptorMissile[];
  batteries: Battery[];
  cities: City[];
  explosions: { x: number; y: number; radius: number; maxRadius: number; id: string; color?: string }[];
  energy: number;
  combo: number;
  lastKillTime: number;
}
