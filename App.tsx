
import React, { useState, useEffect, useCallback } from 'react';
import { GameState, Player, Card, OrderCard, GamePhase } from './types';
import { INGREDIENTS, WILDS, ORDERS } from './constants';
import { GameCard } from './components/GameCard';
import { CookingArea } from './components/CookingArea';

const INITIAL_HAND_SIZE = 5;

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderCard | null>(null);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const initGame = useCallback(() => {
    setLoading(true);

    const ingredientPile = [...INGREDIENTS, ...INGREDIENTS, ...INGREDIENTS];
    const wildPile = [...WILDS, ...WILDS];
    const combinedDeck = [...ingredientPile, ...wildPile].sort(() => Math.random() - 0.5);
    const orderDeck = [...ORDERS].sort(() => Math.random() - 0.5);

    const players: Player[] = [
      {
        id: 0,
        name: 'Player 1',
        hand: combinedDeck.splice(0, INITIAL_HAND_SIZE),
        cookedDishes: [],
        score: 0,
        isStunned: false,
        cookingSlot: { order: null, tapsDone: 0 }
      },
      {
        id: 1,
        name: 'Player 2',
        hand: combinedDeck.splice(0, INITIAL_HAND_SIZE),
        cookedDishes: [],
        score: 0,
        isStunned: false,
        cookingSlot: { order: null, tapsDone: 0 }
      }
    ];

    const activeOrders = orderDeck.splice(0, 3);

    setGameState({
      players,
      currentPlayerIndex: 0,
      drawPile: combinedDeck,
      orderDeck: orderDeck,
      activeOrders: activeOrders,
      phase: 'DRAW',
      message: 'Game Start! Draw cards.',
      winner: null
    });
    
    setLoading(false);
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const drawCards = () => {
    if (!gameState || gameState.phase !== 'DRAW') return;
    setGameState(prev => {
      if (!prev) return prev;
      const deck = [...prev.drawPile];
      const drawn = deck.splice(0, 2);
      const players = [...prev.players];
      players[prev.currentPlayerIndex].hand.push(...drawn);
      return {
        ...prev,
        drawPile: deck,
        players,
        phase: 'ACTION',
        message: 'Action Phase: Pick Order & Ingredients.'
      };
    });
  };

  const nextTurn = () => {
    if (!gameState) return;
    const nextIdx = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    setSelectedOrder(null);
    setSelectedIngredients([]);
    setGameState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        currentPlayerIndex: nextIdx,
        phase: 'DRAW',
        message: `${prev.players[nextIdx].name}'s Turn.`,
      };
    });
  };

  const handleWildAction = (card: Card) => {
    if (!gameState || card.type !== 'WILD' || gameState.phase !== 'ACTION') return;
    setGameState(prev => {
      if (!prev) return prev;
      const players = [...prev.players];
      const me = players[prev.currentPlayerIndex];
      const opponent = players[(prev.currentPlayerIndex + 1) % 2];
      me.hand = me.hand.filter(c => c.id !== card.id);
      
      let msg = `Played ${card.name}!`;
      if (card.effect === 'STUN') opponent.isStunned = true;
      if (card.effect === 'SABOTAGE' && opponent.hand.length > 0) opponent.hand.pop();
      if (card.effect === 'BUFF') {
        const drawn = [...prev.drawPile].splice(0, 2);
        me.hand.push(...drawn);
      }
      if (card.effect === 'CHAOS') {
        const newOrders = [...prev.orderDeck].slice(0, 3);
        return { ...prev, activeOrders: newOrders, message: 'Recipe Chaos!' };
      }

      return { ...prev, players, message: msg };
    });
  };

  const toggleIngredient = (id: string) => {
    if (gameState?.phase !== 'ACTION') return;
    setSelectedIngredients(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const startCooking = () => {
    if (!gameState || !selectedOrder) return;
    const p = gameState.players[gameState.currentPlayerIndex];
    if (p.isStunned) {
      setGameState(prev => prev ? { ...prev, message: "STUNNED! Wait next turn." } : null);
      p.isStunned = false;
      return;
    }

    // Basic validation
    const hand = p.hand.filter(c => selectedIngredients.includes(c.id));
    const handNames = hand.map(c => c.name);
    const hasWildcard = hand.some(c => c.type === 'WILD' && c.effect === 'WILDCARD');
    
    let isValid = false;
    if (hasWildcard && hand.length === selectedOrder.ingredients.length) {
       isValid = true;
    } else {
       isValid = selectedOrder.ingredients.every(ing => handNames.includes(ing));
    }

    if (!isValid) {
      setGameState(prev => prev ? { ...prev, message: "Missing ingredients!" } : null);
      return;
    }

    setGameState(prev => {
      if (!prev) return prev;
      const players = [...prev.players];
      const me = players[prev.currentPlayerIndex];
      me.hand = me.hand.filter(c => !selectedIngredients.includes(c.id));
      me.cookingSlot = { order: selectedOrder, tapsDone: 0 };
      const active = prev.activeOrders.filter(o => o.id !== selectedOrder.id);
      return { ...prev, players, activeOrders: active, phase: 'TAPPING', message: `TAP THE STOVE!` };
    });
  };

  const handleTap = () => {
    if (!gameState || gameState.phase !== 'TAPPING') return;
    setGameState(prev => {
      if (!prev) return prev;
      const players = [...prev.players];
      const p = players[prev.currentPlayerIndex];
      const order = p.cookingSlot.order;
      if (!order) return prev;
      p.cookingSlot.tapsDone += 1;
      
      if (p.cookingSlot.tapsDone >= order.tapsRequired) {
        p.score += order.points;
        p.cookedDishes.push(order);
        p.cookingSlot = { order: null, tapsDone: 0 };
        const newOrders = [...prev.orderDeck];
        const active = [...prev.activeOrders];
        if (newOrders.length > 0) active.push(newOrders.shift()!);
        return { 
          ...prev, 
          players, 
          activeOrders: active, 
          orderDeck: newOrders, 
          phase: 'ACTION', 
          message: 'DISH SERVED!',
          winner: p.score >= 100 ? p : null
        };
      }
      return { ...prev, players };
    });
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-12">
      <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mb-4" />
      <h1 className="bangers text-4xl text-yellow-500">KITCHEN PREP...</h1>
    </div>
  );

  if (!gameState) return null;

  return (
    <div className="min-h-screen bg-[#1a0f0a] bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] p-4 lg:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center bg-black/80 backdrop-blur-xl p-6 rounded-[2rem] border border-white/10 shadow-2xl mb-8">
        <div className="flex gap-10">
          {gameState.players.map(p => (
            <div key={p.id} className={`transition-all ${gameState.currentPlayerIndex === p.id ? 'scale-110' : 'opacity-40'}`}>
              <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">{p.name}</p>
              <h2 className="bangers text-4xl text-yellow-500">{p.score} <span className="text-xs">PTS</span></h2>
            </div>
          ))}
        </div>
        
        <div className="flex-1 text-center py-4 md:py-0">
          <h1 className="bangers text-3xl text-white tracking-widest">{gameState.message}</h1>
        </div>

        <div className="flex gap-4">
          {gameState.phase === 'DRAW' && (
            <button onClick={drawCards} className="bg-yellow-500 hover:bg-yellow-400 text-black px-10 py-3 rounded-2xl bangers text-2xl shadow-xl transition-all active:scale-95">DRAW</button>
          )}
          {gameState.phase === 'ACTION' && (
            <button onClick={nextTurn} className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-3 rounded-2xl bangers text-2xl transition-all active:scale-95">NEXT</button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-12">
          {/* Menu */}
          <div className="bg-black/40 rounded-[3rem] p-8 border border-white/5 shadow-inner">
            <h3 className="text-[10px] font-black text-white/30 mb-8 uppercase tracking-[0.5em] text-center">MENU PESANAN</h3>
            <div className="flex flex-wrap gap-6 justify-center">
              {gameState.activeOrders.map(o => (
                <GameCard key={o.id} card={o} selected={selectedOrder?.id === o.id} onClick={() => setSelectedOrder(o)} size="md" />
              ))}
            </div>
          </div>

          {/* Cooking Area */}
          <div className="flex flex-col items-center">
            <CookingArea player={gameState.players[gameState.currentPlayerIndex]} onTap={handleTap} isActive={gameState.phase === 'TAPPING' || !!selectedOrder} />
            {gameState.phase === 'ACTION' && selectedOrder && (
              <button onClick={startCooking} className="mt-10 bg-red-600 hover:bg-red-500 text-white px-16 py-5 rounded-[2.5rem] bangers text-4xl shadow-2xl transform hover:scale-105 active:scale-95 transition-all">MASAK SEKARANG!</button>
            )}
          </div>
        </div>

        {/* Hand */}
        <div className="lg:col-span-4 bg-black/60 rounded-[3rem] p-8 border border-white/10 h-fit backdrop-blur-md">
           <h3 className="text-[10px] font-black text-white/30 mb-8 uppercase tracking-[0.5em]">PANTRY ANDA</h3>
           <div className="grid grid-cols-2 gap-4">
             {gameState.players[gameState.currentPlayerIndex].hand.map((c, i) => (
               <GameCard 
                key={`${c.id}-${i}`} 
                card={c} 
                size="sm" 
                selected={selectedIngredients.includes(c.id)}
                onClick={() => c.type === 'WILD' ? handleWildAction(c) : toggleIngredient(c.id)}
               />
             ))}
           </div>
        </div>
      </div>

      {gameState.winner && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="text-center">
            <h2 className="bangers text-9xl text-yellow-500 mb-4 animate-bounce">MENANG!</h2>
            <p className="bangers text-4xl text-white mb-10 tracking-widest">{gameState.winner.name.toUpperCase()} ADALAH HEAD CHEF</p>
            <button onClick={() => window.location.reload()} className="bg-yellow-500 text-black bangers text-4xl px-16 py-6 rounded-3xl hover:bg-white transition-all transform hover:scale-110 shadow-[0_0_50px_rgba(250,204,21,0.5)]">MAIN LAGI</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
