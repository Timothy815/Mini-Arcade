import React, { useEffect, useRef, useState } from 'react';

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 800;
const GRID_SIZE = 8;
const CELL_SIZE = 45;
const GRID_OFFSET_X = (CANVAS_WIDTH - (GRID_SIZE * CELL_SIZE)) / 2;
const GRID_OFFSET_Y = 100;

type Point = { x: number, y: number };
type ShapeDef = { blocks: Point[], color: string };

const SHAPES: ShapeDef[] = [
  { blocks: [{x:0,y:0}], color: '#ef4444' }, // 1x1
  { blocks: [{x:0,y:0}, {x:1,y:0}], color: '#f97316' }, // 2x1
  { blocks: [{x:0,y:0}, {x:0,y:1}], color: '#f97316' }, // 1x2
  { blocks: [{x:0,y:0}, {x:1,y:0}, {x:2,y:0}], color: '#eab308' }, // 3x1
  { blocks: [{x:0,y:0}, {x:0,y:1}, {x:0,y:2}], color: '#eab308' }, // 1x3
  { blocks: [{x:0,y:0}, {x:1,y:0}, {x:0,y:1}, {x:1,y:1}], color: '#22c55e' }, // 2x2
  { blocks: [{x:0,y:0}, {x:1,y:0}, {x:2,y:0}, {x:1,y:1}], color: '#a855f7' }, // T
  { blocks: [{x:0,y:0}, {x:0,y:1}, {x:0,y:2}, {x:1,y:2}], color: '#3b82f6' }, // L
  { blocks: [{x:0,y:0}, {x:1,y:0}, {x:2,y:0}, {x:3,y:0}], color: '#06b6d4' }, // 4x1
];

export function BlockBlast() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const stateRef = useRef({
    grid: Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill('')),
    availableShapes: [] as (ShapeDef | null)[],
    draggingIdx: -1,
    mouseX: 0,
    mouseY: 0,
    dragOffsetX: 0,
    dragOffsetY: 0
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

  const generateShapes = () => {
    return Array(3).fill(null).map(() => SHAPES[Math.floor(Math.random() * SHAPES.length)]);
  };

  const checkGameOver = (grid: string[][], shapes: (ShapeDef | null)[]) => {
    const activeShapes = shapes.filter(s => s !== null) as ShapeDef[];
    if (activeShapes.length === 0) return false;

    for (const shape of activeShapes) {
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          let canFit = true;
          for (const block of shape.blocks) {
            const bx = x + block.x;
            const by = y + block.y;
            if (bx >= GRID_SIZE || by >= GRID_SIZE || grid[by][bx] !== '') {
              canFit = false;
              break;
            }
          }
          if (canFit) return false;
        }
      }
    }
    return true;
  };

  const startGame = () => {
    stateRef.current = {
      grid: Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill('')),
      availableShapes: generateShapes(),
      draggingIdx: -1,
      mouseX: 0,
      mouseY: 0,
      dragOffsetX: 0,
      dragOffsetY: 0
    };
    setScore(0);
    setGameOver(false);
    setIsPlaying(true);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getMousePos = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    const handleDown = (e: MouseEvent | TouchEvent) => {
      if (!isPlaying || gameOver) return;
      const pos = getMousePos(e);
      const state = stateRef.current;
      
      // Check if clicking on a shape
      state.availableShapes.forEach((shape, idx) => {
        if (!shape) return;
        const shapeX = 100 + idx * 180;
        const shapeY = 600;
        
        // Simple bounding box check for the shape
        let minX = 0, maxX = 0, minY = 0, maxY = 0;
        shape.blocks.forEach(b => {
          minX = Math.min(minX, b.x); maxX = Math.max(maxX, b.x);
          minY = Math.min(minY, b.y); maxY = Math.max(maxY, b.y);
        });
        
        const w = (maxX - minX + 1) * CELL_SIZE;
        const h = (maxY - minY + 1) * CELL_SIZE;
        
        if (pos.x >= shapeX && pos.x <= shapeX + w && pos.y >= shapeY && pos.y <= shapeY + h) {
          state.draggingIdx = idx;
          state.dragOffsetX = pos.x - shapeX;
          state.dragOffsetY = pos.y - shapeY;
          state.mouseX = pos.x;
          state.mouseY = pos.y;
        }
      });
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (stateRef.current.draggingIdx === -1) return;
      e.preventDefault();
      const pos = getMousePos(e);
      stateRef.current.mouseX = pos.x;
      stateRef.current.mouseY = pos.y;
    };

    const handleUp = () => {
      const state = stateRef.current;
      if (state.draggingIdx === -1) return;

      const shape = state.availableShapes[state.draggingIdx];
      if (shape) {
        // Calculate grid position
        const dropX = state.mouseX - state.dragOffsetX;
        const dropY = state.mouseY - state.dragOffsetY;
        
        const gridX = Math.round((dropX - GRID_OFFSET_X) / CELL_SIZE);
        const gridY = Math.round((dropY - GRID_OFFSET_Y) / CELL_SIZE);

        // Check if valid placement
        let valid = true;
        for (const block of shape.blocks) {
          const bx = gridX + block.x;
          const by = gridY + block.y;
          if (bx < 0 || bx >= GRID_SIZE || by < 0 || by >= GRID_SIZE || state.grid[by][bx] !== '') {
            valid = false;
            break;
          }
        }

        if (valid) {
          // Place shape
          shape.blocks.forEach(block => {
            state.grid[gridY + block.y][gridX + block.x] = shape.color;
          });
          
          state.availableShapes[state.draggingIdx] = null;
          setScore(s => s + shape.blocks.length * 10);
          playBeep(400, 0.1, 'sine');

          // Check for cleared lines
          let linesCleared = 0;
          const rowsToClear: number[] = [];
          const colsToClear: number[] = [];

          for (let y = 0; y < GRID_SIZE; y++) {
            if (state.grid[y].every(cell => cell !== '')) rowsToClear.push(y);
          }
          for (let x = 0; x < GRID_SIZE; x++) {
            if (state.grid.every(row => row[x] !== '')) colsToClear.push(x);
          }

          rowsToClear.forEach(y => {
            state.grid[y] = Array(GRID_SIZE).fill('');
            linesCleared++;
          });
          colsToClear.forEach(x => {
            for (let y = 0; y < GRID_SIZE; y++) state.grid[y][x] = '';
            linesCleared++;
          });

          if (linesCleared > 0) {
            setScore(s => s + linesCleared * 100);
            playBeep(600, 0.3, 'square');
          }

          // Refill shapes if all used
          if (state.availableShapes.every(s => s === null)) {
            state.availableShapes = generateShapes();
          }

          // Check game over
          if (checkGameOver(state.grid, state.availableShapes)) {
            setGameOver(true);
            setIsPlaying(false);
            playBeep(150, 0.8, 'sawtooth');
          }
        } else {
          playBeep(200, 0.1, 'sawtooth'); // Invalid placement
        }
      }

      state.draggingIdx = -1;
    };

    canvas.addEventListener('mousedown', handleDown);
    canvas.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    canvas.addEventListener('touchstart', handleDown, { passive: false });
    canvas.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);

    return () => {
      canvas.removeEventListener('mousedown', handleDown);
      canvas.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      canvas.removeEventListener('touchstart', handleDown);
      canvas.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isPlaying, gameOver]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawBlock = (x: number, y: number, color: string, isGhost = false) => {
      ctx.fillStyle = color;
      ctx.globalAlpha = isGhost ? 0.5 : 1.0;
      ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
      
      // Retro highlight/shadow
      if (!isGhost) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, 4);
        ctx.fillRect(x + 1, y + 1, 4, CELL_SIZE - 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x + 1, y + CELL_SIZE - 5, CELL_SIZE - 2, 4);
        ctx.fillRect(x + CELL_SIZE - 5, y + 1, 4, CELL_SIZE - 2);
      }
      ctx.globalAlpha = 1.0;
    };

    const gameLoop = () => {
      if (!isPlaying) return;

      const state = stateRef.current;

      // Draw background
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw Grid Background
      ctx.fillStyle = '#111';
      ctx.fillRect(GRID_OFFSET_X, GRID_OFFSET_Y, GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE);
      
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2;
      for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(GRID_OFFSET_X + i * CELL_SIZE, GRID_OFFSET_Y);
        ctx.lineTo(GRID_OFFSET_X + i * CELL_SIZE, GRID_OFFSET_Y + GRID_SIZE * CELL_SIZE);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(GRID_OFFSET_X, GRID_OFFSET_Y + i * CELL_SIZE);
        ctx.lineTo(GRID_OFFSET_X + GRID_SIZE * CELL_SIZE, GRID_OFFSET_Y + i * CELL_SIZE);
        ctx.stroke();
      }

      // Draw placed blocks
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          if (state.grid[y][x] !== '') {
            drawBlock(GRID_OFFSET_X + x * CELL_SIZE, GRID_OFFSET_Y + y * CELL_SIZE, state.grid[y][x]);
          }
        }
      }

      // Draw available shapes
      state.availableShapes.forEach((shape, idx) => {
        if (!shape || state.draggingIdx === idx) return;
        const startX = 100 + idx * 180;
        const startY = 600;
        shape.blocks.forEach(b => {
          drawBlock(startX + b.x * CELL_SIZE, startY + b.y * CELL_SIZE, shape.color);
        });
      });

      // Draw dragging shape
      if (state.draggingIdx !== -1) {
        const shape = state.availableShapes[state.draggingIdx];
        if (shape) {
          const drawX = state.mouseX - state.dragOffsetX;
          const drawY = state.mouseY - state.dragOffsetY;
          
          // Draw ghost
          const gridX = Math.round((drawX - GRID_OFFSET_X) / CELL_SIZE);
          const gridY = Math.round((drawY - GRID_OFFSET_Y) / CELL_SIZE);
          
          let valid = true;
          for (const block of shape.blocks) {
            const bx = gridX + block.x;
            const by = gridY + block.y;
            if (bx < 0 || bx >= GRID_SIZE || by < 0 || by >= GRID_SIZE || state.grid[by][bx] !== '') {
              valid = false;
              break;
            }
          }

          if (valid) {
            shape.blocks.forEach(b => {
              drawBlock(GRID_OFFSET_X + (gridX + b.x) * CELL_SIZE, GRID_OFFSET_Y + (gridY + b.y) * CELL_SIZE, shape.color, true);
            });
          }

          // Draw actual dragging shape
          shape.blocks.forEach(b => {
            drawBlock(drawX + b.x * CELL_SIZE, drawY + b.y * CELL_SIZE, shape.color);
          });
        }
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
  }, [isPlaying]);

  return (
    <div className="relative">
      <div className="absolute top-4 left-0 right-0 text-center font-arcade text-yellow-400 text-2xl z-10 pointer-events-none">
        SCORE: {score}
      </div>
      
      {!isPlaying && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
          <h2 className="font-arcade text-5xl text-yellow-400 mb-8 neon-text text-center leading-tight">BLOCK<br/>BLAST</h2>
          {gameOver && <p className="font-arcade text-red-500 mb-4 text-2xl">NO MOVES LEFT</p>}
          <div className="text-neutral-400 font-retro text-2xl mb-8 text-center">
            <p>Drag and drop shapes</p>
            <p>Fill rows or columns to clear</p>
          </div>
          <button 
            className="font-arcade text-white animate-pulse cursor-pointer bg-transparent border-none outline-none"
            onClick={startGame}
          >
            CLICK TO START
          </button>
        </div>
      )}

      <canvas 
        ref={canvasRef} 
        width={CANVAS_WIDTH} 
        height={CANVAS_HEIGHT}
        className="block focus:outline-none cursor-crosshair touch-none"
        tabIndex={0}
      />
    </div>
  );
}
