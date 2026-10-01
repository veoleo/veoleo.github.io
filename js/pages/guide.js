// Guía TV: tus próximos episodios y la programación del día por plataforma, como la parrilla de siempre.
import { DEFAULT_REGION } from '../lib/i18n.js';
import { html, useState, useMemo } from 'preact-standalone';
import { useAsync, Tabs, Chip, Spinner, Cover, Icon, Scramble, SectionHead } from '../components/ui.js';
import { PreviewModal } from '../components/preview.js';
import { useStore, toast } from '../lib/store.js';
import { scheduleFor, showInfo, seriesStatusFor } from '../lib/metadata.js';
import { myEpisodes } from '../lib/sync.js';
import { updateEntry } from '../lib/db.js';
import { todayISO, uniq } from '../lib/utils.js';
import { setQuery } from '../lib/router.js';
import { sfx } from '../lib/sound.js';
import { burstAt } from '../lib/fx.js';

const iso = (d) => d.toISOString().slice(0, 10);
const dayLabel = (s) => {
  const t = todayISO();
  const tm = iso(new Date(Date.now() + 864e5));
  const d = new Date(s + 'T12:00:00');
  const long = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return s === t ? `Hoy · ${long}` : s === tm ? `Mañana · ${long}` : long;
};

export function GuidePage({ route }) {
  const [tab, setTab] = useState(route.query.tab || 'mine');
  return html`<div class="page wrap">
    <div class="page-head"><div><div class="kicker">Episodios · Estrenos · Parrilla</div><h1 class="display" style="margin-top:20px"><${Scramble} text="Guía TV" /></h1></div></div>
    <${Tabs} value=${tab} onChange=${(v) => { setTab(v); setQuery({ tab: v }); }} options=${[{ value: 'mine', label: 'Mis series' }, { value: 'grid', label: 'Programación', c: 'var(--blue)' }]} />
    <div style="margin-top:40px">${tab === 'mine' ? html`<${MySeries} />` : html`<${Schedule} />`}</div>
  </div>`;
}

function MySeries() {
  const { entries, entriesReady } = useStore();
  const [plat, setPlat] = useState('');
  const st = useAsync(() => (entriesReady ? myEpisodes(entries) : Promise.resolve(null)), [entriesReady, entries.map((e) => `${e.id}:${e.status}:${(e.watchedEpisodes || []).length}`).join(',')]);
  if (st.loading || !st.data) return html`<${Spinner} />`;
  const { upcoming, pending } = st.data;
  const plats = uniq([...upcoming, ...pending].map((x) => x.platform)).sort();
  const f = (x) => !plat || x.platform === plat;
  const groups = new Map();
  for (const x of upcoming.filter(f)) { if (!groups.has(x.airdate)) groups.set(x.airdate, []); groups.get(x.airdate).push(x); }

  async function markSeen(x, ev) {
    const el = ev.currentTarget;
    const list = [...new Set([...(x.e.watchedEpisodes || []), x.code])].sort();
    const info = await showInfo(x.e).catch(() => null);
    const patch = { watchedEpisodes: list };
    const status = seriesStatusFor(x.e, info, list);
    if (status !== x.e.status) patch.status = status;
    try { await updateEntry(x.e.id, patch); sfx.tick(6); burstAt(el, { count: 8, spread: 40 }); }
    catch (e) { toast(e.message, 'err'); }
  }

  if (!upcoming.length && !pending.length) {
    return html`<div class="empty" style="padding-top:20px"><h2 class="h1">Nada en el horizonte</h2>
      <p class="lead" style="margin-top:16px">Cuando sigas series en emisión (Viendo, Al día o Must watch) verás aquí sus próximos episodios y los que te faltan por ver.</p>
      <div class="row" style="margin-top:24px"><a class="btn" href="#/discover">Ver novedades</a><a class="btn ghost" href="#/search">Buscar una serie</a></div></div>`;
  }
  return html`<div>
    ${plats.length > 1 && html`<div class="row" style="--g:8px;margin-bottom:40px"><span class="label" style="margin-right:6px">Plataforma</span>
      <${Chip} on=${!plat} onClick=${() => setPlat('')}>Todas</${Chip}>${plats.map((p) => html`<${Chip} key=${p} on=${plat === p} onClick=${() => setPlat(plat === p ? '' : p)}>${p}</${Chip}>`)}</div>`}

    ${pending.filter(f).length > 0 && html`<section style="margin-bottom:72px">
      <${SectionHead} kicker="Ya emitidos" title="Te faltan por ver" color="var(--yellow)"><span class="count">${pending.filter(f).length}</span></${SectionHead}>
      ${pending.filter(f).map((x) => html`<${EpRow} key=${x.e.id + x.code} x=${x} action=${html`<label class="check" title="Marcar visto"><input type="checkbox" onChange=${(ev) => markSeen(x, ev)} aria-label="Marcar visto" /></label>`} />`)}
    </section>`}

    ${[...groups.entries()].map(([d, items]) => html`<section key=${d} style="margin-bottom:48px">
      <div class="label" style=${`margin-bottom:6px;color:${d === todayISO() ? 'var(--accent)' : 'var(--muted)'}`}>${dayLabel(d)}</div>
      ${items.map((x) => html`<${EpRow} key=${x.e.id + x.code} x=${x} />`)}
    </section>`)}
  </div>`;
}

function EpRow({ x, action }) {
  return html`<div class="cal-item" style="grid-template-columns:56px 1fr auto auto">
    <a href=${`#/item/${x.e.id}`} class="thumb"><${Cover} src=${x.e.cover} title=${x.e.title} type="series" w=${120} /></a>
    <a href=${`#/item/${x.e.id}`} style="min-width:0;text-decoration:none">
      <div style="font-weight:600">${x.e.title}</div>
      <div class="count" style="margin-top:4px">${x.code} · ${x.name || 'Por anunciar'}${x.airtime ? ` · ${x.airtime}` : ''}</div>
    </a>
    ${x.platform ? html`<span class="tag hide-sm" style="--c:var(--blue)">${x.platform}</span>` : html`<span></span>`}
    ${action || html`<span class="count">${x.airdate.slice(8, 10)}/${x.airdate.slice(5, 7)}</span>`}
  </div>`;
}

function Schedule() {
  const { entries, settings } = useStore();
  const days = Array.from({ length: 8 }, (_, i) => iso(new Date(Date.now() + i * 864e5)));
  const [day, setDay] = useState(days[0]);
  const [country, setCountry] = useState(settings.region || DEFAULT_REGION);
  const [plats, setPlats] = useState([]);
  const [onlyMine, setOnlyMine] = useState(false);
  const [onlyPrem, setOnlyPrem] = useState(false);
  const [langs, setLangs] = useState(true);
  const [preview, setPreview] = useState(null);
  const st = useAsync(() => scheduleFor(day, country), [day, country]);
  const mineIds = useMemo(() => new Set(entries.map((e) => e.ids?.tvmaze).filter(Boolean)), [entries]);
  const mineTitles = useMemo(() => new Set(entries.filter((e) => e.type === 'series').map((e) => e.title.toLowerCase())), [entries]);
  const isMine = (x) => mineIds.has(x.showId) || mineTitles.has(x.title.toLowerCase());

  const LANGS = /^(english|spanish|catalan|basque|galician)$/i;
  const items = (st.data || []).filter((x) => (!onlyMine || isMine(x)) && (!onlyPrem || x.premiere) && (!langs || LANGS.test(x.language) || isMine(x)));
  const byPlat = new Map();
  for (const x of items) { if (!byPlat.has(x.platform)) byPlat.set(x.platform, []); byPlat.get(x.platform).push(x); }
  const allPlats = [...byPlat.entries()].sort((a, b) => b[1].reduce((s, x) => s + x.weight, 0) - a[1].reduce((s, x) => s + x.weight, 0)).map(([p]) => p);
  const shown = allPlats.filter((p) => !plats.length || plats.includes(p));

  return html`<div>
    <div class="tabs" style="border-bottom:0;margin-bottom:20px">${days.map((d, i) => {
      const dt = new Date(d + 'T12:00:00');
      return html`<button key=${d} class=${day === d ? 'on' : ''} onClick=${() => { setDay(d); sfx.click(); }}>
        ${i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : dt.toLocaleDateString('es-ES', { weekday: 'short' })} <span class="n">${dt.getDate()}</span></button>`;
    })}</div>
    <div class="filters" style="margin-bottom:40px">
      <div class="filter-row"><span class="label">Ver</span>
        <${Chip} on=${onlyMine} color="var(--accent)" onClick=${() => setOnlyMine(!onlyMine)}>Solo mis series</${Chip}>
        <${Chip} on=${onlyPrem} color="var(--pink)" onClick=${() => setOnlyPrem(!onlyPrem)}>Solo estrenos</${Chip}>
        <${Chip} on=${langs} color="var(--blue)" fg="#fff" onClick=${() => setLangs(!langs)}>Español e inglés</${Chip}>
        <select class="select" value=${country} onChange=${(e) => setCountry(e.currentTarget.value)} title="Canales de TV del país">
          ${[['ES', 'TV España'], ['US', 'TV EE. UU.'], ['GB', 'TV Reino Unido'], ['MX', 'TV México'], ['AR', 'TV Argentina']].map(([v, l]) => html`<option value=${v}>${l}</option>`)}
        </select>
      </div>
      ${allPlats.length > 1 && html`<div class="filter-row"><span class="label">Canal</span>
        <${Chip} on=${!plats.length} onClick=${() => setPlats([])}>Todos</${Chip}>
        ${allPlats.slice(0, 24).map((p) => html`<${Chip} key=${p} on=${plats.includes(p)} color="var(--blue)" fg="#fff" onClick=${() => setPlats(plats.includes(p) ? plats.filter((x) => x !== p) : [...plats, p])}>${p}</${Chip}>`)}
      </div>`}
    </div>

    ${st.loading ? html`<${Spinner} />` : !shown.length ? html`<p class="lead">No hay emisiones con esos filtros.</p>` : html`
      <div class="guide">${shown.map((p) => html`<div class="tvrow" key=${p}>
        <div class="ch"><b>${p}</b><span class="count">${byPlat.get(p).length} EMISIONES</span></div>
        <div class="progs">${byPlat.get(p).sort((a, b) => (a.airtime || '99').localeCompare(b.airtime || '99') || b.weight - a.weight).slice(0, 30).map((x) => html`
          <button class=${'prog' + (isMine(x) ? ' mine' : '') + (x.premiere ? ' prem' : '')} key=${x.showId + x.code} onClick=${() => setPreview({ source: 'tvmaze', sourceId: x.showId, tvmazeId: x.showId, type: 'series', title: x.title, cover: x.cover, year: x.year, imdbId: x.imdbId })}>
            <span class="t">${x.airtime || '—'}</span>
            <span class="pc"><${Cover} src=${x.cover} title=${x.title} type="series" w=${120} /></span>
            <span class="i"><b>${x.title}</b><span>${x.code}${x.name ? ' · ' + x.name : ''}</span>
              ${x.newShow ? html`<em>Nueva serie</em>` : x.premiere ? html`<em>Estreno de temporada</em>` : isMine(x) ? html`<em class="m">En tu diario</em>` : ''}</span>
          </button>`)}</div>
      </div>`)}</div>`}
    ${preview && html`<${PreviewModal} item=${preview} onClose=${() => setPreview(null)} />`}
  </div>`;
}
