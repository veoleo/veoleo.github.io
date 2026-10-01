// Buscador de metadatos multi-fuente.
import { html, useState, useEffect, useRef } from 'preact-standalone';
import { PosterCard, Seg, Empty, SkeletonGrid, LazyProviders } from '../components/ui.js';
import { PreviewModal, findExisting } from '../components/preview.js';
import { EntryForm } from '../components/entry-form.js';
import { searchMedia, SOURCES, hasTmdb } from '../lib/metadata.js';
import { useStore } from '../lib/store.js';
import { setQuery } from '../lib/router.js';
import { TYPES, humanDate } from '../lib/utils.js';
import { sfx } from '../lib/sound.js';

const TYPE_OPTS = [
  { value: 'series', label: '📺 Series', c: 'var(--blue)', fg: 'var(--paper-2)' },
  { value: 'movie', label: '🎬 Películas', c: 'var(--red)', fg: 'var(--paper-2)' },
  { value: 'book', label: '📖 Libros', c: 'var(--yellow)' },
  { value: 'audiobook', label: '🎧 Audiolibros', c: 'var(--teal)', fg: 'var(--paper-2)' },
];
const HINTS = {
  series: 'Severance, The Bear, La casa de papel…', movie: 'Dune, La sociedad de la nieve, Perfect Days…',
  book: 'Proyecto Hail Mary, Sapiens, autor o ISBN…', audiobook: 'Hábitos atómicos, Brandon Sanderson…',
};

export function SearchPage({ route }) {
  const { settings, entries } = useStore();
  const [type, setType] = useState(route.query.type || 'series');
  const [q, setQ] = useState(route.query.q || '');
  const [res, setRes] = useState({ loading: false, items: [], q: '' });
  const [preview, setPreview] = useState(null);
  const [manual, setManual] = useState(null);
  const inputRef = useRef();
  const reqId = useRef(0);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    setQuery({ type, q });
    const query = q.trim();
    if (query.length < 2) { setRes({ loading: false, items: [], q: '' }); return; }
    const id = ++reqId.current;
    setRes((r) => ({ ...r, loading: true }));
    const t = setTimeout(async () => {
      const items = await searchMedia(type, query, settings).catch(() => []);
      if (id === reqId.current) { setRes({ loading: false, items, q: query }); if (items.length) sfx.pop(); }
    }, 380);
    return () => clearTimeout(t);
  }, [q, type]);

  const T = TYPES[type];
  return html`
    <div class="page wrap">
      <h1 class="mega">Busca <span class="mark ${type === 'book' ? '' : type === 'audiobook' ? 'teal' : type === 'movie' ? 'red' : 'blue'} tilt-l">${T.plural.toLowerCase()}</span></h1>
      <p class="muted" style="font-size:1.1rem;margin:14px 0 26px">Metadatos de ${type === 'series' ? (hasTmdb(settings) ? 'TMDB, TVMaze e IMDb' : 'TVMaze e IMDb') : type === 'movie' ? (hasTmdb(settings) ? 'TMDB e IMDb' : 'IMDb + Wikidata') : type === 'book' ? 'Google Books y Open Library' : 'Apple Books y Google Books'}: portada, sinopsis, tráiler, banda sonora y dónde verlo.</p>
      <div class="stack" style="--g:18px">
        <${Seg} options=${TYPE_OPTS} value=${type} onChange=${(v) => { setType(v); inputRef.current?.focus(); }} />
        <div class="row" style="--g:12px">
          <input ref=${inputRef} class="input big grow" type="search" placeholder=${HINTS[type]} value=${q}
            onInput=${(e) => setQ(e.currentTarget.value)} aria-label="Buscar" />
          <button class="btn" onClick=${() => setManual({ type, title: q, source: 'manual', genres: [], creators: [] })}>✎ Crear a mano</button>
        </div>
      </div>

      <div class="section" style="margin-top:34px">
        ${res.loading && !res.items.length ? html`<${SkeletonGrid} n=${10} />`
          : res.items.length ? html`
            <div class="grid" style=${res.loading ? 'opacity:.6' : ''}>
              ${res.items.map((it) => {
                const ex = findExisting(entries, it);
                return html`<${PosterCard} key=${it.source + it.sourceId} e=${ex ? { ...it, status: ex.status, rating: ex.rating } : it}
                  href="javascript:void 0" onClick=${(ev) => { ev.preventDefault(); setPreview(it); }}
                  sub=${[it.year, it.releaseDate && it.releaseDate.length === 10 ? humanDate(it.releaseDate) : null, (it.creators || [])[0] || it.network].filter(Boolean).slice(0, 2).join(' · ')}
                  extra=${html`<div class="row" style="--g:6px;margin-top:6px">
                    <span class="badge" style=${`--c:${SOURCES[it.source]?.color};font-size:.62rem`}>${SOURCES[it.source]?.name}</span>
                    ${(type === 'series' || type === 'movie') && html`<${LazyProviders} item=${it} />`}
                  </div>`} />`;
              })}
            </div>`
          : res.q ? html`<${Empty} word="¡NADA!" title=${`Sin resultados para “${res.q}”`} sub="Prueba con el título original o créalo a mano.">
              <button class="btn yellow" onClick=${() => setManual({ type, title: res.q, source: 'manual' })}>✎ Crear “${res.q}” a mano</button></${Empty}>`
          : html`<${Empty} word="¿QUÉ TOCA?" title="Escribe un título para empezar" sub="Tus resultados aparecerán aquí con su portada." />`}
      </div>
      ${preview && html`<${PreviewModal} item=${preview} onClose=${() => setPreview(null)} />`}
      ${manual && html`<${EntryForm} draft=${manual} onClose=${() => setManual(null)} />`}
    </div>`;
}
