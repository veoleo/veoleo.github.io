// Biblioteca (propia o de otra persona) con filtros por tipo, estado, año, ranking, género y plataforma.
import { html, useState, useMemo, useEffect, useRef } from 'preact-standalone';
import { PosterCard, Tabs, Chip, SkeletonGrid, Modal, Icon, Scramble, LazyGrid } from '../components/ui.js';
import { useStore, toast } from '../lib/store.js';
import { setQuery } from '../lib/router.js';
import { TYPES, statusKeysFor, STATUS_COLORS, statusLabel, entryYear, matchRules, sortEntries, uniq } from '../lib/utils.js';
import { platformsOf } from '../lib/metadata.js';
import { getNotesBulk, bulkUpdateEntries, bulkDeleteEntries } from '../lib/db.js';
import { YEARS, CUR_YEAR, yearPatch } from '../components/yearpick.js';
import { t as tr } from '../lib/i18n.js';
import { bulkExportZip, bulkExportSingle } from '../lib/markdown.js';
import { exportJSON, exportCSV } from '../lib/transfer.js';
import { exportExcel } from '../lib/excel.js';
import { sfx } from '../lib/sound.js';
import { flash } from '../lib/fx.js';


export function readFilters(q) {
  return {
    type: q.type || '', status: q.status || '', year: q.year || '', minRating: Number(q.min) || 0,
    genre: q.genre || '', platform: q.platform || '', format: q.format || '', text: q.q || '', sort: q.sort || 'recent', eps: q.eps || '', src: q.src || '',
  };
}

export function FilteredGrid({ entries, filters, setFilters, title, exportName = 'Veoleo', showExport = true }) {
  const { settings, lists } = useStore();
  const [exp, setExp] = useState(false);
  // Selección múltiple: tick en cada póster, Mayús+clic para un rango, «Seleccionar todo» para lo filtrado.
  const [selMode, setSelMode] = useState(false);
  const [sel, setSel] = useState(() => new Set());
  const lastIdx = useRef(-1);
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
  }) && (!f.eps || (e.type === 'series' && (e.watchedEpisodes || []).length >= 1 && (e.watchedEpisodes || []).length <= Number(f.eps)))
    && (!f.src || (f.src === 'import' ? e.source?.name === 'import' : e.source?.name !== 'import'))), f.sort), [entries, JSON.stringify(f)]);

  const anyFilter = f.status || f.year || f.minRating || f.genre || f.platform || f.format || f.text || f.eps || f.src;
  function pickCard(e, range) {
    const i = shown.findIndex((x) => x.id === e.id);
    const next = new Set(sel);
    if (range && lastIdx.current >= 0) {
      const [a, b] = [Math.min(lastIdx.current, i), Math.max(lastIdx.current, i)];
      for (let k = a; k <= b; k++) next.add(shown[k].id);
    } else if (next.has(e.id)) next.delete(e.id); else next.add(e.id);
    lastIdx.current = i; setSel(next); sfx.tick(next.size % 6);
  }
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
            ${base.some((e) => e.status !== 'planned' && !entryYear(e)) && html`<option value="unknown">Otros años</option>`}
          </select>
          <select class="select" value=${f.genre} onChange=${(e) => set({ genre: e.currentTarget.value })}>
            <option value="">Todos los géneros</option>${genres.map((g) => html`<option>${g}</option>`)}
          </select>
          ${platforms.length > 0 && html`<select class="select" value=${f.platform} onChange=${(e) => set({ platform: e.currentTarget.value })}>
            <option value="">Cualquier plataforma</option>${platforms.map((p) => html`<option>${p}</option>`)}
          </select>`}
          ${(!f.type || f.type === 'series') && html`<select class="select" value=${f.eps} title="Series con pocos episodios vistos: útil para limpiar importaciones" onChange=${(e) => set({ eps: e.currentTarget.value })}>
            <option value="">Episodios vistos</option><option value="1">Solo 1 episodio</option><option value="2">1–2 episodios</option><option value="5">Hasta 5 episodios</option>
          </select>`}
          <select class="select" value=${f.src} onChange=${(e) => set({ src: e.currentTarget.value })}>
            <option value="">Cualquier origen</option><option value="import">Importados</option><option value="manual">Añadidos a mano</option>
          </select>
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
          ${anyFilter && html`<button class="btn text" onClick=${() => set({ status: '', year: '', minRating: 0, genre: '', platform: '', format: '', text: '', eps: '', src: '' })}>Limpiar filtros</button>`}
          ${showExport && shown.length > 0 && html`<button class=${'btn sm ' + (selMode ? '' : 'ghost')} onClick=${() => { setSelMode(!selMode); setSel(new Set()); lastIdx.current = -1; sfx.click(); }}><${Icon} name="check" size=${14} /> ${selMode ? 'Terminar selección' : 'Seleccionar'}</button>`}
          ${showExport && shown.length > 0 && html`<button class="btn sm obsidian" onClick=${() => setExp('zip')} title="Bóveda de Obsidian (.zip)"><${Icon} name="obsidian" size=${14} /> Obsidian · ${shown.length}</button>
            <button class="btn sm ghost" onClick=${() => setExp(true)}><${Icon} name="download" size=${14} /> Exportar</button>
            <a class="btn sm ghost" href="#/graph"><${Icon} name="graph" size=${14} /> Grafo</a>`}
        </div>
      </div>
      ${shown.length ? html`<${LazyGrid} items=${shown} class=${'grid' + (selMode ? ' selecting' : '')} render=${(e, i) => html`<div key=${e.id} class=${'sel-wrap' + (sel.has(e.id) ? ' on' : '')}
          onClickCapture=${selMode ? (ev) => { ev.preventDefault(); ev.stopPropagation(); pickCard(e, ev.shiftKey); } : null}>
          ${selMode && html`<span class="sel-tick" aria-hidden="true"><${Icon} name="check" size=${16} /></span>`}
          <${PosterCard} e=${e} /></div>`} />`
        : html`<p class="lead">Nada coincide con esos filtros.</p>`}
      ${selMode && html`<${BulkBar} shown=${shown} sel=${sel} setSel=${setSel} type=${f.type} onDone=${() => { setSel(new Set()); }} onExit=${() => { setSelMode(false); setSel(new Set()); }} />`}
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
    setQuery({ type: n.type, status: n.status, year: n.year, min: n.minRating || '', genre: n.genre, platform: n.platform, format: n.format, q: n.text, sort: n.sort === 'recent' ? '' : n.sort, eps: n.eps, src: n.src });
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

// Barra de acciones en bloque: estado, año, privacidad y eliminar.
function BulkBar({ shown, sel, setSel, type, onDone, onExit }) {
  const [busy, setBusy] = useState(false);
  const chosen = shown.filter((e) => sel.has(e.id));
  const n = chosen.length;
  const run = async (label, fn) => {
    if (!n || busy) return;
    setBusy(true);
    try { const k = await fn(); flash(`${k} ${tr('actualizados')}`, '#c6ff3d'); sfx.chime(); toast(`${label}: ${k}`, 'ok'); onDone(); }
    catch (x) { toast(x.message, 'err'); } finally { setBusy(false); }
  };
  const setStatus = (k) => run(tr(statusLabel(k, type || 'any')), () => bulkUpdateEntries(chosen, (e) => {
    if (k === 'up_to_date' && e.type !== 'series') return null;
    const p = { status: k, statusManual: true };
    if (k === 'planned') { p.finishedAt = ''; }
    return p;
  }));
  const setYear = (v) => run(tr('Año'), () => bulkUpdateEntries(chosen, (e) => (e.status === 'planned' ? null : yearPatch(v === 'unknown' ? 'unknown' : Number(v) === CUR_YEAR ? 'this' : Number(v), e.finishedAt))));
  const setVis = (v) => run(tr(v === 'private' ? 'Solo para ti' : 'Visible en tu perfil'), () => bulkUpdateEntries(chosen, () => ({ visibility: v, ...(v === 'private' ? { notePublic: false } : {}) })));
  const del = () => { if (!confirm(tr(`¿Eliminar ${n} títulos de tu diario? Se borran también sus notas. No se puede deshacer.`))) return; run(tr('Eliminados'), () => bulkDeleteEntries(chosen)); };
  return html`<div class="bulk-bar" role="toolbar" aria-label="Acciones en bloque">
    <div class="bulk-top">
      <b>${n} ${n === 1 ? 'seleccionado' : 'seleccionados'}</b>
      <button class="btn text" onClick=${() => setSel(new Set(shown.map((e) => e.id)))}>Seleccionar todo (${shown.length})</button>
      ${n > 0 && html`<button class="btn text" onClick=${() => setSel(new Set())}>Ninguno</button>`}
      <button class="btn icon text" style="margin-left:auto" aria-label="Cerrar" onClick=${onExit}><${Icon} name="close" size=${16} /></button>
    </div>
    <div class="bulk-acts">
      <span class="label">Estado</span>
      ${statusKeysFor(type).map((k) => html`<button key=${k} class="bulk-st" style=${`--c:${STATUS_COLORS[k]}`} disabled=${!n || busy} onClick=${() => setStatus(k)}>${statusLabel(k, type || 'any')}</button>`)}
      <select class="select" disabled=${!n || busy} value="" onChange=${(e) => { const v = e.currentTarget.value; e.currentTarget.value = ''; if (v) setYear(v); }}>
        <option value="">Año…</option><option value="unknown">Otros años</option>${YEARS.map((y) => html`<option value=${y}>${y}</option>`)}</select>
      <select class="select" disabled=${!n || busy} value="" onChange=${(e) => { const v = e.currentTarget.value; e.currentTarget.value = ''; if (v) setVis(v); }}>
        <option value="">Privacidad…</option><option value="public">Visible en tu perfil</option><option value="private">Solo para ti</option></select>
      <button class="btn sm danger" disabled=${!n || busy} onClick=${del}><${Icon} name="trash" size=${14} /> Eliminar</button>
    </div>
  </div>`;
}
