
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { GameState, Player, Card, OrderCard, GamePhase, CardClass } from './types';
import { INGREDIENTS, WILDS, ORDERS } from './constants';
import { GameCard } from './components/GameCard';
import { CookingArea } from './components/CookingArea';

const INITIAL_HAND_SIZE = 5;

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderCard | null>(null);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  const imageCache = useRef<Record<string, string>>({});
  const aiRef = useRef<any>(null);

  // Initialize AI client once
  if (!aiRef.current && process.env.API_KEY) {
    aiRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  const generateImage = async (prompt: string, id: string): Promise<string> => {
    if (imageCache.current[id]) return imageCache.current[id];
    if (!aiRef.current) return `https://picsum.photos/seed/${id}/300/400`;
    
    try {
      const response = await aiRef.current.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: { imageConfig: { aspectRatio: "3:4" } },
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const url = `data:image/png;base64,${part.inlineData.data}`;
          imageCache.current[id] = url;
          return url;
        }
      }
    } catch (error) {
      console.error("AI Art generation failed:", id, error);
    }
    return `https://picsum.photos/seed/${id}/300/400`;
  };

  const initGame = useCallback(async () => {
    setLoading(true);

    // 1. Create Decks
    const ingredientPile = [...INGREDIENTS, ...INGREDIENTS, ...INGREDIENTS];
    const wildPile = [...WILDS, ...WILDS];
    const combinedDeck = [...ingredientPile, ...wildPile].sort(() => Math.random() - 0.5);
    const orderDeck = [...ORDERS].sort(() => Math.random() - 0.5);

    // 2. Setup Players
    const p1Hand = combinedDeck.splice(0, INITIAL_HAND_SIZE);
    const p2Hand = combinedDeck.splice(0, INITIAL_HAND_SIZE);

    const players: Player[] = [
      {
        id: 0,
        name: 'Player 1',
        hand: p1Hand,
        cookedDishes: [],
        score: 0,
        isStunned: false,
        cookingSlot: { order: null, tapsDone: 0 }
      },
      {
        id: 1,
        name: 'Player 2',
        hand: p2Hand,
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
      message: 'Game Start! Player 1, Draw cards.',
      winner: null
    });
    
    setLoading(false);
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  // Lazy Art Loader
  const loadCardArt = async (card: Card | OrderCard) => {
    if (card.imageUrl) return;
    const url = await generateImage(card.artPrompt, card.id);
    card.imageUrl = url;
    setGameState(prev => prev ? { ...prev } : null);
  };

  // Trigger art generation for visible cards
  useEffect(() => {
    if (!gameState) return;
    
    // Cards in active orders
    gameState.activeOrders.forEach(o => loadCardArt(o));
    
    // Cards in hands
    gameState.players.forEach(p => p.hand.forEach(c => loadCardArt(c)));
  }, [gameState?.activeOrders, gameState?.players]);

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
        message: 'Action Phase: Play WILD cards or Cook.'
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
        message: `${prev.players[nextIdx].name}'s turn.`,
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
      if ((card as any).effect === 'STUN') opponent.isStunned = true;
      if ((card as any).effect === 'SABOTAGE' && opponent.hand.length > 0) opponent.hand.pop();
      if ((card as any).effect === 'BUFF') {
        const drawn = [...prev.drawPile].splice(0, 2);
        me.hand.push(...drawn);
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
      setGameState(prev => prev ? { ...prev, message: "STUNNED! Turn skipped." } : null);
      p.isStunned = false;
      return;
    }

    setGameState(prev => {
      if (!prev) return prev;
      const players = [...prev.players];
      const me = players[prev.currentPlayerIndex];
      me.hand = me.hand.filter(c => !selectedIngredients.includes(c.id));
      me.cookingSlot = { order: selectedOrder, tapsDone: 0 };
      const active = prev.activeOrders.filter(o => o.id !== selectedOrder.id);
      return { ...prev, players, activeOrders: active, phase: 'TAPPING', message: `MASH THE STOVE!` };
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
      <h1 className="bangers text-4xl tracking-widest text-yellow-500 animate-pulse">KITCHEN PREP...</h1>
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
              <p className="text-[10px] font-black uppercase text-gray-500 tracking-[0.3em]">{p.name}</p>
              <h2 className="bangers text-4xl text-yellow-500">{p.score} <span className="text-xs">PTS</span></h2>
            </div>
          ))}
        </div>
        
        <div className="flex-1 text-center py-4 md:py-0">
          <h1 className="bangers text-3xl text-white tracking-widest drop-shadow-lg">{gameState.message}</h1>
        </div>

        <div className="flex gap-4">
          {gameState.phase === 'DRAW' && (
            <button onClick={drawCards} className="bg-yellow-500 hover:bg-yellow-400 text-black px-10 py-3 rounded-2xl bangers text-2xl shadow-xl transition-all transform active:scale-90">DRAW</button>
          )}
          {gameState.phase === 'ACTION' && (
            <button onClick={nextTurn} className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-3 rounded-2xl bangers text-2xl transition-all">NEXT</button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-12">
          {/* Menu */}
          <div className="bg-black/40 rounded-[3rem] p-8 border border-white/5 shadow-inner">
            <h3 className="text-[10px] font-black text-white/30 mb-8 uppercase tracking-[0.5em] text-center">CURRENT ORDERS</h3>
            <div className="flex flex-wrap gap-8 justify-center">
              {gameState.activeOrders.map(o => (
                <GameCard key={o.id} card={o} selected={selectedOrder?.id === o.id} onClick={() => setSelectedOrder(o)} size="md" />
              ))}
            </div>
          </div>

          {/* Cooking */}
          <div className="flex flex-col items-center">
            <CookingArea player={gameState.players[gameState.currentPlayerIndex]} onTap={handleTap} isActive={gameState.phase === 'TAPPING' || !!selectedOrder} />
            {gameState.phase === 'ACTION' && selectedOrder && (
              <button onClick={startCooking} className="mt-10 bg-red-600 hover:bg-red-500 text-white px-16 py-5 rounded-[2rem] bangers text-4xl shadow-[0_15px_40px_rgba(220,38,38,0.5)] transform hover:scale-105 active:scale-95 transition-all">START COOKING!</button>
            )}
          </div>
        </div>

        {/* Hand */}
        <div className="lg:col-span-4 bg-black/60 rounded-[3rem] p-8 border border-white/10 h-fit backdrop-blur-md sticky top-8">
           <h3 className="text-[10px] font-black text-white/30 mb-8 uppercase tracking-[0.5em]">YOUR PANTRY</h3>
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
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-6">
          <div className="text-center">
            <h2 className="bangers text-8xl text-yellow-500 mb-4 animate-bounce">VICTORY!</h2>
            <p className="bangers text-4xl text-white mb-10 tracking-widest">{gameState.winner.name} IS THE HEAD CHEF</p>
            <button onClick={() => window.location.reload()} className="bg-white text-black bangers text-3xl px-12 py-4 rounded-2xl hover:bg-yellow-500 transition-colors">PLAY AGAIN</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
