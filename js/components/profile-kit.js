// Personalización del perfil: portada (imágenes de tus series y películas o cualquier búsqueda),
// color de acento y Top 4 de favoritos.
import { html, useState, useEffect, useMemo } from 'preact-standalone';
import { Modal, Tabs, Spinner, Cover, Icon, Seg } from './ui.js';
import { useStore, toast } from '../lib/store.js';
import { updateMyProfile } from '../lib/db.js';
import { backdropSearch, showBackdrops } from '../lib/metadata.js';
import { img, debounce, TYPES } from '../lib/utils.js';
import { sfx } from '../lib/sound.js';
import { flash } from '../lib/fx.js';

export const ACCENTS = ['#c6ff3d', '#2ee6c5', '#5b7fff', '#9a7bff', '#ff5fae', '#ff4d61', '#ff8a3d', '#ffc53d', '#eef0f7'];

function CoverTile({ it, on, onPick }) {
  const [src, setSrc] = useState(img(it.url, 640));
  return html`<button type="button" class=${on ? 'on' : ''} onClick=${() => onPick(it)} title=${it.title}>
    <img src=${src} alt=${it.title} loading="lazy" referrerpolicy="no-referrer" onError=${() => (src !== it.url ? setSrc(it.url) : null)} />
    ${it.title && html`<span>${it.title}</span>`}</button>`;
}

export function CoverPicker({ onClose }) {
  const { entries, profile } = useStore();
  const [tab, setTab] = useState('mine');
  const [sel, setSel] = useState(profile?.coverURL || '');
  const [pos, setPos] = useState(profile?.coverPos ?? 35);
  const [accent, setAccent] = useState(profile?.accent || ACCENTS[0]);
  const [q, setQ] = useState('');
  const [found, setFound] = useState(null);
  const [extra, setExtra] = useState([]);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  // De tu diario: fondos panorámicos primero y luego portadas.
  const mine = useMemo(() => {
    const seen = new Set(); const out = [];
    const push = (u, title, wide) => { if (u && !seen.has(u)) { seen.add(u); out.push({ url: u, title, wide }); } };
    const sorted = [...entries].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    sorted.forEach((e) => push(e.backdrop, e.title, true));
    extra.forEach((x) => push(x.url, x.title, true));
    sorted.forEach((e) => push(e.cover, e.title, false));
    return out.slice(0, 120);
  }, [entries, extra]);
  // Series sin fondo guardado: se piden a TVMaze las imágenes panorámicas de las mejor valoradas.
  useEffect(() => {
    const need = entries.filter((e) => e.type === 'series' && !e.backdrop && e.ids?.tvmaze).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 8);
    Promise.all(need.map((e) => showBackdrops(e.ids.tvmaze, e.title).then((l) => l.slice(0, 2)).catch(() => []))).then((l) => setExtra(l.flat()));
  }, []);
  const search = useMemo(() => debounce((v) => { setFound(null); backdropSearch(v).then(setFound).catch(() => setFound([])); }, 450), []);

  async function save() {
    setBusy(true);
    try {
      await updateMyProfile({ coverURL: sel, coverPos: Number(pos), accent });
      sfx.chime(); flash('Perfil actualizado', accent); onClose();
    } catch (x) { toast(x.message, 'err'); } finally { setBusy(false); }
  }
  const pick = (it) => { setSel(it.url); sfx.tick(2); };
  const list = tab === 'mine' ? mine : found;

  return html`<${Modal} kicker="Personalizar perfil" title="Portada y color" width=${980} onClose=${onClose}
    actions=${html`<button class="btn ghost" onClick=${() => setSel('')}>Sin portada</button><button class="btn" disabled=${busy} onClick=${save}>${busy ? 'Guardando…' : 'Guardar'}</button>`}>
    <div class=${'cprev' + (sel ? '' : ' none')} style=${`--pc:${accent}`}>
      ${sel && html`<img src=${img(sel, 1400)} alt="" style=${`object-position:50% ${pos}%`} referrerpolicy="no-referrer" onError=${(e) => { if (e.currentTarget.src !== sel) e.currentTarget.src = sel; }} />`}
      <i style=${`background:${accent}`}></i>
    </div>
    ${sel && html`<div class="field" style="max-width:420px;margin-bottom:18px"><label>Encuadre vertical</label>
      <input type="range" min="0" max="100" value=${pos} onInput=${(e) => setPos(e.currentTarget.value)} /></div>`}
    <div class="field" style="margin-bottom:22px"><label>Color de acento</label>
      <div class="swatches">${ACCENTS.map((c) => html`<button type="button" key=${c} class=${accent === c ? 'on' : ''} style=${`--sw:${c}`} aria-label=${c} onClick=${() => { setAccent(c); sfx.tick(4); }}></button>`)}</div></div>
    <${Tabs} value=${tab} onChange=${setTab} options=${[{ value: 'mine', label: 'De tu diario', n: mine.length }, { value: 'search', label: 'Buscar imágenes', c: 'var(--teal)' }, { value: 'url', label: 'URL', c: 'var(--purple)' }]} />
    <div style="margin-top:18px">
      ${tab === 'search' && html`<input class="input" style="margin-bottom:14px" placeholder="Busca una serie o película: Severance, Dune, The Bear…" value=${q} autofocus
        onInput=${(e) => { setQ(e.currentTarget.value); search(e.currentTarget.value); }} />`}
      ${tab === 'url' ? html`<div class="row" style="--g:10px"><input class="input grow" placeholder="https://…" value=${url} onInput=${(e) => setUrl(e.currentTarget.value)} />
          <button class="btn" disabled=${!/^https?:\/\//.test(url.trim())} onClick=${() => setSel(url.trim())}>Usar</button></div>`
        : tab === 'search' && !q.trim() ? html`<p class="muted">Imágenes panorámicas de TVMaze y pósters de películas.</p>`
        : list === null ? html`<${Spinner} />`
        : !list.length ? html`<p class="muted">${tab === 'mine' ? 'Añade series y películas a tu diario para usar sus imágenes.' : 'Sin imágenes para esa búsqueda.'}</p>`
        : html`<div class="cover-grid">${list.map((it) => html`<${CoverTile} key=${it.url} it=${it} on=${sel === it.url} onPick=${pick} />`)}</div>`}
    </div>
  </${Modal}>`;
}

export function FavoritePicker({ slot, onClose }) {
  const { entries, profile } = useStore();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const favs = profile?.favorites || [];
  const list = entries.filter((e) => (!type || e.type === type) && (!q || e.title.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 60);
  async function choose(e) {
    const next = [...favs];
    next[slot] = { id: e.id, title: e.title, type: e.type, cover: e.cover || '', year: e.year || null };
    try { await updateMyProfile({ favorites: next.filter(Boolean).slice(0, 4) }); sfx.pop(); onClose(); } catch (x) { toast(x.message, 'err'); }
  }
  return html`<${Modal} kicker="Top 4" title="Elige un favorito" width=${860} onClose=${onClose}>
    <div class="row" style="--g:10px;margin-bottom:16px"><input class="input grow" placeholder="Busca en tu diario…" value=${q} autofocus onInput=${(e) => setQ(e.currentTarget.value)} />
      <${Seg} value=${type} onChange=${setType} options=${[{ value: '', label: 'Todo' }, ...Object.values(TYPES).map((t) => ({ value: t.key, label: t.plural, c: t.color }))]} /></div>
    <div class="grid" style="--min:110px;gap:16px 12px;max-height:56vh;overflow:auto">${list.map((e) => html`<button key=${e.id} type="button" class="favpick" onClick=${() => choose(e)}>
      <${Cover} src=${e.cover} title=${e.title} type=${e.type} w=${220} /><span>${e.title}</span></button>`)}</div>
    ${!list.length && html`<p class="muted">Nada con ese filtro.</p>`}
  </${Modal}>`;
}

export function Top4({ favorites = [], editable = false }) {
  const { profile } = useStore();
  const [slot, setSlot] = useState(null);
  const favs = [...favorites];
  async function remove(i) {
    const next = favs.filter((_, j) => j !== i);
    try { await updateMyProfile({ favorites: next }); sfx.click(); } catch (x) { toast(x.message, 'err'); }
  }
  if (!editable && !favs.length) return null;
  return html`<div class="top4">
    ${[0, 1, 2, 3].map((i) => favs[i] ? html`<div style="position:relative" key=${i}>
        <a href=${editable ? `#/item/${favs[i].id}` : `#/search?type=${favs[i].type}&q=${encodeURIComponent(favs[i].title)}`} title=${favs[i].title}><${Cover} src=${favs[i].cover} title=${favs[i].title} type=${favs[i].type} w=${360} /></a>
        ${editable && html`<button class="btn icon glass x" title="Quitar" aria-label="Quitar" onClick=${() => remove(i)}><${Icon} name="close" size=${14} /></button>`}</div>`
      : editable ? html`<button key=${i} class="slot" onClick=${() => setSlot(favs.length)}>+ FAVORITO</button>` : html`<div key=${i}></div>`)}
    ${slot !== null && html`<${FavoritePicker} slot=${slot} onClose=${() => setSlot(null)} />`}
  </div>`;
}
