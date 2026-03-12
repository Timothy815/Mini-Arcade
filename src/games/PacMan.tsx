import React, { useEffect, useRef, useState } from 'react';

import { Aggression } from '../App';

const CELL_SIZE = 24;
const COLS = 21;
const ROWS = 21;
const CANVAS_WIDTH = COLS * CELL_SIZE;
const CANVAS_HEIGHT = ROWS * CELL_SIZE;

// 1: Wall, 0: Dot, 2: Empty, 3: Power Pellet, 4: Ghost Gate
const INITIAL_MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  [1,3,1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,3,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,0,1,1,1,1,1,0,1,0,1,1,1,0,1],
  [1,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,1],
  [1,1,1,1,1,0,1,1,1,2,1,2,1,1,1,0,1,1,1,1,1],
  [2,2,2,2,1,0,1,2,2,2,2,2,2,2,1,0,1,2,2,2,2],
  [1,1,1,1,1,0,1,2,1,1,4,1,1,2,1,0,1,1,1,1,1],
  [2,2,2,2,2,0,2,2,1,2,2,2,1,2,2,0,2,2,2,2,2],
  [1,1,1,1,1,0,1,2,1,1,1,1,1,2,1,0,1,1,1,1,1],
  [2,2,2,2,1,0,1,2,2,2,2,2,2,2,1,0,1,2,2,2,2],
  [1,1,1,1,1,0,1,2,1,1,1,1,1,2,1,0,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,0,1],
  [1,3,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,3,1],
  [1,1,1,0,1,0,1,0,1,1,1,1,1,0,1,0,1,0,1,1,1],
  [1,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,1],
  [1,0,1,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

type Point = { x: number, y: number };
type Ghost = { x: number, y: number, color: string, dir: Point, mode: 'chase' | 'frightened' | 'eaten', startX: number, startY: number };

export function PacMan({ aggression = 'NORMAL' }: { aggression?: Aggression }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);

  const stateRef = useRef({
    map: [] as number[][],
    pacman: { x: 10, y: 15, dir: { x: 0, y: 0 }, nextDir: { x: 0, y: 0 }, animPhase: 0 },
    ghosts: [] as Ghost[],
    keys: { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false },
    frightenedTimer: 0,
    dotsRemaining: 0
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

  const startGame = () => {
    const newMap = INITIAL_MAP.map(row => [...row]);
    let dots = 0;
    newMap.forEach(row => row.forEach(cell => { if (cell === 0 || cell === 3) dots++; }));

    stateRef.current = {
      map: newMap,
      pacman: { x: 10, y: 15, dir: { x: -1, y: 0 }, nextDir: { x: -1, y: 0 }, animPhase: 0 },
      ghosts: [
        { x: 10, y: 9, color: '#ef4444', dir: { x: 1, y: 0 }, mode: 'chase', startX: 10, startY: 9 }, // Blinky
        { x: 9, y: 9, color: '#f472b6', dir: { x: -1, y: 0 }, mode: 'chase', startX: 9, startY: 9 }, // Pinky
        { x: 11, y: 9, color: '#38bdf8', dir: { x: 1, y: 0 }, mode: 'chase', startX: 11, startY: 9 }, // Inky
        { x: 10, y: 8, color: '#fb923c', dir: { x: -1, y: 0 }, mode: 'chase', startX: 10, startY: 8 }, // Clyde
      ],
      keys: { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false },
      frightenedTimer: 0,
      dotsRemaining: dots
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
      const state = stateRef.current;
      switch (e.key) {
        case 'ArrowUp': state.pacman.nextDir = { x: 0, y: -1 }; e.preventDefault(); break;
        case 'ArrowDown': state.pacman.nextDir = { x: 0, y: 1 }; e.preventDefault(); break;
        case 'ArrowLeft': state.pacman.nextDir = { x: -1, y: 0 }; e.preventDefault(); break;
        case 'ArrowRight': state.pacman.nextDir = { x: 1, y: 0 }; e.preventDefault(); break;
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

    const isValidMove = (x: number, y: number) => {
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true; // Wrap around
      return stateRef.current.map[y][x] !== 1 && stateRef.current.map[y][x] !== 4;
    };

    const wrap = (val: number, max: number) => ((val % max) + max) % max;

    const gameLoop = (time: number) => {
      if (!isPlaying || gameOver || won) return;

      reqRef.current = requestAnimationFrame(gameLoop);

      // Tick rate for grid movement
      if (time - lastTickRef.current < 150) return;
      lastTickRef.current = time;

      const state = stateRef.current;
      const { pacman, ghosts, map } = state;

      // Pacman Movement
      let nextX = wrap(pacman.x + pacman.nextDir.x, COLS);
      let nextY = wrap(pacman.y + pacman.nextDir.y, ROWS);
      
      if (isValidMove(nextX, nextY)) {
        pacman.dir = { ...pacman.nextDir };
        pacman.x = nextX;
        pacman.y = nextY;
      } else {
        nextX = wrap(pacman.x + pacman.dir.x, COLS);
        nextY = wrap(pacman.y + pacman.dir.y, ROWS);
        if (isValidMove(nextX, nextY)) {
          pacman.x = nextX;
          pacman.y = nextY;
        }
      }
      pacman.animPhase = (pacman.animPhase + 1) % 2;

      // Eat dots
      const cell = map[pacman.y][pacman.x];
      if (cell === 0) {
        map[pacman.y][pacman.x] = 2;
        setScore(s => s + 10);
        state.dotsRemaining--;
        playBeep(600, 0.05, 'triangle');
      } else if (cell === 3) {
        map[pacman.y][pacman.x] = 2;
        setScore(s => s + 50);
        state.dotsRemaining--;
        state.frightenedTimer = 40; // 40 ticks
        ghosts.forEach(g => {
          if (g.mode !== 'eaten') g.mode = 'frightened';
          // Reverse direction
          g.dir = { x: -g.dir.x, y: -g.dir.y };
        });
        playBeep(400, 0.3, 'square');
      }

      if (state.dotsRemaining === 0) {
        setWon(true);
        setIsPlaying(false);
        playBeep(800, 0.5, 'sine');
        return;
      }

      // Frightened timer
      if (state.frightenedTimer > 0) {
        state.frightenedTimer--;
        if (state.frightenedTimer === 0) {
          ghosts.forEach(g => { if (g.mode === 'frightened') g.mode = 'chase'; });
        }
      }

      // Ghost Movement
      ghosts.forEach(g => {
        if (g.mode === 'eaten') {
          // Move towards start
          if (g.x < g.startX) g.x++; else if (g.x > g.startX) g.x--;
          else if (g.y < g.startY) g.y++; else if (g.y > g.startY) g.y--;
          else g.mode = 'chase';
          return;
        }

        const possibleMoves = [
          { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }
        ].filter(m => {
          // Don't reverse direction unless stuck
          if (m.x === -g.dir.x && m.y === -g.dir.y) return false;
          return isValidMove(wrap(g.x + m.x, COLS), wrap(g.y + m.y, ROWS));
        });

        if (possibleMoves.length === 0) {
          // Dead end, reverse
          g.dir = { x: -g.dir.x, y: -g.dir.y };
        } else {
          // Aggression based AI
          const chaseChance = {
            MILD: 0.2,
            NORMAL: 0.5,
            BRUTAL: 0.8
          }[aggression];

          if (Math.random() < chaseChance && g.mode === 'chase') {
            // Pick move that gets closest to Pacman
            possibleMoves.sort((a, b) => {
              const distA = Math.hypot(wrap(g.x + a.x, COLS) - pacman.x, wrap(g.y + a.y, ROWS) - pacman.y);
              const distB = Math.hypot(wrap(g.x + b.x, COLS) - pacman.x, wrap(g.y + b.y, ROWS) - pacman.y);
              return distA - distB;
            });
            g.dir = possibleMoves[0];
          } else {
            g.dir = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
          }
        }

        g.x = wrap(g.x + g.dir.x, COLS);
        g.y = wrap(g.y + g.dir.y, ROWS);

        // Collision with Pacman
        if (g.x === pacman.x && g.y === pacman.y) {
          if (g.mode === 'frightened') {
            g.mode = 'eaten';
            setScore(s => s + 200);
            playBeep(800, 0.1, 'square');
          } else if (g.mode === 'chase') {
            setGameOver(true);
            setIsPlaying(false);
            playBeep(100, 0.8, 'sawtooth');
          }
        }
      });

      // Draw
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw Map
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const cell = map[y][x];
          if (cell === 1) {
            ctx.fillStyle = '#1e3a8a'; // blue-900
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#3b82f6';
            ctx.fillRect(x * CELL_SIZE + 2, y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
            ctx.shadowBlur = 0;
          } else if (cell === 4) {
            ctx.fillStyle = '#f472b6'; // pink-400 (gate)
            ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE + CELL_SIZE/2 - 2, CELL_SIZE, 4);
          } else if (cell === 0) {
            ctx.fillStyle = '#fef08a'; // yellow-200
            ctx.beginPath();
            ctx.arc(x * CELL_SIZE + CELL_SIZE/2, y * CELL_SIZE + CELL_SIZE/2, 3, 0, Math.PI*2);
            ctx.fill();
          } else if (cell === 3) {
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(x * CELL_SIZE + CELL_SIZE/2, y * CELL_SIZE + CELL_SIZE/2, 8, 0, Math.PI*2);
            ctx.fill();
          }
        }
      }

      // Draw Pacman
      ctx.fillStyle = '#eab308'; // yellow-500
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#eab308';
      ctx.beginPath();
      const px = pacman.x * CELL_SIZE + CELL_SIZE/2;
      const py = pacman.y * CELL_SIZE + CELL_SIZE/2;
      
      let angleOffset = 0;
      if (pacman.dir.x === 1) angleOffset = 0;
      else if (pacman.dir.x === -1) angleOffset = Math.PI;
      else if (pacman.dir.y === 1) angleOffset = Math.PI/2;
      else if (pacman.dir.y === -1) angleOffset = -Math.PI/2;

      const mouthOpen = pacman.animPhase === 0 ? 0.2 : 0.01;
      ctx.arc(px, py, CELL_SIZE/2 - 2, angleOffset + mouthOpen * Math.PI, angleOffset + (2 - mouthOpen) * Math.PI);
      ctx.lineTo(px, py);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw Ghosts
      ghosts.forEach(g => {
        const gx = g.x * CELL_SIZE + CELL_SIZE/2;
        const gy = g.y * CELL_SIZE + CELL_SIZE/2;
        
        if (g.mode === 'eaten') {
          // Draw eyes only
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(gx - 4, gy - 2, 3, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(gx + 4, gy - 2, 3, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#2563eb';
          ctx.beginPath(); ctx.arc(gx - 4 + g.dir.x*2, gy - 2 + g.dir.y*2, 1.5, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(gx + 4 + g.dir.x*2, gy - 2 + g.dir.y*2, 1.5, 0, Math.PI*2); ctx.fill();
          return;
        }

        ctx.fillStyle = g.mode === 'frightened' ? (state.frightenedTimer < 10 && state.frightenedTimer % 2 === 0 ? '#fff' : '#1d4ed8') : g.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = ctx.fillStyle;
        
        ctx.beginPath();
        ctx.arc(gx, gy, CELL_SIZE/2 - 2, Math.PI, 0);
        ctx.lineTo(gx + CELL_SIZE/2 - 2, gy + CELL_SIZE/2 - 2);
        
        // Wavy bottom
        ctx.lineTo(gx + CELL_SIZE/4, gy + CELL_SIZE/4);
        ctx.lineTo(gx, gy + CELL_SIZE/2 - 2);
        ctx.lineTo(gx - CELL_SIZE/4, gy + CELL_SIZE/4);
        ctx.lineTo(gx - CELL_SIZE/2 + 2, gy + CELL_SIZE/2 - 2);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        // Eyes
        if (g.mode !== 'frightened') {
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(gx - 4, gy - 2, 3, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(gx + 4, gy - 2, 3, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#2563eb';
          ctx.beginPath(); ctx.arc(gx - 4 + g.dir.x*2, gy - 2 + g.dir.y*2, 1.5, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(gx + 4 + g.dir.x*2, gy - 2 + g.dir.y*2, 1.5, 0, Math.PI*2); ctx.fill();
        } else {
          ctx.fillStyle = '#fba11b';
          ctx.beginPath(); ctx.arc(gx - 4, gy, 2, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(gx + 4, gy, 2, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = '#fba11b';
          ctx.beginPath(); ctx.moveTo(gx - 6, gy + 6); ctx.lineTo(gx - 2, gy + 4); ctx.lineTo(gx + 2, gy + 6); ctx.lineTo(gx + 6, gy + 4); ctx.stroke();
        }
      });

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
      <div className="absolute top-[-40px] left-0 right-0 flex justify-between font-arcade text-yellow-400 text-xl z-10">
        <span>SCORE: {score}</span>
      </div>
      
      {!isPlaying && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
          <h2 className="font-arcade text-5xl text-yellow-400 mb-8 neon-text tracking-widest">PAC-MAN</h2>
          {gameOver && <p className="font-arcade text-red-500 mb-4 text-2xl">GAME OVER</p>}
          {won && <p className="font-arcade text-green-400 mb-4 text-2xl">YOU WIN!</p>}
          <div className="text-neutral-400 font-retro text-2xl mb-8 text-center">
            <p>ARROWS: Move</p>
            <p>Eat all dots to win</p>
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
