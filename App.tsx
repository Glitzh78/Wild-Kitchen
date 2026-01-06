
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GameState, Player, Card, OrderCard, WildCard } from './types';
import { INGREDIENTS, WILDS, ORDERS } from './constants';
import { GameCard } from './components/GameCard';
import { CookingArea } from './components/CookingArea';

const INITIAL_HAND_SIZE = 4;
const DRAW_COOLDOWN_MS = 3000;
const AI_REACTION_MS = 4000;

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderCard | null>(null);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [wildcardAssignments, setWildcardAssignments] = useState<Record<string, string>>({});
  const [transformingCardId, setTransformingCardId] = useState<string | null>(null);
  const [aiActionLog, setAiActionLog] = useState<string>("");

  // Timer Ref for AI & Cooldowns
  // Fix: Use ReturnType<typeof setInterval> instead of NodeJS.Timeout for browser compatibility
  const aiTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        drawCooldown: 0,
        cookingSlot: { order: null, tapsDone: 0 }
      },
      {
        id: 1,
        name: vsAi ? 'AI Grandmaster' : 'Shadow Chef',
        hand: combinedDeck.splice(0, INITIAL_HAND_SIZE),
        cookedDishes: [],
        score: 0,
        isStunned: false,
        isAi: vsAi,
        drawCooldown: 0,
        cookingSlot: { order: null, tapsDone: 0 }
      }
    ];

    setGameState({
      players,
      drawPile: combinedDeck,
      orderDeck: orderDeck,
      activeOrders: orderDeck.splice(0, 4),
      message: 'RUSUH DIMULAI! Masak secepat mungkin!',
      winner: null,
      isAiMode: vsAi,
      gameStarted: true
    });
    setWildcardAssignments({});
  };

  // --- REAL-TIME AI DAEMON ---
  useEffect(() => {
    if (gameState?.gameStarted && !gameState.winner && gameState.isAiMode) {
      aiTimerRef.current = setInterval(() => {
        performAiAction();
      }, AI_REACTION_MS);
    }
    return () => {
      if (aiTimerRef.current) clearInterval(aiTimerRef.current);
    };
  }, [gameState?.gameStarted, gameState?.winner]);

  // Cooldown Processor
  useEffect(() => {
    cooldownTimerRef.current = setInterval(() => {
      setGameState(prev => {
        if (!prev) return null;
        const players = prev.players.map(p => ({
          ...p,
          drawCooldown: Math.max(0, p.drawCooldown - 500)
        }));
        return { ...prev, players };
      });
    }, 500);
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  const performAiAction = async () => {
    if (!gameState || gameState.players[1].isStunned) return;

    const aiPlayer = gameState.players[1];
    
    // AI Auto-Draw if hand is small
    if (aiPlayer.hand.length < 5 && aiPlayer.drawCooldown === 0) {
      handleDraw(1);
    }

    try {
      // Re-initialize for AI each call as per guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `
        Kamu adalah AI Grandmaster di game "CHEF BATTLE CHAOS".
        GAK ADA GILIRAN. SEMUA REAL-TIME.
        Tanganmu: ${aiPlayer.hand.map(c => `${c.name} (${c.type})`).join(', ')}
        Pasar (Shared): ${gameState.activeOrders.map(o => `${o.name} (Bahan: ${o.ingredients.join(', ')})`).join(' | ')}
        
        Aksi:
        - "COOK": Jika punya bahan lengkap.
        - "WILD": Gunakan kartu WILD (Rat Attack/Stun) untuk merusak konsentrasi lawan.
        
        Balas JSON: { "action": "COOK" | "WILD" | "NONE", "targetId": "ID", "ingredients": ["ID1", "ID2"] }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const decision = JSON.parse(response.text || '{}');
      
      if (decision.action === 'WILD') {
        const card = aiPlayer.hand.find(c => c.type === 'WILD');
        if (card) handleWildAction(1, card);
      } else if (decision.action === 'COOK') {
        const order = gameState.activeOrders.find(o => o.id === decision.targetId && !o.lockedBy);
        if (order) {
           // AI cooking logic
           setAiActionLog(`AI mulai memasak ${order.name}!`);
           // Simulasi tapping AI cepat
           for(let i=0; i < order.tapsRequired; i++) {
             await new Promise(r => setTimeout(r, 200));
             processAiTap(order, decision.ingredients);
           }
        }
      }
    } catch (e) {}
  };

  const processAiTap = (order: OrderCard, ingredientIds: string[]) => {
    setGameState(prev => {
      if (!prev) return null;
      const players = [...prev.players];
      const p = { ...players[1] };
      players[1] = p;

      if (!p.cookingSlot.order) {
        p.cookingSlot = { order, tapsDone: 0 };
        p.hand = p.hand.filter(c => !ingredientIds.includes(c.id));
      }
      
      p.cookingSlot.tapsDone += 1;
      if (p.cookingSlot.tapsDone >= order.tapsRequired) {
        p.score += order.points;
        p.cookedDishes.push(order);
        p.cookingSlot = { order: null, tapsDone: 0 };
        const newOrders = [...prev.orderDeck];
        const active = prev.activeOrders.filter(o => o.id !== order.id);
        if (newOrders.length > 0) active.push(newOrders.shift()!);
        return { ...prev, players, activeOrders: active, orderDeck: newOrders, message: `AI BERHASIL MASAK ${order.name}!`, winner: p.score >= 100 ? p : null };
      }
      return { ...prev, players };
    });
  };

  // --- PLAYER ACTIONS ---
  const handleDraw = (playerId: number) => {
    setGameState(prev => {
      if (!prev) return null;
      const p = { ...prev.players[playerId] };
      if (p.drawCooldown > 0 || prev.drawPile.length === 0) return prev;
      
      const newPile = [...prev.drawPile];
      const drawn = newPile.splice(0, 2);
      p.hand = [...p.hand, ...drawn];
      p.drawCooldown = DRAW_COOLDOWN_MS;
      
      const newPlayers = [...prev.players];
      newPlayers[playerId] = p;
      return { ...prev, drawPile: newPile, players: newPlayers };
    });
  };

  const handleCardClick = (card: Card) => {
    if (gameState?.winner) return;
    if (card.type === 'WILD') {
      const wildCard = card as WildCard;
      if (wildCard.effect === 'WILDCARD') {
        if (!selectedOrder) return;
        setTransformingCardId(card.id);
      } else {
        handleWildAction(0, card);
      }
    } else {
      setSelectedIngredients(prev => 
        prev.includes(card.id) ? prev.filter(x => x !== card.id) : [...prev, card.id]
      );
    }
  };

  const assignWildcard = (ing: string) => {
    if (!transformingCardId) return;
    setWildcardAssignments(prev => ({ ...prev, [transformingCardId]: ing }));
    setSelectedIngredients(prev => [...prev, transformingCardId]);
    setTransformingCardId(null);
  };

  const handleWildAction = (playerId: number, card: Card) => {
    setGameState(prev => {
      if (!prev) return null;
      const players = [...prev.players];
      const me = { ...players[playerId] };
      const opp = { ...players[1 - playerId] };
      players[playerId] = me;
      players[1 - playerId] = opp;

      me.hand = me.hand.filter(c => c.id !== card.id);
      const wild = card as WildCard;

      if (wild.effect === 'STUN') opp.isStunned = true;
      if (wild.effect === 'SABOTAGE' && opp.hand.length > 0) opp.hand.pop();
      if (wild.effect === 'BUFF') me.hand.push(...[...prev.drawPile].splice(0, 2));
      
      // Auto-recover stun after 4s
      if (wild.effect === 'STUN') {
        setTimeout(() => {
          setGameState(curr => curr ? { ...curr, players: curr.players.map(p => p.id === opp.id ? { ...p, isStunned: false } : p) } : null);
        }, 4000);
      }

      return { ...prev, players, message: `${me.name} pakai ${wild.name}!` };
    });
  };

  const startCooking = () => {
    if (!gameState || !selectedOrder || gameState.players[0].isStunned) return;
    
    // Validasi Bahan
    const p = gameState.players[0];
    const selectedCards = p.hand.filter(c => selectedIngredients.includes(c.id));
    const provided = selectedCards.map(c => (c.type === 'WILD' && c.effect === 'WILDCARD') ? wildcardAssignments[c.id] : c.name);
    
    if (!selectedOrder.ingredients.every(n => provided.includes(n))) return;

    setGameState(prev => {
      if (!prev) return null;
      const players = [...prev.players];
      players[0] = { ...players[0], hand: players[0].hand.filter(c => !selectedIngredients.includes(c.id)), cookingSlot: { order: selectedOrder, tapsDone: 0 } };
      return { ...prev, players, activeOrders: prev.activeOrders.map(o => o.id === selectedOrder.id ? { ...o, lockedBy: 0 } : o) };
    });
    setSelectedOrder(null);
    setSelectedIngredients([]);
  };

  const handleTap = () => {
    setGameState(prev => {
      if (!prev || !prev.players[0].cookingSlot.order) return prev;
      const players = [...prev.players];
      const p = { ...players[0] };
      players[0] = p;
      const order = p.cookingSlot.order!;
      
      p.cookingSlot.tapsDone += 1;
      if (p.cookingSlot.tapsDone >= order.tapsRequired) {
        p.score += order.points;
        p.cookedDishes.push(order);
        p.cookingSlot = { order: null, tapsDone: 0 };
        const newOrders = [...prev.orderDeck];
        const active = prev.activeOrders.filter(o => o.id !== order.id);
        if (newOrders.length > 0) active.push(newOrders.shift()!);
        return { ...prev, players, activeOrders: active, orderDeck: newOrders, message: 'MANTAAP! MASAKAN SELESAI!', winner: p.score >= 100 ? p : null };
      }
      return { ...prev, players };
    });
  };

  if (!gameState) return (
    <div className="min-h-screen bg-[#0f0a08] flex flex-col items-center justify-center text-white p-6 relative">
      <h1 className="bangers text-[10rem] text-red-600 animate-pulse drop-shadow-[0_0_30px_rgba(220,38,38,0.5)]">CHEF CHAOS</h1>
      <p className="bangers text-2xl text-yellow-500 mb-12 tracking-widest">REAL-TIME COOKING WAR</p>
      <button onClick={() => initGame(true)} className="bg-red-600 bangers text-5xl px-16 py-8 rounded-full hover:bg-white hover:text-black transition-all transform hover:scale-110 shadow-[0_0_50px_rgba(220,38,38,0.3)]">START BATTLE</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] p-4 lg:p-8 text-white">
      {/* AI Log Toast */}
      {aiActionLog && (
        <div className="fixed top-24 right-8 z-[100] bg-red-600/90 text-white bangers p-4 rounded-2xl animate-bounce shadow-2xl border-2 border-white/20">
          ⚠️ {aiActionLog}
        </div>
      )}

      {transformingCardId && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center">
          <div className="p-8 bg-zinc-900 border-2 border-yellow-500 rounded-[3rem] text-center">
            <h2 className="bangers text-4xl mb-6">GOLDEN APRON TRANSFORMATION</h2>
            <div className="grid grid-cols-2 gap-4">
              {selectedOrder?.ingredients.map((ing, i) => (
                <button key={i} onClick={() => assignWildcard(ing)} className="bg-white/10 p-4 bangers text-xl rounded-xl hover:bg-yellow-500 hover:text-black transition-all">{ing}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SCOREBOARD AGRESSIVE */}
      <div className="max-w-7xl mx-auto flex justify-between items-center bg-zinc-900/80 p-6 rounded-[2.5rem] border-b-4 border-red-600 mb-8">
        <div className="text-left">
           <p className="text-[10px] font-black opacity-50 uppercase">YOU</p>
           <h2 className="bangers text-6xl text-blue-500">{gameState.players[0].score} <span className="text-sm">PTS</span></h2>
           <div className={`mt-2 h-2 w-32 bg-zinc-800 rounded-full overflow-hidden ${gameState.players[0].isStunned ? 'opacity-100' : 'opacity-0'}`}>
              <div className="h-full bg-blue-500 animate-pulse w-full" />
           </div>
        </div>
        
        <div className="text-center px-12">
          <h1 className="bangers text-4xl text-white italic">{gameState.message}</h1>
        </div>

        <div className="text-right">
           <p className="text-[10px] font-black opacity-50 uppercase">AI MASTER</p>
           <h2 className="bangers text-6xl text-red-600">{gameState.players[1].score} <span className="text-sm">PTS</span></h2>
           {gameState.players[1].cookingSlot.order && (
             <p className="text-[10px] text-yellow-500 font-bold animate-pulse">COOKING: {gameState.players[1].cookingSlot.order.name}</p>
           )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          {/* Marketplace Shared */}
          <div className="bg-zinc-900/50 p-8 rounded-[3rem] mb-8 border border-white/5">
            <div className="flex justify-between items-center mb-6">
              <h3 className="bangers text-2xl text-white/20">MARKETPLACE (SNATCH IT!)</h3>
            </div>
            <div className="flex flex-wrap gap-4 justify-center">
              {gameState.activeOrders.map(o => (
                <div key={o.id} className="relative">
                  <GameCard card={o} selected={selectedOrder?.id === o.id} onClick={() => setSelectedOrder(o)} />
                  {o.lockedBy === 1 && <div className="absolute inset-0 bg-red-600/40 rounded-[1.5rem] flex items-center justify-center bangers text-2xl rotate-12">AI COOKING</div>}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center">
            <CookingArea player={gameState.players[0]} onTap={handleTap} isActive={!!gameState.players[0].cookingSlot.order} />
            {selectedOrder && (
              <button onClick={startCooking} className="mt-8 bg-blue-600 bangers text-4xl px-12 py-4 rounded-full shadow-[0_0_30px_rgba(37,99,235,0.4)] animate-bounce">GRAB & COOK!</button>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          {/* Draw Button with Real-time Cooldown */}
          <button 
            disabled={gameState.players[0].drawCooldown > 0} 
            onClick={() => handleDraw(0)}
            className={`w-full bangers text-4xl py-6 rounded-[2rem] transition-all relative overflow-hidden ${gameState.players[0].drawCooldown > 0 ? 'bg-zinc-800 text-zinc-600' : 'bg-yellow-500 text-black shadow-2xl'}`}
          >
            {gameState.players[0].drawCooldown > 0 ? `COOLING... ${(gameState.players[0].drawCooldown/1000).toFixed(1)}s` : 'DRAW CARDS'}
            {gameState.players[0].drawCooldown > 0 && (
              <div 
                className="absolute bottom-0 left-0 h-2 bg-white/30 transition-all duration-100" 
                style={{ width: `${(gameState.players[0].drawCooldown / DRAW_COOLDOWN_MS) * 100}%` }} 
              />
            )}
          </button>

          <div className="bg-zinc-900/50 p-6 rounded-[2rem] border border-white/5 h-[500px] overflow-y-auto">
             <h3 className="bangers text-xl mb-4 text-white/40">YOUR HAND</h3>
             <div className="grid grid-cols-2 gap-2">
               {gameState.players[0].hand.map(c => (
                 <GameCard key={c.id} card={c} size="sm" selected={selectedIngredients.includes(c.id)} onClick={() => handleCardClick(c)} assignment={wildcardAssignments[c.id]} />
               ))}
             </div>
          </div>
        </div>
      </div>

      {gameState.winner && (
        <div className="fixed inset-0 z-[300] bg-red-600 flex flex-col items-center justify-center p-10 animate-in fade-in duration-500">
           <h1 className="bangers text-[15rem] leading-none mb-8">{gameState.winner.id === 0 ? 'WINNER' : 'DEFEATED'}</h1>
           <p className="bangers text-4xl mb-12">FINAL SCORE: {gameState.winner.score} PTS</p>
           <button onClick={() => window.location.reload()} className="bg-white text-black bangers text-5xl px-20 py-8 rounded-full hover:scale-110 transition-all">RESTART WAR</button>
        </div>
      )}
    </div>
  );
};

export default App;
