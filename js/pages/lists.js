// Listas: del sistema (Must watch, Abandonadas…), automáticas por año, inteligentes y manuales.
import { html, useState, useEffect } from 'preact-standalone';
import { PosterCard, Chip, Modal, Switch, Spinner, Avatar, Stars, Cover, Icon, SectionHead, Scramble, shareLink } from '../components/ui.js';
import { ExportModal } from './library.js';
import { useStore, toast } from '../lib/store.js';
import { createList, updateList, deleteList, getList, publicEntriesOf } from '../lib/db.js';
import { TYPES, STATUS_KEYS, statusLabel, entryYear, matchRules, describeRules, sortEntries, uniq, download, safeFilename } from '../lib/utils.js';
import { listNote } from '../lib/markdown.js';
import { go } from '../lib/router.js';
import { sfx } from '../lib/sound.js';
import { flash } from '../lib/fx.js';

const VERB = { series: 'vistas', movie: 'vistas', book: 'leídos', audiobook: 'escuchados' };

export function systemLists(entries) {
  const y = new Date().getFullYear();
  return [
    { id: 'sys-mustwatch', name: 'Must watch', description: 'Series y películas pendientes', rules: { types: ['series', 'movie'], statuses: ['planned'] }, c: 'var(--pink)' },
    { id: 'sys-toread', name: 'Por leer y escuchar', description: 'Libros y audiolibros pendientes', rules: { types: ['book', 'audiobook'], statuses: ['planned'] }, c: 'var(--yellow)' },
    { id: 'sys-now', name: 'En curso', description: 'Lo que estás viendo, leyendo o escuchando', rules: { statuses: ['in_progress'] }, c: 'var(--blue)' },
    { id: 'sys-abandoned', name: 'Abandonadas', description: 'Lo que dejaste a medias', rules: { statuses: ['abandoned'] }, c: 'var(--muted)' },
    { id: 'sys-best', name: 'Obras maestras', description: 'Todo lo que tiene 5 estrellas', rules: { minRating: 5 }, c: 'var(--orange)' },
    { id: `sys-year-${y}`, name: `Mi ${y}`, description: `Todo lo terminado en ${y}`, rules: { statuses: ['completed'], yearFrom: y, yearTo: y }, c: 'var(--accent)' },
  ].map((l) => ({ ...l, kind: 'system', items: entries.filter((e) => matchRules(e, l.rules)) }));
}

export function yearLists(entries) {
  const out = [];
  const done = entries.filter((e) => e.status === 'completed');
  for (const y of uniq(done.map(entryYear)).sort((a, b) => b - a)) {
    for (const t of Object.keys(TYPES)) {
      const items = done.filter((e) => e.type === t && entryYear(e) === y);
      if (items.length) out.push({ id: `auto-${t}-${y}`, name: `${TYPES[t].plural} ${VERB[t]} en ${y}`, rules: { types: [t], statuses: ['completed'], yearFrom: y, yearTo: y }, kind: 'auto', items, c: TYPES[t].color, year: y });
    }
  }
  return out;
}

export function itemsOfList(list, entries) {
  if (list.kind === 'smart') return entries.filter((e) => matchRules(e, list.rules || {}));
  const byId = new Map(entries.map((e) => [e.id, e]));
  return (list.itemIds || []).map((id) => byId.get(id)).filter(Boolean);
}

export function ListCard({ l, href }) {
  const items = l.items || [];
  return html`<a class="list-card" href=${href || `#/list/${l.id}`} style=${`--c:${l.c || 'var(--accent)'}`} onMouseEnter=${() => sfx.hover()}>
    <div class="stackp">${items.length ? items.slice(0, 6).map((e) => html`<div key=${e.id}><${Cover} src=${e.cover} title=${e.title} type=${e.type} /></div>`) : html`<div class="none">VACÍA</div>`}</div>
    <h3>${l.name}</h3>
    <span class="label">${l.kind === 'smart' || l.kind === 'system' || l.kind === 'auto' ? 'Automática · ' : ''}${items.length} ${items.length === 1 ? 'título' : 'títulos'}${l.isPublic === false ? ' · Privada' : ''}</span>
  </a>`;
}

const y0 = new Date().getFullYear();
const PRESETS = [
  { name: `Series vistas en ${y0}`, kind: 'smart', rules: { types: ['series'], statuses: ['completed'], yearFrom: y0, yearTo: y0 } },
  { name: 'Thrillers de 4★ o más', kind: 'smart', rules: { genres: ['Thriller'], minRating: 4 } },
  { name: 'Audiolibros escuchados', kind: 'smart', rules: { formats: ['listened'] } },
  { name: 'Para ver en compañía', kind: 'manual' },
];

export function ListsPage() {
  const { entries, lists } = useStore();
  const [creating, setCreating] = useState(null);
  const sys = systemLists(entries);
  const yl = yearLists(entries);
  const mine = lists.map((l) => ({ ...l, items: itemsOfList(l, entries), c: l.kind === 'smart' ? 'var(--teal)' : 'var(--purple)' }));
  return html`<div class="page wrap">
    <div class="page-head">
      <div><div class="kicker">Colecciones</div><h1 class="display" style="margin-top:20px"><${Scramble} text="Listas" /></h1></div>
      <button class="btn lg" onClick=${() => setCreating({})}><${Icon} name="plus" /> Nueva lista</button>
    </div>

    <section>
      <${SectionHead} kicker="Automáticas" title="Tu diario" color="var(--pink)" />
      <div class="grid" style="--min:280px;gap:48px 40px">${sys.map((l) => html`<${ListCard} key=${l.id} l=${l} />`)}</div>
    </section>

    <section class="section">
      <${SectionHead} kicker="Personales" title="Mis listas" color="var(--purple)" />
      ${mine.length ? html`<div class="grid" style="--min:280px;gap:48px 40px">${mine.map((l) => html`<${ListCard} key=${l.id} l=${l} />`)}</div>`
        : html`<p class="lead">Crea listas a mano o automáticas con tus propias reglas. Algunas ideas:</p>
          <div class="row" style="margin-top:20px;--g:8px">${PRESETS.map((p) => html`<button class="chip" onClick=${() => setCreating(p)}>${p.name}</button>`)}</div>`}
    </section>

    ${yl.length > 0 && html`<section class="section">
      <${SectionHead} kicker="Por año" title="Archivo" color="var(--accent)" />
      <div class="grid" style="--min:260px;gap:48px 40px">${yl.map((l) => html`<${ListCard} key=${l.id} l=${l} />`)}</div>
    </section>`}

    ${creating && html`<${ListEditor} initial=${creating} onClose=${() => setCreating(null)} />`}
  </div>`;
}

export function ListEditor({ initial, onClose }) {
  const { entries } = useStore();
  const [f, setF] = useState({
    name: initial.name || '', description: initial.description || '',
    kind: initial.kind || 'manual', isPublic: initial.isPublic ?? true,
    rules: { types: [], statuses: [], yearFrom: '', yearTo: '', minRating: 0, genres: [], formats: [], platform: '', ...(initial.rules || {}) },
  });
  const set = (p) => setF({ ...f, ...p });
  const setR = (p) => setF({ ...f, rules: { ...f.rules, ...p } });
  const tog = (k, v) => setR({ [k]: f.rules[k].includes(v) ? f.rules[k].filter((x) => x !== v) : [...f.rules[k], v] });
  const genres = uniq(entries.flatMap((e) => e.genres || [])).sort();
  const preview = f.kind === 'smart' ? entries.filter((e) => matchRules(e, f.rules)) : [];

  async function save() {
    if (!f.name.trim()) { toast('Ponle nombre a la lista', 'err'); return; }
    const data = { name: f.name.trim(), description: f.description, kind: f.kind, isPublic: f.isPublic, rules: f.kind === 'smart' ? f.rules : null };
    try {
      if (initial.id) await updateList(initial.id, data);
      else { const id = await createList(data); go(`list/${id}`); }
      sfx.chime(); flash('Lista guardada', '#9a7bff');
      onClose();
    } catch (e) { toast('No se pudo guardar: ' + e.message, 'err'); }
  }

  return html`<${Modal} kicker=${initial.id ? 'Editar lista' : 'Nueva lista'} title=${f.name || 'Sin nombre'} color="var(--purple)" onClose=${onClose}>
    <div class="stack" style="--g:24px">
      <div class="field"><label>Nombre</label><input class="input" value=${f.name} onInput=${(e) => set({ name: e.currentTarget.value })} placeholder="Series de culto" /></div>
      <div class="field"><label>Descripción</label><input class="input" value=${f.description} onInput=${(e) => set({ description: e.currentTarget.value })} /></div>
      <div class="field"><span class="label">Tipo</span>
        <div class="row" style="--g:8px"><${Chip} on=${f.kind === 'manual'} onClick=${() => set({ kind: 'manual' })}>Manual</${Chip}>
        <${Chip} on=${f.kind === 'smart'} color="var(--teal)" onClick=${() => set({ kind: 'smart' })}>Automática</${Chip}></div>
        <span class="small muted">${f.kind === 'manual' ? 'Añades títulos desde «Editar» en cada ficha.' : 'Se rellena sola con todo lo que cumpla las reglas.'}</span>
      </div>
      ${f.kind === 'smart' && html`<div class="filters"><div class="stack" style="--g:16px">
        <div class="filter-row"><span class="label">Tipos</span>${Object.values(TYPES).map((t) => html`<${Chip} on=${f.rules.types.includes(t.key)} color=${t.color} onClick=${() => tog('types', t.key)}>${t.plural}</${Chip}>`)}</div>
        <div class="filter-row"><span class="label">Estado</span>${STATUS_KEYS.map((s) => html`<${Chip} on=${f.rules.statuses.includes(s)} onClick=${() => tog('statuses', s)}>${statusLabel(s)}</${Chip}>`)}</div>
        <div class="filter-row"><span class="label">Años</span>
          <input class="input" style="width:120px" inputmode="numeric" placeholder="Desde" value=${f.rules.yearFrom} onInput=${(e) => setR({ yearFrom: e.currentTarget.value })} />
          <input class="input" style="width:120px" inputmode="numeric" placeholder="Hasta" value=${f.rules.yearTo} onInput=${(e) => setR({ yearTo: e.currentTarget.value })} />
        </div>
        <div class="filter-row"><span class="label">Mínimo</span><${Stars} value=${f.rules.minRating} onChange=${(v) => setR({ minRating: v })} size=${24} /></div>
        ${genres.length > 0 && html`<div class="filter-row"><span class="label">Géneros</span>${genres.map((g) => html`<${Chip} on=${f.rules.genres.includes(g)} color="var(--orange)" onClick=${() => tog('genres', g)}>${g}</${Chip}>`)}</div>`}
        <div class="filter-row"><span class="label">Formato</span>
          <${Chip} on=${f.rules.formats.includes('read')} color="var(--yellow)" onClick=${() => tog('formats', 'read')}>Leídos</${Chip}>
          <${Chip} on=${f.rules.formats.includes('listened')} color="var(--teal)" onClick=${() => tog('formats', 'listened')}>Escuchados</${Chip}>
        </div>
        <span class="count">${preview.length} TÍTULOS AHORA MISMO · ${describeRules(f.rules).toUpperCase()}</span>
      </div></div>`}
      <${Switch} checked=${f.isPublic} onChange=${(v) => set({ isPublic: v })} label=${f.isPublic ? 'Pública en tu perfil' : 'Privada'} />
      <div class="row between" style="border-top:1px solid var(--line);padding-top:20px"><button class="btn ghost" onClick=${onClose}>Cancelar</button><button class="btn lg" onClick=${save}>Guardar lista</button></div>
    </div>
  </${Modal}>`;
}

export function ListPage({ id }) {
  const st = useStore();
  const [remote, setRemote] = useState(undefined);
  const [edit, setEdit] = useState(false);
  const [exp, setExp] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [sort, setSort] = useState('rating');

  const local = id.startsWith('sys-') ? systemLists(st.entries).find((l) => l.id === id)
    : id.startsWith('auto-') ? yearLists(st.entries).find((l) => l.id === id)
    : st.lists.find((l) => l.id === id);

  useEffect(() => {
    if (local || id.startsWith('sys-') || id.startsWith('auto-')) return;
    (async () => {
      try {
        const l = await getList(id);
        if (!l) return setRemote(null);
        const entries = await publicEntriesOf(l.ownerId);
        setRemote({ ...l, items: itemsOfList(l, entries) });
      } catch { setRemote(null); }
    })();
  }, [id]);

  const list = local ? { ...local, items: local.items || itemsOfList(local, st.entries) } : remote;
  if (list === undefined) return html`<div class="page wrap"><${Spinner} /></div>`;
  if (!list) return html`<div class="page wrap"><div class="empty"><div class="kicker">Lista</div><h1 class="display" style="margin:20px 0">No disponible</h1><p class="lead">No existe o es privada.</p></div></div>`;

  const own = !!st.lists.find((l) => l.id === id);
  const isManual = list.kind === 'manual' || !list.kind;
  const items = sortEntries(list.items, sort);
  const color = list.c || (list.kind === 'smart' ? 'var(--teal)' : 'var(--purple)');

  return html`<div class="page wrap">
    <div class="page-head" style=${`--c:${color}`}>
      <div class="stack" style="--g:18px;max-width:1000px">
        <div class="kicker">${list.kind === 'manual' || !list.kind ? 'Lista' : 'Lista automática'} · ${items.length} títulos</div>
        <h1 class="display"><${Scramble} text=${list.name} /></h1>
        ${list.description && html`<p class="lead">${list.description}</p>`}
        ${list.rules && html`<span class="count">${describeRules(list.rules).toUpperCase()}</span>`}
        ${!own && list.ownerName && html`<a href=${`#/u/${list.ownerId}`} class="row" style="--g:10px;text-decoration:none"><${Avatar} user=${list} size=${30} /><span class="sub">${list.ownerName}</span></a>`}
      </div>
      <div class="row" style="--g:8px">
        ${own && html`<button class="btn" onClick=${() => setEdit(true)}><${Icon} name="edit" /> Editar</button>`}
        ${own && list.isPublic && html`<button class="btn glass" onClick=${() => shareLink({ title: list.name, url: `${location.origin}${location.pathname}#/list/${id}` })}><${Icon} name="share" /> Compartir</button>`}
        ${items.length > 0 && html`<button class="btn glass" onClick=${() => setExp(true)}><${Icon} name="download" /> Exportar</button>`}
        ${items.length > 0 && html`<button class="btn icon glass" title="Nota de lista (.md)" aria-label="Nota de lista" onClick=${() => { download(safeFilename(list.name) + '.md', listNote({ ...list, rulesText: list.rules ? describeRules(list.rules) : '' }, items)); sfx.pop(); }}><${Icon} name="copy" /></button>`}
        ${own && html`<button class="btn icon glass" title="Eliminar lista" aria-label="Eliminar lista" onClick=${() => setConfirm(true)}><${Icon} name="trash" /></button>`}
      </div>
    </div>

    <div class="row between" style="margin-bottom:32px;border-top:1px solid var(--line);padding-top:16px">
      <span class="count">ORDEN</span>
      <select class="select" style="width:auto" value=${sort} onChange=${(e) => setSort(e.currentTarget.value)}>
        <option value="rating">Mejor valoradas</option><option value="finished">Fecha de fin</option><option value="recent">Recientes</option><option value="title">Título</option><option value="year">Año</option>
      </select>
    </div>
    ${items.length ? html`<div class="grid">${items.map((e) => html`<${PosterCard} key=${e.id} e=${e}
        extra=${own && isManual ? html`<button class="btn text" onClick=${async (ev) => { ev.preventDefault(); ev.stopPropagation(); await updateList(id, { itemIds: (list.itemIds || []).filter((x) => x !== e.id) }); sfx.click(); }}>Quitar</button>` : null} />`)}</div>`
      : html`<p class="lead">${isManual && own ? 'Añade títulos desde «Editar» en cada ficha.' : 'Cuando algo cumpla las reglas aparecerá aquí.'}</p>`}
    ${edit && html`<${ListEditor} initial=${list} onClose=${() => setEdit(false)} />`}
    ${exp && html`<${ExportModal} entries=${items} name=${safeFilename(list.name)} settings=${st.settings} lists=${[]} onClose=${() => setExp(false)} />`}
    ${confirm && html`<${Modal} kicker="Eliminar lista" title=${list.name} color="var(--red)" width=${520} onClose=${() => setConfirm(false)}>
      <p class="lead" style="margin-top:0">Se borra la lista; los títulos siguen en tu diario.</p>
      <div class="row between" style="margin-top:24px"><button class="btn ghost" onClick=${() => setConfirm(false)}>Cancelar</button>
        <button class="btn danger" onClick=${async () => { await deleteList(id); toast('Lista eliminada', 'ok'); go('lists'); }}>Eliminar</button></div>
    </${Modal}>`}
  </div>`;
}
