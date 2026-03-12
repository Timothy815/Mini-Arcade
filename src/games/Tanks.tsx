import React, { useEffect, useRef, useState } from 'react';
import { Settings, Wind, Crosshair, Package, Zap, Shield, Bomb, Mountain } from 'lucide-react';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const GRAVITY = 0.15;
const MAX_HEALTH = 100;
const TANK_WIDTH = 30;
const TANK_HEIGHT = 14;

type WeaponType = 'STANDARD' | 'BIG_BOY' | 'DIRT' | 'CLUSTER';
type GameMode = 'menu' | 'single' | 'multi';

const WEAPONS: Record<WeaponType, { name: string; radius: number; damage: number; color: string; icon: React.ReactNode }> = {
  STANDARD: { name: 'Standard', radius: 30, damage: 20, color: '#ffffff', icon: <Crosshair size={14} /> },
  BIG_BOY: { name: 'Big Boy', radius: 80, damage: 40, color: '#ff4400', icon: <Bomb size={14} /> },
  DIRT: { name: 'Dirt Bomb', radius: 50, damage: 0, color: '#8b4513', icon: <Mountain size={14} /> },
  CLUSTER: { name: 'Cluster', radius: 25, damage: 15, color: '#a855f7', icon: <Zap size={14} /> }
};

type PlayerState = {
  health: number;
  fuel: number;
  inventory: Record<WeaponType, number>;
  selectedWeapon: WeaponType;
};

type Projectile = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: WeaponType;
  hasSplit?: boolean;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
};

type Crate = {
  x: number;
  y: number;
  type: 'HEALTH' | 'FUEL' | WeaponType;
  active: boolean;
};

const INITIAL_INVENTORY: Record<WeaponType, number> = {
  STANDARD: Infinity,
  BIG_BOY: 1,
  DIRT: 2,
  CLUSTER: 1
};

export function Tanks() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game State
  const [gameMode, setGameMode] = useState<GameMode>('menu');
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [turn, setTurn] = useState<0 | 1>(0); // 0 = Player 1, 1 = Player 2 / AI
  const [message, setMessage] = useState('');
  const [wind, setWind] = useState(0);
  
  // Player UI State
  const [players, setPlayers] = useState<PlayerState[]>([
    { health: MAX_HEALTH, fuel: 100, inventory: { ...INITIAL_INVENTORY }, selectedWeapon: 'STANDARD' },
    { health: MAX_HEALTH, fuel: 100, inventory: { ...INITIAL_INVENTORY }, selectedWeapon: 'STANDARD' }
  ]);

  // Aiming State
  const [angle, setAngle] = useState(45);
  const [power, setPower] = useState(50);

  // Mutable Game Loop State
  const stateRef = useRef({
    terrain: [] as number[],
    tanks: [
      { x: 100, y: 0, recoil: 0 },
      { x: 700, y: 0, recoil: 0 }
    ],
    projectiles: [] as Projectile[],
    particles: [] as Particle[],
    explosions: [] as { x: number; y: number; radius: number; life: number; maxLife: number; color: string }[],
    crates: [] as Crate[],
    screenShake: 0,
    keys: { ArrowLeft: false, ArrowRight: false, ' ': false, Enter: false },
    mouse: { x: 0, y: 0 }
  });

  const windRef = useRef(wind);
  windRef.current = wind;
  const angleRef = useRef(angle);
  angleRef.current = angle;
  const powerRef = useRef(power);
  powerRef.current = power;
  const playersRef = useRef(players);
  playersRef.current = players;
  const turnRef = useRef(turn);
  turnRef.current = turn;
  const gameModeRef = useRef(gameMode);
  gameModeRef.current = gameMode;
  const gameOverRef = useRef(gameOver);
  gameOverRef.current = gameOver;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const generateTerrain = () => {
    const terrain = [];
    const hills = [];
    for (let i = 0; i < 4; i++) {
      hills.push({
        amp: 20 + Math.random() * 50,
        freq: 0.002 + Math.random() * 0.006,
        phase: Math.random() * Math.PI * 2
      });
    }
    
    for (let i = 0; i <= CANVAS_WIDTH; i++) {
      let h = 350;
      for (const hill of hills) {
        h += Math.sin(i * hill.freq + hill.phase) * hill.amp;
      }
      h += (Math.random() - 0.5) * 3; // Texture
      h = Math.max(150, Math.min(500, h));
      terrain.push(h);
    }
    return terrain;
  };

  const getTerrainHeight = (x: number) => {
    const idx = Math.floor(Math.max(0, Math.min(CANVAS_WIDTH, x)));
    return stateRef.current.terrain[idx] || CANVAS_HEIGHT;
  };

  const startGame = (mode: 'single' | 'multi') => {
    const terrain = generateTerrain();
    stateRef.current.terrain = terrain;
    stateRef.current.tanks = [
      { x: 100, y: terrain[100], recoil: 0 },
      { x: 700, y: terrain[700], recoil: 0 }
    ];
    stateRef.current.projectiles = [];
    stateRef.current.particles = [];
    stateRef.current.explosions = [];
    stateRef.current.crates = [];
    stateRef.current.screenShake = 0;
    
    setPlayers([
      { health: MAX_HEALTH, fuel: 100, inventory: { ...INITIAL_INVENTORY }, selectedWeapon: 'STANDARD' },
      { health: MAX_HEALTH, fuel: 100, inventory: { ...INITIAL_INVENTORY }, selectedWeapon: 'STANDARD' }
    ]);
    
    const initialWind = (Math.random() - 0.5) * 0.15;
    setWind(initialWind);
    windRef.current = initialWind;
    
    setGameMode(mode);
    setTurn(0);
    setAngle(45);
    setPower(50);
    setMessage('PLAYER 1 TURN');
    setGameOver(false);
    setIsPlaying(true);
  };

  const spawnCrate = () => {
    const types: Crate['type'][] = ['HEALTH', 'FUEL', 'BIG_BOY', 'DIRT', 'CLUSTER'];
    const type = types[Math.floor(Math.random() * types.length)];
    stateRef.current.crates.push({
      x: 50 + Math.random() * (CANVAS_WIDTH - 100),
      y: -50,
      type,
      active: true
    });
  };

  const endTurn = () => {
    if (gameOverRef.current) return;
    
    const nextTurn = turnRef.current === 0 ? 1 : 0;
    setTurn(nextTurn);
    turnRef.current = nextTurn;
    
    // Reset fuel for next player
    setPlayers(prev => {
      const newPlayers = [...prev];
      newPlayers[nextTurn].fuel = 100;
      return newPlayers;
    });
    
    const newWind = (Math.random() - 0.5) * 0.15;
    setWind(newWind);
    windRef.current = newWind;
    
    // 25% chance to spawn a crate
    if (Math.random() < 0.25) spawnCrate();
    
    if (gameModeRef.current === 'single' && nextTurn === 1) {
      setMessage('AI TURN');
      setTimeout(() => callbacksRef.current.runAI(), 1000);
    } else {
      setMessage(`PLAYER ${nextTurn + 1} TURN`);
    }
  };

  const runAI = async () => {
    if (gameOverRef.current || !isPlayingRef.current) return;
    
    setMessage('AI THINKING...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 1. Select Weapon
    const aiInventory = playersRef.current[1].inventory;
    const availableWeapons = (Object.keys(aiInventory) as WeaponType[]).filter(w => aiInventory[w] > 0);
    const selectedWeapon = availableWeapons[Math.floor(Math.random() * availableWeapons.length)];
    
    setPlayers(prev => {
      const newPlayers = [...prev];
      newPlayers[1].selectedWeapon = selectedWeapon;
      return newPlayers;
    });

    // 2. Move (sometimes)
    if (Math.random() < 0.5) {
      setMessage('AI MOVING...');
      const dir = Math.random() > 0.5 ? 1 : -1;
      const moveAmount = 20 + Math.random() * 60;
      let moved = 0;
      
      await new Promise<void>((resolve) => {
        const moveInterval = setInterval(() => {
          const p2Fuel = playersRef.current[1].fuel;
          if (moved >= moveAmount || stateRef.current.tanks[1].x < 420 || stateRef.current.tanks[1].x > 780 || p2Fuel <= 0) {
            clearInterval(moveInterval);
            resolve();
            return;
          }
          
          stateRef.current.tanks[1].x += dir * 0.8;
          moved += 0.8;
          setPlayers(prev => {
            const newPlayers = [...prev];
            newPlayers[1].fuel = Math.max(0, newPlayers[1].fuel - 1.5);
            return newPlayers;
          });
        }, 20);
      });
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 3. Aim
    setMessage('AI AIMING...');
    
    const simulateShot = (testAngle: number, testPower: number) => {
      const rad = (180 - testAngle) * (Math.PI / 180);
      let tx = stateRef.current.tanks[1].x;
      let ty = stateRef.current.tanks[1].y - 12;
      let tvx = Math.cos(rad) * (testPower / 12);
      let tvy = -Math.sin(rad) * (testPower / 12);
      
      for (let t = 0; t < 600; t++) {
        tx += tvx;
        ty += tvy;
        tvx += windRef.current;
        tvy += GRAVITY;
        
        if (tx < -200 || tx > CANVAS_WIDTH + 200 || ty > CANVAS_HEIGHT) return 9999;
        
        if (tx >= 0 && tx <= CANVAS_WIDTH) {
          const terrainY = getTerrainHeight(tx);
          if (ty >= terrainY) return Math.abs(tx - stateRef.current.tanks[0].x);
        }
        
        if (Math.abs(tx - stateRef.current.tanks[0].x) < 20 && Math.abs(ty - stateRef.current.tanks[0].y) < 20) {
          return 0;
        }
      }
      return 9999;
    };

    let bestAngle = 45;
    let bestPower = 50;
    let minMiss = 9999;

    for (let a = 20; a <= 80; a += 5) {
      for (let p = 10; p <= 100; p += 2) {
        const miss = simulateShot(a, p);
        if (miss < minMiss) {
          minMiss = miss;
          bestAngle = a;
          bestPower = p;
        }
      }
    }

    // Apply error margin
    const errorScale = 12; // Normal difficulty
    const targetAngle = bestAngle + (Math.random() - 0.5) * errorScale;
    const targetPower = bestPower + (Math.random() - 0.5) * errorScale;
    
    // Animate aiming
    const steps = 30;
    const angleStep = (targetAngle - angleRef.current) / steps;
    const powerStep = (targetPower - powerRef.current) / steps;
    
    for (let i = 0; i < steps; i++) {
      setAngle(a => a + angleStep);
      setPower(p => p + powerStep);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 4. Fire
    setMessage('AI FIRING!');
    callbacksRef.current.fire(1);
  };

  const fire = (shooterIdx: 0 | 1) => {
    if (stateRef.current.projectiles.length > 0) return;

    const tank = stateRef.current.tanks[shooterIdx];
    const currentAngle = angleRef.current;
    const currentPower = powerRef.current;
    const weapon = playersRef.current[shooterIdx].selectedWeapon;
    
    // Consume ammo
    if (weapon !== 'STANDARD') {
      setPlayers(prev => {
        const newPlayers = [...prev];
        newPlayers[shooterIdx].inventory[weapon]--;
        if (newPlayers[shooterIdx].inventory[weapon] <= 0) {
          newPlayers[shooterIdx].selectedWeapon = 'STANDARD';
        }
        return newPlayers;
      });
    }

    // Recoil animation
    tank.recoil = 8;

    const rad = (shooterIdx === 0 ? currentAngle : 180 - currentAngle) * (Math.PI / 180);

    stateRef.current.projectiles.push({
      x: tank.x,
      y: tank.y - 14,
      vx: Math.cos(rad) * (currentPower / 12),
      vy: -Math.sin(rad) * (currentPower / 12),
      type: weapon
    });
  };

  const createExplosion = (x: number, y: number, weapon: WeaponType) => {
    const config = WEAPONS[weapon];
    
    // Screen shake
    stateRef.current.screenShake = weapon === 'BIG_BOY' ? 25 : (weapon === 'CLUSTER' ? 5 : 10);
    
    // Visual explosion
    stateRef.current.explosions.push({
      x, y, 
      radius: config.radius, 
      life: 30, 
      maxLife: 30,
      color: config.color
    });
    
    // Particles
    const particleCount = weapon === 'BIG_BOY' ? 40 : 20;
    for (let i = 0; i < particleCount; i++) {
      stateRef.current.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10 - 2,
        life: 20 + Math.random() * 20,
        maxLife: 40,
        color: Math.random() > 0.5 ? config.color : '#ffffff',
        size: Math.random() * 4 + 2
      });
    }

    // Terrain modification
    if (weapon === 'DIRT') {
      for (let i = Math.floor(x - config.radius); i < x + config.radius; i++) {
        if (i >= 0 && i < CANVAS_WIDTH) {
          const d = Math.abs(i - x);
          const height = Math.sqrt(Math.max(0, config.radius * config.radius - d * d));
          stateRef.current.terrain[i] = Math.max(100, stateRef.current.terrain[i] - height);
        }
      }
    } else {
      for (let i = Math.floor(x - config.radius); i < x + config.radius; i++) {
        if (i >= 0 && i < CANVAS_WIDTH) {
          const d = Math.abs(i - x);
          const depth = Math.sqrt(Math.max(0, config.radius * config.radius - d * d));
          stateRef.current.terrain[i] = Math.min(CANVAS_HEIGHT, stateRef.current.terrain[i] + depth);
        }
      }
    }

    // Damage calculation
    if (config.damage > 0) {
      stateRef.current.tanks.forEach((tank, idx) => {
        const dist = Math.hypot(x - tank.x, y - tank.y);
        if (dist < config.radius + 15) {
          setPlayers(prev => {
            const newPlayers = [...prev];
            newPlayers[idx] = { ...newPlayers[idx], health: Math.max(0, newPlayers[idx].health - config.damage) };
            return newPlayers;
          });
        }
      });
    }
    
    // Destroy crates in explosion
    stateRef.current.crates.forEach(crate => {
      if (crate.active && Math.hypot(x - crate.x, y - crate.y) < config.radius) {
        crate.active = false;
      }
    });
  };

  const callbacksRef = useRef({ endTurn, runAI, fire });
  callbacksRef.current = { endTurn, runAI, fire };

  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying) return;
      
      if (stateRef.current.keys.hasOwnProperty(e.key)) {
        e.preventDefault();
        stateRef.current.keys[e.key as keyof typeof stateRef.current.keys] = true;
      }

      // Weapon selection hotkeys for current player
      const isCurrentPlayerHuman = gameMode === 'multi' || turn === 0;
      if (isCurrentPlayerHuman && stateRef.current.projectiles.length === 0) {
        const keyMap: Record<string, WeaponType> = { '1': 'STANDARD', '2': 'BIG_BOY', '3': 'DIRT', '4': 'CLUSTER' };
        if (keyMap[e.key]) {
          const weapon = keyMap[e.key];
          if (players[turn].inventory[weapon] > 0) {
            setPlayers(prev => {
              const newPlayers = [...prev];
              newPlayers[turn].selectedWeapon = weapon;
              return newPlayers;
            });
          }
        }
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (stateRef.current.keys.hasOwnProperty(e.key)) {
        stateRef.current.keys[e.key as keyof typeof stateRef.current.keys] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas || !isPlaying) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      stateRef.current.mouse = { x, y };

      const isCurrentPlayerHuman = gameMode === 'multi' || turn === 0;
      if (isCurrentPlayerHuman && stateRef.current.projectiles.length === 0) {
        const tank = stateRef.current.tanks[turn];
        const dx = x - tank.x;
        const dy = (tank.y - 12) - y;
        const newAngle = Math.atan2(dy, dx) * (180 / Math.PI);
        const dist = Math.hypot(dx, dy);
        
        setAngle(Math.max(-90, Math.min(270, newAngle)));
        setPower(Math.max(10, Math.min(100, dist / 2)));
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const isCurrentPlayerHuman = gameMode === 'multi' || turn === 0;
      if (isCurrentPlayerHuman && isPlaying && stateRef.current.projectiles.length === 0) {
        fire(turn);
      }
    };

    canvasRef.current?.addEventListener('mousemove', handleMouseMove);
    canvasRef.current?.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvasRef.current?.removeEventListener('mousemove', handleMouseMove);
      canvasRef.current?.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isPlaying, turn, gameMode, players]);

  // Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const gameLoop = () => {
      if (!isPlaying) return;
      const state = stateRef.current;

      // Handle Human Input
      const isCurrentPlayerHuman = gameModeRef.current === 'multi' || turnRef.current === 0;
      if (isCurrentPlayerHuman && state.projectiles.length === 0) {
        const pState = playersRef.current[turnRef.current];
        if (state.keys.ArrowLeft && pState.fuel > 0) {
          state.tanks[turnRef.current].x -= 1.5;
          setPlayers(prev => {
            const newPlayers = [...prev];
            newPlayers[turnRef.current].fuel = Math.max(0, newPlayers[turnRef.current].fuel - 0.5);
            return newPlayers;
          });
        }
        if (state.keys.ArrowRight && pState.fuel > 0) {
          state.tanks[turnRef.current].x += 1.5;
          setPlayers(prev => {
            const newPlayers = [...prev];
            newPlayers[turnRef.current].fuel = Math.max(0, newPlayers[turnRef.current].fuel - 0.5);
            return newPlayers;
          });
        }
        
        // Boundaries
        state.tanks[0].x = Math.max(20, Math.min(CANVAS_WIDTH/2 - 20, state.tanks[0].x));
        state.tanks[1].x = Math.max(CANVAS_WIDTH/2 + 20, Math.min(CANVAS_WIDTH - 20, state.tanks[1].x));
        
        if (state.keys[' ']) fire(turnRef.current);
      }

      // Physics Updates
      state.tanks.forEach(t => {
        t.y = getTerrainHeight(t.x);
        t.recoil *= 0.8; // Recover recoil
      });

      // Crates
      state.crates.forEach((crate, i) => {
        if (!crate.active) return;
        const terrainY = getTerrainHeight(crate.x);
        if (crate.y < terrainY - 10) {
          crate.y += 1.5; // Fall speed
        } else {
          crate.y = terrainY - 10;
        }

        // Check collection by tanks
        state.tanks.forEach((tank, tankIdx) => {
          if (Math.hypot(tank.x - crate.x, tank.y - crate.y) < 25) {
            crate.active = false;
            setPlayers(prev => {
              const newPlayers = [...prev];
              newPlayers[tankIdx] = { ...newPlayers[tankIdx] };
              if (crate.type === 'HEALTH') newPlayers[tankIdx].health = Math.min(MAX_HEALTH, newPlayers[tankIdx].health + 30);
              else if (crate.type === 'FUEL') newPlayers[tankIdx].fuel = 100;
              else newPlayers[tankIdx].inventory[crate.type as WeaponType]++;
              return newPlayers;
            });
            // Collection effect
            for(let j=0; j<10; j++) {
               state.particles.push({
                 x: crate.x, y: crate.y,
                 vx: (Math.random()-0.5)*4, vy: (Math.random()-0.5)*4 - 2,
                 life: 20, maxLife: 20, color: '#4ade80', size: 3
               });
            }
          }
        });
      });
      state.crates = state.crates.filter(c => c.active);

      // Projectiles
      let allProjectilesDone = state.projectiles.length > 0;
      
      for (let i = state.projectiles.length - 1; i >= 0; i--) {
        const proj = state.projectiles[i];
        
        // Smoke trail
        if (Math.random() > 0.3) {
          state.particles.push({
            x: proj.x, y: proj.y,
            vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
            life: 20, maxLife: 20, color: 'rgba(150, 150, 150, 0.5)', size: 4
          });
        }

        proj.x += proj.vx;
        proj.y += proj.vy;
        proj.vx += windRef.current;
        proj.vy += GRAVITY;

        // Cluster split logic
        if (proj.type === 'CLUSTER' && proj.vy > 0 && !proj.hasSplit) {
          proj.hasSplit = true;
          proj.type = 'STANDARD'; // Convert main to standard
          state.projectiles.push(
            { ...proj, vx: proj.vx - 2, type: 'STANDARD', hasSplit: true },
            { ...proj, vx: proj.vx + 2, type: 'STANDARD', hasSplit: true }
          );
        }

        const terrainY = getTerrainHeight(proj.x);
        if (proj.y >= terrainY || proj.x < -200 || proj.x > CANVAS_WIDTH + 200) {
          if (proj.x >= 0 && proj.x <= CANVAS_WIDTH) {
            createExplosion(proj.x, proj.y, proj.type);
          }
          state.projectiles.splice(i, 1);
        } else {
          allProjectilesDone = false;
        }
      }

      if (state.projectiles.length === 0 && allProjectilesDone) {
        setTimeout(() => callbacksRef.current.endTurn(), 1500);
      }

      // Particles
      state.particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
      });
      state.particles = state.particles.filter(p => p.life > 0);

      // Render
      ctx.save();
      
      // Screen Shake
      if (state.screenShake > 0) {
        const dx = (Math.random() - 0.5) * state.screenShake;
        const dy = (Math.random() - 0.5) * state.screenShake;
        ctx.translate(dx, dy);
        state.screenShake *= 0.9;
        if (state.screenShake < 0.5) state.screenShake = 0;
      }

      // Sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      skyGrad.addColorStop(0, '#0f172a');
      skyGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Stars
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      for(let i=0; i<50; i++) {
        const x = (i * 137) % CANVAS_WIDTH;
        const y = (i * 241) % (CANVAS_HEIGHT - 200);
        ctx.fillRect(x, y, 1, 1);
      }

      // Terrain
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_HEIGHT);
      for (let i = 0; i < CANVAS_WIDTH; i++) ctx.lineTo(i, state.terrain[i]);
      ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#14532d'; // Dark green
      ctx.fill();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Crates
      state.crates.forEach(crate => {
        ctx.save();
        ctx.translate(crate.x, crate.y);
        
        // Parachute if falling
        if (crate.y < getTerrainHeight(crate.x) - 15) {
          ctx.beginPath();
          ctx.arc(0, -15, 12, Math.PI, 0);
          ctx.fillStyle = '#f8fafc';
          ctx.fill();
          ctx.strokeStyle = '#cbd5e1';
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-12, -15); ctx.lineTo(-6, 0);
          ctx.moveTo(12, -15); ctx.lineTo(6, 0);
          ctx.stroke();
        }

        // Box
        ctx.fillStyle = crate.type === 'HEALTH' ? '#ef4444' : (crate.type === 'FUEL' ? '#eab308' : '#a855f7');
        ctx.fillRect(-8, -8, 16, 16);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(-8, -8, 16, 16);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(crate.type === 'HEALTH' ? '+' : (crate.type === 'FUEL' ? 'F' : 'W'), 0, 0);
        
        ctx.restore();
      });

      // Tanks
      const drawTank = (idx: 0 | 1, color: string) => {
        const tank = state.tanks[idx];
        ctx.save();
        ctx.translate(tank.x, tank.y);
        
        // Body
        ctx.fillStyle = color;
        ctx.fillRect(-TANK_WIDTH / 2, -TANK_HEIGHT, TANK_WIDTH, TANK_HEIGHT);
        ctx.fillStyle = '#000';
        ctx.fillRect(-TANK_WIDTH / 2 + 2, -4, TANK_WIDTH - 4, 4); // Tracks
        
        // Turret
        ctx.beginPath();
        ctx.arc(0, -TANK_HEIGHT, 6, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        
        // Barrel
        ctx.save();
        ctx.translate(0, -TANK_HEIGHT);
        const tAngle = idx === 0 ? angleRef.current : 180 - angleRef.current;
        ctx.rotate(-tAngle * Math.PI / 180);
        ctx.fillStyle = '#64748b';
        // Apply recoil
        ctx.fillRect(tank.recoil, -2, 16, 4);
        ctx.restore();
        
        // Health bar
        const health = playersRef.current[idx].health;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-15, -25, 30, 4);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(-15, -25, (health / MAX_HEALTH) * 30, 4);
        
        ctx.restore();
      };

      drawTank(0, '#3b82f6'); // Blue
      drawTank(1, '#ef4444'); // Red

      // Aiming Arc (only for current human player)
      if (state.projectiles.length === 0 && isCurrentPlayerHuman) {
        ctx.beginPath();
        const rad = (turnRef.current === 0 ? angleRef.current : 180 - angleRef.current) * (Math.PI / 180);
        let tx = state.tanks[turnRef.current].x;
        let ty = state.tanks[turnRef.current].y - 14;
        let tvx = Math.cos(rad) * (powerRef.current / 12);
        let tvy = -Math.sin(rad) * (powerRef.current / 12);
        
        ctx.moveTo(tx, ty);
        for (let i = 0; i < 30; i++) {
          tx += tvx * 3;
          ty += tvy * 3;
          tvy += GRAVITY * 3;
          ctx.lineTo(tx, ty);
        }
        ctx.strokeStyle = `rgba(255, 255, 255, 0.2)`;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Projectiles
      state.projectiles.forEach(proj => {
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = WEAPONS[proj.type].color;
        ctx.fill();
      });

      // Particles
      state.particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      });

      // Explosions
      state.explosions.forEach(e => {
        const progress = 1 - (e.life / e.maxLife);
        const radius = e.radius * (0.2 + progress * 0.8);
        
        const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, radius);
        grad.addColorStop(0, `rgba(255, 255, 255, ${e.life / e.maxLife})`);
        grad.addColorStop(0.2, `${e.color}${Math.floor((e.life / e.maxLife) * 255).toString(16).padStart(2, '0')}`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.beginPath();
        ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        e.life--;
      });
      state.explosions = state.explosions.filter(e => e.life > 0);

      ctx.restore();
      animationFrameId = requestAnimationFrame(gameLoop);
    };

    if (isPlaying) animationFrameId = requestAnimationFrame(gameLoop);
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying]);

  // Game Over Check
  useEffect(() => {
    if (players[0].health <= 0 || players[1].health <= 0) {
      setGameOver(true);
      setIsPlaying(false);
    }
  }, [players]);

  const renderInventory = (playerIdx: 0 | 1) => {
    const p = players[playerIdx];
    const isCurrent = turn === playerIdx && isPlaying && stateRef.current.projectiles.length === 0;
    
    return (
      <div className={`flex gap-2 ${playerIdx === 1 ? 'flex-row-reverse' : ''}`}>
        {(Object.keys(WEAPONS) as WeaponType[]).map((w, i) => {
          const count = p.inventory[w];
          const isSelected = p.selectedWeapon === w;
          const config = WEAPONS[w];
          
          if (count === 0) return null;
          
          return (
            <div 
              key={w}
              onClick={() => isCurrent && setPlayers(prev => {
                const n = [...prev];
                n[playerIdx].selectedWeapon = w;
                return n;
              })}
              className={`
                relative flex items-center justify-center w-10 h-10 rounded border-2 transition-all
                ${isSelected ? 'border-green-400 bg-green-400/20 scale-110' : 'border-neutral-700 bg-neutral-800/50'}
                ${isCurrent ? 'cursor-pointer hover:border-green-300' : 'opacity-50'}
              `}
              title={`${config.name} (Key ${i+1})`}
            >
              <div style={{ color: config.color }}>{config.icon}</div>
              {count !== Infinity && (
                <div className="absolute -top-2 -right-2 bg-neutral-900 text-xs font-mono border border-neutral-600 rounded-full w-5 h-5 flex items-center justify-center">
                  {count}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="relative flex flex-col items-center bg-neutral-950 min-h-screen pt-8 font-sans text-white select-none">
      
      {/* HUD */}
      {gameMode !== 'menu' && (
        <div className="w-full max-w-[800px] flex justify-between items-start mb-4 px-2">
          {/* Player 1 Stats */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Shield className="text-blue-400" size={16} />
              <div className="w-32 h-3 bg-neutral-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all shadow-[0_0_8px_rgba(59,130,246,0.5)]" style={{ width: `${(players[0].health / MAX_HEALTH) * 100}%` }} />
              </div>
            </div>
            <div className="w-32 h-2 bg-neutral-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${players[0].fuel}%` }} />
            </div>
            {renderInventory(0)}
          </div>

          {/* Center Info */}
          <div className="flex flex-col items-center">
            <div className="flex gap-6 mb-2">
              <div className="text-center">
                <div className="text-[10px] text-neutral-500 uppercase tracking-widest">Angle</div>
                <div className="font-mono text-2xl text-green-400">{Math.floor(angle)}°</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-neutral-500 uppercase tracking-widest">Power</div>
                <div className="font-mono text-2xl text-green-400">{Math.floor(power)}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-neutral-500 uppercase tracking-widest">Wind</div>
                <div className="font-mono text-2xl text-white flex items-center gap-1">
                  {wind < -0.01 ? <Wind className="rotate-180" size={16}/> : (wind > 0.01 ? <Wind size={16}/> : '-')}
                  {Math.abs(Math.round(wind * 1000))}
                </div>
              </div>
            </div>
            <div className={`font-mono font-bold tracking-widest ${turn === 0 ? 'text-blue-400' : 'text-red-400'} animate-pulse`}>
              {message}
            </div>
          </div>

          {/* Player 2 Stats */}
          <div className="flex flex-col gap-2 items-end">
            <div className="flex items-center gap-2 flex-row-reverse">
              <Shield className="text-red-400" size={16} />
              <div className="w-32 h-3 bg-neutral-800 rounded-full overflow-hidden flex justify-end">
                <div className="h-full bg-red-500 transition-all shadow-[0_0_8px_rgba(239,68,68,0.5)]" style={{ width: `${(players[1].health / MAX_HEALTH) * 100}%` }} />
              </div>
            </div>
            <div className="w-32 h-2 bg-neutral-800 rounded-full overflow-hidden flex justify-end">
              <div className="h-full bg-red-500 transition-all" style={{ width: `${players[1].fuel}%` }} />
            </div>
            {renderInventory(1)}
          </div>
        </div>
      )}

      {/* Main Canvas Area */}
      <div className="relative rounded-xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-neutral-800">
        
        {/* Menus / Overlays */}
        {!isPlaying && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
            <h1 className="text-6xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-green-400 to-emerald-700 mb-2 drop-shadow-[0_0_15px_rgba(74,222,128,0.3)]">
              ARTILLERY
            </h1>
            
            {gameOver ? (
              <div className="text-center flex flex-col items-center">
                <h2 className={`text-4xl font-bold mb-8 ${players[0].health <= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                  {players[0].health <= 0 ? (gameMode === 'single' ? 'AI WINS!' : 'PLAYER 2 WINS!') : 'PLAYER 1 WINS!'}
                </h2>
                <button 
                  onClick={() => {
                    setGameMode('menu');
                    setGameOver(false);
                  }}
                  className="px-8 py-3 bg-neutral-800 hover:bg-neutral-700 rounded text-white font-bold tracking-widest transition-colors"
                >
                  MAIN MENU
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4 mt-8 w-64">
                <button 
                  onClick={() => startGame('single')}
                  className="group relative px-6 py-4 bg-neutral-900 border border-neutral-700 hover:border-green-500 rounded-lg overflow-hidden transition-all"
                >
                  <div className="absolute inset-0 bg-green-500/10 translate-y-full group-hover:translate-y-0 transition-transform" />
                  <span className="relative font-bold tracking-widest text-neutral-300 group-hover:text-white">VS COMPUTER</span>
                </button>
                <button 
                  onClick={() => startGame('multi')}
                  className="group relative px-6 py-4 bg-neutral-900 border border-neutral-700 hover:border-blue-500 rounded-lg overflow-hidden transition-all"
                >
                  <div className="absolute inset-0 bg-blue-500/10 translate-y-full group-hover:translate-y-0 transition-transform" />
                  <span className="relative font-bold tracking-widest text-neutral-300 group-hover:text-white">PASS & PLAY</span>
                </button>
                
                <div className="mt-8 text-xs text-neutral-500 text-center space-y-2">
                  <p>← → to Move (Uses Fuel)</p>
                  <p>Mouse to Aim</p>
                  <p>1-4 to Select Weapon</p>
                  <p>Click or Space to Fire</p>
                </div>
              </div>
            )}
          </div>
        )}

        <canvas 
          ref={canvasRef} 
          width={CANVAS_WIDTH} 
          height={CANVAS_HEIGHT}
          className="block bg-neutral-900"
        />
      </div>
    </div>
  );
}
