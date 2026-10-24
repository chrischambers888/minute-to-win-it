// Screen games (Math Wizz, Pricing $, Memory Flash): the TV shows the content and keeps the answers.
// They use the normal flow. The host picks options on the game screen. When the clock's 60 starts, the content
// fills the screen and the official clock moves to the corner. Time's up gets a Reveal button, then the point buttons.
import { state, update } from './store.js';
import * as sound from './audio.js';
import { teamColors } from './wheel.js';
import { renderAwards, handleAwardClick } from './scoreboard.js';
import {
  isScreenGame,
  MATH_LEVELS,
  MATH_MODES,
  normalizeMath,
  normalizeMemory,
  productPool,
  formatPrice,
  MEMORY_ITEMS,
  tvIcon,
} from './screen-games-data.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const coin = () => Math.random() < 0.5;

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const sample = (list, n) => shuffle(list).slice(0, n);

// ---------- Math problems ----------
const num = (n) => (n < 0 ? `−${-n}` : String(n));
const P = (parts, answer) => ({ text: parts.map((x) => (typeof x === 'number' ? num(x) : x)).join(' '), answer });

// One maker per level and kind. Every answer is a whole number; nothing goes below zero unless negatives are on.
const MAKERS = {
  easy: {
    add: () => {
      const a = rand(1, 9);
      const b = rand(1, 9);
      return P([a, '+', b], a + b);
    },
    sub: (neg) => {
      let a;
      let b;
      do {
        a = rand(1, 9);
        b = rand(1, 9);
      } while (a === b);
      if (!neg && a < b) [a, b] = [b, a];
      return P([a, '−', b], a - b);
    },
    mul: () => {
      const a = rand(1, 5);
      const b = rand(1, 9);
      return P([a, '×', b], a * b);
    },
    div: () => {
      const b = rand(1, 5);
      const q = rand(1, 9);
      return P([b * q, '÷', b], q);
    },
  },
  medium: {
    add: () => {
      const a = rand(10, 99);
      const b = rand(10, 99);
      return P([a, '+', b], a + b);
    },
    sub: (neg) => {
      let a;
      let b;
      do {
        a = rand(10, 99);
        b = rand(10, 99);
      } while (a === b);
      if (!neg && a < b) [a, b] = [b, a];
      return P([a, '−', b], a - b);
    },
    mul: () => {
      const a = rand(2, 12);
      const b = rand(2, 12);
      return P([a, '×', b], a * b);
    },
    div: () => {
      const b = rand(2, 12);
      const q = rand(2, 12);
      return P([b * q, '÷', b], q);
    },
  },
  hard: {
    mix: (neg) => {
      for (;;) {
        const a = rand(12, 89);
        const b = rand(12, 89);
        const c = rand(12, 89);
        if (coin()) {
          if (neg || a + b - c >= 0) return P([a, '+', b, '−', c], a + b - c);
        } else if (neg || a >= b) return P([a, '−', b, '+', c], a - b + c);
      }
    },
    add: () => {
      if (coin()) {
        const [a, b, c] = [rand(12, 89), rand(12, 89), rand(12, 89)];
        return P([a, '+', b, '+', c], a + b + c);
      }
      const a = rand(101, 499);
      const b = rand(12, 99);
      return P([a, '+', b], a + b);
    },
    sub: (neg) => {
      const a = rand(101, 299);
      const b = rand(12, 99);
      return neg && coin() ? P([b, '−', a], b - a) : P([a, '−', b], a - b);
    },
    mul: () => {
      const a = rand(11, 29);
      const b = rand(3, 9);
      return coin() ? P([a, '×', b], a * b) : P([b, '×', a], a * b);
    },
    div: () => {
      const d = rand(3, 12);
      const q = rand(6, 20);
      return P([d * q, '÷', d], q);
    },
  },
};

// What each level usually asks, and how often. "mix" is the hard three-number + and − kind.
const LEVEL_KINDS = {
  easy: { add: 1, sub: 1 },
  medium: { add: 1, sub: 1, mul: 1.4 },
  hard: { mix: 2.2, add: 0.8, sub: 0.8, mul: 1.2, div: 1.6 },
};

function mathKinds(level, ops) {
  const ok = (k) => (k === 'mix' ? ops.includes('add') && ops.includes('sub') : ops.includes(k));
  let kinds = Object.entries(LEVEL_KINDS[level]).filter(([k]) => ok(k));
  // If a level's usual operations are all turned off, it uses the ones that are on, at that level's size.
  if (!kinds.length) kinds = ['add', 'sub', 'mul', 'div'].filter(ok).map((k) => [k, 1]);
  return kinds;
}

export function makeProblem({ level, ops, negatives }) {
  const kinds = mathKinds(level, ops);
  let r = Math.random() * kinds.reduce((sum, [, w]) => sum + w, 0);
  for (const [kind, w] of kinds) {
    r -= w;
    if (r <= 0) return MAKERS[level][kind](negatives);
  }
  return MAKERS[level][kinds[0][0]](negatives);
}

/** n different problems (repeats only if the settings allow fewer than n). */
export function makeProblems(m, n, avoid = []) {
  const seen = new Set(avoid);
  const out = [];
  for (let tries = 0; out.length < n && tries < n * 80; tries++) {
    const p = makeProblem(m);
    if (seen.has(p.text)) continue;
    seen.add(p.text);
    out.push(p);
  }
  while (out.length < n) out.push(makeProblem(m));
  return out;
}

// ---------- Pricing: pick 5 with a spread ----------
const tier = (price) => (price < 10 ? 0 : price < 100 ? 1 : 2);

/**
 * Picks n products: some cheap, some mid, some pricey, with a close call or two
 * (neighbors within 60% of each other) but never two prices so close it's a coin flip.
 */
export function pickProducts(pool, n = 5, recent = new Set()) {
  if (pool.length < 2) return [];
  n = Math.min(n, pool.length);
  let best = null;
  for (let attempt = 0; attempt < 700; attempt++) {
    const pick = sample(pool, n);
    const sorted = [...pick].sort((a, b) => a.price - b.price);
    let minGap = Infinity;
    let close = 0;
    for (let i = 1; i < n; i++) {
      const ratio = sorted[i].price / sorted[i - 1].price;
      minGap = Math.min(minGap, ratio);
      if (ratio < 1.6) close++;
    }
    const tooClose = minGap < 1.12 ? (minGap <= 1 ? 2 : 1) : 0;
    let score = new Set(sorted.map((x) => tier(x.price))).size * 10;
    score += close >= 1 && close <= 2 ? 8 : close === 0 ? 0 : -4 * (close - 2);
    score -= pick.filter((x) => recent.has(x.id)).length * 5;
    score -= tooClose * 100;
    score += Math.random() * 4;
    if (!best || score > best.score) best = { score, pick };
  }
  return shuffle(best.pick);
}

// ---------- Fitting content to the screen ----------
const measure = document.createElement('canvas').getContext('2d');
const COND = '800 100px "Barlow Condensed", "Arial Narrow", sans-serif';
/** Width of text in the condensed font, as a multiple of the font size. */
function em(text) {
  measure.font = COND;
  return measure.measureText(text).width / 100;
}

/** The biggest tiles (width/height = aspect) that fit n of them in W×H. */
function fitGrid(W, H, n, aspect, gap, onlyCols) {
  let best = null;
  for (let cols = onlyCols || 1; cols <= (onlyCols || n); cols++) {
    const rows = Math.ceil(n / cols);
    const w = Math.min((W - gap * (cols - 1)) / cols, ((H - gap * (rows - 1)) / rows) * aspect);
    if (!best || w > best.w + 0.5) best = { cols, rows, w: Math.max(0, w), h: Math.max(0, w / aspect) };
  }
  return best;
}

const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;
const letters = 'ABCDEFGHIJ';
const picture = (it) =>
  it.image ? `<img src="${esc(it.image)}" alt="">` : `<span class="sg-emoji">${esc(it.emoji || '🏷️')}</span>`;

/**
 * root: #screen-timer. timer: the TimerController. setupHost: #game-info on the game screen.
 * onBack / onAgain: the Time's up buttons (back to the wheel / run the clock again).
 */
export function createScreenGames({ root, timer, setupHost, onBack, onAgain, reducedMotion }) {
  const layer = document.createElement('div');
  layer.className = 'sg';
  layer.hidden = true;
  layer.innerHTML = `
    <div class="sg-slot" aria-hidden="true"></div>
    <div class="sg-scroll">
      <section class="sg-main" aria-label="Game"><div class="sg-stage"></div></section>
      <aside class="sg-side"></aside>
    </div>`;
  root.prepend(layer); // first, so the clock video sits on top of it
  const slot = layer.querySelector('.sg-slot');
  const stage = layer.querySelector('.sg-stage');
  const side = layer.querySelector('.sg-side');

  const revealBtn = document.createElement('button');
  revealBtn.type = 'button';
  revealBtn.className = 'btn btn-go btn-huge sg-reveal-btn';
  revealBtn.hidden = true;
  root.querySelector('.timesup-actions').prepend(revealBtn);

  const setup = document.createElement('div');
  setup.className = 'sg-setup';
  setup.hidden = true;
  setupHost.querySelector('.game-instructions').after(setup);

  let round = null;
  let roundId = 0;
  const recentProducts = [];
  const recentProblems = [];
  const fast = () => reducedMotion.matches;

  // ---------- Game screen: options ----------
  function choice(label, key, options, value) {
    return `<div class="sg-setup-row">
      <span class="sg-setup-label">${label}</span>
      <div class="sg-choice" role="group" aria-label="${label}">
        ${options
          .map((o) => `<button type="button" class="sg-choice-btn" data-sg-${key}="${o.id}" aria-pressed="${o.id === value}">${esc(o.label)}</button>`)
          .join('')}
      </div>
    </div>`;
  }

  function renderSetup(game) {
    if (!isScreenGame(game)) {
      setup.hidden = true;
      setup.replaceChildren();
      return;
    }
    setup.hidden = false;
    setup.dataset.gameId = game.id;
    let body = '';
    if (game.type === 'math') {
      const m = normalizeMath(game.math);
      const how =
        m.mode === 'paper'
          ? `${m.problems} problems on screen, answers on paper.`
          : 'One at a time. First to shout the right answer gets it.';
      body = `
        <div class="sg-setup-rows">${choice('Level', 'level', MATH_LEVELS, m.level)}${choice('Play', 'mode', MATH_MODES, m.mode)}</div>
        <p class="sg-setup-note">${esc(MATH_LEVELS.find((l) => l.id === m.level).note)}. ${how}</p>`;
    } else if (game.type === 'pricing') {
      const count = productPool(game.pricing).length;
      body =
        count >= 5
          ? `<p class="sg-setup-note">5 products, picked from ${count}. Everyone needs paper and a pen.</p>`
          : `<p class="sg-setup-note is-warning">Only ${count} product${count === 1 ? ' is' : 's are'} turned on. Add or turn on more in Manage games.</p>`;
    } else {
      const m = normalizeMemory(game.memory);
      body = `<p class="sg-setup-note">${m.count} things, on screen for ${m.seconds} seconds. Everyone needs paper and a pen.</p>`;
    }
    setup.innerHTML = `<p class="sg-setup-badge">${tvIcon}Plays on screen</p>${body}`;
  }

  setup.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sg-level], [data-sg-mode]');
    if (!btn) return;
    const id = setup.dataset.gameId;
    const key = btn.dataset.sgLevel ? 'level' : 'mode';
    const value = btn.dataset.sgLevel || btn.dataset.sgMode;
    update((s) => {
      const g = s.games.find((x) => x.id === id);
      if (g) g.math = { ...normalizeMath(g.math), [key]: value };
    });
    renderSetup(state.games.find((x) => x.id === id));
    // After a click, Enter goes back to starting the clock. From the keyboard, focus stays on the choice.
    const next = e.detail ? document.getElementById('btn-start-clock') : setup.querySelector(`[data-sg-${key}="${value}"]`);
    next?.focus({ preventScroll: true });
  });

  // ---------- A round ----------
  function contenders(picks) {
    const players = state.players;
    const colors = teamColors(players.map((p) => p.name));
    const all = players.map((p, i) => ({ id: p.id, name: p.name, who: [], color: colors[i], count: 0 }));
    const upIds = new Set((picks || []).map((x) => x.teamId));
    const list = upIds.size && all.some((p) => upIds.has(p.id)) ? all.filter((p) => upIds.has(p.id)) : all;
    (picks || []).forEach((x) => {
      const p = list.find((q) => q.id === x.teamId);
      if (p && x.id !== p.id) p.who.push(x.name);
    });
    return list.length ? list : [{ id: null, name: 'Got it', who: [], color: '#ffc736', count: 0 }];
  }

  function nextShout(m) {
    let p;
    for (let i = 0; i < 40; i++) {
      p = makeProblem(m);
      if (!recentProblems.includes(p.text)) break;
    }
    recentProblems.unshift(p.text);
    recentProblems.length = Math.min(recentProblems.length, 30);
    return p;
  }

  function deal(r) {
    if (r.type === 'math') {
      const m = normalizeMath(r.game.math);
      r.math = { ...m, list: [], log: [], current: null, busy: false, step: 0, people: [] };
      if (m.mode === 'paper') r.math.list = makeProblems(m, m.problems);
      else {
        r.math.people = contenders(r.picks);
        r.math.current = nextShout(r.math);
        // Size the problem for the longest one this level asks, so it doesn't jump around.
        r.math.widest = Math.max(...makeProblems(m, 40).map((p) => em(`${p.text} = ${num(p.answer)}`)));
      }
    } else if (r.type === 'pricing') {
      const items = pickProducts(productPool(r.game.pricing), 5, new Set(recentProducts));
      r.pricing = { items, flipped: 0, done: false };
      recentProducts.unshift(...items.map((x) => x.id));
      recentProducts.length = Math.min(recentProducts.length, 15);
    } else {
      const m = normalizeMemory(r.game.memory);
      r.memory = { ...m, items: sample(MEMORY_ITEMS, m.count), hidden: false };
    }
  }

  function start(game, picks = []) {
    stop();
    const fresh = game && state.games.find((g) => g.id === game.id);
    game = fresh || game;
    if (!isScreenGame(game)) return;
    round = { id: ++roundId, game, type: game.type, picks: picks || [], phase: 'ready' };
    deal(round);
    layer.hidden = false;
    layer.dataset.type = round.type;
    layer.dataset.mode = round.math?.mode || '';
    root.classList.add('sg-on');
    renderPlay();
    placeClock();
    fit();
    round.poll = setInterval(tick, 100);
  }

  function stop() {
    if (round) clearInterval(round.poll);
    round = null;
    root.classList.remove('sg-on', 'sg-live', 'sg-revealed');
    layer.hidden = true;
    stage.replaceChildren();
    side.replaceChildren();
    revealBtn.hidden = true;
  }

  /** Watches the official clock: content appears when the 60 starts; Memory Flash hides its items on time. */
  function tick() {
    if (!round) return;
    const t = timer.clockTime();
    if (t == null) return;
    if (round.phase === 'ready' && t >= 0) goLive();
    if (round.type === 'memory' && round.phase === 'live' && !round.memory.hidden) {
      const left = round.memory.seconds - t;
      if (left <= 0) hideMemory();
      else memoryCountdown(left);
    }
  }

  function goLive() {
    round.phase = 'live';
    placeClock();
    root.classList.add('sg-live');
    fit();
  }

  // ---------- Drawing ----------
  function sideHead(r) {
    let tag = '';
    if (r.type === 'math') {
      tag = `${MATH_LEVELS.find((l) => l.id === r.math.level).label} · ${MATH_MODES.find((x) => x.id === r.math.mode).label}`;
    } else if (r.type === 'pricing') tag = `${r.pricing.items.length} products`;
    else tag = `${r.memory.count} things to remember`;
    return `<div class="sg-head"><h2 class="sg-name">${esc(r.game.name)}</h2><p class="sg-tag">${esc(tag)}</p></div>`;
  }

  function renderPlay() {
    const r = round;
    if (r.type === 'math' && r.math.mode === 'paper') {
      stage.innerHTML = `<ol class="mq-grid">${r.math.list
        .map(
          (p, i) => `<li class="mq" style="--i:${i}">
            <span class="mq-n">${i + 1}</span><span class="mq-p">${esc(p.text)}</span><span class="mq-eq">=</span><span class="mq-a"><span>${num(p.answer)}</span></span>
          </li>`,
        )
        .join('')}</ol>`;
      side.innerHTML = `${sideHead(r)}<p class="sg-prompt">Write your answers on paper, numbered 1 to ${r.math.list.length}.</p>`;
    } else if (r.type === 'math') {
      stage.innerHTML = `<div class="sh">
        <p class="sh-count"></p>
        <div class="sh-card" aria-live="polite"><span class="sh-p"></span> <span class="sh-eq">=</span> <span class="sh-a"></span></div>
        <p class="sh-who"></p>
      </div>`;
      renderShoutProblem();
      side.innerHTML = `${sideHead(r)}
        <p class="sg-prompt">First to shout the right answer gets it. Press their number.</p>
        <ol class="sh-tally">${r.math.people
          .map(
            (p, i) => `<li><button type="button" class="sh-btn" data-sg-credit="${i}" style="--team: ${p.color}">
              ${i < 9 ? `<kbd>${i + 1}</kbd>` : ''}
              <span class="sh-name">${esc(p.name)}${p.who.length ? `<small>${p.who.map(esc).join(' & ')}</small>` : ''}</span>
              <span class="sh-score">0</span>
            </button></li>`,
          )
          .join('')}</ol>
        <div class="sh-tools">
          <button type="button" class="btn btn-quiet btn-small" data-sg="skip"><kbd>S</kbd> Skip</button>
          <button type="button" class="btn btn-quiet btn-small" data-sg="undo"><kbd>⌫</kbd> Undo</button>
        </div>`;
    } else if (r.type === 'pricing') {
      const items = r.pricing.items;
      stage.innerHTML = items.length
        ? `<ol class="pc-row">${items
            .map(
              (it, i) => `<li class="pc" style="--i:${i}">
                <div class="pc-inner">
                  <div class="pc-face pc-front">
                    <span class="pc-letter">${letters[i]}</span>
                    <span class="pc-pic">${picture(it)}</span>
                    <span class="pc-name">${esc(it.name)}</span>
                    <span class="pc-tag">$ ? ? ?</span>
                  </div>
                  <div class="pc-face pc-back">
                    <span class="pc-letter">${letters[i]}</span>
                    <span class="pc-rank"></span>
                    <span class="pc-pic">${picture(it)}</span>
                    <span class="pc-name">${esc(it.name)}</span>
                    <span class="pc-price" data-len="${formatPrice(it.price).length}">${formatPrice(it.price)}</span>
                    <span class="pc-note"></span>
                  </div>
                </div>
              </li>`,
            )
            .join('')}</ol>`
        : '<p class="sg-empty">Pricing $ needs at least 2 products. Add some in Manage games.</p>';
      side.innerHTML = `${sideHead(r)}
        <p class="sg-prompt">Write the letters in order, cheapest to most expensive.</p>
        ${orderStrip(items.length)}`;
    } else {
      stage.innerHTML = `<ol class="mt-grid">${r.memory.items
        .map(
          (it, i) => `<li class="mt" style="--i:${i}">
            <div class="mt-inner">
              <div class="mt-face mt-front"><span class="mt-pic sg-emoji">${it.emoji}</span><span class="mt-name">${esc(it.name)}</span></div>
              <div class="mt-face mt-back"><span>?</span></div>
            </div>
          </li>`,
        )
        .join('')}</ol>`;
      side.innerHTML = `${sideHead(r)}
        <div class="mm-status">
          <p class="sg-prompt mm-prompt">Memorize them!</p>
          <div class="mm-bar"><span></span></div>
          <p class="mm-secs"><b>${r.memory.seconds}</b> seconds left</p>
        </div>`;
    }
  }

  function orderStrip(n) {
    return `<div class="pc-order">
      <span class="pc-order-end">Cheapest</span>
      <ol class="pc-slots">${'<li></li>'.repeat(n)}</ol>
      <span class="pc-order-end">Most expensive</span>
    </div>`;
  }

  function fit() {
    if (!round) return;
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    if (!W || !H) return;
    const gap = Math.round(Math.max(8, Math.min(W, H) * 0.022));
    const set = (k, v) => stage.style.setProperty(k, v);
    set('--gap', `${gap}px`);
    const r = round;
    if (r.type === 'math' && r.math.mode === 'paper') {
      const list = r.math.list;
      const pw = Math.max(...list.map((p) => em(p.text)));
      const aw = Math.max(em('000'), ...list.map((p) => em(num(p.answer))));
      // One problem, in units of its font size: badge, problem, "=", answer line, 3 gaps, padding and a little spare.
      const unitW = 1.25 + pw + em('=') + aw + 3 * 0.4 + 0.9 + 0.2;
      const unitH = 1.85;
      const g = fitGrid(W, H, list.length, unitW / unitH, gap);
      set('--cols', g.cols);
      set('--cell-w', `${g.w}px`);
      set('--cell-h', `${g.h}px`);
      set('--f', `${g.h / unitH}px`);
      set('--aw', aw);
    } else if (r.type === 'math') {
      set('--f', `${Math.min((W * 0.94) / (r.math.widest + 1.3), H * 0.32)}px`);
    } else if (r.type === 'pricing') {
      const n = r.pricing.items.length;
      if (!n) return;
      const best = fitGrid(W, H, n, 0.7, gap);
      const row = fitGrid(W, H, n, 0.7, gap, n);
      const g = row.w >= best.w * 0.72 ? row : best; // one row reads best, unless it makes the cards tiny
      set('--cols', g.cols);
      set('--card-w', `${g.w}px`);
    } else {
      const g = fitGrid(W, H, r.memory.items.length, 0.92, gap);
      set('--cols', g.cols);
      set('--card-w', `${g.w}px`);
    }
  }

  /** Where the clock goes: the corner slot. The video (or built-in clock) is scaled into it. */
  function placeClock() {
    if (!round) return;
    const r = root.getBoundingClientRect();
    const s = slot.getBoundingClientRect();
    const boxW = Math.min(r.width, (r.height * 16) / 9);
    const set = (k, v) => root.style.setProperty(k, v);
    set('--sg-box-w', `${boxW}px`);
    set('--sg-box-h', `${(boxW * 9) / 16}px`);
    if (!s.width) return;
    set('--sg-s', String(s.width / boxW));
    set('--sg-dx', `${s.left + s.width / 2 - (r.left + r.width / 2)}px`);
    set('--sg-dy', `${s.top + s.height / 2 - (r.top + r.height / 2)}px`);
    set('--sg-ctl-x', `${s.left - r.left + s.width / 2}px`);
    set('--sg-ctl-y', `${s.bottom - r.top}px`);
  }

  new ResizeObserver(() => {
    placeClock();
    fit();
  }).observe(layer);
  new ResizeObserver(() => fit()).observe(stage);

  // ---------- Shout it out ----------
  function renderShoutProblem() {
    const m = round.math;
    const card = stage.querySelector('.sh-card');
    if (!card) return;
    card.classList.remove('is-answered', 'is-skipped');
    void card.offsetWidth;
    card.classList.add('is-new');
    stage.querySelector('.sh-p').textContent = m.current.text;
    stage.querySelector('.sh-a').textContent = '?';
    stage.querySelector('.sh-who').replaceChildren();
    stage.querySelector('.sh-count').textContent = `Problem ${m.log.length + 1}`;
  }

  function updateTally() {
    const m = round.math;
    side.querySelectorAll('[data-sg-credit]').forEach((btn) => {
      const p = m.people[Number(btn.dataset.sgCredit)];
      const score = btn.querySelector('.sh-score');
      if (score.textContent !== String(p.count)) {
        score.textContent = p.count;
        btn.classList.remove('is-bumped');
        void btn.offsetWidth;
        btn.classList.add('is-bumped');
      }
    });
  }

  const shoutLive = () => round?.type === 'math' && round.math.mode === 'shout' && round.phase === 'live';

  /** i: who got it (index into the players), or -1 to skip. */
  function credit(i) {
    if (!shoutLive()) return;
    const m = round.math;
    const person = m.people[i];
    if (m.busy || (i >= 0 && !person)) return;
    m.busy = true;
    m.log.push({ ...m.current, by: person ? i : -1 });
    const card = stage.querySelector('.sh-card');
    card.classList.remove('is-new');
    card.classList.add(person ? 'is-answered' : 'is-skipped');
    stage.querySelector('.sh-a').textContent = num(m.current.answer);
    const who = stage.querySelector('.sh-who');
    who.innerHTML = person
      ? `<span class="sh-chip" style="--team: ${person.color}">${esc(person.name)} ✓</span>`
      : '<span class="sh-chip is-skip">Skipped</span>';
    if (person) {
      person.count++;
      sound.ding();
    } else sound.miss();
    updateTally();
    const step = ++m.step;
    const id = round.id;
    setTimeout(
      () => {
        if (!round || round.id !== id || round.phase !== 'live' || m.step !== step) return;
        m.current = nextShout(m);
        m.busy = false;
        renderShoutProblem();
      },
      fast() ? 300 : 900,
    );
  }

  function undo() {
    if (!shoutLive()) return;
    const m = round.math;
    const last = m.log.pop();
    if (!last) return;
    if (last.by >= 0) m.people[last.by].count--;
    m.step++;
    m.current = { text: last.text, answer: last.answer };
    m.busy = false;
    renderShoutProblem();
    updateTally();
  }

  function handleKey(e) {
    if (!shoutLive()) return false;
    const k = e.key;
    if (/^[1-9]$/.test(k)) {
      credit(Number(k) - 1);
      return true;
    }
    if (k === '0' || k === 's' || k === 'S') {
      credit(-1);
      return true;
    }
    if (k === 'Backspace' || k === 'u' || k === 'U') {
      undo();
      return true;
    }
    return false;
  }

  // ---------- Memory Flash ----------
  function memoryCountdown(left) {
    const secs = side.querySelector('.mm-secs b');
    const bar = side.querySelector('.mm-bar span');
    if (secs) secs.textContent = Math.ceil(left);
    if (bar) bar.style.transform = `scaleX(${Math.max(0, left / round.memory.seconds)})`;
  }

  function hideMemory(quiet) {
    round.memory.hidden = true;
    stage.querySelector('.mt-grid')?.classList.add('is-hidden');
    if (!quiet) sound.whoosh();
    const status = side.querySelector('.mm-status');
    if (status) {
      status.innerHTML = `<p class="sg-prompt mm-prompt">Write down everything you remember!</p>
        <p class="mm-secs">${round.memory.count} things</p>`;
    }
  }

  // ---------- Time's up and Reveal ----------
  function revealLabel(r) {
    if (r.type === 'math') return r.math.mode === 'shout' ? 'See the results' : 'Reveal the answers';
    if (r.type === 'pricing') return 'Reveal the prices';
    return 'Reveal the items';
  }

  /** Called when the clock runs out. Returns the button that should get focus (or null for a normal game). */
  function timesUp(picks) {
    if (!round) return null;
    if (picks) round.picks = picks;
    if (round.phase === 'ready') goLive();
    if (round.type === 'memory' && !round.memory.hidden) hideMemory(true);
    round.phase = 'over';
    revealBtn.textContent = revealLabel(round);
    revealBtn.hidden = false;
    return revealBtn;
  }

  revealBtn.addEventListener('click', () => reveal());

  function reveal() {
    const r = round;
    if (!r || r.phase !== 'over') return;
    r.phase = 'revealed';
    root.classList.add('sg-revealed');
    revealBtn.hidden = true;
    renderDone(r);
    side.querySelector('[data-sg="back"]')?.focus({ preventScroll: true });
    if (r.type === 'math' && r.math.mode === 'paper') {
      stage.querySelector('.mq-grid').classList.add('is-revealed');
      sound.ding();
    } else if (r.type === 'math') showResults(r);
    else if (r.type === 'pricing') revealPrices(r);
    else {
      stage.querySelector('.mt-grid').classList.remove('is-hidden');
      stage.querySelector('.mt-grid').classList.add('is-revealed');
      sound.whoosh();
      setTimeout(() => round === r && sound.ding(), fast() ? 0 : 450);
    }
  }

  function renderDone(r) {
    let summary = '';
    if (r.type === 'math' && r.math.mode === 'paper') summary = '<p class="sg-prompt">Check your answers. Most correct wins.</p>';
    else if (r.type === 'math') summary = `<p class="sg-result">${shoutWinner(r.math.people)}</p>`;
    else if (r.type === 'pricing') {
      summary = `${orderStrip(r.pricing.items.length)}
        ${r.pricing.items.length ? '<button type="button" class="link-btn sg-skip" data-sg="show-all">Show them all now</button>' : ''}`;
    } else summary = '<p class="sg-prompt">Count how many you got. Most remembered wins.</p>';
    side.innerHTML = `${sideHead(r)}${summary}
      <div class="award sg-award"></div>
      <div class="sg-done-actions">
        <button type="button" class="btn btn-go" data-sg="back">Back to wheel</button>
        <button type="button" class="btn btn-quiet" data-sg="again">Run the clock again</button>
      </div>`;
    renderAwards(side.querySelector('.sg-award'), r.picks);
  }

  function shoutWinner(people) {
    const top = Math.max(0, ...people.map((p) => p.count));
    if (people.length === 1) return `<b>${top}</b> answered`;
    if (!top) return 'Nobody got one this time';
    const leaders = people.filter((p) => p.count === top).map((p) => `<b>${esc(p.name)}</b>`);
    return leaders.length > 1 ? `Tie: ${leaders.join(' & ')} with ${top}` : `${leaders[0]} wins with ${top}`;
  }

  function showResults(r) {
    const m = r.math;
    const top = Math.max(1, ...m.people.map((p) => p.count));
    const ranked = [...m.people].sort((a, b) => b.count - a.count);
    stage.innerHTML = `<div class="sh-results">
      <p class="sh-winner">${shoutWinner(m.people)}</p>
      <ol class="sh-bars">${ranked
        .map(
          (p) => `<li style="--team: ${p.color}; --share: ${p.count / top}">
            <span class="sh-bar-name">${esc(p.name)}</span>
            <span class="sh-bar"><span></span></span>
            <span class="sh-bar-count">${p.count}</span>
          </li>`,
        )
        .join('')}</ol>
      ${
        m.log.length
          ? `<ol class="sh-log">${m.log
              .map((x) => {
                const p = m.people[x.by];
                return `<li><span>${esc(x.text)} = <b>${num(x.answer)}</b></span>${
                  p ? `<span class="sh-chip" style="--team: ${p.color}">${esc(p.name)}</span>` : '<span class="sh-chip is-skip">Skipped</span>'
                }</li>`;
              })
              .join('')}</ol>`
          : '<p class="sg-empty">No problems were answered.</p>'
      }
    </div>`;
    sound.ding();
  }

  async function revealPrices(r) {
    const items = r.pricing.items;
    if (!items.length) return;
    const order = items.map((_, i) => i).sort((a, b) => items[a].price - items[b].price);
    r.pricing.order = order;
    for (let k = 0; k < order.length; k++) {
      if (round !== r || r.pricing.done) return;
      const last = k === order.length - 1;
      const roll = fast() ? 0.3 : last ? 1.9 : 1.15;
      sound.drumroll(roll);
      await wait(roll * 1000);
      if (round !== r || r.pricing.done) return;
      flipCard(r, k);
      sound.crash();
      await wait(fast() ? 100 : 700);
    }
    finishPrices(r);
  }

  function flipCard(r, k) {
    const i = r.pricing.order[k];
    const card = stage.querySelectorAll('.pc')[i];
    if (!card || card.classList.contains('is-flipped')) return;
    card.querySelector('.pc-rank').textContent = ordinal(k + 1);
    card.querySelector('.pc-note').textContent = k === 0 ? 'Cheapest' : k === r.pricing.order.length - 1 ? 'Most expensive' : '';
    card.classList.add('is-flipped');
    const slotEl = side.querySelectorAll('.pc-slots li')[k];
    if (slotEl) {
      slotEl.textContent = letters[i];
      slotEl.classList.add('is-filled');
    }
    r.pricing.flipped = k + 1;
  }

  function finishPrices(r) {
    if (round !== r || r.pricing.done) return;
    for (let k = r.pricing.flipped; k < r.pricing.order.length; k++) flipCard(r, k);
    r.pricing.done = true;
    side.querySelector('.sg-skip')?.remove();
  }

  side.addEventListener('click', (e) => {
    const creditBtn = e.target.closest('[data-sg-credit]');
    if (creditBtn) return credit(Number(creditBtn.dataset.sgCredit));
    if (e.target.closest('.award-btn')) return handleAwardClick(e);
    const act = e.target.closest('[data-sg]')?.dataset.sg;
    if (act === 'skip') credit(-1);
    else if (act === 'undo') undo();
    else if (act === 'back') onBack();
    else if (act === 'again') onAgain();
    else if (act === 'show-all' && round?.pricing) {
      if (!round.pricing.order) return;
      finishPrices(round);
      sound.crash();
    }
  });

  return { renderSetup, start, stop, timesUp, handleKey };
}
