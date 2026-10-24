// Minute to Win It: wheel → game → clock, and the winner at the end of the night.
import { state, update, subscribe, wheelGames, onSaveError, leaders, newNight, teamMode } from './store.js';
import { Wheel, randomIndex } from './wheel.js';
import * as sound from './audio.js';
import { burst } from './confetti.js';
import { TimerController } from './timer.js';
import { loadYouTubeApi, parseYouTube, createPlayer } from './youtube.js';
import { mountScoreboard, renderAwards, handleAwardClick } from './scoreboard.js';
import { setupEditor } from './editor.js';
import { createPicker, canPick, maxPicks, picksWanted } from './picker.js';
import { renderWinner } from './winner.js';
import { pairsOf, lineupKey } from './matchups.js';

const $ = (sel) => document.querySelector(sel);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

let screen = 'wheel';
let currentGame = null;
let currentColor = null;
let spinning = false;
let gamePlayer = null;
let videoToken = 0;
// Who's up for the current game (from the "Who's up?" wheel).
// `undo` holds the play and matchup counts from before these picks, so they can be given back.
const nobodyUp = () => ({ picks: [], undo: null });
let up = nobodyUp();

// ---------- Messages ----------
let toastTimer = 0;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('is-shown');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-shown'), 3600);
}
onSaveError(() => toast('Couldn’t save: this browser’s storage is full. Try removing a picture.'));

// ---------- Screens ----------
function showScreen(name) {
  screen = name;
  document.body.dataset.screen = name;
  document.querySelectorAll('.screen').forEach((el) => {
    const on = el.id === `screen-${name}`;
    el.classList.toggle('is-active', on);
    el.inert = !on;
  });
  if (name === 'wheel') refreshWheel();
}

// ---------- Wheel ----------
const wheel = new Wheel($('#wheel-canvas'), {
  pointer: $('#pointer'),
  onTick: () => sound.tick(),
});

function refreshWheel() {
  const list = wheelGames();
  if (screen === 'wheel' && !wheel.spinning && !spinning) {
    wheel.setItems(list.map((g) => ({ id: g.id, label: g.name })));
  }
  const total = state.games.filter((g) => g.enabled).length;
  const area = $('#wheel-area');
  area.classList.toggle('is-empty', list.length === 0);
  $('#wheel-empty-title').textContent = total === 0 ? 'No games on the wheel yet' : 'Every game has been played';
  // When the last game is done and someone has points, crowning the winner is the big button.
  const crown = total > 0 && leaders().length > 0;
  $('#wheel-empty-crown').hidden = !crown;
  $('#wheel-empty-reset').hidden = total === 0;
  $('#wheel-empty-reset').classList.toggle('btn-go', !crown);
  $('#wheel-empty-reset').classList.toggle('btn-huge', !crown);
  $('#wheel-empty-reset').classList.toggle('btn-quiet', crown);
  $('#wheel-empty-manage').hidden = total !== 0;
  renderGamesLeft(list.length, total);
}

function renderGamesLeft(left, total) {
  const played = state.playedIds.map((id) => state.games.find((g) => g.id === id)).filter((g) => g && g.enabled);
  $('#games-left').innerHTML = `
    <div class="panel-head">
      <h2 class="panel-title">On the wheel</h2>
      ${played.length ? '<button class="link-btn" data-act="reset-wheel">Reset the wheel</button>' : ''}
    </div>
    <p class="games-left-count"><strong>${left}</strong> of ${total} games left</p>
    ${
      played.length
        ? `<ul class="played-list" aria-label="Played games">
            ${played
              .map(
                (g) => `<li><span class="played-name">${esc(g.name)}</span>
                  <button class="link-btn subtle" data-act="unplay" data-id="${g.id}" aria-label="Put ${esc(g.name)} back on the wheel">Put back</button></li>`,
              )
              .join('')}
          </ul>`
        : '<p class="panel-empty">Games come off the wheel after they’re picked.</p>'
    }`;
}

function resetWheel() {
  update((s) => (s.playedIds = []));
  toast('All games are back on the wheel.');
}

$('#games-left').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  if (btn.dataset.act === 'reset-wheel') resetWheel();
  if (btn.dataset.act === 'unplay') update((s) => (s.playedIds = s.playedIds.filter((id) => id !== btn.dataset.id)));
});
$('#wheel-empty-reset').addEventListener('click', resetWheel);
$('#wheel-empty-crown').addEventListener('click', () => showWinner());
$('#wheel-empty-manage').addEventListener('click', () => editor.open());

async function spin() {
  if (spinning || screen !== 'wheel') return;
  const list = wheelGames();
  if (!list.length) return;
  sound.unlock();
  spinning = true;
  document.body.classList.add('is-spinning');

  const index = randomIndex(list.length);
  const duration = reducedMotion.matches ? 1800 : 6000 + Math.random() * 1500;
  await wheel.spin(index, { duration });

  const game = list[index];
  const color = wheel.colorAt(index);
  sound.fanfare();
  burst();
  wheel.celebrate(index);
  const banner = $('#landed');
  banner.textContent = game.name;
  banner.style.setProperty('--slice', color);
  banner.classList.add('is-shown');
  await wait(reducedMotion.matches ? 700 : 1700);

  spinning = false;
  document.body.classList.remove('is-spinning');
  update((s) => {
    if (!s.playedIds.includes(game.id)) s.playedIds.push(game.id);
  });
  showGame(game, color);
  setTimeout(() => banner.classList.remove('is-shown'), 400);
}

$('#btn-spin').addEventListener('click', spin);
$('#wheel-canvas').addEventListener('click', spin);

// ---------- Game screen ----------
function fillGameDetails(game) {
  $('#game-title').textContent = game.name;
  const instructions = $('#game-instructions');
  instructions.textContent = game.instructions || 'No instructions yet. Add them in Manage games.';
  instructions.classList.toggle('is-missing', !game.instructions);
  const yt = parseYouTube(game.videoUrl);
  const pic = $('#game-picture');
  pic.hidden = !game.image;
  if (game.image) {
    pic.querySelector('img').src = game.image;
    pic.querySelector('img').alt = `Picture for ${game.name}`;
  }
  // With a video, the picture sits under the instructions. Without one, it takes the big spot.
  if (yt) $('#game-who').before(pic);
  else $('#game-media').append(pic);
  $('#game-clock').hidden = !!yt || !!game.image;
  $('#game-layout').classList.toggle('has-video', !!yt);
  $('#game-video').hidden = !yt;
}

// Ticks around the "60" clock on the game screen.
$('#game-clock-ticks').innerHTML = Array.from(
  { length: 60 },
  (_, i) => `<rect class="ring-tick" x="-1.6" y="-47" width="3.2" height="9" rx="1.2" transform="rotate(${i * 6})"/>`,
).join('');

function showGame(game, color) {
  currentGame = game;
  currentColor = color;
  document.body.style.setProperty('--glow', color);
  fillGameDetails(game);
  setupGameVideo(parseYouTube(game.videoUrl));
  up = nobodyUp();
  renderWho();
  $('#timesup').hidden = true;
  showScreen('game');
  requestAnimationFrame(() => $('#btn-start-clock').focus({ preventScroll: true }));
}

async function setupGameVideo(yt) {
  destroyGameVideo();
  const note = $('#video-note');
  note.hidden = true;
  if (!yt) return;
  const frame = $('#game-video-frame');
  const mount = document.createElement('div');
  frame.replaceChildren(mount);
  const token = videoToken;
  try {
    await loadYouTubeApi();
  } catch {
    if (token !== videoToken) return;
    frame.replaceChildren();
    showVideoNote('This video needs an internet connection.', yt.id);
    return;
  }
  if (token !== videoToken) return;
  gamePlayer = createPlayer(mount, {
    videoId: yt.id,
    start: yt.start,
    controls: true,
    events: {
      onError: () => showVideoNote('This video can’t play inside the site.', yt.id),
    },
  });
}

function showVideoNote(text, id) {
  const note = $('#video-note');
  note.hidden = false;
  note.innerHTML = `${esc(text)} <a href="https://www.youtube.com/watch?v=${esc(id)}" target="_blank" rel="noopener">Watch it on YouTube</a>`;
}

function destroyGameVideo() {
  videoToken++;
  try {
    gamePlayer?.destroy();
  } catch {
    /* already gone */
  }
  gamePlayer = null;
  $('#game-video-frame').replaceChildren();
}

function backToWheel() {
  timer.stop();
  destroyGameVideo();
  wheel.clearCelebration();
  document.body.style.removeProperty('--glow');
  showScreen('wheel');
  requestAnimationFrame(() => $('#btn-spin').focus({ preventScroll: true }));
}

function putBackAndSpin() {
  giveTurnsBack(); // the game didn't happen, so nobody used up a turn
  const id = currentGame?.id;
  if (id) update((s) => (s.playedIds = s.playedIds.filter((x) => x !== id)));
  backToWheel();
  setTimeout(spin, reducedMotion.matches ? 100 : 500);
}

$('#btn-start-clock').addEventListener('click', startClock);
$('#btn-back-wheel').addEventListener('click', backToWheel);
$('#btn-respin').addEventListener('click', putBackAndSpin);

// ---------- Who's up? ----------
const personIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 21a8 8 0 0 1 16 0z" fill="currentColor"/></svg>`;

function renderWho() {
  const el = $('#game-who');
  const enough = canPick();
  el.hidden = !enough;
  $('#keys-who').hidden = !enough;
  if (!enough) return;

  if (up.picks.length) {
    el.innerHTML = `
      <span class="who-label">Up now</span>
      <ul class="who-chips">${up.picks
        .map(
          (x) =>
            `<li style="--slice: ${x.color}">${esc(x.name)}${x.teamName && x.id !== x.teamId ? ` <small>${esc(x.teamName)}</small>` : ''}</li>`,
        )
        .join('')}</ul>
      <button class="link-btn" type="button" data-act="pick">Pick again</button>`;
    return;
  }
  const max = maxPicks();
  const want = picksWanted();
  const teams = teamMode();
  el.innerHTML = `
    <button class="btn btn-quiet who-btn" type="button" data-act="pick">${personIcon}Who’s up?</button>
    ${
      max >= 2
        ? `<div class="seg" role="group" aria-label="${teams ? 'How many players to pick from each team' : 'How many players to pick'}">
            <span class="seg-label">${teams ? 'Per team' : 'Pick'}</span>
            ${Array.from({ length: max }, (_, i) => i + 1)
              .map((n) => `<button class="seg-btn" type="button" data-act="count" data-n="${n}" aria-pressed="${n === want}">${n}</button>`)
              .join('')}
          </div>`
        : ''
    }`;
}

$('#game-who').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  if (btn.dataset.act === 'pick') pickWhoIsUp();
  if (btn.dataset.act === 'count') {
    const n = Number(btn.dataset.n);
    const key = teamMode() ? 'playersPerTeam' : 'playersPerRound';
    update((s) => (s.settings[key] = n));
    renderWho();
    $(`#game-who [data-n="${n}"]`)?.focus({ preventScroll: true });
  }
});

const picker = createPicker($('#picker'), {
  reducedMotion,
  onDone: (picks) => {
    up = { picks, undo: countTurns(picks) };
    renderWho();
    requestAnimationFrame(() => $('#btn-start-clock').focus({ preventScroll: true }));
  },
  onClose: () => {
    renderWho();
    requestAnimationFrame(() => $('#game-who [data-act=pick]')?.focus({ preventScroll: true }));
  },
});

/** Being picked uses up a turn and counts as a matchup. Returns what's needed to give it back. */
function countTurns(picks) {
  const ids = picks.map((p) => p.id);
  const pairs = pairsOf(ids);
  const undo = {
    turns: Object.fromEntries(ids.map((id) => [id, state.turns[id] || 0])),
    met: Object.fromEntries(pairs.map((k) => [k, state.met[k] || 0])),
    lastUpIds: [...state.lastUpIds],
  };
  update((s) => {
    ids.forEach((id) => (s.turns[id] = (s.turns[id] || 0) + 1));
    pairs.forEach((k) => (s.met[k] = (s.met[k] || 0) + 1));
    s.lastUpIds = ids;
  });
  return undo;
}

function giveTurnsBack() {
  const { undo } = up;
  if (!undo) return;
  update((s) => {
    Object.assign(s.turns, undo.turns);
    Object.assign(s.met, undo.met);
    s.lastUpIds = undo.lastUpIds;
  });
  up = nobodyUp();
}

/** "Who's up?" or "Pick again". Picking again gives the turns back and picks a different lineup. */
function pickWhoIsUp() {
  const replacing = up.picks.length ? [lineupKey(up.picks.map((p) => p.id))] : [];
  giveTurnsBack();
  picker.open(replacing);
}

// ---------- Timer screen ----------
const timer = new TimerController($('#screen-timer'), {
  onTimesUp: showTimesUp,
  onNotice: toast,
});

function startClock() {
  if (!currentGame) return;
  sound.unlock();
  try {
    gamePlayer?.pauseVideo();
  } catch {
    /* not ready */
  }
  $('#timesup').hidden = true;
  showScreen('timer');
  timer.start(state.settings);
  flashTimerControls();
}

function stopClock() {
  timer.stop();
  $('#timesup').hidden = true;
  showScreen('game');
  requestAnimationFrame(() => $('#btn-start-clock').focus({ preventScroll: true }));
}

function restartClock() {
  $('#timesup').hidden = true;
  timer.start(state.settings);
  flashTimerControls();
}

function showTimesUp() {
  renderAwards($('#award'), up.picks);
  $('#timesup').hidden = false;
  $('#timesup-game').textContent = currentGame ? currentGame.name : '';
  requestAnimationFrame(() => $('#btn-timesup-wheel').focus({ preventScroll: true }));
}

let controlsTimer = 0;
function flashTimerControls() {
  const el = $('#screen-timer');
  el.classList.add('show-controls');
  clearTimeout(controlsTimer);
  controlsTimer = setTimeout(() => el.classList.remove('show-controls'), 2600);
}

$('#screen-timer').addEventListener('pointermove', flashTimerControls);
$('#btn-timer-stop').addEventListener('click', stopClock);
$('#btn-timer-restart').addEventListener('click', restartClock);
$('#btn-stall-retry').addEventListener('click', () => timer.retryVideo());
$('#btn-stall-builtin').addEventListener('click', () => timer.switchToBuiltIn());
$('#btn-timesup-wheel').addEventListener('click', backToWheel);
$('#btn-timesup-again').addEventListener('click', restartClock);
$('#award').addEventListener('click', handleAwardClick);

// ---------- Winner ----------
let winnerToken = 0;

async function showWinner() {
  if (!leaders().length) return toast('Nobody has any points yet.');
  sound.unlock();
  const token = ++winnerToken;
  const el = $('#screen-winner');
  el.classList.remove('is-revealed');
  renderWinner({ kicker: $('#winner-kicker'), title: $('#winner-title'), podium: $('#podium'), rest: $('#winner-rest') });
  document.body.style.setProperty('--glow', '#ffc736');
  showScreen('winner');

  const roll = reducedMotion.matches ? 1200 : 2600;
  sound.drumroll(roll / 1000);
  await wait(roll);
  if (token !== winnerToken || screen !== 'winner') return;

  el.classList.add('is-revealed');
  sound.victory();
  const gold = ['#ffc736', '#ffe08a', '#ffffff', '#f5b100', '#1f8bff', '#e11d2e'];
  [700, 1400, 2200].forEach((ms) =>
    setTimeout(() => token === winnerToken && screen === 'winner' && burst(gold), reducedMotion.matches ? 0 : ms),
  );
  setTimeout(() => token === winnerToken && $('#btn-winner-wheel').focus({ preventScroll: true }), reducedMotion.matches ? 0 : 1300);
}

function leaveWinner() {
  winnerToken++;
  document.body.style.removeProperty('--glow');
  showScreen('wheel');
  requestAnimationFrame(() => $('#btn-spin').focus({ preventScroll: true }));
}

function startNewNight() {
  if (!confirm('Start a new night? Every score goes back to 0 and every game goes back on the wheel.')) return;
  newNight();
  leaveWinner();
  toast('New night! Scores are back to 0 and every game is on the wheel.');
}

$('#btn-winner-wheel').addEventListener('click', leaveWinner);
$('#btn-winner-new').addEventListener('click', startNewNight);

// ---------- Top bar ----------
const editor = setupEditor({
  dialog: $('#manage'),
  toast,
  onClose: () => {
    refreshWheel();
    if (screen === 'game' && currentGame) {
      const fresh = state.games.find((g) => g.id === currentGame.id);
      if (!fresh) return backToWheel();
      const videoChanged = fresh.videoUrl !== currentGame.videoUrl;
      currentGame = fresh;
      fillGameDetails(fresh);
      if (videoChanged) setupGameVideo(parseYouTube(fresh.videoUrl));
    }
  },
});

$('#btn-manage').addEventListener('click', () => editor.open(screen === 'game' ? currentGame?.id : undefined));

function renderSoundButton() {
  const on = state.settings.sound;
  const btn = $('#btn-sound');
  btn.setAttribute('aria-pressed', String(on));
  btn.title = on ? 'Sound effects on (M)' : 'Sound effects off (M)';
  btn.querySelector('.when-on').style.display = on ? '' : 'none';
  btn.querySelector('.when-off').style.display = on ? 'none' : '';
}

function toggleSound() {
  update((s) => (s.settings.sound = !s.settings.sound));
  toast(state.settings.sound ? 'Sound effects on.' : 'Sound effects off. The timer video still has sound.');
}
$('#btn-sound').addEventListener('click', toggleSound);

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => toast('Full screen isn’t available here.'));
}
$('#btn-fullscreen').addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
  const on = !!document.fullscreenElement;
  const btn = $('#btn-fullscreen');
  btn.setAttribute('aria-pressed', String(on));
  btn.title = on ? 'Exit full screen (F)' : 'Full screen (F)';
});

// ---------- Keyboard ----------
document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
  if ($('#manage').open) return;
  const target = e.target instanceof Element ? e.target : document.body;
  if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
  const key = e.key;
  const activate = key === ' ' || key === 'Enter';
  // Let Space/Enter press whatever button has focus.
  if (activate && target.closest('button, a, label')) return;

  if (key === 'f' || key === 'F') return toggleFullscreen();
  if (key === 'm' || key === 'M') return toggleSound();

  if (picker.isOpen) {
    if (key === 'Escape') picker.escape();
    return;
  }

  if (screen === 'wheel' && activate) {
    e.preventDefault();
    spin();
  } else if (screen === 'game') {
    if (activate) {
      e.preventDefault();
      startClock();
    } else if (key === 'Escape') backToWheel();
    else if (key === 'p' || key === 'P') pickWhoIsUp();
  } else if (screen === 'winner') {
    if (key === 'Escape') leaveWinner();
  } else if (screen === 'timer') {
    const timesUp = !$('#timesup').hidden;
    if (key === 'Escape') timesUp ? backToWheel() : stopClock();
    else if (key === 'r' || key === 'R') restartClock();
    else if (activate && timesUp) backToWheel();
    else flashTimerControls();
  }
});

// ---------- Start up ----------
mountScoreboard($('#scoreboard'), { onCrown: showWinner });
sound.setEnabled(state.settings.sound);
renderSoundButton();
showScreen('wheel');

let timerKey = `${state.settings.timerVideoUrl}|${state.settings.useBuiltInTimer}`;
subscribe(() => {
  refreshWheel();
  sound.setEnabled(state.settings.sound);
  renderSoundButton();
  const key = `${state.settings.timerVideoUrl}|${state.settings.useBuiltInTimer}`;
  if (key !== timerKey) {
    timerKey = key;
    timer.prepare(state.settings);
  }
});

// Redraw the wheel once its font has loaded so labels measure correctly.
document.fonts
  .load('800 48px "Barlow Condensed"')
  .catch(() => {})
  .finally(() => {
    wheel.signature = '';
    refreshWheel();
  });

// Load the timer video in the background so it starts instantly later.
timer.prepare(state.settings);
