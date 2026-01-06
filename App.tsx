
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { GameState, Player, Card, OrderCard, GamePhase, WildCard } from './types';
import { INGREDIENTS, WILDS, ORDERS } from './constants';
import { GameCard } from './components/GameCard';
import { CookingArea } from './components/CookingArea';

const INITIAL_HAND_SIZE = 5;

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderCard | null>(null);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  const initGame = (vsAi: boolean) => {
    const ingredientPile = [...INGREDIENTS, ...INGREDIENTS, ...INGREDIENTS];
    const wildPile = [...WILDS, ...WILDS];
    const combinedDeck = [...ingredientPile, ...wildPile].sort(() => Math.random() - 0.5);
    const orderDeck = [...ORDERS].sort(() => Math.random() - 0.5);

    const players: Player[] = [
      {
        id: 0,
        name: 'You (Chef)',
        hand: combinedDeck.splice(0, INITIAL_HAND_SIZE),
        cookedDishes: [],
        score: 0,
        isStunned: false,
        isAi: false,
        cookingSlot: { order: null, tapsDone: 0 }
      },
      {
        id: 1,
        name: vsAi ? 'AI Grandmaster' : 'Player 2',
        hand: combinedDeck.splice(0, INITIAL_HAND_SIZE),
        cookedDishes: [],
        score: 0,
        isStunned: false,
        isAi: vsAi,
        cookingSlot: { order: null, tapsDone: 0 }
      }
    ];

    setGameState({
      players,
      currentPlayerIndex: 0,
      drawPile: combinedDeck,
      orderDeck: orderDeck,
      activeOrders: orderDeck.splice(0, 3),
      phase: 'DRAW',
      message: 'Permainan Dimulai! Silakan ambil kartu.',
      winner: null,
      isAiMode: vsAi
    });
  };

  // --- LOGIKA AI GEMINI ---
  const performAiTurn = async () => {
    if (!gameState || isAiProcessing) return;
    setIsAiProcessing(true);
    
    const aiPlayer = gameState.players[1];
    const userPlayer = gameState.players[0];

    // Fase Draw Otomatis untuk AI
    if (gameState.phase === 'DRAW') {
      await new Promise(r => setTimeout(r, 1000));
      drawCards();
      setIsAiProcessing(false);
      return;
    }

    // Fase Aksi AI menggunakan Gemini
    try {
      // Create a new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `
        Kamu adalah AI Grandmaster di game kartu masak "Chef Card Battle".
        Status Game:
        - Tanganmu: ${aiPlayer.hand.map(c => `${c.name} (ID: ${c.id}, Tipe: ${c.type})`).join(', ')}
        - Skor Kamu: ${aiPlayer.score}, Skor Lawan: ${userPlayer.score}
        - Pesanan Tersedia: ${gameState.activeOrders.map(o => `${o.name} (Bahan: ${o.ingredients.join(', ')})`).join(' | ')}
        
        Aturan:
        1. Jika punya bahan lengkap untuk sebuah pesanan, lakukan "COOK".
        2. Jika punya kartu WILD (seperti Rat Attack atau Power Outage), gunakan "WILD".
        3. Jika tidak bisa keduanya, lakukan "END".

        Kembalikan JSON dengan format:
        { "action": "COOK" | "WILD" | "END", "targetId": "ID_KARTU_ATAU_PESANAN", "ingredientIds": ["ID1", "ID2"] }
      `;

      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const text = response.text;
      if (!text) {
        throw new Error("Empty response from Gemini API");
      }
      const decision = JSON.parse(text);
      console.log("AI Decision:", decision);

      await new Promise(r => setTimeout(r, 1500)); // Delay simulasi berpikir

      if (decision.action === 'WILD') {
        const card = aiPlayer.hand.find(c => c.id === decision.targetId);
        if (card) handleWildAction(card);
        else nextTurn();
      } else if (decision.action === 'COOK') {
        const order = gameState.activeOrders.find(o => o.id === decision.targetId);
        if (order) {
          // Simulasi instan memasak untuk AI agar tidak perlu tapping manual
          setGameState(prev => {
            if (!prev) return prev;
            const players = [...prev.players];
            const p = { ...players[1] };
            players[1] = p;
            p.hand = p.hand.filter(c => !decision.ingredientIds.includes(c.id));
            p.score += order.points;
            p.cookedDishes = [...p.cookedDishes, order];
            
            const newOrderDeck = [...prev.orderDeck];
            const active = prev.activeOrders.filter(o => o.id !== order.id);
            if (newOrderDeck.length > 0) active.push(newOrderDeck.shift()!);
            
            return { ...prev, players, activeOrders: active, orderDeck: newOrderDeck, message: `AI memasak ${order.name}!` };
          });
          setTimeout(nextTurn, 1000);
        } else {
          nextTurn();
        }
      } else {
        nextTurn();
      }
    } catch (e) {
      console.error("AI Error:", e);
      nextTurn();
    }
    setIsAiProcessing(false);
  };

  useEffect(() => {
    if (gameState?.isAiMode && gameState.currentPlayerIndex === 1 && !gameState.winner) {
      performAiTurn();
    }
  }, [gameState?.currentPlayerIndex, gameState?.phase]);

  // --- LOGIKA GAME DASAR ---
  const drawCards = () => {
    setGameState(prev => {
      if (!prev) return prev;
      const deck = [...prev.drawPile];
      const drawn = deck.splice(0, 2);
      const players = [...prev.players];
      const p = { ...players[prev.currentPlayerIndex] };
      players[prev.currentPlayerIndex] = p;
      p.hand = [...p.hand, ...drawn];
      return { ...prev, drawPile: deck, players, phase: 'ACTION', message: 'Fase Aksi: Pilih Pesanan atau Gunakan Kartu WILD.' };
    });
  };

  const nextTurn = () => {
    setGameState(prev => {
      if (!prev) return prev;
      const nextIdx = (prev.currentPlayerIndex + 1) % 2;
      return { ...prev, currentPlayerIndex: nextIdx, phase: 'DRAW', message: `Giliran ${prev.players[nextIdx].name}.` };
    });
    setSelectedOrder(null);
    setSelectedIngredients([]);
  };

  // Fixed type error by checking card type and narrowing the union to WildCard
  const handleWildAction = (card: Card) => {
    if (card.type !== 'WILD') return;
    const wildCard = card as WildCard;

    setGameState(prev => {
      if (!prev) return prev;
      const players = [...prev.players];
      const me = { ...players[prev.currentPlayerIndex] };
      const opponentIdx = (prev.currentPlayerIndex + 1) % 2;
      const opponent = { ...players[opponentIdx] };
      
      players[prev.currentPlayerIndex] = me;
      players[opponentIdx] = opponent;

      me.hand = me.hand.filter(c => c.id !== wildCard.id);
      const newDrawPile = [...prev.drawPile];

      if (wildCard.effect === 'STUN') opponent.isStunned = true;
      if (wildCard.effect === 'SABOTAGE' && opponent.hand.length > 0) {
        opponent.hand = opponent.hand.slice(0, -1);
      }
      if (wildCard.effect === 'BUFF') {
        const drawn = newDrawPile.splice(0, 2);
        me.hand = [...me.hand, ...drawn];
      }
      
      return { ...prev, players, drawPile: newDrawPile, message: `${me.name} menggunakan ${wildCard.name}!` };
    });
  };

  const startCooking = () => {
    if (!gameState || !selectedOrder) return;
    const p = gameState.players[0];
    if (p.isStunned) { 
      setGameState(prev => {
        if (!prev) return prev;
        const players = [...prev.players];
        players[0] = { ...players[0], isStunned: false };
        return { ...prev, players, message: 'Kamu terkena stun! Lewati giliran memasak.' };
      });
      nextTurn();
      return; 
    }

    setGameState(prev => {
      if (!prev) return prev;
      const players = [...prev.players];
      const me = { ...players[0] };
      players[0] = me;
      me.hand = me.hand.filter(c => !selectedIngredients.includes(c.id));
      me.cookingSlot = { order: selectedOrder, tapsDone: 0 };
      const active = prev.activeOrders.filter(o => o.id !== selectedOrder.id);
      return { ...prev, players, activeOrders: active, phase: 'TAPPING', message: 'KETUK KOMPOR CEPAT-CEPAT!' };
    });
  };

  const handleTap = () => {
    setGameState(prev => {
      if (!prev || prev.phase !== 'TAPPING') return prev;
      const players = [...prev.players];
      const p = { ...players[0] };
      players[0] = p;
      if (!p.cookingSlot.order) return prev;
      const order = p.cookingSlot.order;
      p.cookingSlot = { ...p.cookingSlot, tapsDone: p.cookingSlot.tapsDone + 1 };
      
      if (p.cookingSlot.tapsDone >= order.tapsRequired) {
        p.score += order.points;
        p.cookedDishes = [...p.cookedDishes, order];
        p.cookingSlot = { order: null, tapsDone: 0 };
        const newOrders = [...prev.orderDeck];
        const active = [...prev.activeOrders];
        if (newOrders.length > 0) {
          const nextOrder = newOrders.shift();
          if (nextOrder) active.push(nextOrder);
        }
        return { ...prev, players, activeOrders: active, orderDeck: newOrders, phase: 'ACTION', message: 'HIDANGAN DISAJIKAN!', winner: p.score >= 100 ? p : null };
      }
      return { ...prev, players };
    });
  };

  // --- VIEW LOBBY ---
  if (!gameState) return (
    <div className="min-h-screen bg-[#0f0a08] flex flex-col items-center justify-center text-white p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
      <div className="z-10 text-center scale-up">
        <h1 className="bangers text-9xl text-yellow-500 mb-2 drop-shadow-[0_0_30px_rgba(234,179,8,0.4)]">CHEF BATTLE</h1>
        <p className="text-gray-400 font-bold tracking-[0.5em] mb-12">THE ULTIMATE CULINARY DUEL</p>
        
        <div className="flex flex-col gap-6 w-80 mx-auto">
          <button onClick={() => initGame(true)} className="group bg-yellow-500 hover:bg-white text-black p-6 rounded-3xl transition-all shadow-2xl transform hover:scale-105 active:scale-95">
            <span className="bangers text-4xl block">ONLINE MODE</span>
            <span className="text-[10px] font-black uppercase opacity-60">VS Global AI Grandmaster</span>
          </button>
          
          <button onClick={() => initGame(false)} className="group bg-white/5 hover:bg-white/10 text-white border border-white/10 p-6 rounded-3xl transition-all shadow-2xl transform hover:scale-105 active:scale-95">
            <span className="bangers text-4xl block">LOCAL DUEL</span>
            <span className="text-[10px] font-black uppercase opacity-40">Play with a friend</span>
          </button>
        </div>
      </div>
    </div>
  );

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  return (
    <div className="min-h-screen bg-[#1a0f0a] bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] p-4 lg:p-8">
      {/* HUD */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center bg-black/80 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-white/10 shadow-2xl mb-8 relative">
        <div className="flex gap-12">
          {gameState.players.map(p => (
            <div key={p.id} className={`transition-all duration-500 ${gameState.currentPlayerIndex === p.id ? 'scale-110' : 'opacity-30 blur-[1px]'}`}>
              <p className="text-[10px] font-black uppercase text-yellow-500/50 tracking-widest">{p.name} {p.isAi ? '🤖' : '👤'}</p>
              <h2 className="bangers text-5xl text-yellow-500">{p.score} <span className="text-xs">PTS</span></h2>
            </div>
          ))}
        </div>
        
        <div className="flex-1 text-center py-4 px-8">
          <h1 className="bangers text-3xl text-white tracking-widest animate-pulse">{gameState.message}</h1>
          {isAiProcessing && <div className="text-yellow-500 text-[10px] font-black animate-bounce mt-2 uppercase tracking-[0.3em]">AI is thinking...</div>}
        </div>

        <div className="flex gap-4">
          {gameState.phase === 'DRAW' && !currentPlayer.isAi && (
            <button onClick={drawCards} className="bg-yellow-500 hover:bg-white text-black px-12 py-4 rounded-2xl bangers text-3xl shadow-[0_10px_30px_rgba(234,179,8,0.4)] transition-all active:scale-90">DRAW</button>
          )}
          {gameState.phase === 'ACTION' && !currentPlayer.isAi && (
            <button onClick={nextTurn} className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-10 py-4 rounded-2xl bangers text-3xl transition-all">PASS</button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-12">
          {/* Marketplace/Menu */}
          <div className="bg-black/30 rounded-[3.5rem] p-10 border border-white/5 shadow-inner">
            <h3 className="text-[10px] font-black text-white/20 mb-10 uppercase tracking-[0.8em] text-center">ORDER MARKETPLACE</h3>
            <div className="flex flex-wrap gap-8 justify-center">
              {gameState.activeOrders.map(o => (
                <GameCard key={o.id} card={o} selected={selectedOrder?.id === o.id} onClick={() => setSelectedOrder(o)} size="md" />
              ))}
            </div>
          </div>

          {/* Cooking Slot */}
          <div className="flex flex-col items-center">
            <CookingArea player={gameState.players[0]} onTap={handleTap} isActive={gameState.phase === 'TAPPING' || (!!selectedOrder && !currentPlayer.isAi)} />
            {gameState.phase === 'ACTION' && selectedOrder && !currentPlayer.isAi && (
              <button onClick={startCooking} className="mt-12 bg-red-600 hover:bg-red-500 text-white px-20 py-6 rounded-[3rem] bangers text-5xl shadow-[0_20px_50px_rgba(220,38,38,0.5)] transform hover:scale-110 active:scale-90 transition-all border-b-8 border-red-800">COOK!</button>
            )}
          </div>
        </div>

        {/* Inventory / Hand */}
        <div className="lg:col-span-4 bg-black/50 rounded-[3rem] p-8 border border-white/5 h-fit backdrop-blur-xl shadow-2xl">
           <div className="flex justify-between items-center mb-8">
             <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.5em]">MY PANTRY</h3>
             <span className="text-[10px] text-yellow-500 font-bold">{gameState.players[0].hand.length} CARDS</span>
           </div>
           <div className="grid grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2">
             {gameState.players[0].hand.map((c, i) => (
               <GameCard 
                key={`${c.id}-${i}`} 
                card={c} 
                size="sm" 
                selected={selectedIngredients.includes(c.id)}
                onClick={() => {
                  if (gameState.currentPlayerIndex !== 0) return;
                  c.type === 'WILD' ? handleWildAction(c) : setSelectedIngredients(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id]);
                }}
               />
             ))}
           </div>
        </div>
      </div>

      {/* Victory Modal */}
      {gameState.winner && (
        <div className="fixed inset-0 bg-black/98 z-[100] flex items-center justify-center p-6 backdrop-blur-md">
          <div className="text-center scale-up">
            <h2 className="bangers text-[12rem] text-yellow-500 leading-none mb-4 drop-shadow-[0_0_50px_rgba(234,179,8,0.6)]">
              {gameState.winner.id === 0 ? 'VICTORY' : 'DEFEAT'}
            </h2>
            <p className="bangers text-5xl text-white mb-16 tracking-[0.2em]">{gameState.winner.name} IS THE MASTER CHEF</p>
            <button onClick={() => window.location.reload()} className="bg-yellow-500 text-black bangers text-5xl px-20 py-8 rounded-[2.5rem] hover:bg-white transition-all transform hover:scale-110 shadow-2xl">REMATCH</button>
          </div>
        </div>
      )}

      <style>{`
        .scale-up { animation: scaleUp 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        @keyframes scaleUp { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
};

export default App;
