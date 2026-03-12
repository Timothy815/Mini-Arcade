import React, { useEffect, useRef, useState } from 'react';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PADDLE_WIDTH = 100;
const PADDLE_HEIGHT = 15;
const BALL_RADIUS = 6;
const BRICK_ROWS = 6;
const BRICK_COLS = 10;
const BRICK_WIDTH = 65;
const BRICK_HEIGHT = 20;
const BRICK_PADDING = 10;
const BRICK_OFFSET_TOP = 60;
const BRICK_OFFSET_LEFT = 35;

type Brick = { x: number, y: number, active: boolean, color: string, value: number };
type Particle = { x: number, y: number, vx: number, vy: number, life: number, maxLife: number, color: string };
type Point = { x: number, y: number };

export function BrickBreaker() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [shake, setShake] = useState(0);

  const stateRef = useRef({
    paddle: { x: CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2, y: CANVAS_HEIGHT - 30, width: PADDLE_WIDTH, height: PADDLE_HEIGHT, dx: 8 },
    ball: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 40, dx: 4, dy: -4, radius: BALL_RADIUS, active: false },
    bricks: [] as Brick[],
    trail: [] as Point[],
    particles: [] as Particle[],
    keys: { ArrowLeft: false, ArrowRight: false, ' ': false }
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

  const initBricks = () => {
    const bricks: Brick[] = [];
    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'];
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        bricks.push({
          x: c * (BRICK_WIDTH + BRICK_PADDING) + BRICK_OFFSET_LEFT,
          y: r * (BRICK_HEIGHT + BRICK_PADDING) + BRICK_OFFSET_TOP,
          active: true,
          color: colors[r % colors.length],
          value: (BRICK_ROWS - r) * 10
        });
      }
    }
    return bricks;
  };

  const startGame = () => {
    stateRef.current = {
      paddle: { x: CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2, y: CANVAS_HEIGHT - 30, width: PADDLE_WIDTH, height: PADDLE_HEIGHT, dx: 8 },
      ball: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 40, dx: 5, dy: -5, radius: BALL_RADIUS, active: true },
      bricks: initBricks(),
      trail: [],
      particles: [],
      keys: { ArrowLeft: false, ArrowRight: false, ' ': false }
    };
    setScore(0);
    setLives(3);
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

    const gameLoop = () => {
      if (!isPlaying || gameOver || won) return;

      const state = stateRef.current;
      const { paddle, ball, bricks, keys } = state;

      // Move paddle
      if (keys.ArrowLeft && paddle.x > 0) paddle.x -= paddle.dx;
      if (keys.ArrowRight && paddle.x + paddle.width < CANVAS_WIDTH) paddle.x += paddle.dx;

      if (ball.active) {
        // Move ball
        ball.x += ball.dx;
        ball.y += ball.dy;

        // Update trail
        state.trail.push({ x: ball.x, y: ball.y });
        if (state.trail.length > 10) state.trail.shift();

        // Update particles
        for (let i = state.particles.length - 1; i >= 0; i--) {
          const p = state.particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.1; // gravity
          p.life--;
          if (p.life <= 0) state.particles.splice(i, 1);
        }

        // Wall collisions
        if (ball.x + ball.radius > CANVAS_WIDTH || ball.x - ball.radius < 0) {
          ball.dx = -ball.dx;
          ball.x = ball.x - ball.radius < 0 ? ball.radius : CANVAS_WIDTH - ball.radius;
          playBeep(300, 0.05, 'sine');
        }
        if (ball.y - ball.radius < 0) {
          ball.dy = -ball.dy;
          ball.y = ball.radius;
          playBeep(300, 0.05, 'sine');
        }

        // Paddle collision
        if (
          ball.y + ball.radius > paddle.y &&
          ball.y - ball.radius < paddle.y + paddle.height &&
          ball.x + ball.radius > paddle.x &&
          ball.x - ball.radius < paddle.x + paddle.width
        ) {
          ball.dy = -Math.abs(ball.dy);
          ball.y = paddle.y - ball.radius;
          // Add some english based on where it hit the paddle
          const hitPoint = ball.x - (paddle.x + paddle.width / 2);
          ball.dx = hitPoint * 0.15;
          // Normalize speed
          const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
          const targetSpeed = 7;
          ball.dx = (ball.dx / speed) * targetSpeed;
          ball.dy = (ball.dy / speed) * targetSpeed;
          
          playBeep(400, 0.1, 'square');
          setShake(3);

          // Paddle hit particles
          for (let i = 0; i < 10; i++) {
            state.particles.push({
              x: ball.x,
              y: ball.y,
              vx: (Math.random() - 0.5) * 4 + ball.dx * 0.5,
              vy: -Math.random() * 4 - 2,
              life: 10 + Math.random() * 10,
              maxLife: 20,
              color: '#38bdf8'
            });
          }
        }

        // Brick collision
        let hitBrick = false;
        for (let i = 0; i < bricks.length; i++) {
          const b = bricks[i];
          if (b.active) {
            if (
              ball.x + ball.radius > b.x &&
              ball.x - ball.radius < b.x + BRICK_WIDTH &&
              ball.y + ball.radius > b.y &&
              ball.y - ball.radius < b.y + BRICK_HEIGHT
            ) {
              ball.dy = -ball.dy;
              b.active = false;
              setScore(s => s + b.value);
              hitBrick = true;
              playBeep(600 + b.value * 5, 0.1, 'sawtooth');
              setShake(5);

              // Brick explosion particles
              for (let j = 0; j < 15; j++) {
                state.particles.push({
                  x: b.x + BRICK_WIDTH / 2,
                  y: b.y + BRICK_HEIGHT / 2,
                  vx: (Math.random() - 0.5) * 8,
                  vy: (Math.random() - 0.5) * 8,
                  life: 20 + Math.random() * 20,
                  maxLife: 40,
                  color: b.color
                });
              }
              break; // Only hit one brick per frame
            }
          }
        }

        // Check win
        if (hitBrick && bricks.every(b => !b.active)) {
          setWon(true);
          setIsPlaying(false);
          playBeep(800, 0.5, 'sine');
        }

        // Lose life
        if (ball.y + ball.radius > CANVAS_HEIGHT) {
          setShake(15);
          setLives(l => {
            const newLives = l - 1;
            if (newLives <= 0) {
              setGameOver(true);
              setIsPlaying(false);
              playBeep(100, 0.8, 'sawtooth');
            } else {
              // Reset ball
              ball.x = CANVAS_WIDTH / 2;
              ball.y = CANVAS_HEIGHT - 40;
              ball.dx = 5 * (Math.random() > 0.5 ? 1 : -1);
              ball.dy = -5;
              paddle.x = CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2;
              state.trail = [];
              playBeep(200, 0.3, 'square');
            }
            return newLives;
          });
        }
      }

      // Handle Shake
      setShake(s => s > 0 ? s - 1 : 0);
      ctx.save();
      if (shake > 0) {
        const dx = (Math.random() - 0.5) * shake;
        const dy = (Math.random() - 0.5) * shake;
        ctx.translate(dx, dy);
      }

      // Draw
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw Background Grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
      ctx.lineWidth = 1;
      const timeOffset = (Date.now() / 50) % 40;
      for (let i = 0; i < CANVAS_WIDTH; i += 40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CANVAS_HEIGHT); ctx.stroke();
      }
      for (let i = -40; i < CANVAS_HEIGHT; i += 40) {
        ctx.beginPath(); ctx.moveTo(0, i + timeOffset); ctx.lineTo(CANVAS_WIDTH, i + timeOffset); ctx.stroke();
      }

      // Draw Trail
      if (state.trail.length > 0) {
        ctx.beginPath();
        ctx.moveTo(state.trail[0].x, state.trail[0].y);
        for (let i = 1; i < state.trail.length; i++) {
          ctx.lineTo(state.trail[i].x, state.trail[i].y);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = ball.radius * 1.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }

      // Draw Particles
      state.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // Draw Bricks
      bricks.forEach(b => {
        if (!b.active) return;
        ctx.fillStyle = b.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = b.color;
        ctx.fillRect(b.x, b.y, BRICK_WIDTH, BRICK_HEIGHT);
        
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(b.x, b.y, BRICK_WIDTH, 4);
        ctx.fillRect(b.x, b.y, 4, BRICK_HEIGHT);
      });
      ctx.shadowBlur = 0;

      // Draw Paddle
      ctx.fillStyle = '#38bdf8';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#38bdf8';
      ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(paddle.x, paddle.y, paddle.width, 4);
      ctx.shadowBlur = 0;

      // Draw Ball
      if (ball.active) {
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#fff';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      
      ctx.restore();

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
  }, [isPlaying, gameOver, won, shake]);

  return (
    <div className="relative">
      <div className="absolute top-4 left-4 font-arcade text-sky-400 text-xl z-10">
        SCORE: {score}
      </div>
      <div className="absolute top-4 right-4 font-arcade text-red-500 text-xl z-10">
        LIVES: {lives}
      </div>
      
      {!isPlaying && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
          <h2 className="font-arcade text-5xl text-sky-400 mb-8 neon-text tracking-widest text-center leading-tight">BRICK<br/>BREAKER</h2>
          {gameOver && <p className="font-arcade text-red-500 mb-4 text-2xl">GAME OVER</p>}
          {won && <p className="font-arcade text-green-400 mb-4 text-2xl">YOU WIN!</p>}
          <div className="text-neutral-400 font-retro text-2xl mb-8 text-center">
            <p>LEFT/RIGHT: Move Paddle</p>
            <p>Break all the bricks!</p>
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
