// App state, saved in this browser's localStorage.
import { DEFAULT_GAMES, DEFAULT_SETTINGS } from './defaults.js';

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
    videoUrl: String(g.videoUrl ?? ''),
    image: typeof g.image === 'string' ? g.image : '',
    enabled: g.enabled !== false,
  };
}

function normalizePlayer(p) {
  if (!p || typeof p !== 'object') return null;
  return {
    id: typeof p.id === 'string' && p.id ? p.id : uid(),
    name: String(p.name ?? '').trim() || 'Player',
    score: Number.isFinite(+p.score) ? Math.trunc(+p.score) : 0,
  };
}

function normalizeSettings(s) {
  const out = { ...DEFAULT_SETTINGS, ...(s && typeof s === 'object' ? s : {}) };
  out.timerStart = Math.max(0, Number(out.timerStart) || 0);
  out.timerTimesUpAt = Math.max(0, Number(out.timerTimesUpAt) || DEFAULT_SETTINGS.timerTimesUpAt);
  out.useBuiltInTimer = !!out.useBuiltInTimer;
  out.sound = out.sound !== false;
  out.timerVideoUrl = String(out.timerVideoUrl ?? '');
  return out;
}

function normalize(s) {
  const base = freshState();
  const games = Array.isArray(s.games) ? s.games.map(normalizeGame).filter(Boolean) : base.games;
  const ids = new Set(games.map((g) => g.id));
  return {
    games,
    playedIds: Array.isArray(s.playedIds) ? s.playedIds.filter((id) => ids.has(id)) : [],
    players: Array.isArray(s.players) ? s.players.map(normalizePlayer).filter(Boolean) : [],
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

export function newPlayer(name) {
  return normalizePlayer({ id: uid(), name, score: 0 });
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
    if (Array.isArray(data.players)) s.players = next.players;
  });
}
