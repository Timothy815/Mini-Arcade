import React, { useEffect, useRef, useState } from 'react';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const WORLD_WIDTH = 3000;
const MINIMAP_HEIGHT = 80;

const PLAYER_SPRITE = [];
const PLAYER_PALETTE: Record<string, string> = {};
const LANDER_SPRITE = [];
const LANDER_PALETTE: Record<string, string> = {};
const HUMANOID_SPRITE = [];
const HUMANOID_PALETTE: Record<string, string> = {};

const drawSprite = () => {};

type Entity = { x: number, y: number, vx: number, vy: number, width: number, height: number, active: boolean };
type Lander = Entity & { type: 'lander' | 'mutant', state: 'searching' | 'abducting' | 'carrying', targetId: number | null };
type Humanoid = Entity & { id: number, type: 'humanoid', state: 'ground' | 'abducted' | 'falling', fallStartY: number };
type Particle = { x: number, y: number, vx: number, vy: number, life: number, maxLife: number, color: string, size: number };

export function Defender() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const stateRef = useRef({
    player: { x: WORLD_WIDTH / 2, y: CANVAS_HEIGHT / 2, vx: 0, vy: 0, width: 40, height: 20, active: true, dir: 1 },
    bullets: [] as Entity[],
    enemies: [] as Lander[],
    humanoids: [] as Humanoid[],
    particles: [] as Particle[],
    stars: [] as {x: number, y: number, size: number, speed: number}[],
    terrain: [] as number[],
    keys: { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, ' ': false },
    lastShot: 0,
    cameraX: 0
  });

  const reqRef = useRef<number>();

  const playBeep = (freq: number, duration: number, type: OscillatorType = 'square') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch(e) {}
  };

  const generateTerrain = () => {
    const terrain = [];
    let h = CANVAS_HEIGHT - 100;
    for (let i = 0; i <= WORLD_WIDTH; i += 50) {
      h += (Math.random() - 0.5) * 80;
      h = Math.max(CANVAS_HEIGHT - 150, Math.min(CANVAS_HEIGHT - 30, h));
      terrain.push(h);
    }
    return terrain;
  };

  const getTerrainHeight = (x: number, terrain: number[]) => {
    const wrappedX = ((x % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH;
    const idx = Math.floor(wrappedX / 50);
    const nextIdx = (idx + 1) % (WORLD_WIDTH / 50);
    const t = (wrappedX % 50) / 50;
    return terrain[idx] * (1 - t) + terrain[nextIdx] * t;
  };

  const startGame = () => {
    const terrain = generateTerrain();
    const humanoids: Humanoid[] = Array.from({ length: 10 }).map((_, i) => {
      const x = (i * 300) + 150;
      return {
        id: i, x, y: getTerrainHeight(x, terrain) - 10,
        vx: 0, vy: 0, width: 10, height: 15, active: true, type: 'humanoid', state: 'ground', fallStartY: 0
      };
    });
    
    const enemies: Lander[] = Array.from({ length: 8 }).map(() => ({
      x: Math.random() * WORLD_WIDTH,
      y: Math.random() * (CANVAS_HEIGHT / 2) + MINIMAP_HEIGHT,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 2,
      width: 24, height: 24, active: true, type: 'lander', state: 'searching', targetId: null
    }));

    const stars = Array.from({ length: 100 }).map(() => ({
      x: Math.random() * WORLD_WIDTH,
      y: Math.random() * CANVAS_HEIGHT,
      size: Math.random() * 2 + 1,
      speed: Math.random() * 0.5 + 0.1
    }));

    stateRef.current = {
      player: { x: WORLD_WIDTH / 2, y: CANVAS_HEIGHT / 2, vx: 0, vy: 0, width: 40, height: 20, active: true, dir: 1 },
      bullets: [], enemies, humanoids, particles: [], stars, terrain,
      keys: { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, ' ': false },
      lastShot: 0, cameraX: WORLD_WIDTH / 2 - CANVAS_WIDTH / 2
    };
    setScore(0);
    setGameOver(false);
    setIsPlaying(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying && (e.key === 'Enter' || e.key === ' ')) {
        startGame();
        return;
      }
      if (stateRef.current.keys.hasOwnProperty(e.key)) {
        e.preventDefault();
        stateRef.current.keys[e.key as keyof typeof stateRef.current.keys] = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (stateRef.current.keys.hasOwnProperty(e.key)) {
        stateRef.current.keys[e.key as keyof typeof stateRef.current.keys] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const wrap = (val: number, max: number) => ((val % max) + max) % max;

    const spawnParticles = (x: number, y: number, color: string, count: number) => {
      for (let i = 0; i < count; i++) {
        stateRef.current.particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 10,
          vy: (Math.random() - 0.5) * 10,
          life: 20 + Math.random() * 20,
          maxLife: 40, color, size: Math.random() * 3 + 1
        });
      }
    };

    const gameLoop = (time: number) => {
      if (!isPlaying || gameOver) return;

      const state = stateRef.current;
      const { player, keys, bullets, enemies, humanoids, particles, terrain } = state;

      // Player controls
      if (keys.ArrowUp) player.vy -= 0.6;
      if (keys.ArrowDown) player.vy += 0.6;
      if (keys.ArrowLeft) { player.vx -= 0.6; player.dir = -1; }
      if (keys.ArrowRight) { player.vx += 0.6; player.dir = 1; }

      // Friction & Limits
      player.vx *= 0.92;
      player.vy *= 0.92;
      player.x = wrap(player.x + player.vx, WORLD_WIDTH);
      player.y = Math.max(MINIMAP_HEIGHT, Math.min(CANVAS_HEIGHT - player.height, player.y + player.vy));

      // Camera follows player
      state.cameraX = wrap(player.x - CANVAS_WIDTH / 2, WORLD_WIDTH);

      // Shooting
      if (keys[' '] && time - state.lastShot > 150) {
        bullets.push({
          x: player.dir === 1 ? player.x + player.width / 2 : player.x - player.width / 2,
          y: player.y,
          vx: player.dir * 20 + player.vx,
          vy: 0,
          width: 15, height: 3, active: true
        });
        state.lastShot = time;
        playBeep(800, 0.05, 'square');
      }

      // Move bullets
      bullets.forEach(b => {
        b.x = wrap(b.x + b.vx, WORLD_WIDTH);
        const screenX = wrap(b.x - state.cameraX, WORLD_WIDTH);
        if (screenX > CANVAS_WIDTH && screenX < WORLD_WIDTH - CANVAS_WIDTH) b.active = false;
      });

      // Humanoids logic
      humanoids.forEach(h => {
        if (!h.active) return;
        if (h.state === 'falling') {
          h.vy += 0.1; // gravity
          h.y += h.vy;
          const groundY = getTerrainHeight(h.x, terrain) - 10;
          
          // Player catches humanoid
          const dx = Math.min(Math.abs(player.x - h.x), WORLD_WIDTH - Math.abs(player.x - h.x));
          const dy = Math.abs(player.y - h.y);
          if (dx < player.width/2 + h.width/2 && dy < player.height/2 + h.height/2) {
            h.state = 'ground';
            h.y = groundY;
            h.vy = 0;
            setScore(s => s + 500);
            playBeep(1200, 0.2, 'sine');
            spawnParticles(h.x, h.y, '#fca5a5', 10);
          } else if (h.y >= groundY) {
            h.y = groundY;
            if (h.y - h.fallStartY > 150) {
              h.active = false; // died from fall
              spawnParticles(h.x, h.y, '#ef4444', 20);
              playBeep(200, 0.3, 'sawtooth');
            } else {
              h.state = 'ground';
              h.vy = 0;
            }
          }
        }
      });

      // Move enemies (Landers)
      enemies.forEach(e => {
        if (!e.active) return;
        
        if (e.type === 'mutant') {
          // Chase player
          const dx = player.x - e.x;
          const wrappedDx = Math.abs(dx) > WORLD_WIDTH / 2 ? dx - Math.sign(dx) * WORLD_WIDTH : dx;
          e.vx += Math.sign(wrappedDx) * 0.2;
          e.vy += Math.sign(player.y - e.y) * 0.2;
          e.vx *= 0.95; e.vy *= 0.95;
        } else {
          if (e.state === 'searching') {
            e.vx = e.vx > 0 ? 3 : -3;
            if (Math.random() < 0.02) e.vy = (Math.random() - 0.5) * 4;
            
            // Look for humanoid
            if (Math.random() < 0.05) {
              const target = humanoids.find(h => h.active && h.state === 'ground' && Math.abs(wrap(h.x - e.x, WORLD_WIDTH)) < 200);
              if (target) {
                e.state = 'abducting';
                e.targetId = target.id;
              }
            }
          } else if (e.state === 'abducting') {
            const target = humanoids.find(h => h.id === e.targetId);
            if (target && target.state === 'ground') {
              const dx = target.x - e.x;
              const wrappedDx = Math.abs(dx) > WORLD_WIDTH / 2 ? dx - Math.sign(dx) * WORLD_WIDTH : dx;
              e.vx = Math.sign(wrappedDx) * 2;
              if (Math.abs(wrappedDx) < 10) {
                e.vx = 0;
                e.vy = 2; // descend
                if (Math.abs(e.y - target.y) < 15) {
                  e.state = 'carrying';
                  target.state = 'abducted';
                }
              } else {
                e.vy = 0;
              }
            } else {
              e.state = 'searching';
            }
          } else if (e.state === 'carrying') {
            e.vy = -1.5; // ascend
            e.vx = 0;
            const target = humanoids.find(h => h.id === e.targetId);
            if (target) {
              target.x = e.x;
              target.y = e.y + 15;
            }
            if (e.y < MINIMAP_HEIGHT + 20) {
              // Reached top, mutate
              e.type = 'mutant';
              if (target) target.active = false; // humanoid dies
              playBeep(300, 0.5, 'sawtooth');
              spawnParticles(e.x, e.y, '#a855f7', 30);
            }
          }
        }

        e.x = wrap(e.x + e.vx, WORLD_WIDTH);
        e.y += e.vy;
        
        // Bounce off top/bottom
        if (e.y < MINIMAP_HEIGHT) { e.y = MINIMAP_HEIGHT; e.vy *= -1; }
        if (e.y > CANVAS_HEIGHT - 50 && e.state !== 'abducting') { e.y = CANVAS_HEIGHT - 50; e.vy *= -1; }
      });

      // Collisions
      bullets.forEach(b => {
        if (!b.active) return;
        enemies.forEach(e => {
          if (!e.active) return;
          const dx = Math.min(Math.abs(b.x - e.x), WORLD_WIDTH - Math.abs(b.x - e.x));
          const dy = Math.abs(b.y - e.y);
          if (dx < e.width && dy < e.height) {
            b.active = false;
            e.active = false;
            setScore(s => s + (e.type === 'mutant' ? 500 : 150));
            playBeep(150, 0.1, 'sawtooth');
            spawnParticles(e.x, e.y, e.type === 'mutant' ? '#a855f7' : '#22c55e', 20);
            
            if (e.state === 'carrying') {
              const target = humanoids.find(h => h.id === e.targetId);
              if (target) {
                target.state = 'falling';
                target.fallStartY = target.y;
                target.vy = 0;
              }
            }
          }
        });
      });

      // Player collision with enemies
      enemies.forEach(e => {
        if (!e.active) return;
        const dx = Math.min(Math.abs(player.x - e.x), WORLD_WIDTH - Math.abs(player.x - e.x));
        const dy = Math.abs(player.y - e.y);
        if (dx < player.width/2 + e.width/2 && dy < player.height/2 + e.height/2) {
          setGameOver(true);
          setIsPlaying(false);
          playBeep(100, 0.8, 'sawtooth');
          spawnParticles(player.x, player.y, '#38bdf8', 50);
        }
      });

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x = wrap(p.x + p.vx, WORLD_WIDTH);
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
      }

      // Respawn enemies
      if (enemies.filter(e => e.active).length < 8) {
        if (Math.random() < 0.01) {
          enemies.push({
            x: wrap(state.cameraX + CANVAS_WIDTH + 100, WORLD_WIDTH),
            y: Math.random() * (CANVAS_HEIGHT / 2) + MINIMAP_HEIGHT,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 2,
            width: 24, height: 24, active: true, type: 'lander', state: 'searching', targetId: null
          });
        }
      }

      // Cleanup
      state.bullets = bullets.filter(b => b.active);
      state.enemies = enemies.filter(e => e.active);

      // Draw
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const drawWrapped = (x: number, y: number, drawFn: (sx: number, sy: number) => void) => {
        const screenX = wrap(x - state.cameraX, WORLD_WIDTH);
        drawFn(screenX, y);
        if (screenX < CANVAS_WIDTH) drawFn(screenX + WORLD_WIDTH, y);
        if (screenX > WORLD_WIDTH - CANVAS_WIDTH) drawFn(screenX - WORLD_WIDTH, y);
      };

      // Draw Stars
      ctx.fillStyle = '#fff';
      state.stars.forEach(s => {
        drawWrapped(s.x, s.y, (sx, sy) => {
          ctx.globalAlpha = Math.random() * 0.5 + 0.5;
          ctx.fillRect(sx, sy, s.size, s.size);
        });
      });
      ctx.globalAlpha = 1.0;

      // Draw Terrain
      ctx.fillStyle = '#450a0a';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_HEIGHT);
      for (let i = 0; i <= CANVAS_WIDTH; i += 10) {
        const worldX = wrap(state.cameraX + i, WORLD_WIDTH);
        const h = getTerrainHeight(worldX, terrain);
        ctx.lineTo(i, h);
      }
      ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw Humanoids
      humanoids.forEach(h => {
        if (!h.active) return;
        drawWrapped(h.x, h.y, (sx, sy) => {
          ctx.fillStyle = '#fca5a5';
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#fca5a5';
          ctx.beginPath(); ctx.arc(sx, sy - 5, 4, 0, Math.PI * 2); ctx.fill(); // Head
          ctx.fillRect(sx - 2, sy - 1, 4, 8); // Body
          ctx.fillRect(sx - 5, sy - 1, 10, 2); // Arms
          ctx.fillRect(sx - 3, sy + 7, 2, 5); // Leg L
          ctx.fillRect(sx + 1, sy + 7, 2, 5); // Leg R
          ctx.shadowBlur = 0;
        });
      });

      // Draw Enemies
      enemies.forEach(e => {
        if (!e.active) return;
        drawWrapped(e.x, e.y, (sx, sy) => {
          const color = e.type === 'mutant' ? '#a855f7' : '#22c55e';
          ctx.fillStyle = '#0f172a';
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.shadowBlur = 15;
          ctx.shadowColor = color;
          
          ctx.beginPath(); ctx.arc(sx, sy, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(sx - 8, sy + 8); ctx.lineTo(sx - 12, sy + 18); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(sx + 8, sy + 8); ctx.lineTo(sx + 12, sy + 18); ctx.stroke();
          
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
        });
      });

      // Draw Bullets
      ctx.fillStyle = '#fde047';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#fde047';
      bullets.forEach(b => {
        drawWrapped(b.x, b.y, (sx, sy) => {
          ctx.fillRect(sx - b.width/2, sy - b.height/2, b.width, b.height);
        });
      });
      ctx.shadowBlur = 0;

      // Draw Player
      drawWrapped(player.x, player.y, (sx, sy) => {
        ctx.save();
        ctx.translate(sx, sy);
        if (player.dir === -1) ctx.scale(-1, 1);
        
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#38bdf8';
        
        ctx.beginPath();
        ctx.moveTo(20, 0); ctx.lineTo(-15, -10); ctx.lineTo(-10, 0); ctx.lineTo(-15, 10);
        ctx.closePath(); ctx.fill(); ctx.stroke();

        ctx.fillStyle = '#bae6fd';
        ctx.beginPath(); ctx.ellipse(5, -2, 8, 4, 0, 0, Math.PI * 2); ctx.fill();

        if (keys.ArrowLeft || keys.ArrowRight) {
          ctx.fillStyle = '#f97316';
          ctx.shadowColor = '#f97316';
          ctx.beginPath();
          ctx.moveTo(-10, 0); ctx.lineTo(-25 - Math.random() * 15, 0); ctx.lineTo(-15, 5); ctx.fill();
        }
        ctx.restore();
      });

      // Draw Particles
      particles.forEach(p => {
        drawWrapped(p.x, p.y, (sx, sy) => {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life / p.maxLife;
          ctx.shadowBlur = 5;
          ctx.shadowColor = p.color;
          ctx.beginPath(); ctx.arc(sx, sy, p.size, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1.0;
          ctx.shadowBlur = 0;
        });
      });

      // Draw Minimap
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, CANVAS_WIDTH, MINIMAP_HEIGHT);
      ctx.strokeStyle = '#333';
      ctx.strokeRect(0, 0, CANVAS_WIDTH, MINIMAP_HEIGHT);
      
      const mapScale = CANVAS_WIDTH / WORLD_WIDTH;
      
      ctx.strokeStyle = '#64748b';
      ctx.strokeRect(state.cameraX * mapScale, 0, CANVAS_WIDTH * mapScale, MINIMAP_HEIGHT);
      if (state.cameraX + CANVAS_WIDTH > WORLD_WIDTH) {
        ctx.strokeRect((state.cameraX - WORLD_WIDTH) * mapScale, 0, CANVAS_WIDTH * mapScale, MINIMAP_HEIGHT);
      }

      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(player.x * mapScale, player.y * (MINIMAP_HEIGHT / CANVAS_HEIGHT), 4, 4);

      enemies.forEach(e => {
        ctx.fillStyle = e.type === 'mutant' ? '#a855f7' : '#22c55e';
        ctx.fillRect(e.x * mapScale, e.y * (MINIMAP_HEIGHT / CANVAS_HEIGHT), 3, 3);
      });
      
      humanoids.forEach(h => {
        if (h.active) {
          ctx.fillStyle = '#fca5a5';
          ctx.fillRect(h.x * mapScale, h.y * (MINIMAP_HEIGHT / CANVAS_HEIGHT), 2, 2);
        }
      });

      reqRef.current = requestAnimationFrame(gameLoop);
    };

    if (isPlaying) {
      reqRef.current = requestAnimationFrame(gameLoop);
    } else {
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, [isPlaying, gameOver]);

  return (
    <div className="relative">
      <div className="absolute top-[90px] left-4 font-arcade text-white text-xl z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">
        SCORE: {score}
      </div>
      
      {!isPlaying && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
          <h2 className="font-arcade text-6xl text-sky-400 mb-8 neon-text tracking-widest drop-shadow-[0_0_20px_rgba(56,189,248,0.8)]">DEFENDER</h2>
          {gameOver && <p className="font-arcade text-red-500 mb-4 text-3xl drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">GAME OVER</p>}
          <div className="text-neutral-300 font-retro text-xl mb-8 text-center space-y-2">
            <p>ARROWS: Move & Thrust</p>
            <p>SPACE: Fire</p>
            <p className="text-green-400 mt-4">Save the humanoids from abduction!</p>
            <p className="text-purple-400">Catch them if they fall!</p>
          </div>
          <p className="font-arcade text-white text-2xl animate-pulse cursor-pointer hover:text-sky-400 transition-colors" onClick={startGame}>
            PRESS ENTER TO START
          </p>
        </div>
      )}

      <canvas 
        ref={canvasRef} 
        width={CANVAS_WIDTH} 
        height={CANVAS_HEIGHT}
        className="block focus:outline-none rounded-lg shadow-[0_0_30px_rgba(56,189,248,0.15)] border border-slate-800"
        tabIndex={0}
      />
    </div>
  );
}
