import React, { useEffect, useRef, useState } from 'react';

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 800;
const BALL_RADIUS = 10;
const GRAVITY = 0.2;
const FRICTION = 0.99;
const BOUNCE = 0.75;

type Point = { x: number, y: number };
type Ball = Point & { vx: number, vy: number, isHeld?: boolean, hasEnteredPlayfield?: boolean };
type Bumper = Point & { radius: number, value: number, color: string, hitTimer: number };
type Flipper = Point & { length: number, angle: number, restAngle: number, maxAngle: number, isLeft: boolean, active: boolean };
type Wall = { p1: Point, p2: Point };
type Particle = { x: number, y: number, vx: number, vy: number, life: number, maxLife: number, color: string };
type Slingshot = { p1: Point, p2: Point, p3: Point, hitTimer: number };
type Hole = Point & { radius: number, timer: number, lockedBalls: number, cooldown: number };

export function Pinball() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('pinballHighScore');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [balls, setBalls] = useState(3);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('pinballHighScore', score.toString());
    }
  }, [score, highScore]);

  const stateRef = useRef({
    balls: [{ x: CANVAS_WIDTH - 20, y: CANVAS_HEIGHT - 100, vx: 0, vy: 0 }] as Ball[],
    trail: [] as Point[],
    particles: [] as Particle[],
    jackpot: 5000,
    hole: { x: CANVAS_WIDTH / 2, y: 40, radius: 18, timer: 0, lockedBalls: 0, cooldown: 0 } as Hole,
    slingshots: [
      { p1: { x: CANVAS_WIDTH / 2 - 110, y: CANVAS_HEIGHT - 280 }, p2: { x: CANVAS_WIDTH / 2 - 70, y: CANVAS_HEIGHT - 180 }, p3: { x: CANVAS_WIDTH / 2 - 110, y: CANVAS_HEIGHT - 180 }, hitTimer: 0 },
      { p1: { x: CANVAS_WIDTH / 2 + 110, y: CANVAS_HEIGHT - 280 }, p2: { x: CANVAS_WIDTH / 2 + 70, y: CANVAS_HEIGHT - 180 }, p3: { x: CANVAS_WIDTH / 2 + 110, y: CANVAS_HEIGHT - 180 }, hitTimer: 0 },
    ] as Slingshot[],
    bumpers: [
      { x: CANVAS_WIDTH / 2, y: 150, radius: 30, value: 500, color: '#f472b6', hitTimer: 0 },
      { x: CANVAS_WIDTH / 2 - 80, y: 250, radius: 25, value: 250, color: '#38bdf8', hitTimer: 0 },
      { x: CANVAS_WIDTH / 2 + 80, y: 250, radius: 25, value: 250, color: '#38bdf8', hitTimer: 0 },
      { x: CANVAS_WIDTH / 2, y: 350, radius: 20, value: 100, color: '#a855f7', hitTimer: 0 },
      { x: CANVAS_WIDTH / 2 - 120, y: 150, radius: 20, value: 100, color: '#22c55e', hitTimer: 0 },
      { x: CANVAS_WIDTH / 2 + 120, y: 150, radius: 20, value: 100, color: '#22c55e', hitTimer: 0 },
      // New bumpers
      { x: CANVAS_WIDTH / 2 - 50, y: 80, radius: 15, value: 150, color: '#fbbf24', hitTimer: 0 },
      { x: CANVAS_WIDTH / 2 + 50, y: 80, radius: 15, value: 150, color: '#fbbf24', hitTimer: 0 },
      { x: CANVAS_WIDTH / 2 - 140, y: 300, radius: 15, value: 150, color: '#ef4444', hitTimer: 0 },
      { x: CANVAS_WIDTH / 2 + 140, y: 300, radius: 15, value: 150, color: '#ef4444', hitTimer: 0 },
    ] as Bumper[],
    flippers: [
      { x: CANVAS_WIDTH / 2 - 70, y: CANVAS_HEIGHT - 120, length: 60, angle: 0.5, restAngle: 0.5, maxAngle: -0.5, isLeft: true, active: false },
      { x: CANVAS_WIDTH / 2 + 70, y: CANVAS_HEIGHT - 120, length: 60, angle: Math.PI - 0.5, restAngle: Math.PI - 0.5, maxAngle: Math.PI + 0.5, isLeft: false, active: false }
    ] as Flipper[],
    walls: [
      // Outer walls
      { p1: { x: 0, y: 0 }, p2: { x: CANVAS_WIDTH, y: 0 } },
      { p1: { x: 0, y: 0 }, p2: { x: 0, y: CANVAS_HEIGHT } },
      { p1: { x: CANVAS_WIDTH - 40, y: 150 }, p2: { x: CANVAS_WIDTH - 40, y: CANVAS_HEIGHT } }, // Plunger lane wall
      { p1: { x: CANVAS_WIDTH, y: 0 }, p2: { x: CANVAS_WIDTH, y: CANVAS_HEIGHT } },
      // Funnels (Outer walls of the inlanes)
      { p1: { x: 0, y: CANVAS_HEIGHT - 350 }, p2: { x: 100, y: CANVAS_HEIGHT - 280 } },
      { p1: { x: 100, y: CANVAS_HEIGHT - 280 }, p2: { x: 100, y: CANVAS_HEIGHT - 180 } },
      { p1: { x: 100, y: CANVAS_HEIGHT - 180 }, p2: { x: CANVAS_WIDTH / 2 - 70, y: CANVAS_HEIGHT - 120 } },
      { p1: { x: CANVAS_WIDTH - 40, y: CANVAS_HEIGHT - 350 }, p2: { x: CANVAS_WIDTH - 100, y: CANVAS_HEIGHT - 280 } },
      { p1: { x: CANVAS_WIDTH - 100, y: CANVAS_HEIGHT - 280 }, p2: { x: CANVAS_WIDTH - 100, y: CANVAS_HEIGHT - 180 } },
      { p1: { x: CANVAS_WIDTH - 100, y: CANVAS_HEIGHT - 180 }, p2: { x: CANVAS_WIDTH / 2 + 70, y: CANVAS_HEIGHT - 120 } },
      // Slingshot back walls (prevents clipping)
      { p1: { x: CANVAS_WIDTH / 2 - 70, y: CANVAS_HEIGHT - 180 }, p2: { x: CANVAS_WIDTH / 2 - 110, y: CANVAS_HEIGHT - 180 } },
      { p1: { x: CANVAS_WIDTH / 2 - 110, y: CANVAS_HEIGHT - 180 }, p2: { x: CANVAS_WIDTH / 2 - 110, y: CANVAS_HEIGHT - 280 } },
      { p1: { x: CANVAS_WIDTH / 2 + 70, y: CANVAS_HEIGHT - 180 }, p2: { x: CANVAS_WIDTH / 2 + 110, y: CANVAS_HEIGHT - 180 } },
      { p1: { x: CANVAS_WIDTH / 2 + 110, y: CANVAS_HEIGHT - 180 }, p2: { x: CANVAS_WIDTH / 2 + 110, y: CANVAS_HEIGHT - 280 } },
      // Top curve (deflects ball from plunger lane)
      { p1: { x: 0, y: 150 }, p2: { x: 100, y: 50 } },
      { p1: { x: 100, y: 50 }, p2: { x: 200, y: 0 } },
      { p1: { x: CANVAS_WIDTH, y: 150 }, p2: { x: CANVAS_WIDTH - 100, y: 50 } },
      { p1: { x: CANVAS_WIDTH - 100, y: 50 }, p2: { x: CANVAS_WIDTH - 200, y: 0 } },
    ] as Wall[],
    keys: { ArrowLeft: false, ArrowRight: false, ArrowDown: false },
    plungerPower: 0,
    state: 'start' // start, playing, plunger
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
    stateRef.current.balls = [{ x: CANVAS_WIDTH - 20, y: CANVAS_HEIGHT - 50, vx: 0, vy: 0, hasEnteredPlayfield: false }];
    stateRef.current.trail = [];
    stateRef.current.particles = [];
    stateRef.current.jackpot = 5000;
    stateRef.current.hole.lockedBalls = 0;
    stateRef.current.hole.timer = 0;
    stateRef.current.hole.cooldown = 0;
    stateRef.current.state = 'plunger';
    stateRef.current.plungerPower = 0;
    setScore(0);
    setBalls(3);
    setGameOver(false);
    setIsPlaying(true);
  };

  const resetBall = () => {
    setBalls(b => {
      const newBalls = b - 1;
      if (newBalls <= 0) {
        setGameOver(true);
        setIsPlaying(false);
        playBeep(100, 0.8, 'sawtooth');
      } else {
        stateRef.current.balls = [{ x: CANVAS_WIDTH - 20, y: CANVAS_HEIGHT - 50, vx: 0, vy: 0, hasEnteredPlayfield: false }];
        stateRef.current.trail = [];
        stateRef.current.particles = [];
        stateRef.current.state = 'plunger';
        stateRef.current.plungerPower = 0;
        playBeep(200, 0.3, 'square');
      }
      return newBalls;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying && (e.key === 'Enter' || e.key === ' ')) {
        startGame();
        return;
      }
      if (stateRef.current.keys.hasOwnProperty(e.key)) {
        stateRef.current.keys[e.key as keyof typeof stateRef.current.keys] = true;
        
        // Flipper sound
        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && stateRef.current.state === 'playing') {
          playBeep(150, 0.05, 'triangle');
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (stateRef.current.keys.hasOwnProperty(e.key)) {
        stateRef.current.keys[e.key as keyof typeof stateRef.current.keys] = false;
        
        // Release plunger
        if (e.key === 'ArrowDown' && (stateRef.current.state === 'plunger' || stateRef.current.state === 'playing')) {
          let plunged = false;
          stateRef.current.balls.forEach(b => {
            if (b.x > CANVAS_WIDTH - 40 && b.y > CANVAS_HEIGHT - 60 && Math.abs(b.vy) < 1) {
              b.vy = -stateRef.current.plungerPower;
              plunged = true;
            }
          });
          if (plunged) {
            stateRef.current.state = 'playing';
            playBeep(400, 0.2, 'square');
          }
        }
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

    // Helper: distance from point to line segment
    const distToSegment = (p: Point, v: Point, w: Point) => {
      const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
      if (l2 === 0) return { dist: Math.hypot(p.x - v.x, p.y - v.y), closest: v };
      let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
      t = Math.max(0, Math.min(1, t));
      const closest = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
      return { dist: Math.hypot(p.x - closest.x, p.y - closest.y), closest };
    };

    const gameLoop = () => {
      if (!isPlaying || gameOver) return;

      const state = stateRef.current;
      const { balls, bumpers, flippers, walls, slingshots, hole, keys } = state;

      if (state.state === 'plunger') {
        if (keys.ArrowDown) {
          state.plungerPower = Math.min(32, state.plungerPower + 0.6);
        }
      } else if (state.state === 'playing') {
        // Physics sub-steps for better collision detection
        const SUB_STEPS = 3;
        for (let step = 0; step < SUB_STEPS; step++) {
          
          if (step === 0) {
            flippers[0].active = keys.ArrowLeft;
            flippers[1].active = keys.ArrowRight;
            
            // Hole logic
            if (hole.cooldown > 0) hole.cooldown--;
            if (hole.timer > 0) {
              hole.timer--;
              if (hole.timer === 0) {
                // Shoot out all locked balls
                for (let i = 0; i < hole.lockedBalls; i++) {
                  balls.push({
                    x: hole.x,
                    y: hole.y + hole.radius + 10,
                    vx: (Math.random() - 0.5) * 10,
                    vy: 5, // shoot down
                    isHeld: false
                  });
                }
                hole.lockedBalls = 0;
                hole.cooldown = 30; // 0.5 sec cooldown to prevent immediate re-entry
                playBeep(800, 0.3, 'square');
              }
            }
          }

          flippers.forEach(f => {
            if (step === 0) {
              const targetAngle = f.active ? f.maxAngle : f.restAngle;
              f.angle += (targetAngle - f.angle) * 0.3;
            }
          });

          balls.forEach(ball => {
            if (ball.isHeld) return;

            ball.vy += GRAVITY / SUB_STEPS;
            ball.vx *= Math.pow(FRICTION, 1 / SUB_STEPS);
            ball.vy *= Math.pow(FRICTION, 1 / SUB_STEPS);

            // Max speed
            const speed = Math.hypot(ball.vx, ball.vy);
            if (speed > 35) {
              ball.vx = (ball.vx / speed) * 35;
              ball.vy = (ball.vy / speed) * 35;
            }

            ball.x += ball.vx / SUB_STEPS;
            ball.y += ball.vy / SUB_STEPS;

            // Hole collision
            if (step === 0 && hole.timer === 0 && hole.cooldown === 0) {
              const dx = ball.x - hole.x;
              const dy = ball.y - hole.y;
              if (Math.hypot(dx, dy) < hole.radius) {
                ball.isHeld = true;
                hole.lockedBalls++;
                setScore(s => s + state.jackpot);
                state.jackpot += 1000;
                playBeep(1000, 0.5, 'sine');
                
                if (hole.lockedBalls >= 3) {
                  hole.timer = 60; // Multiball start!
                } else {
                  hole.timer = 30; // Shoot out after 0.5 sec
                }
              }
            }

            // Bumpers
            bumpers.forEach(b => {
              if (step === 0 && b.hitTimer > 0) b.hitTimer--;
              const dx = ball.x - b.x;
              const dy = ball.y - b.y;
              const dist = Math.hypot(dx, dy);
              if (dist < BALL_RADIUS + b.radius) {
                const angle = Math.atan2(dy, dx);
                const force = 18;
                ball.vx = Math.cos(angle) * force;
                ball.vy = Math.sin(angle) * force;
                ball.x = b.x + Math.cos(angle) * (BALL_RADIUS + b.radius + 1);
                ball.y = b.y + Math.sin(angle) * (BALL_RADIUS + b.radius + 1);
                
                if (step === 0) {
                  setScore(s => s + b.value);
                  state.jackpot += 100;
                  b.hitTimer = 10;
                  playBeep(600 + b.value, 0.1, 'sine');
                  for (let i = 0; i < 20; i++) {
                    const pAngle = Math.random() * Math.PI * 2;
                    const pSpeed = Math.random() * 10 + 2;
                    const life = 15 + Math.random() * 25;
                    state.particles.push({
                      x: b.x + Math.cos(angle) * b.radius,
                      y: b.y + Math.sin(angle) * b.radius,
                      vx: Math.cos(pAngle) * pSpeed,
                      vy: Math.sin(pAngle) * pSpeed,
                      life: life, maxLife: life, color: Math.random() > 0.3 ? b.color : '#ffffff'
                    });
                  }
                }
              }
            });

            // Flippers
            flippers.forEach(f => {
              const p2 = {
                x: f.x + Math.cos(f.angle) * f.length,
                y: f.y + Math.sin(f.angle) * f.length
              };
              const { dist, closest } = distToSegment(ball, f, p2);
              if (dist < BALL_RADIUS) {
                let nx, ny;
                if ((closest.x === f.x && closest.y === f.y) || (closest.x === p2.x && closest.y === p2.y)) {
                  nx = ball.x - closest.x; ny = ball.y - closest.y;
                  const len = Math.hypot(nx, ny);
                  if (len === 0) { nx = 1; ny = 0; } else { nx /= len; ny /= len; }
                } else {
                  const dx = p2.x - f.x; const dy = p2.y - f.y;
                  nx = -dy; ny = dx;
                  const len = Math.hypot(nx, ny); nx /= len; ny /= len;
                  if (nx * (ball.x - closest.x) + ny * (ball.y - closest.y) < 0) { nx = -nx; ny = -ny; }
                }
                ball.x = closest.x + nx * (BALL_RADIUS + 1);
                ball.y = closest.y + ny * (BALL_RADIUS + 1);
                const dot = ball.vx * nx + ball.vy * ny;
                if (dot < 0) {
                  const vn_x = dot * nx; const vn_y = dot * ny;
                  const vt_x = ball.vx - vn_x; const vt_y = ball.vy - vn_y;
                  ball.vx = vt_x - vn_x * BOUNCE; ball.vy = vt_y - vn_y * BOUNCE;
                  if (f.active && Math.abs(f.angle - f.maxAngle) > 0.1) {
                    ball.vx += nx * 25; ball.vy += ny * 25;
                    // Flipper sparks
                    if (step === 0) {
                      for (let i = 0; i < 8; i++) {
                        state.particles.push({
                          x: ball.x, y: ball.y,
                          vx: nx * (Math.random() * 8) + (Math.random() - 0.5) * 4,
                          vy: ny * (Math.random() * 8) + (Math.random() - 0.5) * 4,
                          life: 10 + Math.random() * 15, maxLife: 25, color: '#ef4444'
                        });
                      }
                    }
                  }
                }
              }
            });

            // Slingshots
            slingshots.forEach(s => {
              if (step === 0 && s.hitTimer > 0) s.hitTimer--;
              const { dist, closest } = distToSegment(ball, s.p1, s.p2);
              if (dist < BALL_RADIUS) {
                let nx, ny;
                if ((closest.x === s.p1.x && closest.y === s.p1.y) || (closest.x === s.p2.x && closest.y === s.p2.y)) {
                  nx = ball.x - closest.x; ny = ball.y - closest.y;
                  const len = Math.hypot(nx, ny);
                  if (len === 0) { nx = 1; ny = 0; } else { nx /= len; ny /= len; }
                } else {
                  const dx = s.p2.x - s.p1.x; const dy = s.p2.y - s.p1.y;
                  nx = -dy; ny = dx;
                  const len = Math.hypot(nx, ny); nx /= len; ny /= len;
                  if (nx * (ball.x - closest.x) + ny * (ball.y - closest.y) < 0) { nx = -nx; ny = -ny; }
                }
                ball.x = closest.x + nx * (BALL_RADIUS + 1);
                ball.y = closest.y + ny * (BALL_RADIUS + 1);
                const dot = ball.vx * nx + ball.vy * ny;
                if (dot < 0) {
                  const vn_x = dot * nx; const vn_y = dot * ny;
                  const vt_x = ball.vx - vn_x; const vt_y = ball.vy - vn_y;
                  ball.vx = vt_x - vn_x * BOUNCE; ball.vy = vt_y - vn_y * BOUNCE;
                  
                  // Slingshot extra force
                  ball.vx += nx * 12;
                  ball.vy += ny * 12;
                  if (step === 0) {
                    s.hitTimer = 10;
                    setScore(sc => sc + 500);
                    playBeep(500, 0.1, 'square');
                    
                    // Slingshot particles
                    for (let i = 0; i < 15; i++) {
                      state.particles.push({
                        x: ball.x,
                        y: ball.y,
                        vx: nx * (Math.random() * 6 + 3) + (Math.random() - 0.5) * 4,
                        vy: ny * (Math.random() * 6 + 3) + (Math.random() - 0.5) * 4,
                        life: 15 + Math.random() * 15, maxLife: 30, color: Math.random() > 0.5 ? '#fbbf24' : '#ffffff'
                      });
                    }
                  }
                }
              }
            });

            // Walls
            walls.forEach(w => {
              const { dist, closest } = distToSegment(ball, w.p1, w.p2);
              if (dist < BALL_RADIUS) {
                let nx, ny;
                if ((closest.x === w.p1.x && closest.y === w.p1.y) || (closest.x === w.p2.x && closest.y === w.p2.y)) {
                  nx = ball.x - closest.x; ny = ball.y - closest.y;
                  const len = Math.hypot(nx, ny);
                  if (len === 0) { nx = 1; ny = 0; } else { nx /= len; ny /= len; }
                } else {
                  const dx = w.p2.x - w.p1.x; const dy = w.p2.y - w.p1.y;
                  nx = -dy; ny = dx;
                  const len = Math.hypot(nx, ny); nx /= len; ny /= len;
                  if (nx * (ball.x - closest.x) + ny * (ball.y - closest.y) < 0) { nx = -nx; ny = -ny; }
                }
                ball.x = closest.x + nx * (BALL_RADIUS + 1);
                ball.y = closest.y + ny * (BALL_RADIUS + 1);
                const dot = ball.vx * nx + ball.vy * ny;
                if (dot < 0) {
                  const vn_x = dot * nx; const vn_y = dot * ny;
                  const vt_x = ball.vx - vn_x; const vt_y = ball.vy - vn_y;
                  ball.vx = vt_x - vn_x * BOUNCE; ball.vy = vt_y - vn_y * BOUNCE;
                }
              }
            });
          });
        }

        // Check for plunger lane kickback / multiball
        const newBalls: Ball[] = [];
        state.balls.forEach(ball => {
          // Check if ball has entered the playfield
          if (ball.x < CANVAS_WIDTH - 40 || ball.y < 150) {
            ball.hasEnteredPlayfield = true;
          }

          if (!ball.isHeld && ball.x > CANVAS_WIDTH - 40 && ball.y > CANVAS_HEIGHT - 60) {
            if (ball.vy > 0 && ball.hasEnteredPlayfield) {
              // Kickback!
              ball.vy = -45; // shoot it back up faster
              ball.vx = 0;
              ball.y = CANVAS_HEIGHT - 60; // reset position slightly
              
              // Add multiball (limit to max 6 balls on board)
              const currentBalls = state.balls.length + newBalls.length;
              if (currentBalls < 6) {
                const ballsToAdd = Math.min(
                  Math.floor(Math.random() * 5) + 2, // Random 2 to 6
                  6 - currentBalls // Don't exceed 6 total
                );

                for (let i = 0; i < ballsToAdd; i++) {
                  newBalls.push({
                    x: CANVAS_WIDTH - 20,
                    y: CANVAS_HEIGHT - 80 - (i * 20),
                    vx: (Math.random() - 0.5) * 4,
                    vy: -35 - Math.random() * 10,
                    isHeld: false,
                    hasEnteredPlayfield: true
                  });
                }
                
                playBeep(1200, 0.5, 'square');
                setScore(s => s + 10000);
                
                // Add massive particles
                for (let i = 0; i < 40; i++) {
                  state.particles.push({
                    x: ball.x,
                    y: ball.y,
                    vx: (Math.random() - 0.5) * 15,
                    vy: -Math.random() * 15,
                    life: 30 + Math.random() * 20,
                    maxLife: 50,
                    color: Math.random() > 0.5 ? '#fbbf24' : '#ffffff'
                  });
                }
              }
            } else if (!ball.hasEnteredPlayfield && ball.vy > -1 && ball.vy < 1 && ball.y > CANVAS_HEIGHT - 55) {
              // Weak plunge, settled back down. Let user plunge again.
              ball.vy = 0;
              ball.vx = 0;
              ball.y = CANVAS_HEIGHT - 50;
              if (state.balls.length === 1) {
                state.state = 'plunger';
              }
            }
          }
        });
        state.balls.push(...newBalls);

        // Remove held or lost balls
        state.balls = state.balls.filter(b => !b.isHeld && b.y <= CANVAS_HEIGHT + 50);

        if (state.balls.length === 0 && state.hole.lockedBalls === 0) {
          resetBall();
        }

        // Update particles
        for (let i = state.particles.length - 1; i >= 0; i--) {
          const p = state.particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.2; // Add gravity to particles
          p.life--;
          if (p.life <= 0) {
            state.particles.splice(i, 1);
          }
        }

        // Trail
        if (state.balls.length > 0) {
          state.trail.push({ x: state.balls[0].x, y: state.balls[0].y });
          if (state.trail.length > 20) state.trail.shift();
        } else {
          state.trail = [];
        }
      }

      // Draw Background
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw Grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
      ctx.lineWidth = 1;
      const timeOffset = (Date.now() / 50) % 40;
      for (let i = 0; i < CANVAS_WIDTH; i += 40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CANVAS_HEIGHT); ctx.stroke();
      }
      for (let i = -40; i < CANVAS_HEIGHT; i += 40) {
        ctx.beginPath(); ctx.moveTo(0, i + timeOffset); ctx.lineTo(CANVAS_WIDTH, i + timeOffset); ctx.stroke();
      }

      // Draw Walls
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#38bdf8';
      walls.forEach(w => {
        ctx.beginPath();
        ctx.moveTo(w.p1.x, w.p1.y);
        ctx.lineTo(w.p2.x, w.p2.y);
        ctx.stroke();
      });
      ctx.shadowBlur = 0;

      // Draw Slingshots
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      slingshots.forEach(s => {
        // Draw the triangle body
        ctx.fillStyle = '#1e293b'; // dark slate
        ctx.beginPath();
        ctx.moveTo(s.p1.x, s.p1.y);
        ctx.lineTo(s.p2.x, s.p2.y);
        ctx.lineTo(s.p3.x, s.p3.y);
        ctx.closePath();
        ctx.fill();

        // Draw the bouncy edge
        ctx.strokeStyle = s.hitTimer > 0 ? '#ffffff' : '#fbbf24';
        ctx.shadowBlur = s.hitTimer > 0 ? 20 : 10;
        ctx.shadowColor = s.hitTimer > 0 ? '#ffffff' : '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(s.p1.x, s.p1.y);
        ctx.lineTo(s.p2.x, s.p2.y);
        ctx.stroke();
      });
      ctx.shadowBlur = 0;

      // Draw Hole
      ctx.fillStyle = '#0a0a0a';
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      ctx.shadowBlur = hole.timer > 0 ? 30 : 15;
      ctx.shadowColor = '#a855f7';
      ctx.beginPath();
      ctx.arc(hole.x, hole.y, hole.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw Jackpot text
      const pulse = Math.sin(Date.now() / 200) * 5 + 15;
      ctx.fillStyle = '#f472b6';
      ctx.shadowBlur = pulse;
      ctx.shadowColor = '#f472b6';
      ctx.font = 'bold 24px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`JACKPOT: ${state.jackpot}`, CANVAS_WIDTH / 2, 420);
      ctx.shadowBlur = 0;

      // Draw Bumpers
      bumpers.forEach(b => {
        ctx.fillStyle = b.hitTimer > 0 ? '#ffffff' : b.color;
        ctx.shadowBlur = b.hitTimer > 0 ? 40 : 15;
        ctx.shadowColor = b.hitTimer > 0 ? '#ffffff' : b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius + (b.hitTimer > 0 ? 5 : 0), 0, Math.PI * 2);
        ctx.fill();
        
        // Inner detail
        ctx.fillStyle = b.hitTimer > 0 ? b.color : '#fff';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0;

      // Draw Flippers
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ef4444';
      flippers.forEach(f => {
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.lineTo(f.x + Math.cos(f.angle) * f.length, f.y + Math.sin(f.angle) * f.length);
        ctx.stroke();
      });
      ctx.shadowBlur = 0;

      // Draw Plunger
      if (state.state === 'plunger') {
        ctx.fillStyle = '#f97316';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#f97316';
        ctx.fillRect(CANVAS_WIDTH - 30, CANVAS_HEIGHT - 20 + state.plungerPower * 2, 20, 40);
        ctx.shadowBlur = 0;
      }

      // Draw Particles
      state.particles.forEach(p => {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;

      // Draw Trail
      if (state.trail.length > 0) {
        for (let i = 0; i < state.trail.length - 1; i++) {
          ctx.beginPath();
          ctx.moveTo(state.trail[i].x, state.trail[i].y);
          ctx.lineTo(state.trail[i+1].x, state.trail[i+1].y);
          ctx.strokeStyle = `rgba(56, 189, 248, ${i / state.trail.length})`;
          ctx.lineWidth = BALL_RADIUS * 1.5 * (i / state.trail.length);
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      }

      // Draw Balls
      balls.forEach(ball => {
        const gradient = ctx.createRadialGradient(
          ball.x - BALL_RADIUS * 0.3, ball.y - BALL_RADIUS * 0.3, BALL_RADIUS * 0.1,
          ball.x, ball.y, BALL_RADIUS
        );
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.4, '#94a3b8');
        gradient.addColorStop(0.8, '#334155');
        gradient.addColorStop(1, '#0f172a');

        ctx.fillStyle = gradient;
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      });
      
      ctx.shadowBlur = 0;

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
      <div className="absolute top-4 left-4 font-arcade text-pink-400 text-xl z-10">
        SCORE: {score}
      </div>
      <div className="absolute top-12 left-4 font-arcade text-yellow-400 text-xl z-10">
        HIGH SCORE: {highScore}
      </div>
      <div className="absolute top-4 right-4 font-arcade text-sky-400 text-xl z-10">
        BALLS: {balls}
      </div>
      
      {!isPlaying && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
          <h2 className="font-arcade text-5xl text-pink-400 mb-8 neon-text tracking-widest">PINBALL</h2>
          {gameOver && <p className="font-arcade text-red-500 mb-4 text-2xl">GAME OVER</p>}
          <div className="text-neutral-400 font-retro text-2xl mb-8 text-center">
            <p>DOWN ARROW: Pull Plunger</p>
            <p>LEFT/RIGHT: Flippers</p>
          </div>
          <p className="font-arcade text-white animate-pulse cursor-pointer" onClick={startGame}>
            PRESS ENTER TO START
          </p>
        </div>
      )}

      <div className="border-4 border-neutral-800 rounded-lg overflow-hidden shadow-[0_0_30px_rgba(244,114,182,0.2)]">
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
