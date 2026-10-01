// Vista previa de un resultado de búsqueda / novedad antes de añadirlo.
import { html, useState, useEffect } from 'preact-standalone';
import { Modal, Cover, Providers, Spinner, Icon, TypeBadge, ShareButtons } from './ui.js';
import { Trailer, Soundtrack, CastRow, AudioPreview } from './media.js';
import { EntryForm } from './entry-form.js';
import { enrich, toEntryFields, deciderUrl, justwatchUrl, SOURCES } from '../lib/metadata.js';
import { createEntry } from '../lib/db.js';
import { useStore, toast } from '../lib/store.js';
import { TYPES, humanDate, fmtDuration } from '../lib/utils.js';
import { sfx } from '../lib/sound.js';
import { flash } from '../lib/fx.js';
import { go } from '../lib/router.js';

export function findExisting(entries, d) {
  const t = String(d.title || '').toLowerCase();
  return entries.find((e) => e.type === d.type && (
    (d.tmdbId && e.ids?.tmdb === d.tmdbId) || (d.tvmazeId && e.ids?.tvmaze === d.tvmazeId) || (d.imdbId && (e.ids?.imdb || e.imdbId) === d.imdbId)
    || (d.itunesId && e.ids?.itunes === d.itunesId)
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
      flash(isScreen ? 'Must watch' : 'Por leer', '#ff5fae'); sfx.chime();
      onClose(); go(`item/${id}`);
    } catch (e) { toast('No se pudo guardar: ' + e.message, 'err'); }
  }

  return html`
    <${Modal} kicker=${d.source && SOURCES[d.source] ? 'Fuente · ' + SOURCES[d.source].name : 'Vista previa'} title=${T.label} onClose=${onClose} color=${T.color} width=${1040} flush>
      <div class="hero in-modal" style=${`--c:${T.color}`}>
        ${(d.backdrop || d.cover) && html`<div class="bg"><img src=${d.backdrop || d.cover} alt="" style=${d.backdrop ? '' : 'filter:blur(30px) saturate(1.2);transform:scale(1.3)'} /></div>`}
        <div class="wrap">
          <div class="hero-inner">
            <div class="hero-poster" style="width:clamp(120px,15vw,190px)"><${Cover} src=${d.cover} title=${d.title} type=${d.type} /></div>
            <div class="stack" style="--g:16px">
              <div class="meta-line"><${TypeBadge} type=${d.type} />
                ${d.year && html`<span class="sub">${d.year}</span>`}
                ${d.runtime && html`<span class="sub">${fmtDuration(d.runtime)}</span>`}
                ${d.seasons && html`<span class="sub">${d.seasons} temporadas</span>`}
              </div>
              <h2 class="hero-title">${d.title}</h2>
              ${d.creators?.length > 0 && html`<div class="sub">${d.type === 'movie' ? 'Dirección' : d.type === 'series' ? 'Creación' : 'Autoría'} · ${d.creators.join(', ')}</div>`}
              ${d.genres?.length > 0 && html`<div class="row" style="--g:16px">${d.genres.map((g) => html`<span class="tag plain">${g}</span>`)}</div>`}
            </div>
          </div>
        </div>
      </div>

      <div style="padding:28px">
        <div class="row between">
          <div class="row">
            ${existing
              ? html`<a class="btn lg" href=${`#/item/${existing.id}`} onClick=${onClose}><${Icon} name="check" /> Ya está en tu diario</a>`
              : html`<button class="btn lg" onClick=${() => { setForm(true); sfx.pop(); }}><${Icon} name="plus" /> Añadir</button>
                     <button class="btn lg ghost" onClick=${quickAdd}>${isScreen ? 'Must watch' : d.type === 'audiobook' ? 'Por escuchar' : 'Por leer'}</button>`}
          </div>
          ${loading ? html`<span class="row label"><span class="loader inline"><i></i><i></i><i></i></span> Cargando tráiler, banda sonora y ficha</span>`
            : d.externalUrl && html`<${ShareButtons} title=${d.title} url=${d.externalUrl} />`}
        </div>

        <div class="cols-2" style="margin-top:40px">
          <div class="stack" style="--g:40px">
            ${d.overview ? html`<p class="prose" style="margin:0;font-size:1.1rem;color:var(--text)">${d.overview}</p>` : loading ? html`<div class="skeleton" style="height:120px"></div>` : ''}
            ${d.type === 'audiobook' && html`<${AudioPreview} src=${d.audioPreview} />`}
            ${isScreen && html`<div class="stack" style="--g:16px"><span class="label">Tráiler</span>${loading && !d.trailer ? html`<div class="skeleton" style="aspect-ratio:16/9"></div>` : html`<${Trailer} e=${d} />`}</div>`}
            ${isScreen && (d.soundtrack || d.composer) && html`<div class="stack" style="--g:16px"><span class="label">Banda sonora</span><${Soundtrack} e=${d} /></div>`}
            ${d.cast?.length > 0 && html`<div class="stack" style="--g:16px"><span class="label">Reparto</span><${CastRow} cast=${d.cast} /></div>`}
          </div>
          <aside class="stack" style="--g:28px">
            <dl class="kv">
              ${d.releaseDate && html`<dt>Estreno</dt><dd>${humanDate(d.releaseDate)}</dd>`}
              ${d.nextEpisode?.airdate && html`<dt>Próximo</dt><dd>${d.nextEpisode.code} · ${humanDate(d.nextEpisode.airdate)}</dd>`}
              ${d.episodes && html`<dt>Episodios</dt><dd>${d.episodes}</dd>`}
              ${d.pages && html`<dt>Páginas</dt><dd>${d.pages}</dd>`}
              ${d.publisher && html`<dt>Editorial</dt><dd>${d.publisher}</dd>`}
              ${d.composer && html`<dt>Música</dt><dd>${d.composer}</dd>`}
              ${d.language && html`<dt>Idioma</dt><dd>${String(d.language).toUpperCase()}</dd>`}
            </dl>
            ${isScreen && html`<div class="stack" style="--g:14px">
              <span class="label">Dónde verlo</span>
              ${(d.providers?.flatrate?.length || d.network) ? html`<${Providers} e=${d} />` : html`<span class="muted small">${loading ? '…' : 'Consulta las plataformas en JustWatch.'}</span>`}
              <div class="row" style="--g:8px;margin-top:6px">
                <a class="btn sm glass" href=${deciderUrl(d)} target="_blank" rel="noopener">Stream it or skip it <${Icon} name="ext" size=${13} /></a>
                <a class="btn sm glass" href=${d.providers?.link || justwatchUrl(d)} target="_blank" rel="noopener">JustWatch <${Icon} name="ext" size=${13} /></a>
              </div>
            </div>`}
          </aside>
        </div>
        ${loading && !d.overview && html`<${Spinner} />`}
      </div>
    </${Modal}>`;
}
