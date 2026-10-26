// App state, saved in this browser's localStorage.
import { DEFAULT_GAMES, DEFAULT_SETTINGS } from './defaults.js';
import { screenFields, upgradeOriginalGames } from './screen-games-data.js';

const KEY = 'minute-to-win-it:v1';
const listeners = new Set();
let saveErrorHandler = () => {};

const clone = (x) => JSON.parse(JSON.stringify(x));

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

function freshState() {
  return {
    games: clone(DEFAULT_GAMES),
    playedIds: [],
    players: [],
    turns: {}, // "Who's up?": how many times each person has played tonight, by id
    lastUpIds: [], // who was up for the last game
    met: {}, // how many games each pair of people has played together ("idA|idB"), for fresh matchups
    settings: clone(DEFAULT_SETTINGS),
  };
}

function normalizeGame(g) {
  if (!g || typeof g !== 'object') return null;
  const name = String(g.name ?? '').trim();
  return {
    id: typeof g.id === 'string' && g.id ? g.id : uid(),
    name: name || 'Untitled game',
    instructions: String(g.instructions ?? ''),
    supplies: normalizeSupplies(g),
    videoUrl: String(g.videoUrl ?? ''),
    image: typeof g.image === 'string' ? g.image : '',
    enabled: g.enabled !== false,
    ...screenFields(g), // type ('normal' unless it's a screen game) and screen-game settings
  };
}

// "You'll need": short lines like "3 balloons". Games saved before supplies existed get the starting game's list.
function normalizeSupplies(g) {
  const list = Array.isArray(g.supplies) ? g.supplies : (DEFAULT_GAMES.find((d) => d.id === g.id)?.supplies ?? []);
  return list
    .filter((s) => typeof s === 'string' || typeof s === 'number')
    .map((s) => String(s).trim())
    .filter(Boolean);
}

function normalizeMember(m) {
  if (!m || typeof m !== 'object') return null;
  const name = String(m.name ?? '').trim();
  if (!name) return null;
  return { id: typeof m.id === 'string' && m.id ? m.id : uid(), name };
}

// A scoreboard entry is a player, or a team when it has members.
function normalizePlayer(p) {
  if (!p || typeof p !== 'object') return null;
  return {
    id: typeof p.id === 'string' && p.id ? p.id : uid(),
    name: String(p.name ?? '').trim() || 'Player',
    score: Number.isFinite(+p.score) ? Math.trunc(+p.score) : 0,
    members: Array.isArray(p.members) ? p.members.map(normalizeMember).filter(Boolean) : [],
  };
}

function normalizeSettings(s) {
  const out = { ...DEFAULT_SETTINGS, ...(s && typeof s === 'object' ? s : {}) };
  out.timerStart = Math.max(0, Number(out.timerStart) || 0);
  out.timerTimesUpAt = Math.max(0, Number(out.timerTimesUpAt) || DEFAULT_SETTINGS.timerTimesUpAt);
  out.useBuiltInTimer = !!out.useBuiltInTimer;
  out.sound = out.sound !== false;
  out.timerVideoUrl = String(out.timerVideoUrl ?? '');
  out.playersPerRound = Math.min(4, Math.max(1, Math.trunc(Number(out.playersPerRound)) || DEFAULT_SETTINGS.playersPerRound));
  out.playersPerTeam = Math.min(3, Math.max(1, Math.trunc(Number(out.playersPerTeam)) || DEFAULT_SETTINGS.playersPerTeam));
  out.shopPlayers = Math.min(30, Math.max(0, Math.trunc(Number(out.shopPlayers)) || 0));
  return out;
}

function normalizeTurns(s, ids) {
  const turns = {};
  if (s.turns && typeof s.turns === 'object') {
    for (const [id, n] of Object.entries(s.turns)) if (ids.has(id) && n > 0) turns[id] = Math.trunc(n);
  } else if (Array.isArray(s.turnTakenIds)) {
    // Older saves only listed who had played this round.
    s.turnTakenIds.filter((id) => ids.has(id)).forEach((id) => (turns[id] = 1));
  }
  return turns;
}

function normalizeMet(met, ids) {
  const out = {};
  if (met && typeof met === 'object') {
    for (const [pair, n] of Object.entries(met)) if (n > 0 && pair.split('|').every((id) => ids.has(id))) out[pair] = Math.trunc(n);
  }
  return out;
}

function normalize(s) {
  s = upgradeOriginalGames(s); // unedited original Math Wizz, Pricing $ and Cereal Puzzle become the screen games
  const base = freshState();
  const games = Array.isArray(s.games) ? s.games.map(normalizeGame).filter(Boolean) : base.games;
  const ids = new Set(games.map((g) => g.id));
  const players = Array.isArray(s.players) ? s.players.map(normalizePlayer).filter(Boolean) : [];
  const playerIds = new Set(players.flatMap((p) => [p.id, ...p.members.map((m) => m.id)]));
  return {
    games,
    playedIds: Array.isArray(s.playedIds) ? s.playedIds.filter((id) => ids.has(id)) : [],
    players,
    turns: normalizeTurns(s, playerIds),
    lastUpIds: Array.isArray(s.lastUpIds) ? s.lastUpIds.filter((id) => playerIds.has(id)) : [],
    met: normalizeMet(s.met, playerIds),
    settings: normalizeSettings(s.settings),
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshState();
    return normalize(JSON.parse(raw));
  } catch {
    return freshState();
  }
}

export const state = load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    saveErrorHandler(err);
    return false;
  }
}

/** Change state with a function, then save and notify everyone listening. */
export function update(mutate) {
  mutate(state);
  save();
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function onSaveError(fn) {
  saveErrorHandler = fn;
}

// ---- Helpers used around the app ----

export function wheelGames() {
  const played = new Set(state.playedIds);
  return state.games.filter((g) => g.enabled && !played.has(g.id));
}

export function newGame() {
  return normalizeGame({ id: uid(), name: 'New game', instructions: '', videoUrl: '', image: '', enabled: true });
}

/** True when any scoreboard entry has team members. Then "Who's up?" picks from each team. */
export function teamMode() {
  return state.players.some((p) => p.members.length > 0);
}

/** The people on a team. A team without members is just one person: itself. */
export function rosterOf(team) {
  return team.members.length ? team.members : [{ id: team.id, name: team.name }];
}

/** Players with the most points, or none if nobody has scored. */
export function leaders() {
  const top = Math.max(0, ...state.players.map((p) => p.score));
  return top > 0 ? state.players.filter((p) => p.score === top) : [];
}

/** Everything back to the start of a night: scores to 0, every game and player back on the wheel. */
export function newNight() {
  update((s) => {
    s.players.forEach((p) => (p.score = 0));
    s.playedIds = [];
    s.turns = {};
    s.lastUpIds = [];
    s.met = {};
  });
}

export function newPlayer(name) {
  return normalizePlayer({ id: uid(), name, score: 0, members: [] });
}

export function defaultGames() {
  return clone(DEFAULT_GAMES);
}

export function defaultSettings() {
  return clone(DEFAULT_SETTINGS);
}

export function exportData() {
  return {
    app: 'minute-to-win-it',
    version: 1,
    exportedAt: new Date().toISOString(),
    games: state.games,
    settings: state.settings,
    players: state.players,
  };
}

/** Replace games (and settings/players if present) with an exported backup. Throws if the file isn't a backup. */
export function importData(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.games)) {
    throw new Error('That file isn’t a Minute to Win It backup.');
  }
  const next = normalize({ ...data, playedIds: [] });
  if (!next.games.length) throw new Error('That backup has no games in it.');
  update((s) => {
    s.games = next.games;
    s.playedIds = [];
    if (data.settings) s.settings = next.settings;
    if (Array.isArray(data.players)) {
      s.players = next.players;
      s.turns = {};
      s.lastUpIds = [];
      s.met = {};
    }
  });
}
