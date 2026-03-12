import React, { useState, useEffect, useCallback } from 'react';
import { Users, User, ArrowRight, ArrowDown } from 'lucide-react';

type Player = 1 | 2;
type Position = { r: number; c: number };
type Orientation = 'H' | 'V';

const hasWallBetween = (r1: number, c1: number, r2: number, c2: number, hWalls: Set<string>, vWalls: Set<string>) => {
  if (r1 === r2) {
    const minC = Math.min(c1, c2);
    if (vWalls.has(`${r1},${minC}`) || vWalls.has(`${r1 - 1},${minC}`)) return true;
  } else if (c1 === c2) {
    const minR = Math.min(r1, r2);
    if (hWalls.has(`${minR},${c1}`) || hWalls.has(`${minR},${c1 - 1}`)) return true;
  }
  return false;
};

const canReachGoal = (startR: number, startC: number, player: Player, hWalls: Set<string>, vWalls: Set<string>) => {
  const targetRow = player === 1 ? 0 : 8;
  const visited = new Set<string>();
  const queue = [{ r: startR, c: startC }];
  visited.add(`${startR},${startC}`);

  let head = 0;
  while (head < queue.length) {
    const { r, c } = queue[head++];
    if (r === targetRow) return true;

    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) {
        if (!visited.has(`${nr},${nc}`) && !hasWallBetween(r, c, nr, nc, hWalls, vWalls)) {
          visited.add(`${nr},${nc}`);
          queue.push({ r: nr, c: nc });
        }
      }
    }
  }
  return false;
};

const getValidMoves = (playerPos: Position, opponentPos: Position, hWalls: Set<string>, vWalls: Set<string>) => {
  const moves: Position[] = [];
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (const [dr, dc] of dirs) {
    const nr = playerPos.r + dr;
    const nc = playerPos.c + dc;

    if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9 && !hasWallBetween(playerPos.r, playerPos.c, nr, nc, hWalls, vWalls)) {
      if (nr === opponentPos.r && nc === opponentPos.c) {
        const nnr = nr + dr;
        const nnc = nc + dc;
        let straightBlocked = false;

        if (nnr >= 0 && nnr < 9 && nnc >= 0 && nnc < 9 && !hasWallBetween(nr, nc, nnr, nnc, hWalls, vWalls)) {
          moves.push({ r: nnr, c: nnc });
        } else {
          straightBlocked = true;
        }

        if (straightBlocked) {
          const diagDirs = dr !== 0 ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
          for (const [ddr, ddc] of diagDirs) {
            const dnr = nr + ddr;
            const dnc = nc + ddc;
            if (dnr >= 0 && dnr < 9 && dnc >= 0 && dnc < 9 && !hasWallBetween(nr, nc, dnr, dnc, hWalls, vWalls)) {
              moves.push({ r: dnr, c: dnc });
            }
          }
        }
      } else {
        moves.push({ r: nr, c: nc });
      }
    }
  }
  return moves;
};

const isValidWall = (r: number, c: number, orientation: Orientation, hWalls: Set<string>, vWalls: Set<string>, p1Pos: Position, p2Pos: Position) => {
  if (r < 0 || r > 7 || c < 0 || c > 7) return false;

  if (orientation === 'H') {
    if (hWalls.has(`${r},${c}`) || hWalls.has(`${r},${c - 1}`) || hWalls.has(`${r},${c + 1}`)) return false;
    if (vWalls.has(`${r},${c}`)) return false;
  } else {
    if (vWalls.has(`${r},${c}`) || vWalls.has(`${r - 1},${c}`) || vWalls.has(`${r + 1},${c}`)) return false;
    if (hWalls.has(`${r},${c}`)) return false;
  }

  const newHWalls = new Set(hWalls);
  const newVWalls = new Set(vWalls);
  if (orientation === 'H') newHWalls.add(`${r},${c}`);
  else newVWalls.add(`${r},${c}`);

  if (!canReachGoal(p1Pos.r, p1Pos.c, 1, newHWalls, newVWalls)) return false;
  if (!canReachGoal(p2Pos.r, p2Pos.c, 2, newHWalls, newVWalls)) return false;

  return true;
};

export const Quoridor: React.FC<{ aggression?: string }> = ({ aggression = 'NORMAL' }) => {
  const [gameMode, setGameMode] = useState<'menu' | 'single' | 'multi'>('menu');
  const [currentPlayer, setCurrentPlayer] = useState<Player>(1);
  const [p1Pos, setP1Pos] = useState<Position>({ r: 8, c: 4 });
  const [p2Pos, setP2Pos] = useState<Position>({ r: 0, c: 4 });
  const [p1Walls, setP1Walls] = useState(10);
  const [p2Walls, setP2Walls] = useState(10);
  const [hWalls, setHWalls] = useState<Set<string>>(new Set());
  const [vWalls, setVWalls] = useState<Set<string>>(new Set());
  const [actionType, setActionType] = useState<'move' | 'wall'>('move');
  const [wallOrientation, setWallOrientation] = useState<Orientation>('H');
  const [hoverWall, setHoverWall] = useState<{ r: number; c: number } | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);

  const initGame = (mode: 'single' | 'multi') => {
    setGameMode(mode);
    setCurrentPlayer(1);
    setP1Pos({ r: 8, c: 4 });
    setP2Pos({ r: 0, c: 4 });
    setP1Walls(10);
    setP2Walls(10);
    setHWalls(new Set());
    setVWalls(new Set());
    setActionType('move');
    setWallOrientation('H');
    setGameOver(false);
    setWinner(null);
  };

  const handleCellClick = (r: number, c: number) => {
    if (gameOver || actionType !== 'move') return;
    if (gameMode === 'single' && currentPlayer === 2) return;

    const currentPos = currentPlayer === 1 ? p1Pos : p2Pos;
    const opponentPos = currentPlayer === 1 ? p2Pos : p1Pos;
    const validMoves = getValidMoves(currentPos, opponentPos, hWalls, vWalls);

    if (validMoves.some(m => m.r === r && m.c === c)) {
      applyMove({ r, c });
    }
  };

  const applyMove = (pos: Position) => {
    if (currentPlayer === 1) {
      setP1Pos(pos);
      if (pos.r === 0) {
        setGameOver(true);
        setWinner(1);
        return;
      }
    } else {
      setP2Pos(pos);
      if (pos.r === 8) {
        setGameOver(true);
        setWinner(2);
        return;
      }
    }
    setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
    setActionType('move');
  };

  const handleWallClick = (r: number, c: number) => {
    if (gameOver || actionType !== 'wall') return;
    if (gameMode === 'single' && currentPlayer === 2) return;
    
    const wallsLeft = currentPlayer === 1 ? p1Walls : p2Walls;
    if (wallsLeft <= 0) return;

    if (isValidWall(r, c, wallOrientation, hWalls, vWalls, p1Pos, p2Pos)) {
      applyWall(r, c, wallOrientation);
    }
  };

  const applyWall = (r: number, c: number, orientation: Orientation) => {
    if (orientation === 'H') {
      setHWalls(new Set(hWalls).add(`${r},${c}`));
    } else {
      setVWalls(new Set(vWalls).add(`${r},${c}`));
    }

    if (currentPlayer === 1) setP1Walls(p1Walls - 1);
    else setP2Walls(p2Walls - 1);

    setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
    setActionType('move');
  };

  // Simple AI
  useEffect(() => {
    if (gameMode === 'single' && currentPlayer === 2 && !gameOver) {
      const timer = setTimeout(() => {
        const getShortestPath = (startPos: Position, targetRow: number, currentHWalls: Set<string>, currentVWalls: Set<string>) => {
          const visited = new Set<string>();
          const queue: { pos: Position, path: Position[] }[] = [{ pos: startPos, path: [] }];
          visited.add(`${startPos.r},${startPos.c}`);

          while (queue.length > 0) {
            const { pos, path } = queue.shift()!;
            if (pos.r === targetRow) return path;

            const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            for (const [dr, dc] of dirs) {
              const nr = pos.r + dr;
              const nc = pos.c + dc;
              if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9 && !hasWallBetween(pos.r, pos.c, nr, nc, currentHWalls, currentVWalls)) {
                if (!visited.has(`${nr},${nc}`)) {
                  visited.add(`${nr},${nc}`);
                  queue.push({ pos: { r: nr, c: nc }, path: [...path, { r: nr, c: nc }] });
                }
              }
            }
          }
          return null;
        };

        const aiPath = getShortestPath(p2Pos, 8, hWalls, vWalls);
        const playerPath = getShortestPath(p1Pos, 0, hWalls, vWalls);

        let bestMove: Position | null = null;
        let bestWall: { r: number, c: number, o: Orientation } | null = null;

        if (aiPath && playerPath) {
          let shouldBlock = false;
          if (aggression === 'BRUTAL' && p2Walls > 0) {
            shouldBlock = true;
          } else if (aggression === 'NORMAL' && p2Walls > 0) {
            if (playerPath.length <= aiPath.length + 1) shouldBlock = true;
          }

          if (shouldBlock) {
            let maxAdvantage = playerPath.length - aiPath.length;

            const wallCandidates: { r: number, c: number, o: Orientation }[] = [];
            for (let i = 0; i < Math.min(4, playerPath.length); i++) {
              const p = playerPath[i];
              wallCandidates.push({ r: p.r, c: p.c, o: 'H' });
              wallCandidates.push({ r: p.r - 1, c: p.c, o: 'H' });
              wallCandidates.push({ r: p.r, c: p.c, o: 'V' });
              wallCandidates.push({ r: p.r, c: p.c - 1, o: 'V' });
            }

            for (const wc of wallCandidates) {
              if (isValidWall(wc.r, wc.c, wc.o, hWalls, vWalls, p1Pos, p2Pos)) {
                const newHWalls = new Set<string>(hWalls);
                const newVWalls = new Set<string>(vWalls);
                if (wc.o === 'H') newHWalls.add(`${wc.r},${wc.c}`);
                else newVWalls.add(`${wc.r},${wc.c}`);

                const newAiPath = getShortestPath(p2Pos, 8, newHWalls, newVWalls);
                const newPlayerPath = getShortestPath(p1Pos, 0, newHWalls, newVWalls);

                if (newAiPath && newPlayerPath) {
                  const advantage = newPlayerPath.length - newAiPath.length;
                  if (advantage > maxAdvantage) {
                    maxAdvantage = advantage;
                    bestWall = wc;
                  }
                }
              }
            }
          }

          if (bestWall) {
            applyWall(bestWall.r, bestWall.c, bestWall.o);
            return;
          } else {
            const validMoves = getValidMoves(p2Pos, p1Pos, hWalls, vWalls);
            let minPathLen = Infinity;
            for (const m of validMoves) {
              const path = getShortestPath(m, 8, hWalls, vWalls);
              if (path && path.length < minPathLen) {
                minPathLen = path.length;
                bestMove = m;
              }
            }
            if (!bestMove && validMoves.length > 0) bestMove = validMoves[0];
          }
        }

        if (bestMove) {
          applyMove(bestMove);
        } else {
          const moves = getValidMoves(p2Pos, p1Pos, hWalls, vWalls);
          if (moves.length > 0) applyMove(moves[0]);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentPlayer, gameMode, gameOver, p1Pos, p2Pos, hWalls, vWalls, p2Walls, aggression]);

  if (gameMode === 'menu') {
    return (
      <div className="w-[800px] h-[600px] bg-neutral-900 flex flex-col items-center justify-center font-retro text-white">
        <h1 className="text-6xl text-amber-500 mb-12 tracking-widest">QUORIDOR</h1>
        <div className="flex gap-8">
          <button
            onClick={() => initGame('single')}
            className="flex flex-col items-center gap-4 p-8 bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-colors border-2 border-amber-900 hover:border-amber-500"
          >
            <User size={48} className="text-amber-400" />
            <span className="text-xl">1 PLAYER</span>
            <span className="text-sm text-neutral-400">vs AI</span>
          </button>
          <button
            onClick={() => initGame('multi')}
            className="flex flex-col items-center gap-4 p-8 bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-colors border-2 border-amber-900 hover:border-amber-500"
          >
            <Users size={48} className="text-amber-400" />
            <span className="text-xl">2 PLAYERS</span>
            <span className="text-sm text-neutral-400">Local</span>
          </button>
        </div>
      </div>
    );
  }

  const currentPos = currentPlayer === 1 ? p1Pos : p2Pos;
  const opponentPos = currentPlayer === 1 ? p2Pos : p1Pos;
  const validMoves = actionType === 'move' ? getValidMoves(currentPos, opponentPos, hWalls, vWalls) : [];
  const wallsLeft = currentPlayer === 1 ? p1Walls : p2Walls;

  return (
    <div className="w-[800px] h-[600px] bg-neutral-900 flex flex-col items-center justify-center font-retro text-white relative select-none">
      
      {/* HUD */}
      <div className="flex justify-between w-[500px] mb-4">
        <div className={`flex flex-col items-center p-3 rounded-lg ${currentPlayer === 1 ? 'bg-neutral-800 border-2 border-blue-500' : 'bg-neutral-800/50 border-2 border-transparent'}`}>
          <span className="text-blue-400 font-bold">PLAYER 1</span>
          <span className="text-sm text-neutral-400">Walls: {p1Walls}</span>
        </div>
        
        <div className="flex flex-col items-center justify-center gap-2">
          {currentPlayer === 1 || (gameMode === 'multi') ? (
            <div className="flex gap-2">
              <button 
                onClick={() => setActionType('move')}
                className={`px-4 py-2 rounded font-bold ${actionType === 'move' ? 'bg-amber-600 text-white' : 'bg-neutral-700 text-neutral-400'}`}
              >
                MOVE
              </button>
              <button 
                onClick={() => setActionType('wall')}
                disabled={wallsLeft === 0}
                className={`px-4 py-2 rounded font-bold flex items-center gap-1 ${actionType === 'wall' ? 'bg-amber-600 text-white' : 'bg-neutral-700 text-neutral-400'} ${wallsLeft === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                WALL
                {actionType === 'wall' && (
                  <span 
                    onClick={(e) => { e.stopPropagation(); setWallOrientation(w => w === 'H' ? 'V' : 'H'); }}
                    className="ml-2 p-1 bg-amber-800 hover:bg-amber-700 rounded cursor-pointer"
                  >
                    {wallOrientation === 'H' ? <ArrowRight size={14} /> : <ArrowDown size={14} />}
                  </span>
                )}
              </button>
            </div>
          ) : (
            <span className="text-amber-500 animate-pulse">AI THINKING...</span>
          )}
        </div>

        <div className={`flex flex-col items-center p-3 rounded-lg ${currentPlayer === 2 ? 'bg-neutral-800 border-2 border-red-500' : 'bg-neutral-800/50 border-2 border-transparent'}`}>
          <span className="text-red-400 font-bold">PLAYER 2</span>
          <span className="text-sm text-neutral-400">Walls: {p2Walls}</span>
        </div>
      </div>

      {/* Board */}
      <div className="bg-amber-900/30 p-4 rounded-xl border-4 border-amber-900 shadow-[0_0_30px_rgba(120,53,15,0.5)]">
        <div 
          className="relative" 
          style={{ width: 9 * 40 + 8 * 10, height: 9 * 40 + 8 * 10 }}
          onMouseLeave={() => setHoverWall(null)}
        >
          {/* Cells */}
          {Array.from({ length: 9 }).map((_, r) => 
            Array.from({ length: 9 }).map((_, c) => {
              const isP1 = p1Pos.r === r && p1Pos.c === c;
              const isP2 = p2Pos.r === r && p2Pos.c === c;
              const isMoveValid = validMoves.some(m => m.r === r && m.c === c);
              
              return (
                <div 
                  key={`cell-${r}-${c}`}
                  onClick={() => handleCellClick(r, c)}
                  className={`absolute w-[40px] h-[40px] rounded flex items-center justify-center transition-colors
                    ${isMoveValid ? 'bg-amber-700/50 cursor-pointer hover:bg-amber-600/80' : 'bg-amber-950'}
                  `}
                  style={{ left: c * 50, top: r * 50 }}
                >
                  {isP1 && <div className="w-6 h-6 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />}
                  {isP2 && <div className="w-6 h-6 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" />}
                  {isMoveValid && !isP1 && !isP2 && <div className="w-2 h-2 rounded-full bg-amber-400/50" />}
                </div>
              );
            })
          )}

          {/* Placed Horizontal Walls */}
          {Array.from<string>(hWalls).map(w => {
            const [r, c] = w.split(',').map(Number);
            return (
              <div 
                key={`hw-${r}-${c}`}
                className="absolute h-[10px] w-[90px] bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.8)] z-10"
                style={{ left: c * 50, top: r * 50 + 40 }}
              />
            );
          })}

          {/* Placed Vertical Walls */}
          {Array.from<string>(vWalls).map(w => {
            const [r, c] = w.split(',').map(Number);
            return (
              <div 
                key={`vw-${r}-${c}`}
                className="absolute w-[10px] h-[90px] bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.8)] z-10"
                style={{ left: c * 50 + 40, top: r * 50 }}
              />
            );
          })}

          {/* Wall Placement Interaction Areas */}
          {actionType === 'wall' && Array.from({ length: 8 }).map((_, r) => 
            Array.from({ length: 8 }).map((_, c) => {
              const isHovered = hoverWall?.r === r && hoverWall?.c === c;
              const valid = isHovered ? isValidWall(r, c, wallOrientation, hWalls, vWalls, p1Pos, p2Pos) : false;
              
              return (
                <div 
                  key={`wall-int-${r}-${c}`}
                  className="absolute w-[50px] h-[50px] z-20 cursor-pointer"
                  style={{ left: c * 50 + 20, top: r * 50 + 20 }}
                  onMouseEnter={() => setHoverWall({ r, c })}
                  onClick={() => handleWallClick(r, c)}
                >
                  {isHovered && (
                    <div 
                      className={`absolute rounded-full transition-all ${valid ? 'bg-amber-400/80 shadow-[0_0_10px_rgba(251,191,36,0.8)]' : 'bg-red-500/80'}`}
                      style={wallOrientation === 'H' 
                        ? { width: 90, height: 10, left: -20, top: 20 } 
                        : { width: 10, height: 90, left: 20, top: -20 }
                      }
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {gameOver && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-30">
          <h2 className={`text-6xl font-bold mb-4 ${winner === 1 ? 'text-blue-500' : 'text-red-500'}`}>
            {winner === 1 ? 'PLAYER 1 WINS!' : (gameMode === 'single' ? 'AI WINS!' : 'PLAYER 2 WINS!')}
          </h2>
          <button 
            onClick={() => setGameMode('menu')}
            className="px-8 py-4 bg-amber-600 hover:bg-amber-500 rounded text-xl transition-colors mt-8"
          >
            MAIN MENU
          </button>
        </div>
      )}
    </div>
  );
};
