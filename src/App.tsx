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
  const [energy, setEnergy] = useState(0);
  const [combo, setCombo] = useState(0);
  const [shake, setShake] = useState(0);
  const [storyText, setStoryText] = useState('');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  // Game State Refs (for high performance updates in loop)
  const enemiesRef = useRef<EnemyRocket[]>([]);
  const missilesRef = useRef<InterceptorMissile[]>([]);
  const batteriesRef = useRef<Battery[]>(JSON.parse(JSON.stringify(INITIAL_BATTERIES)));
  const citiesRef = useRef<City[]>(JSON.parse(JSON.stringify(INITIAL_CITIES)));
  const explosionsRef = useRef<{ x: number; y: number; radius: number; maxRadius: number; id: string; active: boolean; color?: string }[]>([]);
  const starsRef = useRef<{ x: number; y: number; size: number; opacity: number; speed: number }[]>([]);
  const nebulaRef = useRef<{ x: number; y: number; r: number; color: string }[]>([]);
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }[]>([]);

  // Initialize stars and nebula once
  useEffect(() => {
    const stars = [];
    for (let i = 0; i < 200; i++) {
      stars.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random(),
        speed: Math.random() * 0.05
      });
    }
    starsRef.current = stars;

    const nebulas = [];
    const colors = ['rgba(76, 29, 149, 0.15)', 'rgba(30, 58, 138, 0.15)', 'rgba(88, 28, 135, 0.15)'];
    for (let i = 0; i < 5; i++) {
      nebulas.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        r: Math.random() * 300 + 200,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    nebulaRef.current = nebulas;
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
    particlesRef.current = [];
    setScore(0);
    setRound(1);
    setEnergy(0);
    setCombo(0);
    setStatus(GameStatus.PLAYING);
    
    const intro = lang === 'zh' 
      ? '贝贝（元气橙）：准备好大干一场了吗？可可（冰晶蓝）：雷达已锁定，保持专注。' 
      : 'BeiBei (Orange): Ready for action? KeKe (Blue): Radar locked, stay focused.';
    setStoryText(intro);
    setTimeout(() => setStoryText(''), 4000);
  }, [lang]);

  const spawnEnemy = useCallback(() => {
    if (status !== GameStatus.PLAYING) return;
    
    const startX = Math.random() * GAME_WIDTH;
    const targets = [...citiesRef.current.filter(c => !c.isDestroyed), ...batteriesRef.current.filter(b => !b.isDestroyed)];
    
    if (targets.length === 0) return;
    
    const target = targets[Math.floor(Math.random() * targets.length)];
    
    // Alien Types: 0 (Normal), 1 (Fast), 2 (Tank)
    const alienType = Math.floor(Math.random() * 3);
    let speedMult = 1;
    let hp = 1;
    let isBoss = false;

    if (alienType === 1) speedMult = 1.6; // Fast
    if (alienType === 2) {
      speedMult = 0.6; // Tank
      hp = 3;
    }

    // Occasional Boss
    if (score > 500 && Math.random() > 0.92) {
      isBoss = true;
      hp = 8;
      speedMult = 0.4;
    }

    const speed = (0.0008 + (round * 0.0002)) * speedMult;
    
    enemiesRef.current.push({
      id: Math.random().toString(36).substr(2, 9),
      x: startX,
      y: 0,
      targetX: target.x,
      targetY: target.y,
      speed: speed,
      progress: 0,
      alienType,
      hp,
      maxHp: hp,
      isBoss
    });
  }, [status, round, score]);

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
      const isMiddle = (bestBattery as Battery).id === 'b2';
      const missilesToFire = isMiddle ? Math.min(2, (bestBattery as Battery).missiles) : 1;
      
      (bestBattery as Battery).missiles -= missilesToFire;
      
      for (let i = 0; i < missilesToFire; i++) {
        // For middle battery, fire sequentially on the same ray
        const progressDelay = isMiddle ? (i === 0 ? 0 : -0.08) : 0;
        missilesRef.current.push({
          id: Math.random().toString(36).substr(2, 9),
          x: (bestBattery as Battery).x,
          y: (bestBattery as Battery).y,
          startX: (bestBattery as Battery).x,
          startY: (bestBattery as Battery).y,
          targetX: targetX,
          targetY,
          speed: 0.04,
          progress: progressDelay,
          isExploding: false,
          explosionRadius: 0,
          maxExplosionRadius: 40,
          explosionSpeed: 1.5
        });
      }
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

      // Add trail particles
      if (Math.random() > 0.7) {
        particlesRef.current.push({
          x: enemy.x,
          y: enemy.y,
          vx: (Math.random() - 0.5) * 1,
          vy: -Math.random() * 2,
          life: 1,
          color: enemy.alienType === 0 ? '#10b981' : enemy.alienType === 1 ? '#8b5cf6' : '#f59e0b',
          size: Math.random() * 3 + 1
        });
      }

      // Check if hit target
      if (enemy.progress >= 1) {
        let hitSomething = false;
        citiesRef.current.forEach(c => {
          if (Math.abs(c.x - enemy.targetX) < 10 && Math.abs(c.y - enemy.targetY) < 10 && !c.isDestroyed) {
            c.isDestroyed = true;
            hitSomething = true;
          }
        });
        batteriesRef.current.forEach(b => {
          if (Math.abs(b.x - enemy.targetX) < 10 && Math.abs(b.y - enemy.targetY) < 10 && !b.isDestroyed) {
            b.isDestroyed = true;
            hitSomething = true;
          }
        });
        
        if (hitSomething) {
          playSound('impact');
          setShake(15);
          setCombo(0);
        }
        
        enemy.progress = 2;
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
            active: true,
            color: '#facc15'
          });
        }
      }
    });
    missilesRef.current = missilesRef.current.filter(m => !m.isExploding);

    // 3. Update Explosions
    explosionsRef.current.forEach(exp => {
      if (exp.active) {
        exp.radius += 1.5;
        if (exp.radius >= exp.maxRadius) {
          exp.active = false;
        }

        // Check collision with enemies
        enemiesRef.current.forEach(enemy => {
          const dist = Math.sqrt(Math.pow(enemy.x - exp.x, 2) + Math.pow(enemy.y - exp.y, 2));
          if (dist < exp.radius) {
            if (!enemy.isIntercepted) {
              enemy.hp -= 0.1; // Continuous damage in explosion
              if (enemy.hp <= 0) {
                playSound('explosion');
                enemy.isIntercepted = true;
                setScore(prev => prev + (enemy.isBoss ? 100 : 20) * (1 + Math.floor(combo / 5) * 0.1));
                setCombo(prev => prev + 1);
                setEnergy(prev => Math.min(100, prev + (enemy.isBoss ? 20 : 5)));
                
                // Death particles
                for (let i = 0; i < 10; i++) {
                  particlesRef.current.push({
                    x: enemy.x,
                    y: enemy.y,
                    vx: (Math.random() - 0.5) * 6,
                    vy: (Math.random() - 0.5) * 6,
                    life: 1,
                    color: '#ffffff',
                    size: Math.random() * 4 + 2
                  });
                }
              }
            }
          }
        });
      }
    });
    explosionsRef.current = explosionsRef.current.filter(exp => exp.active);

    // 4. Update Particles
    particlesRef.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);

    // 5. Update Shake
    if (shake > 0) setShake(prev => Math.max(0, prev - 1));

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

    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    // Background
    ctx.fillStyle = '#020205';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw Nebula
    nebulaRef.current.forEach(n => {
      const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      grad.addColorStop(0, n.color);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    });

    // Draw Stars
    starsRef.current.forEach(star => {
      star.opacity += (Math.random() - 0.5) * 0.05;
      star.opacity = Math.max(0.1, Math.min(1, star.opacity));
      ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw City Skyline Silhouette (Shadow Outlines)
    ctx.fillStyle = 'rgba(10, 10, 20, 0.9)';
    const skyline = [
      { x: 0, w: 50, h: 80 }, { x: 60, w: 40, h: 120 }, { x: 110, w: 60, h: 100 },
      { x: 180, w: 30, h: 150 }, { x: 220, w: 70, h: 90 }, { x: 300, w: 50, h: 130 },
      { x: 360, w: 40, h: 110 }, { x: 410, w: 80, h: 140 }, { x: 500, w: 30, h: 160 },
      { x: 540, w: 60, h: 100 }, { x: 610, w: 50, h: 130 }, { x: 670, w: 40, h: 110 },
      { x: 720, w: 80, h: 90 }
    ];
    skyline.forEach(b => {
      ctx.fillRect(b.x, GAME_HEIGHT - 20 - b.h, b.w, b.h);
      // Neon outline
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x, GAME_HEIGHT - 20 - b.h, b.w, b.h);
    });

    // Draw Ground
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, GAME_HEIGHT - 20, GAME_WIDTH, 20);

    // Draw Particles
    particlesRef.current.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Draw Cities
    citiesRef.current.forEach(city => {
      if (!city.isDestroyed) {
        ctx.fillStyle = '#3b82f6';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#3b82f6';
        ctx.fillRect(city.x - 15, city.y - 10, 30, 10);
        ctx.fillRect(city.x - 10, city.y - 20, 20, 10);
        ctx.shadowBlur = 0;
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

        const isMiddle = index === 1;
        const isLeft = index === 0;
        const isRight = index === 2;
        const flagW = 40;
        const flagH = 26;
        
        // Modern Base
        ctx.fillStyle = '#333';
        ctx.fillRect(-25, -5, 50, 10);
        
        if (isMiddle) {
          // Castle under the flag
          ctx.fillStyle = '#4b5563'; // Slate 600
          ctx.fillRect(-30, 5, 60, 15); // Main base
          ctx.fillRect(-30, -5, 15, 10); // Left tower
          ctx.fillRect(15, -5, 15, 10); // Right tower
          ctx.fillStyle = '#374151'; // Slate 700
          ctx.fillRect(-10, 5, 20, 15); // Gate area
          
          // Flag
          ctx.fillStyle = '#DE2910';
          ctx.fillRect(-flagW/2, -flagH, flagW, flagH);
          ctx.fillStyle = '#FFDE00';
          ctx.beginPath();
          const r = 4;
          for(let i=0; i<5; i++) {
            ctx.lineTo(Math.cos((18+i*72)/180*Math.PI)*r - 12, Math.sin((18+i*72)/180*Math.PI)*r - 18);
            ctx.lineTo(Math.cos((54+i*72)/180*Math.PI)*r/2 - 12, Math.sin((54+i*72)/180*Math.PI)*r/2 - 18);
          }
          ctx.closePath(); ctx.fill();
        } else if (isLeft) {
          // Draw BeiBei (Orange Girl)
          ctx.fillStyle = '#FF6B00'; // Orange
          ctx.beginPath(); ctx.arc(0, -20, 12, 0, Math.PI*2); ctx.fill(); // Head
          ctx.fillStyle = '#fff';
          ctx.fillRect(-10, -10, 20, 15); // Body
          // Ponytails
          ctx.fillStyle = '#FF6B00';
          ctx.beginPath(); ctx.arc(-12, -25, 6, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(12, -25, 6, 0, Math.PI*2); ctx.fill();
        } else if (isRight) {
          // Draw KeKe (Blue Girl)
          ctx.fillStyle = '#00A3FF'; // Blue
          ctx.beginPath(); ctx.arc(0, -20, 12, 0, Math.PI*2); ctx.fill(); // Head
          ctx.fillStyle = '#fff';
          ctx.fillRect(-10, -10, 20, 15); // Body
          // Single Ponytail
          ctx.fillStyle = '#00A3FF';
          ctx.beginPath(); ctx.arc(8, -28, 7, 0, Math.PI*2); ctx.fill();
        }

        ctx.strokeStyle = '#888';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, -flagH);
        ctx.lineTo(0, -flagH - 12);
        ctx.stroke();

        ctx.restore();
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(b.missiles.toString(), b.x, b.y + 18);
      } else {
        ctx.fillStyle = '#450a0a';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 12, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw Enemies (Alien Style)
    enemiesRef.current.forEach(e => {
      ctx.save();
      ctx.translate(e.x, e.y);
      
      const scale = e.isBoss ? 2 : 1;
      ctx.scale(scale, scale);

      // Glow
      const color = e.alienType === 0 ? '#10b981' : e.alienType === 1 ? '#8b5cf6' : '#f59e0b';
      ctx.shadowBlur = 15;
      ctx.shadowColor = color;

      if (e.alienType === 0) {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.ellipse(0, 0, 15, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, -4, 6, 0, Math.PI * 2); ctx.fill();
        // Eyes
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(-3, -4, 1.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(3, -4, 1.5, 0, Math.PI*2); ctx.fill();
      } else if (e.alienType === 1) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, -12); ctx.lineTo(10, 0); ctx.lineTo(0, 12); ctx.lineTo(-10, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(-2, -2, 4, 4);
      } else {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.ellipse(0, 0, 22, 14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, -7, 12, 0, Math.PI * 2); ctx.fill();
        // Lights
        ctx.fillStyle = Math.random() > 0.5 ? 'red' : 'yellow';
        ctx.beginPath(); ctx.arc(-12, 4, 3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(12, 4, 3, 0, Math.PI*2); ctx.fill();
      }

      // HP Bar for Boss
      if (e.isBoss) {
        ctx.fillStyle = '#333';
        ctx.fillRect(-20, -25, 40, 4);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-20, -25, 40 * (e.hp / e.maxHp), 4);
      }

      ctx.restore();
    });

    // Draw Missiles
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    missilesRef.current.forEach(m => {
      ctx.beginPath();
      ctx.moveTo(m.startX, m.startY);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();
      
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 4, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(m.targetX - 8, m.targetY - 8); ctx.lineTo(m.targetX + 8, m.targetY + 8);
      ctx.moveTo(m.targetX + 8, m.targetY - 8); ctx.lineTo(m.targetX - 8, m.targetY + 8);
      ctx.stroke();
    });

    // Draw Explosions
    explosionsRef.current.forEach(exp => {
      const gradient = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, exp.radius);
      gradient.addColorStop(0, 'white');
      gradient.addColorStop(0.3, exp.color || '#facc15');
      gradient.addColorStop(0.7, '#ef4444');
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }, [shake]);

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
    <div className="min-h-screen bg-[#020205] text-white font-sans flex flex-col items-center justify-center p-4 overflow-hidden selection:bg-emerald-500/30">
      {/* Header UI */}
      <div className="w-full max-w-5xl flex justify-between items-end mb-6 px-4">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full blur opacity-25 animate-pulse" />
            <h1 className="relative text-3xl font-black tracking-tighter bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">
              {t.title}
            </h1>
          </div>
          <button 
            onClick={() => setLang(l => l === 'zh' ? 'en' : 'zh')}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-90"
          >
            <Languages size={20} />
          </button>
        </div>
        
        <div className="flex gap-8 items-end">
          <div className="flex flex-col items-end">
            <span className="text-white/30 uppercase text-[10px] font-bold tracking-[0.2em] mb-1">{t.score}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">
                {score.toString().padStart(5, '0')}
              </span>
              {combo > 1 && (
                <motion.span 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  key={combo}
                  className="text-sm font-bold text-yellow-400"
                >
                  x{combo}
                </motion.span>
              )}
            </div>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="flex flex-col items-end">
            <span className="text-white/30 uppercase text-[10px] font-bold tracking-[0.2em] mb-1">Overdrive</span>
            <div className="w-32 h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
              <motion.div 
                animate={{ width: `${energy}%` }}
                className="h-full bg-gradient-to-r from-orange-500 to-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Game Container */}
      <div className="relative w-full max-w-5xl aspect-[16/9] bg-black rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden cursor-crosshair group">
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          className="w-full h-full touch-none"
          onMouseDown={handleCanvasClick}
          onTouchStart={handleCanvasClick}
        />

        {/* Story Text Overlay */}
        <AnimatePresence>
          {storyText && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-xl border border-white/10 px-8 py-4 rounded-2xl text-lg font-medium text-center z-50"
            >
              {storyText}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Characters */}
        <div className="absolute bottom-4 left-4 flex flex-col items-center gap-2">
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400">BeiBei</span>
            <span className="text-[8px] text-orange-400/60 font-medium">Energy: {energy}%</span>
          </div>
        </div>

        <div className="absolute bottom-4 right-4 flex flex-col items-center gap-2">
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">KeKe</span>
            <span className="text-[8px] text-blue-400/60 font-medium">Tactics: {round}</span>
          </div>
        </div>

        {/* Overlays */}
        <AnimatePresence>
          {status === GameStatus.START && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="max-w-xl"
              >
                <div className="w-24 h-24 bg-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-emerald-500/30">
                  <Target className="w-12 h-12 text-emerald-400" />
                </div>
                <h2 className="text-5xl font-black mb-6 tracking-tighter">{t.title}</h2>
                <p className="text-white/50 mb-10 text-lg leading-relaxed max-w-md mx-auto">
                  {t.instructions}
                </p>
                <button 
                  onClick={initGame}
                  className="group relative px-16 py-5 bg-white text-black font-black rounded-2xl transition-all hover:scale-105 active:scale-95 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-emerald-400 translate-y-full group-hover:translate-y-0 transition-transform" />
                  <span className="relative z-10">{t.start}</span>
                </button>
              </motion.div>
            </motion.div>
          )}

          {status === GameStatus.WON && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-emerald-500/10 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center"
            >
              <Trophy className="w-24 h-24 text-yellow-400 mb-8 animate-bounce" />
              <h2 className="text-6xl font-black mb-4 text-emerald-400 tracking-tighter uppercase">{t.win}</h2>
              <p className="text-xl text-white/70 mb-10">{t.winMsg}</p>
              <div className="flex gap-4 mb-10">
                {[1, 2, 3].map(i => (
                  <motion.div 
                    key={i}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.2 }}
                  >
                    <Trophy className="w-10 h-10 text-yellow-400" />
                  </motion.div>
                ))}
              </div>
              <button 
                onClick={initGame}
                className="px-16 py-5 bg-white text-black font-black rounded-2xl transition-all hover:bg-neutral-200"
              >
                {t.restart}
              </button>
            </motion.div>
          )}

          {status === GameStatus.LOST && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-red-500/10 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center"
            >
              <AlertTriangle className="w-24 h-24 text-red-500 mb-8" />
              <h2 className="text-6xl font-black mb-4 text-red-500 tracking-tighter uppercase">{t.lose}</h2>
              <p className="text-xl text-white/70 mb-10">{t.loseMsg}</p>
              <button 
                onClick={initGame}
                className="px-16 py-5 bg-red-500 text-white font-black rounded-2xl transition-all hover:bg-red-400"
              >
                {t.restart}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* HUD Elements */}
        {status === GameStatus.PLAYING && (
          <div className="absolute top-6 left-6 pointer-events-none flex flex-col gap-3">
            <div className="flex items-center gap-3 bg-black/40 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 shadow-lg">
              <Shield size={16} className="text-blue-400" />
              <span className="text-sm font-bold tracking-tight">
                {citiesRef.current.filter(c => !c.isDestroyed).length} CITIES PROTECTED
              </span>
            </div>
            {combo > 5 && (
              <motion.div 
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="text-yellow-400 font-black italic text-2xl drop-shadow-lg"
              >
                COMBO x{combo}!
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Footer Instructions */}
      <div className="mt-10 text-white/20 text-[10px] font-bold uppercase tracking-[0.3em] flex gap-12 items-center">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 bg-emerald-500/20 border border-emerald-500/40 rounded-md" />
          <span>Battery</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 bg-blue-500/20 border border-blue-500/40 rounded-md" />
          <span>City</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 bg-red-500/20 border border-red-500/40 rounded-md" />
          <span>Aliens</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 bg-yellow-400/20 border border-yellow-400/40 rounded-md" />
          <span>Interceptor</span>
        </div>
      </div>
    </div>
  );
}
