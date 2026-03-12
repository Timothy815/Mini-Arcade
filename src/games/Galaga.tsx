import React, { useEffect, useRef, useState } from 'react';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SPEED = 5;
const BULLET_SPEED = 10;
const ENEMY_ROWS = 4;
const ENEMY_COLS = 8;

const PLAYER_SPRITE = [
  "       44       ",
  "      4114      ",
  "      4114      ",
  "     411114     ",
  "     411114     ",
  "  444411114444  ",
  " 42224111142224 ",
  "4222241111422224",
  "4111141111411114",
  " 4444 4444 4444 "
];
const PLAYER_PALETTE: Record<string, string> = {
  '1': '#f8fafc',
  '2': '#ef4444',
  '4': '#1e293b'
};

const ENEMY_SPRITES = [
  [
    "    444444    ",
    "   41111114   ",
    "  4111111114  ",
    " 411441144114 ",
    " 411441144114 ",
    " 411111111114 ",
    "  4411111144  ",
    " 422444444224 ",
    "422224  422224",
    " 4444    4444 "
  ],
  [
    "  444    444  ",
    " 45554  45554 ",
    "45555544555554",
    "45544555544554",
    "45555555555554",
    " 455555555554 ",
    "  4455555544  ",
    " 455444444554 ",
    "4554      4554",
    " 44        44 "
  ],
  [
    "    444444    ",
    "   46666664   ",
    "  4666666664  ",
    " 466446644664 ",
    " 466446644664 ",
    "  4666666664  ",
    " 477444444774 ",
    "477774  477774",
    "477774  477774",
    " 4444    4444 "
  ]
];
const ENEMY_PALETTE: Record<string, string> = {
  '1': '#3b82f6',
  '2': '#ef4444',
  '5': '#a855f7',
  '6': '#eab308',
  '7': '#38bdf8',
  '4': '#1e293b'
};

const drawSprite = (ctx: CanvasRenderingContext2D, sprite: string[], x: number, y: number, scale: number, palette: Record<string, string>) => {
  sprite.forEach((row, i) => {
    for (let j = 0; j < row.length; j++) {
      const char = row[j];
      if (char !== ' ') {
        ctx.fillStyle = palette[char] || char;
        ctx.fillRect(x + j * scale, y + i * scale, scale, scale);
      }
    }
  });
};

type Entity = { x: number, y: number, width: number, height: number, active: boolean };
type Enemy = Entity & { startX: number, startY: number, state: 'idle' | 'diving' | 'returning', diveAngle: number, type: number };
type Star = { x: number, y: number, speed: number, size: number };

export function Galaga() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const stateRef = useRef({
    player: { x: CANVAS_WIDTH / 2 - 20, y: CANVAS_HEIGHT - 60, width: 40, height: 40, active: true },
    bullets: [] as Entity[],
    enemyBullets: [] as Entity[],
    enemies: [] as Enemy[],
    stars: [] as Star[],
    keys: { ArrowLeft: false, ArrowRight: false, ' ': false },
    lastShot: 0,
    formationOffset: 0,
    formationDir: 1,
    level: 1
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

  const initLevel = (level: number) => {
    const enemies: Enemy[] = [];
    const spacingX = 60;
    const spacingY = 50;
    const startX = (CANVAS_WIDTH - (ENEMY_COLS * spacingX)) / 2;
    
    for (let row = 0; row < ENEMY_ROWS; row++) {
      for (let col = 0; col < ENEMY_COLS; col++) {
        enemies.push({
          x: startX + col * spacingX,
          y: 50 + row * spacingY,
          startX: startX + col * spacingX,
          startY: 50 + row * spacingY,
          width: 42,
          height: 30,
          active: true,
          state: 'idle',
          diveAngle: 0,
          type: row % 3
        });
      }
    }
    return enemies;
  };

  const startGame = () => {
    const stars: Star[] = Array.from({ length: 100 }).map(() => ({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT,
      speed: Math.random() * 2 + 0.5,
      size: Math.random() * 2 + 1
    }));

    stateRef.current = {
      player: { x: CANVAS_WIDTH / 2 - 24, y: CANVAS_HEIGHT - 60, width: 48, height: 30, active: true },
      bullets: [],
      enemyBullets: [],
      enemies: initLevel(1),
      stars,
      keys: { ArrowLeft: false, ArrowRight: false, ' ': false },
      lastShot: 0,
      formationOffset: 0,
      formationDir: 1,
      level: 1
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
      const { player, keys, bullets, enemyBullets, enemies, stars } = state;

      // Move stars
      stars.forEach(s => {
        s.y += s.speed;
        if (s.y > CANVAS_HEIGHT) {
          s.y = 0;
          s.x = Math.random() * CANVAS_WIDTH;
        }
      });

      // Player movement
      if (keys.ArrowLeft && player.x > 0) player.x -= PLAYER_SPEED;
      if (keys.ArrowRight && player.x < CANVAS_WIDTH - player.width) player.x += PLAYER_SPEED;

      // Player shooting
      if (keys[' '] && time - state.lastShot > 250) {
        bullets.push({ x: player.x + player.width / 2 - 2, y: player.y, width: 4, height: 15, active: true });
        bullets.push({ x: player.x + player.width / 2 - 2, y: player.y, width: 4, height: 15, active: true }); // Double shot
        state.lastShot = time;
        playBeep(800, 0.1, 'square');
      }

      // Move bullets
      bullets.forEach(b => { b.y -= BULLET_SPEED; if (b.y < 0) b.active = false; });
      enemyBullets.forEach(b => { b.y += BULLET_SPEED * 0.6; if (b.y > CANVAS_HEIGHT) b.active = false; });

      // Formation movement
      state.formationOffset += 0.5 * state.formationDir;
      if (Math.abs(state.formationOffset) > 50) state.formationDir *= -1;

      // Enemy logic
      const activeEnemies = enemies.filter(e => e.active);
      
      // Level up
      if (activeEnemies.length === 0) {
        state.level++;
        state.enemies = initLevel(state.level);
        playBeep(400, 0.5, 'sine');
      }

      // Random diving
      if (Math.random() < 0.02 && activeEnemies.length > 0) {
        const idleEnemies = activeEnemies.filter(e => e.state === 'idle');
        if (idleEnemies.length > 0) {
          const diver = idleEnemies[Math.floor(Math.random() * idleEnemies.length)];
          diver.state = 'diving';
          diver.diveAngle = Math.atan2(player.y - diver.y, player.x - diver.x);
        }
      }

      enemies.forEach(e => {
        if (!e.active) return;
        
        if (e.state === 'idle') {
          e.x = e.startX + state.formationOffset;
          e.y = e.startY + Math.sin(time / 500 + e.startX) * 10;
        } else if (e.state === 'diving') {
          e.x += Math.cos(e.diveAngle) * 4;
          e.y += Math.sin(e.diveAngle) * 4;
          
          // Shoot while diving
          if (Math.random() < 0.02) {
            enemyBullets.push({ x: e.x + e.width/2, y: e.y + e.height, width: 6, height: 6, active: true });
            playBeep(200, 0.1, 'sawtooth');
          }

          if (e.y > CANVAS_HEIGHT) {
            e.y = -50;
            e.state = 'returning';
          }
        } else if (e.state === 'returning') {
          const dx = (e.startX + state.formationOffset) - e.x;
          const dy = e.startY - e.y;
          e.x += dx * 0.05;
          e.y += dy * 0.05;
          if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
            e.state = 'idle';
          }
        }
      });

      // Collisions
      bullets.forEach(b => {
        if (!b.active) return;
        enemies.forEach(e => {
          if (!e.active) return;
          if (b.x < e.x + e.width && b.x + b.width > e.x && b.y < e.y + e.height && b.y + b.height > e.y) {
            b.active = false;
            e.active = false;
            setScore(s => s + (e.state === 'diving' ? 200 : 100));
            playBeep(150, 0.1, 'square');
          }
        });
      });

      enemyBullets.forEach(b => {
        if (!b.active) return;
        if (b.x < player.x + player.width && b.x + b.width > player.x && b.y < player.y + player.height && b.y + b.height > player.y) {
          setGameOver(true);
          setIsPlaying(false);
          playBeep(100, 0.8, 'sawtooth');
        }
      });

      enemies.forEach(e => {
        if (!e.active) return;
        if (e.x < player.x + player.width && e.x + e.width > player.x && e.y < player.y + player.height && e.y + e.height > player.y) {
          setGameOver(true);
          setIsPlaying(false);
          playBeep(100, 0.8, 'sawtooth');
        }
      });

      // Cleanup
      state.bullets = bullets.filter(b => b.active);
      state.enemyBullets = enemyBullets.filter(b => b.active);

      // Draw
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw Stars
      ctx.fillStyle = '#fff';
      stars.forEach(s => {
        ctx.globalAlpha = s.size / 3;
        ctx.fillRect(s.x, s.y, s.size, s.size);
      });
      ctx.globalAlpha = 1.0;

      // Draw Player
      drawSprite(ctx, PLAYER_SPRITE, player.x, player.y, 3, PLAYER_PALETTE);

      // Draw Bullets
      ctx.fillStyle = '#fde047'; // yellow-300
      ctx.shadowColor = '#fde047';
      bullets.forEach(b => ctx.fillRect(b.x, b.y, b.width, b.height));
      
      ctx.fillStyle = '#ef4444'; // red-500
      ctx.shadowColor = '#ef4444';
      enemyBullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x + b.width/2, b.y + b.height/2, b.width/2, 0, Math.PI*2);
        ctx.fill();
      });

      // Draw Enemies
      enemies.forEach(e => {
        if (!e.active) return;
        
        ctx.save();
        ctx.translate(e.x + e.width/2, e.y + e.height/2);
        if (e.state === 'diving') {
          ctx.rotate(e.diveAngle - Math.PI/2);
        }
        
        // Draw retro bug shape
        drawSprite(ctx, ENEMY_SPRITES[e.type], -21, -15, 3, ENEMY_PALETTE);
        
        ctx.restore();
      });

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
  }, [isPlaying, gameOver]);

  return (
    <div className="relative">
      <div className="absolute top-4 left-4 font-arcade text-sky-400 text-xl z-10">
        SCORE: {score}
      </div>
      <div className="absolute top-4 right-4 font-arcade text-sky-400 text-xl z-10">
        LEVEL: {stateRef.current.level}
      </div>
      
      {!isPlaying && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
          <h2 className="font-arcade text-5xl text-red-500 mb-8 neon-text tracking-widest">GALAGA</h2>
          {gameOver && <p className="font-arcade text-red-500 mb-4 text-2xl">GAME OVER</p>}
          <div className="text-neutral-400 font-retro text-2xl mb-8 text-center">
            <p>LEFT/RIGHT: Move</p>
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
