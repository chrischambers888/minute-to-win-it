// A short confetti burst for when the wheel lands.

const canvas = document.getElementById('confetti');
const ctx = canvas.getContext('2d');
let pieces = [];
let raf = 0;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function burst(colors = ['#ffc736', '#ffffff', '#1f8bff', '#e11d2e', '#1fae55', '#e2338f']) {
  if (reducedMotion()) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  const w = canvas.width;
  const h = canvas.height;
  const make = (x, dir) => {
    for (let i = 0; i < 90; i++) {
      const angle = (-Math.PI / 2) + dir * (0.25 + Math.random() * 0.45);
      const speed = (14 + Math.random() * 14) * dpr;
      pieces.push({
        x,
        y: h + 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: (6 + Math.random() * 8) * dpr,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        color: colors[(Math.random() * colors.length) | 0],
        life: 0,
      });
    }
  };
  make(w * 0.08, 1);
  make(w * 0.92, -1);
  if (!raf) raf = requestAnimationFrame(frame);
}

function frame() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  pieces = pieces.filter((p) => p.y < canvas.height + 40 && p.life < 260);
  for (const p of pieces) {
    p.life++;
    p.vy += 0.42 * dpr;
    p.vx *= 0.985;
    p.vy *= 0.985;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(1, Math.cos(p.life * 0.18));
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
    ctx.restore();
  }
  if (pieces.length) raf = requestAnimationFrame(frame);
  else {
    raf = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}
