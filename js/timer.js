// The countdown: plays the official timer video, or a built-in look-alike when that can't run.
import { loadYouTubeApi, parseYouTube, createPlayer } from './youtube.js';
import * as sound from './audio.js';

const PLAYING = 1;
const ENDED = 0;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class TimerController {
  constructor(root, { onTimesUp, onNotice }) {
    this.root = root;
    this.onTimesUp = onTimesUp;
    this.onNotice = onNotice || (() => {});
    this.videoHost = root.querySelector('#timer-video');
    this.fallbackEl = root.querySelector('#timer-fallback');
    this.stallEl = root.querySelector('#timer-stall');
    this.player = null;
    this.playerVideoId = null;
    this.readyPromise = null;
    this.mode = null;
    this.running = false;
    this.timesUpFired = false;
    this.buildFallback();
  }

  /** Loads the timer video ahead of time so it starts instantly. */
  async prepare(settings, timeoutMs = 10000) {
    if (settings.useBuiltInTimer) return;
    const yt = parseYouTube(settings.timerVideoUrl);
    if (!yt) return;
    if (this.player && this.playerVideoId === yt.id) return;
    try {
      await loadYouTubeApi(timeoutMs);
    } catch {
      return;
    }
    this.destroyPlayer();
    const mount = document.createElement('div');
    this.videoHost.replaceChildren(mount);
    this.playerVideoId = yt.id;
    this.readyPromise = new Promise((resolve) => {
      this.player = createPlayer(mount, {
        videoId: yt.id,
        start: settings.timerStart,
        controls: false,
        events: {
          onReady: () => resolve(true),
          onStateChange: (e) => this.handleState(e.data),
          onError: () => {
            resolve(false);
            this.handleError();
          },
        },
      });
    });
  }

  destroyPlayer() {
    try {
      this.player?.destroy();
    } catch {
      /* already gone */
    }
    this.player = null;
    this.playerVideoId = null;
    this.readyPromise = null;
    this.videoHost.replaceChildren();
  }

  async start(settings) {
    this.stop();
    this.settings = settings;
    this.running = true;
    this.timesUpFired = false;
    this.root.classList.remove('video-done', 'is-red');

    const yt = parseYouTube(settings.timerVideoUrl);
    if (settings.useBuiltInTimer || !yt) return this.startBuiltIn();

    if (!this.player || this.playerVideoId !== yt.id) await this.prepare(settings, 3000);
    const ready = this.readyPromise ? await Promise.race([this.readyPromise, wait(5000).then(() => false)]) : false;
    if (!this.running) return; // stopped while loading
    if (!ready) {
      this.onNotice('The timer video couldn’t load, so the built-in timer is running.');
      return this.startBuiltIn();
    }

    this.mode = 'video';
    this.root.dataset.mode = 'video';
    const p = this.player;
    p.seekTo(settings.timerStart || 0, true);
    p.unMute();
    p.setVolume(100);
    p.playVideo();
    this.poll = setInterval(() => this.checkVideo(), 100);
    this.stallTimeout = setTimeout(() => {
      if (this.running && this.mode === 'video' && p.getPlayerState?.() !== PLAYING) this.setStalled(true);
    }, 3500);
  }

  checkVideo() {
    const p = this.player;
    if (!p?.getCurrentTime) return;
    const t = p.getCurrentTime();
    if (!this.timesUpFired && t >= this.settings.timerTimesUpAt) this.fireTimesUp();
    const d = p.getDuration?.() || 0;
    if (d && t >= d - 1) {
      // Stop just before the end so YouTube's end screen never shows.
      p.pauseVideo();
      this.root.classList.add('video-done');
      clearInterval(this.poll);
      this.fireTimesUp();
    }
  }

  handleState(state) {
    if (!this.running || this.mode !== 'video') return;
    if (state === PLAYING) this.setStalled(false);
    if (state === ENDED) {
      this.root.classList.add('video-done');
      this.fireTimesUp();
    }
  }

  handleError() {
    if (this.running && this.mode === 'video' && !this.timesUpFired) {
      this.onNotice('The timer video can’t play here, so the built-in timer is running.');
      this.switchToBuiltIn();
    }
  }

  /** Called from the "stalled" message's buttons. */
  retryVideo() {
    this.player?.playVideo();
  }

  // If the browser blocked autoplay, let clicks reach the video so it can be started by hand.
  setStalled(on) {
    this.stallEl.hidden = !on;
    this.root.classList.toggle('is-stalled', on);
  }

  switchToBuiltIn() {
    const settings = this.settings;
    this.stop();
    this.settings = settings;
    this.running = true;
    this.timesUpFired = false;
    this.startBuiltIn();
  }

  fireTimesUp() {
    if (this.timesUpFired) return;
    this.timesUpFired = true;
    this.onTimesUp();
  }

  stop() {
    this.running = false;
    clearInterval(this.poll);
    clearTimeout(this.stallTimeout);
    cancelAnimationFrame(this.raf);
    this.setStalled(false);
    this.fallbackEl.hidden = true;
    this.root.classList.remove('is-red', 'video-done');
    try {
      if (this.player?.pauseVideo) this.player.pauseVideo();
    } catch {
      /* player not ready */
    }
    this.mode = null;
  }

  // ---- Built-in timer (works offline) ----

  buildFallback() {
    const ticks = Array.from({ length: 60 }, (_, i) => {
      const a = (i / 60) * 360;
      return `<rect class="ring-tick" data-i="${i}" x="-1.6" y="-47" width="3.2" height="9" rx="1.2" transform="rotate(${a})"/>`;
    }).join('');
    this.fallbackEl.innerHTML = `
      <div class="fallback-clock">
        <svg viewBox="-50 -50 100 100" aria-hidden="true">
          <circle class="ring-back" r="49"/>
          <circle class="ring-face" r="36"/>
          <g class="ring-ticks">${ticks}</g>
        </svg>
        <div class="fallback-digits" aria-live="off"></div>
      </div>`;
    this.digitsEl = this.fallbackEl.querySelector('.fallback-digits');
    this.tickEls = [...this.fallbackEl.querySelectorAll('.ring-tick')];
  }

  startBuiltIn() {
    this.mode = 'builtin';
    this.root.dataset.mode = 'builtin';
    this.fallbackEl.hidden = false;
    this.root.classList.remove('is-red');
    this.tickEls.forEach((el) => el.classList.remove('is-spent'));
    const t0 = performance.now();
    let last = null;

    const frame = (now) => {
      if (!this.running) return;
      const e = (now - t0) / 1000;
      let label;
      let value;
      if (e < 3) {
        value = 3 - Math.floor(e);
        label = `${value}`;
        this.fallbackEl.dataset.phase = 'ready';
      } else {
        value = Math.max(0, 60 - Math.floor(e - 3));
        label = String(value).padStart(2, '0');
        this.fallbackEl.dataset.phase = 'run';
      }
      const key = `${this.fallbackEl.dataset.phase}:${value}`;
      if (key !== last) {
        last = key;
        this.digitsEl.textContent = label;
        if (this.fallbackEl.dataset.phase === 'ready') sound.beep(false);
        else {
          const spent = 60 - value;
          this.tickEls.forEach((el, i) => el.classList.toggle('is-spent', i < spent));
          if (value === 60) sound.beep(true);
          else if (value === 0) sound.buzzer();
          else if (value <= 10) sound.beep(false);
          else sound.softTick();
          this.root.classList.toggle('is-red', value <= 10);
        }
      }
      if (this.fallbackEl.dataset.phase === 'run' && value === 0) {
        this.fireTimesUp();
        return;
      }
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }
}
