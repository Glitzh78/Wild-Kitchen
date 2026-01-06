
import React from 'react';
import { Card, OrderCard, IngredientCard, WildCard } from '../types';

interface GameCardProps {
  card: Card | OrderCard;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const GameCard: React.FC<GameCardProps> = ({ card, onClick, selected, disabled, size = 'md' }) => {
  const isOrder = card.type === 'ORDER';
  const isIngredient = card.type === 'INGREDIENT';
  const isWild = card.type === 'WILD';

  const sizeClasses = {
    sm: 'w-24 h-36',
    md: 'w-36 h-52',
    lg: 'w-52 h-72'
  };

  const getBorderColor = () => {
    if (selected) return 'ring-4 ring-yellow-400 scale-105 z-10 shadow-[0_0_25px_rgba(250,204,21,0.5)]';
    if (isOrder) {
      const order = card as OrderCard;
      if (order.class === 'EASY') return 'border-green-500/50 shadow-green-900/20';
      if (order.class === 'MEDIUM') return 'border-orange-500/50 shadow-orange-900/20';
      return 'border-red-600/50 shadow-red-900/20';
    }
    if (isWild) return 'border-purple-600/50 shadow-purple-900/20';
    return 'border-white/10 shadow-black/40';
  };

  const getRankColor = (rank: string) => {
    switch(rank) {
      case 'S': return 'text-yellow-400';
      case 'A': return 'text-red-400';
      case 'B': return 'text-blue-400';
      case 'C': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div
      onClick={!disabled ? onClick : undefined}
      className={`${sizeClasses[size]} relative rounded-[1.25rem] overflow-hidden border-2 bg-[#1c1c1c] text-white cursor-pointer transition-all duration-300 transform ${getBorderColor()} ${disabled ? 'opacity-40 grayscale-[0.5] cursor-not-allowed' : 'hover:-translate-y-2'} shadow-2xl flex flex-col group`}
    >
      {/* Gloss Effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none z-10" />
      
      {/* Image Area */}
      <div className="h-[60%] relative overflow-hidden bg-black">
        {card.imageUrl ? (
          <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full bg-zinc-800 animate-pulse flex items-center justify-center">
            <span className="text-[10px] bangers opacity-20">GENERATING...</span>
          </div>
        )}
        
        {/* Badges */}
        <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-0.5 rounded-lg border border-white/20">
          <span className={`font-black bangers text-sm ${isIngredient ? getRankColor((card as IngredientCard).rank) : 'text-white'}`}>
            {isOrder ? (card as OrderCard).class[0] : isIngredient ? (card as IngredientCard).rank : 'W'}
          </span>
        </div>
        
        {isOrder && (
          <div className="absolute bottom-1 left-2 bg-black/80 backdrop-blur-sm px-2 py-0.5 rounded-md border border-white/10">
             <span className="text-[8px] font-bold text-gray-400 uppercase">{(card as OrderCard).origin}</span>
          </div>
        )}
      </div>
      
      {/* Content Area */}
      <div className="flex-1 p-2 flex flex-col bg-gradient-to-b from-[#252525] to-[#151515] border-t border-white/10 relative">
        <div className="font-black uppercase text-center leading-none bangers tracking-tight text-sm mb-1 line-clamp-1">
          {card.name}
        </div>
        
        {isOrder && (
          <div className="flex flex-wrap gap-1 justify-center mt-auto pb-1">
            {(card as OrderCard).ingredients.map((ing, idx) => (
              <span key={idx} className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md text-[7px] font-bold text-gray-400 uppercase tracking-tighter">
                {ing}
              </span>
            ))}
          </div>
        )}

        {isWild && (
          <p className="text-[9px] font-medium text-purple-300/80 leading-tight italic text-center mt-1 px-1">
            "{(card as WildCard).description}"
          </p>
        )}

        {isIngredient && (
          <div className="mt-auto flex justify-center">
             <div className="h-0.5 w-8 bg-zinc-700 rounded-full" />
          </div>
        )}

        <div className="flex justify-between items-center mt-auto pt-1 border-t border-white/5">
          <span className="text-[6px] text-gray-600 font-black uppercase">{card.type}</span>
          {isOrder && (
            <span className="text-[8px] bangers text-yellow-500">+{ (card as OrderCard).points} PTS</span>
          )}
        </div>
      </div>
    </div>
  );
};
