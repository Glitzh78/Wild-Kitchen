
import { IngredientCard, OrderCard, WildCard } from './types';

export const INGREDIENTS: IngredientCard[] = [
  { id: 'i1', name: 'Beras', type: 'INGREDIENT', rank: 'D', emoji: '🍚' },
  { id: 'i2', name: 'Telur', type: 'INGREDIENT', rank: 'D', emoji: '🥚' },
  { id: 'i3', name: 'Saus', type: 'INGREDIENT', rank: 'D', emoji: '🥫' },
  { id: 'i4', name: 'Sayuran', type: 'INGREDIENT', rank: 'C', emoji: '🥦' },
  { id: 'i5', name: 'Tomat', type: 'INGREDIENT', rank: 'C', emoji: '🍅' },
  { id: 'i6', name: 'Jeruk', type: 'INGREDIENT', rank: 'C', emoji: '🍊' },
  { id: 'i7', name: 'Ikan', type: 'INGREDIENT', rank: 'B', emoji: '🐟' },
  { id: 'i8', name: 'Keju', type: 'INGREDIENT', rank: 'B', emoji: '🧀' },
  { id: 'i9', name: 'Bumbu Kari', type: 'INGREDIENT', rank: 'B', emoji: '🧂' },
  { id: 'i10', name: 'Adonan Pizza', type: 'INGREDIENT', rank: 'B', emoji: '🥨' },
  { id: 'i11', name: 'Madu', type: 'INGREDIENT', rank: 'A', emoji: '🍯' },
  { id: 'i12', name: 'Lemon', type: 'INGREDIENT', rank: 'A', emoji: '🍋' },
  { id: 'i13', name: 'Susu & Krim', type: 'INGREDIENT', rank: 'A', emoji: '🥛' },
  { id: 'i14', name: 'Es Batu', type: 'INGREDIENT', rank: 'A', emoji: '🧊' },
  { id: 'i15', name: 'Matcha', type: 'INGREDIENT', rank: 'S', emoji: '🍵' },
];

export const WILDS: WildCard[] = [
  { id: 'w1', name: 'Golden Apron', type: 'WILD', effect: 'WILDCARD', description: 'Gunakan sebagai bahan apa saja!', emoji: '🌟' },
  { id: 'w2', name: 'Wild West', type: 'WILD', effect: 'SHOWDOWN', description: 'Duel! Ambil 2 kartu lawan.', emoji: '⚔️' },
  { id: 'w3', name: 'Rat Attack', type: 'WILD', effect: 'SABOTAGE', description: 'Lawan buang 1 kartu terakhir.', emoji: '🐀' },
  { id: 'w4', name: 'Power Outage', type: 'WILD', effect: 'STUN', description: 'Lawan tidak bisa masak 1 giliran.', emoji: '⚡' },
  { id: 'w5', name: 'Recipe Swap', type: 'WILD', effect: 'CHAOS', description: 'Tukar semua kartu pesanan.', emoji: '🔄' },
  { id: 'w6', name: 'Saus Tumpah', type: 'WILD', effect: 'TARGETED', description: 'Buang semua kartu Saus lawan.', emoji: '🧴' },
  { id: 'w7', name: 'Laris Manis', type: 'WILD', effect: 'BUFF', description: 'Ambil 2 kartu tambahan.', emoji: '💸' },
];

export const ORDERS: OrderCard[] = [
  { id: 'o1', name: 'Orange Juice', type: 'ORDER', class: 'EASY', ingredients: ['Jeruk', 'Es Batu'], points: 10, tapsRequired: 5, origin: 'USA', emoji: '🍹' },
  { id: 'o2', name: 'Sushi Nigiri', type: 'ORDER', class: 'EASY', ingredients: ['Beras', 'Ikan'], points: 10, tapsRequired: 5, origin: 'Japan', emoji: '🍣' },
  { id: 'o3', name: 'Telur Gulung', type: 'ORDER', class: 'EASY', ingredients: ['Telur', 'Saus'], points: 10, tapsRequired: 5, origin: 'Indonesia', emoji: '🍥' },
  { id: 'o4', name: 'Hachimi', type: 'ORDER', class: 'MEDIUM', ingredients: ['Madu', 'Es Batu', 'Lemon'], points: 20, tapsRequired: 10, origin: 'Japan', emoji: '🥤' },
  { id: 'o5', name: 'Pizza Margherita', type: 'ORDER', class: 'MEDIUM', ingredients: ['Adonan Pizza', 'Tomat', 'Keju'], points: 20, tapsRequired: 10, origin: 'Italy', emoji: '🍕' },
  { id: 'o6', name: 'Chakalaka', type: 'ORDER', class: 'MEDIUM', ingredients: ['Sayuran', 'Bumbu Kari'], points: 20, tapsRequired: 10, origin: 'South Africa', emoji: '🍲' },
  { id: 'o7', name: 'Matcha Frappe', type: 'ORDER', class: 'HARD', ingredients: ['Matcha', 'Susu & Krim', 'Es Batu'], points: 40, tapsRequired: 15, origin: 'Japan', emoji: '🍨' },
  { id: 'o8', name: 'Shakshouka', type: 'ORDER', class: 'HARD', ingredients: ['Telur', 'Tomat', 'Sayuran'], points: 40, tapsRequired: 15, origin: 'Tunisia', emoji: '🥘' },
];
