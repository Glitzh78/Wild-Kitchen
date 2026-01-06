
import { IngredientCard, OrderCard, WildCard } from './types';

const STYLE_PREFIX = "Professional 2D digital game art, culinary theme, vibrant colors, clean studio lighting, centered composition, high detail: ";

export const INGREDIENTS: IngredientCard[] = [
  { id: 'i1', name: 'Beras', type: 'INGREDIENT', rank: 'D', imageUrl: '', artPrompt: STYLE_PREFIX + "A bowl of high-quality raw white rice grains" },
  { id: 'i2', name: 'Telur', type: 'INGREDIENT', rank: 'D', imageUrl: '', artPrompt: STYLE_PREFIX + "Two organic brown eggs, one slightly cracked" },
  { id: 'i3', name: 'Saus', type: 'INGREDIENT', rank: 'D', imageUrl: '', artPrompt: STYLE_PREFIX + "A glass bottle of rich red tomato sauce" },
  { id: 'i4', name: 'Sayuran', type: 'INGREDIENT', rank: 'C', imageUrl: '', artPrompt: STYLE_PREFIX + "A bundle of fresh green leafy vegetables and carrots" },
  { id: 'i5', name: 'Tomat', type: 'INGREDIENT', rank: 'C', imageUrl: '', artPrompt: STYLE_PREFIX + "A ripe, juicy red tomato with a green stem" },
  { id: 'i6', name: 'Jeruk', type: 'INGREDIENT', rank: 'C', imageUrl: '', artPrompt: STYLE_PREFIX + "A fresh whole orange and a slice next to it" },
  { id: 'i7', name: 'Ikan', type: 'INGREDIENT', rank: 'B', imageUrl: '', artPrompt: STYLE_PREFIX + "A fresh salmon fillet on a wooden board" },
  { id: 'i8', name: 'Keju', type: 'INGREDIENT', rank: 'B', imageUrl: '', artPrompt: STYLE_PREFIX + "A wedge of swiss cheese with holes" },
  { id: 'i9', name: 'Bumbu Kari', type: 'INGREDIENT', rank: 'B', imageUrl: '', artPrompt: STYLE_PREFIX + "A small bowl of golden yellow curry powder" },
  { id: 'i10', name: 'Adonan Pizza', type: 'INGREDIENT', rank: 'B', imageUrl: '', artPrompt: STYLE_PREFIX + "A ball of fresh pizza dough on a floured surface" },
  { id: 'i11', name: 'Madu', type: 'INGREDIENT', rank: 'A', imageUrl: '', artPrompt: STYLE_PREFIX + "A glass jar of golden honey with a wooden dipper" },
  { id: 'i12', name: 'Lemon', type: 'INGREDIENT', rank: 'A', imageUrl: '', artPrompt: STYLE_PREFIX + "A bright yellow lemon cut in half" },
  { id: 'i13', name: 'Susu & Krim', type: 'INGREDIENT', rank: 'A', imageUrl: '', artPrompt: STYLE_PREFIX + "A glass bottle of milk and a swirl of thick cream" },
  { id: 'i14', name: 'Es Batu', type: 'INGREDIENT', rank: 'A', imageUrl: '', artPrompt: STYLE_PREFIX + "Shiny crystal clear ice cubes in a glass" },
  { id: 'i15', name: 'Matcha', type: 'INGREDIENT', rank: 'S', imageUrl: '', artPrompt: STYLE_PREFIX + "A bowl of vibrant green matcha powder with a bamboo whisk" },
];

export const WILDS: WildCard[] = [
  { id: 'w1', name: 'Golden Apron', type: 'WILD', effect: 'WILDCARD', description: 'Gunakan sebagai bahan apa saja!', imageUrl: '', artPrompt: STYLE_PREFIX + "A glowing golden chef apron floating in the air" },
  { id: 'w2', name: 'Wild West', type: 'WILD', effect: 'SHOWDOWN', description: 'Duel! Ambil 2 kartu lawan jika menang.', imageUrl: '', artPrompt: STYLE_PREFIX + "Two crossed chef knives in a western desert sunset" },
  { id: 'w3', name: 'Rat Attack', type: 'WILD', effect: 'SABOTAGE', description: 'Lawan buang 1 bahan terakhir yang diambil.', imageUrl: '', artPrompt: STYLE_PREFIX + "A cute but mischievous cartoon rat holding a wooden spoon" },
  { id: 'w4', name: 'Power Outage', type: 'WILD', effect: 'STUN', description: 'Hentikan masakan lawan selama 1 giliran.', imageUrl: '', artPrompt: STYLE_PREFIX + "A kitchen stove with sparks and a broken lightbulb icon" },
  { id: 'w5', name: 'Recipe Swap', type: 'WILD', effect: 'CHAOS', description: 'Tukar kartu pesanan yang tersedia.', imageUrl: '', artPrompt: STYLE_PREFIX + "Two floating recipe scrolls swapping places magically" },
  { id: 'w6', name: 'Saus Tumpah', type: 'WILD', effect: 'TARGETED', description: 'Pilih lawan, buang semua kartu Saus miliknya.', imageUrl: '', artPrompt: STYLE_PREFIX + "A spilled bottle of red sauce on a white kitchen counter" },
  { id: 'w7', name: 'Laris Manis', type: 'WILD', effect: 'BUFF', description: 'Ambil 2 kartu bahan tambahan gratis.', imageUrl: '', artPrompt: STYLE_PREFIX + "A line of happy customers waiting at a kitchen window" },
];

export const ORDERS: OrderCard[] = [
  { id: 'o1', name: 'Orange Juice', type: 'ORDER', class: 'EASY', ingredients: ['Jeruk', 'Es Batu'], points: 10, tapsRequired: 5, origin: 'USA', imageUrl: '', artPrompt: STYLE_PREFIX + "A glass of freshly squeezed orange juice with ice" },
  { id: 'o2', name: 'Sushi Nigiri', type: 'ORDER', class: 'EASY', ingredients: ['Beras', 'Ikan'], points: 10, tapsRequired: 5, origin: 'Japan', imageUrl: '', artPrompt: STYLE_PREFIX + "Two pieces of salmon nigiri sushi on a black plate" },
  { id: 'o3', name: 'Telur Gulung', type: 'ORDER', class: 'EASY', ingredients: ['Telur', 'Saus'], points: 10, tapsRequired: 5, origin: 'Indonesia', imageUrl: '', artPrompt: STYLE_PREFIX + "A stack of Indonesian style egg rolls on a wooden stick" },
  { id: 'o4', name: 'Hachimi', type: 'ORDER', class: 'MEDIUM', ingredients: ['Madu', 'Es Batu', 'Lemon'], points: 20, tapsRequired: 10, origin: 'Japan', imageUrl: '', artPrompt: STYLE_PREFIX + "A refreshing Japanese honey lemon drink with ice" },
  { id: 'o5', name: 'Pizza Margherita', type: 'ORDER', class: 'MEDIUM', ingredients: ['Adonan Pizza', 'Tomat', 'Keju'], points: 20, tapsRequired: 10, origin: 'Italy', imageUrl: '', artPrompt: STYLE_PREFIX + "A fresh pizza with tomato sauce, melted mozzarella and basil" },
  { id: 'o6', name: 'Chakalaka', type: 'ORDER', class: 'MEDIUM', ingredients: ['Sayuran', 'Bumbu Kari'], points: 20, tapsRequired: 10, origin: 'South Africa', imageUrl: '', artPrompt: STYLE_PREFIX + "A bowl of spicy South African vegetable relish" },
  { id: 'o7', name: 'Matcha Frappe', type: 'ORDER', class: 'HARD', ingredients: ['Matcha', 'Susu & Krim', 'Es Batu'], points: 40, tapsRequired: 15, origin: 'Japan', imageUrl: '', artPrompt: STYLE_PREFIX + "A creamy green matcha frappe with whipped cream" },
  { id: 'o8', name: 'Shakshouka', type: 'ORDER', class: 'HARD', ingredients: ['Telur', 'Tomat', 'Sayuran'], points: 40, tapsRequired: 15, origin: 'Tunisia', imageUrl: '', artPrompt: STYLE_PREFIX + "Poached eggs in a simmering tomato and vegetable sauce in a pan" },
];
