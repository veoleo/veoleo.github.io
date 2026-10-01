// Componentes de interfaz reutilizables.
import { html, useState, useEffect, useLayoutEffect, useRef } from 'preact-standalone';
import { TYPES, statusLabel, paletteFor, initials } from '../lib/utils.js';
import { sfx } from '../lib/sound.js';
import { burstAt, flash, scramble, countUp } from '../lib/fx.js';
import { useStore } from '../lib/store.js';
import { watchProviders, platformsOf, hasTmdb } from '../lib/metadata.js';
import { Icon } from './icons.js';

export { html, Icon };

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

/* ── títulos con efecto de descifrado ── */
// El texto lo escribe sólo el efecto (sin hijos de Preact) para no duplicarse.
export function Scramble({ text, as = 'span', class: cls = '', ms = 700 }) {
  const ref = useRef();
  const t = String(text ?? '');
  useLayoutEffect(() => { if (ref.current) ref.current.textContent = t; scramble(ref.current, t, ms); }, [t]);
  return html`<${as} ref=${ref} class=${cls} aria-label=${t}></${as}>`;
}
export function CountUp({ value }) {
  const ref = useRef();
  useLayoutEffect(() => { countUp(ref.current, value); }, [value]);
  return html`<span ref=${ref}></span>`;
}

/* ── estrellas con medias ── */
const STAR = 'M12 2.4l2.95 6.1 6.65.85-4.9 4.6 1.3 6.6L12 17.3l-6 3.25 1.3-6.6-4.9-4.6 6.65-.85z';
export function Stars({ value = 0, onChange, size = 28, readOnly = false, showValue = true }) {
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
            if (v === 5) { flash('Obra maestra', '#ffc53d'); burstAt(el, { count: 20, spread: 120, colors: ['#ffc53d', '#c6ff3d', '#fff'] }); sfx.chime(); }
            else if (v > 0) burstAt(el, { count: 8, spread: 46, colors: ['#ffc53d', '#fff'] });
          }}>
          <svg viewBox="0 0 24 24"><path class="bg" d=${STAR} /></svg>
          <span style=${`position:absolute;inset:0;width:${fill * 100}%;overflow:hidden`}>
            <svg viewBox="0 0 24 24" style=${`position:static;width:${size}px;height:${size}px`}><path class="fg" d=${STAR} /></svg>
          </span>
        </span>`;
      })}
      ${showValue && html`<span class="val">${shown ? String(shown).replace('.5', ',5') : '—'}</span>`}
    </div>`;
}

/* ── póster generado cuando no hay imagen ── */
export function GenPoster({ title, type }) {
  return html`<div class="gen-poster" style=${`--gc:${TYPES[type]?.color || paletteFor(title)}`}>
    <span>${TYPES[type]?.label || 'TVDaily'}</span><b>${title}</b></div>`;
}

export function Cover({ src, title, type, alt = '' }) {
  const [err, setErr] = useState(false);
  useEffect(() => setErr(false), [src]);
  if (!src || err) return html`<${GenPoster} title=${title} type=${type} />`;
  return html`<img src=${src} alt=${alt || title} loading="lazy" decoding="async" referrerpolicy="no-referrer" onError=${() => setErr(true)} />`;
}

/* ── tarjeta de póster ── */
export function PosterCard({ e, href, onClick, sub, extra, showStatus = true }) {
  const T = TYPES[e.type] || TYPES.series;
  const plats = platformsOf(e);
  const prog = e.type === 'series' && e.episodes ? Math.min(1, (e.watchedEpisodes || []).length / e.episodes) : 0;
  return html`
    <a class="pcard" style=${`--c:${T.color}`} href=${href || (e.id ? `#/item/${e.id}` : undefined)} onClick=${onClick} onMouseEnter=${() => sfx.hover()}>
      <div class="glow"></div>
      <div class="poster">
        <${Cover} src=${e.cover} title=${e.title} type=${e.type} />
        <div class="ov">
          ${showStatus && e.status ? html`<span class="st ${e.status}">${statusLabel(e.status, e.type)}</span>` : html`<span></span>`}
          ${e.rating > 0 && html`<span class="rt">${String(e.rating).replace('.', ',')}</span>`}
        </div>
        ${prog > 0 && html`<div class="pbar"><i style=${`width:${prog * 100}%`}></i></div>`}
      </div>
      <div class="meta">
        <h4>${e.title}</h4>
        <div class="sub">${sub ?? [T.label, e.year, plats[0]].filter(Boolean).join(' · ')}</div>
        ${extra && html`<div class="x">${extra}</div>`}
      </div>
    </a>`;
}

/* ── avatar ── */
export function Avatar({ user, size = 40, onClick, href }) {
  const name = user?.displayName || user?.ownerName || user?.authorName || '?';
  const photo = user?.photoURL || user?.ownerPhoto || user?.authorPhoto;
  const [err, setErr] = useState(false);
  const inner = photo && !err ? html`<img src=${photo} alt=${name} referrerpolicy="no-referrer" onError=${() => setErr(true)} />` : initials(name);
  const style = `--as:${size}px;--c:${paletteFor(name)}`;
  if (href) return html`<a class="avatar" style=${style} href=${href} title=${name}>${inner}</a>`;
  if (onClick) return html`<button class="avatar" style=${style} onClick=${onClick} title=${name} aria-label=${name}>${inner}</button>`;
  return html`<div class="avatar" style=${style} title=${name}>${inner}</div>`;
}

/* ── modal ── */
export function Modal({ title, kicker, onClose, children, color = 'var(--accent)', width = 820, actions, flush = false }) {
  useEffect(() => {
    sfx.open();
    const k = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, []);
  const close = () => { sfx.close(); onClose?.(); };
  return html`
    <div class="overlay" onMouseDown=${(e) => e.target === e.currentTarget && close()}>
      <div class="modal glass" style=${`--mw:${width}px;--c:${color}`} role="dialog" aria-modal="true" aria-label=${title}>
        <div class="modal-head">
          <div class="grow">${kicker && html`<div class="label" style="margin-bottom:6px">${kicker}</div>`}<h3>${title}</h3></div>
          ${actions}
          <button class="btn icon glass" onClick=${close} aria-label="Cerrar"><${Icon} name="close" /></button>
        </div>
        <div class=${'modal-body' + (flush ? ' flush' : '')}>${children}</div>
      </div>
    </div>`;
}

/* ── toasts ── */
export function Toasts() {
  const { toasts } = useStore();
  return html`<div class="toasts" aria-live="polite">${toasts.map((t) => html`<div key=${t.id} class="toast glass ${t.kind}">${t.text}</div>`)}</div>`;
}

/* ── anillo de progreso ── */
export function Ring({ value = 0, max = 1, size = 160, color = 'var(--accent)', label = '', sub = '' }) {
  const r = 70, C = 2 * Math.PI * r;
  const pct = max ? Math.min(1, value / max) : 0;
  const [p, setP] = useState(0);
  useEffect(() => { const t = setTimeout(() => setP(pct), 80); return () => clearTimeout(t); }, [pct]);
  return html`
    <div class="ring" style=${`--rs:${size}px;--c:${color}`}>
      <svg viewBox="0 0 160 160">
        <circle class="ticks" cx="80" cy="80" r="78" />
        <circle class="track" cx="80" cy="80" r=${r} />
        <circle class="rbar" cx="80" cy="80" r=${r} stroke-dasharray=${C} stroke-dashoffset=${C * (1 - p)} />
      </svg>
      <div class="lbl"><div><b>${label || value}</b><span>${sub}</span></div></div>
    </div>`;
}

/* ── plataformas ── */
export function Providers({ e, mini = false, max = 6 }) {
  const fl = e.providers?.flatrate || [];
  if (fl.length) {
    return html`<div class="row" style="--g:14px">${fl.slice(0, max).map((p) => html`
      <span class="provider ${mini ? 'mini' : ''}" title=${p.name}>${p.logo && html`<img src=${p.logo} alt="" />`}${p.name}</span>`)}</div>`;
  }
  const n = e.network || platformsOf(e)[0];
  if (n) return html`<span class="provider text ${mini ? 'mini' : ''}">${n}</span>`;
  return null;
}

export function LazyProviders({ item, mini = true }) {
  const { settings } = useStore();
  const [prov, setProv] = useState(item.providers || null);
  useEffect(() => {
    if (prov || !item.tmdbId || !hasTmdb(settings)) return;
    let alive = true;
    watchProviders(item.type, item.tmdbId, settings).then((p) => alive && setProv(p)).catch(() => {});
    return () => { alive = false; };
  }, [item.tmdbId]);
  return html`<${Providers} e=${{ ...item, providers: prov }} mini=${mini} max=${3} />`;
}

/* ── controles ── */
export function Tabs({ options, value, onChange }) {
  return html`<div class="tabs" role="tablist">${options.map((o) => html`
    <button key=${o.value} role="tab" aria-selected=${value === o.value} class=${value === o.value ? 'on' : ''}
      style=${o.c ? `--c:${o.c}` : ''} onClick=${() => { onChange(o.value); sfx.click(); }}>${o.label}${o.n != null ? html`<span class="n">${o.n}</span>` : ''}</button>`)}</div>`;
}
export const Seg = Tabs;

export function Chip({ on, onClick, children, color, fg }) {
  return html`<button class=${'chip' + (on ? ' on' : '')} style=${(color ? `--c:${color};` : '') + (fg ? `--fg:${fg}` : '')}
    onClick=${() => { sfx.click(); onClick?.(); }} aria-pressed=${!!on}>${children}</button>`;
}

export function Switch({ checked, onChange, label }) {
  return html`<label class="check"><span class="switch"><input type="checkbox" checked=${checked}
    onChange=${(e) => { onChange(e.currentTarget.checked); sfx.click(); }} /><i></i></span><span>${label}</span></label>`;
}

export function Empty({ word = 'Vacío', title, sub, children }) {
  return html`<div class="empty"><div class="kicker">${title}</div><h2 class="display" style="margin:18px 0 20px">${word}</h2>
    ${sub && html`<p class="lead">${sub}</p>`}<div class="row" style="margin-top:28px">${children}</div></div>`;
}

export const Spinner = () => html`<div class="loader" role="status" aria-label="Cargando"><i></i><i></i><i></i></div>`;

export function SkeletonGrid({ n = 8 }) {
  return html`<div class="grid">${Array.from({ length: n }, (_, i) => html`<div key=${i}><div class="skeleton" style="aspect-ratio:2/3"></div><div class="skeleton" style="height:14px;margin-top:14px;width:70%"></div></div>`)}</div>`;
}

export function TypeBadge({ type }) {
  const T = TYPES[type]; if (!T) return null;
  return html`<span class="tag" style=${`--c:${T.color}`}>${T.label}</span>`;
}

const ST_C = { completed: 'var(--teal)', in_progress: 'var(--yellow)', planned: 'var(--pink)', abandoned: 'var(--muted)' };
export function StatusBadge({ status, type }) {
  return html`<span class="tag" style=${`--c:${ST_C[status]}`}>${statusLabel(status, type)}</span>`;
}

export function SectionHead({ kicker, title, color, children }) {
  return html`<div class="section-head" style=${color ? `--c:${color}` : ''}>
    <div>${kicker && html`<span class="label">${kicker}</span>`}<h2 class="h2">${title}</h2></div>
    ${children && html`<div class="row">${children}</div>`}
  </div>`;
}

// Compartir enlace: menú nativo si existe; si no, copiar.
export async function shareLink({ title, text, url }) {
  try {
    if (navigator.share) { await navigator.share({ title, text, url }); return; }
  } catch (e) { if (e?.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); (await import('../lib/store.js')).toast('Enlace copiado', 'ok'); }
  catch { prompt('Copia el enlace:', url); }
}

export function ShareButtons({ title, url }) {
  const t = encodeURIComponent(title), u = encodeURIComponent(url);
  return html`<div class="share">
    <button title="Compartir" aria-label="Compartir" onClick=${(e) => { e.preventDefault(); shareLink({ title, url }); }}><${Icon} name="share" size=${16} /></button>
    <a title="WhatsApp" aria-label="WhatsApp" href=${`https://wa.me/?text=${t}%20${u}`} target="_blank" rel="noopener"><${Icon} name="whatsapp" size=${16} /></a>
    <a title="Telegram" aria-label="Telegram" href=${`https://t.me/share/url?url=${u}&text=${t}`} target="_blank" rel="noopener"><${Icon} name="telegram" size=${16} /></a>
    <a title="X" aria-label="X" href=${`https://x.com/intent/post?text=${t}&url=${u}`} target="_blank" rel="noopener"><${Icon} name="x" size=${14} /></a>
    <button title="Copiar enlace" aria-label="Copiar enlace" onClick=${async (e) => { e.preventDefault(); try { await navigator.clipboard.writeText(url); (await import('../lib/store.js')).toast('Enlace copiado', 'ok'); sfx.pop(); } catch { /* sin portapapeles */ } }}><${Icon} name="link" size=${16} /></button>
  </div>`;
}

// Botón con estado de carga.
export function AsyncButton({ onClick, children, class: cls = 'btn', ...rest }) {
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  return html`<button class=${cls} disabled=${busy} ...${rest} onClick=${async (e) => {
    setBusy(true);
    try { await onClick?.(e); } finally { if (alive.current) setBusy(false); }
  }}>${children}</button>`;
}
