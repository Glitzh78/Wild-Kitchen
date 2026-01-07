
import React, { useState, useEffect, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { GameState, Player, Card, OrderCard, WildCard } from './types';
import { INGREDIENTS, WILDS, ORDERS } from './constants';
import { GameCard } from './components/GameCard';
import { CookingArea } from './components/CookingArea';

const INITIAL_HAND_SIZE = 4;
const DRAW_COOLDOWN_MS = 3000;

const Logo = () => (
  <div className="relative w-96 h-96 flex items-center justify-center animate-bounce-slow">
    <svg viewBox="0 0 400 400" className="w-full h-full drop-shadow-2xl">
      {/* 1. Chef Hat (Red Outline) - Positioned at the very top */}
      <g transform="translate(110, 30) scale(0.9)">
        <path 
          d="M20 100 C20 40, 50 20, 90 20 C130 20, 160 40, 160 100 L160 130 L20 130 Z" 
          fill="none" 
          stroke="#9A1B1B" 
          strokeWidth="10" 
          strokeLinecap="round"
        />
        <path 
          d="M35 130 Q35 100, 60 100 T90 100 T120 100 T145 130" 
          fill="none" 
          stroke="#9A1B1B" 
          strokeWidth="8" 
        />
      </g>
      
      {/* 2. Main Red Circle (The Base) */}
      <circle cx="200" cy="230" r="105" fill="#9A1B1B" />
      <circle cx="200" cy="230" r="98" fill="none" stroke="#631111" strokeWidth="2" strokeDasharray="6,4" />
      
      {/* 3. Crossed Spoon & Fork (Yellow/Gold) */}
      <g transform="translate(200, 230)">
        {/* Spoon (Head top-left, Handle bottom-right) */}
        <g transform="rotate(-45)">
          <path d="M-8 10 L-8 80 Q-8 95, 0 95 Q8 95, 8 80 L8 10 Z" fill="#F3CD57" />
          <ellipse cx="0" cy="-25" rx="25" ry="40" fill="#F3CD57" />
        </g>
        {/* Fork (Head top-right, Handle bottom-left) */}
        <g transform="rotate(45)">
          <path d="M-8 10 L-8 80 Q-8 95, 0 95 Q8 95, 8 80 L8 10 Z" fill="#F3CD57" />
          <path d="M-20 -40 L-20 0 L20 0 L20 -40 L12 -40 L12 -15 L4 -15 L4 -40 L-4 -40 L-4 -15 L-12 -15 L-12 -40 Z" fill="#F3CD57" />
        </g>
      </g>

      {/* 4. Tomato (On the right edge) */}
      <g className="animate-float" transform="translate(325, 200)">
        <circle cx="0" cy="0" r="38" fill="#D32F2F" />
        <path d="M0 -38 L-12 -25 M0 -38 L12 -25 M0 -38 L0 -20" stroke="#2E7D32" strokeWidth="8" strokeLinecap="round" />
        <ellipse cx="18" cy="-12" rx="10" ry="14" fill="white" fillOpacity="0.3" />
      </g>

      {/* 5. Egg (Bottom left with speed lines) */}
      <g className="animate-float-delayed" transform="translate(75, 340)">
        <ellipse cx="0" cy="0" rx="38" ry="32" fill="#FFB74D" />
        <ellipse cx="-12" cy="-12" rx="12" ry="18" fill="white" fillOpacity="0.4" />
        {/* Speed lines extending to the right */}
        <line x1="45" y1="-15" x2="95" y2="-15" stroke="white" strokeWidth="4" strokeLinecap="round" strokeOpacity="0.5" />
        <line x1="55" y1="5" x2="105" y2="5" stroke="white" strokeWidth="4" strokeLinecap="round" strokeOpacity="0.5" />
        <line x1="50" y1="25" x2="90" y2="25" stroke="white" strokeWidth="4" strokeLinecap="round" strokeOpacity="0.5" />
      </g>

      {/* 6. Curved Text 'WILD KITCHEN' */}
      <defs>
        {/* Adjusted path to ensure text is centered above the circle without overlapping */}
        <path id="textCurve" d="M 60,210 A 140,140 0 0,1 340,210" />
      </defs>
      <text fill="#9A1B1B" className="bangers" style={{ fontSize: '48px', fontWeight: '900', letterSpacing: '4px' }}>
        <textPath href="#textCurve" startOffset="50%" textAnchor="middle">
          WILD KITCHEN
        </textPath>
      </text>
    </svg>
  </div>
);

type GameAction = 
  | { type: 'SYNC_STATE', state: GameState }
  | { type: 'DRAW', playerId: number, cards: Card[] }
  | { type: 'WILD', playerId: number, cardId: string, effect: string }
  | { type: 'START_COOK', playerId: number, orderId: string, ingredientIds: string[], wildcardAssignments: Record<string, string> }
  | { type: 'TAP', playerId: number }
  | { type: 'RECOVERY', playerId: number };

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<number>(0);
  const [peer, setPeer] = useState<Peer | null>(null);
  const [conn, setConn] = useState<DataConnection | null>(null);
  const [roomIdInput, setRoomIdInput] = useState("");
  const [status, setStatus] = useState("LOBBY");

  const [selectedOrder, setSelectedOrder] = useState<OrderCard | null>(null);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [wildcardAssignments, setWildcardAssignments] = useState<Record<string, string>>({});
  const [transformingCardId, setTransformingCardId] = useState<string | null>(null);

  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendAction = (action: GameAction) => {
    if (conn && conn.open) {
      conn.send(action);
    }
  };

  const handleAction = (action: GameAction) => {
    switch (action.type) {
      case 'SYNC_STATE':
        setGameState(action.state);
        break;
      case 'DRAW':
        setGameState(prev => {
          if (!prev) return null;
          const players = [...prev.players];
          players[action.playerId].hand.push(...action.cards);
          players[action.playerId].drawCooldown = DRAW_COOLDOWN_MS;
          return { ...prev, players, drawPile: prev.drawPile.filter(c => !action.cards.find(ac => ac.id === c.id)) };
        });
        break;
      case 'WILD':
        applyWildEffect(action.playerId, action.cardId, action.effect);
        break;
      case 'START_COOK':
        applyStartCook(action.playerId, action.orderId, action.ingredientIds, action.wildcardAssignments);
        break;
      case 'TAP':
        applyTap(action.playerId);
        break;
      case 'RECOVERY':
        setGameState(prev => prev ? { ...prev, players: prev.players.map(p => p.id === action.playerId ? { ...p, isStunned: false } : p) } : null);
        break;
    }
  };

  const initHost = () => {
    const newPeer = new Peer();
    newPeer.on('open', (id) => {
      setPeer(newPeer);
      setMyPlayerId(0);
      setStatus("WAITING");
    });

    newPeer.on('connection', (c) => {
      setConn(c);
      c.on('data', (data) => handleAction(data as GameAction));
      c.on('open', () => {
        const initialState = createInitialState(true, newPeer.id);
        setGameState(initialState);
        setStatus("PLAYING");
        c.send({ type: 'SYNC_STATE', state: initialState });
      });
    });
  };

  const initJoin = () => {
    const newPeer = new Peer();
    newPeer.on('open', () => {
      setPeer(newPeer);
      const c = newPeer.connect(roomIdInput);
      setConn(c);
      setMyPlayerId(1);
      c.on('data', (data) => handleAction(data as GameAction));
      c.on('open', () => setStatus("PLAYING"));
    });
  };

  const createInitialState = (isHost: boolean, pId: string): GameState => {
    const ingredientPile = [...INGREDIENTS, ...INGREDIENTS, ...INGREDIENTS];
    const wildPile = [...WILDS, ...WILDS];
    const combinedDeck = [...ingredientPile, ...wildPile].sort(() => Math.random() - 0.5);
    const orderDeck = [...ORDERS].sort(() => Math.random() - 0.5);

    return {
      players: [
        { id: 0, name: 'Host Chef', hand: combinedDeck.splice(0, INITIAL_HAND_SIZE), cookedDishes: [], score: 0, isStunned: false, isAi: false, drawCooldown: 0, cookingSlot: { order: null, tapsDone: 0 } },
        { id: 1, name: 'Guest Chef', hand: combinedDeck.splice(0, INITIAL_HAND_SIZE), cookedDishes: [], score: 0, isStunned: false, isAi: false, drawCooldown: 0, cookingSlot: { order: null, tapsDone: 0 } }
      ],
      drawPile: combinedDeck,
      orderDeck: orderDeck,
      activeOrders: orderDeck.splice(0, 4),
      message: 'WAR STARTED!',
      winner: null,
      isAiMode: false,
      gameStarted: true,
      isHost,
      peerId: pId
    };
  };

  useEffect(() => {
    cooldownTimerRef.current = setInterval(() => {
      setGameState(prev => {
        if (!prev) return null;
        const players = prev.players.map(p => ({ ...p, drawCooldown: Math.max(0, p.drawCooldown - 500) }));
        return { ...prev, players };
      });
    }, 500);
    return () => { if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current); };
  }, []);

  const validateRecipe = (): boolean => {
    if (!selectedOrder || !gameState) return false;
    const me = gameState.players[myPlayerId];
    const selectedCards = me.hand.filter(c => selectedIngredients.includes(c.id));
    const providedIngredients = selectedCards.map(c => {
      if (c.type === 'WILD' && c.effect === 'WILDCARD') {
        return wildcardAssignments[c.id];
      }
      return c.name;
    });
    if (providedIngredients.length !== selectedOrder.ingredients.length) return false;
    const needed = [...selectedOrder.ingredients];
    for (const item of providedIngredients) {
      const idx = needed.indexOf(item || "");
      if (idx !== -1) needed.splice(idx, 1);
      else return false;
    }
    return needed.length === 0;
  };

  const handleDraw = () => {
    if (!gameState || gameState.players[myPlayerId].drawCooldown > 0) return;
    const drawn = gameState.drawPile.slice(0, 2);
    if (drawn.length === 0) return;
    const action: GameAction = { type: 'DRAW', playerId: myPlayerId, cards: drawn };
    handleAction(action);
    sendAction(action);
  };

  const handleCardSelection = (card: Card) => {
    if (gameState?.players[myPlayerId].isStunned) return;
    if (card.type === 'WILD') {
      const wild = card as WildCard;
      if (wild.effect === 'WILDCARD') {
        if (!selectedOrder) {
           setGameState(prev => prev ? { ...prev, message: "PILIH PESANAN DULU!" } : null);
           return;
        }
        if (selectedIngredients.includes(card.id)) {
          setSelectedIngredients(prev => prev.filter(id => id !== card.id));
          const newAssign = { ...wildcardAssignments };
          delete newAssign[card.id];
          setWildcardAssignments(newAssign);
        } else {
          setTransformingCardId(card.id);
        }
      } else {
        const action: GameAction = { type: 'WILD', playerId: myPlayerId, cardId: card.id, effect: wild.effect };
        handleAction(action);
        sendAction(action);
      }
    } else {
      setSelectedIngredients(prev => 
        prev.includes(card.id) ? prev.filter(id => id !== card.id) : [...prev, card.id]
      );
    }
  };

  const applyWildEffect = (playerId: number, cardId: string, effect: string) => {
    setGameState(prev => {
      if (!prev) return null;
      const players = [...prev.players];
      const me = { ...players[playerId] };
      const opp = { ...players[1 - playerId] };
      players[playerId] = me;
      players[1 - playerId] = opp;
      me.hand = me.hand.filter(c => c.id !== cardId);
      if (effect === 'STUN') {
        opp.isStunned = true;
        setTimeout(() => {
          const rec: GameAction = { type: 'RECOVERY', playerId: 1 - playerId };
          handleAction(rec);
          sendAction(rec);
        }, 4000);
      }
      if (effect === 'SABOTAGE' && opp.hand.length > 0) opp.hand.pop();
      if (effect === 'BUFF') me.hand.push(...prev.drawPile.slice(0, 2));
      return { ...prev, players, message: `${me.name.toUpperCase()} ACTIVATED WILD!` };
    });
  };

  const applyStartCook = (playerId: number, orderId: string, ingredientIds: string[], assignments: Record<string, string>) => {
    setGameState(prev => {
      if (!prev) return null;
      const players = [...prev.players];
      const order = prev.activeOrders.find(o => o.id === orderId);
      if (!order) return prev;
      players[playerId] = {
        ...players[playerId],
        hand: players[playerId].hand.filter(c => !ingredientIds.includes(c.id)),
        cookingSlot: { order, tapsDone: 0 }
      };
      return {
        ...prev,
        players,
        activeOrders: prev.activeOrders.map(o => o.id === orderId ? { ...o, lockedBy: playerId } : o)
      };
    });
  };

  const applyTap = (playerId: number) => {
    setGameState(prev => {
      if (!prev || !prev.players[playerId].cookingSlot.order) return prev;
      const players = [...prev.players];
      const p = { ...players[playerId] };
      players[playerId] = p;
      const order = p.cookingSlot.order!;
      p.cookingSlot.tapsDone += 1;
      if (p.cookingSlot.tapsDone >= order.tapsRequired) {
        p.score += order.points;
        p.cookedDishes.push(order);
        p.cookingSlot = { order: null, tapsDone: 0 };
        const newOrders = [...prev.orderDeck];
        const active = prev.activeOrders.filter(o => o.id !== order.id);
        if (newOrders.length > 0) active.push(newOrders.shift()!);
        return { ...prev, players, activeOrders: active, orderDeck: newOrders, message: `${p.name} SERVED ${order.name}!`, winner: p.score >= 100 ? p : null };
      }
      return { ...prev, players };
    });
  };

  const startCooking = () => {
    if (!gameState || !selectedOrder || gameState.players[myPlayerId].isStunned) return;
    if (!validateRecipe()) {
      setGameState(prev => prev ? { ...prev, message: "BAHAN TIDAK SESUAI!" } : null);
      return;
    }
    const action: GameAction = { 
      type: 'START_COOK', 
      playerId: myPlayerId, 
      orderId: selectedOrder.id, 
      ingredientIds: selectedIngredients,
      wildcardAssignments: wildcardAssignments 
    };
    handleAction(action);
    sendAction(action);
    setSelectedOrder(null);
    setSelectedIngredients([]);
    setWildcardAssignments({});
  };

  const handleTap = () => {
    const action: GameAction = { type: 'TAP', playerId: myPlayerId };
    handleAction(action);
    sendAction(action);
  };

  if (status === "LOBBY") return (
    <div className="min-h-screen bg-[#F3CD57] flex flex-col items-center justify-center text-white p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
        <div className="absolute top-10 left-10 text-9xl">🍳</div>
        <div className="absolute bottom-10 right-10 text-9xl">🔥</div>
      </div>

      <div className="z-10 flex flex-col items-center animate-fade-in text-center scale-90 md:scale-100">
        <Logo />
        <p className="font-medium text-[#9A1B1B] text-2xl mt-4 mb-12 tracking-wide italic lowercase">kitchen that stay wild</p>
        
        <div className="flex flex-col gap-6 w-full max-w-sm px-6">
          <button onClick={initHost} className="bg-[#9A1B1B] bangers text-4xl py-6 rounded-full hover:bg-white hover:text-[#9A1B1B] transition-all shadow-xl transform hover:scale-105 active:scale-95 border-b-8 border-[#631111]">CREATE KITCHEN</button>
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-[#9A1B1B]/30" />
            <span className="bangers text-[#9A1B1B]/50">OR</span>
            <div className="h-px flex-1 bg-[#9A1B1B]/30" />
          </div>
          <input 
            type="text" 
            placeholder="ROOM CODE..." 
            className="bg-white/95 border-4 border-[#9A1B1B]/20 rounded-full px-8 py-5 text-center bangers text-2xl outline-none focus:border-[#9A1B1B] transition-all text-[#9A1B1B] shadow-inner uppercase"
            value={roomIdInput}
            onChange={(e) => setRoomIdInput(e.target.value)}
          />
          <button onClick={initJoin} className="bg-white text-[#9A1B1B] bangers text-4xl py-6 rounded-full hover:bg-[#9A1B1B] hover:text-white transition-all shadow-xl transform hover:scale-105 active:scale-95 border-b-8 border-gray-200">JOIN WAR</button>
        </div>
      </div>

      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-15px); } }
        @keyframes float-delayed { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-float-delayed { animation: float-delayed 4s ease-in-out infinite; }
        .animate-bounce-slow { animation: bounce-slow 5s ease-in-out infinite; }
      `}</style>
    </div>
  );

  if (status === "WAITING") return (
    <div className="min-h-screen bg-[#F3CD57] flex flex-col items-center justify-center text-[#9A1B1B] p-6">
      <h2 className="bangers text-4xl mb-6 uppercase tracking-widest opacity-70">WAITING FOR RIVAL...</h2>
      <div className="bg-white p-12 rounded-[4rem] border-8 border-[#9A1B1B] text-center animate-pulse shadow-2xl">
        <p className="text-xs font-black uppercase tracking-widest text-[#9A1B1B]/50 mb-3">YOUR ROOM CODE</p>
        <h1 className="bangers text-8xl text-[#9A1B1B] select-all tracking-tighter">{peer?.id}</h1>
      </div>
      <p className="mt-10 text-[#9A1B1B]/60 text-[14px] font-black uppercase tracking-widest bg-white/30 px-6 py-2 rounded-full">Share this code with your rival chef</p>
    </div>
  );

  if (!gameState) return null;

  const me = gameState.players[myPlayerId];
  const opp = gameState.players[1 - myPlayerId];
  const recipeValid = validateRecipe();

  return (
    <div className="min-h-screen bg-[#050505] p-4 lg:p-8 text-white relative overflow-x-hidden">
      {transformingCardId && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6">
          <div className="p-12 bg-zinc-900 border-4 border-[#F3CD57] rounded-[4rem] text-center shadow-[0_0_100px_rgba(243,205,87,0.1)] max-w-lg w-full">
            <h2 className="bangers text-5xl mb-4 text-[#F3CD57]">GOLDEN APRON</h2>
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-10">Pilih bahan untuk digantikan</p>
            <div className="grid grid-cols-1 gap-4">
              {selectedOrder?.ingredients.map((ing, i) => (
                <button key={i} onClick={() => {
                  setWildcardAssignments(prev => ({ ...prev, [transformingCardId]: ing }));
                  setSelectedIngredients(prev => [...prev, transformingCardId]);
                  setTransformingCardId(null);
                }} className="bg-zinc-800 p-6 bangers text-3xl rounded-2xl hover:bg-[#F3CD57] hover:text-black transition-all border border-white/5 active:scale-95">
                  {ing}
                </button>
              ))}
            </div>
            <button onClick={() => setTransformingCardId(null)} className="mt-10 text-zinc-500 uppercase font-bold text-xs hover:text-white transition-colors">Batal</button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center bg-zinc-900/90 p-8 rounded-[3rem] border-b-8 border-[#9A1B1B] mb-10 shadow-2xl gap-8">
        <div className="text-center md:text-left flex-1">
           <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.3em]">YOU ({me.name})</p>
           <h2 className="bangers text-7xl text-[#F3CD57] leading-none">{me.score} <span className="text-sm">PTS</span></h2>
           {me.isStunned && (
              <div className="mt-3 inline-block px-4 py-1 bg-red-600 rounded-full text-[10px] font-black animate-pulse">STUNNED!</div>
           )}
        </div>
        
        <div className="text-center px-4 flex-[2]">
          <h1 className="bangers text-4xl text-white italic tracking-widest uppercase">{gameState.message}</h1>
          <p className="text-[8px] text-zinc-700 mt-2 font-black tracking-widest">P2P MULTIPLAYER STABLE</p>
        </div>

        <div className="text-center md:text-right flex-1">
           <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.3em]">{opp.name}</p>
           <h2 className="bangers text-7xl text-zinc-400 leading-none">{opp.score} <span className="text-sm">PTS</span></h2>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8">
          <div className="bg-zinc-900/40 p-10 rounded-[4rem] mb-10 border border-white/5 backdrop-blur-sm relative">
            <h3 className="bangers text-3xl text-zinc-600 tracking-widest mb-10 uppercase">MARKETPLACE</h3>
            <div className="flex flex-wrap gap-6 justify-center">
              {gameState.activeOrders.map(o => (
                <div key={o.id} className="relative group transition-transform hover:scale-105 active:scale-95">
                  <GameCard 
                    card={o} 
                    selected={selectedOrder?.id === o.id} 
                    onClick={() => {
                       if (o.lockedBy === undefined) setSelectedOrder(o);
                    }} 
                  />
                  {o.lockedBy !== undefined && (
                    <div className={`absolute inset-0 ${o.lockedBy === myPlayerId ? 'bg-orange-500/40' : 'bg-red-600/60'} rounded-[1.5rem] flex items-center justify-center bangers text-3xl -rotate-12 backdrop-blur-[2px] animate-pulse z-10`}>
                      {o.lockedBy === myPlayerId ? 'MY POT' : 'TAKEN'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center">
            <CookingArea player={me} onTap={handleTap} isActive={!!me.cookingSlot.order} />
            {selectedOrder && (
              <div className="mt-10 flex flex-col items-center gap-4">
                 <button 
                  onClick={startCooking} 
                  className={`bangers text-5xl px-20 py-6 rounded-full shadow-2xl transition-all transform hover:scale-105 active:scale-95 ${recipeValid ? 'bg-[#9A1B1B] text-white animate-bounce' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'}`}
                 >
                  START COOKING!
                 </button>
                 {!recipeValid && selectedOrder && (
                   <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Bahan belum sesuai resep</p>
                 )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <button 
            disabled={me.drawCooldown > 0 || me.isStunned} 
            onClick={handleDraw}
            className={`w-full bangers text-5xl py-8 rounded-[2.5rem] transition-all relative overflow-hidden group active:scale-95 ${me.drawCooldown > 0 || me.isStunned ? 'bg-zinc-900 text-zinc-700' : 'bg-white text-black shadow-2xl hover:bg-[#9A1B1B] hover:text-white'}`}
          >
            <span className="relative z-10">{me.isStunned ? 'STUNNED' : (me.drawCooldown > 0 ? `COOLING...` : 'DRAW CARDS')}</span>
            {me.drawCooldown > 0 && !me.isStunned && (
              <div className="absolute inset-0 bg-zinc-800 origin-left transition-transform duration-[3000ms] linear" style={{ transform: `scaleX(${me.drawCooldown / DRAW_COOLDOWN_MS})` }} />
            )}
          </button>

          <div className="bg-zinc-900/60 p-8 rounded-[3rem] border border-white/5 h-[600px] overflow-y-auto custom-scrollbar">
             <div className="flex justify-between items-center mb-6">
                <h3 className="bangers text-2xl text-zinc-500 uppercase tracking-widest">MY PANTRY</h3>
                <span className="text-[10px] text-[#F3CD57] font-black">{me.hand.length} CARDS</span>
             </div>
             <div className="grid grid-cols-2 gap-4">
               {me.hand.map((c, idx) => (
                 <GameCard 
                  key={`${c.id}-${idx}`} 
                  card={c} 
                  size="sm" 
                  selected={selectedIngredients.includes(c.id)} 
                  onClick={() => handleCardSelection(c)} 
                  assignment={wildcardAssignments[c.id]} 
                 />
               ))}
             </div>
          </div>
        </div>
      </div>

      {gameState.winner && (
        <div className="fixed inset-0 z-[300] bg-[#9A1B1B] flex flex-col items-center justify-center p-10 animate-fade-in">
           <h1 className="bangers text-[15rem] text-white leading-none drop-shadow-2xl">{gameState.winner.id === myPlayerId ? 'VICTORY' : 'DEFEAT'}</h1>
           <p className="bangers text-4xl text-white/80 mb-16 tracking-widest">{gameState.winner.name.toUpperCase()} REIGNS SUPREME</p>
           <button onClick={() => window.location.reload()} className="bg-white text-black bangers text-6xl px-24 py-10 rounded-full hover:scale-110 active:scale-95 transition-all shadow-2xl">REMATCH</button>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.5s ease-out; }
      `}</style>
    </div>
  );
};

export default App;
