// Novedades: estrenos de series por plataforma, películas, libros y audiolibros del momento,
// calendario de tus próximos episodios y recomendaciones.
import { html, useState, useEffect } from 'preact-standalone';
import { PosterCard, Chip, Spinner, useAsync, SectionHead, Scramble } from '../components/ui.js';
import { PreviewModal, findExisting } from '../components/preview.js';
import { useStore } from '../lib/store.js';
import { discoverSections, STREAMERS, recommendationsFor, nextEpisodeOf } from '../lib/metadata.js';
import { feedFor } from '../lib/db.js';
import { humanDate, todayISO, TYPES } from '../lib/utils.js';
import { setQuery } from '../lib/router.js';

function Card({ it, onOpen, entries, label }) {
  const ex = findExisting(entries, it);
  const date = it.releaseDate && it.releaseDate.length === 10 ? humanDate(it.releaseDate) : it.year;
  return html`<${PosterCard} e=${ex ? { ...it, status: ex.status, rating: ex.rating } : it} href="javascript:void 0"
    onClick=${(ev) => { ev.preventDefault(); onOpen(it); }} showStatus=${!!ex}
    sub=${label || [it.premiereLabel || TYPES[it.type]?.label, it.network || date].filter(Boolean).join(' · ')} />`;
}

function Row({ s, onOpen, entries, color }) {
  if (!s?.items?.length) return null;
  return html`<section class="section reveal">
    <${SectionHead} kicker=${s.kicker} title=${s.title} color=${color}><span class="count">${s.items.length}</span></${SectionHead}>
    <div class="carousel">${s.items.map((it) => html`<${Card} key=${it.source + it.sourceId} it=${it} onOpen=${onOpen} entries=${entries} label=${it.because ? `Porque te gustó ${it.because}` : ''} />`)}</div>
  </section>`;
}

export function DiscoverPage({ route }) {
  const { settings, entries, following, user } = useStore();
  const [provider, setProvider] = useState(route.query.p || '');
  const [preview, setPreview] = useState(null);
  const disc = useAsync(() => discoverSections(settings, { provider }), [provider]);
  const recs = useAsync(() => recommendationsFor(entries, settings), [entries.length]);
  const community = useAsync(async () => {
    const list = await feedFor(following);
    const seen = new Set();
    return list.filter((e) => (e.rating || 0) >= 4 && e.ownerId !== user.uid && !findExisting(entries, e))
      .filter((e) => { const k = e.type + e.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 20);
  }, [following.join(','), entries.length]);
  useEffect(() => setQuery({ p: provider }), [provider]);
  const colors = ['var(--accent)', 'var(--blue)', 'var(--red)', 'var(--teal)', 'var(--yellow)', 'var(--purple)'];

  return html`<div class="page wrap">
    <div class="page-head">
      <div>
        <div class="kicker">Estrenos · Tendencias · Calendario</div>
        <h1 class="display" style="margin-top:20px"><${Scramble} text="Novedades" /></h1>
      </div>
    </div>
    <div class="row" style="--g:8px">
      <span class="label" style="margin-right:8px">Plataforma</span>
      <${Chip} on=${!provider} onClick=${() => setProvider('')}>Todas</${Chip}>
      ${STREAMERS.map((p) => html`<${Chip} key=${p} on=${provider === p} onClick=${() => setProvider(provider === p ? '' : p)}>${p}</${Chip}>`)}
    </div>

    <${Calendar} entries=${entries} settings=${settings} />
    ${!provider && recs.data?.length > 0 && html`<${Row} s=${{ kicker: 'Para ti', title: 'Recomendado', items: recs.data }} onOpen=${setPreview} entries=${entries} color="var(--pink)" />`}
    ${disc.loading ? html`<${Spinner} />` : (disc.data || []).map((s, i) => html`<${Row} key=${s.id} s=${s} onOpen=${setPreview} entries=${entries} color=${colors[i % colors.length]} />`)}
    ${!disc.loading && !(disc.data || []).length && html`<p class="muted section">No hay estrenos para ese filtro ahora mismo.</p>`}
    ${!provider && community.data?.length > 0 && html`<section class="section reveal">
      <${SectionHead} kicker="Comunidad" title="Triunfa entre la gente que sigues" color="var(--teal)" />
      <div class="carousel">${community.data.map((e) => html`<${PosterCard} key=${e.id} e=${e} showStatus=${false} sub=${`${String(e.rating).replace('.', ',')}★ · ${e.ownerName}`} />`)}</div>
    </section>`}
    ${preview && html`<${PreviewModal} item=${preview} onClose=${() => setPreview(null)} />`}
  </div>`;
}

// Próximos episodios de tus series (en curso, pendientes o terminadas que siguen en emisión).
export function Calendar({ entries, settings, compact = false }) {
  const series = entries.filter((e) => e.type === 'series' && e.status !== 'abandoned' && (e.status !== 'completed' || !/Ended|Canceled/.test(e.showStatus || '')));
  const key = series.map((e) => e.id).join(',');
  const cal = useAsync(async () => {
    const today = todayISO();
    const out = [];
    const queue = series.slice(0, 40);
    await Promise.all(Array.from({ length: 5 }, async () => {
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
  return html`<section class="section">
    <${SectionHead} kicker="Tu calendario" title="Próximos episodios" color="var(--red)" />
    ${cal.loading ? html`<${Spinner} />` : !cal.data?.length ? html`<p class="muted">Ninguna de tus series tiene episodios anunciados por ahora.</p>`
      : html`<div class="grid" style="--min:360px;gap:0 40px">${cal.data.slice(0, compact ? 6 : 30).map(({ e, n }) => {
          const d = new Date(n.airdate + 'T12:00:00');
          const days = Math.round((d - new Date(todayISO() + 'T12:00:00')) / 864e5);
          return html`<a class="cal-item" key=${e.id} href=${`#/item/${e.id}`}>
            <div class="cal-date"><b>${d.getDate()}</b><span>${d.toLocaleDateString('es-ES', { month: 'short' })}</span></div>
            <div style="min-width:0"><div style="font-weight:600">${e.title}</div><div class="count" style="margin-top:4px">${n.code} · ${n.name || ''}</div></div>
            <span class="tag" style=${`--c:${days === 0 ? 'var(--accent)' : 'var(--muted)'}`}>${days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `En ${days} d`}</span>
          </a>`;
        })}</div>`}
  </section>`;
}
