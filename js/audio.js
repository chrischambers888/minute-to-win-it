// Small synthesized sound effects (no audio files needed).

let ctx = null;
let master = null;
let enabled = true;

export function setEnabled(on) {
  enabled = !!on;
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Call from a click/keypress so the browser allows sound later. */
export function unlock() {
  audio();
}

function tone({ type = 'sine', freq, endFreq, at = 0, dur = 0.15, vol = 0.3, attack = 0.005 }) {
  const c = audio();
  if (!c || !enabled) return;
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** The wheel's peg click. */
export function tick() {
  tone({ type: 'square', freq: 2100, endFreq: 700, dur: 0.028, vol: 0.18, attack: 0.002 });
}

/** Plays when the wheel lands. */
export function fanfare() {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => {
    tone({ type: 'triangle', freq: f, at: i * 0.09, dur: 0.22, vol: 0.32 });
    tone({ type: 'square', freq: f, at: i * 0.09, dur: 0.12, vol: 0.06 });
  });
  [523.25, 659.25, 783.99, 1046.5].forEach((f) =>
    tone({ type: 'triangle', freq: f, at: 0.4, dur: 0.9, vol: 0.16, attack: 0.02 }),
  );
}

/** Countdown beeps for the built-in timer. */
export function beep(high = false) {
  tone({ type: 'sine', freq: high ? 1320 : 880, dur: high ? 0.35 : 0.16, vol: 0.35 });
}

export function softTick() {
  tone({ type: 'sine', freq: 1500, dur: 0.05, vol: 0.12, attack: 0.002 });
}

/** End-of-clock buzzer for the built-in timer. */
export function buzzer() {
  const c = audio();
  if (!c || !enabled) return;
  const t = c.currentTime;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1400;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.45, t + 0.02);
  gain.gain.setValueAtTime(0.45, t + 1.1);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.35);
  filter.connect(gain).connect(master);
  [110, 116.5, 220].forEach((f) => {
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = f;
    osc.connect(filter);
    osc.start(t);
    osc.stop(t + 1.4);
  });
}
