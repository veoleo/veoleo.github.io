// Formulario para registrar o editar una serie, película, libro o audiolibro.
import { html, useState } from 'preact-standalone';
import { Modal, Stars, Tabs, Switch, Chip, Cover, Icon } from './ui.js';
import {
  TYPES, statusKeysFor, STATUS_COLORS, statusLabel, PLATFORMS, READ_PLACES, LISTEN_PLACES, todayISO, youtubeId, normGenres, uniq,
} from '../lib/utils.js';
import { createEntry, updateEntry, updateList } from '../lib/db.js';
import { toast, useStore } from '../lib/store.js';
import { platformsOf, toEntryFields } from '../lib/metadata.js';
import { sfx } from '../lib/sound.js';
import { flash, scan } from '../lib/fx.js';
import { go } from '../lib/router.js';


export function EntryForm({ draft, onClose, onSaved }) {
  const { lists } = useStore();
  const isEdit = !!draft.id && !!draft.ownerId;
  const [f, setF] = useState(() => ({
    status: draft.status || 'completed',
    rating: draft.rating || 0,
    startedAt: draft.startedAt || '',
    finishedAt: draft.finishedAt ?? (isEdit ? '' : todayISO()),
    platform: draft.platform || platformsOf(draft)[0] || '',
    consumption: { read: draft.type === 'book', listened: draft.type === 'audiobook', readOn: '', listenedOn: '', ...(draft.consumption || {}) },
    tags: (draft.tags || []).join(', '),
    visibility: draft.visibility || 'public',
    rewatch: draft.rewatch || 0,
    type: draft.type,
    title: draft.title || '', year: draft.year || '', cover: draft.cover || '', backdrop: draft.backdrop || '',
    trailerUrl: draft.trailer?.youtube ? `https://youtu.be/${draft.trailer.youtube}` : draft.trailer?.url || '',
    genres: (draft.genres || []).join(', '), creators: (draft.creators || []).join(', '), narrator: draft.narrator || '',
    pages: draft.pages || '', releaseDate: draft.releaseDate || '',
  }));
  const manualLists = lists.filter((l) => l.kind !== 'smart');
  const [inLists, setInLists] = useState(() => manualLists.filter((l) => (l.itemIds || []).includes(draft.id)).map((l) => l.id));
  const [showMeta, setShowMeta] = useState(!draft.title);
  const [saving, setSaving] = useState(false);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const setC = (patch) => setF((x) => ({ ...x, consumption: { ...x.consumption, ...patch } }));
  const isBook = f.type === 'book' || f.type === 'audiobook';
  const T = TYPES[f.type];

  async function save(ev) {
    ev?.preventDefault();
    if (!f.title.trim()) { toast('Falta el título', 'err'); return; }
    setSaving(true);
    try {
      const yt = youtubeId(f.trailerUrl);
      let trailer = draft.trailer || null;
      if (yt) trailer = { youtube: yt };
      else if (f.trailerUrl && /^https?:/.test(f.trailerUrl)) trailer = { url: f.trailerUrl };
      else if (!f.trailerUrl && trailer?.youtube) trailer = null;
      const data = {
        ...(isEdit ? {} : toEntryFields(draft)),
        type: f.type, status: f.status, rating: Number(f.rating) || 0,
        startedAt: f.startedAt || '', finishedAt: f.status === 'planned' ? '' : f.finishedAt || '',
        platform: f.platform || '', consumption: isBook ? f.consumption : null, rewatch: Number(f.rewatch) || 0,
        tags: uniq(f.tags.split(',').map((t) => t.trim())), visibility: f.visibility,
        title: f.title.trim(), year: Number(f.year) || null, cover: f.cover.trim(), backdrop: f.backdrop.trim(), trailer,
        genres: normGenres(f.genres.split(',')), creators: uniq(f.creators.split(',').map((x) => x.trim())),
        narrator: f.narrator.trim(), pages: Number(f.pages) || null, releaseDate: f.releaseDate || '',
      };
      let id = draft.id;
      if (isEdit) await updateEntry(id, data);
      else id = await createEntry({ ...data, watchedEpisodes: draft.watchedEpisodes || [], hasNote: false, notePublic: false });
      for (const l of manualLists) {
        const has = (l.itemIds || []).includes(id), want = inLists.includes(l.id);
        if (want && !has) await updateList(l.id, { itemIds: [...(l.itemIds || []), id] });
        if (!want && has) await updateList(l.id, { itemIds: l.itemIds.filter((x) => x !== id) });
      }
      const word = f.status === 'abandoned' ? 'Abandonada' : f.status === 'planned' ? 'En la lista' : isEdit ? 'Guardado' : 'Añadido';
      flash(word, f.status === 'abandoned' ? '#7d8399' : '#c6ff3d'); scan();
      sfx.braam(f.status === 'abandoned' ? 0.3 : 0.5);
      onSaved?.(id);
      onClose?.();
      if (!isEdit) go(`item/${id}`);
    } catch (e) {
      console.error(e); sfx.error(); toast('No se pudo guardar: ' + e.message, 'err');
    } finally { setSaving(false); }
  }

  return html`
    <${Modal} kicker=${isEdit ? 'Editar' : 'Añadir a tu diario'} title=${f.title || 'Nueva entrada'} onClose=${onClose} color=${T.color} width=${880}>
      <form class="stack" style="--g:30px" onSubmit=${save}>
        <div class="row" style="--g:24px;align-items:flex-start">
          <div class="hero-poster" style="width:116px;flex:none;box-shadow:none"><${Cover} src=${f.cover} title=${f.title} type=${f.type} /></div>
          <div class="stack grow" style="--g:12px;min-width:220px">
            <span class="tag" style=${`--c:${T.color}`}>${T.label}${f.year ? ' · ' + f.year : ''}</span>
            ${(draft.type === 'book' || draft.type === 'audiobook') && html`
              <${Tabs} value=${f.type} onChange=${(v) => set({ type: v })} options=${[
                { value: 'book', label: 'Libro', c: 'var(--yellow)' }, { value: 'audiobook', label: 'Audiolibro', c: 'var(--teal)' }]} />`}
            <div class="field"><span class="label">Valoración</span><${Stars} value=${f.rating} onChange=${(v) => set({ rating: v })} size=${38} /></div>
          </div>
        </div>

        <div class="field"><span class="label">Estado</span>
          <div class="row" style="--g:8px">
            ${statusKeysFor(f.type).map((s) => html`<${Chip} key=${s} on=${f.status === s} color=${STATUS_COLORS[s]}
              onClick=${() => set({ status: s, finishedAt: s === 'completed' && !f.finishedAt ? todayISO() : f.finishedAt })}>${statusLabel(s, f.type)}</${Chip}>`)}
          </div>
          ${f.status === 'abandoned' && html`<span class="small muted">Se guardará en tu lista Abandonadas.</span>`}
          ${f.status === 'planned' && html`<span class="small muted">Se guardará en ${isBook ? 'Por leer' : 'Must watch'}.</span>`}
        </div>

        <div class="row" style="--g:20px;align-items:flex-end">
          <div class="field grow"><label>Empezado</label><input class="input" type="date" value=${f.startedAt} onInput=${(e) => set({ startedAt: e.currentTarget.value })} /></div>
          ${f.status !== 'planned' && html`<div class="field grow"><label>${f.status === 'abandoned' ? 'Abandonado' : 'Terminado'}</label><input class="input" type="date" value=${f.finishedAt} onInput=${(e) => set({ finishedAt: e.currentTarget.value })} /></div>`}
          ${!isBook && f.status === 'completed' && html`<div class="field" style="width:130px"><label>Revisionados</label><input class="input" type="number" min="0" value=${f.rewatch} onInput=${(e) => set({ rewatch: e.currentTarget.value })} /></div>`}
        </div>

        ${!isBook && html`
          <div class="field"><span class="label">Dónde lo ves</span>
            <div class="row" style="--g:8px">
              ${uniq([...platformsOf(draft), ...PLATFORMS]).map((p) => html`<${Chip} key=${p} on=${f.platform === p} color="var(--blue)" fg="#fff" onClick=${() => set({ platform: f.platform === p ? '' : p })}>${p}</${Chip}>`)}
            </div>
          </div>`}

        ${isBook && html`
          <div class="stack" style="--g:18px">
            <div class="row between">
              <${Switch} checked=${f.consumption.read} onChange=${(v) => setC({ read: v })} label="Leído" />
              ${f.consumption.read && html`<select class="select" style="max-width:280px" value=${f.consumption.readOn} onChange=${(e) => setC({ readOn: e.currentTarget.value })}>
                <option value="">¿Dónde lo leíste?</option>${READ_PLACES.map((p) => html`<option>${p}</option>`)}</select>`}
            </div>
            <div class="row between">
              <${Switch} checked=${f.consumption.listened} onChange=${(v) => setC({ listened: v })} label="Escuchado" />
              ${f.consumption.listened && html`<select class="select" style="max-width:280px" value=${f.consumption.listenedOn} onChange=${(e) => setC({ listenedOn: e.currentTarget.value })}>
                <option value="">¿Dónde lo escuchaste?</option>${LISTEN_PLACES.map((p) => html`<option>${p}</option>`)}</select>`}
            </div>
            ${f.consumption.listened && html`<div class="field"><label>Narración</label><input class="input" value=${f.narrator} placeholder="Quién lo narra" onInput=${(e) => set({ narrator: e.currentTarget.value })} /></div>`}
          </div>`}

        ${manualLists.length > 0 && html`
          <div class="field"><span class="label">Listas</span>
            <div class="row" style="--g:8px">${manualLists.map((l) => html`<${Chip} key=${l.id} on=${inLists.includes(l.id)} color="var(--purple)" fg="#fff"
              onClick=${() => setInLists((a) => (a.includes(l.id) ? a.filter((x) => x !== l.id) : [...a, l.id]))}>${l.name}</${Chip}>`)}</div>
          </div>`}

        <div class="field"><label>Etiquetas</label><input class="input" value=${f.tags} placeholder="comfort, relectura, con amigos…" onInput=${(e) => set({ tags: e.currentTarget.value })} /></div>

        <${Switch} checked=${f.visibility === 'public'} onChange=${(v) => set({ visibility: v ? 'public' : 'private' })}
          label=${html`<span>${f.visibility === 'public' ? 'Visible en tu perfil' : 'Solo para ti'} <span class="muted small">— la nota tiene su propia privacidad</span></span>`} />

        <div>
          <button type="button" class="btn text" onClick=${() => setShowMeta(!showMeta)}><${Icon} name="chevron" size=${14} class=${showMeta ? 'rot' : ''} /> Datos de la ficha</button>
          ${showMeta && html`
            <div class="stack" style="--g:16px;margin-top:14px">
              <div class="row" style="--g:16px">
                <div class="field grow"><label>Título</label><input class="input" value=${f.title} onInput=${(e) => set({ title: e.currentTarget.value })} required /></div>
                <div class="field" style="width:120px"><label>Año</label><input class="input" inputmode="numeric" value=${f.year} onInput=${(e) => set({ year: e.currentTarget.value })} /></div>
              </div>
              <div class="row" style="--g:16px">
                <div class="field grow"><label>Fecha de estreno / publicación</label><input class="input" type="date" value=${f.releaseDate} onInput=${(e) => set({ releaseDate: e.currentTarget.value })} /></div>
                ${isBook && html`<div class="field" style="width:140px"><label>Páginas</label><input class="input" inputmode="numeric" value=${f.pages} onInput=${(e) => set({ pages: e.currentTarget.value })} /></div>`}
              </div>
              <div class="field"><label>Portada (URL)</label><input class="input" value=${f.cover} onInput=${(e) => set({ cover: e.currentTarget.value })} /></div>
              <div class="field"><label>Imagen de fondo (URL)</label><input class="input" value=${f.backdrop} onInput=${(e) => set({ backdrop: e.currentTarget.value })} /></div>
              ${!isBook && html`<div class="field"><label>Tráiler de YouTube</label><input class="input" value=${f.trailerUrl} placeholder="https://youtu.be/…" onInput=${(e) => set({ trailerUrl: e.currentTarget.value })} /></div>`}
              <div class="field"><label>Géneros</label><input class="input" value=${f.genres} onInput=${(e) => set({ genres: e.currentTarget.value })} /></div>
              <div class="field"><label>${isBook ? 'Autoría' : f.type === 'movie' ? 'Dirección' : 'Creación'}</label><input class="input" value=${f.creators} onInput=${(e) => set({ creators: e.currentTarget.value })} /></div>
            </div>`}
        </div>

        <div class="row between" style="padding-top:8px;border-top:1px solid var(--line)">
          <button type="button" class="btn ghost" onClick=${onClose}>Cancelar</button>
          <button type="submit" class="btn lg" disabled=${saving}>${saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Añadir'}<${Icon} name="check" /></button>
        </div>
      </form>
    </${Modal}>`;
}

export function useEntryForm() {
  const [draft, setDraft] = useState(null);
  const node = draft ? html`<${EntryForm} draft=${draft} onClose=${() => setDraft(null)} />` : null;
  return [node, setDraft];
}
