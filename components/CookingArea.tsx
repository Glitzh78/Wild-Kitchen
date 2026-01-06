
import React from 'react';
import { Player } from '../types';

interface CookingAreaProps {
  player: Player;
  onTap: () => void;
  isActive: boolean;
}

export const CookingArea: React.FC<CookingAreaProps> = ({ player, onTap, isActive }) => {
  const { order, tapsDone } = player.cookingSlot;
  const progress = order ? (tapsDone / order.tapsRequired) * 100 : 0;

  return (
    <div className="relative w-full max-w-md bg-zinc-800 rounded-xl p-4 border-4 border-zinc-700 shadow-2xl">
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="aspect-square bg-zinc-900 rounded-full border-4 border-zinc-700 flex items-center justify-center relative group">
            <div className="w-16 h-16 rounded-full border-2 border-zinc-800 flex items-center justify-center">
              <div className={`w-12 h-12 rounded-full border border-zinc-700 ${isActive && order ? 'animate-pulse' : ''}`} />
            </div>
            {i === 1 && order && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-full z-10 p-2 text-center">
                <p className="text-[10px] font-bold text-yellow-500 uppercase">{order.name}</p>
                <p className="text-[8px] text-white">{tapsDone} / {order.tapsRequired}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4">
        <div className="h-3 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-700">
          <div 
            className="h-full bg-gradient-to-r from-orange-500 to-red-600 transition-all duration-300" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-center text-[10px] text-zinc-400 mt-1 font-mono">COOKING PROGRESS</p>
      </div>

      {isActive && order && (
        <button
          onClick={onTap}
          className="absolute inset-0 w-full h-full z-20 bg-transparent active:scale-95 transition-transform"
          aria-label="Tap to cook"
        />
      )}
      
      {!order && isActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl pointer-events-none">
          <p className="text-white font-bold animate-bounce text-sm">SELECT ORDER & INGREDIENTS</p>
        </div>
      )}
    </div>
  );
};
