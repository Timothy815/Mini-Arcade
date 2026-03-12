import React, { useEffect, useRef, useState } from 'react';

const GRID_SIZE = 20;
const CANVAS_SIZE = 600;
const INITIAL_SNAKE = [{ x: 10, y: 10 }];
const INITIAL_DIRECTION = { x: 1, y: 0 };

export function Snake() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Game state refs to avoid dependency issues in requestAnimationFrame
  const snakeRef = useRef(INITIAL_SNAKE);
  const dirRef = useRef(INITIAL_DIRECTION);
  const foodRef = useRef({ x: 15, y: 15 });
  const lastUpdateRef = useRef(0);
  const reqRef = useRef<number>();

  const resetGame = () => {
    snakeRef.current = INITIAL_SNAKE;
    dirRef.current = INITIAL_DIRECTION;
    setScore(0);
    setGameOver(false);
    spawnFood();
    setIsPlaying(true);
  };

  const spawnFood = () => {
    let newFood;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * (CANVAS_SIZE / GRID_SIZE)),
        y: Math.floor(Math.random() * (CANVAS_SIZE / GRID_SIZE))
      };
      // eslint-disable-next-line no-loop-func
      if (!snakeRef.current.some(segment => segment.x === newFood.x && segment.y === newFood.y)) {
        break;
      }
    }
    foodRef.current = newFood;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying) {
        if (e.key === 'Enter' || e.key === ' ') resetGame();
        return;
      }
      
      e.preventDefault(); // Prevent scrolling
      
      const dir = dirRef.current;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
          if (dir.y === 0) dirRef.current = { x: 0, y: -1 };
          break;
        case 'ArrowDown':
        case 's':
          if (dir.y === 0) dirRef.current = { x: 0, y: 1 };
          break;
        case 'ArrowLeft':
        case 'a':
          if (dir.x === 0) dirRef.current = { x: -1, y: 0 };
          break;
        case 'ArrowRight':
        case 'd':
          if (dir.x === 0) dirRef.current = { x: 1, y: 0 };
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gameLoop = (time: number) => {
      if (!isPlaying || gameOver) return;

      reqRef.current = requestAnimationFrame(gameLoop);

      // Update every 100ms
      if (time - lastUpdateRef.current < 100) return;
      lastUpdateRef.current = time;

      const snake = [...snakeRef.current];
      const head = { ...snake[0] };
      const dir = dirRef.current;

      head.x += dir.x;
      head.y += dir.y;

      // Wall collision
      if (
        head.x < 0 || 
        head.x >= CANVAS_SIZE / GRID_SIZE || 
        head.y < 0 || 
        head.y >= CANVAS_SIZE / GRID_SIZE
      ) {
        setGameOver(true);
        setIsPlaying(false);
        return;
      }

      // Self collision
      if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
        setGameOver(true);
        setIsPlaying(false);
        return;
      }

      snake.unshift(head);

      // Food collision
      if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
        setScore(s => s + 10);
        spawnFood();
        // Play sound effect here if possible
        playBeep(600, 0.1);
      } else {
        snake.pop();
      }

      snakeRef.current = snake;

      // Draw
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Draw Grid (optional, for retro feel)
      ctx.strokeStyle = '#111';
      for(let i=0; i<CANVAS_SIZE; i+=GRID_SIZE) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CANVAS_SIZE); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CANVAS_SIZE, i); ctx.stroke();
      }

      // Draw Food
      ctx.fillStyle = '#ef4444'; // red-500
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ef4444';
      ctx.fillRect(foodRef.current.x * GRID_SIZE + 2, foodRef.current.y * GRID_SIZE + 2, GRID_SIZE - 4, GRID_SIZE - 4);
      ctx.shadowBlur = 0;

      // Draw Snake
      snake.forEach((segment, i) => {
        ctx.fillStyle = i === 0 ? '#34d399' : '#10b981'; // emerald-400 / emerald-500
        if (i === 0) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#34d399';
        } else {
            ctx.shadowBlur = 0;
        }
        ctx.fillRect(segment.x * GRID_SIZE + 1, segment.y * GRID_SIZE + 1, GRID_SIZE - 2, GRID_SIZE - 2);
      });
      ctx.shadowBlur = 0;
    };

    if (isPlaying) {
      reqRef.current = requestAnimationFrame(gameLoop);
    } else {
      // Draw initial state
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.fillStyle = '#34d399';
      ctx.fillRect(INITIAL_SNAKE[0].x * GRID_SIZE + 1, INITIAL_SNAKE[0].y * GRID_SIZE + 1, GRID_SIZE - 2, GRID_SIZE - 2);
    }

    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, [isPlaying, gameOver]);

  // Simple Web Audio API beep
  const playBeep = (freq: number, duration: number) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch(e) {
      // Ignore audio errors
    }
  };

  return (
    <div className="relative">
      <div className="absolute top-4 left-4 font-arcade text-emerald-400 text-xl z-10">
        SCORE: {score}
      </div>
      
      {!isPlaying && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
          <h2 className="font-arcade text-4xl text-emerald-400 mb-8 neon-text">SNAKE</h2>
          {gameOver && <p className="font-arcade text-red-500 mb-4">GAME OVER</p>}
          <p className="font-arcade text-white animate-pulse cursor-pointer" onClick={resetGame}>
            PRESS ENTER TO START
          </p>
        </div>
      )}

      <canvas 
        ref={canvasRef} 
        width={CANVAS_SIZE} 
        height={CANVAS_SIZE}
        className="block focus:outline-none"
        tabIndex={0}
      />
    </div>
  );
}
