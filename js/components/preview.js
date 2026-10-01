// Vista previa de un resultado de búsqueda / novedad antes de añadirlo.
import { html, useState, useEffect } from 'preact-standalone';
import { Modal, Cover, TypeBadge, Providers, Spinner } from './ui.js';
import { Trailer, Soundtrack, CastRow, AudioPreview } from './media.js';
import { EntryForm } from './entry-form.js';
import { enrich, toEntryFields, deciderUrl, justwatchUrl, SOURCES } from '../lib/metadata.js';
import { createEntry } from '../lib/db.js';
import { useStore, toast } from '../lib/store.js';
import { TYPES, humanDate, fmtDuration } from '../lib/utils.js';
import { sfx } from '../lib/sound.js';
import { onomato } from '../lib/fx.js';
import { go } from '../lib/router.js';

export function findExisting(entries, d) {
  const t = String(d.title || '').toLowerCase();
  return entries.find((e) => e.type === d.type && (
    (d.tmdbId && e.ids?.tmdb === d.tmdbId) || (d.tvmazeId && e.ids?.tvmaze === d.tvmazeId) || (d.imdbId && (e.ids?.imdb || e.imdbId) === d.imdbId)
    || (String(e.title).toLowerCase() === t && (!d.year || !e.year || e.year === d.year))
  ));
}

export function PreviewModal({ item, onClose }) {
  const { settings, entries } = useStore();
  const [d, setD] = useState(item);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(false);
  useEffect(() => {
    let alive = true;
    enrich(item, settings, (p) => alive && setD(p)).then((x) => { if (alive) { setD(x); setLoading(false); } }).catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [item.sourceId]);

  if (form) return html`<${EntryForm} draft=${d} onClose=${onClose} />`;
  const existing = findExisting(entries, d);
  const T = TYPES[d.type];
  const isScreen = d.type === 'series' || d.type === 'movie';

  async function quickAdd() {
    try {
      const id = await createEntry({ ...toEntryFields(d), status: 'planned', rating: 0, visibility: 'public', watchedEpisodes: [], hasNote: false, notePublic: false, startedAt: '', finishedAt: '' });
      onomato(window.innerWidth / 2, window.innerHeight / 2, '¡APUNTADO!', '#ee7ba8'); sfx.chime();
      toast(`${d.title} → ${isScreen ? 'Must watch' : 'Por leer'}`, 'ok');
      onClose(); go(`item/${id}`);
    } catch (e) { toast('No se pudo guardar: ' + e.message, 'err'); }
  }

  return html`
    <${Modal} title=${T.icon + ' ' + T.label} onClose=${onClose} color=${T.color} width=${980}>
      <div class="stack" style="--g:26px">
        <div class="hero" style=${`--c:${T.color};min-height:auto`}>
          ${d.backdrop && html`<div class="bg"><img src=${d.backdrop} alt="" /></div>`}
          <div class="hero-inner" style="padding:26px">
            <div class="hero-poster" style="width:clamp(130px,16vw,200px)"><${Cover} src=${d.cover} title=${d.title} type=${d.type} /></div>
            <div class="stack" style="--g:12px">
              <h2 class="hero-title" style="font-size:clamp(2rem,4.6vw,3.8rem)"><span>${d.title}</span></h2>
              <div class="meta-line">
                <${TypeBadge} type=${d.type} />
                ${d.year && html`<span class="badge" style="--c:var(--paper-2)">${d.year}</span>`}
                ${d.releaseDate && html`<span class="badge" style="--c:var(--paper-2)">📅 Estreno ${humanDate(d.releaseDate)}</span>`}
                ${d.runtime && html`<span class="badge" style="--c:var(--paper-2)">⏱ ${fmtDuration(d.runtime)}</span>`}
                ${d.seasons && html`<span class="badge" style="--c:var(--paper-2)">${d.seasons} temp.</span>`}
                ${d.source && SOURCES[d.source] && html`<span class="badge" style=${`--c:${SOURCES[d.source].color}`}>${SOURCES[d.source].name}</span>`}
              </div>
              ${d.genres?.length > 0 && html`<div class="row" style="--g:6px">${d.genres.map((g) => html`<span class="chip static" style="padding:4px 10px;font-size:.78rem">${g}</span>`)}</div>`}
              ${d.creators?.length > 0 && html`<p style="margin:0;font-weight:700;background:var(--paper-2);display:inline-block;padding:4px 10px;border:2.5px solid var(--ink);border-radius:10px;width:fit-content">${d.type === 'movie' ? '🎬' : d.type === 'series' ? '✍️' : '🖋'} ${d.creators.join(', ')}</p>`}
            </div>
          </div>
        </div>

        <div class="row between">
          <div class="row">
            ${existing
              ? html`<a class="btn big teal" href=${`#/item/${existing.id}`} onClick=${onClose}>✓ Ya está en tu diario</a>`
              : html`<button class="btn big red" onClick=${() => { setForm(true); sfx.pop(); }}>＋ Añadir a mi diario</button>
                     <button class="btn big pink" onClick=${quickAdd}>✦ ${isScreen ? 'Must watch' : d.type === 'audiobook' ? 'Por escuchar' : 'Por leer'}</button>`}
          </div>
          ${loading && html`<span class="row small muted"><span class="spinner" style="width:24px;height:24px;border-width:4px;margin:0"></span> Buscando tráiler, plataformas y banda sonora…</span>`}
        </div>

        ${isScreen && html`
          <div class="panel" style="padding:18px">
            <div class="row between">
              <div class="stack" style="--g:8px">
                <span class="label">Dónde verlo ${d.providers?.region ? `(${d.providers.region})` : ''}</span>
                ${(d.providers?.flatrate?.length || d.network) ? html`<${Providers} e=${d} /> ` : html`<span class="muted small">${loading ? '…' : 'Sin datos de streaming. Pon tu clave TMDB en Ajustes para verlo por plataforma.'}</span>`}
                ${d.nextEpisode?.airdate && html`<span class="small"><b>Próximo episodio:</b> ${d.nextEpisode.code} · ${humanDate(d.nextEpisode.airdate)}</span>`}
              </div>
              <div class="row" style="--g:8px">
                <a class="btn sm yellow" href=${deciderUrl(d)} target="_blank" rel="noopener">Stream It or Skip It ↗</a>
                <a class="btn sm" href=${d.providers?.link || justwatchUrl(d)} target="_blank" rel="noopener">JustWatch ↗</a>
              </div>
            </div>
          </div>`}

        ${d.overview && html`<div><h3 class="h3" style="margin-bottom:10px">Sinopsis</h3><p class="prose" style="margin:0">${d.overview}</p></div>`}
        ${d.type === 'audiobook' && html`<${AudioPreview} src=${d.audioPreview} />`}
        ${isScreen && html`<div><h3 class="h3" style="margin-bottom:12px">🎬 Tráiler</h3>${loading && !d.trailer ? html`<div class="skeleton" style="aspect-ratio:16/9"></div>` : html`<${Trailer} e=${d} />`}</div>`}
        ${isScreen && (d.soundtrack || d.composer) && html`<div><h3 class="h3" style="margin-bottom:12px">🎵 Banda sonora</h3><${Soundtrack} e=${d} /></div>`}
        ${d.cast?.length > 0 && html`<div><h3 class="h3" style="margin-bottom:12px">🎭 Reparto</h3><${CastRow} cast=${d.cast} /></div>`}
        ${loading && !d.overview && html`<${Spinner} />`}
      </div>
    </${Modal}>`;
}
