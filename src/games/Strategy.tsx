import React, { useEffect, useRef, useState } from 'react';

import { Aggression } from '../App';

const HEX_SIZE = 25;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

type Player = {
  id: number;
  name: string;
  color: string;
  isAI: boolean;
};

type Territory = {
  q: number;
  r: number;
  ownerId: number | null;
  units: number;
  unitsByDist: [number, number, number]; // [dist0, dist1, dist2]
};

type GamePhase = 'ATTACK' | 'REINFORCE';

export function Strategy({ aggression = 'NORMAL' }: { aggression?: Aggression }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  
  const [turnOwner, setTurnOwner] = useState(1);
  const [phase, setPhase] = useState<GamePhase>('ATTACK');
  const [unitsToPlace, setUnitsToPlace] = useState(0);
  const [selectedHex, setSelectedHex] = useState<{ q: number; r: number } | null>(null);

  const players: Player[] = [
    { id: 1, name: 'YOU', color: '#3b82f6', isAI: false },
    { id: 2, name: 'RED', color: '#ef4444', isAI: true },
    { id: 3, name: 'GREEN', color: '#22c55e', isAI: true },
    { id: 4, name: 'PURPLE', color: '#a855f7', isAI: true },
  ];

  const stateRef = useRef({
    grid: [] as Territory[],
    lastUpdate: 0
  });

  const playBeep = (freq: number, duration: number, type: OscillatorType = 'sine') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.log('Audio not supported');
    }
  };

  const getHexPos = (q: number, r: number) => {
    // Axial to pixel coordinates (pointy top)
    const x = HEX_SIZE * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r) + CANVAS_WIDTH / 2;
    const y = HEX_SIZE * (3 / 2 * r) + CANVAS_HEIGHT / 2;
    return { x, y };
  };

  const initMap = () => {
    const grid: Territory[] = [];
    const radius = 6;
    const holeChance = 0.2; // 20% chance of a hole

    // Generate grid with random holes
    for (let q = -radius; q <= radius; q++) {
      const r1 = Math.max(-radius, -q - radius);
      const r2 = Math.min(radius, -q + radius);
      for (let r = r1; r <= r2; r++) {
        if (Math.random() > holeChance) {
          grid.push({ q, r, ownerId: null, units: 1, unitsByDist: [1, 0, 0] });
        }
      }
    }

    // Ensure we have enough hexes and they are somewhat connected
    if (grid.length < 30) return initMap();

    // Assign starting positions randomly to available hexes
    const availableHexes = [...grid];
    for (let i = 1; i <= 4; i++) {
      if (availableHexes.length === 0) break;
      const index = Math.floor(Math.random() * availableHexes.length);
      const hex = availableHexes.splice(index, 1)[0];
      hex.ownerId = i;
      hex.units = 10;
      hex.unitsByDist = [10, 0, 0];
    }

    stateRef.current.grid = grid;
  };

  const startGame = () => {
    initMap();
    setGameOver(false);
    setWinner(null);
    setTurnOwner(1);
    setPhase('ATTACK');
    setUnitsToPlace(0);
    setSelectedHex(null);
    setIsPlaying(true);
  };

  const getNeighbors = (q: number, r: number) => {
    return [
      { q: q + 1, r: r }, { q: q - 1, r: r },
      { q: q, r: r + 1 }, { q: q, r: r - 1 },
      { q: q + 1, r: r - 1 }, { q: q - 1, r: r + 1 }
    ];
  };

  const calculateReinforcements = (playerId: number) => {
    const grid = stateRef.current.grid;
    const playerHexes = grid.filter(h => h.ownerId === playerId);
    if (playerHexes.length === 0) return 0;

    // Find contiguous regions
    let totalBonus = 0;
    const visited = new Set<string>();
    
    playerHexes.forEach(h => {
      const key = `${h.q},${h.r}`;
      if (!visited.has(key)) {
        let regionSize = 0;
        const queue = [h];
        visited.add(key);
        
        while (queue.length > 0) {
          const curr = queue.shift()!;
          regionSize++;
          getNeighbors(curr.q, curr.r).forEach(n => {
            const nHex = playerHexes.find(ph => ph.q === n.q && ph.r === n.r);
            const nKey = `${n.q},${n.r}`;
            if (nHex && !visited.has(nKey)) {
              visited.add(nKey);
              queue.push(nHex);
            }
          });
        }
        // Contiguous bonus: base 3 + size/2
        totalBonus += 3 + Math.floor(regionSize / 2);
      }
    });

    return totalBonus;
  };

  const nextTurn = () => {
    const grid = stateRef.current.grid;
    if (phase === 'ATTACK') {
      const bonus = calculateReinforcements(turnOwner);
      setUnitsToPlace(bonus);
      setPhase('REINFORCE');
      setSelectedHex(null);
    } else {
      let nextId = (turnOwner % 4) + 1;
      while (!grid.some(h => h.ownerId === nextId) && nextId !== turnOwner) {
        nextId = (nextId % 4) + 1;
      }

      // Reset movement distances for all units at the start of a new turn
      grid.forEach(h => {
        h.unitsByDist = [h.units, 0, 0];
      });

      setTurnOwner(nextId);
      setPhase('ATTACK');
      setSelectedHex(null);

      const nextPlayer = players.find(p => p.id === nextId);
      if (nextPlayer?.isAI) {
        setTimeout(() => runAI(nextId), 500);
      }
    }
  };

  const runAI = (playerId: number) => {
    const grid = stateRef.current.grid;
    
    // AI Attack Phase
    const myHexes = grid.filter(h => h.ownerId === playerId);
    myHexes.sort((a, b) => b.units - a.units);

    const aggressionConfig = {
      MILD: { minAttacker: 6, advantage: 1.5 },
      NORMAL: { minAttacker: 3, advantage: 1.1 },
      BRUTAL: { minAttacker: 2, advantage: 0.8 }
    }[aggression];

    myHexes.forEach(attacker => {
      const availableToMove = attacker.unitsByDist[0] + attacker.unitsByDist[1];
      if (availableToMove >= aggressionConfig.minAttacker) {
        const neighbors = getNeighbors(attacker.q, attacker.r);
        const targets = neighbors
          .map(n => grid.find(h => h.q === n.q && h.r === n.r))
          .filter(h => h && h.ownerId !== playerId) as Territory[];
        
        if (targets.length > 0) {
          const target = targets.reduce((prev, curr) => (curr.units < prev.units ? curr : prev));
          if (attacker.units > target.units * aggressionConfig.advantage) {
            executeAttack(attacker, target);
          }
        }
      }
    });

    // AI Reinforce Phase
    setTimeout(() => {
      const bonus = calculateReinforcements(playerId);
      const myUpdatedHexes = grid.filter(h => h.ownerId === playerId);
      if (myUpdatedHexes.length > 0) {
        const borderHexes = myUpdatedHexes.filter(h => {
          return getNeighbors(h.q, h.r).some(n => {
            const nh = grid.find(gh => gh.q === n.q && gh.r === n.r);
            return nh && nh.ownerId !== playerId;
          });
        });

        const targetHexes = borderHexes.length > 0 ? borderHexes : myUpdatedHexes;
        let remaining = bonus;
        while (remaining > 0) {
          const target = targetHexes[Math.floor(Math.random() * targetHexes.length)];
          target.units++;
          target.unitsByDist[0]++; // Reinforcements are stationary
          remaining--;
        }
      }
      
      // End AI Turn
      let nextId = (playerId % 4) + 1;
      while (!grid.some(h => h.ownerId === nextId) && nextId !== playerId) {
        nextId = (nextId % 4) + 1;
      }
      setTurnOwner(nextId);
      setPhase('ATTACK');
      
      const nextPlayer = players.find(p => p.id === nextId);
      if (nextPlayer?.isAI && nextId !== 1) {
        setTimeout(() => runAI(nextId), 500);
      }
    }, 1000);
  };

  const executeAttack = (from: Territory, to: Territory) => {
    if (from.units <= 1) return;

    if (to.ownerId === null) {
      // Unoccupied space: Move all units except 1
      to.ownerId = from.ownerId;
      
      const toMove = from.units - 1;
      const moved: [number, number, number] = [0, 0, 0];
      
      let remaining = toMove;
      // Take from dist0, then dist1, then dist2 (all can move in combat/expansion)
      for (let i = 0; i < 3; i++) {
        const count = Math.min(remaining, from.unitsByDist[i]);
        from.unitsByDist[i] -= count;
        moved[i] = count;
        remaining -= count;
      }
      
      // Add to target with dist + 1 (capped at 2 for tracking)
      to.unitsByDist = [0, 0, 0];
      to.unitsByDist[1] += moved[0];
      to.unitsByDist[2] += moved[1] + moved[2]; // Anything that was 1 or 2 is now "moved"
      
      to.units = to.unitsByDist.reduce((a, b) => a + b, 0);
      from.units = from.unitsByDist.reduce((a, b) => a + b, 0);
      
      playBeep(600, 0.1, 'sine');

      if (from.ownerId === 1) {
        setSelectedHex({ q: to.q, r: to.r });
      }
    } else {
      // Dice-based combat: All units participate
      const attackerRoll = Array.from({ length: from.units - 1 }, () => Math.floor(Math.random() * 6) + 1)
        .reduce((a, b) => a + b, 0);
      const defenderRoll = Array.from({ length: to.units }, () => Math.floor(Math.random() * 6) + 1)
        .reduce((a, b) => a + b, 0);

      if (attackerRoll > defenderRoll) {
        // Success!
        to.ownerId = from.ownerId;
        const diff = attackerRoll - defenderRoll;
        const attackingForce = from.units - 1;
        const finalUnits = Math.min(attackingForce, Math.max(1, diff));
        
        // Clear target units
        to.unitsByDist = [0, 0, 0];
        
        // Move units from source to target (all units can move in combat)
        let remaining = finalUnits;
        for (let i = 0; i < 3; i++) {
          const count = Math.min(remaining, from.unitsByDist[i]);
          from.unitsByDist[i] -= count;
          // Increment distance for redistribution tracking
          const nextDist = Math.min(2, i + 1);
          to.unitsByDist[nextDist] += count;
          remaining -= count;
        }
        
        to.units = to.unitsByDist.reduce((a, b) => a + b, 0);
        from.units = from.unitsByDist.reduce((a, b) => a + b, 0);
        
        playBeep(600, 0.1, 'sine');

        if (from.ownerId === 1) {
          setSelectedHex({ q: to.q, r: to.r });
        }
      } else {
        // Failure - attacker loses units
        let toLose = from.units - 1;
        for (let i = 0; i < 3; i++) {
          const count = Math.min(toLose, from.unitsByDist[i]);
          from.unitsByDist[i] -= count;
          toLose -= count;
        }
        from.units = from.unitsByDist.reduce((a, b) => a + b, 0);

        // Defender also sustains damage
        const diff = defenderRoll - attackerRoll;
        const defenderFinal = Math.min(to.units, Math.max(1, diff));
        let defenderLost = to.units - defenderFinal;
        for (let i = 0; i < 3; i++) {
          const count = Math.min(defenderLost, to.unitsByDist[i]);
          to.unitsByDist[i] -= count;
          defenderLost -= count;
        }
        to.units = to.unitsByDist.reduce((a, b) => a + b, 0);

        playBeep(200, 0.2, 'sawtooth');
      }
    }

    checkWinCondition();
  };

  const checkWinCondition = () => {
    const grid = stateRef.current.grid;
    const activePlayers = new Set<number>();
    grid.forEach(h => {
      if (h.ownerId !== null) activePlayers.add(h.ownerId);
    });

    if (activePlayers.size === 1) {
      const winnerId = Array.from(activePlayers)[0];
      setWinner(players.find(p => p.id === winnerId) || null);
      setGameOver(true);
      setIsPlaying(false);
    } else if (!activePlayers.has(1)) {
      setGameOver(true);
      setIsPlaying(false);
    }
  };

  const areConnected = (start: Territory, end: Territory, playerId: number) => {
    const grid = stateRef.current.grid;
    const visited = new Set<string>();
    const queue = [start];
    visited.add(`${start.q},${start.r}`);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr.q === end.q && curr.r === end.r) return true;

      getNeighbors(curr.q, curr.r).forEach(n => {
        const nHex = grid.find(gh => gh.q === n.q && gh.r === n.r);
        const key = `${n.q},${n.r}`;
        if (nHex && nHex.ownerId === playerId && !visited.has(key)) {
          visited.add(key);
          queue.push(nHex);
        }
      });
    }
    return false;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPlaying || gameOver || turnOwner !== 1) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const grid = stateRef.current.grid;
    let clickedHex: Territory | null = null;
    let minDist = Infinity;

    grid.forEach(h => {
      const { x, y } = getHexPos(h.q, h.r);
      const dist = Math.hypot(mx - x, my - y);
      if (dist < HEX_SIZE && dist < minDist) {
        minDist = dist;
        clickedHex = h;
      }
    });

    if (!clickedHex) return;

    if (phase === 'ATTACK') {
      if (!selectedHex) {
        if (clickedHex.ownerId === 1) {
          setSelectedHex({ q: clickedHex.q, r: clickedHex.r });
        }
      } else {
        const from = grid.find(h => h.q === selectedHex.q && h.r === selectedHex.r)!;
        
        if (clickedHex.q === selectedHex.q && clickedHex.r === selectedHex.r) {
          // Break focus by clicking the source hex
          setSelectedHex(null);
        } else if (clickedHex.ownerId === 1) {
          // Friendly hex: Check if neighbor for one-by-one transfer
          const neighbors = getNeighbors(selectedHex.q, selectedHex.r);
          const isNeighbor = neighbors.some(n => n.q === clickedHex!.q && n.r === clickedHex!.r);
          
          if (isNeighbor) {
            // Transfer one by one
            // Only units with dist < 2 can move
            const availableToMove = from.unitsByDist[0] + from.unitsByDist[1];
            if (from.units > 1 && availableToMove > 0) {
              // Take one unit: priority dist0 then dist1
              if (from.unitsByDist[0] > 0) {
                from.unitsByDist[0]--;
                clickedHex.unitsByDist[1]++;
              } else {
                from.unitsByDist[1]--;
                clickedHex.unitsByDist[2]++;
              }
              from.units = from.unitsByDist.reduce((a, b) => a + b, 0);
              clickedHex.units = clickedHex.unitsByDist.reduce((a, b) => a + b, 0);
              playBeep(800, 0.05, 'sine');
            }
            // Selection remains on "from" to allow multiple transfers
          } else {
            // Not a neighbor: switch focus to the new friendly hex
            setSelectedHex({ q: clickedHex.q, r: clickedHex.r });
          }
        } else {
          // Enemy or neutral hex: Check if neighbor for attack
          const neighbors = getNeighbors(selectedHex.q, selectedHex.r);
          const isNeighbor = neighbors.some(n => n.q === clickedHex!.q && n.r === clickedHex!.r);
          
          if (isNeighbor) {
            executeAttack(from, clickedHex);
            setSelectedHex(null);
          }
        }
      }
    } else if (phase === 'REINFORCE') {
      if (clickedHex.ownerId === 1 && unitsToPlace > 0) {
        clickedHex.units++;
        clickedHex.unitsByDist[0]++; // Reinforcements are stationary
        setUnitsToPlace(prev => prev - 1);
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawHex = (x: number, y: number, size: number, color: string, isSelected: boolean, units: number) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i - 30);
        const px = x + size * Math.cos(angle);
        const py = y + size * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      
      ctx.fillStyle = color;
      ctx.fill();
      
      ctx.strokeStyle = isSelected ? '#fff' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.floor(units).toString(), x, y);
    };

    const render = () => {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const grid = stateRef.current.grid;
      grid.forEach(h => {
        const { x, y } = getHexPos(h.q, h.r);
        const owner = players.find(p => p.id === h.ownerId);
        const color = owner ? owner.color + '88' : '#222';
        const isSelected = selectedHex?.q === h.q && selectedHex?.r === h.r;
        drawHex(x, y, HEX_SIZE, color, isSelected, h.units);
      });

      requestAnimationFrame(render);
    };

    const animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [selectedHex]);

  return (
    <div className="relative flex flex-col items-center bg-neutral-900 p-4 rounded-xl border border-white/10 shadow-2xl">
      <div className="w-full flex justify-between items-center mb-4 px-4">
        <div className="flex gap-4">
          {players.map(p => (
            <div key={p.id} className={`flex items-center gap-2 px-3 py-1 rounded-full transition-all ${turnOwner === p.id ? 'bg-white/10 scale-110 shadow-lg' : 'opacity-50'}`}>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }}></div>
              <span className="text-[10px] font-arcade uppercase tracking-tighter">{p.name}</span>
            </div>
          ))}
        </div>
        
        {isPlaying && (
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-neutral-500 uppercase font-arcade">Phase</span>
              <span className={`text-sm font-arcade ${phase === 'ATTACK' ? 'text-red-400' : 'text-blue-400'}`}>{phase}</span>
            </div>
            {phase === 'REINFORCE' && turnOwner === 1 && (
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-neutral-500 uppercase font-arcade">Armies</span>
                <span className="text-sm font-arcade text-white">{unitsToPlace}</span>
              </div>
            )}
            {turnOwner === 1 && (
              <button 
                onClick={nextTurn}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/20 rounded font-arcade text-[10px] uppercase tracking-widest transition-colors"
              >
                {phase === 'ATTACK' ? 'End Attack' : 'End Turn'}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <canvas 
          ref={canvasRef} 
          width={CANVAS_WIDTH} 
          height={CANVAS_HEIGHT}
          onClick={handleCanvasClick}
          className="block bg-black rounded-lg shadow-inner cursor-pointer"
        />

        {!isPlaying && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center rounded-lg backdrop-blur-sm">
            <h2 className="font-arcade text-6xl text-blue-500 mb-8 neon-text tracking-tighter">HEX STRATEGY</h2>
            {gameOver && (
              <div className="text-center mb-12 animate-bounce">
                <p className="font-arcade text-red-500 text-3xl mb-2">WAR OVER</p>
                {winner && <p className="text-white text-2xl font-arcade">{winner.name} CONQUERED ALL</p>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-8 text-neutral-400 font-retro text-lg mb-12 max-w-xl">
              <div className="space-y-2">
                <p className="text-white font-arcade text-sm mb-4">ATTACK PHASE</p>
                <p>• Click your hex to select</p>
                <p>• Click neighbor to attack/move</p>
              </div>
              <div className="space-y-2">
                <p className="text-white font-arcade text-sm mb-4">REINFORCE PHASE</p>
                <p>• Contiguous land = more units</p>
                <p>• Click your hexes to place</p>
              </div>
            </div>
            <button 
              onClick={startGame}
              className="px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white font-arcade text-xl rounded-full transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(59,130,246,0.5)]"
            >
              INITIALIZE CAMPAIGN
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 text-[10px] text-neutral-500 font-arcade uppercase tracking-widest">
        Contiguous territories grant production bonuses
      </div>
    </div>
  );
}
