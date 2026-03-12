import React, { useEffect, useRef, useState } from 'react';

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const CANVAS_WIDTH = COLS * BLOCK_SIZE;
const CANVAS_HEIGHT = ROWS * BLOCK_SIZE;

const SHAPES = [
  [], // Empty
  [[0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]], // I - Cyan
  [[2,0,0], [2,2,2], [0,0,0]], // J - Blue
  [[0,0,3], [3,3,3], [0,0,0]], // L - Orange
  [[4,4], [4,4]], // O - Yellow
  [[0,5,5], [5,5,0], [0,0,0]], // S - Green
  [[0,6,0], [6,6,6], [0,0,0]], // T - Purple
  [[7,7,0], [0,7,7], [0,0,0]]  // Z - Red
];

const COLORS = [
  '#000000',
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#a855f7', // Purple
  '#ef4444'  // Red
];

type Piece = { matrix: number[][], x: number, y: number };

export function Tetris() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const stateRef = useRef({
    grid: Array.from({ length: ROWS }, () => Array(COLS).fill(0)),
    piece: null as Piece | null,
    dropCounter: 0,
    dropInterval: 1000,
    lastTime: 0
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

  const createPiece = (): Piece => {
    const typeId = Math.floor(Math.random() * 7) + 1;
    const matrix = SHAPES[typeId].map(row => [...row]);
    return { matrix, x: Math.floor(COLS / 2) - Math.floor(matrix[0].length / 2), y: 0 };
  };

  const collide = (grid: number[][], piece: Piece) => {
    const m = piece.matrix;
    for (let y = 0; y < m.length; ++y) {
      for (let x = 0; x < m[y].length; ++x) {
        if (m[y][x] !== 0 &&
           (grid[y + piece.y] && grid[y + piece.y][x + piece.x]) !== 0) {
          return true;
        }
      }
    }
    return false;
  };

  const merge = (grid: number[][], piece: Piece) => {
    piece.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          grid[y + piece.y][x + piece.x] = value;
        }
      });
    });
  };

  const rotate = (matrix: number[][]) => {
    const N = matrix.length;
    const result = matrix.map((row, i) =>
      row.map((val, j) => matrix[N - 1 - j][i])
    );
    return result;
  };

  const playerDrop = () => {
    const state = stateRef.current;
    if (!state.piece) return;
    state.piece.y++;
    if (collide(state.grid, state.piece)) {
      state.piece.y--;
      merge(state.grid, state.piece);
      sweep();
      state.piece = createPiece();
      if (collide(state.grid, state.piece)) {
        setGameOver(true);
        setIsPlaying(false);
        playBeep(100, 0.8, 'sawtooth');
      }
    }
    state.dropCounter = 0;
  };

  const playerMove = (dir: number) => {
    const state = stateRef.current;
    if (!state.piece) return;
    state.piece.x += dir;
    if (collide(state.grid, state.piece)) {
      state.piece.x -= dir;
    } else {
      playBeep(200, 0.05, 'sine');
    }
  };

  const playerRotate = () => {
    const state = stateRef.current;
    if (!state.piece) return;
    const pos = state.piece.x;
    let offset = 1;
    state.piece.matrix = rotate(state.piece.matrix);
    while (collide(state.grid, state.piece)) {
      state.piece.x += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (offset > state.piece.matrix[0].length) {
        // Rotate back
        state.piece.matrix = rotate(rotate(rotate(state.piece.matrix)));
        state.piece.x = pos;
        return;
      }
    }
    playBeep(300, 0.05, 'triangle');
  };

  const sweep = () => {
    const state = stateRef.current;
    let rowCount = 1;
    let linesCleared = 0;
    outer: for (let y = state.grid.length - 1; y >= 0; --y) {
      for (let x = 0; x < state.grid[y].length; ++x) {
        if (state.grid[y][x] === 0) {
          continue outer;
        }
      }
      const row = state.grid.splice(y, 1)[0].fill(0);
      state.grid.unshift(row);
      ++y;
      linesCleared++;
      setScore(s => s + rowCount * 100);
      rowCount *= 2;
    }
    if (linesCleared > 0) {
      playBeep(600, 0.2, 'square');
      state.dropInterval = Math.max(100, 1000 - (score / 1000) * 100);
    }
  };

  const startGame = () => {
    stateRef.current = {
      grid: Array.from({ length: ROWS }, () => Array(COLS).fill(0)),
      piece: createPiece(),
      dropCounter: 0,
      dropInterval: 1000,
      lastTime: 0
    };
    setScore(0);
    setGameOver(false);
    setIsPlaying(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying) {
        if (e.key === 'Enter' || e.key === ' ') startGame();
        return;
      }
      switch (e.key) {
        case 'ArrowLeft': playerMove(-1); break;
        case 'ArrowRight': playerMove(1); break;
        case 'ArrowDown': playerDrop(); break;
        case 'ArrowUp': playerRotate(); break;
        case ' ': 
          // Hard drop
          const state = stateRef.current;
          if (state.piece) {
            while (!collide(state.grid, state.piece)) {
              state.piece.y++;
            }
            state.piece.y--;
            merge(state.grid, state.piece);
            sweep();
            state.piece = createPiece();
            playBeep(150, 0.1, 'sawtooth');
            if (collide(state.grid, state.piece)) {
              setGameOver(true);
              setIsPlaying(false);
            }
          }
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

    const drawMatrix = (matrix: number[][], offset: {x: number, y: number}) => {
      matrix.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            ctx.fillStyle = COLORS[value];
            ctx.shadowBlur = 10;
            ctx.shadowColor = COLORS[value];
            ctx.fillRect((x + offset.x) * BLOCK_SIZE, (y + offset.y) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
            
            // Inner highlight
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fillRect((x + offset.x) * BLOCK_SIZE, (y + offset.y) * BLOCK_SIZE, BLOCK_SIZE, 4);
            ctx.fillRect((x + offset.x) * BLOCK_SIZE, (y + offset.y) * BLOCK_SIZE, 4, BLOCK_SIZE);
            
            // Inner shadow
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect((x + offset.x) * BLOCK_SIZE, (y + offset.y) * BLOCK_SIZE + BLOCK_SIZE - 4, BLOCK_SIZE, 4);
            ctx.fillRect((x + offset.x) * BLOCK_SIZE + BLOCK_SIZE - 4, (y + offset.y) * BLOCK_SIZE, 4, BLOCK_SIZE);
          }
        });
      });
      ctx.shadowBlur = 0;
    };

    const gameLoop = (time: number = 0) => {
      if (!isPlaying || gameOver) return;

      const state = stateRef.current;
      const deltaTime = time - state.lastTime;
      state.lastTime = time;

      state.dropCounter += deltaTime;
      if (state.dropCounter > state.dropInterval) {
        playerDrop();
      }

      // Draw
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw Grid lines
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1;
      for (let i = 0; i <= COLS; i++) {
        ctx.beginPath(); ctx.moveTo(i * BLOCK_SIZE, 0); ctx.lineTo(i * BLOCK_SIZE, CANVAS_HEIGHT); ctx.stroke();
      }
      for (let i = 0; i <= ROWS; i++) {
        ctx.beginPath(); ctx.moveTo(0, i * BLOCK_SIZE); ctx.lineTo(CANVAS_WIDTH, i * BLOCK_SIZE); ctx.stroke();
      }

      drawMatrix(state.grid, { x: 0, y: 0 });
      if (state.piece) {
        drawMatrix(state.piece.matrix, { x: state.piece.x, y: state.piece.y });
      }

      reqRef.current = requestAnimationFrame(gameLoop);
    };

    if (isPlaying) {
      reqRef.current = requestAnimationFrame(gameLoop);
    } else {
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, [isPlaying, gameOver]);

  return (
    <div className="relative flex justify-center items-center h-full">
      <div className="absolute top-4 left-[-150px] font-arcade text-purple-400 text-xl z-10 w-32 text-right">
        SCORE<br/>{score}
      </div>
      
      {!isPlaying && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
          <h2 className="font-arcade text-5xl text-purple-400 mb-8 neon-text tracking-widest">TETRIS</h2>
          {gameOver && <p className="font-arcade text-red-500 mb-4 text-2xl">GAME OVER</p>}
          <div className="text-neutral-400 font-retro text-2xl mb-8 text-center">
            <p>ARROWS: Move & Rotate</p>
            <p>SPACE: Hard Drop</p>
          </div>
          <p className="font-arcade text-white animate-pulse cursor-pointer" onClick={startGame}>
            PRESS ENTER TO START
          </p>
        </div>
      )}

      <div className="border-4 border-neutral-800 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(168,85,247,0.2)]">
        <canvas 
          ref={canvasRef} 
          width={CANVAS_WIDTH} 
          height={CANVAS_HEIGHT}
          className="block focus:outline-none bg-black"
          tabIndex={0}
        />
      </div>
    </div>
  );
}
