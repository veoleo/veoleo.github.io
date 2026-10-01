// Efectos visuales de cómic: onomatopeyas, estallidos, confeti y tilt.

const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const COLORS = ['#f2545b', '#f9c846', '#2bb3a3', '#3b6cf6', '#ee7ba8', '#ff8a3d', '#8e6cef'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function layer() {
  let el = document.getElementById('fx-layer');
  if (!el) { el = document.createElement('div'); el.id = 'fx-layer'; document.body.appendChild(el); }
  return el;
}

// Bocadillo de onomatopeya ("¡ZAS!") que estalla en (x, y).
export function onomato(x, y, word = pick(['¡ZAS!', '¡POW!', '¡BAM!', '¡WOW!', '¡TOMA!']), color = pick(COLORS)) {
  const el = document.createElement('div');
  el.className = 'onomato';
  el.textContent = word;
  el.style.left = x + 'px'; el.style.top = y + 'px';
  el.style.setProperty('--bg', color);
  el.style.setProperty('--rot', (Math.random() * 24 - 12).toFixed(1) + 'deg');
  layer().appendChild(el);
  setTimeout(() => el.remove(), reduce() ? 600 : 1100);
}

// Estallido de estrellitas y rayas planas.
export function burst(x, y, { count = 14, colors = COLORS, spread = 90 } = {}) {
  if (reduce()) return;
  const root = layer();
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    p.className = 'spark' + (i % 3 === 0 ? ' star' : '');
    p.style.left = x + 'px'; p.style.top = y + 'px';
    p.style.background = pick(colors);
    root.appendChild(p);
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const d = spread * (0.6 + Math.random() * 0.7);
    p.animate([
      { transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(.2) rotate(${Math.random() * 360}deg)`, opacity: 0 },
    ], { duration: 650 + Math.random() * 300, easing: 'cubic-bezier(.15,.8,.3,1)' }).onfinish = () => p.remove();
  }
}

export function burstAt(el, opts) {
  const r = el.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, opts);
}

// Confeti plano que cae desde arriba (retos completados).
export function confetti(n = 120) {
  if (reduce()) return;
  const root = layer();
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.className = 'confetti';
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = pick(COLORS);
    p.style.width = 8 + Math.random() * 8 + 'px';
    p.style.height = 10 + Math.random() * 14 + 'px';
    root.appendChild(p);
    const dx = (Math.random() - 0.5) * 300;
    p.animate([
      { transform: `translate(0,-40px) rotate(0deg)` },
      { transform: `translate(${dx}px, 110vh) rotate(${720 * (Math.random() - 0.5)}deg)` },
    ], { duration: 1800 + Math.random() * 1800, delay: Math.random() * 400, easing: 'cubic-bezier(.3,.1,.6,1)' }).onfinish = () => p.remove();
  }
}

// Tilt 3D suave para tarjetas (props de Preact).
export const tiltHandlers = {
  onMouseMove(e) {
    if (reduce()) return;
    const el = e.currentTarget, r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--rx', (-py * 8).toFixed(2) + 'deg');
    el.style.setProperty('--ry', (px * 10).toFixed(2) + 'deg');
  },
  onMouseLeave(e) {
    e.currentTarget.style.setProperty('--rx', '0deg');
    e.currentTarget.style.setProperty('--ry', '0deg');
  },
};

// Revela elementos con la clase .reveal al entrar en pantalla.
let io;
export function observeReveal(root = document) {
  if (!('IntersectionObserver' in window)) { root.querySelectorAll('.reveal').forEach((el) => el.classList.add('in')); return; }
  io = io || new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }, { rootMargin: '0px 0px -40px 0px' });
  root.querySelectorAll('.reveal:not(.in)').forEach((el) => io.observe(el));
}
