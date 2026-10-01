// Inicio: héroe, estadísticas del año, retos, en curso, actividad de la gente que sigues.
import { html } from 'preact-standalone';
import { PosterCard, Cover, Ring, Avatar, Empty, Stars, useAsync, StatusBadge } from '../components/ui.js';
import { useStore } from '../lib/store.js';
import { feedFor } from '../lib/db.js';
import { TYPES, entryYear, sortEntries, toMillis, timeAgo, statusLabel, starsText } from '../lib/utils.js';

const VERB = { series: 'vistas', movie: 'vistas', book: 'leídos', audiobook: 'escuchados' };

export function HomePage() {
  const { profile, entries, entriesReady, following, user } = useStore();
  const y = new Date().getFullYear();
  const done = entries.filter((e) => e.status === 'completed' && entryYear(e) === y);
  const inProgress = sortEntries(entries.filter((e) => e.status === 'in_progress'));
  const recent = sortEntries(entries).slice(0, 14);
  const planned = sortEntries(entries.filter((e) => e.status === 'planned')).slice(0, 14);
  const featured = inProgress.find((e) => e.backdrop) || recent.find((e) => e.backdrop) || recent[0];
  const goals = profile?.challenges?.[y] || {};
  const feed = useAsync(() => feedFor(following), [following.join(',')]);
  const hour = new Date().getHours();
  const hello = hour < 6 ? 'Buenas noches' : hour < 14 ? 'Buenos días' : hour < 21 ? 'Buenas tardes' : 'Buenas noches';
  const first = (profile?.displayName || '').split(' ')[0];

  if (entriesReady && !entries.length) {
    return html`<div class="page wrap">
      <h1 class="mega">${hello}${first ? ',' : ''} <span class="mark tilt-l">${first || 'fan'}</span></h1>
      <div class="panel halftone" style="margin-top:40px;padding:40px;--c:var(--yellow)">
        <div class="tape"></div>
        <${Empty} word="¡ACCIÓN!" title="Tu diario empieza aquí" sub="Busca una serie, peli, libro o audiolibro y regístralo con sus estrellas, notas y episodios.">
          <div class="row" style="justify-content:center">
            <a class="btn big red" href="#/search?type=series">📺 Añadir serie</a>
            <a class="btn big blue" href="#/search?type=movie">🎬 Añadir peli</a>
            <a class="btn big yellow" href="#/search?type=book">📖 Añadir libro</a>
            <a class="btn big" href="#/discover">🆕 Ver novedades</a>
          </div>
        </${Empty}>
      </div>
    </div>`;
  }

  const activity = (feed.data || []).sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt)).slice(0, 12);
  return html`<div class="page wrap">
    <div class="row between" style="align-items:flex-end;margin-bottom:26px">
      <h1 class="h1">${hello}${first ? ',' : ''} <span class="mark tilt-l">${first}</span></h1>
      <a class="btn red" href="#/search">＋ Añadir</a>
    </div>

    ${featured && html`<a class="hero" href=${`#/item/${featured.id}`} style=${`display:block;text-decoration:none;--c:${TYPES[featured.type]?.color}`}>
      ${featured.backdrop && html`<div class="bg"><img src=${featured.backdrop} alt="" /></div>`}
      <div class="hero-inner">
        <div class="hero-poster"><${Cover} src=${featured.cover} title=${featured.title} type=${featured.type} /></div>
        <div class="stack" style="--g:14px">
          <span class="badge" style="--c:var(--paper-2);width:fit-content">${featured.status === 'in_progress' ? '▶ Ahora mismo' : '★ Lo último'}</span>
          <h2 class="hero-title"><span>${featured.title}</span></h2>
          <div class="meta-line"><${StatusBadge} status=${featured.status} type=${featured.type} />
            ${featured.type === 'series' && featured.episodes && html`<span class="badge" style="--c:var(--paper-2)">${(featured.watchedEpisodes || []).length}/${featured.episodes} episodios</span>`}
            ${featured.rating > 0 && html`<span class="badge" style="--c:var(--yellow)">${starsText(featured.rating)}</span>`}
          </div>
        </div>
      </div>
    </a>`}

    ${recent.length > 2 && html`<div class="ticker" style="margin-top:34px"><div>${[...recent, ...recent].map((e, i) => html`<span key=${i}>${TYPES[e.type].icon} <b>${statusLabel(e.status, e.type).toUpperCase()}</b> ${e.title} ${e.rating ? '· ' + starsText(e.rating) : ''}</span>`)}</div></div>`}

    <div class="section">
      <div class="section-head" style="--c:var(--yellow)"><h2 class="h2">Tu ${y}</h2><a class="btn sm" href="#/challenges">🏆 Retos</a></div>
      <div class="grid" style="--min:200px">
        ${Object.values(TYPES).map((t, i) => {
          const n = done.filter((e) => e.type === t.key).length;
          const goalKey = { series: 'series', movie: 'movies', book: 'books', audiobook: 'audiobooks' }[t.key];
          const goal = goals[goalKey];
          return html`<a class="stat ${t.key === 'book' ? '' : 'dark'}" href=${`#/library?type=${t.key}&status=completed&year=${y}`} style=${`--c:${t.color};text-decoration:none;transform:rotate(${i % 2 ? 1 : -1}deg)`}>
            <b>${n}${goal ? html`<span style="font-size:.45em;opacity:.8"> / ${goal}</span>` : ''}</b><span>${t.icon} ${t.plural} ${VERB[t.key]}</span>
          </a>`;
        })}
      </div>
    </div>

    ${inProgress.length > 0 && html`<div class="section">
      <div class="section-head" style="--c:var(--blue)"><h2 class="h2">Sigue donde lo dejaste</h2></div>
      <div class="carousel">${inProgress.map((e) => html`<${PosterCard} key=${e.id} e=${e}
        sub=${e.type === 'series' ? `${(e.watchedEpisodes || []).length}/${e.episodes || '?'} episodios` : statusLabel(e.status, e.type)} />`)}</div>
    </div>`}

    <div class="section">
      <div class="section-head" style="--c:var(--red)"><h2 class="h2">Recientes</h2><a class="btn sm" href="#/library">Ver todo →</a></div>
      <div class="carousel">${recent.map((e) => html`<${PosterCard} key=${e.id} e=${e} />`)}</div>
    </div>

    ${planned.length > 0 && html`<div class="section">
      <div class="section-head" style="--c:var(--pink)"><h2 class="h2">Must watch & por leer</h2><a class="btn sm" href="#/list/sys-mustwatch">Lista completa →</a></div>
      <div class="carousel">${planned.map((e) => html`<${PosterCard} key=${e.id} e=${e} />`)}</div>
    </div>`}

    <div class="section">
      <div class="section-head" style="--c:var(--teal)"><h2 class="h2">Gente que sigues</h2><a class="btn sm" href="#/explore">Comunidad →</a></div>
      ${!following.length ? html`<div class="panel tint flat" style="--c:var(--teal)"><b>Aún no sigues a nadie.</b> Encuentra amigos en <a href="#/explore">Comunidad</a> y verás aquí lo que ven y leen.</div>`
        : !activity.length ? html`<p class="muted">Sin actividad reciente.</p>`
        : html`<div class="stack" style="--g:12px">${activity.map((e) => html`<${FeedItem} key=${e.id} e=${e} />`)}</div>`}
    </div>
  </div>`;
}

export function FeedItem({ e }) {
  return html`<a class="feed-item" href=${`#/item/${e.id}`}>
    <${Avatar} user=${e} size=${50} />
    <div style="min-width:0">
      <div><b>${e.ownerName}</b> <span class="muted small">@${e.ownerHandle} · ${timeAgo(toMillis(e.updatedAt))}</span></div>
      <div style="font-size:1.05rem;margin-top:2px">${statusLabel(e.status, e.type).toLowerCase()} <b>${e.title}</b> ${TYPES[e.type]?.icon}</div>
      ${e.rating > 0 && html`<div style="margin-top:4px"><${Stars} value=${e.rating} readOnly size=${20} showValue=${false} /></div>`}
      ${e.hasNote && e.notePublic && html`<span class="small" style="font-weight:700">📝 Con nota pública</span>`}
    </div>
    <div class="thumb"><${Cover} src=${e.cover} title=${e.title} type=${e.type} /></div>
  </a>`;
}
