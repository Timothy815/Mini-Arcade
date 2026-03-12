import React, { useState } from 'react';
import { Hub } from './components/Hub';
import { Snake } from './games/Snake';
import { Pong } from './games/Pong';
import { Asteroids } from './games/Asteroids';
import { SpaceInvaders } from './games/SpaceInvaders';
import { Galaga } from './games/Galaga';
import { BlockBlast } from './games/BlockBlast';
import { Defender } from './games/Defender';
import { PacMan } from './games/PacMan';
import { Centipede } from './games/Centipede';
import { BrickBreaker } from './games/BrickBreaker';
import { Tetris } from './games/Tetris';
import { Pinball } from './games/Pinball';
import { Tanks } from './games/Tanks';
import { Strategy } from './games/Strategy';
import { LightBike } from './games/LightBike';
import { Quoridor } from './games/Quoridor';
import { Reversi } from './games/Reversi';
import { Gamepad2, ArrowLeft } from 'lucide-react';

export type GameDef = {
  id: string;
  title: string;
  description: string;
  color: string;
  component?: React.ComponentType<any>;
  playable: boolean;
};

const GAMES: GameDef[] = [
  { id: 'asteroids', title: 'Asteroids', description: 'Destroy the space rocks!', color: 'text-blue-400', component: Asteroids, playable: true },
  { id: 'space-invaders', title: 'Space Invaders', description: 'Defend earth from aliens.', color: 'text-green-400', component: SpaceInvaders, playable: true },
  { id: 'galaga', title: 'Galaga', description: 'Fighter swarm attack.', color: 'text-red-400', component: Galaga, playable: true },
  { id: 'pong', title: 'Pong', description: 'The classic table tennis game.', color: 'text-white', component: Pong, playable: true },
  { id: 'block-blast', title: 'Block Blast', description: 'Break all the bricks.', color: 'text-yellow-400', component: BlockBlast, playable: true },
  { id: 'defender', title: 'Defender', description: 'Protect the humanoids.', color: 'text-orange-400', component: Defender, playable: true },
  { id: 'pac-man', title: 'Pac-Man', description: 'Waka waka waka.', color: 'text-yellow-300', component: PacMan, playable: true },
  { id: 'centipede', title: 'Centipede', description: 'Bug blasting action.', color: 'text-pink-400', component: Centipede, playable: true },
  { id: 'snake', title: 'Snake', description: 'Eat apples, grow long.', color: 'text-emerald-400', component: Snake, playable: true },
  { id: 'brick-breaker', title: 'Brick Breaker', description: 'Bounce and break.', color: 'text-sky-400', component: BrickBreaker, playable: true },
  { id: 'tetris', title: 'Tetris', description: 'Clear the lines.', color: 'text-purple-400', component: Tetris, playable: true },
  { id: 'pinball', title: 'Pinball', description: 'Flippers and bumpers.', color: 'text-pink-400', component: Pinball, playable: true },
  { id: 'tanks', title: 'Tanks', description: 'Artillery trajectory combat.', color: 'text-green-500', component: Tanks, playable: true },
  { id: 'strategy', title: 'Strategy', description: 'Conquer the map.', color: 'text-blue-500', component: Strategy, playable: true },
  { id: 'light-bike', title: 'Light Bike', description: 'Neon cycle trails.', color: 'text-cyan-400', component: LightBike, playable: true },
  { id: 'quoridor', title: 'Quoridor', description: 'Maze building race.', color: 'text-amber-500', component: Quoridor, playable: true },
  { id: 'reversi', title: 'Reversi', description: 'Flank and flip.', color: 'text-emerald-500', component: Reversi, playable: true },
];

export type Aggression = 'MILD' | 'NORMAL' | 'BRUTAL';

export default function App() {
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [aggression, setAggression] = useState<Aggression>('NORMAL');

  const currentGame = GAMES.find(g => g.id === activeGame);

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-retro relative crt flex flex-col">
      {/* Header */}
      <header className="p-6 border-b border-neutral-800 flex items-center justify-between z-10 bg-neutral-950/80 backdrop-blur-sm">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => setActiveGame(null)}>
          <Gamepad2 className="w-8 h-8 text-fuchsia-500" />
          <h1 className="font-arcade text-2xl text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-cyan-500 neon-text">
            ARCADE HUB
          </h1>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 bg-neutral-900/50 p-1 rounded-lg border border-neutral-800">
            <span className="font-arcade text-[10px] text-neutral-500 ml-2 uppercase tracking-widest">Enemy Aggression:</span>
            {(['MILD', 'NORMAL', 'BRUTAL'] as Aggression[]).map((level) => (
              <button
                key={level}
                onClick={() => setAggression(level)}
                className={`px-3 py-1.5 rounded font-arcade text-[10px] transition-all ${
                  aggression === level 
                    ? 'bg-fuchsia-600 text-white shadow-[0_0_10px_rgba(192,38,211,0.5)]' 
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {level}
              </button>
            ))}
          </div>

          {activeGame && (
            <button 
              onClick={() => setActiveGame(null)}
              className="flex items-center gap-2 font-arcade text-xs text-fuchsia-400 hover:text-fuchsia-300 transition-colors uppercase"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Hub
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative z-10 overflow-y-auto">
        {activeGame && currentGame?.component ? (
          <div className="h-full flex flex-col items-center justify-center p-4">
            <h2 className={`font-arcade text-xl mb-6 ${currentGame.color}`}>{currentGame.title}</h2>
            <div className="border-4 border-neutral-800 rounded-lg overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)] bg-black">
              <currentGame.component aggression={aggression} />
            </div>
            <p className="mt-6 text-neutral-400 text-xl max-w-2xl text-center">
              Use keyboard controls. Click game area to focus.
            </p>
          </div>
        ) : (
          <Hub games={GAMES} onSelectGame={setActiveGame} />
        )}
      </main>
    </div>
  );
}
