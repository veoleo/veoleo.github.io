// Componentes de interfaz reutilizables.
import { html, useState, useEffect, useRef } from 'preact-standalone';
import { TYPES, statusLabel, STATUS_ICONS, paletteFor, initials, starsText } from '../lib/utils.js';
import { sfx } from '../lib/sound.js';
import { burstAt, onomato, tiltHandlers } from '../lib/fx.js';
import { useStore } from '../lib/store.js';
import { watchProviders, platformsOf, hasTmdb } from '../lib/metadata.js';

export { html };

/* ── hook de carga asíncrona ── */
export function useAsync(fn, deps = []) {
  const [st, setSt] = useState({ loading: true, data: null, error: null });
  useEffect(() => {
    let alive = true;
    setSt((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve().then(fn).then(
      (data) => alive && setSt({ loading: false, data, error: null }),
      (error) => { console.error('[TVDaily]', error); alive && setSt({ loading: false, data: null, error }); },
    );
    return () => { alive = false; };
  }, deps);
  return st;
}

/* ── estrellas con medias ── */
const STAR = 'M12 2.4l2.95 6.1 6.65.85-4.9 4.6 1.3 6.6L12 17.3l-6 3.25 1.3-6.6-4.9-4.6 6.65-.85z';
export function Stars({ value = 0, onChange, size = 34, readOnly = false, showValue = true }) {
  const [hover, setHover] = useState(null);
  const shown = hover ?? (Number(value) || 0);
  const ro = readOnly || !onChange;
  const pick = (i, e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return i + ((e.clientX - r.left) < r.width / 2 ? 0.5 : 1);
  };
  return html`
    <div class="stars ${ro ? 'ro' : ''}" style=${`--ss:${size}px`} onMouseLeave=${() => setHover(null)} role=${ro ? 'img' : 'slider'}
      aria-label=${`Valoración ${value || 0} de 5`} aria-valuemin="0" aria-valuemax="5" aria-valuenow=${value || 0} tabindex=${ro ? -1 : 0}
      onKeyDown=${ro ? null : (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(5, (value || 0) + 0.5)); sfx.tick((value || 0) * 2 + 1); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(0, (value || 0) - 0.5)); sfx.tick((value || 0) * 2 - 1); }
      }}>
      ${[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, shown - i));
        return html`<span class="s" key=${i}
          onMouseMove=${ro ? null : (e) => { const v = pick(i, e); if (v !== hover) { setHover(v); sfx.tick(v * 2); } }}
          onClick=${ro ? null : (e) => {
            let v = pick(i, e); if (v === value) v = 0;
            onChange(v); sfx.tick(v * 2 + 2);
            const el = e.currentTarget; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
            if (v === 5) { const r = el.getBoundingClientRect(); onomato(r.left, r.top - 30, '¡OBRA MAESTRA!', '#f9c846'); burstAt(el, { count: 22, spread: 130 }); sfx.chime(); }
            else if (v > 0) burstAt(el, { count: 8, spread: 50 });
          }}>
          <svg viewBox="0 0 24 24"><path class="bg" d=${STAR} /></svg>
          <span style=${`position:absolute;inset:0;width:${fill * 100}%;overflow:hidden`}>
            <svg viewBox="0 0 24 24" style=${`position:static;width:${size}px;height:${size}px`}><path class="fg" d=${STAR} /></svg>
          </span>
        </span>`;
      })}
      ${showValue && html`<span class="val">${shown ? String(shown).replace('.5', '½').replace(/^0½/, '½') : '–'}</span>`}
    </div>`;
}

/* ── póster generado cuando no hay imagen ── */
export function GenPoster({ title, type }) {
  const c1 = paletteFor(title), c2 = paletteFor((title || '') + 'x');
  return html`<div class="gen-poster" style=${`--gc:${c1};--gc2:${c2 === c1 ? 'var(--paper-2)' : c2}`}>
    <span>${TYPES[type]?.icon || '🎞'}</span><b>${title}</b></div>`;
}

export function Cover({ src, title, type, alt = '' }) {
  const [err, setErr] = useState(false);
  useEffect(() => setErr(false), [src]);
  if (!src || err) return html`<${GenPoster} title=${title} type=${type} />`;
  return html`<img src=${src} alt=${alt || title} loading="lazy" referrerpolicy="no-referrer" onError=${() => setErr(true)} />`;
}

/* ── tarjeta de póster ── */
export function PosterCard({ e, href, onClick, sub, extra, showStatus = true }) {
  const T = TYPES[e.type] || TYPES.series;
  const light = e.type === 'book' || e.type === 'audiobook';
  const plats = platformsOf(e);
  return html`
    <a class="pcard" href=${href || (e.id ? `#/item/${e.id}` : undefined)} onClick=${onClick}
      onMouseEnter=${() => sfx.hover()} ...${tiltHandlers}>
      <div class="poster">
        <span class="type-tab" style=${`--tc:${T.color};color:${light ? 'var(--ink)' : 'var(--paper-2)'}`}>${T.icon} ${T.label}</span>
        ${showStatus && e.status && html`<span class="status-dot ${e.status}" title=${statusLabel(e.status, e.type)}>${STATUS_ICONS[e.status]}</span>`}
        <${Cover} src=${e.cover} title=${e.title} type=${e.type} />
        ${e.rating > 0 && html`<div class="rating-strip"><span class="stars-text">${starsText(e.rating)}</span><span>${e.rating}</span></div>`}
      </div>
      <div class="meta">
        <h4>${e.title}</h4>
        <div class="sub">${sub ?? [e.year, plats[0]].filter(Boolean).join(' · ')}</div>
        ${extra}
      </div>
    </a>`;
}

/* ── avatar ── */
export function Avatar({ user, size = 44, onClick, href }) {
  const name = user?.displayName || user?.ownerName || user?.authorName || '?';
  const photo = user?.photoURL || user?.ownerPhoto || user?.authorPhoto;
  const [err, setErr] = useState(false);
  const inner = photo && !err
    ? html`<img src=${photo} alt=${name} referrerpolicy="no-referrer" onError=${() => setErr(true)} />`
    : initials(name);
  const style = `--as:${size}px;--c:${paletteFor(name)}`;
  return href
    ? html`<a class="avatar" style=${style} href=${href} title=${name}>${inner}</a>`
    : html`<div class="avatar" style=${style} onClick=${onClick} title=${name}>${inner}</div>`;
}

/* ── modal ── */
export function Modal({ title, onClose, children, color = 'var(--yellow)', width = 760, actions }) {
  useEffect(() => {
    sfx.whoosh(1);
    const k = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, []);
  return html`
    <div class="overlay" onMouseDown=${(e) => e.target === e.currentTarget && onClose?.()}>
      <div class="modal" style=${`--mw:${width}px`} role="dialog" aria-modal="true" aria-label=${title}>
        <div class="modal-head" style=${`--c:${color}`}>
          <h3>${title}</h3>${actions}
          <button class="btn icon sm" onClick=${onClose} aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-body">${children}</div>
      </div>
    </div>`;
}

/* ── toasts ── */
export function Toasts() {
  const { toasts } = useStore();
  return html`<div class="toasts" aria-live="polite">${toasts.map((t) => html`<div key=${t.id} class="toast ${t.kind}">${t.text}</div>`)}</div>`;
}

/* ── anillo de progreso ── */
export function Ring({ value = 0, max = 1, size = 150, color = 'var(--teal)', label = '', sub = '' }) {
  const r = 60, C = 2 * Math.PI * r;
  const pct = max ? Math.min(1, value / max) : 0;
  const [p, setP] = useState(0);
  useEffect(() => { const t = setTimeout(() => setP(pct), 60); return () => clearTimeout(t); }, [pct]);
  return html`
    <div class="ring" style=${`--rs:${size}px;--c:${color}`}>
      <svg viewBox="0 0 150 150">
        <circle class="outline" cx="75" cy="75" r="68" />
        <circle class="track" cx="75" cy="75" r=${r} />
        <circle class="bar" cx="75" cy="75" r=${r} stroke-dasharray=${C} stroke-dashoffset=${C * (1 - p)} />
        <circle class="outline" cx="75" cy="75" r="52" />
      </svg>
      <div class="lbl"><div><b>${label || `${value}`}</b><span>${sub}</span></div></div>
    </div>`;
}

/* ── plataformas ── */
export function Providers({ e, mini = false, max = 6 }) {
  const fl = e.providers?.flatrate || [];
  if (fl.length) {
    return html`<div class="row" style="--g:6px">${fl.slice(0, max).map((p) => html`
      <span class="provider ${mini ? 'mini' : ''}" title=${p.name}>${p.logo && html`<img src=${p.logo} alt=${p.name} />`}${!mini && p.name}</span>`)}</div>`;
  }
  if (e.network) return html`<span class="provider text ${mini ? 'mini' : ''}">📺 ${e.network}</span>`;
  return null;
}

// Carga perezosa de plataformas para resultados de TMDB.
export function LazyProviders({ item, mini = true }) {
  const { settings } = useStore();
  const [prov, setProv] = useState(item.providers || null);
  useEffect(() => {
    if (prov || !item.tmdbId || !hasTmdb(settings)) return;
    let alive = true;
    watchProviders(item.type, item.tmdbId, settings).then((p) => alive && setProv(p)).catch(() => {});
    return () => { alive = false; };
  }, [item.tmdbId]);
  return html`<${Providers} e=${{ ...item, providers: prov }} mini=${mini} max=${4} />`;
}

/* ── controles ── */
export function Seg({ options, value, onChange }) {
  return html`<div class="seg" role="tablist">${options.map((o) => html`
    <button key=${o.value} role="tab" aria-selected=${value === o.value} class=${value === o.value ? 'on' : ''}
      style=${o.c ? `--c:${o.c};--fg:${o.fg || 'var(--ink)'}` : ''}
      onClick=${() => { onChange(o.value); sfx.click(); }}>${o.label}</button>`)}</div>`;
}

export function Chip({ on, onClick, children, color, light }) {
  return html`<button class="chip ${on ? 'on' : ''} ${light ? 'light' : ''}" style=${color ? `--c:${color}` : ''}
    onClick=${() => { sfx.click(); onClick?.(); }} aria-pressed=${!!on}>${children}</button>`;
}

export function Switch({ checked, onChange, label }) {
  return html`<label class="check"><span class="switch"><input type="checkbox" checked=${checked}
    onChange=${(e) => { onChange(e.currentTarget.checked); sfx.click(); }} /><i></i></span>${label}</label>`;
}

export function Empty({ word = '¡VAYA!', title, sub, children }) {
  return html`<div class="empty"><div class="sfx">${word}</div><h3 class="h3" style="margin-top:14px">${title}</h3>
    ${sub && html`<p class="muted">${sub}</p>`}<div style="margin-top:18px">${children}</div></div>`;
}

export const Spinner = () => html`<div class="spinner" role="status" aria-label="Cargando"></div>`;

export function SkeletonGrid({ n = 8 }) {
  return html`<div class="grid">${Array.from({ length: n }, (_, i) => html`<div key=${i}><div class="skeleton" style="aspect-ratio:2/3"></div><div class="skeleton" style="height:18px;margin-top:12px;width:70%"></div></div>`)}</div>`;
}

export function TypeBadge({ type }) {
  const T = TYPES[type]; if (!T) return null;
  const dark = type === 'series' || type === 'movie';
  return html`<span class="badge ${dark ? 'dark' : ''}" style=${`--c:${T.color}`}>${T.icon} ${T.label}</span>`;
}

export function StatusBadge({ status, type }) {
  const c = { completed: 'var(--teal)', in_progress: 'var(--yellow)', planned: 'var(--pink)', abandoned: 'var(--ink)' }[status];
  return html`<span class="badge ${status === 'completed' || status === 'abandoned' ? 'dark' : ''}" style=${`--c:${c}`}>${STATUS_ICONS[status]} ${statusLabel(status, type)}</span>`;
}

// Botón con estado de carga.
export function AsyncButton({ onClick, children, class: cls = 'btn', ...rest }) {
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  return html`<button class=${cls} disabled=${busy} ...${rest} onClick=${async (e) => {
    setBusy(true);
    try { await onClick?.(e); } finally { if (alive.current) setBusy(false); }
  }}>${busy ? '⏳' : ''} ${children}</button>`;
}
