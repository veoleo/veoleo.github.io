// Efectos visuales: destellos de texto, chispas de luz, barrido, confeti lineal,
// foco que sigue al cursor, revelado al hacer scroll y texto que se "descifra".

const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const COLORS = ['#c6ff3d', '#5b7fff', '#ff5fae', '#2ee6c5', '#ffc53d', '#ff4d61', '#9a7bff'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function layer() {
  let el = document.getElementById('fx-layer');
  if (!el) { el = document.createElement('div'); el.id = 'fx-layer'; document.body.appendChild(el); }
  return el;
}

// Palabra gigante que aparece, se rellena de luz y se desvanece.
export function flash(word, color = '#c6ff3d') {
  if (reduce()) return;
  const el = document.createElement('div');
  el.className = 'flash';
  el.textContent = word;
  el.dataset.t = word;
  el.style.setProperty('--fc', color);
  layer().appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

// Compatibilidad con llamadas antiguas.
export function onomato(x, y, word, color) { flash(String(word).replace(/[¡!]/g, ''), color); }

// Línea de luz que barre la pantalla de arriba abajo.
export function scan(color = '#c6ff3d') {
  if (reduce()) return;
  const el = document.createElement('div');
  el.className = 'scanline';
  el.style.setProperty('--fc', color);
  layer().appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

// Chispas lineales que salen disparadas desde un punto.
export function burst(x, y, { count = 14, colors = COLORS, spread = 90 } = {}) {
  if (reduce()) return;
  const root = layer();
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    p.className = 'spark';
    const c = pick(colors);
    p.style.left = x + 'px'; p.style.top = y + 'px'; p.style.background = c; p.style.color = c;
    root.appendChild(p);
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.3;
    const d = spread * (0.6 + Math.random() * 0.7);
    const deg = (a * 180) / Math.PI + 90;
    p.animate([
      { transform: `translate(-50%,-50%) rotate(${deg}deg) scaleY(.2)`, opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) rotate(${deg}deg) scaleY(1)`, opacity: 0 },
    ], { duration: 650 + Math.random() * 250, easing: 'cubic-bezier(.16,1,.3,1)' }).onfinish = () => p.remove();
  }
}
export function burstAt(el, opts) {
  const r = el.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, opts);
}

// Lluvia de líneas de color (retos cumplidos).
export function confetti(n = 90) {
  if (reduce()) return;
  const root = layer();
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.className = 'confetti';
    const c = pick(COLORS);
    p.style.left = Math.random() * 100 + 'vw';
    p.style.height = 14 + Math.random() * 40 + 'px';
    p.style.background = c; p.style.boxShadow = `0 0 10px ${c}`;
    root.appendChild(p);
    p.animate([
      { transform: 'translateY(-60px)', opacity: 1 },
      { transform: `translateY(110vh)`, opacity: .2 },
    ], { duration: 1200 + Math.random() * 1600, delay: Math.random() * 500, easing: 'cubic-bezier(.4,.1,.6,1)' }).onfinish = () => p.remove();
  }
}

// Foco suave que sigue al cursor (capa .fx-cursor del index).
export function trackCursor() {
  const el = document.querySelector('.fx-cursor');
  if (!el || reduce() || matchMedia('(pointer: coarse)').matches) return;
  let raf = 0;
  window.addEventListener('pointermove', (e) => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      el.style.setProperty('--cx', e.clientX + 'px');
      el.style.setProperty('--cy', e.clientY + 'px');
    });
  }, { passive: true });
}

// Brillo que sigue al ratón dentro de una tarjeta (props de Preact).
export const tiltHandlers = {
  onMouseMove(e) {
    if (reduce()) return;
    const el = e.currentTarget, r = el.getBoundingClientRect();
    el.style.setProperty('--mx', ((e.clientX - r.left) / r.width) * 100 + '%');
    el.style.setProperty('--my', ((e.clientY - r.top) / r.height) * 100 + '%');
  },
};

// Revela elementos con .reveal al entrar en pantalla (también los que aparecen después).
let io, mo;
export function observeReveal(root = document) {
  if (!('IntersectionObserver' in window)) { root.querySelectorAll('.reveal').forEach((el) => el.classList.add('in')); return; }
  io = io || new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }, { rootMargin: '0px 0px -40px 0px' });
  root.querySelectorAll('.reveal:not(.in)').forEach((el) => io.observe(el));
  if (!mo && 'MutationObserver' in window) {
    let pending = false;
    mo = new MutationObserver(() => {
      if (pending) return; pending = true;
      requestAnimationFrame(() => { pending = false; document.querySelectorAll('.reveal:not(.in)').forEach((el) => io.observe(el)); });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }
}

// Texto que se descifra carácter a carácter.
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=/<>';
export function scramble(el, text, ms = 700) {
  if (!el) return;
  if (reduce()) { el.textContent = text; return; }
  const start = performance.now();
  const len = text.length;
  const tick = (now) => {
    const p = Math.min(1, (now - start) / ms);
    const fixed = Math.floor(p * len);
    let out = text.slice(0, fixed);
    for (let i = fixed; i < len; i++) out += text[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    el.textContent = out;
    if (p < 1) requestAnimationFrame(tick); else el.textContent = text;
  };
  requestAnimationFrame(tick);
}

// Contador animado.
export function countUp(el, to, ms = 1100) {
  if (!el) return;
  const n = Number(to) || 0;
  if (reduce() || n === 0) { el.textContent = n.toLocaleString('es-ES'); return; }
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - start) / ms);
    const e = 1 - Math.pow(1 - p, 4);
    el.textContent = Math.round(n * e).toLocaleString('es-ES');
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
