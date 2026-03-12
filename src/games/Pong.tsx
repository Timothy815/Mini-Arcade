import React, { useEffect, useRef, useState } from 'react';

import { Aggression } from '../App';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;
const PADDLE_WIDTH = 15;
const PADDLE_HEIGHT = 80;
const BALL_SIZE = 12;
const PADDLE_SPEED = 8;
const INITIAL_BALL_SPEED = 6;

type Particle = { x: number, y: number, vx: number, vy: number, life: number, maxLife: number, color: string };
type Point = { x: number, y: number };

export function Pong({ aggression = 'NORMAL' }: { aggression?: Aggression }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState({ p1: 0, p2: 0 });
  const [shake, setShake] = useState(0);

  const stateRef = useRef({
    p1Y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
    p2Y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
    ballX: CANVAS_WIDTH / 2,
    ballY: CANVAS_HEIGHT / 2,
    ballVX: INITIAL_BALL_SPEED,
    ballVY: INITIAL_BALL_SPEED,
    trail: [] as Point[],
    particles: [] as Particle[],
    keys: { w: false, s: false, ArrowUp: false, ArrowDown: false }
  });

  const reqRef = useRef<number>();

  const resetBall = () => {
    stateRef.current.ballX = CANVAS_WIDTH / 2;
    stateRef.current.ballY = CANVAS_HEIGHT / 2;
    stateRef.current.ballVX = (Math.random() > 0.5 ? 1 : -1) * INITIAL_BALL_SPEED;
    stateRef.current.ballVY = (Math.random() * 2 - 1) * INITIAL_BALL_SPEED;
    stateRef.current.trail = [];
  };

  const startGame = () => {
    setScore({ p1: 0, p2: 0 });
    stateRef.current.particles = [];
    resetBall();
    setIsPlaying(true);
  };

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

    const gameLoop = () => {
      if (!isPlaying) return;

      const state = stateRef.current;

      // Move paddles
      if (state.keys.w && state.p1Y > 0) state.p1Y -= PADDLE_SPEED;
      if (state.keys.s && state.p1Y < CANVAS_HEIGHT - PADDLE_HEIGHT) state.p1Y += PADDLE_SPEED;
      
      if (state.keys.ArrowUp && state.p2Y > 0) {
        state.p2Y -= PADDLE_SPEED;
      } else if (state.keys.ArrowDown && state.p2Y < CANVAS_HEIGHT - PADDLE_HEIGHT) {
        state.p2Y += PADDLE_SPEED;
      } else {
        // AI Control for P2
        const aiSpeed = {
          MILD: 3,
          NORMAL: 5,
          BRUTAL: 8
        }[aggression];
        
        const targetY = state.ballY - PADDLE_HEIGHT / 2;
        if (state.p2Y < targetY - 10) state.p2Y += aiSpeed;
        else if (state.p2Y > targetY + 10) state.p2Y -= aiSpeed;
      }

      // Move ball
      state.ballX += state.ballVX;
      state.ballY += state.ballVY;

      // Update trail
      state.trail.push({ x: state.ballX, y: state.ballY });
      if (state.trail.length > 15) state.trail.shift();

      // Update particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) state.particles.splice(i, 1);
      }

      // Wall collision (top/bottom)
      if (state.ballY <= 0 || state.ballY >= CANVAS_HEIGHT - BALL_SIZE) {
        state.ballVY *= -1;
        state.ballY = state.ballY <= 0 ? 0 : CANVAS_HEIGHT - BALL_SIZE;
        playBeep(220, 0.1);
        
        // Wall hit particles
        for (let i = 0; i < 10; i++) {
          state.particles.push({
            x: state.ballX + BALL_SIZE / 2,
            y: state.ballY <= 0 ? 0 : CANVAS_HEIGHT,
            vx: (Math.random() - 0.5) * 6,
            vy: (state.ballY <= 0 ? 1 : -1) * (Math.random() * 4 + 1),
            life: 15 + Math.random() * 15,
            maxLife: 30,
            color: '#fff'
          });
        }
      }

      // Paddle collision
      const hitP1 = state.ballX <= PADDLE_WIDTH + 20 && state.ballX + BALL_SIZE >= 20 && state.ballY + BALL_SIZE >= state.p1Y && state.ballY <= state.p1Y + PADDLE_HEIGHT;
      const hitP2 = state.ballX + BALL_SIZE >= CANVAS_WIDTH - PADDLE_WIDTH - 20 && state.ballX <= CANVAS_WIDTH - 20 && state.ballY + BALL_SIZE >= state.p2Y && state.ballY <= state.p2Y + PADDLE_HEIGHT;

      if (hitP1) {
        state.ballVX = Math.abs(state.ballVX) * 1.05; // Speed up slightly
        state.ballX = PADDLE_WIDTH + 20;
        // Adjust angle based on where it hit the paddle
        const hitPoint = (state.ballY + BALL_SIZE/2) - (state.p1Y + PADDLE_HEIGHT/2);
        state.ballVY = hitPoint * 0.15;
        playBeep(440, 0.1);
        setShake(5);
        
        // Paddle hit particles
        for (let i = 0; i < 15; i++) {
          state.particles.push({
            x: state.ballX,
            y: state.ballY + BALL_SIZE / 2,
            vx: Math.random() * 6 + 2,
            vy: (Math.random() - 0.5) * 8,
            life: 20 + Math.random() * 20,
            maxLife: 40,
            color: '#06b6d4' // Cyan
          });
        }
      } else if (hitP2) {
        state.ballVX = -Math.abs(state.ballVX) * 1.05;
        state.ballX = CANVAS_WIDTH - PADDLE_WIDTH - 20 - BALL_SIZE;
        const hitPoint = (state.ballY + BALL_SIZE/2) - (state.p2Y + PADDLE_HEIGHT/2);
        state.ballVY = hitPoint * 0.15;
        playBeep(440, 0.1);
        setShake(5);
        
        // Paddle hit particles
        for (let i = 0; i < 15; i++) {
          state.particles.push({
            x: state.ballX + BALL_SIZE,
            y: state.ballY + BALL_SIZE / 2,
            vx: -Math.random() * 6 - 2,
            vy: (Math.random() - 0.5) * 8,
            life: 20 + Math.random() * 20,
            maxLife: 40,
            color: '#ec4899' // Pink
          });
        }
      }

      // Scoring
      if (state.ballX < -BALL_SIZE * 2) {
        setScore(s => ({ ...s, p2: s.p2 + 1 }));
        playBeep(150, 0.3, 'sawtooth');
        setShake(15);
        resetBall();
      } else if (state.ballX > CANVAS_WIDTH + BALL_SIZE * 2) {
        setScore(s => ({ ...s, p1: s.p1 + 1 }));
        playBeep(150, 0.3, 'sawtooth');
        setShake(15);
        resetBall();
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
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      const timeOffset = (Date.now() / 50) % 40;
      for (let i = 0; i < CANVAS_WIDTH; i += 40) {
        ctx.beginPath(); ctx.moveTo(i + timeOffset, 0); ctx.lineTo(i + timeOffset, CANVAS_HEIGHT); ctx.stroke();
      }
      for (let i = 0; i < CANVAS_HEIGHT; i += 40) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CANVAS_WIDTH, i); ctx.stroke();
      }

      // Draw center line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 4;
      ctx.setLineDash([15, 20]);
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH / 2, 0);
      ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Trail
      if (state.trail.length > 0) {
        ctx.beginPath();
        ctx.moveTo(state.trail[0].x + BALL_SIZE / 2, state.trail[0].y + BALL_SIZE / 2);
        for (let i = 1; i < state.trail.length; i++) {
          ctx.lineTo(state.trail[i].x + BALL_SIZE / 2, state.trail[i].y + BALL_SIZE / 2);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = BALL_SIZE;
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

      // Draw Paddles
      ctx.shadowBlur = 15;
      
      // Player 1 (Cyan)
      ctx.fillStyle = '#06b6d4';
      ctx.shadowColor = '#06b6d4';
      ctx.fillRect(20, state.p1Y, PADDLE_WIDTH, PADDLE_HEIGHT);
      ctx.fillStyle = '#fff';
      ctx.fillRect(20 + PADDLE_WIDTH - 4, state.p1Y, 4, PADDLE_HEIGHT); // Highlight edge
      
      // Player 2 (Pink)
      ctx.fillStyle = '#ec4899';
      ctx.shadowColor = '#ec4899';
      ctx.fillRect(CANVAS_WIDTH - PADDLE_WIDTH - 20, state.p2Y, PADDLE_WIDTH, PADDLE_HEIGHT);
      ctx.fillStyle = '#fff';
      ctx.fillRect(CANVAS_WIDTH - PADDLE_WIDTH - 20, state.p2Y, 4, PADDLE_HEIGHT); // Highlight edge
      
      // Draw Ball
      ctx.fillStyle = '#fff';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#fff';
      ctx.beginPath();
      ctx.arc(state.ballX + BALL_SIZE / 2, state.ballY + BALL_SIZE / 2, BALL_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.shadowBlur = 0;
      ctx.restore();

      reqRef.current = requestAnimationFrame(gameLoop);
    };

    if (isPlaying) {
      reqRef.current = requestAnimationFrame(gameLoop);
    } else {
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#06b6d4';
      ctx.shadowColor = '#06b6d4';
      ctx.fillRect(20, stateRef.current.p1Y, PADDLE_WIDTH, PADDLE_HEIGHT);
      
      ctx.fillStyle = '#ec4899';
      ctx.shadowColor = '#ec4899';
      ctx.fillRect(CANVAS_WIDTH - PADDLE_WIDTH - 20, stateRef.current.p2Y, PADDLE_WIDTH, PADDLE_HEIGHT);
      
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#fff';
      ctx.beginPath();
      ctx.arc(stateRef.current.ballX + BALL_SIZE / 2, stateRef.current.ballY + BALL_SIZE / 2, BALL_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, [isPlaying, shake]);

  return (
    <div className="relative">
      <div className="absolute top-8 left-0 right-0 flex justify-center gap-32 font-arcade text-5xl z-10 pointer-events-none">
        <span className="text-cyan-400 drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]">{score.p1}</span>
        <span className="text-pink-400 drop-shadow-[0_0_15px_rgba(236,72,153,0.8)]">{score.p2}</span>
      </div>
      
      {!isPlaying && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
          <h2 className="font-arcade text-5xl text-white mb-8 neon-text">PONG</h2>
          <div className="flex gap-16 mb-8 text-neutral-400 font-retro text-2xl">
            <div className="text-center">
              <p className="text-white mb-2">PLAYER 1</p>
              <p>W / S</p>
            </div>
            <div className="text-center">
              <p className="text-white mb-2">PLAYER 2</p>
              <p>UP / DOWN</p>
            </div>
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
