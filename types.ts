
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
}

export type Card = IngredientCard | WildCard;

export interface Player {
  id: number;
  name: string;
  hand: Card[];
  cookedDishes: OrderCard[];
  score: number;
  isStunned: boolean;
  cookingSlot: {
    order: OrderCard | null;
    tapsDone: number;
  };
}

export type GamePhase = 'DRAW' | 'ACTION' | 'COOK' | 'TAPPING';

export interface GameState {
  players: Player[];
  currentPlayerIndex: number;
  drawPile: Card[];
  orderDeck: OrderCard[];
  activeOrders: OrderCard[];
  phase: GamePhase;
  message: string;
  winner: Player | null;
}
