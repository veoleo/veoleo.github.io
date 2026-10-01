// Ficha de una entrada: héroe, estrellas, episodios, nota, tráiler, banda sonora, reparto y comentarios.
import { html, useState, useEffect } from 'preact-standalone';
import { ComposerModal } from '../components/posts.js';
import { ShareCardModal } from '../components/sharecard.js';
import { Stars, Cover, BgImg, TypeBadge, StatusBadge, Providers, Avatar, Spinner, Modal, Icon, Scramble, shareLink } from '../components/ui.js';
import { Trailer, Soundtrack, CastRow, AudioPreview } from '../components/media.js';
import { EpisodesPanel } from '../components/episodes.js';
import { NoteEditor, LikeButton, Comments } from '../components/social.js';
import { EntryForm } from '../components/entry-form.js';
import { watchEntry, updateEntry, deleteEntry, getNote } from '../lib/db.js';
import { useStore, toast } from '../lib/store.js';
import { enrich, deciderUrl, justwatchUrl, nextEpisodeOf, overviewFor } from '../lib/metadata.js';
import { exportEntry, entryToMarkdown } from '../lib/markdown.js';
import { TYPES, humanDate, fmtDuration, statusKeysFor, statusLabel, STATUS_COLORS, todayISO } from '../lib/utils.js';
import { t as tr } from '../lib/i18n.js';
import { sfx } from '../lib/sound.js';
import { flash } from '../lib/fx.js';
import { go } from '../lib/router.js';

const SHOW_STATUS = { Running: 'En emisión', Ended: 'Finalizada', 'Returning Series': 'Renovada', Canceled: 'Cancelada', 'To Be Determined': 'Por decidir', 'In Production': 'En producción', 'In Development': 'En desarrollo' };

export function ItemPage({ id }) {
  const st = useStore();
  const own = st.entries.find((x) => x.id === id);
  const [remote, setRemote] = useState(undefined);
  const [edit, setEdit] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sec, setSec] = useState('resumen');
  const [post, setPost] = useState(false);
  const [card, setCard] = useState(false);

  useEffect(() => {
    if (own) return;
    setRemote(undefined);
    return watchEntry(id, setRemote, () => setRemote(null));
  }, [id, !!own]);
  useEffect(() => { sfx.open(); }, [id]);
  // Sin sinopsis general (títulos importados): se busca sola y, si es tuya, se guarda.
  const [ov, setOv] = useState(null);
  const base = own || remote;
  useEffect(() => {
    setOv(null);
    if (!base || base.overview) return;
    let alive = true;
    setOv('loading');
    overviewFor(base).then((r) => {
      if (!alive) return;
      setOv(r?.overview ? r : 'none');
      if (r?.overview && own) updateEntry(own.id, r).catch(() => {});
    }).catch(() => alive && setOv('none'));
    return () => { alive = false; };
  }, [id, !!base, !!base?.overview]);

  const e = own || remote;
  const mine = !!own;

  useEffect(() => {
    if (!mine || e?.type !== 'series' || e.status === 'abandoned') return;
    nextEpisodeOf(e, st.settings).then((n) => {
      if (JSON.stringify(n || null) !== JSON.stringify(e.nextEpisode || null)) updateEntry(e.id, { nextEpisode: n || null }).catch(() => {});
    }).catch(() => {});
  }, [id, mine]);

  if (e === undefined) return html`<div class="page wrap"><${Spinner} /></div>`;
  if (!e) return html`<div class="page wrap"><div class="empty"><div class="kicker">404</div><h1 class="display" style="margin:20px 0">No disponible</h1><p class="lead">Esta entrada no existe o es privada.</p><div class="row" style="margin-top:24px"><a class="btn" href="#/">Volver al inicio</a></div></div></div>`;

  const T = TYPES[e.type] || TYPES.series;
  const isScreen = e.type === 'series' || e.type === 'movie';
  const isBook = !isScreen;
  const c = e.consumption || {};

  async function rate(v) { try { await updateEntry(e.id, { rating: v }); } catch (x) { toast(x.message, 'err'); } }
  // Cambio rápido de estado (Viendo → Abandonada, Vista…) sin abrir el formulario.
  async function setStatus(k, el) {
    if (k === e.status) return;
    const patch = { status: k };
    if (k === 'completed' && !e.finishedAt) { patch.finishedAt = todayISO(); patch.lastWatchedAt = e.lastWatchedAt || todayISO(); }
    if (k === 'in_progress' && !e.startedAt) patch.startedAt = todayISO();
    try {
      await updateEntry(e.id, patch);
      if (k === 'abandoned') { flash(tr(statusLabel(k, e.type)), '#8a8fa3'); sfx.close(); toast(tr('Movida a tu lista Abandonadas'), 'ok'); }
      else { flash(tr(statusLabel(k, e.type)), '#c6ff3d'); sfx.pop(); }
    } catch (x) { toast(x.message, 'err'); }
  }
  async function doExport(copy) {
    const note = await getNote(e.id);
    if (copy) {
      const md = await entryToMarkdown(e, note, st.settings);
      await navigator.clipboard.writeText(md); toast('Markdown copiado', 'ok'); sfx.pop();
    } else { await exportEntry(e, note, st.settings); sfx.pop(); toast('Nota .md descargada', 'ok'); }
  }
  async function refresh() {
    setRefreshing(true);
    try {
      const src = { ...e, source: e.source?.name, sourceId: e.source?.id, tmdbId: e.ids?.tmdb, tvmazeId: e.ids?.tvmaze, itunesId: e.ids?.itunes, imdbId: e.ids?.imdb || e.imdbId };
      const d = await enrich(src, st.settings);
      const patch = {};
      for (const k of ['cover', 'backdrop', 'overview', 'genres', 'creators', 'cast', 'trailer', 'soundtrack', 'composer', 'providers', 'nextEpisode', 'seasons', 'episodes', 'releaseDate', 'lastAirDate', 'showStatus', 'runtime', 'network', 'audioPreview', 'wikiUrl']) {
        if (d[k] && (!Array.isArray(d[k]) || d[k].length)) patch[k] = d[k];
      }
      patch.ids = { ...(e.ids || {}), tmdb: d.tmdbId || e.ids?.tmdb || '', tvmaze: d.tvmazeId || e.ids?.tvmaze || '', imdb: d.imdbId || e.ids?.imdb || '' };
      await updateEntry(e.id, patch);
      flash('Actualizado', '#2ee6c5'); sfx.chime();
    } catch (x) { toast('No se pudo actualizar: ' + x.message, 'err'); }
    finally { setRefreshing(false); }
  }
  const share = () => shareLink({ title: e.title, text: `${e.title} en Veoleo`, url: `${location.origin}${location.pathname}#/item/${e.id}` });

  const sections = [
    ['resumen', 'Resumen'],
    e.type === 'series' && ['episodios', 'Episodios'],
    ['nota', 'Nota'],
    isScreen && ['trailer', 'Tráiler'],
    isScreen && (e.soundtrack || e.composer) && ['ost', 'Banda sonora'],
    e.cast?.length && ['reparto', 'Reparto'],
    ['comentarios', 'Comentarios'],
  ].filter(Boolean);
  const goSec = (k) => { setSec(k); document.getElementById('s-' + k)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); sfx.click(); };

  return html`
    <div class="page wrap">
      <section class="hero" style=${`--c:${T.color}`}>
        ${(e.backdrop || e.cover) && html`<div class="bg"><${BgImg} src=${e.backdrop || e.cover} w=${e.backdrop ? 1400 : 400} style=${e.backdrop ? '' : 'filter:blur(40px) saturate(1.2);transform:scale(1.3)'} /></div>`}
        <div class="wrap">
          <div class="hero-inner">
            <div class="hero-poster"><${Cover} src=${e.cover} title=${e.title} type=${e.type} w=${500} /></div>
            <div class="stack" style="--g:20px">
              ${!mine && html`<a href=${`#/u/${e.ownerId}`} class="row" style="--g:10px;text-decoration:none"><${Avatar} user=${e} size=${30} /><span class="sub">Diario de ${e.ownerName}</span></a>`}
              <div class="meta-line"><${TypeBadge} type=${e.type} /><${StatusBadge} status=${e.status} type=${e.type} />
                ${e.year && html`<span class="sub">${e.year}</span>`}
                ${e.runtime && html`<span class="sub">${fmtDuration(e.runtime)}</span>`}
                ${e.seasons && html`<span class="sub">${e.seasons} temporadas</span>`}
                ${e.pages && html`<span class="sub">${e.pages} páginas</span>`}
                ${e.visibility === 'private' && html`<span class="tag" style="--c:var(--muted)"><${Icon} name="lock" size=${12} /> Privada</span>`}
              </div>
              <h1 class="hero-title"><${Scramble} text=${e.title} /></h1>
              ${e.originalTitle && html`<div class="sub">${e.originalTitle}</div>`}
              <${Stars} value=${e.rating || 0} onChange=${mine ? rate : null} size=${34} />
              ${mine && html`<div class="status-pick" role="group" aria-label="Estado">${statusKeysFor(e.type).map((k) => html`<button key=${k}
                class=${e.status === k ? 'on' : ''} style=${`--c:${STATUS_COLORS[k]}`} aria-pressed=${e.status === k} onClick=${(ev) => setStatus(k, ev.currentTarget)}>${statusLabel(k, e.type)}</button>`)}</div>`}
              <div class="row" style="--g:10px">
                ${mine && html`<button class="btn" onClick=${() => setEdit(true)}><${Icon} name="edit" /> Editar</button>`}
                ${mine && html`<button class="btn glass" onClick=${() => setPost(true)} title="Compartir en Comunidad"><${Icon} name="chat" /> Publicar</button>`}
                <${LikeButton} e=${e} />
                <button class="btn glass" onClick=${() => setCard(true)} title="Tarjeta para Instagram"><${Icon} name="image" /> Tarjeta</button>
                <button class="btn icon glass" onClick=${share} title="Compartir enlace" aria-label="Compartir enlace"><${Icon} name="share" /></button>
                <button class="btn glass" onClick=${() => doExport(false)} title="Exportar a Markdown"><${Icon} name="download" /> .md</button>
                <button class="btn icon glass" onClick=${() => doExport(true)} title="Copiar Markdown" aria-label="Copiar Markdown"><${Icon} name="copy" /></button>
                ${mine && html`<button class="btn icon glass" disabled=${refreshing} onClick=${refresh} title="Actualizar datos" aria-label="Actualizar datos"><${Icon} name="refresh" /></button>`}
                ${mine && html`<button class="btn icon glass" onClick=${() => setConfirmDel(true)} title="Eliminar" aria-label="Eliminar"><${Icon} name="trash" /></button>`}
              </div>
            </div>
          </div>
        </div>
      </section>

      <nav class="section-nav"><div class="tabs">${sections.map(([k, l]) => html`<button class=${sec === k ? 'on' : ''} style=${`--c:${T.color}`} onClick=${() => goSec(k)}>${l}</button>`)}</div></nav>

      <div class="cols-2" style="margin-top:56px">
        <div class="stack" style="--g:88px">
          <section id="s-resumen" class="anchor">
            ${e.tagline && html`<p class="h3" style="margin:0 0 20px;text-transform:none;font-stretch:100%">“${e.tagline}”</p>`}
            ${(e.overview || ov?.overview) ? html`<p class="prose" style="margin:0;font-size:1.15rem;color:var(--text)">${e.overview || ov.overview}</p>`
              : ov === 'loading' ? html`<p class="muted">Buscando sinopsis…</p>`
              : html`<p class="muted">Sin sinopsis.${mine ? ' Pulsa actualizar para buscarla.' : ''}</p>`}
            ${(e.type === 'audiobook' || e.audioPreview) && html`<div style="margin-top:28px"><${AudioPreview} src=${e.audioPreview} /></div>`}
          </section>

          ${e.type === 'series' && html`<section id="s-episodios" class="anchor">
            <div class="section-head" style=${`--c:${T.color}`}><div><span class="label">Temporadas</span><h2 class="h2">Episodios</h2></div></div>
            <${EpisodesPanel} e=${e} mine=${mine} />
          </section>`}

          <section id="s-nota" class="anchor">
            <div class="section-head" style="--c:var(--purple)"><div><span class="label">${mine ? 'Markdown · Obsidian' : 'Nota'}</span><h2 class="h2">${mine ? 'Mi nota' : `Nota de ${e.ownerName}`}</h2></div></div>
            <${NoteEditor} e=${e} mine=${mine} />
          </section>

          ${isScreen && html`<section id="s-trailer" class="anchor">
            <div class="section-head" style="--c:var(--red)"><div><span class="label">Vídeo</span><h2 class="h2">Tráiler</h2></div></div>
            <${Trailer} e=${e} />
          </section>`}

          ${isScreen && (e.soundtrack || e.composer) && html`<section id="s-ost" class="anchor">
            <div class="section-head" style="--c:var(--pink)"><div><span class="label">Música</span><h2 class="h2">Banda sonora</h2></div></div>
            <${Soundtrack} e=${e} />
          </section>`}

          ${e.cast?.length > 0 && html`<section id="s-reparto" class="anchor">
            <div class="section-head" style="--c:var(--orange)"><div><span class="label">Intérpretes</span><h2 class="h2">Reparto</h2></div></div>
            <${CastRow} cast=${e.cast} />
          </section>`}

          <section id="s-comentarios" class="anchor">
            <div class="section-head" style="--c:var(--teal)"><div><span class="label">Conversación</span><h2 class="h2">Comentarios</h2></div></div>
            ${e.visibility === 'private' && !mine ? '' : html`<${Comments} e=${e} />`}
          </section>
        </div>

        <aside class="stack" style="--g:56px;align-self:start">
          <dl class="kv">
            ${e.creators?.length > 0 && html`<dt>${e.type === 'movie' ? 'Dirección' : isBook ? 'Autoría' : 'Creación'}</dt><dd>${e.creators.join(', ')}</dd>`}
            ${e.narrator && html`<dt>Narración</dt><dd>${e.narrator}</dd>`}
            ${e.genres?.length > 0 && html`<dt>Géneros</dt><dd>${e.genres.join(', ')}</dd>`}
            ${(e.releaseDate || e.year) && html`<dt>${isBook ? 'Publicado' : 'Estreno'}</dt><dd>${e.releaseDate ? humanDate(e.releaseDate) : e.year}</dd>`}
            ${e.type === 'series' && e.showStatus && html`<dt>Estado</dt><dd>${SHOW_STATUS[e.showStatus] || e.showStatus}</dd>`}
            ${e.nextEpisode?.airdate && html`<dt>Próximo</dt><dd>${e.nextEpisode.code} · ${humanDate(e.nextEpisode.airdate)}</dd>`}
            ${e.episodes > 0 && html`<dt>Progreso</dt><dd>${(e.watchedEpisodes || []).length} / ${e.episodes} episodios</dd>`}
            ${e.platform && html`<dt>Lo vi en</dt><dd>${e.platform}</dd>`}
            ${c.read && html`<dt>Leído</dt><dd>${c.readOn || 'Sí'}</dd>`}
            ${c.listened && html`<dt>Escuchado</dt><dd>${c.listenedOn || 'Sí'}</dd>`}
            ${e.startedAt && html`<dt>Empezado</dt><dd>${humanDate(e.startedAt)}</dd>`}
            ${e.finishedAt && html`<dt>${e.status === 'abandoned' ? 'Abandonado' : 'Terminado'}</dt><dd>${humanDate(e.finishedAt)}</dd>`}
            ${e.rewatch > 0 && html`<dt>Revisionado</dt><dd>${e.rewatch} ${e.rewatch === 1 ? 'vez' : 'veces'}</dd>`}
            ${e.publisher && html`<dt>Editorial</dt><dd>${e.publisher}</dd>`}
            ${e.isbn && html`<dt>ISBN</dt><dd>${e.isbn}</dd>`}
            ${e.composer && html`<dt>Música</dt><dd>${e.composer}</dd>`}
            ${e.tags?.length > 0 && html`<dt>Etiquetas</dt><dd>${e.tags.map((t) => `#${t}`).join('  ')}</dd>`}
          </dl>

          ${isScreen && html`<div class="stack" style="--g:16px">
            <span class="label" style="color:var(--blue)">Dónde verlo</span>
            ${(e.providers?.flatrate?.length || e.network) ? html`<${Providers} e=${e} />` : html`<span class="muted small">Sin datos de plataforma.</span>`}
            <div class="stack" style="--g:8px">
              <a class="btn glass" href=${deciderUrl(e)} target="_blank" rel="noopener">Stream it or skip it <${Icon} name="ext" size=${13} /></a>
              <a class="btn glass" href=${e.providers?.link || justwatchUrl(e)} target="_blank" rel="noopener">JustWatch <${Icon} name="ext" size=${13} /></a>
            </div>
          </div>`}

          <div class="stack" style="--g:12px">
            <span class="label">Enlaces</span>
            <div class="row" style="--g:8px">
              ${e.externalUrl && html`<a class="chip" href=${e.externalUrl} target="_blank" rel="noopener">${e.source?.name || 'Ficha'} ↗</a>`}
              ${(e.ids?.imdb || e.imdbId) && html`<a class="chip" href=${`https://www.imdb.com/title/${e.ids?.imdb || e.imdbId}/`} target="_blank" rel="noopener">IMDb ↗</a>`}
              ${e.wikiUrl && html`<a class="chip" href=${e.wikiUrl} target="_blank" rel="noopener">Wikipedia ↗</a>`}
              ${e.homepage && html`<a class="chip" href=${e.homepage} target="_blank" rel="noopener">Web oficial ↗</a>`}
              ${isBook && html`<a class="chip" href=${`https://www.goodreads.com/search?q=${encodeURIComponent(e.isbn || e.title)}`} target="_blank" rel="noopener">Goodreads ↗</a>`}
            </div>
          </div>
        </aside>
      </div>

      ${edit && html`<${EntryForm} draft=${e} onClose=${() => setEdit(false)} />`}
      ${post && html`<${ComposerModal} entry=${e} onClose=${() => setPost(false)} />`}
      ${card && html`<${ShareCardModal} e=${e} onClose=${() => setCard(false)} />`}
      ${confirmDel && html`<${Modal} kicker="Eliminar" title=${e.title} color="var(--red)" width=${560} onClose=${() => setConfirmDel(false)}>
        <p class="lead" style="margin-top:0">Se borrará de tu diario junto con su nota. No se puede deshacer.</p>
        <div class="row between" style="margin-top:28px"><button class="btn ghost" onClick=${() => setConfirmDel(false)}>Cancelar</button>
          <button class="btn danger" onClick=${async () => {
            try { await deleteEntry(e.id); sfx.close(); toast('Eliminada', 'ok'); go('library'); } catch (x) { toast(x.message, 'err'); }
          }}><${Icon} name="trash" /> Eliminar</button></div>
      </${Modal}>`}
    </div>`;
}
