
import React, { useState, useEffect, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { GameState, Player, Card, OrderCard, WildCard } from './types';
import { INGREDIENTS, WILDS, ORDERS } from './constants';
import { GameCard } from './components/GameCard';
import { CookingArea } from './components/CookingArea';

const INITIAL_HAND_SIZE = 4;
const DRAW_COOLDOWN_MS = 3000;

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
  const [status, setStatus] = useState("LOBBY"); // LOBBY, CONNECTING, WAITING, PLAYING

  const [selectedOrder, setSelectedOrder] = useState<OrderCard | null>(null);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [wildcardAssignments, setWildcardAssignments] = useState<Record<string, string>>({});
  const [transformingCardId, setTransformingCardId] = useState<string | null>(null);

  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- NETWORKING LOGIC ---

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
      console.log('My peer ID is: ' + id);
    });

    newPeer.on('connection', (c) => {
      setConn(c);
      c.on('data', (data) => handleAction(data as GameAction));
      c.on('open', () => {
        // Fix: Use newPeer.id instead of id which was not in scope
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

  // --- GAME LOGIC ---

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

  const handleDraw = () => {
    if (!gameState || gameState.players[myPlayerId].drawCooldown > 0) return;
    
    // In P2P, only Host should technically manage the deck to avoid race conditions
    // But for fast feedback, we'll draw locally and inform the other.
    const drawn = gameState.drawPile.slice(0, 2);
    if (drawn.length === 0) return;

    const action: GameAction = { type: 'DRAW', playerId: myPlayerId, cards: drawn };
    handleAction(action);
    sendAction(action);
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
  };

  const handleTap = () => {
    const action: GameAction = { type: 'TAP', playerId: myPlayerId };
    handleAction(action);
    sendAction(action);
  };

  // --- RENDERING ---

  if (status === "LOBBY") return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-white p-6 relative">
      <h1 className="bangers text-[12rem] text-orange-500 animate-glitch mb-2">WILD KITCHEN</h1>
      <p className="bangers text-3xl text-zinc-500 mb-12 tracking-widest">ONLINE MULTIPLAYER WAR</p>
      <div className="flex flex-col gap-6 w-full max-w-sm">
        <button onClick={initHost} className="bg-orange-600 bangers text-4xl py-6 rounded-full hover:bg-white hover:text-black transition-all">CREATE KITCHEN</button>
        <div className="h-px bg-white/10 my-4" />
        <input 
          type="text" 
          placeholder="ENTER ROOM CODE..." 
          className="bg-zinc-900 border-2 border-white/10 rounded-full px-8 py-4 text-center bangers text-2xl outline-none focus:border-orange-500 transition-all"
          value={roomIdInput}
          onChange={(e) => setRoomIdInput(e.target.value)}
        />
        <button onClick={initJoin} className="bg-white text-black bangers text-4xl py-6 rounded-full hover:bg-orange-600 hover:text-white transition-all">JOIN WAR</button>
      </div>
    </div>
  );

  if (status === "WAITING") return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-white p-6">
      <h2 className="bangers text-4xl text-zinc-500 mb-4">WAITING FOR CHEF...</h2>
      <div className="bg-zinc-900 p-10 rounded-[3rem] border-2 border-orange-500 text-center animate-pulse">
        <p className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">ROOM CODE</p>
        <h1 className="bangers text-7xl text-white">{peer?.id}</h1>
      </div>
      <p className="mt-8 text-zinc-600 text-[10px] font-bold uppercase tracking-widest">Give this code to your friend</p>
    </div>
  );

  if (!gameState) return null;

  const me = gameState.players[myPlayerId];
  const opp = gameState.players[1 - myPlayerId];

  return (
    <div className="min-h-screen bg-[#020202] p-4 lg:p-8 text-white">
      {transformingCardId && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-3xl flex items-center justify-center">
          <div className="p-12 bg-zinc-900 border-4 border-orange-500 rounded-[4rem] text-center shadow-[0_0_100px_rgba(249,115,22,0.2)]">
            <h2 className="bangers text-5xl mb-8 text-orange-500">GOLDEN APRON WILD</h2>
            <div className="grid grid-cols-2 gap-6">
              {selectedOrder?.ingredients.map((ing, i) => (
                <button key={i} onClick={() => {
                  setWildcardAssignments(prev => ({ ...prev, [transformingCardId]: ing }));
                  setSelectedIngredients(prev => [...prev, transformingCardId]);
                  setTransformingCardId(null);
                }} className="bg-zinc-800 p-6 bangers text-2xl rounded-2xl hover:bg-orange-500 hover:text-black transition-all border border-white/5">{ing}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SCOREBOARD */}
      <div className="max-w-7xl mx-auto flex justify-between items-center bg-zinc-900/90 p-8 rounded-[3rem] border-b-8 border-orange-600 mb-10 shadow-2xl">
        <div className="text-left">
           <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.3em]">YOU ({me.name})</p>
           <h2 className="bangers text-7xl text-orange-500">{me.score} <span className="text-sm">PTS</span></h2>
           <div className={`mt-3 h-2 w-48 bg-zinc-800 rounded-full overflow-hidden ${me.isStunned ? 'opacity-100' : 'opacity-0'}`}>
              <div className="h-full bg-blue-500 animate-pulse w-full" />
           </div>
        </div>
        
        <div className="text-center px-12 flex-1">
          <h1 className="bangers text-4xl text-white italic">{gameState.message}</h1>
          <p className="text-[8px] text-zinc-700 mt-2">CONNECTED P2P</p>
        </div>

        <div className="text-right">
           <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.3em]">{opp.name}</p>
           <h2 className="bangers text-7xl text-zinc-400">{opp.score} <span className="text-sm">PTS</span></h2>
           {opp.cookingSlot.order && (
             <p className="text-[10px] text-orange-500 font-bold animate-pulse mt-2 uppercase tracking-widest">OPPONENT IS COOKING!</p>
           )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8">
          <div className="bg-zinc-900/40 p-10 rounded-[4rem] mb-10 border border-white/5 backdrop-blur-sm">
            <h3 className="bangers text-3xl text-zinc-600 tracking-widest mb-10">SHARED MARKET</h3>
            <div className="flex flex-wrap gap-6 justify-center">
              {gameState.activeOrders.map(o => (
                <div key={o.id} className="relative group">
                  <GameCard card={o} selected={selectedOrder?.id === o.id} onClick={() => setSelectedOrder(o)} />
                  {o.lockedBy !== undefined && (
                    <div className={`absolute inset-0 ${o.lockedBy === myPlayerId ? 'bg-blue-600/40' : 'bg-red-600/60'} rounded-[1.5rem] flex items-center justify-center bangers text-3xl -rotate-12 backdrop-blur-[2px] animate-pulse`}>
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
              <button onClick={startCooking} className="mt-10 bg-orange-600 bangers text-5xl px-20 py-6 rounded-full shadow-[0_20px_60px_rgba(234,88,12,0.4)] animate-bounce hover:scale-105 active:scale-95 transition-all">START COOKING!</button>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <button 
            disabled={me.drawCooldown > 0} 
            onClick={handleDraw}
            className={`w-full bangers text-5xl py-8 rounded-[2.5rem] transition-all relative overflow-hidden ${me.drawCooldown > 0 ? 'bg-zinc-900 text-zinc-700' : 'bg-white text-black shadow-2xl hover:bg-orange-500'}`}
          >
            <span className="relative z-10">{me.drawCooldown > 0 ? `COOLING...` : 'DRAW CARDS'}</span>
          </button>

          <div className="bg-zinc-900/60 p-8 rounded-[3rem] border border-white/5 h-[600px] overflow-y-auto">
             <h3 className="bangers text-2xl text-zinc-500 mb-6 uppercase tracking-widest">MY PANTRY</h3>
             <div className="grid grid-cols-2 gap-4">
               {me.hand.map(c => (
                 <GameCard 
                  key={c.id} 
                  card={c} 
                  size="sm" 
                  selected={selectedIngredients.includes(c.id)} 
                  onClick={() => {
                    if (c.type === 'WILD') {
                      const wild = c as WildCard;
                      if (wild.effect === 'WILDCARD') {
                        if (!selectedOrder) return;
                        setTransformingCardId(c.id);
                      } else {
                        const action: GameAction = { type: 'WILD', playerId: myPlayerId, cardId: c.id, effect: wild.effect };
                        handleAction(action);
                        sendAction(action);
                      }
                    } else {
                      setSelectedIngredients(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id]);
                    }
                  }} 
                  assignment={wildcardAssignments[c.id]} 
                 />
               ))}
             </div>
          </div>
        </div>
      </div>

      {gameState.winner && (
        <div className="fixed inset-0 z-[300] bg-orange-600 flex flex-col items-center justify-center p-10">
           <h1 className="bangers text-[18rem] text-white">{gameState.winner.id === myPlayerId ? 'VICTORY' : 'DEFEAT'}</h1>
           <button onClick={() => window.location.reload()} className="bg-white text-black bangers text-6xl px-24 py-10 rounded-full">PLAY AGAIN</button>
        </div>
      )}
    </div>
  );
};

export default App;
