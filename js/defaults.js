// The games and settings the site starts with.
// These came from the original "Minute To Win It Wheel" PowerPoint.
// Once you edit games in the site, your version is saved in the browser instead.
// Games are normal games unless they have a `type`: 'math', 'pricing' and 'memory' are the built-in screen games.
// Their names, instructions and lists live in js/screen-games-data.js.
import { TYPES } from './screen-games-data.js';

export const DEFAULT_SETTINGS = {
  // The official countdown video. It runs: logo (0–3s), 3-2-1 (3–6s), 60 → 00 (6–66s), then holds on 00.
  timerVideoUrl: 'https://www.youtube.com/watch?v=ebvtJCu33vM',
  timerStart: 0, // seconds into the video to start from
  timerTimesUpAt: 66, // seconds into the video when "Time's up" should appear
  useBuiltInTimer: false,
  sound: true,
  playersPerRound: 2, // how many players "Who's up?" picks for each game
  playersPerTeam: 1, // with teams: how many people "Who's up?" picks from each team
  shopPlayers: 0, // shopping list: how many people play each game (0 = the "Who's up?" number)
};

export const DEFAULT_GAMES = [
  {
    id: 'defying-gravity',
    name: 'Defying Gravity',
    instructions:
      'Players will have to keep 3 balloons up in the air for 60 seconds. If a balloon touches the ground, no point.',
    supplies: ['3 balloons'],
    videoUrl: 'https://www.youtube.com/watch?v=hIP6wxJyKIc',
    image: '',
    enabled: true,
  },
  {
    id: 'ready-spaghetti',
    name: 'Ready Spaghetti',
    instructions:
      'Players will have a piece of spaghetti in their mouth and will have to get 6 pieces of penne onto the spaghetti in 60 seconds. Failure to do so will result in no point.',
    supplies: ['1 piece of uncooked spaghetti', '6 pieces of uncooked penne'],
    videoUrl: '',
    image: '',
    enabled: true,
  },
  {
    id: 'suck-it-up',
    name: 'Suck It Up',
    instructions:
      'Players will have to move 5 goldfish from one plate to another by sucking them up with a straw in 60 seconds. Failure to do so will result in no point.',
    supplies: ['5 Goldfish crackers', '2 plates', '1 straw'],
    videoUrl: '',
    image: '',
    enabled: true,
  },
  {
    id: 'math-wizz',
    type: 'math',
    name: TYPES.math.name,
    instructions: TYPES.math.instructions,
    supplies: ['Paper and a pen'],
    videoUrl: '',
    image: '',
    enabled: true,
    math: { level: 'easy', mode: 'paper', ops: ['add', 'sub', 'mul', 'div'], problems: 20, negatives: false },
  },
  {
    id: 'nerf-llama',
    name: 'Nerf Llama',
    instructions:
      'Players will try to knock down as many cans / cups as they can with Nerf bullets. Player with the greatest number of cups knocked down wins.',
    supplies: ['1 Nerf blaster', '10 Nerf darts', '10 empty cans or plastic cups'],
    videoUrl: '',
    image: 'assets/images/nerf-llama.jpg',
    enabled: true,
  },
  {
    id: 'pong5',
    name: 'Pong5',
    instructions:
      'Players will have to bounce 5 pong balls into one Solo cup in 60 seconds. Failure to do so will result in no point.',
    supplies: ['5 ping pong balls', '1 Solo cup'],
    videoUrl: 'https://www.youtube.com/watch?v=YsrTROq6Xz8',
    image: '',
    enabled: true,
  },
  {
    id: 'pricing',
    type: 'pricing',
    name: TYPES.pricing.name,
    instructions: TYPES.pricing.instructions,
    supplies: ['Paper and a pen'],
    videoUrl: '',
    image: '',
    enabled: true,
    pricing: { items: [], off: [] }, // your own products, and starter products that are turned off
  },
  {
    id: 'stack-attack',
    name: 'Stack Attack',
    instructions:
      'Players will need to stack 36 cups (8 cup base) in a pyramid and then take them down into one stack in 60 seconds. Failure to do so will result in no point.',
    supplies: ['36 plastic cups'],
    videoUrl: 'https://www.youtube.com/watch?v=oLtSQ3jAc04',
    image: '',
    enabled: true,
  },
  {
    id: 'penny-for-your-thoughts',
    name: 'Penny For Your Thoughts',
    instructions:
      'Players will have to use one hand to stack as many pennies as they can in 60 seconds. Player with the greatest number of pennies stacked wins.',
    supplies: ['50 pennies'],
    videoUrl: 'https://www.youtube.com/watch?v=3_Ao13XrTpc',
    image: '',
    enabled: true,
  },
  {
    id: 'memory-flash',
    type: 'memory',
    name: TYPES.memory.name,
    instructions: TYPES.memory.instructions,
    supplies: ['Paper and a pen'],
    videoUrl: '',
    image: '',
    enabled: true,
    memory: { count: 12, seconds: 15 },
  },
  {
    id: 'worm-dive',
    name: 'Worm Dive',
    instructions:
      'Players will have to dive their face into a bowl of whipped cream to search for 5 gummy worms and eat them or put them onto a plate in 60 seconds. Failure to do so will result in no point.',
    supplies: ['1 bowl', '1 can of whipped cream', '5 gummy worms', '1 plate', 'Paper towels'],
    videoUrl: '',
    image: '',
    enabled: true,
  },
  {
    id: 'face-the-cookie',
    name: 'Face The Cookie',
    instructions:
      'Players will have to get two cookies from their foreheads to their mouths without using their hands within 60 seconds. Failure to do so will result in no point.',
    supplies: ['2 cookies'],
    videoUrl: 'https://www.youtube.com/watch?v=oLvLVL_rfD4',
    image: '',
    enabled: true,
  },
];
