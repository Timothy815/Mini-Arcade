import React, { useState, useEffect } from 'react';
import { Users, User } from 'lucide-react';

type Player = 1 | 2; // 1: Black, 2: White
type Board = number[][]; // 0: Empty, 1: Black, 2: White

const BOARD_SIZE = 8;

const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

export const Reversi: React.FC<{ aggression?: string }> = ({ aggression = 'NORMAL' }) => {
  const [board, setBoard] = useState<Board>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player>(1);
  const [gameMode, setGameMode] = useState<'menu' | 'single' | 'multi'>('menu');
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<number>(0);
  const [blackCount, setBlackCount] = useState(2);
  const [whiteCount, setWhiteCount] = useState(2);

  const initGame = (mode: 'single' | 'multi') => {
    const newBoard = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0));
    newBoard[3][3] = 2;
    newBoard[3][4] = 1;
    newBoard[4][3] = 1;
    newBoard[4][4] = 2;
    setBoard(newBoard);
    setCurrentPlayer(1);
    setGameMode(mode);
    setGameOver(false);
    setWinner(0);
    setBlackCount(2);
    setWhiteCount(2);
  };

  const isValidMove = (r: number, c: number, player: Player, currentBoard: Board): boolean => {
    if (currentBoard[r][c] !== 0) return false;
    let valid = false;
    for (const [dr, dc] of DIRECTIONS) {
      let nr = r + dr;
      let nc = c + dc;
      let foundOpponent = false;
      while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
        if (currentBoard[nr][nc] === 0) break;
        if (currentBoard[nr][nc] === (player === 1 ? 2 : 1)) {
          foundOpponent = true;
        } else if (currentBoard[nr][nc] === player) {
          if (foundOpponent) valid = true;
          break;
        }
        nr += dr;
        nc += dc;
      }
      if (valid) return true;
    }
    return false;
  };

  const getValidMoves = (player: Player, currentBoard: Board) => {
    const moves: { r: number; c: number }[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (isValidMove(r, c, player, currentBoard)) {
          moves.push({ r, c });
        }
      }
    }
    return moves;
  };

  const makeMove = (r: number, c: number, player: Player, currentBoard: Board): Board => {
    const newBoard = currentBoard.map(row => [...row]);
    newBoard[r][c] = player;
    for (const [dr, dc] of DIRECTIONS) {
      let nr = r + dr;
      let nc = c + dc;
      let foundOpponent = false;
      const flips: { r: number; c: number }[] = [];
      while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
        if (newBoard[nr][nc] === 0) break;
        if (newBoard[nr][nc] === (player === 1 ? 2 : 1)) {
          foundOpponent = true;
          flips.push({ r: nr, c: nc });
        } else if (newBoard[nr][nc] === player) {
          if (foundOpponent) {
            flips.forEach(flip => {
              newBoard[flip.r][flip.c] = player;
            });
          }
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
    return newBoard;
  };

  const handleCellClick = (r: number, c: number) => {
    if (gameOver || gameMode === 'menu') return;
    if (gameMode === 'single' && currentPlayer === 2) return;

    if (isValidMove(r, c, currentPlayer, board)) {
      applyMove(r, c, currentPlayer, board);
    }
  };

  const applyMove = (r: number, c: number, player: Player, currentBoard: Board) => {
    const newBoard = makeMove(r, c, player, currentBoard);
    setBoard(newBoard);

    let b = 0, w = 0;
    newBoard.forEach(row => row.forEach(cell => {
      if (cell === 1) b++;
      if (cell === 2) w++;
    }));
    setBlackCount(b);
    setWhiteCount(w);

    const nextPlayer = player === 1 ? 2 : 1;
    const nextMoves = getValidMoves(nextPlayer, newBoard);

    if (nextMoves.length > 0) {
      setCurrentPlayer(nextPlayer);
    } else {
      const currentMoves = getValidMoves(player, newBoard);
      if (currentMoves.length === 0) {
        setGameOver(true);
        if (b > w) setWinner(1);
        else if (w > b) setWinner(2);
        else setWinner(0);
      } else {
        // Next player skips turn, keep current player
        // In a real game, we might want to show a "Pass" message
      }
    }
  };

  useEffect(() => {
    if (gameMode === 'single' && currentPlayer === 2 && !gameOver) {
      const timer = setTimeout(() => {
        const moves = getValidMoves(2, board);
        if (moves.length > 0) {
          let bestMove = moves[0];
          let maxScore = -Infinity;

          const POSITIONAL_WEIGHTS = [
            [100, -20, 10,  5,  5, 10, -20, 100],
            [-20, -50, -2, -2, -2, -2, -50, -20],
            [ 10,  -2, -1, -1, -1, -1,  -2,  10],
            [  5,  -2, -1, -1, -1, -1,  -2,   5],
            [  5,  -2, -1, -1, -1, -1,  -2,   5],
            [ 10,  -2, -1, -1, -1, -1,  -2,  10],
            [-20, -50, -2, -2, -2, -2, -50, -20],
            [100, -20, 10,  5,  5, 10, -20, 100],
          ];

          moves.forEach(move => {
            const testBoard = makeMove(move.r, move.c, 2, board);
            let flips = 0;
            testBoard.forEach((row, r) => row.forEach((cell, c) => { 
              if (cell === 2 && board[r][c] !== 2) flips++; 
            }));
            
            let score = flips;
            if (aggression === 'NORMAL') {
              score += POSITIONAL_WEIGHTS[move.r][move.c];
            } else if (aggression === 'BRUTAL') {
              score += POSITIONAL_WEIGHTS[move.r][move.c] * 3; // Heavily prioritize position
            }

            if (score > maxScore) {
              maxScore = score;
              bestMove = move;
            }
          });

          applyMove(bestMove.r, bestMove.c, 2, board);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentPlayer, gameMode, gameOver, board, aggression]);

  if (gameMode === 'menu') {
    return (
      <div className="w-[800px] h-[600px] bg-neutral-900 flex flex-col items-center justify-center font-retro text-white">
        <h1 className="text-6xl text-emerald-500 mb-12 tracking-widest">REVERSI</h1>
        <div className="flex gap-8">
          <button
            onClick={() => initGame('single')}
            className="flex flex-col items-center gap-4 p-8 bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-colors border-2 border-emerald-900 hover:border-emerald-500"
          >
            <User size={48} className="text-emerald-400" />
            <span className="text-xl">1 PLAYER</span>
            <span className="text-sm text-neutral-400">vs AI</span>
          </button>
          <button
            onClick={() => initGame('multi')}
            className="flex flex-col items-center gap-4 p-8 bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-colors border-2 border-emerald-900 hover:border-emerald-500"
          >
            <Users size={48} className="text-emerald-400" />
            <span className="text-xl">2 PLAYERS</span>
            <span className="text-sm text-neutral-400">Local</span>
          </button>
        </div>
      </div>
    );
  }

  const validMoves = getValidMoves(currentPlayer, board);

  return (
    <div className="w-[800px] h-[600px] bg-neutral-900 flex flex-col items-center justify-center font-retro text-white relative select-none">
      <div className="flex justify-between w-[500px] mb-6">
        <div className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${currentPlayer === 1 ? 'bg-neutral-800 border-2 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-neutral-800/50 border-2 border-transparent'}`}>
          <div className="w-8 h-8 rounded-full bg-black border-2 border-neutral-700 shadow-[0_0_10px_rgba(0,0,0,0.5)]" />
          <div className="flex flex-col">
            <span className="text-sm text-neutral-400">BLACK</span>
            <span className="text-2xl font-bold">{blackCount}</span>
          </div>
        </div>

        <div className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${currentPlayer === 2 ? 'bg-neutral-800 border-2 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-neutral-800/50 border-2 border-transparent'}`}>
          <div className="flex flex-col items-end">
            <span className="text-sm text-neutral-400">WHITE</span>
            <span className="text-2xl font-bold">{whiteCount}</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
        </div>
      </div>

      <div className="bg-emerald-800 p-2 rounded-lg shadow-[0_0_30px_rgba(6,78,59,0.5)]">
        <div className="grid grid-cols-8 gap-1 bg-emerald-950 p-1">
          {board.map((row, r) => row.map((cell, c) => {
            const isHint = validMoves.some(m => m.r === r && m.c === c);
            return (
              <div
                key={`${r}-${c}`}
                onClick={() => handleCellClick(r, c)}
                className={`w-[50px] h-[50px] bg-emerald-600 flex items-center justify-center transition-colors relative
                  ${isHint && (gameMode === 'multi' || currentPlayer === 1) ? 'cursor-pointer hover:bg-emerald-500' : ''}
                `}
              >
                {cell === 1 && <div className="w-10 h-10 rounded-full bg-black shadow-[inset_-2px_-2px_6px_rgba(255,255,255,0.2),2px_2px_4px_rgba(0,0,0,0.5)]" />}
                {cell === 2 && <div className="w-10 h-10 rounded-full bg-white shadow-[inset_-2px_-2px_6px_rgba(0,0,0,0.2),2px_2px_4px_rgba(0,0,0,0.5)]" />}
                {isHint && cell === 0 && (gameMode === 'multi' || currentPlayer === 1) && (
                  <div className="w-3 h-3 rounded-full bg-emerald-900/50" />
                )}
              </div>
            );
          }))}
        </div>
      </div>

      {gameOver && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-10">
          <h2 className="text-6xl font-bold mb-4 text-emerald-400">GAME OVER</h2>
          <p className="text-2xl mb-8">
            {winner === 1 ? 'BLACK WINS!' : winner === 2 ? (gameMode === 'single' ? 'AI WINS!' : 'WHITE WINS!') : 'IT\'S A TIE!'}
          </p>
          <button
            onClick={() => setGameMode('menu')}
            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 rounded text-xl transition-colors"
          >
            MAIN MENU
          </button>
        </div>
      )}
    </div>
  );
};
