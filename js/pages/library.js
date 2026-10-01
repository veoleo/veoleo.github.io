// Biblioteca (propia o de otra persona) con filtros por tipo, estado, año, ranking, género y plataforma.
import { html, useState, useMemo, useEffect } from 'preact-standalone';
import { PosterCard, Tabs, Chip, SkeletonGrid, Modal, Icon, Scramble, LazyGrid } from '../components/ui.js';
import { useStore, toast } from '../lib/store.js';
import { setQuery } from '../lib/router.js';
import { TYPES, statusKeysFor, STATUS_COLORS, statusLabel, entryYear, matchRules, sortEntries, uniq } from '../lib/utils.js';
import { platformsOf } from '../lib/metadata.js';
import { getNotesBulk } from '../lib/db.js';
import { bulkExportZip, bulkExportSingle } from '../lib/markdown.js';
import { exportJSON, exportCSV } from '../lib/transfer.js';
import { exportExcel } from '../lib/excel.js';
import { sfx } from '../lib/sound.js';
import { flash } from '../lib/fx.js';


export function readFilters(q) {
  return {
    type: q.type || '', status: q.status || '', year: q.year || '', minRating: Number(q.min) || 0,
    genre: q.genre || '', platform: q.platform || '', format: q.format || '', text: q.q || '', sort: q.sort || 'recent',
  };
}

export function FilteredGrid({ entries, filters, setFilters, title, exportName = 'Veoleo', showExport = true }) {
  const { settings, lists } = useStore();
  const [exp, setExp] = useState(false);
  const f = filters;
  const set = (patch) => setFilters({ ...f, ...patch });

  const base = entries.filter((e) => !f.type || e.type === f.type);
  const years = uniq(base.map(entryYear)).sort((a, b) => b - a);
  const genres = uniq(base.flatMap((e) => e.genres || [])).sort((a, b) => a.localeCompare(b, 'es'));
  const platforms = uniq(base.flatMap((e) => [e.platform, ...platformsOf(e), e.consumption?.readOn, e.consumption?.listenedOn])).sort();
  const keys = statusKeysFor(f.type);
  const counts = Object.fromEntries(keys.map((s) => [s, base.filter((e) => e.status === s).length]));

  const shown = useMemo(() => sortEntries(base.filter((e) => matchRules(e, {
    statuses: f.status ? [f.status] : [], yearFrom: f.year, yearTo: f.year, minRating: f.minRating,
    genres: f.genre ? [f.genre] : [], formats: f.format ? [f.format] : [], platform: f.platform, text: f.text,
  })), f.sort), [entries, JSON.stringify(f)]);

  const anyFilter = f.status || f.year || f.minRating || f.genre || f.platform || f.format || f.text;
  return html`
    <div>
      ${title}
      <${Tabs} value=${f.type} onChange=${(v) => set({ type: v, genre: '', platform: '', format: '' })} options=${[
        { value: '', label: 'Todo', n: entries.length },
        ...Object.values(TYPES).map((t) => ({ value: t.key, label: t.plural, c: t.color, n: entries.filter((e) => e.type === t.key).length }))]} />
      <div class="filters" style="border-top:0">
        <div class="filter-row"><span class="label">Estado</span>
          <${Chip} on=${!f.status} onClick=${() => set({ status: '' })}>Todos <span class="n">${base.length}</span></${Chip}>
          ${keys.map((s) => html`<${Chip} key=${s} on=${f.status === s} color=${STATUS_COLORS[s]} onClick=${() => set({ status: f.status === s ? '' : s })}>
            ${statusLabel(s, f.type || 'any')} <span class="n">${counts[s]}</span></${Chip}>`)}
        </div>
        <div class="filter-row"><span class="label">Ranking</span>
          ${[0, 1, 2, 3, 4, 4.5, 5].map((n) => html`<${Chip} key=${n} on=${f.minRating === n} color="var(--yellow)" onClick=${() => set({ minRating: n })}>${n ? `${String(n).replace('.', ',')}★${n < 5 ? '+' : ''}` : 'Cualquiera'}</${Chip}>`)}
        </div>
        <div class="filter-row">
          <span class="label">Afinar</span>
          <select class="select" value=${f.year} onChange=${(e) => set({ year: e.currentTarget.value })}>
            <option value="">Todos los años</option>${years.map((y) => html`<option value=${y}>${y}</option>`)}
          </select>
          <select class="select" value=${f.genre} onChange=${(e) => set({ genre: e.currentTarget.value })}>
            <option value="">Todos los géneros</option>${genres.map((g) => html`<option>${g}</option>`)}
          </select>
          ${platforms.length > 0 && html`<select class="select" value=${f.platform} onChange=${(e) => set({ platform: e.currentTarget.value })}>
            <option value="">Cualquier plataforma</option>${platforms.map((p) => html`<option>${p}</option>`)}
          </select>`}
          ${(!f.type || f.type === 'book' || f.type === 'audiobook') && html`<select class="select" value=${f.format} onChange=${(e) => set({ format: e.currentTarget.value })}>
            <option value="">Leído o escuchado</option><option value="read">Leídos</option><option value="listened">Escuchados</option>
          </select>`}
          <select class="select" value=${f.sort} onChange=${(e) => set({ sort: e.currentTarget.value })}>
            <option value="recent">Recientes</option><option value="finished">Fecha de fin</option><option value="rating">Mejor valoradas</option><option value="title">Título A–Z</option><option value="year">Año de estreno</option>
          </select>
          <input class="input grow" style="min-width:200px" placeholder="Título, autoría, etiqueta…" value=${f.text} onInput=${(e) => set({ text: e.currentTarget.value })} />
        </div>
      </div>
      <div class="row between" style="margin:24px 0 32px">
        <span class="count">${shown.length} ${shown.length === 1 ? 'RESULTADO' : 'RESULTADOS'}</span>
        <div class="row" style="--g:8px">
          ${anyFilter && html`<button class="btn text" onClick=${() => set({ status: '', year: '', minRating: 0, genre: '', platform: '', format: '', text: '' })}>Limpiar filtros</button>`}
          ${showExport && shown.length > 0 && html`<button class="btn sm obsidian" onClick=${() => setExp('zip')} title="Bóveda de Obsidian (.zip)"><${Icon} name="obsidian" size=${14} /> Obsidian · ${shown.length}</button>
            <button class="btn sm ghost" onClick=${() => setExp(true)}><${Icon} name="download" size=${14} /> Exportar</button>`}
        </div>
      </div>
      ${shown.length ? html`<${LazyGrid} items=${shown} render=${(e) => html`<${PosterCard} key=${e.id} e=${e} />`} />`
        : html`<p class="lead">Nada coincide con esos filtros.</p>`}
      ${exp && html`<${ExportModal} entries=${shown} name=${exportName} settings=${settings} lists=${lists} auto=${exp === true ? '' : exp} onClose=${() => setExp(false)} />`}
    </div>`;
}

export function ExportModal({ entries, name, settings, lists = [], onClose, auto = '' }) {
  const [prog, setProg] = useState(null);
  useEffect(() => { if (auto) run(auto); }, []);
  async function run(kind) {
    try {
      if (kind === 'json') { await exportJSON(entries, `${name}.json`); done(); return; }
      if (kind === 'csv') { exportCSV(entries, `${name}.csv`); done(); return; }
      if (kind === 'letterboxd') { exportCSV(entries.filter((e) => e.type === 'movie'), `${name}-letterboxd.csv`, 'letterboxd'); done(); return; }
      if (kind === 'goodreads') { exportCSV(entries.filter((e) => e.type === 'book' || e.type === 'audiobook'), `${name}-goodreads.csv`, 'goodreads'); done(); return; }
      setProg([0, entries.length]);
      const notes = await getNotesBulk(entries.map((e) => e.id));
      if (kind === 'xlsx') { await exportExcel(entries, notes, { name, onProgress: (d, t) => setProg([d, t]) }); done(); return; }
      const ids = new Set(entries.map((e) => e.id));
      const listsWithItems = lists.filter((l) => l.kind !== 'smart').map((l) => ({ ...l, items: entries.filter((e) => (l.itemIds || []).includes(e.id)) }))
        .filter((l) => l.items.length && l.items.every((e) => ids.has(e.id)));
      const cb = (d, t) => setProg([d, t]);
      if (kind === 'zip') await bulkExportZip(entries, notes, settings, listsWithItems, cb, `${name}-obsidian.zip`);
      else await bulkExportSingle(entries, notes, settings, cb, `${name}.md`);
      done();
    } catch (e) { console.error(e); toast('Falló la exportación: ' + e.message, 'err'); setProg(null); }
  }
  function done() { sfx.braam(0.4); flash('Exportado', '#c6ff3d'); onClose(); }
  const Opt = ({ k, t, d }) => html`<button class="list-card" style="text-align:left;background:none;border-left:0;border-right:0;border-bottom:0;cursor:pointer;padding:20px 0;width:100%;color:inherit;font:inherit" onClick=${() => run(k)}>
    <h3>${t}</h3><span class="label" style="text-transform:none;letter-spacing:.02em;font-size:.85rem">${d}</span></button>`;
  return html`<${Modal} kicker=${auto ? 'Obsidian' : 'Exportar'} color=${auto ? 'var(--purple)' : 'var(--accent)'} title=${`${entries.length} entradas`} width=${640} onClose=${onClose}>
    ${prog ? html`<div class="stack" style="--g:18px">
        <h2 class="display" style="font-size:4rem">${Math.round((prog[0] / Math.max(1, prog[1])) * 100)}%</h2>
        <div class="season"><div class="sbar" style="height:2px"><i style=${`width:${(prog[0] / Math.max(1, prog[1])) * 100}%`}></i></div></div>
        <span class="count">${prog[0]} / ${prog[1]} · INCLUYE EPISODIOS CON SINOPSIS</span></div>`
    : html`<div class="stack" style="--g:0">
        <${Opt} k="zip" t="Bóveda de Obsidian (.zip)" d="Una nota por título en carpetas por tipo, con portada, valoración, episodios y tu nota. Índice con Dataview, listas y snippet CSS." />
        <${Opt} k="xlsx" t="Excel con portadas (.xlsx)" d="Una hoja por tipo con portada, estado, estrellas, fechas, progreso y tus notas, más un resumen." />
        <${Opt} k="single" t="Un único Markdown" d="Todas las notas en un solo archivo .md." />
        <${Opt} k="csv" t="Hoja de cálculo (CSV)" d="Título, tipo, estado, valoración, fechas, plataforma y más." />
        <${Opt} k="letterboxd" t="CSV para Letterboxd" d="Tus películas en el formato de importación de Letterboxd." />
        <${Opt} k="goodreads" t="CSV para Goodreads" d="Tus libros en el formato de importación de Goodreads." />
        <${Opt} k="json" t="Copia de seguridad (JSON)" d="Todo, incluidas tus notas. Se puede volver a importar." />
      </div>`}
  </${Modal}>`;
}

export function LibraryPage({ route }) {
  const { entries, entriesReady } = useStore();
  const [filters, setF] = useState(() => readFilters(route.query));
  const setFilters = (n) => {
    setF(n);
    setQuery({ type: n.type, status: n.status, year: n.year, min: n.minRating || '', genre: n.genre, platform: n.platform, format: n.format, q: n.text, sort: n.sort === 'recent' ? '' : n.sort });
  };
  if (!entriesReady) return html`<div class="page wrap"><${SkeletonGrid} n=${12} /></div>`;
  if (!entries.length) {
    return html`<div class="page wrap"><div class="empty"><div class="kicker">Biblioteca</div><h1 class="display" style="margin:20px 0">Vacía,<br />de momento.</h1>
      <p class="lead">Busca tu primera serie, película o libro, o trae tu historial de TV Time, Letterboxd o Goodreads.</p>
      <div class="row" style="margin-top:28px"><a class="btn lg" href="#/search"><${Icon} name="search" /> Buscar</a><a class="btn lg ghost" href="#/data"><${Icon} name="upload" /> Importar</a></div></div></div>`;
  }
  return html`<div class="page wrap">
    <${FilteredGrid} entries=${entries} filters=${filters} setFilters=${setFilters}
      title=${html`<div class="page-head"><div><div class="kicker">${entries.length} títulos</div><h1 class="display" style="margin-top:20px"><${Scramble} text="Biblioteca" /></h1></div></div>`} />
  </div>`;
}
