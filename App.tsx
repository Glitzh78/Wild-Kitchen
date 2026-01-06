
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { GameState, Player, Card, OrderCard, GamePhase, CardClass, IngredientCard, WildCard } from './types';
import { INGREDIENTS, WILDS, ORDERS } from './constants';
import { GameCard } from './components/GameCard';
import { CookingArea } from './components/CookingArea';

const INITIAL_HAND_SIZE = 5;

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderCard | null>(null);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [isGeneratingAssets, setIsGeneratingAssets] = useState(false);
  const [assetProgress, setAssetProgress] = useState(0);
  
  // Cache for generated images to avoid re-generating
  const imageCache = useRef<Record<string, string>>({});

  const generateImage = async (prompt: string, id: string): Promise<string> => {
    if (imageCache.current[id]) return imageCache.current[id];
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
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
      console.error("Image generation failed for:", id, error);
    }
    return `https://picsum.photos/seed/${id}/200/300`; // Fallback
  };

  // Initialize Game with AI Assets
  const initGame = useCallback(async () => {
    setIsGeneratingAssets(true);
    setAssetProgress(0);

    // Prepare all unique cards for image generation
    const uniqueCards = [...INGREDIENTS, ...WILDS, ...ORDERS];
    const total = uniqueCards.length;
    
    // We only generate a few key ones to start quickly, then generate others on demand
    // For this demo, let's generate the first set of visible assets
    const initialBatch = uniqueCards.slice(0, 10);
    
    let count = 0;
    for (const card of initialBatch) {
      card.imageUrl = await generateImage(card.artPrompt, card.id);
      count++;
      setAssetProgress(Math.floor((count / initialBatch.length) * 100));
    }

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
      message: 'Game Start! Player 1, Draw 2 cards.',
      winner: null
    });
    
    setIsGeneratingAssets(false);
  }, []);

  useEffect(() => {
    initGame();
  }, []);

  // Update image on demand if it's missing (lazy load)
  const ensureImage = async (card: Card | OrderCard) => {
    if (card.imageUrl) return;
    const url = await generateImage(card.artPrompt, card.id);
    card.imageUrl = url;
    setGameState(prev => prev ? { ...prev } : null); // Trigger re-render
  };

  const nextTurn = () => {
    if (!gameState) return;
    const nextIdx = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    setSelectedOrder(null);
    setSelectedIngredients([]);

    setGameState(prev => {
      if (!prev) return prev;
      const nextPlayer = prev.players[nextIdx];
      return {
        ...prev,
        currentPlayerIndex: nextIdx,
        phase: 'DRAW',
        message: `${nextPlayer.name}'s turn. Draw 2 cards.`,
      };
    });
  };

  const drawCards = () => {
    if (!gameState || gameState.phase !== 'DRAW') return;

    setGameState(prev => {
      if (!prev) return prev;
      const deck = [...prev.drawPile];
      const drawn = deck.splice(0, 2);
      
      // Lazy load images for drawn cards
      drawn.forEach(ensureImage);
      
      const players = [...prev.players];
      players[prev.currentPlayerIndex].hand.push(...drawn);

      return {
        ...prev,
        drawPile: deck,
        players,
        phase: 'ACTION',
        message: 'Action Phase: Play WILD cards or select an Order to Cook.'
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

      switch ((card as any).effect) {
        case 'STUN':
          opponent.isStunned = true;
          msg = `Stunned ${opponent.name}! They can't cook next turn.`;
          break;
        case 'SABOTAGE':
          if (opponent.hand.length > 0) opponent.hand.pop();
          msg = `Sabotaged! ${opponent.name} discarded a card.`;
          break;
        case 'BUFF':
          const deck = [...prev.drawPile];
          const drawn = deck.splice(0, 2);
          drawn.forEach(ensureImage);
          me.hand.push(...drawn);
          return { ...prev, drawPile: deck, players, message: 'Drew 2 extra cards!' };
        case 'CHAOS':
          const newOrders = [...prev.orderDeck].slice(0, 3);
          newOrders.forEach(ensureImage);
          const remainingOrders = [...prev.orderDeck].slice(3);
          return { ...prev, activeOrders: newOrders, orderDeck: remainingOrders, message: 'Order Swap!' };
        default:
          break;
      }
      return { ...prev, players, message: msg };
    });
  };

  const toggleIngredientSelection = (cardId: string) => {
    if (!gameState || gameState.phase !== 'ACTION') return;
    setSelectedIngredients(prev => 
      prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
    );
  };

  const startCooking = () => {
    if (!gameState || !selectedOrder) return;
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.isStunned) {
      setGameState(prev => prev ? { ...prev, message: "You are stunned! Skip cooking this turn." } : null);
      currentPlayer.isStunned = false;
      return;
    }

    const selectedCards = currentPlayer.hand.filter(c => selectedIngredients.includes(c.id));
    const selectedNames = selectedCards.map(c => c.name);
    const hasWildcard = selectedCards.some(c => c.type === 'WILD' && (c as any).effect === 'WILDCARD');
    const required = [...selectedOrder.ingredients];
    let isValid = true;

    if (!hasWildcard) {
      if (selectedNames.length !== required.length) isValid = false;
      else {
        required.forEach(req => {
          if (!selectedNames.includes(req)) isValid = false;
        });
      }
    } else {
      if (selectedNames.length !== required.length) isValid = false;
    }

    if (!isValid) {
      setGameState(prev => prev ? { ...prev, message: "Missing ingredients for this dish!" } : null);
      return;
    }

    setGameState(prev => {
      if (!prev) return prev;
      const players = [...prev.players];
      const p = players[prev.currentPlayerIndex];
      p.hand = p.hand.filter(c => !selectedIngredients.includes(c.id));
      p.cookingSlot = { order: selectedOrder, tapsDone: 0 };
      const activeOrders = prev.activeOrders.filter(o => o.id !== selectedOrder.id);
      
      return {
        ...prev,
        players,
        activeOrders,
        phase: 'TAPPING',
        message: `Cooking ${selectedOrder.name}! TAP RAPIDLY!`
      };
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
        
        if (p.score >= 100) {
          return { ...prev, players, winner: p, message: `${p.name} WINS!` };
        }

        const newOrderDeck = [...prev.orderDeck];
        const newActive = [...prev.activeOrders];
        if (newOrderDeck.length > 0) {
          const nextOrder = newOrderDeck.shift()!;
          ensureImage(nextOrder);
          newActive.push(nextOrder);
        }

        return {
          ...prev,
          players,
          activeOrders: newActive,
          orderDeck: newOrderDeck,
          phase: 'ACTION',
          message: `Finished cooking ${order.name}! +${order.points} points.`
        };
      }

      return { ...prev, players };
    });
  };

  if (isGeneratingAssets) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-8">
        <div className="w-full max-w-md bg-white/10 h-4 rounded-full overflow-hidden mb-4 border border-white/20">
          <div className="h-full bg-yellow-500 transition-all duration-500" style={{ width: `${assetProgress}%` }} />
        </div>
        <h2 className="text-2xl font-black bangers tracking-widest animate-pulse">PREPARING THE KITCHEN...</h2>
        <p className="text-xs text-gray-400 mt-2 uppercase">Generating High-Quality Card Art {assetProgress}%</p>
      </div>
    );
  }

  if (!gameState) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading Game...</div>;

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  return (
    <div className="min-h-screen bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] bg-[#2b1b17] p-4 text-white font-sans overflow-x-hidden selection:bg-yellow-500 selection:text-black">
      
      {/* HUD / Header */}
      <div className="flex justify-between items-center bg-black/60 p-4 rounded-2xl mb-6 backdrop-blur-xl border border-white/10 shadow-2xl">
        <div className="flex gap-8">
          {gameState.players.map(p => (
            <div key={p.id} className={`p-3 rounded-xl transition-all duration-300 ${gameState.currentPlayerIndex === p.id ? 'ring-2 ring-yellow-400 bg-yellow-400/20 shadow-[0_0_20px_rgba(250,204,21,0.3)]' : 'opacity-60'}`}>
              <p className="font-bold text-xs uppercase tracking-tighter text-gray-400">{p.name}</p>
              <p className="text-yellow-400 text-3xl font-black bangers">{p.score} <span className="text-[10px] bangers">PTS</span></p>
              <div className="flex gap-1 mt-1">
                {p.cookedDishes.map((d, i) => (
                   <img key={i} src={d.imageUrl} className="w-5 h-5 rounded-full border border-white/30 object-cover" alt={d.name} title={d.name} />
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="text-center flex-1 mx-4">
          <p className="text-2xl font-black bangers tracking-wider text-yellow-500 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{gameState.message}</p>
          <div className="mt-1 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
            {gameState.phase === 'DRAW' && "➔ Click DRAW to start"}
            {gameState.phase === 'ACTION' && "➔ Play Wilds or Select Dish"}
            {gameState.phase === 'TAPPING' && "➔ MASH BUTTON TO COOK!"}
          </div>
        </div>

        <div className="flex gap-4">
          {gameState.phase === 'DRAW' && (
            <button onClick={drawCards} className="bg-gradient-to-b from-yellow-400 to-yellow-600 hover:from-yellow-300 hover:to-yellow-500 px-8 py-3 rounded-xl font-black text-black shadow-xl animate-bounce bangers text-xl">DRAW CARDS</button>
          )}
          {gameState.phase === 'ACTION' && (
            <button onClick={nextTurn} className="bg-white/10 hover:bg-white/20 px-8 py-3 rounded-xl font-bold border border-white/20 transition-all active:scale-95 bangers text-xl">END TURN</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Orders & Stove */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Active Orders */}
          <div className="bg-black/40 p-6 rounded-3xl border border-white/5 backdrop-blur-sm shadow-inner">
            <h3 className="text-xs font-black text-gray-500 mb-6 uppercase tracking-[0.3em]">RESTAURANT MENU</h3>
            <div className="flex flex-wrap gap-6 justify-center">
              {gameState.activeOrders.map(order => (
                <GameCard 
                  key={order.id} 
                  card={order} 
                  selected={selectedOrder?.id === order.id}
                  onClick={() => setSelectedOrder(order)}
                  disabled={gameState.phase !== 'ACTION'}
                  size="md"
                />
              ))}
            </div>
          </div>

          {/* Cooking Slot */}
          <div className="flex flex-col items-center">
            <h3 className="text-xs font-black text-gray-500 mb-6 uppercase tracking-[0.3em]">MASTER CHEF STATION</h3>
            <CookingArea 
              player={currentPlayer} 
              onTap={handleTap} 
              isActive={gameState.phase === 'TAPPING' || (gameState.phase === 'ACTION' && !!selectedOrder)}
            />
            
            {gameState.phase === 'ACTION' && selectedOrder && (
              <button 
                onClick={startCooking}
                className="mt-8 bg-gradient-to-t from-red-700 to-red-500 hover:from-red-600 hover:to-red-400 px-14 py-4 rounded-2xl font-black text-2xl shadow-[0_10px_30px_rgba(220,38,38,0.4)] transition-all transform hover:scale-110 active:scale-90 border-t border-white/30 bangers tracking-widest"
              >
                COOK IT!
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Player Hand */}
        <div className="lg:col-span-5 bg-black/50 p-6 rounded-3xl border border-white/10 h-fit shadow-2xl backdrop-blur-md">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.3em]">PANTRY & PREP</h3>
            <span className="bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 px-3 py-1 rounded-full text-[10px] font-black">{currentPlayer.hand.length} CARDS</span>
          </div>
          
          <div className="grid grid-cols-3 gap-3 max-h-[600px] overflow-y-auto p-2 scrollbar-hide">
            {currentPlayer.hand.map((card, idx) => (
              <GameCard 
                key={`${card.id}-${idx}`} 
                card={card} 
                selected={selectedIngredients.includes(card.id)}
                onClick={() => {
                  if (card.type === 'WILD') handleWildAction(card);
                  else toggleIngredientSelection(card.id);
                }}
                disabled={gameState.phase === 'DRAW' || gameState.phase === 'TAPPING'}
                size="sm"
              />
            ))}
            {currentPlayer.hand.length === 0 && (
              <div className="col-span-3 h-44 border-2 border-dashed border-white/10 rounded-3xl flex items-center justify-center text-white/20 font-black tracking-widest">
                OUT OF INGREDIENTS
              </div>
            )}
          </div>
          
          {gameState.phase === 'ACTION' && (
            <div className="mt-6 p-4 bg-gradient-to-r from-yellow-500/10 to-transparent rounded-2xl border border-yellow-500/20 text-[10px]">
              <p className="font-black text-yellow-500 mb-2 uppercase tracking-widest">CHEF'S HANDBOOK</p>
              <ul className="space-y-1 text-gray-400 font-medium">
                <li>• Match ingredients to the Dish's requirements.</li>
                <li>• <span className="text-purple-400">WILD CARDS</span> trigger automatically on click!</li>
                <li>• Harder dishes (S/A rank) give massive score boosts.</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Winner Modal */}
      {gameState.winner && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-[#ffd700] via-[#ffaa00] to-[#ff8800] p-12 rounded-[3rem] text-center shadow-[0_0_100px_rgba(255,165,0,0.6)] border-8 border-white/30 max-w-md w-full relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none" />
            <h2 className="text-6xl font-black text-white mb-2 bangers drop-shadow-2xl">LEGENDARY CHEF!</h2>
            <div className="text-9xl mb-6 filter drop-shadow-2xl animate-bounce">👨‍🍳</div>
            <p className="text-3xl font-black text-black mb-2 uppercase bangers tracking-tight">{gameState.winner.name}</p>
            <p className="text-white text-xl font-bold mb-10 italic drop-shadow-md">Final Score: {gameState.winner.score} PTS</p>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full py-5 bg-black text-white rounded-2xl font-black text-2xl hover:bg-zinc-900 transition-all shadow-2xl bangers tracking-widest transform hover:scale-105 active:scale-95"
            >
              NEW SERVICE
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
