import { Point, EnemyRocket, InterceptorMissile, Battery, City, GameStatus } from './types';

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

export const INITIAL_BATTERIES: Battery[] = [
  { id: 'b1', x: 40, y: GAME_HEIGHT - 40, missiles: 20, maxMissiles: 20, isDestroyed: false },
  { id: 'b2', x: GAME_WIDTH / 2, y: GAME_HEIGHT - 40, missiles: 40, maxMissiles: 40, isDestroyed: false },
  { id: 'b3', x: GAME_WIDTH - 40, y: GAME_HEIGHT - 40, missiles: 20, maxMissiles: 20, isDestroyed: false },
];

export const INITIAL_CITIES: City[] = [
  { id: 'c1', x: 150, y: GAME_HEIGHT - 30, isDestroyed: false },
  { id: 'c2', x: 250, y: GAME_HEIGHT - 30, isDestroyed: false },
  { id: 'c3', x: 350, y: GAME_HEIGHT - 30, isDestroyed: false },
  { id: 'c4', x: 450, y: GAME_HEIGHT - 30, isDestroyed: false },
  { id: 'c5', x: 550, y: GAME_HEIGHT - 30, isDestroyed: false },
  { id: 'c6', x: 650, y: GAME_HEIGHT - 30, isDestroyed: false },
];

export const I18N = {
  zh: {
    title: "贝贝可可大冒险",
    start: "开始游戏",
    restart: "再玩一次",
    win: "任务成功！",
    lose: "防线崩溃...",
    score: "得分",
    round: "关卡",
    missiles: "弹药",
    instructions: "点击屏幕发射拦截导弹。保护城市和炮台！",
    winMsg: "你成功保卫了家园！",
    loseMsg: "所有炮台已被摧毁。",
    targetScore: "目标: 1000分"
  },
  en: {
    title: "Beibei & Keke's Adventure",
    start: "Start Game",
    restart: "Play Again",
    win: "Mission Success!",
    lose: "Defense Failed...",
    score: "Score",
    round: "Round",
    missiles: "Ammo",
    instructions: "Click to fire interceptors. Protect cities and batteries!",
    winMsg: "You successfully defended the homeland!",
    loseMsg: "All batteries have been destroyed.",
    targetScore: "Target: 1000 pts"
  }
};
