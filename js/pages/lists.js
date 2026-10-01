// Listas: del sistema (Must watch, Abandonadas…), automáticas por año, inteligentes y manuales.
import { html, useState, useEffect } from 'preact-standalone';
import { PosterCard, Chip, Empty, Modal, Switch, Spinner, Avatar, Stars, Cover } from '../components/ui.js';
import { ExportModal } from './library.js';
import { useStore, toast } from '../lib/store.js';
import { createList, updateList, deleteList, getList, publicEntriesOf } from '../lib/db.js';
import { TYPES, STATUS_KEYS, statusLabel, entryYear, matchRules, describeRules, sortEntries, uniq } from '../lib/utils.js';
import { listNote } from '../lib/markdown.js';
import { download, safeFilename } from '../lib/utils.js';
import { go } from '../lib/router.js';
import { sfx } from '../lib/sound.js';
import { onomato } from '../lib/fx.js';

const VERB = { series: 'vistas', movie: 'vistas', book: 'leídos', audiobook: 'escuchados' };

export function systemLists(entries) {
  const y = new Date().getFullYear();
  return [
    { id: 'sys-mustwatch', emoji: '✦', name: 'Must watch', description: 'Series y pelis pendientes', rules: { types: ['series', 'movie'], statuses: ['planned'] }, c: 'var(--pink)' },
    { id: 'sys-toread', emoji: '📚', name: 'Por leer y escuchar', description: 'Libros y audiolibros pendientes', rules: { types: ['book', 'audiobook'], statuses: ['planned'] }, c: 'var(--yellow)' },
    { id: 'sys-now', emoji: '◐', name: 'En curso', description: 'Lo que estás viendo, leyendo o escuchando', rules: { statuses: ['in_progress'] }, c: 'var(--blue)' },
    { id: 'sys-abandoned', emoji: '✕', name: 'Abandonadas', description: 'Lo que dejaste a medias', rules: { statuses: ['abandoned'] }, c: 'var(--ink)', dark: true },
    { id: 'sys-best', emoji: '🏆', name: 'Obras maestras', description: 'Todo lo que tiene 5 estrellas', rules: { minRating: 5 }, c: 'var(--orange)' },
    { id: `sys-year-${y}`, emoji: '📅', name: `Mi ${y}`, description: `Todo lo terminado en ${y}`, rules: { statuses: ['completed'], yearFrom: y, yearTo: y }, c: 'var(--teal)' },
  ].map((l) => ({ ...l, kind: 'system', items: entries.filter((e) => matchRules(e, l.rules)) }));
}

export function yearLists(entries) {
  const out = [];
  const done = entries.filter((e) => e.status === 'completed');
  const years = uniq(done.map(entryYear)).sort((a, b) => b - a);
  for (const y of years) {
    for (const t of Object.keys(TYPES)) {
      const items = done.filter((e) => e.type === t && entryYear(e) === y);
      if (items.length) out.push({ id: `auto-${t}-${y}`, emoji: TYPES[t].icon, name: `${TYPES[t].plural} ${VERB[t]} en ${y}`, rules: { types: [t], statuses: ['completed'], yearFrom: y, yearTo: y }, kind: 'auto', items, c: TYPES[t].color, year: y });
    }
  }
  return out;
}

export function itemsOfList(list, entries) {
  if (list.kind === 'smart') return entries.filter((e) => matchRules(e, list.rules || {}));
  const byId = new Map(entries.map((e) => [e.id, e]));
  return (list.itemIds || []).map((id) => byId.get(id)).filter(Boolean);
}

function ListCard({ l, href }) {
  const items = l.items || [];
  return html`<a class="list-card" href=${href || `#/list/${l.id}`} style=${`--c:${l.c || 'var(--paper-2)'};${l.dark ? 'color:var(--paper-2)' : ''}`} onMouseEnter=${() => sfx.hover()}>
    <span class="emoji">${l.emoji || '📋'}</span>
    <h3>${l.name}</h3>
    <div class="small" style="font-weight:600;opacity:.85">${l.kind === 'smart' || l.kind === 'system' || l.kind === 'auto' ? '⚡ Automática · ' : ''}${items.length} ${items.length === 1 ? 'elemento' : 'elementos'}${l.isPublic === false ? ' · 🔒' : ''}</div>
    <div class="stackp">${items.slice(0, 6).map((e) => html`<div key=${e.id}><${Cover} src=${e.cover} title=${e.title} type=${e.type} /></div>`)}</div>
  </a>`;
}

export function ListsPage() {
  const { entries, lists } = useStore();
  const [creating, setCreating] = useState(null);
  const sys = systemLists(entries);
  const yl = yearLists(entries);
  const mine = lists.map((l) => ({ ...l, items: itemsOfList(l, entries), c: l.kind === 'smart' ? 'var(--mint)' : 'var(--paper-2)' }));
  return html`<div class="page wrap">
    <div class="row between">
      <h1 class="mega">Mis <span class="mark pink tilt-l">listas</span></h1>
      <button class="btn big red" onClick=${() => setCreating({})}>＋ Nueva lista</button>
    </div>

    <div class="section">
      <div class="section-head" style="--c:var(--pink)"><h2 class="h2">Listas del diario</h2></div>
      <div class="grid" style="--min:260px">${sys.map((l) => html`<${ListCard} key=${l.id} l=${l} />`)}</div>
    </div>

    <div class="section">
      <div class="section-head" style="--c:var(--purple)"><h2 class="h2">Mis listas</h2><span class="muted small">Manuales o automáticas con tus propias reglas</span></div>
      ${mine.length ? html`<div class="grid" style="--min:260px">${mine.map((l) => html`<${ListCard} key=${l.id} l=${l} />`)}</div>`
        : html`<div class="panel tint flat" style="--c:var(--purple)"><p style="margin:0 0 14px;font-weight:600">Crea listas a mano (“Para ver con mamá”) o automáticas (“Thrillers de 4★ o más”).</p>
          <div class="row">${PRESETS.map((p) => html`<button class="btn sm" onClick=${() => setCreating(p)}>${p.emoji} ${p.name}</button>`)}</div></div>`}
    </div>

    ${yl.length > 0 && html`<div class="section">
      <div class="section-head" style="--c:var(--teal)"><h2 class="h2">Automáticas por año</h2></div>
      <div class="grid" style="--min:240px">${yl.map((l) => html`<${ListCard} key=${l.id} l=${l} />`)}</div>
    </div>`}

    ${creating && html`<${ListEditor} initial=${creating} onClose=${() => setCreating(null)} />`}
  </div>`;
}

const y0 = new Date().getFullYear();
const PRESETS = [
  { emoji: '📺', name: `Series vistas en ${y0}`, kind: 'smart', rules: { types: ['series'], statuses: ['completed'], yearFrom: y0, yearTo: y0 } },
  { emoji: '🔪', name: 'Thrillers de 4★ o más', kind: 'smart', rules: { genres: ['Thriller'], minRating: 4 } },
  { emoji: '🎧', name: 'Audiolibros escuchados', kind: 'smart', rules: { formats: ['listened'] } },
  { emoji: '🍿', name: 'Para ver en compañía', kind: 'manual' },
];

export function ListEditor({ initial, onClose }) {
  const { entries } = useStore();
  const [f, setF] = useState({
    name: initial.name || '', emoji: initial.emoji || '📋', description: initial.description || '',
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
    const data = { name: f.name.trim(), emoji: f.emoji, description: f.description, kind: f.kind, isPublic: f.isPublic, rules: f.kind === 'smart' ? f.rules : null };
    try {
      if (initial.id) await updateList(initial.id, data);
      else { const id = await createList(data); go(`list/${id}`); }
      sfx.chime(); onomato(window.innerWidth / 2, window.innerHeight / 2, '¡LISTA!', '#8e6cef');
      onClose();
    } catch (e) { toast('No se pudo guardar: ' + e.message, 'err'); }
  }

  return html`<${Modal} title=${initial.id ? 'Editar lista' : 'Nueva lista'} color="var(--purple)" onClose=${onClose}>
    <div class="stack" style="--g:18px">
      <div class="row" style="--g:12px">
        <div class="field" style="width:90px"><label>Emoji</label><input class="input" style="text-align:center;font-size:1.4rem" value=${f.emoji} maxlength="4" onInput=${(e) => set({ emoji: e.currentTarget.value })} /></div>
        <div class="field grow"><label>Nombre</label><input class="input" value=${f.name} onInput=${(e) => set({ name: e.currentTarget.value })} placeholder="Mis series de culto" /></div>
      </div>
      <div class="field"><label>Descripción</label><input class="input" value=${f.description} onInput=${(e) => set({ description: e.currentTarget.value })} /></div>
      <div class="field"><span class="label">Tipo de lista</span>
        <div class="row"><${Chip} on=${f.kind === 'manual'} color="var(--blue)" onClick=${() => set({ kind: 'manual' })}>✋ Manual</${Chip}>
        <${Chip} on=${f.kind === 'smart'} color="var(--teal)" onClick=${() => set({ kind: 'smart' })}>⚡ Automática</${Chip}></div>
      </div>
      ${f.kind === 'smart' && html`<div class="panel tint flat" style="--c:var(--teal)"><div class="stack" style="--g:14px">
        <div class="filter-row"><span class="label">Tipos</span>${Object.values(TYPES).map((t) => html`<${Chip} on=${f.rules.types.includes(t.key)} color=${t.color} onClick=${() => tog('types', t.key)}>${t.icon} ${t.plural}</${Chip}>`)}</div>
        <div class="filter-row"><span class="label">Estado</span>${STATUS_KEYS.map((s) => html`<${Chip} on=${f.rules.statuses.includes(s)} onClick=${() => tog('statuses', s)}>${statusLabel(s)}</${Chip}>`)}</div>
        <div class="filter-row"><span class="label">Años</span>
          <input class="input" style="width:120px" inputmode="numeric" placeholder="desde" value=${f.rules.yearFrom} onInput=${(e) => setR({ yearFrom: e.currentTarget.value })} />
          <input class="input" style="width:120px" inputmode="numeric" placeholder="hasta" value=${f.rules.yearTo} onInput=${(e) => setR({ yearTo: e.currentTarget.value })} />
        </div>
        <div class="filter-row"><span class="label">Mínimo</span><${Stars} value=${f.rules.minRating} onChange=${(v) => setR({ minRating: v })} size=${30} /></div>
        ${genres.length > 0 && html`<div class="filter-row"><span class="label">Géneros</span>${genres.map((g) => html`<${Chip} on=${f.rules.genres.includes(g)} color="var(--orange)" light onClick=${() => tog('genres', g)}>${g}</${Chip}>`)}</div>`}
        <div class="filter-row"><span class="label">Formato</span>
          <${Chip} on=${f.rules.formats.includes('read')} color="var(--yellow)" light onClick=${() => tog('formats', 'read')}>📖 Leídos</${Chip}>
          <${Chip} on=${f.rules.formats.includes('listened')} color="var(--teal)" onClick=${() => tog('formats', 'listened')}>🎧 Escuchados</${Chip}>
        </div>
        <p class="small" style="margin:0"><b>${preview.length}</b> elementos ahora mismo · ${describeRules(f.rules)}</p>
      </div></div>`}
      <${Switch} checked=${f.isPublic} onChange=${(v) => set({ isPublic: v })} label=${html`<b>${f.isPublic ? '🌍 Pública en tu perfil' : '🔒 Privada'}</b>`} />
      <div class="row between"><button class="btn ghost" onClick=${onClose}>Cancelar</button><button class="btn big red" onClick=${save}>¡Guardar lista!</button></div>
    </div>
  </${Modal}>`;
}

export function ListPage({ id }) {
  const st = useStore();
  const [remote, setRemote] = useState(undefined);
  const [edit, setEdit] = useState(false);
  const [exp, setExp] = useState(false);
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
  if (list === undefined && !local) return html`<div class="page wrap"><${Spinner} /></div>`;
  if (!list) return html`<div class="page wrap"><${Empty} word="¡PUF!" title="Lista no encontrada o privada" /></div>`;

  const own = !!st.lists.find((l) => l.id === id);
  const isManual = list.kind === 'manual' || !list.kind;
  const items = sortEntries(list.items, sort);

  return html`<div class="page wrap">
    <div class="panel color halftone" style=${`--c:${list.c || 'var(--yellow)'};${list.dark ? 'color:var(--paper-2)' : ''};padding:34px`}>
      <div class="row between" style="align-items:flex-start">
        <div class="stack" style="--g:10px">
          <span style="font-size:3rem;line-height:1">${list.emoji || '📋'}</span>
          <h1 class="h1">${list.name}</h1>
          ${list.description && html`<p style="margin:0;font-size:1.1rem;font-weight:600">${list.description}</p>`}
          ${list.rules && html`<span class="chip static" style="width:fit-content;color:var(--ink)">⚡ ${describeRules(list.rules)}</span>`}
          ${!own && list.ownerName && html`<a href=${`#/u/${list.ownerId}`} class="row" style="--g:8px;text-decoration:none"><${Avatar} user=${list} size=${32} /><b>${list.ownerName}</b></a>`}
        </div>
        <div class="row" style="--g:8px">
          ${own && html`<button class="btn" onClick=${() => setEdit(true)}>✎ Editar</button>`}
          ${items.length > 0 && html`<button class="btn teal" onClick=${() => setExp(true)}>⬇ Exportar</button>`}
          ${items.length > 0 && html`<button class="btn" onClick=${() => { download(safeFilename(list.name) + '.md', listNote({ ...list, rulesText: list.rules ? describeRules(list.rules) : '' }, items)); sfx.whoosh(); }}>📄 Nota de lista</button>`}
          ${own && html`<button class="btn ghost" onClick=${async () => { if (confirmDelete()) { await deleteList(id); toast('Lista eliminada', 'ok'); go('lists'); } }}>🗑</button>`}
        </div>
      </div>
    </div>

    <div class="row between" style="margin:26px 0">
      <b>${items.length} elementos</b>
      <select class="select" style="width:auto" value=${sort} onChange=${(e) => setSort(e.currentTarget.value)}>
        <option value="rating">Mejor valoradas</option><option value="finished">Fecha de fin</option><option value="recent">Recientes</option><option value="title">Título</option><option value="year">Año</option>
      </select>
    </div>
    ${items.length ? html`<div class="grid">${items.map((e) => html`<${PosterCard} key=${e.id} e=${e}
        extra=${own && isManual ? html`<button class="btn sm ghost" style="margin-top:6px" onClick=${async (ev) => { ev.preventDefault(); ev.stopPropagation(); await updateList(id, { itemIds: (list.itemIds || []).filter((x) => x !== e.id) }); sfx.click(); }}>✕ Quitar</button>` : null} />`)}</div>`
      : html`<${Empty} word="¡VACÍA!" title="Esta lista no tiene nada todavía" sub=${isManual && own ? 'Añade cosas desde el botón «Editar» de cada ficha.' : 'Cuando algo cumpla las reglas aparecerá aquí.'} />`}
    ${edit && html`<${ListEditor} initial=${list} onClose=${() => setEdit(false)} />`}
    ${exp && html`<${ExportModal} entries=${items} name=${safeFilename(list.name)} settings=${st.settings} lists=${[]} onClose=${() => setExp(false)} />`}
  </div>`;
}

function confirmDelete() {
  // Evitamos window.confirm (bloquea la página); doble pulsación en 3 s.
  const now = Date.now();
  if (confirmDelete.t && now - confirmDelete.t < 3000) { confirmDelete.t = 0; return true; }
  confirmDelete.t = now; toast('Pulsa otra vez para borrar la lista', 'info', 3000); return false;
}
