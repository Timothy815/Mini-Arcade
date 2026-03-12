import React from 'react';
import { GameDef } from '../App';
import { Play, Construction } from 'lucide-react';

interface HubProps {
  games: GameDef[];
  onSelectGame: (id: string) => void;
}

export function Hub({ games, onSelectGame }: HubProps) {
  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="text-center mb-12">
        <h2 className="font-arcade text-3xl mb-4 text-white tracking-widest">SELECT GAME</h2>
        <p className="text-2xl text-neutral-400">Insert Coin to Play</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {games.map((game) => (
          <div 
            key={game.id}
            className={`relative group rounded-xl overflow-hidden bg-neutral-900 border-2 ${game.playable ? 'border-neutral-700 hover:border-fuchsia-500 cursor-pointer' : 'border-neutral-800 opacity-70 cursor-not-allowed'} transition-all duration-300 hover:shadow-[0_0_20px_rgba(217,70,239,0.3)]`}
            onClick={() => game.playable && onSelectGame(game.id)}
          >
            {/* Card Background Pattern */}
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-neutral-600 to-neutral-900"></div>
            
            <div className="relative p-6 h-48 flex flex-col justify-between">
              <div>
                <h3 className={`font-arcade text-lg mb-2 ${game.color}`}>{game.title}</h3>
                <p className="text-xl text-neutral-300">{game.description}</p>
              </div>
              
              <div className="flex justify-between items-end">
                <span className="font-arcade text-xs text-neutral-500">
                  {game.playable ? 'READY' : 'COMING SOON'}
                </span>
                {game.playable ? (
                  <Play className="w-8 h-8 text-fuchsia-500 group-hover:text-fuchsia-400 group-hover:scale-110 transition-transform" />
                ) : (
                  <Construction className="w-8 h-8 text-neutral-600" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
