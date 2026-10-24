// Minute to Win It: wheel → game → clock.
import { state, update, subscribe, wheelGames, onSaveError } from './store.js';
import { Wheel } from './wheel.js';
import * as sound from './audio.js';
import { burst } from './confetti.js';
import { TimerController } from './timer.js';
import { loadYouTubeApi, parseYouTube, createPlayer } from './youtube.js';
import { mountScoreboard, renderAwards, handleAwardClick } from './scoreboard.js';
import { setupEditor } from './editor.js';

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
  $('#wheel-empty-reset').hidden = total === 0;
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
$('#wheel-empty-manage').addEventListener('click', () => editor.open());

function randomIndex(n) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return Math.floor((buf[0] / 2 ** 32) * n);
}

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
  (yt ? $('#game-info') : $('#game-media')).append(pic);
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
  const id = currentGame?.id;
  if (id) update((s) => (s.playedIds = s.playedIds.filter((x) => x !== id)));
  backToWheel();
  setTimeout(spin, reducedMotion.matches ? 100 : 500);
}

$('#btn-start-clock').addEventListener('click', startClock);
$('#btn-back-wheel').addEventListener('click', backToWheel);
$('#btn-respin').addEventListener('click', putBackAndSpin);

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
  renderAwards($('#award'));
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

  if (screen === 'wheel' && activate) {
    e.preventDefault();
    spin();
  } else if (screen === 'game') {
    if (activate) {
      e.preventDefault();
      startClock();
    } else if (key === 'Escape') backToWheel();
  } else if (screen === 'timer') {
    const timesUp = !$('#timesup').hidden;
    if (key === 'Escape') timesUp ? backToWheel() : stopClock();
    else if (key === 'r' || key === 'R') restartClock();
    else if (activate && timesUp) backToWheel();
    else flashTimerControls();
  }
});

// ---------- Start up ----------
mountScoreboard($('#scoreboard'));
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
