/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Target, Trophy, AlertTriangle, Languages } from 'lucide-react';
import { 
  Point, 
  GameStatus, 
  EnemyRocket, 
  InterceptorMissile, 
  Battery, 
  City 
} from './types';
import { 
  GAME_WIDTH, 
  GAME_HEIGHT, 
  INITIAL_BATTERIES, 
  INITIAL_CITIES, 
  I18N 
} from './constants';

export default function App() {
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const [status, setStatus] = useState<GameStatus>(GameStatus.START);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  // Game State Refs (for high performance updates in loop)
  const enemiesRef = useRef<EnemyRocket[]>([]);
  const missilesRef = useRef<InterceptorMissile[]>([]);
  const batteriesRef = useRef<Battery[]>(JSON.parse(JSON.stringify(INITIAL_BATTERIES)));
  const citiesRef = useRef<City[]>(JSON.parse(JSON.stringify(INITIAL_CITIES)));
  const explosionsRef = useRef<{ x: number; y: number; radius: number; maxRadius: number; id: string; active: boolean }[]>([]);
  const starsRef = useRef<{ x: number; y: number; size: number }[]>([]);

  // Initialize stars once
  useEffect(() => {
    const stars = [];
    for (let i = 0; i < 150; i++) {
      stars.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        size: Math.random() * 1.5 + 0.5
      });
    }
    starsRef.current = stars;
  }, []);
  
  const t = I18N[lang];

  const playSound = useCallback((type: 'explosion' | 'impact') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      if (type === 'explosion') {
        // Sharp explosion for enemy hit
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      } else {
        // Deep thud for player hit
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(100, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      }

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
      
      // Close context to save resources
      setTimeout(() => audioCtx.close(), 1000);
    } catch (e) {
      console.warn('Audio context failed', e);
    }
  }, []);

  const initGame = useCallback(() => {
    enemiesRef.current = [];
    missilesRef.current = [];
    batteriesRef.current = JSON.parse(JSON.stringify(INITIAL_BATTERIES));
    citiesRef.current = JSON.parse(JSON.stringify(INITIAL_CITIES));
    explosionsRef.current = [];
    setScore(0);
    setRound(1);
    setStatus(GameStatus.PLAYING);
  }, []);

  const spawnEnemy = useCallback(() => {
    if (status !== GameStatus.PLAYING) return;
    
    const startX = Math.random() * GAME_WIDTH;
    const targets = [...citiesRef.current.filter(c => !c.isDestroyed), ...batteriesRef.current.filter(b => !b.isDestroyed)];
    
    if (targets.length === 0) return;
    
    const target = targets[Math.floor(Math.random() * targets.length)];
    
    // Alien Types: 0 (Normal), 1 (Fast), 2 (Tank)
    const alienType = Math.floor(Math.random() * 3);
    let speedMult = 1;
    if (alienType === 1) speedMult = 1.5; // Fast
    if (alienType === 2) speedMult = 0.7; // Tank

    const speed = (0.001 + (round * 0.0002)) * speedMult;
    
    enemiesRef.current.push({
      id: Math.random().toString(36).substr(2, 9),
      x: startX,
      y: 0,
      targetX: target.x,
      targetY: target.y,
      speed: speed,
      progress: 0,
      alienType
    });
  }, [status, round]);

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (status !== GameStatus.PLAYING) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const scaleX = GAME_WIDTH / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;
    
    const targetX = (clientX - rect.left) * scaleX;
    const targetY = (clientY - rect.top) * scaleY;

    // Find closest battery with missiles
    let bestBattery: Battery | null = null;
    let minDist = Infinity;

    batteriesRef.current.forEach(b => {
      if (!b.isDestroyed && b.missiles > 0) {
        const dist = Math.abs(b.x - targetX);
        if (dist < minDist) {
          minDist = dist;
          bestBattery = b;
        }
      }
    });

    if (bestBattery) {
      (bestBattery as Battery).missiles -= 1;
      missilesRef.current.push({
        id: Math.random().toString(36).substr(2, 9),
        x: (bestBattery as Battery).x,
        y: (bestBattery as Battery).y,
        startX: (bestBattery as Battery).x,
        startY: (bestBattery as Battery).y,
        targetX,
        targetY,
        speed: 0.04,
        progress: 0,
        isExploding: false,
        explosionRadius: 0,
        maxExplosionRadius: 40,
        explosionSpeed: 1.5
      });
    }
  };

  const update = useCallback((time: number) => {
    if (status !== GameStatus.PLAYING) return;

    // 1. Update Enemies
    enemiesRef.current.forEach(enemy => {
      if (enemy.isIntercepted) return;

      enemy.progress += enemy.speed;
      enemy.x = enemy.x + (enemy.targetX - enemy.x) * enemy.speed / (1 - enemy.progress + enemy.speed);
      enemy.y = enemy.y + (enemy.targetY - enemy.y) * enemy.speed / (1 - enemy.progress + enemy.speed);

      // Check if hit target
      if (enemy.progress >= 1) {
        // Find target and destroy
        let hitSomething = false;
        citiesRef.current.forEach(c => {
          if (Math.abs(c.x - enemy.targetX) < 5 && Math.abs(c.y - enemy.targetY) < 5 && !c.isDestroyed) {
            c.isDestroyed = true;
            hitSomething = true;
          }
        });
        batteriesRef.current.forEach(b => {
          if (Math.abs(b.x - enemy.targetX) < 5 && Math.abs(b.y - enemy.targetY) < 5 && !b.isDestroyed) {
            b.isDestroyed = true;
            hitSomething = true;
          }
        });
        
        if (hitSomething) {
          playSound('impact');
        }
        
        enemy.progress = 2; // Mark for removal
      }
    });
    enemiesRef.current = enemiesRef.current.filter(e => e.progress < 1.5 && !e.isIntercepted);

    // 2. Update Missiles
    missilesRef.current.forEach(m => {
      if (!m.isExploding) {
        m.progress += m.speed;
        m.x = m.startX + (m.targetX - m.startX) * m.progress;
        m.y = m.startY + (m.targetY - m.startY) * m.progress;

        if (m.progress >= 1) {
          m.isExploding = true;
          explosionsRef.current.push({
            id: m.id,
            x: m.targetX,
            y: m.targetY,
            radius: 0,
            maxRadius: m.maxExplosionRadius,
            active: true
          });
        }
      }
    });
    missilesRef.current = missilesRef.current.filter(m => !m.isExploding);

    // 3. Update Explosions
    explosionsRef.current.forEach(exp => {
      if (exp.active) {
        exp.radius += 1.2;
        if (exp.radius >= exp.maxRadius) {
          exp.active = false;
        }

        // Check collision with enemies
        enemiesRef.current.forEach(enemy => {
          const dist = Math.sqrt(Math.pow(enemy.x - exp.x, 2) + Math.pow(enemy.y - exp.y, 2));
          if (dist < exp.radius) {
            if (!enemy.isIntercepted) { // Only play once
              playSound('explosion');
              enemy.isIntercepted = true;
              setScore(prev => prev + 20);
            }
          }
        });
      }
    });
    explosionsRef.current = explosionsRef.current.filter(exp => exp.active);

    // 4. Check Game Over / Win
    const activeBatteries = batteriesRef.current.filter(b => !b.isDestroyed);
    if (activeBatteries.length === 0) {
      setStatus(GameStatus.LOST);
    }
    
    // Check Win Condition (1000 points)
    // We use a functional update for score, but we need to check it here.
    // Since setScore is async, we'll check the current score in the next frame or use a ref.
    // For simplicity, I'll check the score state in the UI render or use a ref for score.
  }, [status, round]);

  // Score check win condition
  useEffect(() => {
    if (score >= 1000 && status === GameStatus.PLAYING) {
      setStatus(GameStatus.WON);
    }
  }, [score, status]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Background
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw Stars
    ctx.fillStyle = 'white';
    starsRef.current.forEach(star => {
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw City Skyline Silhouette (Shadow Outlines)
    ctx.fillStyle = 'rgba(20, 20, 30, 0.8)';
    const skyline = [
      { x: 0, w: 50, h: 80 }, { x: 60, w: 40, h: 120 }, { x: 110, w: 60, h: 100 },
      { x: 180, w: 30, h: 150 }, { x: 220, w: 70, h: 90 }, { x: 300, w: 50, h: 130 },
      { x: 360, w: 40, h: 110 }, { x: 410, w: 80, h: 140 }, { x: 500, w: 30, h: 160 },
      { x: 540, w: 60, h: 100 }, { x: 610, w: 50, h: 130 }, { x: 670, w: 40, h: 110 },
      { x: 720, w: 80, h: 90 }
    ];
    skyline.forEach(b => {
      ctx.fillRect(b.x, GAME_HEIGHT - 20 - b.h, b.w, b.h);
    });

    // Draw Ground
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(0, GAME_HEIGHT - 20, GAME_WIDTH, 20);

    // Draw Cities
    citiesRef.current.forEach(city => {
      if (!city.isDestroyed) {
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(city.x - 15, city.y - 10, 30, 10);
        ctx.fillRect(city.x - 10, city.y - 20, 20, 10);
      } else {
        ctx.fillStyle = '#450a0a';
        ctx.fillRect(city.x - 15, city.y - 5, 30, 5);
      }
    });

    // Draw Batteries
    batteriesRef.current.forEach((b, index) => {
      if (!b.isDestroyed) {
        ctx.save();
        ctx.translate(b.x, b.y);

        // Flag Base
        const isMiddle = index === 1;
        const flagW = 40;
        const flagH = 26;
        
        if (isMiddle) {
          // China Flag
          ctx.fillStyle = '#DE2910';
          ctx.fillRect(-flagW/2, -flagH, flagW, flagH);
          
          // Stars
          ctx.fillStyle = '#FFDE00';
          // Large star
          ctx.beginPath();
          const r = 4;
          for(let i=0; i<5; i++) {
            ctx.lineTo(Math.cos((18+i*72)/180*Math.PI)*r - 12, Math.sin((18+i*72)/180*Math.PI)*r - 18);
            ctx.lineTo(Math.cos((54+i*72)/180*Math.PI)*r/2 - 12, Math.sin((54+i*72)/180*Math.PI)*r/2 - 18);
          }
          ctx.closePath();
          ctx.fill();
        } else {
          // Russia Flag
          ctx.fillStyle = 'white';
          ctx.fillRect(-flagW/2, -flagH, flagW, flagH/3);
          ctx.fillStyle = '#0039A6';
          ctx.fillRect(-flagW/2, -flagH + flagH/3, flagW, flagH/3);
          ctx.fillStyle = '#D52B1E';
          ctx.fillRect(-flagW/2, -flagH + 2*flagH/3, flagW, flagH/3);
        }

        // Cannon
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, -flagH);
        ctx.lineTo(0, -flagH - 10);
        ctx.stroke();

        ctx.restore();
        
        // Draw Ammo Count
        ctx.fillStyle = 'white';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(b.missiles.toString(), b.x, b.y + 15);
      } else {
        ctx.fillStyle = '#450a0a';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 10, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw Enemies (Alien Style)
    enemiesRef.current.forEach(e => {
      // Trail
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.setLineDash([2, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(e.x - (e.x - e.targetX) * 0.1, e.y - (e.y - e.targetY) * 0.1);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.save();
      ctx.translate(e.x, e.y);
      
      // Alien Drawing based on type
      if (e.alienType === 0) {
        // Classic UFO
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.ellipse(0, 0, 15, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6ee7b7';
        ctx.beginPath();
        ctx.arc(0, -4, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.alienType === 1) {
        // Fast Scout (Diamond shape)
        ctx.fillStyle = '#8b5cf6';
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(8, 0);
        ctx.lineTo(0, 12);
        ctx.lineTo(-8, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#c4b5fd';
        ctx.fillRect(-2, -2, 4, 4);
      } else {
        // Tank (Heavy saucer)
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, -6, 10, 0, Math.PI * 2);
        ctx.fill();
        // Lights
        ctx.fillStyle = 'red';
        ctx.beginPath(); ctx.arc(-10, 2, 2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(10, 2, 2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, 4, 2, 0, Math.PI*2); ctx.fill();
      }

      ctx.restore();
    });

    // Draw Missiles (Larger 2x)
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    missilesRef.current.forEach(m => {
      ctx.beginPath();
      ctx.moveTo(m.startX, m.startY);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();
      
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Target X
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(m.targetX - 5, m.targetY - 5);
      ctx.lineTo(m.targetX + 5, m.targetY + 5);
      ctx.moveTo(m.targetX + 5, m.targetY - 5);
      ctx.lineTo(m.targetX - 5, m.targetY + 5);
      ctx.stroke();
    });

    // Draw Explosions
    explosionsRef.current.forEach(exp => {
      const gradient = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, exp.radius);
      gradient.addColorStop(0, 'white');
      gradient.addColorStop(0.4, '#facc15');
      gradient.addColorStop(0.8, '#ef4444');
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }, []);

  const loop = useCallback((time: number) => {
    update(time);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) draw(ctx);
    }
    requestRef.current = requestAnimationFrame(loop);
  }, [update, draw]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [loop]);

  // Enemy Spawning Interval
  useEffect(() => {
    if (status !== GameStatus.PLAYING) return;
    const interval = setInterval(spawnEnemy, 2000 - Math.min(1500, round * 200));
    return () => clearInterval(interval);
  }, [status, round, spawnEnemy]);

  // Round Progression
  useEffect(() => {
    if (status !== GameStatus.PLAYING) return;
    const timer = setInterval(() => {
      // Check if all current enemies are cleared and some time has passed
      if (enemiesRef.current.length === 0) {
        // Refill ammo every 30 seconds or so? 
        // The prompt says "after each round", let's define a round as a time period.
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [status]);

  // Simple round logic: every 200 points, increase round and refill ammo
  useEffect(() => {
    const expectedRound = Math.floor(score / 200) + 1;
    if (expectedRound > round) {
      setRound(expectedRound);
      // Refill ammo
      batteriesRef.current.forEach(b => {
        if (!b.isDestroyed) b.missiles = b.maxMissiles;
      });
    }
  }, [score, round]);

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Header UI */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-4 px-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tighter bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            {t.title}
          </h1>
          <button 
            onClick={() => setLang(l => l === 'zh' ? 'en' : 'zh')}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          >
            <Languages size={18} />
          </button>
        </div>
        
        <div className="flex gap-6 text-sm font-mono">
          <div className="flex flex-col items-end">
            <span className="text-white/40 uppercase text-[10px] tracking-widest">{t.score}</span>
            <span className="text-xl font-bold text-emerald-400">{score.toString().padStart(5, '0')}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-white/40 uppercase text-[10px] tracking-widest">{t.round}</span>
            <span className="text-xl font-bold text-blue-400">{round}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-white/40 uppercase text-[10px] tracking-widest">Target</span>
            <span className="text-xl font-bold text-yellow-400">1000</span>
          </div>
        </div>
      </div>

      {/* Game Container */}
      <div className="relative w-full max-w-4xl aspect-[4/3] bg-black rounded-2xl border border-white/10 shadow-2xl overflow-hidden cursor-crosshair">
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          className="w-full h-full touch-none"
          onMouseDown={handleCanvasClick}
          onTouchStart={handleCanvasClick}
        />

        {/* Overlays */}
        <AnimatePresence>
          {status === GameStatus.START && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="max-w-md"
              >
                <Target className="w-16 h-16 text-emerald-400 mx-auto mb-6" />
                <h2 className="text-4xl font-bold mb-4">{t.title}</h2>
                <p className="text-white/60 mb-8 leading-relaxed">
                  {t.instructions}
                </p>
                <button 
                  onClick={initGame}
                  className="px-12 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-full transition-all transform hover:scale-105 active:scale-95"
                >
                  {t.start}
                </button>
              </motion.div>
            </motion.div>
          )}

          {status === GameStatus.WON && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-emerald-500/20 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
            >
              <Trophy className="w-20 h-20 text-yellow-400 mb-6 animate-bounce" />
              <h2 className="text-5xl font-black mb-4 text-emerald-400 uppercase tracking-tighter">{t.win}</h2>
              <p className="text-xl mb-8">{t.winMsg}</p>
              <div className="text-3xl font-mono mb-8">Final Score: {score}</div>
              <button 
                onClick={initGame}
                className="px-12 py-4 bg-white text-black font-bold rounded-full transition-all hover:bg-neutral-200"
              >
                {t.restart}
              </button>
            </motion.div>
          )}

          {status === GameStatus.LOST && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-red-500/20 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
            >
              <AlertTriangle className="w-20 h-20 text-red-500 mb-6" />
              <h2 className="text-5xl font-black mb-4 text-red-500 uppercase tracking-tighter">{t.lose}</h2>
              <p className="text-xl mb-8">{t.loseMsg}</p>
              <div className="text-3xl font-mono mb-8">Score: {score}</div>
              <button 
                onClick={initGame}
                className="px-12 py-4 bg-red-500 text-white font-bold rounded-full transition-all hover:bg-red-400"
              >
                {t.restart}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* HUD Elements */}
        {status === GameStatus.PLAYING && (
          <div className="absolute top-4 left-4 pointer-events-none">
            <div className="flex items-center gap-2 bg-black/40 backdrop-blur px-3 py-1.5 rounded-full border border-white/10 text-xs font-medium">
              <Shield size={14} className="text-blue-400" />
              <span>{citiesRef.current.filter(c => !c.isDestroyed).length} Cities Intact</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Instructions */}
      <div className="mt-8 text-white/40 text-sm flex gap-8 items-center">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
          <span>Battery</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-sm" />
          <span>City</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-sm" />
          <span>Enemy Rocket</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-400 rounded-sm" />
          <span>Interceptor</span>
        </div>
      </div>
    </div>
  );
}
