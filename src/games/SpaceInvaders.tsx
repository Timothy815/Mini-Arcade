import React, { useEffect, useRef, useState } from 'react';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const ALIEN_ROWS = 5;
const ALIEN_COLS = 11;
const ALIEN_SIZE = 24;
const ALIEN_SPACING = 40;

const PLAYER_SPRITE = [
  "       44       ",
  "      4114      ",
  "     411114     ",
  "  444411114444  ",
  " 41111111111114 ",
  "4111111111111114",
  "4111111111111114",
  " 44444444444444 "
];
const PLAYER_PALETTE: Record<string, string> = {
  '1': '#4ade80',
  '4': '#14532d'
};

const ALIEN_SPRITES = [
  [
    "   4444   ",
    "  411114  ",
    " 41111114 ",
    "4144114414",
    "4111111114",
    " 44111144 ",
    "  414414  ",
    " 414  414 "
  ],
  [
    "  4      4  ",
    "   4    4   ",
    "  45555554  ",
    " 4544554454 ",
    "455555555554",
    "454555555454",
    "454 4  4 454",
    "   44  44   "
  ],
  [
    "    4444    ",
    "  46666664  ",
    " 4666666664 ",
    "466446644664",
    "466666666664",
    " 4666666664 ",
    "  464  464  ",
    " 464    464 "
  ]
];
const ALIEN_PALETTE: Record<string, string> = {
  '1': '#f472b6',
  '5': '#60a5fa',
  '6': '#fbbf24',
  '4': '#000000'
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
type Alien = Entity & { type: number };

export function SpaceInvaders() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);

  const stateRef = useRef({
    player: { x: CANVAS_WIDTH/2 - 20, y: CANVAS_HEIGHT - 50, width: 40, height: 20, active: true },
    bullets: [] as Entity[],
    alienBullets: [] as Entity[],
    aliens: [] as Alien[],
    alienDir: 1,
    alienSpeed: 1,
    keys: { ArrowLeft: false, ArrowRight: false, ' ': false },
    lastShot: 0,
    lastAlienMove: 0
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

  const startGame = () => {
    const aliens: Alien[] = [];
    const startX = (CANVAS_WIDTH - (ALIEN_COLS * ALIEN_SPACING)) / 2;
    for (let row = 0; row < ALIEN_ROWS; row++) {
      for (let col = 0; col < ALIEN_COLS; col++) {
        aliens.push({
          x: startX + col * ALIEN_SPACING,
          y: 50 + row * ALIEN_SPACING,
          width: 36,
          height: 24,
          active: true,
          type: Math.floor(row / 2)
        });
      }
    }

    stateRef.current = {
      player: { x: CANVAS_WIDTH/2 - 24, y: CANVAS_HEIGHT - 50, width: 48, height: 24, active: true },
      bullets: [],
      alienBullets: [],
      aliens,
      alienDir: 1,
      alienSpeed: 1,
      keys: { ArrowLeft: false, ArrowRight: false, ' ': false },
      lastShot: 0,
      lastAlienMove: 0
    };
    setScore(0);
    setGameOver(false);
    setWon(false);
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
      if (!isPlaying || gameOver || won) return;

      const state = stateRef.current;
      const { player, keys, bullets, alienBullets, aliens } = state;

      // Player movement
      if (keys.ArrowLeft && player.x > 0) player.x -= 5;
      if (keys.ArrowRight && player.x < CANVAS_WIDTH - player.width) player.x += 5;

      // Player shooting
      if (keys[' '] && time - state.lastShot > 500) {
        bullets.push({ x: player.x + player.width/2 - 2, y: player.y, width: 4, height: 15, active: true });
        state.lastShot = time;
        playBeep(600, 0.1, 'square');
      }

      // Move bullets
      bullets.forEach(b => { b.y -= 10; if (b.y < 0) b.active = false; });
      alienBullets.forEach(b => { b.y += 5; if (b.y > CANVAS_HEIGHT) b.active = false; });

      // Move aliens
      const activeAliens = aliens.filter(a => a.active);
      if (activeAliens.length === 0) {
        setWon(true);
        setIsPlaying(false);
        return;
      }

      const moveInterval = Math.max(50, 800 - (ALIEN_ROWS * ALIEN_COLS - activeAliens.length) * 10);
      
      if (time - state.lastAlienMove > moveInterval) {
        let hitEdge = false;
        activeAliens.forEach(a => {
          if ((a.x <= 10 && state.alienDir === -1) || (a.x + a.width >= CANVAS_WIDTH - 10 && state.alienDir === 1)) {
            hitEdge = true;
          }
        });

        if (hitEdge) {
          state.alienDir *= -1;
          aliens.forEach(a => a.y += 20);
        } else {
          aliens.forEach(a => a.x += 10 * state.alienDir);
        }
        
        // Alien shooting
        if (Math.random() < 0.3) {
          const shooter = activeAliens[Math.floor(Math.random() * activeAliens.length)];
          alienBullets.push({ x: shooter.x + shooter.width/2 - 2, y: shooter.y + shooter.height, width: 4, height: 15, active: true });
        }

        state.lastAlienMove = time;
        playBeep(100, 0.05, 'sawtooth');
      }

      // Collisions
      // Player bullets hit aliens
      bullets.forEach(b => {
        if (!b.active) return;
        aliens.forEach(a => {
          if (!a.active) return;
          if (b.x < a.x + a.width && b.x + b.width > a.x && b.y < a.y + a.height && b.y + b.height > a.y) {
            b.active = false;
            a.active = false;
            setScore(s => s + (3 - a.type) * 10);
            playBeep(300, 0.1, 'square');
          }
        });
      });

      // Alien bullets hit player
      alienBullets.forEach(b => {
        if (!b.active) return;
        if (b.x < player.x + player.width && b.x + b.width > player.x && b.y < player.y + player.height && b.y + b.height > player.y) {
          setGameOver(true);
          setIsPlaying(false);
          playBeep(150, 0.5, 'sawtooth');
        }
      });

      // Aliens hit player or bottom
      activeAliens.forEach(a => {
        if (a.y + a.height >= player.y) {
          setGameOver(true);
          setIsPlaying(false);
        }
      });

      // Cleanup
      state.bullets = bullets.filter(b => b.active);
      state.alienBullets = alienBullets.filter(b => b.active);

      // Draw
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw Player
      drawSprite(ctx, PLAYER_SPRITE, player.x, player.y, 3, PLAYER_PALETTE);

      // Draw Bullets
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#fff';
      bullets.forEach(b => ctx.fillRect(b.x, b.y, b.width, b.height));
      
      ctx.fillStyle = '#f87171'; // red-400
      ctx.shadowColor = '#f87171';
      alienBullets.forEach(b => ctx.fillRect(b.x, b.y, b.width, b.height));

      // Draw Aliens
      aliens.forEach(a => {
        if (!a.active) return;
        // Animating the aliens slightly based on time
        const animOffset = Math.floor(time / 500) % 2 === 0 ? 1 : 0;
        drawSprite(ctx, ALIEN_SPRITES[a.type], a.x, a.y + animOffset * 2, 3, ALIEN_PALETTE);
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
  }, [isPlaying, gameOver, won]);

  return (
    <div className="relative">
      <div className="absolute top-4 left-4 font-arcade text-green-400 text-xl z-10">
        SCORE: {score}
      </div>
      
      {!isPlaying && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
          <h2 className="font-arcade text-5xl text-green-400 mb-8 neon-text text-center leading-tight">SPACE<br/>INVADERS</h2>
          {gameOver && <p className="font-arcade text-red-500 mb-4 text-2xl">GAME OVER</p>}
          {won && <p className="font-arcade text-yellow-400 mb-4 text-2xl">YOU WIN!</p>}
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
