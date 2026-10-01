// Novedades: estrenos de series y pelis, por plataforma, calendario de episodios y recomendaciones.
import { html, useState, useEffect } from 'preact-standalone';
import { PosterCard, Chip, LazyProviders, Spinner, Cover, useAsync } from '../components/ui.js';
import { PreviewModal, findExisting } from '../components/preview.js';
import { useStore } from '../lib/store.js';
import { discoverSections, providerOptions, recommendationsFor, nextEpisodeOf, hasTmdb } from '../lib/metadata.js';
import { feedFor } from '../lib/db.js';
import { humanDate, todayISO, TYPES } from '../lib/utils.js';
import { setQuery } from '../lib/router.js';

function Card({ it, onOpen, entries, label }) {
  const ex = findExisting(entries, it);
  const date = it.releaseDate ? humanDate(it.releaseDate) : it.year;
  return html`<${PosterCard} e=${ex ? { ...it, status: ex.status, rating: ex.rating } : it} href="javascript:void 0"
    onClick=${(ev) => { ev.preventDefault(); onOpen(it); }}
    sub=${[label || it.premiereLabel, date].filter(Boolean).join(' · ')}
    extra=${html`<div style="margin-top:6px"><${LazyProviders} item=${it} /></div>`} />`;
}

function Carousel({ title, items, color, onOpen, entries, note }) {
  if (!items?.length) return null;
  return html`<div class="section">
    <div class="section-head" style=${`--c:${color}`}><h2 class="h2">${title}</h2>${note && html`<span class="small muted">${note}</span>`}</div>
    <div class="carousel">${items.map((it) => html`<${Card} key=${it.source + it.sourceId} it=${it} onOpen=${onOpen} entries=${entries} label=${it.because ? `Porque viste ${it.because}` : ''} />`)}</div>
  </div>`;
}

export function DiscoverPage({ route }) {
  const { settings, entries, following, user } = useStore();
  const [provider, setProvider] = useState(route.query.p || '');
  const [preview, setPreview] = useState(null);
  const tmdb = hasTmdb(settings);
  const provs = useAsync(() => providerOptions(settings), [tmdb]);
  const disc = useAsync(() => discoverSections(settings, { provider }), [provider, tmdb]);
  const recs = useAsync(() => recommendationsFor(entries, settings), [tmdb, entries.length]);
  const community = useAsync(async () => {
    const list = await feedFor(following);
    const seen = new Set();
    return list.filter((e) => (e.rating || 0) >= 4 && e.ownerId !== user.uid && !findExisting(entries, e))
      .filter((e) => { const k = e.type + e.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 20);
  }, [following.join(','), entries.length]);

  useEffect(() => setQuery({ p: provider }), [provider]);
  const colors = ['var(--red)', 'var(--blue)', 'var(--teal)', 'var(--orange)', 'var(--purple)'];

  return html`<div class="page wrap">
    <h1 class="mega">¿Qué <span class="mark red tilt-l">ver</span> ahora?</h1>
    <p class="muted" style="font-size:1.1rem;margin:14px 0 24px">Estrenos de series y películas, dónde verlos, tu calendario de episodios y recomendaciones.</p>

    ${!tmdb && html`<div class="panel tint" style="--c:var(--yellow);margin-bottom:24px">
      <b>💡 Activa el modo completo:</b> con una clave gratuita de TMDB verás estrenos de cine, tendencias, plataformas (Netflix, Max, Disney+…) y recomendaciones personales.
      <a class="btn sm" style="margin-left:8px" href="#/settings">Añadir clave en Ajustes</a>
    </div>`}

    <div class="row" style="--g:8px">
      <span class="label">Plataforma</span>
      <${Chip} on=${!provider} color="var(--ink)" onClick=${() => setProvider('')}>Todas</${Chip}>
      ${(provs.data || []).map((p) => html`<${Chip} key=${p.id} on=${provider === p.id} color="var(--blue)" onClick=${() => setProvider(provider === p.id ? '' : p.id)}>
        ${p.logo && html`<img src=${p.logo} alt="" style="width:20px;height:20px;border-radius:5px" />`}${p.name}</${Chip}>`)}
    </div>

    <${Calendar} entries=${entries} settings=${settings} />

    ${recs.data?.length > 0 && html`<${Carousel} title="Recomendado para ti" items=${recs.data} color="var(--pink)" onOpen=${setPreview} entries=${entries} note="A partir de lo que mejor has valorado" />`}

    ${disc.loading ? html`<${Spinner} />` : (disc.data || []).map((s, i) => html`<${Carousel} key=${s.id} title=${s.title} items=${s.items} color=${colors[i % colors.length]} onOpen=${setPreview} entries=${entries} />`)}
    ${!disc.loading && !(disc.data || []).length && html`<p class="muted section">No hay novedades para ese filtro ahora mismo.</p>`}

    ${community.data?.length > 0 && html`<div class="section">
      <div class="section-head" style="--c:var(--teal)"><h2 class="h2">Triunfa entre la gente que sigues</h2></div>
      <div class="carousel">${community.data.map((e) => html`<${PosterCard} key=${e.id} e=${e} showStatus=${false} sub=${`★ ${e.rating} · ${e.ownerName}`} />`)}</div>
    </div>`}

    ${preview && html`<${PreviewModal} item=${preview} onClose=${() => setPreview(null)} />`}
  </div>`;
}

// Próximos episodios de las series que sigues (en curso o pendientes).
function Calendar({ entries, settings }) {
  const series = entries.filter((e) => e.type === 'series' && (e.status === 'in_progress' || e.status === 'planned' || (e.status === 'completed' && e.showStatus && !/Ended|Canceled/.test(e.showStatus))));
  const key = series.map((e) => e.id).join(',');
  const cal = useAsync(async () => {
    const today = todayISO();
    const out = [];
    const queue = [...series].slice(0, 30);
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const e = queue.shift();
        let n = e.nextEpisode;
        if (!n || !n.airdate || n.airdate < today) n = await nextEpisodeOf(e, settings).catch(() => null);
        if (n?.airdate && n.airdate >= today) out.push({ e, n });
      }
    }));
    return out.sort((a, b) => a.n.airdate.localeCompare(b.n.airdate));
  }, [key]);
  if (!series.length) return null;
  return html`<div class="section">
    <div class="section-head" style="--c:var(--red)"><h2 class="h2">Tu calendario</h2><span class="small muted">Próximos episodios de tus series</span></div>
    ${cal.loading ? html`<${Spinner} />` : !cal.data?.length ? html`<p class="muted">Ninguna de tus series tiene episodios anunciados ahora mismo.</p>`
      : html`<div class="grid" style="--min:300px">${cal.data.map(({ e, n }) => {
          const d = new Date(n.airdate + 'T12:00:00');
          return html`<a class="cal-item" key=${e.id} href=${`#/item/${e.id}`}>
            <div class="cal-date"><b>${d.getDate()}</b><span>${d.toLocaleDateString('es-ES', { month: 'short' })}</span></div>
            <div style="min-width:0"><b style="display:block">${e.title}</b><span class="small"><span class="code" style="font-weight:800">${n.code}</span> · ${n.name || ''}</span>
              <div class="small muted">${d.toLocaleDateString('es-ES', { weekday: 'long' })}${e.network ? ' · ' + e.network : ''}</div></div>
          </a>`;
        })}</div>`}
  </div>`;
}
