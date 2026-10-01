// Buscador de metadatos multi-fuente.
import { html, useState, useEffect, useRef } from 'preact-standalone';
import { PosterCard, Tabs, SkeletonGrid, Icon } from '../components/ui.js';
import { PreviewModal, findExisting } from '../components/preview.js';
import { EntryForm } from '../components/entry-form.js';
import { searchMedia, SOURCES } from '../lib/metadata.js';
import { useStore } from '../lib/store.js';
import { setQuery } from '../lib/router.js';
import { TYPES } from '../lib/utils.js';
import { sfx } from '../lib/sound.js';

const TYPE_OPTS = [
  { value: 'series', label: 'Series', c: 'var(--blue)' },
  { value: 'movie', label: 'Películas', c: 'var(--red)' },
  { value: 'book', label: 'Libros', c: 'var(--yellow)' },
  { value: 'audiobook', label: 'Audiolibros', c: 'var(--teal)' },
];
const HINTS = { series: 'Severance', movie: 'Dune', book: 'Proyecto Hail Mary', audiobook: 'Hábitos atómicos' };
const FROM = { series: 'TVMaze · IMDb · Wikidata', movie: 'IMDb · Wikidata · Apple', book: 'Google Books · Open Library', audiobook: 'Apple Books · Google Books' };

export function SearchPage({ route }) {
  const { settings, entries } = useStore();
  const [type, setType] = useState(route.query.type || 'series');
  const [q, setQ] = useState(route.query.q || '');
  const [res, setRes] = useState({ loading: false, items: [], q: '' });
  const [preview, setPreview] = useState(null);
  const [manual, setManual] = useState(null);
  const inputRef = useRef();
  const reqId = useRef(0);

  useEffect(() => { inputRef.current?.focus(); }, [type]);
  useEffect(() => {
    setQuery({ type, q });
    const query = q.trim();
    if (query.length < 2) { setRes({ loading: false, items: [], q: '' }); return; }
    const id = ++reqId.current;
    setRes((r) => ({ ...r, loading: true }));
    const t = setTimeout(async () => {
      const items = await searchMedia(type, query, settings).catch(() => []);
      if (id === reqId.current) { setRes({ loading: false, items, q: query }); if (items.length) sfx.pop(); }
    }, 350);
    return () => clearTimeout(t);
  }, [q, type]);

  const T = TYPES[type];
  return html`
    <div class="page wrap">
      <div class="kicker" style=${`--c:${T.color}`}>Buscar ${T.plural.toLowerCase()} · ${FROM[type]}</div>
      <form onSubmit=${(e) => { e.preventDefault(); if (res.items[0]) setPreview(res.items[0]); }} style="margin-top:28px">
        <input ref=${inputRef} class="input xl" type="search" placeholder=${HINTS[type] + '…'} value=${q}
          onInput=${(e) => setQ(e.currentTarget.value)} aria-label="Buscar" autocomplete="off" spellcheck="false" />
      </form>
      <div class="row between" style="margin-top:8px">
        <div style="flex:1;min-width:300px"><${Tabs} options=${TYPE_OPTS} value=${type} onChange=${setType} /></div>
        <button class="btn ghost sm" onClick=${() => setManual({ type, title: q, source: 'manual', genres: [], creators: [] })}><${Icon} name="edit" size=${14} /> Crear a mano</button>
      </div>

      <div style="margin-top:44px">
        ${res.loading && !res.items.length ? html`<${SkeletonGrid} n=${12} />`
          : res.items.length ? html`
            <div class="row between" style="margin-bottom:24px"><span class="count">${res.items.length} RESULTADOS PARA “${res.q.toUpperCase()}”</span>${res.loading && html`<span class="loader inline"><i></i><i></i><i></i></span>`}</div>
            <div class="grid" style=${res.loading ? 'opacity:.5;transition:opacity .3s' : 'transition:opacity .3s'}>
              ${res.items.map((it) => {
                const ex = findExisting(entries, it);
                return html`<${PosterCard} key=${it.source + it.sourceId} e=${ex ? { ...it, status: ex.status, rating: ex.rating } : it} showStatus=${!!ex}
                  href="javascript:void 0" onClick=${(ev) => { ev.preventDefault(); setPreview(it); }}
                  sub=${[it.year, (it.creators || [])[0] || it.network].filter(Boolean).join(' · ')}
                  extra=${html`<span class="tag" style=${`--c:${SOURCES[it.source]?.color}`}>${SOURCES[it.source]?.name}</span>`} />`;
              })}
            </div>`
          : res.q ? html`<div class="empty"><div class="kicker">Sin resultados</div><h2 class="h1" style="margin:16px 0">Nada para “${res.q}”</h2>
              <p class="lead">Prueba con el título original o créalo a mano: podrás añadir portada, tráiler y todo lo demás.</p>
              <div class="row" style="margin-top:24px"><button class="btn" onClick=${() => setManual({ type, title: res.q, source: 'manual' })}><${Icon} name="plus" /> Crear “${res.q}”</button></div></div>`
          : html`<p class="lead" style="margin-top:20px">Escribe un título. Enter abre el primer resultado.</p>`}
      </div>
      ${preview && html`<${PreviewModal} item=${preview} onClose=${() => setPreview(null)} />`}
      ${manual && html`<${EntryForm} draft=${manual} onClose=${() => setManual(null)} />`}
    </div>`;
}
