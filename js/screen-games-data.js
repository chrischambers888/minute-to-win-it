// The three built-in "screen games" (Math Wizz, Pricing $, Memory Flash): their settings and the lists they pick from.
// A game's `type` says which one it is. Games without a type (older saves and backups) are normal games.

export const SCREEN_TYPES = ['math', 'pricing', 'memory'];

export const TYPES = {
  normal: { option: 'Normal game (played in the room)' },
  math: {
    option: 'Math Wizz: problems on screen',
    name: 'Math Wizz',
    instructions:
      'Solve as many math problems as you can in 60 seconds. Most correct answers wins.',
  },
  pricing: {
    option: 'Pricing $: products on screen',
    name: 'Pricing $',
    instructions:
      'Five products, prices hidden. Write their letters in order from cheapest to most expensive. Most letters in the right spot wins.',
  },
  memory: {
    option: 'Memory Flash: things to remember on screen',
    name: 'Memory Flash',
    instructions:
      'Things flash on screen, then disappear. Write down as many as you can remember before time’s up. Most remembered wins.',
  },
};

export const isScreenGame = (g) => !!g && SCREEN_TYPES.includes(g.type);

export const tvIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="13" rx="2.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.5 21h7M12 17.5V21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
const clampInt = (v, lo, hi, fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && v !== '' && v !== null ? Math.min(hi, Math.max(lo, n)) : fallback;
};
const itemId = () => Math.random().toString(36).slice(2, 10);

// ---------- Math Wizz ----------
export const MATH_LEVELS = [
  { id: 'easy', label: 'Easy', note: 'Single digits, + and −' },
  { id: 'medium', label: 'Medium', note: 'Two-digit + and −, times tables' },
  { id: 'hard', label: 'Hard', note: 'Mixed, like 156 ÷ 12 or 48 + 37 − 19' },
];

export const MATH_MODES = [
  { id: 'paper', label: 'Paper' },
  { id: 'shout', label: 'Shout it out' },
];

export const MATH_OPS = [
  { id: 'add', sign: '+', label: 'Adding' },
  { id: 'sub', sign: '−', label: 'Subtracting' },
  { id: 'mul', sign: '×', label: 'Multiplying' },
  { id: 'div', sign: '÷', label: 'Dividing' },
];

export const MATH_LIMITS = { problems: [6, 30] };

export function normalizeMath(m) {
  const o = obj(m);
  const ops = Array.isArray(o.ops) ? MATH_OPS.map((x) => x.id).filter((id) => o.ops.includes(id)) : [];
  return {
    level: MATH_LEVELS.some((l) => l.id === o.level) ? o.level : 'easy',
    mode: MATH_MODES.some((x) => x.id === o.mode) ? o.mode : 'paper',
    ops: ops.length ? ops : MATH_OPS.map((x) => x.id),
    problems: clampInt(o.problems, ...MATH_LIMITS.problems, 20),
    negatives: !!o.negatives,
  };
}

// ---------- Pricing $ ----------
// Approximate, rounded US prices. Pictures are emoji, so there are no product photos or logos.
export const STARTER_PRODUCTS = [
  { id: 'banana', emoji: '🍌', name: 'A banana', price: 0.3 },
  { id: 'lemon', emoji: '🍋', name: 'A lemon', price: 0.75 },
  { id: 'apple', emoji: '🍎', name: 'An apple', price: 1 },
  { id: 'donut', emoji: '🍩', name: 'A donut', price: 1.75 },
  { id: 'taco', emoji: '🌮', name: 'Fast-food taco', price: 2 },
  { id: 'bread', emoji: '🍞', name: 'Loaf of bread', price: 3 },
  { id: 'gas', emoji: '⛽', name: 'Gallon of gas', price: 3.2 },
  { id: 'eggs', emoji: '🥚', name: 'Dozen eggs', price: 4 },
  { id: 'milk', emoji: '🥛', name: 'Gallon of milk', price: 4.25 },
  { id: 'ice-cream', emoji: '🍦', name: 'Ice cream cone', price: 4.5 },
  { id: 'coffee', emoji: '☕', name: 'Coffee at a café', price: 5 },
  { id: 'cereal', emoji: '🥣', name: 'Box of cereal', price: 5.5 },
  { id: 'watermelon', emoji: '🍉', name: 'Whole watermelon', price: 6 },
  { id: 'batteries', emoji: '🔋', name: 'AA batteries, 4-pack', price: 7 },
  { id: 'popcorn', emoji: '🍿', name: 'Movie theater popcorn', price: 9 },
  { id: 'movie-ticket', emoji: '🎟️', name: 'Movie ticket', price: 12 },
  { id: 'toilet-paper', emoji: '🧻', name: 'Toilet paper, 12 rolls', price: 14 },
  { id: 't-shirt', emoji: '👕', name: 'Plain T-shirt', price: 15 },
  { id: 'pizza', emoji: '🍕', name: 'Large delivery pizza', price: 20 },
  { id: 'umbrella', emoji: '☂️', name: 'Umbrella', price: 22 },
  { id: 'football', emoji: '🏈', name: 'Football', price: 25 },
  { id: 'basketball', emoji: '🏀', name: 'Basketball', price: 30 },
  { id: 'cake', emoji: '🎂', name: 'Bakery birthday cake', price: 35 },
  { id: 'roses', emoji: '🌹', name: 'A dozen roses', price: 40 },
  { id: 'backpack', emoji: '🎒', name: 'School backpack', price: 45 },
  { id: 'jeans', emoji: '👖', name: 'Pair of jeans', price: 60 },
  { id: 'video-game', emoji: '🎮', name: 'New video game', price: 70 },
  { id: 'skateboard', emoji: '🛹', name: 'Skateboard', price: 80 },
  { id: 'sneakers', emoji: '👟', name: 'Running shoes', price: 120 },
  { id: 'headphones', emoji: '🎧', name: 'Wireless headphones', price: 150 },
  { id: 'guitar', emoji: '🎸', name: 'Beginner guitar', price: 200 },
  { id: 'smartwatch', emoji: '⌚', name: 'Smartwatch', price: 250 },
  { id: 'bicycle', emoji: '🚲', name: 'Adult bicycle', price: 350 },
  { id: 'tv', emoji: '📺', name: '55-inch TV', price: 450 },
  { id: 'console', emoji: '🕹️', name: 'Video game console', price: 500 },
  { id: 'camera', emoji: '📷', name: 'Digital camera', price: 600 },
  { id: 'mattress', emoji: '🛏️', name: 'Queen mattress', price: 700 },
  { id: 'smartphone', emoji: '📱', name: 'New smartphone', price: 800 },
  { id: 'laptop', emoji: '💻', name: 'Laptop', price: 1000 },
  { id: 'sofa', emoji: '🛋️', name: 'Sofa', price: 1200 },
  { id: 'ring', emoji: '💍', name: 'Engagement ring', price: 5000 },
  { id: 'car', emoji: '🚗', name: 'New car', price: 48000 },
];

const STARTER_IDS = new Set(STARTER_PRODUCTS.map((p) => p.id));

function normalizeProduct(it) {
  if (!it || typeof it !== 'object') return null;
  const price = Number(it.price);
  return {
    id: typeof it.id === 'string' && it.id ? it.id : itemId(),
    name: String(it.name ?? '').slice(0, 40),
    price: Number.isFinite(price) && price > 0 ? Math.round(price * 100) / 100 : 0,
    emoji: String(it.emoji ?? '').trim().slice(0, 8),
    image: typeof it.image === 'string' ? it.image : '',
  };
}

export function newProduct() {
  return normalizeProduct({ id: itemId() });
}

export function normalizePricing(p) {
  const o = obj(p);
  return {
    items: Array.isArray(o.items) ? o.items.map(normalizeProduct).filter(Boolean).slice(0, 200) : [],
    off: Array.isArray(o.off) ? [...new Set(o.off.filter((id) => STARTER_IDS.has(id)))] : [],
  };
}

/** Every product a round can use: the starter products that are on, plus the host's own (with a name and a price). */
export function productPool(pricing) {
  const p = normalizePricing(pricing);
  const off = new Set(p.off);
  return [
    ...STARTER_PRODUCTS.filter((x) => !off.has(x.id)),
    ...p.items.filter((x) => x.name.trim() && x.price > 0).map((x) => ({ ...x, name: x.name.trim() })),
  ];
}

export function formatPrice(n) {
  if (n < 10 || !Number.isInteger(n)) return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${n.toLocaleString('en-US')}`;
}

// ---------- Memory Flash ----------
export const MEMORY_LIMITS = { count: [6, 24], seconds: [5, 40] };

export function normalizeMemory(m) {
  const o = obj(m);
  return {
    count: clampInt(o.count, ...MEMORY_LIMITS.count, 12),
    seconds: clampInt(o.seconds, ...MEMORY_LIMITS.seconds, 15),
  };
}

export const MEMORY_ITEMS = [
  ['🍎', 'Apple'], ['🍌', 'Banana'], ['🍇', 'Grapes'], ['🍓', 'Strawberry'], ['🍍', 'Pineapple'],
  ['🥕', 'Carrot'], ['🍕', 'Pizza'], ['🍔', 'Burger'], ['🌮', 'Taco'], ['🍩', 'Donut'],
  ['🍪', 'Cookie'], ['🎂', 'Cake'], ['🍦', 'Ice cream'], ['🍿', 'Popcorn'], ['🧀', 'Cheese'],
  ['🐶', 'Dog'], ['🐱', 'Cat'], ['🐷', 'Pig'], ['🐸', 'Frog'], ['🐵', 'Monkey'],
  ['🐧', 'Penguin'], ['🦉', 'Owl'], ['🐙', 'Octopus'], ['🐢', 'Turtle'], ['🦋', 'Butterfly'],
  ['🐘', 'Elephant'], ['🦒', 'Giraffe'], ['🦁', 'Lion'], ['🦈', 'Shark'], ['🦖', 'Dinosaur'],
  ['🦄', 'Unicorn'], ['🚗', 'Car'], ['🚲', 'Bicycle'], ['✈️', 'Airplane'], ['🚀', 'Rocket'],
  ['⛵', 'Sailboat'], ['🚂', 'Train'], ['🎸', 'Guitar'], ['🥁', 'Drum'], ['🎺', 'Trumpet'],
  ['⚽', 'Soccer ball'], ['🎈', 'Balloon'], ['🎁', 'Present'], ['☂️', 'Umbrella'], ['👓', 'Glasses'],
  ['👑', 'Crown'], ['🎩', 'Top hat'], ['👟', 'Sneaker'], ['🔑', 'Key'], ['💡', 'Light bulb'],
  ['⏰', 'Alarm clock'], ['📷', 'Camera'], ['✂️', 'Scissors'], ['🔨', 'Hammer'], ['🧲', 'Magnet'],
  ['🌈', 'Rainbow'], ['⛄', 'Snowman'], ['🌵', 'Cactus'], ['🌻', 'Sunflower'], ['🏆', 'Trophy'],
].map(([emoji, name]) => ({ emoji, name }));

// ---------- Saving ----------
/** The type and screen-game settings of a saved game. Anything missing or unknown becomes a normal game. */
export function screenFields(g) {
  const type = SCREEN_TYPES.includes(g.type) ? g.type : 'normal';
  const out = { type };
  // Settings are kept even when the type changes, so switching back doesn't lose them.
  if (g.math || type === 'math') out.math = normalizeMath(g.math);
  if (g.pricing || type === 'pricing') out.pricing = normalizePricing(g.pricing);
  if (g.memory || type === 'memory') out.memory = normalizeMemory(g.memory);
  return out;
}

// Instructions the original PowerPoint games had. Switching one of those to a screen game swaps in the new text.
const OLD_INSTRUCTIONS = [
  'Players will have to answer as many math questions as they can in 60 seconds. Player with the most correct answers wins.',
  'Players will have to order the pictures of items from least to most expensive in 60 seconds. Player with the most correct answers wins.',
  'Players will have to complete the puzzle within 60 seconds. First player to complete the puzzle wins.',
];

/** Changes a game's type. Fills in the name and instructions when they're blank or still the standard text. */
export function applyType(game, type) {
  const next = SCREEN_TYPES.includes(type) ? type : 'normal';
  const standard = new Set([...OLD_INSTRUCTIONS, ...SCREEN_TYPES.map((t) => TYPES[t].instructions)]);
  const standardNames = new Set(['New game', 'Untitled game', ...SCREEN_TYPES.map((t) => TYPES[t].name)]);
  Object.assign(game, screenFields({ ...game, type: next }));
  if (next === 'normal') return;
  if (!game.instructions.trim() || standard.has(game.instructions.trim())) game.instructions = TYPES[next].instructions;
  if (standardNames.has(game.name)) game.name = TYPES[next].name;
}
