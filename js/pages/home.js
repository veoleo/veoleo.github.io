// Inicio: héroe, tu año en cifras, seguir viendo, recomendaciones, noticias y actividad.
import { html, useState } from 'preact-standalone';
import { PosterCard, Cover, BgImg, Avatar, Stars, useAsync, StatusBadge, SectionHead, Icon, Scramble, CountUp } from '../components/ui.js';
import { PreviewModal } from '../components/preview.js';
import { useStore } from '../lib/store.js';
import { feedFor } from '../lib/db.js';
import { discoverSections, recommendationsFor } from '../lib/metadata.js';
import { loadNews, NewsCard } from './news.js';
import { TYPES, entryYear, sortEntries, toMillis, timeAgo, statusLabel } from '../lib/utils.js';

const VERB = { series: 'Series vistas', movie: 'Películas vistas', book: 'Libros leídos', audiobook: 'Audiolibros' };

function Carousel({ items, onOpen, label }) {
  return html`<div class="carousel">${items.map((it) => html`<${PosterCard} key=${(it.id || it.source + it.sourceId)} e=${it}
    href=${it.id ? undefined : 'javascript:void 0'} onClick=${it.id ? undefined : (ev) => { ev.preventDefault(); onOpen(it); }}
    sub=${label ? label(it) : undefined} />`)}</div>`;
}

export function HomePage() {
  const { profile, entries, entriesReady, following, settings } = useStore();
  const [preview, setPreview] = useState(null);
  const y = new Date().getFullYear();
  const done = entries.filter((e) => e.status === 'completed' && entryYear(e) === y);
  const inProgressAll = entries.filter((e) => e.status === 'in_progress');
  const inProgress = sortEntries(inProgressAll).slice(0, 20);
  const recent = sortEntries(entries).slice(0, 16);
  const planned = sortEntries(entries.filter((e) => e.status === 'planned')).slice(0, 16);
  const featured = inProgress.find((e) => e.backdrop) || inProgress[0] || recent.find((e) => e.backdrop) || recent[0];
  const feed = useAsync(() => feedFor(following), [following.join(',')]);
  const news = useAsync(() => loadNews(), []);
  const disc = useAsync(() => (entries.length < 3 ? discoverSections(settings) : Promise.resolve([])), [entriesReady && entries.length < 3]);
  const recs = useAsync(() => (entries.length >= 3 ? recommendationsFor(entries, settings) : Promise.resolve([])), [entries.length]);
  const hours = Math.round((entries.filter((e) => e.type === 'movie' && e.status === 'completed').reduce((a, e) => a + (e.runtime || 110) * (1 + (e.rewatch || 0)), 0)
    + entries.reduce((a, e) => a + (e.watchedMinutes || 0), 0)) / 60);
  const hour = new Date().getHours();
  const hello = hour < 6 ? 'Buenas noches' : hour < 14 ? 'Buenos días' : hour < 21 ? 'Buenas tardes' : 'Buenas noches';
  const first = (profile?.displayName || '').split(' ')[0];
  const activity = [...(feed.data || [])].sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt)).slice(0, 10);

  return html`<div class="page wrap">
    ${featured ? html`
      <a class="hero" href=${`#/item/${featured.id}`} style=${`--c:${TYPES[featured.type]?.color}`}>
        ${(featured.backdrop || featured.cover) && html`<div class="bg"><${BgImg} src=${featured.backdrop || featured.cover} w=${featured.backdrop ? 1400 : 400} style=${featured.backdrop ? '' : 'filter:blur(40px);transform:scale(1.3)'} /></div>`}
        <div class="wrap">
          <div class="stack" style="--g:22px;max-width:1000px">
            <div class="kicker">${hello}${first ? ', ' + first : ''} · ${featured.status === 'in_progress' ? 'Sigue donde lo dejaste' : 'Lo último en tu diario'}</div>
            <h1 class="hero-title"><${Scramble} text=${featured.title} /></h1>
            <div class="meta-line">
              <${StatusBadge} status=${featured.status} type=${featured.type} />
              ${featured.type === 'series' && featured.episodes && html`<span class="sub">${(featured.watchedEpisodes || []).length} / ${featured.episodes} episodios</span>`}
              ${featured.rating > 0 && html`<${Stars} value=${featured.rating} readOnly size=${18} showValue=${false} />`}
            </div>
            <div class="row"><span class="btn lg">${featured.status === 'in_progress' ? 'Continuar' : 'Abrir ficha'}<${Icon} name="chevron" /></span></div>
          </div>
        </div>
      </a>` : html`
      <section style="padding:60px 0 20px">
        <div class="kicker">${hello}${first ? ', ' + first : ''}</div>
        <h1 class="display" style="margin:24px 0 28px">Tu diario<br /><span class="grad-text">empieza aquí.</span></h1>
        <p class="lead">Busca una serie, una película, un libro o un audiolibro y regístralo con su valoración, tus notas y los episodios que vas viendo. O importa tu historial de TV Time, Letterboxd o Goodreads.</p>
        <div class="row" style="margin-top:32px">
          <a class="btn lg" href="#/search"><${Icon} name="search" /> Buscar</a>
          <a class="btn lg ghost" href="#/data"><${Icon} name="upload" /> Importar historial</a>
          <a class="btn lg ghost" href="#/discover">Ver novedades</a>
        </div>
      </section>`}

    ${recent.length > 2 && html`<div class="marquee" style="margin-top:40px"><div>${[...recent, ...recent].map((e, i) => html`<span key=${i}><em>${statusLabel(e.status, e.type)}</em> · <b>${e.title}</b>${e.rating ? ` · ${String(e.rating).replace('.', ',')}★` : ''}</span>`)}</div></div>`}

    ${entries.length > 0 && html`<section class="section reveal">
      <${SectionHead} kicker="Tu año" title=${String(y)}><a class="btn ghost sm" href="#/stats"><${Icon} name="chart" /> Estadísticas</a></${SectionHead}>
      <div class="stats">
        ${Object.values(TYPES).map((t) => html`<a class="stat" href=${`#/library?type=${t.key}&status=completed&year=${y}`} style=${`--c:${t.color}`}>
          <b><${CountUp} value=${done.filter((e) => e.type === t.key).length} />${profile?.challenges?.[y]?.[{ series: 'series', movie: 'movies', book: 'books', audiobook: 'audiobooks' }[t.key]] ? html`<small> / ${profile.challenges[y][{ series: 'series', movie: 'movies', book: 'books', audiobook: 'audiobooks' }[t.key]]}</small>` : ''}</b>
          <span>${VERB[t.key]}</span></a>`)}
        <a class="stat" href="#/stats" style="--c:var(--accent)"><b><${CountUp} value=${hours} /><small> h</small></b><span>Horas de pantalla · total</span></a>
      </div>
    </section>`}

    ${inProgress.length > 0 && html`<section class="section reveal"><${SectionHead} kicker="En curso" title="Seguir viendo y leyendo" color="var(--yellow)">${inProgressAll.length > inProgress.length && html`<a class="btn ghost sm" href="#/library?status=in_progress">Ver las ${inProgressAll.length}</a>`}</${SectionHead}>
      <${Carousel} items=${inProgress} label=${(e) => (e.type === 'series' ? `${(e.watchedEpisodes || []).length}/${e.episodes || '?'} episodios` : statusLabel(e.status, e.type))} /></section>`}

    ${recs.data?.length > 0 && html`<section class="section reveal"><${SectionHead} kicker="Para ti" title="Te puede gustar" color="var(--pink)"><a class="btn ghost sm" href="#/discover">Novedades</a></${SectionHead}>
      <${Carousel} items=${recs.data} onOpen=${setPreview} label=${(it) => (it.because ? `Porque te gustó ${it.because}` : it.network)} /></section>`}

    ${(disc.data || []).slice(0, 3).map((s) => html`<section class="section reveal" key=${s.id}><${SectionHead} kicker=${s.kicker} title=${s.title} />
      <${Carousel} items=${s.items.slice(0, 20)} onOpen=${setPreview} label=${(it) => [it.premiereLabel || TYPES[it.type]?.label, it.network].filter(Boolean).join(' · ')} /></section>`)}

    ${recent.length > 0 && html`<section class="section reveal"><${SectionHead} kicker="Diario" title="Recientes"><a class="btn ghost sm" href="#/library">Biblioteca</a></${SectionHead}>
      <${Carousel} items=${recent} /></section>`}

    ${planned.length > 0 && html`<section class="section reveal"><${SectionHead} kicker="Pendientes" title="Must watch y por leer" color="var(--pink)"><a class="btn ghost sm" href="#/list/sys-mustwatch">Ver lista</a></${SectionHead}>
      <${Carousel} items=${planned} /></section>`}

    ${news.data?.items?.length > 0 && html`<section class="section reveal"><${SectionHead} kicker="Noticias" title="Lo último del mundo serie" color="var(--blue)"><a class="btn ghost sm" href="#/news">Todas</a></${SectionHead}>
      <div class="news">${news.data.items.slice(0, 3).map((n) => html`<${NewsCard} key=${n.id} n=${n} />`)}</div></section>`}

    <section class="section reveal"><${SectionHead} kicker="Comunidad" title="Gente que sigues" color="var(--teal)"><a class="btn ghost sm" href="#/explore">Explorar</a></${SectionHead}>
      ${!following.length ? html`<p class="muted">Todavía no sigues a nadie. Encuentra gente en <a href="#/explore" style="color:var(--accent)">Comunidad</a> y verás aquí lo que ven y leen.</p>`
        : !activity.length ? html`<p class="muted">Sin actividad reciente.</p>`
        : html`<div>${activity.map((e) => html`<${FeedItem} key=${e.id} e=${e} />`)}</div>`}
    </section>
    ${preview && html`<${PreviewModal} item=${preview} onClose=${() => setPreview(null)} />`}
  </div>`;
}

export function FeedItem({ e }) {
  return html`<a class="feed-item" href=${`#/item/${e.id}`}>
    <${Avatar} user=${e} size=${44} />
    <div style="min-width:0">
      <div class="what"><b>${e.ownerName}</b> · ${statusLabel(e.status, e.type).toLowerCase()} <b>${e.title}</b></div>
      <div class="row" style="--g:14px;margin-top:6px">
        <span class="count">@${e.ownerHandle} · ${timeAgo(toMillis(e.updatedAt)).toUpperCase()}</span>
        ${e.rating > 0 && html`<${Stars} value=${e.rating} readOnly size=${13} showValue=${false} />`}
        ${e.hasNote && e.notePublic && html`<span class="tag" style="--c:var(--purple)">Nota</span>`}
      </div>
    </div>
    <div class="thumb"><${Cover} src=${e.cover} title=${e.title} type=${e.type} w=${120} /></div>
  </a>`;
}
