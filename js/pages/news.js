// Noticias de series, cine y plataformas: agregadas cada hora por GitHub Actions (data/news.json).
import { html, useState, useMemo } from 'preact-standalone';
import { useAsync, Chip, Spinner, ShareButtons, Tabs, Icon, Scramble } from '../components/ui.js';
import { useStore, toast } from '../lib/store.js';
import { toggleSavedNews } from '../lib/db.js';
import { timeAgo, img } from '../lib/utils.js';
import { setQuery } from '../lib/router.js';
import { sfx } from '../lib/sound.js';
import { burstAt } from '../lib/fx.js';

let newsPromise = null;
export function loadNews(force = false) {
  if (!newsPromise || force) {
    const bust = Math.floor(Date.now() / 600000); // cambia cada 10 min
    newsPromise = fetch(`./data/news.json?v=${bust}`).then((r) => (r.ok ? r.json() : { items: [], sources: [] })).catch(() => ({ items: [], sources: [] }));
  }
  return newsPromise;
}

const CATS = { series: 'Series', cine: 'Cine', plataformas: 'Plataformas' };
const CAT_C = { series: 'var(--blue)', cine: 'var(--red)', plataformas: 'var(--teal)' };
function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }

function SaveButton({ n }) {
  const { savedNews } = useStore();
  const saved = (savedNews || []).some((x) => x.id === n.id);
  return html`<button class=${'savebtn' + (saved ? ' on' : '')} title=${saved ? 'Quitar de guardadas' : 'Guardar'} aria-pressed=${saved} onClick=${async (e) => {
    e.preventDefault(); e.stopPropagation();
    const el = e.currentTarget;
    try { const on = await toggleSavedNews(n); if (on) { sfx.pop(); burstAt(el, { count: 8, spread: 36 }); } else sfx.click(); }
    catch (x) { toast('No se pudo guardar: ' + x.message, 'err'); }
  }}><${Icon} name="bookmark" size=${16} /></button>`;
}

export function NewsCard({ n }) {
  return html`<article class="news-item reveal in">
    <a href=${n.link} target="_blank" rel="noopener">
      <div class="img">${n.image ? html`<img src=${img(n.image, 640)} alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onError=${(e) => { const el = e.currentTarget; if (el.dataset.f) el.style.display = 'none'; else { el.dataset.f = 1; el.src = n.image; } }} />` : html`<div class="gen-poster" style="--gc:var(--blue)"><span>${n.sourceName}</span><b>${n.sourceName}</b></div>`}</div>
      <span class="tag" style=${`--c:${CAT_C[n.cat] || 'var(--accent)'}`}>${n.sourceName} · ${timeAgo(n.date * 1000)}</span>
      <h3>${n.title}</h3>
      ${n.summary && html`<p>${n.summary}</p>`}
    </a>
    <div class="src"><span class="count">${CATS[n.cat] ? CATS[n.cat].toUpperCase() + ' · ' : ''}${host(n.link)}</span><div class="row" style="--g:0"><${SaveButton} n=${n} /><${ShareButtons} title=${n.title} url=${n.link} /></div></div>
  </article>`;
}

export function NewsPage({ route }) {
  const st = useAsync(() => loadNews(), []);
  const { savedNews } = useStore();
  const [cat, setCat] = useState(route.query.cat || 'all');
  const [lang, setLang] = useState(route.query.lang || '');
  const [src, setSrc] = useState(route.query.src || '');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(30);
  const data = st.data || { items: [], sources: [] };
  const pool = cat === 'saved' ? (savedNews || []) : data.items;

  const items = useMemo(() => pool.filter((n) =>
    (cat === 'all' || cat === 'saved' || n.cat === cat) && (!lang || n.lang === lang) && (!src || n.source === src)
    && (!q || (n.title + ' ' + (n.summary || '')).toLowerCase().includes(q.toLowerCase()))), [pool, cat, lang, src, q]);
  const sources = data.sources.filter((s) => (!lang || s.lang === lang) && (cat === 'all' || cat === 'saved' || s.cat === cat || s.cat === 'mixto'));
  const [top, ...rest] = items;
  const upd = (patch) => { const n = { cat, lang, src, ...patch }; setQuery({ cat: n.cat === 'all' ? '' : n.cat, lang: n.lang, src: n.src }); };
  const count = (c) => data.items.filter((x) => x.cat === c).length;

  return html`<div class="page wrap">
    <div class="page-head">
      <div>
        <div class="kicker">${data.sources.length} medios · actualizado ${data.generatedAt ? timeAgo(data.generatedAt * 1000) : '…'}</div>
        <h1 class="display" style="margin-top:20px"><${Scramble} text="Noticias" /></h1>
      </div>
      <input class="input" style="max-width:340px" placeholder="Buscar en noticias…" value=${q} onInput=${(e) => setQ(e.currentTarget.value)} />
    </div>

    <${Tabs} value=${cat} onChange=${(v) => { setCat(v); setSrc(''); setLimit(30); upd({ cat: v, src: '' }); }} options=${[
      { value: 'all', label: 'Todo', n: data.items.length },
      { value: 'series', label: 'Series', n: count('series'), c: 'var(--blue)' },
      { value: 'cine', label: 'Cine', n: count('cine'), c: 'var(--red)' },
      { value: 'plataformas', label: 'Plataformas', n: count('plataformas'), c: 'var(--teal)' },
      { value: 'saved', label: 'Guardadas', n: (savedNews || []).length, c: 'var(--yellow)' }]} />
    <div class="filters" style="border-top:0;margin-bottom:48px">
      <div class="filter-row"><span class="label">Idioma</span>
        ${[['', 'Todos'], ['es', 'Español'], ['en', 'Internacional']].map(([v, l]) => html`<${Chip} key=${v} on=${lang === v} onClick=${() => { setLang(v); setSrc(''); upd({ lang: v, src: '' }); }}>${l}</${Chip}>`)}
      </div>
      ${cat !== 'saved' && html`<div class="filter-row"><span class="label">Medio</span>
        <${Chip} on=${!src} onClick=${() => { setSrc(''); upd({ src: '' }); }}>Todos</${Chip}>
        ${sources.map((s) => html`<${Chip} key=${s.id} on=${src === s.id} onClick=${() => { const v = src === s.id ? '' : s.id; setSrc(v); upd({ src: v }); }}>${s.name}</${Chip}>`)}
      </div>`}
    </div>

    ${st.loading ? html`<${Spinner} />` : !items.length ? html`<p class="lead">${cat === 'saved' ? 'Aún no has guardado noticias. Pulsa el marcador de cualquier noticia para tenerla aquí.' : 'No hay noticias con esos filtros.'}</p>` : html`
      ${top && html`<div class="news-feature">
        <a class="img" href=${top.link} target="_blank" rel="noopener">${top.image && html`<img src=${img(top.image, 1100)} alt="" decoding="async" referrerpolicy="no-referrer" onError=${(e) => { const el = e.currentTarget; if (!el.dataset.f) { el.dataset.f = 1; el.src = top.image; } }} />`}</a>
        <div class="stack" style="--g:18px">
          <span class="tag" style=${`--c:${CAT_C[top.cat] || 'var(--accent)'}`}>${top.sourceName} · ${timeAgo(top.date * 1000)}</span>
          <a href=${top.link} target="_blank" rel="noopener" style="text-decoration:none"><h2>${top.title}</h2></a>
          ${top.summary && html`<p class="lead" style="font-size:1rem">${top.summary}</p>`}
          <div class="row between"><a class="btn ghost sm" href=${top.link} target="_blank" rel="noopener">Leer en ${top.sourceName} <${Icon} name="ext" size=${13} /></a>
            <div class="row" style="--g:0"><${SaveButton} n=${top} /><${ShareButtons} title=${top.title} url=${top.link} /></div></div>
        </div>
      </div>`}
      <div class="news" style="margin-top:72px">${rest.slice(0, limit).map((n) => html`<${NewsCard} key=${n.id} n=${n} />`)}</div>
      ${rest.length > limit && html`<div class="row" style="justify-content:center;margin-top:56px"><button class="btn ghost lg" onClick=${() => setLimit(limit + 30)}>Cargar más</button></div>`}
    `}
  </div>`;
}
