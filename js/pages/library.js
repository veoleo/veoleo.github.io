// Biblioteca propia (o de otra persona) con filtros por tipo, estado, año, ranking, género y plataforma.
import { html, useState, useMemo } from 'preact-standalone';
import { PosterCard, Seg, Chip, Empty, SkeletonGrid, Modal, Stars } from '../components/ui.js';
import { useStore, toast } from '../lib/store.js';
import { setQuery } from '../lib/router.js';
import { TYPES, STATUS_KEYS, STATUS_ICONS, statusLabel, entryYear, matchRules, sortEntries, uniq } from '../lib/utils.js';
import { platformsOf } from '../lib/metadata.js';
import { getNotesBulk } from '../lib/db.js';
import { bulkExportZip, bulkExportSingle } from '../lib/markdown.js';
import { sfx } from '../lib/sound.js';

const STATUS_COLORS = { completed: 'var(--teal)', in_progress: 'var(--yellow)', planned: 'var(--pink)', abandoned: 'var(--ink)' };

export function readFilters(q) {
  return {
    type: q.type || '', status: q.status || '', year: q.year || '', minRating: Number(q.min) || 0,
    genre: q.genre || '', platform: q.platform || '', format: q.format || '', text: q.q || '', sort: q.sort || 'recent',
  };
}

export function FilteredGrid({ entries, filters, setFilters, title, exportName = 'TVDaily', showExport = true }) {
  const { settings, lists } = useStore();
  const [exp, setExp] = useState(false);
  const f = filters;
  const set = (patch) => { const n = { ...f, ...patch }; setFilters(n); };

  const base = entries.filter((e) => (!f.type || e.type === f.type));
  const years = uniq(base.map(entryYear)).sort((a, b) => b - a);
  const genres = uniq(base.flatMap((e) => e.genres || [])).sort((a, b) => a.localeCompare(b, 'es'));
  const platforms = uniq(base.flatMap((e) => [e.platform, ...platformsOf(e), e.consumption?.readOn, e.consumption?.listenedOn])).sort();
  const counts = Object.fromEntries(STATUS_KEYS.map((s) => [s, base.filter((e) => e.status === s).length]));

  const shown = useMemo(() => sortEntries(base.filter((e) => matchRules(e, {
    statuses: f.status ? [f.status] : [], yearFrom: f.year, yearTo: f.year, minRating: f.minRating,
    genres: f.genre ? [f.genre] : [], formats: f.format ? [f.format] : [], platform: f.platform, text: f.text,
  })), f.sort), [entries, JSON.stringify(f)]);

  const anyFilter = f.status || f.year || f.minRating || f.genre || f.platform || f.format || f.text;
  return html`
    <div>
      ${title}
      <div class="stack" style="--g:16px;margin:24px 0">
        <${Seg} value=${f.type} onChange=${(v) => set({ type: v, genre: '', platform: '', format: '' })} options=${[
          { value: '', label: 'Todo', c: 'var(--ink)', fg: 'var(--paper-2)' },
          ...Object.values(TYPES).map((t) => ({ value: t.key, label: `${t.icon} ${t.plural}`, c: t.color, fg: t.key === 'book' ? 'var(--ink)' : 'var(--paper-2)' }))]} />
        <div class="panel filters" style="box-shadow:var(--sh-sm)">
          <div class="filter-row"><span class="label">Estado</span>
            <${Chip} on=${!f.status} onClick=${() => set({ status: '' })}>Todos <span class="pill-count">${base.length}</span></${Chip}>
            ${STATUS_KEYS.map((s) => html`<${Chip} key=${s} on=${f.status === s} color=${STATUS_COLORS[s]} light=${s === 'in_progress' || s === 'planned'} onClick=${() => set({ status: f.status === s ? '' : s })}>
              ${STATUS_ICONS[s]} ${statusLabel(s, f.type || 'any')} <span class="pill-count">${counts[s]}</span></${Chip}>`)}
          </div>
          <div class="filter-row"><span class="label">Ranking</span>
            ${[0, 1, 2, 3, 4, 5].map((n) => html`<${Chip} key=${n} on=${f.minRating === n} color="var(--yellow)" light onClick=${() => set({ minRating: n })}>${n ? '★'.repeat(n) + (n < 5 ? '+' : '') : 'Cualquiera'}</${Chip}>`)}
          </div>
          <div class="filter-row" style="--g:10px">
            <span class="label">Más</span>
            <select class="select" style="width:auto" value=${f.year} onChange=${(e) => set({ year: e.currentTarget.value })}>
              <option value="">Todos los años</option>${years.map((y) => html`<option value=${y}>${y}</option>`)}
            </select>
            <select class="select" style="width:auto" value=${f.genre} onChange=${(e) => set({ genre: e.currentTarget.value })}>
              <option value="">Todos los géneros</option>${genres.map((g) => html`<option>${g}</option>`)}
            </select>
            ${platforms.length > 0 && html`<select class="select" style="width:auto" value=${f.platform} onChange=${(e) => set({ platform: e.currentTarget.value })}>
              <option value="">Cualquier plataforma</option>${platforms.map((p) => html`<option>${p}</option>`)}
            </select>`}
            ${(!f.type || f.type === 'book' || f.type === 'audiobook') && html`<select class="select" style="width:auto" value=${f.format} onChange=${(e) => set({ format: e.currentTarget.value })}>
              <option value="">Leído o escuchado</option><option value="read">📖 Leídos</option><option value="listened">🎧 Escuchados</option>
            </select>`}
            <select class="select" style="width:auto" value=${f.sort} onChange=${(e) => set({ sort: e.currentTarget.value })}>
              <option value="recent">Recientes</option><option value="finished">Fecha de fin</option><option value="rating">Mejor valoradas</option><option value="title">Título A-Z</option><option value="year">Año de estreno</option>
            </select>
            <input class="input grow" style="min-width:180px" placeholder="Filtrar por título, autor, etiqueta…" value=${f.text} onInput=${(e) => set({ text: e.currentTarget.value })} />
          </div>
        </div>
        <div class="row between">
          <b>${shown.length} ${shown.length === 1 ? 'resultado' : 'resultados'}</b>
          <div class="row" style="--g:8px">
            ${anyFilter && html`<button class="btn sm ghost" onClick=${() => set({ status: '', year: '', minRating: 0, genre: '', platform: '', format: '', text: '' })}>✕ Limpiar filtros</button>`}
            ${showExport && shown.length > 0 && html`<button class="btn sm teal" onClick=${() => setExp(true)}>⬇ Exportar ${shown.length} a Markdown</button>`}
          </div>
        </div>
      </div>
      ${shown.length ? html`<div class="grid">${shown.map((e) => html`<${PosterCard} key=${e.id} e=${e} />`)}</div>`
        : html`<${Empty} word="¡NADA!" title="No hay nada con esos filtros" />`}
      ${exp && html`<${ExportModal} entries=${shown} name=${exportName} settings=${settings} lists=${lists} onClose=${() => setExp(false)} />`}
    </div>`;
}

export function ExportModal({ entries, name, settings, lists = [], onClose }) {
  const [prog, setProg] = useState(null);
  async function run(kind) {
    try {
      setProg([0, entries.length]);
      const notes = await getNotesBulk(entries.map((e) => e.id));
      const ids = new Set(entries.map((e) => e.id));
      const listsWithItems = lists.filter((l) => l.kind !== 'smart').map((l) => ({ ...l, items: entries.filter((e) => (l.itemIds || []).includes(e.id)) }))
        .filter((l) => l.items.length && l.items.every((e) => ids.has(e.id)));
      const cb = (d, t) => setProg([d, t]);
      if (kind === 'zip') await bulkExportZip(entries, notes, settings, listsWithItems, cb, `${name}.zip`);
      else await bulkExportSingle(entries, notes, settings, cb, `${name}.md`);
      sfx.braam(.7); toast('¡Exportación lista!', 'ok'); onClose();
    } catch (e) { console.error(e); toast('Falló la exportación: ' + e.message, 'err'); setProg(null); }
  }
  return html`<${Modal} title="Exportar a Markdown" color="var(--teal)" width=${620} onClose=${onClose}>
    ${prog ? html`<div class="stack" style="--g:12px;text-align:center">
        <div class="sfx" style="font-size:3rem;color:var(--teal);-webkit-text-stroke:2px var(--ink);paint-order:stroke fill">¡EXPORTANDO!</div>
        <div class="season"><div class="bar" style="margin:16px"><i style=${`width:${(prog[0] / Math.max(1, prog[1])) * 100}%`}></i></div></div>
        <b>${prog[0]} / ${prog[1]}</b><span class="small muted">Incluye episodios con sinopsis de las series (puede tardar un poco).</span></div>`
    : html`<div class="stack" style="--g:16px">
        <p style="margin:0">${entries.length} entradas con portada, ficha, tu nota, tráiler, banda sonora y episodios — formateado para Obsidian.</p>
        <button class="btn big teal" onClick=${() => run('zip')}>🗂 Bóveda Obsidian (.zip)</button>
        <p class="small muted" style="margin:-8px 0 0">Una nota por entrada en carpetas por tipo + índice con Dataview + listas + snippet CSS.</p>
        <button class="btn big" onClick=${() => run('single')}>📄 Un único archivo .md</button>
        <p class="small muted" style="margin:0">La plantilla se configura en <a href="#/settings">Ajustes</a>.</p>
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
    return html`<div class="page wrap"><${Empty} word="¡ESTRENO!" title="Tu biblioteca está vacía" sub="Busca tu serie, peli o libro favorito y empieza tu diario.">
      <a class="btn big red" href="#/search">🔎 Buscar algo</a></${Empty}></div>`;
  }
  return html`<div class="page wrap">
    <${FilteredGrid} entries=${entries} filters=${filters} setFilters=${setFilters}
      title=${html`<h1 class="mega">Mi <span class="mark blue tilt-r">biblioteca</span></h1>`} />
  </div>`;
}
