// Estadísticas: tu año en pantalla y en páginas.
import { html, useState, useMemo } from 'preact-standalone';
import { Tabs, SectionHead, PosterCard, CountUp, Scramble } from '../components/ui.js';
import { useStore } from '../lib/store.js';
import { TYPES, entryYear, toMillis } from '../lib/utils.js';
import { platformsOf } from '../lib/metadata.js';

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

function tally(list, fn) {
  const m = new Map();
  for (const e of list) for (const k of [].concat(fn(e) || [])) if (k) m.set(k, (m.get(k) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export function computeStats(entries, year) {
  const inYear = (e) => (year === 'all' ? true : entryYear(e) === year);
  const done = entries.filter((e) => e.status === 'completed' && inYear(e));
  const movieMin = done.filter((e) => e.type === 'movie').reduce((a, e) => a + (e.runtime || 110) * (1 + (e.rewatch || 0)), 0);
  const epMin = entries.filter((e) => e.type === 'series' && (year === 'all' || entryYear(e) === year)).reduce((a, e) => a + (e.watchedMinutes || (e.watchedEpisodes || []).length * (e.runtime || 45)), 0);
  const pages = done.filter((e) => e.type === 'book' || (e.consumption?.read && e.type === 'audiobook')).reduce((a, e) => a + (Number(e.pages) || 0), 0);
  const episodes = entries.filter((e) => year === 'all' || entryYear(e) === year).reduce((a, e) => a + (e.watchedEpisodes || []).length, 0);
  const rated = done.filter((e) => e.rating > 0);
  const avg = rated.length ? rated.reduce((a, e) => a + e.rating, 0) / rated.length : 0;
  return { done, hours: Math.round((movieMin + epMin) / 60), pages, episodes, avg, rated };
}

export function StatsPage() {
  const { entries } = useStore();
  const years = [...new Set([new Date().getFullYear(), ...entries.map(entryYear).filter(Boolean)])].sort((a, b) => b - a);
  const [year, setYear] = useState(years[0]);
  const s = useMemo(() => computeStats(entries, year), [entries, year]);

  // Mapa de actividad: últimos 53 semanas (o el año elegido).
  const heat = useMemo(() => {
    const counts = new Map();
    for (const e of entries) for (const d of [e.finishedAt, e.startedAt, e.updatedAt && new Date(toMillis(e.updatedAt)).toISOString().slice(0, 10)]) {
      if (d) counts.set(d.slice(0, 10), (counts.get(d.slice(0, 10)) || 0) + 1);
    }
    const end = year === 'all' || year === new Date().getFullYear() ? new Date() : new Date(`${year}-12-31T12:00:00`);
    const start = new Date(end); start.setDate(start.getDate() - 364 - start.getDay());
    const days = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const k = d.toISOString().slice(0, 10); const n = counts.get(k) || 0;
      days.push({ k, n, l: n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4 });
    }
    return days;
  }, [entries, year]);

  const byMonth = MONTHS.map((_, m) => s.done.filter((e) => e.finishedAt && Number(e.finishedAt.slice(5, 7)) === m + 1));
  const maxM = Math.max(1, ...byMonth.map((l) => l.length));
  const dist = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((r) => s.rated.filter((e) => e.rating === r).length);
  const maxD = Math.max(1, ...dist);
  const genres = tally(s.done, (e) => e.genres).slice(0, 10);
  const creators = tally(s.done, (e) => (e.creators || []).slice(0, 2)).slice(0, 8);
  const plats = tally(s.done, (e) => [e.platform || platformsOf(e)[0], e.consumption?.readOn, e.consumption?.listenedOn]).slice(0, 8);
  const best = [...s.rated].sort((a, b) => b.rating - a.rating).slice(0, 8);
  const maxG = genres[0]?.[1] || 1;

  return html`<div class="page wrap">
    <div class="page-head">
      <div><div class="kicker">Estadísticas</div><h1 class="display" style="margin-top:20px"><${Scramble} text=${year === 'all' ? 'Siempre' : String(year)} /></h1></div>
    </div>
    <${Tabs} value=${year} onChange=${setYear} options=${[...years.map((y) => ({ value: y, label: String(y) })), { value: 'all', label: 'Todo' }]} />

    <div class="stats" style="margin-top:48px">
      <div class="stat"><b><${CountUp} value=${s.done.length} /></b><span>Títulos terminados</span></div>
      <div class="stat" style="--c:var(--blue)"><b><${CountUp} value=${s.hours} /><small> h</small></b><span>De pantalla</span></div>
      <div class="stat" style="--c:var(--teal)"><b><${CountUp} value=${s.episodes} /></b><span>Episodios</span></div>
      <div class="stat" style="--c:var(--yellow)"><b><${CountUp} value=${s.pages} /></b><span>Páginas</span></div>
      <div class="stat" style="--c:var(--pink)"><b>${s.avg ? s.avg.toFixed(1).replace('.', ',') : '—'}</b><span>Nota media</span></div>
    </div>

    <section class="section">
      <${SectionHead} kicker="Actividad" title="Cada día cuenta" />
      <div class="heat">${heat.map((d) => html`<i key=${d.k} data-l=${d.l} title=${`${d.k}: ${d.n}`}></i>`)}</div>
    </section>

    <div class="cols-2 section">
      <section>
        <${SectionHead} kicker="Por mes" title="Terminados" color="var(--blue)" />
        <div class="bars">${byMonth.map((l, i) => html`<div key=${i} title=${`${l.length} terminados`}>
          <b>${l.length || ''}</b><i style=${`height:${(l.length / maxM) * 100}%;animation-delay:${i * 40}ms`}></i><span>${MONTHS[i]}</span></div>`)}</div>
        <div class="row" style="--g:20px;margin-top:20px">${Object.values(TYPES).map((t) => html`<span class="tag" style=${`--c:${t.color}`}>${t.plural} · ${s.done.filter((e) => e.type === t.key).length}</span>`)}</div>
      </section>
      <section>
        <${SectionHead} kicker="Tus notas" title="Distribución" color="var(--yellow)" />
        <div class="bars" style="--c:var(--yellow)">${dist.map((n, i) => html`<div key=${i}><b>${n || ''}</b><i style=${`height:${(n / maxD) * 100}%;animation-delay:${i * 40}ms`}></i><span>${String((i + 1) / 2).replace('.', ',')}</span></div>`)}</div>
      </section>
    </div>

    <div class="cols-2 section">
      <section>
        <${SectionHead} kicker="Géneros" title="Lo que más te gusta" color="var(--pink)" />
        ${genres.length ? genres.map(([g, n], i) => html`<div class="hbar" key=${g} style=${`--c:${['var(--accent)', 'var(--blue)', 'var(--pink)', 'var(--teal)', 'var(--yellow)'][i % 5]}`}><span>${g}</span><div class="t"><i style=${`width:${(n / maxG) * 100}%`}></i></div><span class="v">${n}</span></div>`) : html`<p class="muted">Sin datos todavía.</p>`}
      </section>
      <aside class="stack" style="--g:48px">
        <section>
          <${SectionHead} kicker="Dónde" title="Plataformas" color="var(--teal)" />
          ${plats.length ? html`<dl class="kv">${plats.map(([p, n]) => html`<dt>${p}</dt><dd>${n}</dd>`)}</dl>` : html`<p class="muted">Sin datos todavía.</p>`}
        </section>
        <section>
          <${SectionHead} kicker="Autoría" title="Recurrentes" color="var(--purple)" />
          ${creators.length ? html`<dl class="kv">${creators.map(([p, n]) => html`<dt>${n}×</dt><dd>${p}</dd>`)}</dl>` : html`<p class="muted">Sin datos todavía.</p>`}
        </section>
      </aside>
    </div>

    ${best.length > 0 && html`<section class="section"><${SectionHead} kicker="Lo mejor" title=${year === 'all' ? 'Tus favoritos' : `Lo mejor de ${year}`} color="var(--yellow)" />
      <div class="grid">${best.map((e) => html`<${PosterCard} key=${e.id} e=${e} />`)}</div></section>`}
  </div>`;
}
