import React, { useEffect, useRef, useState } from 'react';

const GRID_SIZE = 80;
const CELL_SIZE = 8;
const CANVAS_WIDTH = GRID_SIZE * CELL_SIZE;
const CANVAS_HEIGHT = GRID_SIZE * CELL_SIZE;

type Point = { x: number; y: number };
type Bike = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: string;
  trail: Point[];
  alive: boolean;
};

export function LightBike({ aggression = 'NORMAL' }: { aggression?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  const stateRef = useRef({
    player: { x: 10, y: GRID_SIZE / 2, dx: 1, dy: 0, color: '#06b6d4', trail: [], alive: true } as Bike,
    ai: { x: GRID_SIZE - 10, y: GRID_SIZE / 2, dx: -1, dy: 0, color: '#ec4899', trail: [], alive: true } as Bike,
    grid: Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0)),
    keys: { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false }
  });

  const startGame = () => {
    stateRef.current.player = { x: 10, y: GRID_SIZE / 2, dx: 1, dy: 0, color: '#06b6d4', trail: [], alive: true };
    stateRef.current.ai = { x: GRID_SIZE - 10, y: GRID_SIZE / 2, dx: -1, dy: 0, color: '#ec4899', trail: [], alive: true };
    stateRef.current.grid = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
    setGameOver(false);
    setWinner(null);
    setIsPlaying(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying && (e.key === 'Enter' || e.key === ' ')) {
        startGame();
        return;
      }
      const { player } = stateRef.current;
      if (e.key === 'ArrowUp' && player.dy === 0) { player.dx = 0; player.dy = -1; }
      if (e.key === 'ArrowDown' && player.dy === 0) { player.dx = 0; player.dy = 1; }
      if (e.key === 'ArrowLeft' && player.dx === 0) { player.dx = -1; player.dy = 0; }
      if (e.key === 'ArrowRight' && player.dx === 0) { player.dx = 1; player.dy = 0; }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying || gameOver) return;

    const gameLoop = setInterval(() => {
      const { player, ai, grid } = stateRef.current;

      // AI Logic
      const moveAI = () => {
        const isSafe = (x: number, y: number) => {
          return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE && grid[y][x] === 0;
        };

        const getSpace = (startX: number, startY: number) => {
          if (!isSafe(startX, startY)) return 0;
          const visited = new Set<string>();
          const queue = [{x: startX, y: startY}];
          visited.add(`${startX},${startY}`);
          let space = 0;
          let head = 0;
          while(head < queue.length && space < 300) {
            const {x, y} = queue[head++];
            space++;
            const dirs = [{dx: 1, dy: 0}, {dx: -1, dy: 0}, {dx: 0, dy: 1}, {dx: 0, dy: -1}];
            for (const d of dirs) {
              const nx = x + d.dx;
              const ny = y + d.dy;
              if (isSafe(nx, ny) && !visited.has(`${nx},${ny}`)) {
                visited.add(`${nx},${ny}`);
                queue.push({x: nx, y: ny});
              }
            }
          }
          return space;
        };

        const dirs = [
          {dx: ai.dx, dy: ai.dy}, // forward
          {dx: -ai.dy, dy: ai.dx}, // right
          {dx: ai.dy, dy: -ai.dx} // left
        ];

        let bestDirs = dirs.map(d => {
          const nx = ai.x + d.dx;
          const ny = ai.y + d.dy;
          const space = getSpace(nx, ny);
          const dist = Math.abs(nx - player.x) + Math.abs(ny - player.y);
          return { ...d, space, dist };
        });

        bestDirs.sort((a, b) => {
          // If space is critical, prioritize survival
          if (a.space < 150 || b.space < 150) {
            if (a.space !== b.space) return b.space - a.space;
          }
          
          let scoreA = a.space;
          let scoreB = b.space;
          
          if (aggression === 'BRUTAL') {
             scoreA -= a.dist * 10;
             scoreB -= b.dist * 10;
          } else if (aggression === 'NORMAL') {
             scoreA -= a.dist * 3;
             scoreB -= b.dist * 3;
          }
          
          // slight preference for straight to avoid jitter
          if (a.dx === ai.dx && a.dy === ai.dy) scoreA += 10;
          if (b.dx === ai.dx && b.dy === ai.dy) scoreB += 10;

          return scoreB - scoreA;
        });

        if (bestDirs[0].space > 0) {
          ai.dx = bestDirs[0].dx;
          ai.dy = bestDirs[0].dy;
        }
      };
      moveAI();

      // Update positions
      const updateBike = (b: Bike) => {
        if (!b.alive) return;
        b.trail.push({ x: b.x, y: b.y });
        grid[b.y][b.x] = 1;
        b.x += b.dx;
        b.y += b.dy;

        if (b.x < 0 || b.x >= GRID_SIZE || b.y < 0 || b.y >= GRID_SIZE || grid[b.y][b.x] !== 0) {
          b.alive = false;
        }
      };

      updateBike(player);
      updateBike(ai);

      if (!player.alive || !ai.alive) {
        setGameOver(true);
        setIsPlaying(false);
        if (!player.alive && !ai.alive) setWinner('DRAW');
        else if (!player.alive) setWinner('AI WINS');
        else setWinner('YOU WIN');
      }
    }, 50);

    return () => clearInterval(gameLoop);
  }, [isPlaying, gameOver]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Grid
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.1)';
      ctx.lineWidth = 1;
      for (let i = 0; i < CANVAS_WIDTH; i += CELL_SIZE * 5) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CANVAS_HEIGHT); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CANVAS_WIDTH, i); ctx.stroke();
      }

      const { player, ai } = stateRef.current;

      const drawBike = (b: Bike) => {
        ctx.shadowBlur = 10;
        ctx.shadowColor = b.color;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (b.trail.length > 0) {
          ctx.moveTo(b.trail[0].x * CELL_SIZE + CELL_SIZE / 2, b.trail[0].y * CELL_SIZE + CELL_SIZE / 2);
          b.trail.forEach(p => ctx.lineTo(p.x * CELL_SIZE + CELL_SIZE / 2, p.y * CELL_SIZE + CELL_SIZE / 2));
        }
        ctx.lineTo(b.x * CELL_SIZE + CELL_SIZE / 2, b.y * CELL_SIZE + CELL_SIZE / 2);
        ctx.stroke();
        
        ctx.fillStyle = '#fff';
        ctx.fillRect(b.x * CELL_SIZE, b.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        ctx.shadowBlur = 0;
      };

      drawBike(player);
      drawBike(ai);

      requestAnimationFrame(draw);
    };

    draw();
  }, []);

  return (
    <div className="relative flex flex-col items-center">
      {!isPlaying && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
          <h2 className="font-arcade text-5xl text-cyan-400 mb-8 neon-text">LIGHT BIKE</h2>
          {gameOver && (
            <div className="text-center mb-8">
              <p className="font-arcade text-red-500 text-2xl mb-2">GAME OVER</p>
              <p className="text-white text-xl">{winner}</p>
            </div>
          )}
          <div className="text-neutral-400 font-retro text-xl mb-8 text-center max-w-md">
            <p>ARROW KEYS: Steer Bike</p>
            <p className="mt-4 text-white">Don't hit the walls or trails!</p>
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
        className="block bg-black border-2 border-neutral-800 rounded shadow-lg"
      />
    </div>
  );
}
