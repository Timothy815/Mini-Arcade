import React, { useEffect, useRef, useState } from 'react';

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 800;
const GRID_SIZE = 20;
const COLS = CANVAS_WIDTH / GRID_SIZE;
const ROWS = CANVAS_HEIGHT / GRID_SIZE;
const PLAYER_AREA_ROWS = 8;

const PLAYER_SPRITE = [
  "   44   ",
  "  4114  ",
  "  4114  ",
  " 411114 ",
  " 411114 ",
  "41111114",
  "41111114",
  " 444444 "
];
const PLAYER_PALETTE: Record<string, string> = {
  '1': '#38bdf8',
  '4': '#0c4a6e'
};

const CENTIPEDE_HEAD = [
  "  4444  ",
  " 411114 ",
  "41444414",
  "41422414",
  "41444414",
  " 411114 ",
  "  4444  ",
  " 44  44 "
];
const CENTIPEDE_BODY = [
  "  4444  ",
  " 411114 ",
  "41111114",
  "41111114",
  "41111114",
  " 411114 ",
  "  4444  ",
  " 44  44 "
];
const CENTIPEDE_PALETTE: Record<string, string> = {
  '1': '#22c55e',
  '2': '#ef4444',
  '4': '#064e3b'
};

const MUSHROOM_SPRITE = [
  "  4444  ",
  " 455554 ",
  "45555554",
  "45555554",
  " 445544 ",
  "  4664  ",
  "  4664  ",
  "  4444  "
];
const MUSHROOM_PALETTE: Record<string, string> = {
  '5': '#a855f7',
  '6': '#e5e5e5',
  '4': '#3b0764'
};

const drawSprite = (ctx: CanvasRenderingContext2D, sprite: string[], x: number, y: number, scale: number, palette: Record<string, string>, damage = 0) => {
  sprite.forEach((row, i) => {
    for (let j = 0; j < row.length; j++) {
      const char = row[j];
      if (char !== ' ') {
        // Randomly drop pixels if damaged
        if (damage > 0 && Math.random() < damage * 0.2) continue;
        ctx.fillStyle = palette[char] || char;
        ctx.fillRect(x + j * scale, y + i * scale, scale, scale);
      }
    }
  });
};

type Point = { x: number, y: number };
type Mushroom = Point & { health: number };
type Segment = Point & { dx: number, dy: number, isHead: boolean };
type Bullet = Point & { active: boolean };

export function Centipede() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const stateRef = useRef({
    player: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 40 },
    bullets: [] as Bullet[],
    mushrooms: [] as Mushroom[],
    centipede: [] as Segment[],
    keys: { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, ' ': false },
    lastShot: 0,
    level: 1
  });

  const reqRef = useRef<number>();
  const lastTickRef = useRef<number>(0);

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
    const mushrooms: Mushroom[] = [];
    // Generate random mushrooms, leaving top and bottom clear
    for (let i = 0; i < 40 + level * 10; i++) {
      mushrooms.push({
        x: Math.floor(Math.random() * COLS),
        y: Math.floor(Math.random() * (ROWS - PLAYER_AREA_ROWS - 2)) + 2,
        health: 4
      });
    }

    const centipede: Segment[] = [];
    const length = Math.min(10 + level * 2, 20);
    for (let i = 0; i < length; i++) {
      centipede.push({
        x: COLS / 2 - i,
        y: 0,
        dx: 1,
        dy: 0,
        isHead: i === 0
      });
    }

    return { mushrooms, centipede };
  };

  const startGame = () => {
    const { mushrooms, centipede } = initLevel(1);
    stateRef.current = {
      player: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 40 },
      bullets: [],
      mushrooms,
      centipede,
      keys: { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, ' ': false },
      lastShot: 0,
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

      reqRef.current = requestAnimationFrame(gameLoop);

      const state = stateRef.current;
      const { player, keys, bullets, mushrooms, centipede } = state;

      // Player Movement (Smooth)
      const speed = 6;
      if (keys.ArrowLeft && player.x > 0) player.x -= speed;
      if (keys.ArrowRight && player.x < CANVAS_WIDTH - GRID_SIZE) player.x += speed;
      if (keys.ArrowUp && player.y > CANVAS_HEIGHT - PLAYER_AREA_ROWS * GRID_SIZE) player.y -= speed;
      if (keys.ArrowDown && player.y < CANVAS_HEIGHT - GRID_SIZE) player.y += speed;

      // Shooting
      if (keys[' '] && time - state.lastShot > 150) {
        bullets.push({ x: player.x + GRID_SIZE / 2 - 2, y: player.y, active: true });
        state.lastShot = time;
        playBeep(800, 0.05, 'square');
      }

      // Move Bullets
      bullets.forEach(b => {
        b.y -= 15;
        if (b.y < 0) b.active = false;
      });

      // Centipede Movement (Grid-based, tick-based)
      const tickRate = Math.max(30, 100 - state.level * 5);
      if (time - lastTickRef.current > tickRate) {
        lastTickRef.current = time;

        // Move segments from tail to head
        for (let i = centipede.length - 1; i >= 0; i--) {
          const seg = centipede[i];
          
          if (seg.dy !== 0) {
            // Was moving down, now move horizontally
            seg.y += seg.dy;
            seg.dy = 0;
            // Reverse direction if hitting bottom
            if (seg.y >= ROWS - 1) {
              seg.y = ROWS - 2;
              // In real centipede they move up, but let's just keep them at bottom for simplicity
            }
          } else {
            const nextX = seg.x + seg.dx;
            
            // Check collision with wall or mushroom
            const hitWall = nextX < 0 || nextX >= COLS;
            const hitMushroom = mushrooms.some(m => m.x === nextX && m.y === seg.y);

            if (hitWall || hitMushroom) {
              seg.dx *= -1;
              seg.dy = 1; // Move down next tick
            } else {
              seg.x = nextX;
            }
          }
        }
      }

      // Collisions
      bullets.forEach(b => {
        if (!b.active) return;
        
        // Bullet vs Mushroom
        const bGridX = Math.floor(b.x / GRID_SIZE);
        const bGridY = Math.floor(b.y / GRID_SIZE);
        
        const mIdx = mushrooms.findIndex(m => m.x === bGridX && m.y === bGridY);
        if (mIdx !== -1) {
          b.active = false;
          mushrooms[mIdx].health--;
          playBeep(300, 0.05, 'sawtooth');
          if (mushrooms[mIdx].health <= 0) {
            mushrooms.splice(mIdx, 1);
            setScore(s => s + 5);
          }
          return;
        }

        // Bullet vs Centipede
        const cIdx = centipede.findIndex(c => c.x === bGridX && c.y === bGridY);
        if (cIdx !== -1) {
          b.active = false;
          const hitSeg = centipede[cIdx];
          
          // Turn hit segment into mushroom
          mushrooms.push({ x: hitSeg.x, y: hitSeg.y, health: 4 });
          
          // Split centipede
          centipede.splice(cIdx, 1);
          if (cIdx < centipede.length) {
            centipede[cIdx].isHead = true; // The segment behind becomes a new head
          }
          
          setScore(s => s + (hitSeg.isHead ? 100 : 10));
          playBeep(150, 0.1, 'square');
        }
      });

      // Player vs Centipede/Mushroom
      const pGridX = Math.floor((player.x + GRID_SIZE/2) / GRID_SIZE);
      const pGridY = Math.floor((player.y + GRID_SIZE/2) / GRID_SIZE);
      
      if (centipede.some(c => c.x === pGridX && c.y === pGridY)) {
        setGameOver(true);
        setIsPlaying(false);
        playBeep(100, 0.8, 'sawtooth');
      }

      // Cleanup
      state.bullets = bullets.filter(b => b.active);

      // Level up
      if (centipede.length === 0) {
        state.level++;
        const newLevel = initLevel(state.level);
        state.centipede = newLevel.centipede;
        // Keep existing mushrooms, add a few more
        state.mushrooms.push(...newLevel.mushrooms.slice(0, 10));
        playBeep(400, 0.5, 'sine');
      }

      // Draw
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw Player Area Boundary
      ctx.strokeStyle = '#333';
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_HEIGHT - PLAYER_AREA_ROWS * GRID_SIZE);
      ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - PLAYER_AREA_ROWS * GRID_SIZE);
      ctx.stroke();

      // Draw Mushrooms
      mushrooms.forEach(m => {
        const mx = m.x * GRID_SIZE;
        const my = m.y * GRID_SIZE;
        const damage = 4 - m.health;
        drawSprite(ctx, MUSHROOM_SPRITE, mx, my, 2.5, MUSHROOM_PALETTE, damage);
      });

      // Draw Centipede
      centipede.forEach(c => {
        const cx = c.x * GRID_SIZE;
        const cy = c.y * GRID_SIZE;
        const sprite = c.isHead ? CENTIPEDE_HEAD : CENTIPEDE_BODY;
        
        ctx.save();
        ctx.translate(cx + GRID_SIZE/2, cy + GRID_SIZE/2);
        // Flip horizontally if moving left
        if (c.dx < 0) ctx.scale(-1, 1);
        
        drawSprite(ctx, sprite, -10, -10, 2.5, CENTIPEDE_PALETTE);
        ctx.restore();
      });

      // Draw Bullets
      ctx.fillStyle = '#fde047';
      bullets.forEach(b => {
        ctx.fillRect(b.x, b.y, 4, 12);
      });

      // Draw Player
      drawSprite(ctx, PLAYER_SPRITE, player.x, player.y, 2.5, PLAYER_PALETTE);

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
      <div className="absolute top-4 left-4 font-arcade text-pink-400 text-xl z-10">
        SCORE: {score}
      </div>
      <div className="absolute top-4 right-4 font-arcade text-pink-400 text-xl z-10">
        LEVEL: {stateRef.current.level}
      </div>
      
      {!isPlaying && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
          <h2 className="font-arcade text-5xl text-pink-400 mb-8 neon-text tracking-widest">CENTIPEDE</h2>
          {gameOver && <p className="font-arcade text-red-500 mb-4 text-2xl">GAME OVER</p>}
          <div className="text-neutral-400 font-retro text-2xl mb-8 text-center">
            <p>ARROWS: Move</p>
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
