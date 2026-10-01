// Ficha de una entrada: héroe, estrellas, episodios, nota, tráiler, banda sonora, reparto y comentarios.
import { html, useState, useEffect } from 'preact-standalone';
import { Stars, Cover, TypeBadge, StatusBadge, Providers, Avatar, Empty, Spinner, Modal } from '../components/ui.js';
import { Trailer, Soundtrack, CastRow, AudioPreview } from '../components/media.js';
import { EpisodesPanel } from '../components/episodes.js';
import { NoteEditor, LikeButton, Comments } from '../components/social.js';
import { EntryForm } from '../components/entry-form.js';
import { watchEntry, updateEntry, deleteEntry, getNote } from '../lib/db.js';
import { useStore, toast } from '../lib/store.js';
import { enrich, deciderUrl, justwatchUrl, nextEpisodeOf } from '../lib/metadata.js';
import { exportEntry, entryToMarkdown } from '../lib/markdown.js';
import { TYPES, humanDate, fmtDuration } from '../lib/utils.js';
import { sfx } from '../lib/sound.js';
import { go } from '../lib/router.js';

export function ItemPage({ id }) {
  const st = useStore();
  const own = st.entries.find((x) => x.id === id);
  const [remote, setRemote] = useState(undefined);
  const [edit, setEdit] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (own) return;
    setRemote(undefined);
    return watchEntry(id, setRemote, () => setRemote(null));
  }, [id, !!own]);

  const e = own || remote;
  const mine = !!own;

  // refresca el próximo episodio de series en curso (1 vez por visita)
  useEffect(() => {
    if (!mine || e?.type !== 'series' || e.status === 'abandoned') return;
    nextEpisodeOf(e, st.settings).then((n) => {
      if (JSON.stringify(n || null) !== JSON.stringify(e.nextEpisode || null)) updateEntry(e.id, { nextEpisode: n || null }).catch(() => {});
    }).catch(() => {});
  }, [id, mine]);

  if (e === undefined) return html`<div class="page wrap"><${Spinner} /></div>`;
  if (!e) return html`<div class="page wrap"><${Empty} word="¡PUF!" title="Esta entrada no existe o es privada."><a class="btn" href="#/">Volver al inicio</a></${Empty}></div>`;

  const T = TYPES[e.type] || TYPES.series;
  const isScreen = e.type === 'series' || e.type === 'movie';
  const isBook = !isScreen;
  const c = e.consumption || {};

  async function rate(v) {
    try { await updateEntry(e.id, { rating: v }); } catch (x) { toast(x.message, 'err'); }
  }
  async function doExport(copy) {
    const note = await getNote(e.id);
    if (copy) {
      const md = await entryToMarkdown(e, note, st.settings);
      await navigator.clipboard.writeText(md); toast('Markdown copiado al portapapeles', 'ok'); sfx.pop();
    } else { await exportEntry(e, note, st.settings); sfx.whoosh(); toast('Nota .md descargada', 'ok'); }
  }
  async function refresh() {
    setRefreshing(true);
    try {
      const src = { ...e, source: e.source?.name, sourceId: e.source?.id, tmdbId: e.ids?.tmdb, tvmazeId: e.ids?.tvmaze };
      const d = await enrich(src, st.settings);
      const patch = {};
      for (const k of ['cover', 'backdrop', 'overview', 'genres', 'creators', 'cast', 'trailer', 'soundtrack', 'composer', 'providers', 'nextEpisode', 'seasons', 'episodes', 'releaseDate', 'lastAirDate', 'showStatus', 'runtime', 'network', 'audioPreview']) {
        if (d[k] && (!Array.isArray(d[k]) || d[k].length)) patch[k] = d[k];
      }
      patch.ids = { tmdb: d.tmdbId || e.ids?.tmdb || '', tvmaze: d.tvmazeId || e.ids?.tvmaze || '', imdb: d.imdbId || e.ids?.imdb || '' };
      await updateEntry(e.id, patch);
      toast('Datos actualizados', 'ok'); sfx.chime();
    } catch (x) { toast('No se pudo actualizar: ' + x.message, 'err'); }
    finally { setRefreshing(false); }
  }

  const sections = [
    ['resumen', 'Resumen'],
    e.type === 'series' && ['episodios', 'Episodios'],
    ['nota', 'Nota'],
    isScreen && ['trailer', 'Tráiler'],
    isScreen && (e.soundtrack || e.composer) && ['ost', 'Banda sonora'],
    e.cast?.length && ['reparto', 'Reparto'],
    ['comentarios', 'Comentarios'],
  ].filter(Boolean);

  return html`
    <div class="page wrap">
      <div class="hero" style=${`--c:${T.color}`}>
        ${e.backdrop && html`<div class="bg"><img src=${e.backdrop} alt="" /></div>`}
        <div class="hero-inner">
          <div class="hero-poster"><${Cover} src=${e.cover} title=${e.title} type=${e.type} /></div>
          <div class="stack" style="--g:14px">
            ${!mine && html`<a href=${`#/u/${e.ownerId}`} class="row" style="--g:10px;text-decoration:none;background:var(--paper-2);border:3px solid var(--ink);border-radius:999px;padding:4px 14px 4px 4px;width:fit-content">
              <${Avatar} user=${e} size=${34} /><b>${e.ownerName}</b><span class="small muted">@${e.ownerHandle}</span></a>`}
            <h1 class="hero-title"><span>${e.title}</span></h1>
            ${e.originalTitle && html`<p style="margin:0;font-weight:700;color:var(--paper-2);-webkit-text-stroke:.6px var(--ink);font-size:1.1rem">${e.originalTitle}</p>`}
            <div class="meta-line">
              <${TypeBadge} type=${e.type} /><${StatusBadge} status=${e.status} type=${e.type} />
              ${e.year && html`<span class="badge" style="--c:var(--paper-2)">${e.year}</span>`}
              ${e.runtime && html`<span class="badge" style="--c:var(--paper-2)">⏱ ${fmtDuration(e.runtime)}</span>`}
              ${e.seasons && html`<span class="badge" style="--c:var(--paper-2)">${e.seasons} temporadas</span>`}
              ${e.pages && html`<span class="badge" style="--c:var(--paper-2)">${e.pages} págs.</span>`}
              ${e.visibility === 'private' && html`<span class="badge dark" style="--c:var(--ink)">🔒 Privada</span>`}
            </div>
            <div style="background:var(--paper-2);border:3px solid var(--ink);border-radius:18px;padding:10px 16px;width:fit-content;box-shadow:var(--sh-sm)">
              <${Stars} value=${e.rating || 0} onChange=${mine ? rate : null} size=${40} />
            </div>
          </div>
        </div>
      </div>

      <div class="row between" style="margin-top:24px">
        <div class="row" style="--g:10px">
          ${mine && html`<button class="btn yellow" onClick=${() => setEdit(true)}>✎ Editar</button>`}
          <button class="btn" onClick=${() => doExport(false)}>⬇ Exportar .md</button>
          <button class="btn" onClick=${() => doExport(true)}>⧉ Copiar .md</button>
          <${LikeButton} e=${e} />
          ${mine && html`<button class="btn ghost" disabled=${refreshing} onClick=${refresh}>${refreshing ? '⏳' : '↻'} Actualizar datos</button>`}
        </div>
        ${mine && html`<button class="btn ghost" onClick=${() => setConfirmDel(true)}>🗑 Eliminar</button>`}
      </div>

      <nav class="row section-nav" style="--g:8px">
        ${sections.map(([k, l]) => html`<a class="chip" href=${`#/item/${e.id}`} onClick=${(ev) => { ev.preventDefault(); document.getElementById('s-' + k)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); sfx.click(); }}>${l}</a>`)}
      </nav>

      <div class="cols-2" style="margin-top:26px">
        <div class="stack" style="--g:44px">
          <section id="s-resumen" style="scroll-margin-top:150px">
            ${e.tagline && html`<p class="h3" style="margin:0 0 14px;font-style:italic">«${e.tagline}»</p>`}
            ${e.overview ? html`<p class="prose" style="margin:0">${e.overview}</p>` : html`<p class="muted">Sin sinopsis.</p>`}
            ${e.type === 'audiobook' || e.audioPreview ? html`<div style="margin-top:18px"><${AudioPreview} src=${e.audioPreview} /></div>` : ''}
          </section>

          ${e.type === 'series' && html`<section id="s-episodios" style="scroll-margin-top:150px">
            <div class="section-head" style="--c:var(--blue)"><h2 class="h2">Episodios</h2></div>
            <${EpisodesPanel} e=${e} mine=${mine} />
          </section>`}

          <section id="s-nota" style="scroll-margin-top:150px">
            <div class="section-head" style="--c:var(--purple)"><h2 class="h2">${mine ? 'Mi nota' : 'Su nota'}</h2></div>
            <${NoteEditor} e=${e} mine=${mine} />
          </section>

          ${isScreen && html`<section id="s-trailer" style="scroll-margin-top:150px">
            <div class="section-head" style="--c:var(--red)"><h2 class="h2">Tráiler</h2></div>
            <${Trailer} e=${e} />
          </section>`}

          ${isScreen && (e.soundtrack || e.composer) && html`<section id="s-ost" style="scroll-margin-top:150px">
            <div class="section-head" style="--c:var(--pink)"><h2 class="h2">Banda sonora</h2></div>
            <${Soundtrack} e=${e} />
          </section>`}

          ${e.cast?.length > 0 && html`<section id="s-reparto" style="scroll-margin-top:150px">
            <div class="section-head" style="--c:var(--orange)"><h2 class="h2">Reparto</h2></div>
            <${CastRow} cast=${e.cast} />
          </section>`}

          <section id="s-comentarios" style="scroll-margin-top:150px">
            <div class="section-head" style="--c:var(--teal)"><h2 class="h2">Comentarios</h2></div>
            ${e.visibility === 'private' && !mine ? '' : html`<${Comments} e=${e} />`}
          </section>
        </div>

        <aside class="stack" style="--g:22px">
          <div class="panel">
            <div class="tape" style=${`--c:${T.color}`}></div>
            <h3 class="h3">Ficha</h3>
            <dl class="kv">
              ${e.creators?.length > 0 && html`<dt>${e.type === 'movie' ? 'Dirección' : isBook ? 'Autoría' : 'Creada por'}</dt><dd>${e.creators.join(', ')}</dd>`}
              ${e.narrator && html`<dt>Narración</dt><dd>${e.narrator}</dd>`}
              ${e.genres?.length > 0 && html`<dt>Géneros</dt><dd>${e.genres.join(', ')}</dd>`}
              ${(e.releaseDate || e.year) && html`<dt>${isBook ? 'Publicado' : 'Estreno'}</dt><dd>${e.releaseDate ? humanDate(e.releaseDate) : e.year}</dd>`}
              ${e.type === 'series' && e.showStatus && html`<dt>Estado</dt><dd>${{ Running: 'En emisión', Ended: 'Finalizada', 'Returning Series': 'Renovada', Canceled: 'Cancelada', 'To Be Determined': 'Por decidir', 'In Production': 'En producción' }[e.showStatus] || e.showStatus}</dd>`}
              ${e.nextEpisode?.airdate && html`<dt>Próximo</dt><dd>${e.nextEpisode.code} · ${humanDate(e.nextEpisode.airdate)}</dd>`}
              ${e.episodes && html`<dt>Episodios</dt><dd>${(e.watchedEpisodes || []).length} / ${e.episodes} vistos</dd>`}
              ${e.network && html`<dt>Cadena</dt><dd>${e.network}</dd>`}
              ${e.platform && html`<dt>Lo vi en</dt><dd>${e.platform}</dd>`}
              ${c.read && html`<dt>Leído</dt><dd>📖 ${c.readOn || 'Sí'}</dd>`}
              ${c.listened && html`<dt>Escuchado</dt><dd>🎧 ${c.listenedOn || 'Sí'}</dd>`}
              ${e.startedAt && html`<dt>Empezado</dt><dd>${humanDate(e.startedAt)}</dd>`}
              ${e.finishedAt && html`<dt>${e.status === 'abandoned' ? 'Abandonado' : 'Terminado'}</dt><dd>${humanDate(e.finishedAt)}</dd>`}
              ${e.publisher && html`<dt>Editorial</dt><dd>${e.publisher}</dd>`}
              ${e.isbn && html`<dt>ISBN</dt><dd>${e.isbn}</dd>`}
              ${e.composer && html`<dt>Música</dt><dd>${e.composer}</dd>`}
              ${e.tags?.length > 0 && html`<dt>Etiquetas</dt><dd>${e.tags.map((t) => html`<span class="chip static" style="padding:2px 9px;font-size:.75rem;margin:0 4px 4px 0">#${t}</span>`)}</dd>`}
            </dl>
          </div>

          ${isScreen && html`<div class="panel tint" style="--c:var(--blue)">
            <h3 class="h3">Dónde verlo</h3>
            ${(e.providers?.flatrate?.length || e.network) ? html`<${Providers} e=${e} />` : html`<p class="small muted" style="margin:0">Sin datos de streaming todavía. ${mine ? 'Pulsa «Actualizar datos» (con clave TMDB en Ajustes).' : ''}</p>`}
            ${e.providers?.rent?.length > 0 && html`<p class="small" style="margin:12px 0 0"><b>Alquiler:</b> ${e.providers.rent.map((p) => p.name).join(', ')}</p>`}
            <div class="stack" style="--g:10px;margin-top:16px">
              <a class="btn yellow" href=${deciderUrl(e)} target="_blank" rel="noopener">📰 Stream It or Skip It</a>
              <a class="btn" href=${e.providers?.link || justwatchUrl(e)} target="_blank" rel="noopener">🔎 JustWatch</a>
            </div>
          </div>`}

          <div class="panel flat">
            <h3 class="h3">Enlaces</h3>
            <div class="row" style="--g:8px">
              ${e.externalUrl && html`<a class="btn sm" href=${e.externalUrl} target="_blank" rel="noopener">${e.source?.name || 'Ficha'} ↗</a>`}
              ${(e.ids?.imdb || e.imdbId) && html`<a class="btn sm yellow" href=${`https://www.imdb.com/title/${e.ids?.imdb || e.imdbId}/`} target="_blank" rel="noopener">IMDb ↗</a>`}
              ${e.wikiUrl && html`<a class="btn sm" href=${e.wikiUrl} target="_blank" rel="noopener">Wikipedia ↗</a>`}
              ${e.homepage && html`<a class="btn sm" href=${e.homepage} target="_blank" rel="noopener">Web oficial ↗</a>`}
              ${isBook && html`<a class="btn sm" href=${`https://www.goodreads.com/search?q=${encodeURIComponent(e.isbn || e.title)}`} target="_blank" rel="noopener">Goodreads ↗</a>`}
            </div>
          </div>
        </aside>
      </div>

      ${edit && html`<${EntryForm} draft=${e} onClose=${() => setEdit(false)} />`}
      ${confirmDel && html`<${Modal} title="¿Eliminar?" color="var(--red)" width=${520} onClose=${() => setConfirmDel(false)}>
        <p style="font-size:1.1rem;margin-top:0">Se borrará <b>${e.title}</b> de tu diario junto con su nota. No se puede deshacer.</p>
        <div class="row between"><button class="btn" onClick=${() => setConfirmDel(false)}>Cancelar</button>
          <button class="btn red" onClick=${async () => {
            try { await deleteEntry(e.id); sfx.error(); toast('Eliminada', 'ok'); go('library'); } catch (x) { toast(x.message, 'err'); }
          }}>Sí, eliminar</button></div>
      </${Modal}>`}
    </div>`;
}
