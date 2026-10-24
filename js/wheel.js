// The spinning prize wheel, drawn on a <canvas>.
// Angles are measured clockwise from the top (where the pointer sits).

const TAU = Math.PI * 2;
const mod = (a, n) => ((a % n) + n) % n;

// Bright game-show slice colors. Neighbors never share a color.
export const SLICE_COLORS = ['#e11d2e', '#f2750a', '#f5b700', '#1fae55', '#0ea5b7', '#1f6bff', '#7b3ff2', '#e2338f'];

const BULBS = 24;

export class Wheel {
  constructor(canvas, { pointer, onTick } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.pointer = pointer;
    this.onTick = onTick || (() => {});
    this.items = [];
    this.colors = [];
    this.rotation = 0;
    this.flap = 0;
    this.anim = null;
    this.celebration = null;
    this.raf = 0;
    this.signature = '';
    this.size = 0;
    this.lastTickAt = 0;
    this.lastBoundary = 0;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.resize();
  }

  get spinning() {
    return !!this.anim;
  }

  /** items: [{ id, label }] */
  setItems(items) {
    const signature = JSON.stringify(items.map((i) => [i.id, i.label]));
    if (signature === this.signature) return;
    this.signature = signature;
    this.items = items;
    this.colors = assignColors(items.length);
    this.celebration = null;
    this.buildFace();
    this.render();
  }

  colorAt(index) {
    return this.colors[index] || SLICE_COLORS[0];
  }

  resize() {
    const box = this.canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = Math.round(Math.min(box.width, box.height) * dpr);
    if (!size || size === this.size) return;
    this.size = size;
    this.canvas.width = size;
    this.canvas.height = size;
    this.buildFace();
    this.render();
  }

  // Geometry, relative to the canvas size.
  get geo() {
    const s = this.size;
    const outer = s * 0.49; // outside of the bulb rim
    const rim = s * 0.062; // rim thickness
    const face = outer - rim; // radius of the slices
    return { s, c: s / 2, outer, rim, face, hub: s * 0.105 };
  }

  /** Draws the slices and labels once to an offscreen canvas; spinning just rotates it. */
  buildFace() {
    if (!this.size) return;
    const { s, face } = this.geo;
    const off = (this.face = document.createElement('canvas'));
    off.width = s;
    off.height = s;
    const ctx = off.getContext('2d');
    ctx.translate(s / 2, s / 2);

    const n = this.items.length;
    if (!n) {
      ctx.beginPath();
      ctx.arc(0, 0, face, 0, TAU);
      ctx.fillStyle = '#132a6b';
      ctx.fill();
      return;
    }

    const seg = TAU / n;
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + i * seg;
      const a1 = a0 + seg;
      const color = this.colors[i];
      const grad = ctx.createRadialGradient(0, 0, face * 0.15, 0, 0, face);
      grad.addColorStop(0, shade(color, -0.45));
      grad.addColorStop(0.55, shade(color, -0.08));
      grad.addColorStop(0.92, color);
      grad.addColorStop(1, shade(color, 0.18));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      if (n === 1) ctx.arc(0, 0, face, 0, TAU);
      else ctx.arc(0, 0, face, a0, a1);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Slice dividers
    if (n > 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = Math.max(2, s * 0.004);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + i * seg;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * face, Math.sin(a) * face);
        ctx.stroke();
      }
    }

    // Labels
    const textStart = face * 0.3;
    const textEnd = face * 0.92;
    const maxLen = textEnd - textStart;
    const maxH = n === 1 ? face * 0.5 : Math.min(face * 0.5, 2 * face * 0.62 * Math.sin(seg / 2) * 0.86);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (let i = 0; i < n; i++) {
      const label = this.items[i].label.toUpperCase();
      const { lines, fontSize } = fitLabel(ctx, label, maxLen, maxH, face);
      ctx.save();
      ctx.rotate(-Math.PI / 2 + (i + 0.5) * seg);
      ctx.font = `800 ${fontSize}px "Barlow Condensed", "Arial Narrow", sans-serif`;
      const lineH = fontSize * 0.98;
      lines.forEach((line, li) => {
        const y = (li - (lines.length - 1) / 2) * lineH;
        ctx.lineWidth = fontSize * 0.2;
        ctx.strokeStyle = 'rgba(6,16,54,0.85)';
        ctx.strokeText(line, textEnd, y + fontSize * 0.04);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(line, textEnd, y + fontSize * 0.04);
      });
      ctx.restore();
    }

    // Soft shadow around the hub
    const hubShade = ctx.createRadialGradient(0, 0, face * 0.18, 0, 0, face * 0.42);
    hubShade.addColorStop(0, 'rgba(0,0,0,0.45)');
    hubShade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hubShade;
    ctx.beginPath();
    ctx.arc(0, 0, face * 0.42, 0, TAU);
    ctx.fill();
  }

  render(now = performance.now()) {
    const ctx = this.ctx;
    if (!this.size || !ctx) return;
    const { s, c, outer, rim, face } = this.geo;
    ctx.clearRect(0, 0, s, s);

    // Rim (fixed marquee frame)
    ctx.save();
    ctx.translate(c, c);
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = s * 0.03;
    ctx.shadowOffsetY = s * 0.012;
    const rimGrad = ctx.createLinearGradient(-outer, -outer, outer, outer);
    rimGrad.addColorStop(0, '#ffe08a');
    rimGrad.addColorStop(0.35, '#f5b100');
    rimGrad.addColorStop(0.7, '#c77a00');
    rimGrad.addColorStop(1, '#ffd25a');
    ctx.beginPath();
    ctx.arc(0, 0, outer, 0, TAU);
    ctx.fillStyle = rimGrad;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.beginPath();
    ctx.arc(0, 0, face + s * 0.006, 0, TAU);
    ctx.fillStyle = '#061036';
    ctx.fill();
    ctx.restore();

    // Slices (rotating)
    if (this.face) {
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(this.rotation);
      ctx.drawImage(this.face, -c, -c);
      this.drawCelebration(ctx, now, face);
      ctx.restore();
    }

    this.drawBulbs(ctx, now, c, face + rim / 2, s);

    if (this.pointer) this.pointer.style.transform = `translateX(-50%) rotate(${this.flap.toFixed(2)}deg)`;
  }

  drawCelebration(ctx, now, face) {
    const cel = this.celebration;
    if (!cel || !this.items.length) return;
    const n = this.items.length;
    const seg = TAU / n;
    const t = (now - cel.start) / 1000;
    // Dim every other slice, spotlight the winner.
    ctx.fillStyle = `rgba(3,8,32,${Math.min(0.55, t * 1.6).toFixed(3)})`;
    for (let i = 0; i < n; i++) {
      if (i === cel.index) continue;
      const a0 = -Math.PI / 2 + i * seg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, face, a0, a0 + seg);
      ctx.closePath();
      ctx.fill();
    }
    const pulse = 0.12 + 0.12 * Math.sin(t * 12);
    const a0 = -Math.PI / 2 + cel.index * seg;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    if (n === 1) ctx.arc(0, 0, face, 0, TAU);
    else ctx.arc(0, 0, face, a0, a0 + seg);
    ctx.closePath();
    ctx.fillStyle = `rgba(255,255,255,${pulse.toFixed(3)})`;
    ctx.fill();
  }

  drawBulbs(ctx, now, c, radius, s) {
    const r = s * 0.0135;
    let litFn;
    if (this.anim) {
      // Chase pattern that runs with the wheel's speed
      const phase = Math.floor(this.rotation / (TAU / BULBS));
      litFn = (i) => mod(i + phase, 3) === 0;
    } else if (this.celebration) {
      const flip = Math.floor((now - this.celebration.start) / 140) % 2;
      litFn = (i) => i % 2 === flip;
    } else {
      litFn = () => true;
    }
    for (let i = 0; i < BULBS; i++) {
      const a = -Math.PI / 2 + (i / BULBS) * TAU;
      const x = c + Math.cos(a) * radius;
      const y = c + Math.sin(a) * radius;
      const lit = litFn(i);
      if (lit) {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
        glow.addColorStop(0, 'rgba(255,250,220,0.95)');
        glow.addColorStop(0.35, 'rgba(255,214,90,0.65)');
        glow.addColorStop(1, 'rgba(255,190,40,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, r * 2.6, 0, TAU);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = lit ? '#fffbe8' : '#7a4a00';
      ctx.fill();
      ctx.lineWidth = s * 0.002;
      ctx.strokeStyle = lit ? '#ffd24d' : '#5a3500';
      ctx.stroke();
    }
  }

  /** Spins so the slice at `index` stops under the pointer. Resolves when it stops. */
  spin(index, { duration = 6500 } = {}) {
    const n = this.items.length;
    if (!n || this.anim) return Promise.resolve();
    this.celebration = null;
    const seg = TAU / n;
    const jitter = (Math.random() - 0.5) * seg * 0.7;
    const theta = (index + 0.5) * seg + jitter; // where the pointer should end up on the wheel
    const target = mod(-theta, TAU);
    const delta = mod(target - mod(this.rotation, TAU), TAU);
    const turns = duration < 3000 ? 2 : 5 + Math.floor(Math.random() * 3);
    const total = turns * TAU + delta;
    this.lastBoundary = Math.floor(this.rotation / seg);

    return new Promise((resolve) => {
      this.anim = { start: performance.now(), from: this.rotation, total, duration, resolve };
      this.loop();
    });
  }

  /** Lights up the winning slice for a moment. */
  celebrate(index, ms = 1600) {
    this.celebration = { index, start: performance.now(), until: performance.now() + ms };
    this.loop();
  }

  clearCelebration() {
    this.celebration = null;
    this.render();
  }

  loop() {
    if (this.raf) return;
    const step = (now) => {
      this.raf = 0;
      let keepGoing = false;

      if (this.anim) {
        const a = this.anim;
        const t = Math.min(1, (now - a.start) / a.duration);
        const eased = 1 - Math.pow(1 - t, 4);
        this.rotation = a.from + a.total * eased;
        const seg = TAU / this.items.length;
        const boundary = Math.floor(this.rotation / seg);
        if (boundary !== this.lastBoundary) {
          this.lastBoundary = boundary;
          if (now - this.lastTickAt > 34) {
            this.lastTickAt = now;
            this.flap = -24;
            this.onTick();
          }
        }
        if (t >= 1) {
          this.anim = null;
          this.rotation = mod(this.rotation, TAU);
          a.resolve();
        } else keepGoing = true;
      }

      if (Math.abs(this.flap) > 0.2) {
        this.flap *= 0.78;
        keepGoing = true;
      } else this.flap = 0;

      if (this.celebration && now < this.celebration.until) keepGoing = true;

      this.render(now);
      if (keepGoing) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
}

function assignColors(n) {
  const k = SLICE_COLORS.length;
  const colors = [];
  for (let i = 0; i < n; i++) {
    let idx = i % k;
    // Keep the last slice from matching the first (they touch).
    if (n > 1 && i === n - 1) {
      const first = colors[0];
      const prev = colors[i - 1];
      while (SLICE_COLORS[idx] === first || SLICE_COLORS[idx] === prev) idx = (idx + 1) % k;
    }
    colors.push(SLICE_COLORS[idx]);
  }
  return colors;
}

function fitLabel(ctx, text, maxLen, maxH, face) {
  const maxSize = Math.min(maxH * 0.66, face * 0.12);
  const minSize = face * 0.04;
  const words = text.split(/\s+/);
  for (let size = maxSize; size >= minSize; size -= Math.max(1, face * 0.003)) {
    ctx.font = `800 ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    if (ctx.measureText(text).width <= maxLen) return { lines: [text], fontSize: size };
    if (words.length > 1 && size * 2.05 <= maxH) {
      const lines = splitInTwo(words, ctx);
      if (Math.max(...lines.map((l) => ctx.measureText(l).width)) <= maxLen) return { lines, fontSize: size };
    }
  }
  // Last resort: shrink to fit on one line.
  ctx.font = `800 ${minSize}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  const w = ctx.measureText(text).width;
  return { lines: [text], fontSize: Math.max(8, (minSize * maxLen) / w) };
}

function splitInTwo(words, ctx) {
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
    if (!best || w < best.w) best = { w, lines: [a, b] };
  }
  return best.lines;
}

/** Lighten (amt > 0) or darken (amt < 0) a hex color. */
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  r = Math.round((t - r) * p + r);
  g = Math.round((t - g) * p + g);
  b = Math.round((t - b) * p + b);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
