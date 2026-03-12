import React, { useEffect, useRef, useState } from 'react';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

type Point = { x: number, y: number };
type Entity = { x: number, y: number, vx: number, vy: number, angle: number, radius: number, active: boolean };
type Asteroid = Entity & { size: 1 | 2 | 3, vertices: Point[] };

export function Asteroids() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const stateRef = useRef({
    ship: { x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT/2, vx: 0, vy: 0, angle: -Math.PI/2, radius: 10, active: true },
    bullets: [] as Entity[],
    asteroids: [] as Asteroid[],
    keys: { ArrowUp: false, ArrowLeft: false, ArrowRight: false, ' ': false },
    lastShot: 0
  });

  const reqRef = useRef<number>();

  const playBeep = (freq: number, duration: number, type: OscillatorType = 'square') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch(e) {}
  };

  const createAsteroid = (x: number, y: number, size: 1 | 2 | 3): Asteroid => {
    const radius = size * 15;
    const vertices: Point[] = [];
    const numVertices = 8 + Math.random() * 4;
    for (let i = 0; i < numVertices; i++) {
      const a = (i / numVertices) * Math.PI * 2;
      const r = radius * (0.8 + Math.random() * 0.4);
      vertices.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    return {
      x, y,
      vx: (Math.random() - 0.5) * (4 - size),
      vy: (Math.random() - 0.5) * (4 - size),
      angle: 0,
      radius,
      active: true,
      size,
      vertices
    };
  };

  const startGame = () => {
    stateRef.current = {
      ship: { x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT/2, vx: 0, vy: 0, angle: -Math.PI/2, radius: 10, active: true },
      bullets: [],
      asteroids: Array.from({length: 4}).map(() => createAsteroid(Math.random() * CANVAS_WIDTH, Math.random() * CANVAS_HEIGHT, 3)),
      keys: { ArrowUp: false, ArrowLeft: false, ArrowRight: false, ' ': false },
      lastShot: 0
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

    const gameLoop = (time: number) => {
      if (!isPlaying || gameOver) return;

      const state = stateRef.current;
      const { ship, keys, bullets, asteroids } = state;

      // Ship controls
      if (keys.ArrowLeft) ship.angle -= 0.1;
      if (keys.ArrowRight) ship.angle += 0.1;
      if (keys.ArrowUp) {
        ship.vx += Math.cos(ship.angle) * 0.2;
        ship.vy += Math.sin(ship.angle) * 0.2;
      }
      
      // Friction
      ship.vx *= 0.99;
      ship.vy *= 0.99;

      // Move ship
      ship.x += ship.vx;
      ship.y += ship.vy;

      // Screen wrap
      const wrap = (val: number, max: number) => val < 0 ? max : val > max ? 0 : val;
      ship.x = wrap(ship.x, CANVAS_WIDTH);
      ship.y = wrap(ship.y, CANVAS_HEIGHT);

      // Shooting
      if (keys[' '] && time - state.lastShot > 200) {
        bullets.push({
          x: ship.x + Math.cos(ship.angle) * ship.radius,
          y: ship.y + Math.sin(ship.angle) * ship.radius,
          vx: Math.cos(ship.angle) * 10,
          vy: Math.sin(ship.angle) * 10,
          angle: 0, radius: 2, active: true
        });
        state.lastShot = time;
        playBeep(800, 0.05, 'sawtooth');
      }

      // Move bullets
      bullets.forEach(b => {
        b.x += b.vx;
        b.y += b.vy;
        if (b.x < 0 || b.x > CANVAS_WIDTH || b.y < 0 || b.y > CANVAS_HEIGHT) b.active = false;
      });

      // Move asteroids
      asteroids.forEach(a => {
        a.x = wrap(a.x + a.vx, CANVAS_WIDTH);
        a.y = wrap(a.y + a.vy, CANVAS_HEIGHT);
      });

      // Collisions
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        if (!b.active) continue;
        for (let j = asteroids.length - 1; j >= 0; j--) {
          const a = asteroids[j];
          if (!a.active) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          if (dx*dx + dy*dy < a.radius*a.radius) {
            b.active = false;
            a.active = false;
            setScore(s => s + (4 - a.size) * 100);
            playBeep(100, 0.1, 'square');
            
            if (a.size > 1) {
              asteroids.push(createAsteroid(a.x, a.y, (a.size - 1) as 1|2));
              asteroids.push(createAsteroid(a.x, a.y, (a.size - 1) as 1|2));
            }
            break;
          }
        }
      }

      // Ship collision
      asteroids.forEach(a => {
        if (!a.active) return;
        const dx = ship.x - a.x;
        const dy = ship.y - a.y;
        if (dx*dx + dy*dy < (a.radius + ship.radius)*(a.radius + ship.radius)) {
          setGameOver(true);
          setIsPlaying(false);
          playBeep(50, 0.5, 'sawtooth');
        }
      });

      // Cleanup
      state.bullets = bullets.filter(b => b.active);
      state.asteroids = asteroids.filter(a => a.active);

      // Level up
      if (state.asteroids.length === 0) {
        state.asteroids = Array.from({length: 4 + Math.floor(score/1000)}).map(() => 
          createAsteroid(Math.random() * CANVAS_WIDTH, Math.random() * CANVAS_HEIGHT, 3)
        );
      }

      // Draw
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 5;
      ctx.shadowColor = '#fff';

      // Draw Ship
      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate(ship.angle);
      ctx.beginPath();
      ctx.moveTo(ship.radius, 0);
      ctx.lineTo(-ship.radius, ship.radius * 0.8);
      ctx.lineTo(-ship.radius * 0.5, 0);
      ctx.lineTo(-ship.radius, -ship.radius * 0.8);
      ctx.closePath();
      ctx.stroke();
      if (keys.ArrowUp) {
        ctx.beginPath();
        ctx.moveTo(-ship.radius * 0.6, 0);
        ctx.lineTo(-ship.radius * 1.5, 0);
        ctx.strokeStyle = '#f97316'; // orange-500
        ctx.stroke();
      }
      ctx.restore();

      // Draw Bullets
      ctx.fillStyle = '#fff';
      bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI*2);
        ctx.fill();
      });

      // Draw Asteroids
      ctx.strokeStyle = '#60a5fa'; // blue-400
      ctx.shadowColor = '#60a5fa';
      asteroids.forEach(a => {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.beginPath();
        a.vertices.forEach((v, i) => {
          if (i === 0) ctx.moveTo(v.x, v.y);
          else ctx.lineTo(v.x, v.y);
        });
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      });

      ctx.shadowBlur = 0;

      reqRef.current = requestAnimationFrame(gameLoop);
    };

    if (isPlaying) {
      reqRef.current = requestAnimationFrame(gameLoop);
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, [isPlaying, gameOver, score]);

  return (
    <div className="relative">
      <div className="absolute top-4 left-4 font-arcade text-blue-400 text-xl z-10">
        SCORE: {score}
      </div>
      
      {!isPlaying && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
          <h2 className="font-arcade text-5xl text-blue-400 mb-8 neon-text">ASTEROIDS</h2>
          {gameOver && <p className="font-arcade text-red-500 mb-4 text-2xl">GAME OVER</p>}
          <div className="text-neutral-400 font-retro text-2xl mb-8 text-center">
            <p>UP: Thrust</p>
            <p>LEFT/RIGHT: Rotate</p>
            <p>SPACE: Fire</p>
          </div>
          <p className="font-arcade text-white animate-pulse cursor-pointer" onClick={startGame}>
            PRESS ENTER TO START
          </p>
        </div>
      )}

      <canvas 
        ref={canvasRef} 
        width={CANVAS_WIDTH} 
        height={CANVAS_HEIGHT}
        className="block focus:outline-none"
        tabIndex={0}
      />
    </div>
  );
}
