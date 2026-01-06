
export type CardClass = 'EASY' | 'MEDIUM' | 'HARD';

export interface IngredientCard {
  id: string;
  name: string;
  type: 'INGREDIENT';
  rank: 'D' | 'C' | 'B' | 'A' | 'S';
  emoji: string;
}

export interface WildCard {
  id: string;
  name: string;
  type: 'WILD';
  effect: string;
  description: string;
  emoji: string;
  assignedIngredient?: string;
}

export interface OrderCard {
  id: string;
  name: string;
  type: 'ORDER';
  class: CardClass;
  ingredients: string[];
  points: number;
  tapsRequired: number;
  origin: string;
  emoji: string;
  lockedBy?: number;
}

export type Card = IngredientCard | WildCard;

export interface Player {
  id: number;
  name: string;
  hand: Card[];
  cookedDishes: OrderCard[];
  score: number;
  isStunned: boolean;
  isAi: boolean;
  drawCooldown: number;
  cookingSlot: {
    order: OrderCard | null;
    tapsDone: number;
  };
}

export interface GameState {
  players: Player[];
  drawPile: Card[];
  orderDeck: OrderCard[];
  activeOrders: OrderCard[];
  message: string;
  winner: Player | null;
  isAiMode: boolean;
  gameStarted: boolean;
  isHost: boolean;
  peerId?: string;
}
