// Formulario para registrar o editar una serie, película, libro o audiolibro.
import { html, useState } from 'preact-standalone';
import { Modal, Stars, Seg, Switch, Chip, Cover, TypeBadge } from './ui.js';
import {
  TYPES, STATUS_KEYS, STATUS_ICONS, statusLabel, PLATFORMS, READ_PLACES, LISTEN_PLACES, todayISO, youtubeId, normGenres, uniq,
} from '../lib/utils.js';
import { createEntry, updateEntry, updateList } from '../lib/db.js';
import { toast, useStore } from '../lib/store.js';
import { platformsOf, toEntryFields } from '../lib/metadata.js';
import { sfx } from '../lib/sound.js';
import { onomato, burst } from '../lib/fx.js';
import { go } from '../lib/router.js';

const STATUS_COLORS = { completed: 'var(--teal)', in_progress: 'var(--yellow)', planned: 'var(--pink)', abandoned: 'var(--ink)' };

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
    if (!f.title.trim()) { toast('Ponle un título', 'err'); return; }
    setSaving(true);
    try {
      const yt = youtubeId(f.trailerUrl);
      const data = {
        ...(isEdit ? {} : toEntryFields(draft)),
        type: f.type, status: f.status, rating: Number(f.rating) || 0,
        startedAt: f.startedAt || '', finishedAt: f.status === 'planned' ? '' : f.finishedAt || '',
        platform: f.platform || '', consumption: isBook ? f.consumption : null,
        tags: uniq(f.tags.split(',').map((t) => t.trim())), visibility: f.visibility,
        title: f.title.trim(), year: Number(f.year) || null, cover: f.cover.trim(), backdrop: f.backdrop.trim(),
        trailer: yt ? { ...(draft.trailer || {}), youtube: yt } : f.trailerUrl ? { url: f.trailerUrl } : draft.trailer || null,
        genres: normGenres(f.genres.split(',')), creators: uniq(f.creators.split(',').map((x) => x.trim())),
        narrator: f.narrator.trim(), pages: Number(f.pages) || null, releaseDate: f.releaseDate || '',
      };
      if (!f.trailerUrl && draft.trailer && !yt) data.trailer = null;
      let id = draft.id;
      if (isEdit) await updateEntry(id, data);
      else id = await createEntry({ ...data, watchedEpisodes: draft.watchedEpisodes || [], hasNote: false, notePublic: false });
      // listas manuales
      for (const l of manualLists) {
        const has = (l.itemIds || []).includes(id), want = inLists.includes(l.id);
        if (want && !has) await updateList(l.id, { itemIds: [...(l.itemIds || []), id] });
        if (!want && has) await updateList(l.id, { itemIds: l.itemIds.filter((x) => x !== id) });
      }
      const word = f.status === 'abandoned' ? '¡ADIÓS!' : f.status === 'planned' ? '¡APUNTADO!' : isEdit ? '¡ZAS!' : '¡BOOM!';
      onomato(window.innerWidth / 2, window.innerHeight / 2, word);
      burst(window.innerWidth / 2, window.innerHeight / 2, { count: 26, spread: 220 });
      sfx.braam(f.status === 'abandoned' ? 0.6 : 1);
      toast(isEdit ? 'Guardado' : `${T.label} añadida a tu diario`, 'ok');
      onSaved?.(id);
      onClose?.();
      if (!isEdit) go(`item/${id}`);
    } catch (e) {
      console.error(e); sfx.error(); toast('No se pudo guardar: ' + e.message, 'err');
    } finally { setSaving(false); }
  }

  const statusOpts = STATUS_KEYS.map((s) => ({
    value: s, label: `${STATUS_ICONS[s]} ${statusLabel(s, f.type)}`, c: STATUS_COLORS[s], fg: s === 'completed' || s === 'abandoned' ? 'var(--paper-2)' : 'var(--ink)',
  }));

  return html`
    <${Modal} title=${isEdit ? 'Editar' : 'Añadir a mi diario'} onClose=${onClose} color=${T.color} width=${860}>
      <form class="stack" style="--g:22px" onSubmit=${save}>
        <div class="row" style="--g:18px;align-items:flex-start">
          <div style="width:120px;aspect-ratio:2/3;border:3px solid var(--ink);border-radius:14px;overflow:hidden;position:relative;box-shadow:var(--sh-sm);transform:rotate(-2deg);flex:none">
            <${Cover} src=${f.cover} title=${f.title} type=${f.type} />
          </div>
          <div class="stack grow" style="--g:10px;min-width:220px">
            <div class="row"><${TypeBadge} type=${f.type} />${f.year && html`<span class="chip static">${f.year}</span>`}</div>
            <h3 class="h2">${f.title || 'Sin título'}</h3>
            ${(draft.type === 'book' || draft.type === 'audiobook') && html`
              <${Seg} value=${f.type} onChange=${(v) => set({ type: v })} options=${[
                { value: 'book', label: '📖 Libro', c: 'var(--yellow)' }, { value: 'audiobook', label: '🎧 Audiolibro', c: 'var(--teal)', fg: 'var(--paper-2)' }]} />`}
          </div>
        </div>

        <div class="field"><span class="label">Estado</span>
          <${Seg} value=${f.status} onChange=${(v) => {
            set({ status: v, finishedAt: v === 'completed' && !f.finishedAt ? todayISO() : f.finishedAt });
            if (v === 'abandoned') sfx.error();
          }} options=${statusOpts} />
          ${f.status === 'abandoned' && html`<p class="small muted" style="margin:4px 0 0">Irá a tu lista <b>Abandonadas</b>.</p>`}
          ${f.status === 'planned' && html`<p class="small muted" style="margin:4px 0 0">Irá a tu lista <b>${isBook ? 'Por leer' : 'Must watch'}</b>.</p>`}
        </div>

        <div class="field"><span class="label">Tu valoración</span>
          <${Stars} value=${f.rating} onChange=${(v) => set({ rating: v })} size=${46} />
        </div>

        <div class="row" style="--g:16px;align-items:flex-end">
          <div class="field grow"><label>Empezado</label><input class="input" type="date" value=${f.startedAt} onInput=${(e) => set({ startedAt: e.currentTarget.value })} /></div>
          ${f.status !== 'planned' && html`<div class="field grow"><label>${f.status === 'abandoned' ? 'Abandonado el' : 'Terminado'}</label><input class="input" type="date" value=${f.finishedAt} onInput=${(e) => set({ finishedAt: e.currentTarget.value })} /></div>`}
        </div>

        ${!isBook && html`
          <div class="field"><span class="label">Dónde lo ves</span>
            <div class="row" style="--g:8px">
              ${uniq([...platformsOf(draft), ...PLATFORMS]).map((p) => html`<${Chip} key=${p} on=${f.platform === p} color="var(--blue)" onClick=${() => set({ platform: f.platform === p ? '' : p })}>${p}</${Chip}>`)}
            </div>
          </div>`}

        ${isBook && html`
          <div class="panel tint flat" style="--c:var(--yellow)">
            <div class="stack" style="--g:14px">
              <div class="row between">
                <${Switch} checked=${f.consumption.read} onChange=${(v) => setC({ read: v })} label=${html`<b>📖 Leído</b>`} />
                ${f.consumption.read && html`<select class="select" style="max-width:260px" value=${f.consumption.readOn} onChange=${(e) => setC({ readOn: e.currentTarget.value })}>
                  <option value="">¿Dónde?</option>${READ_PLACES.map((p) => html`<option>${p}</option>`)}</select>`}
              </div>
              <div class="row between">
                <${Switch} checked=${f.consumption.listened} onChange=${(v) => setC({ listened: v })} label=${html`<b>🎧 Escuchado</b>`} />
                ${f.consumption.listened && html`<select class="select" style="max-width:260px" value=${f.consumption.listenedOn} onChange=${(e) => setC({ listenedOn: e.currentTarget.value })}>
                  <option value="">¿Dónde?</option>${LISTEN_PLACES.map((p) => html`<option>${p}</option>`)}</select>`}
              </div>
              ${f.consumption.listened && html`<div class="field"><label>Narración</label><input class="input" value=${f.narrator} placeholder="Quién lo narra" onInput=${(e) => set({ narrator: e.currentTarget.value })} /></div>`}
            </div>
          </div>`}

        ${manualLists.length > 0 && html`
          <div class="field"><span class="label">Añadir a listas</span>
            <div class="row" style="--g:8px">${manualLists.map((l) => html`<${Chip} key=${l.id} on=${inLists.includes(l.id)} color="var(--purple)"
              onClick=${() => setInLists((a) => (a.includes(l.id) ? a.filter((x) => x !== l.id) : [...a, l.id]))}>${l.emoji || '📋'} ${l.name}</${Chip}>`)}</div>
          </div>`}

        <div class="field"><label>Etiquetas</label><input class="input" value=${f.tags} placeholder="comfort, relectura, con amigos…" onInput=${(e) => set({ tags: e.currentTarget.value })} /></div>

        <${Switch} checked=${f.visibility === 'public'} onChange=${(v) => set({ visibility: v ? 'public' : 'private' })}
          label=${html`<span><b>${f.visibility === 'public' ? '🌍 Visible en tu perfil' : '🔒 Solo para mí'}</b> <span class="muted small">· la nota tiene su propia privacidad</span></span>`} />

        <div>
          <button type="button" class="btn sm ghost" onClick=${() => setShowMeta(!showMeta)}>${showMeta ? '▾' : '▸'} Editar datos (título, portada, tráiler…)</button>
          ${showMeta && html`
            <div class="stack" style="--g:12px;margin-top:12px">
              <div class="row" style="--g:12px">
                <div class="field grow"><label>Título</label><input class="input" value=${f.title} onInput=${(e) => set({ title: e.currentTarget.value })} required /></div>
                <div class="field" style="width:120px"><label>Año</label><input class="input" inputmode="numeric" value=${f.year} onInput=${(e) => set({ year: e.currentTarget.value })} /></div>
              </div>
              <div class="row" style="--g:12px">
                <div class="field grow"><label>Fecha de estreno / publicación</label><input class="input" type="date" value=${f.releaseDate} onInput=${(e) => set({ releaseDate: e.currentTarget.value })} /></div>
                ${isBook && html`<div class="field" style="width:140px"><label>Páginas</label><input class="input" inputmode="numeric" value=${f.pages} onInput=${(e) => set({ pages: e.currentTarget.value })} /></div>`}
              </div>
              <div class="field"><label>URL portada</label><input class="input" value=${f.cover} onInput=${(e) => set({ cover: e.currentTarget.value })} /></div>
              <div class="field"><label>URL imagen de fondo</label><input class="input" value=${f.backdrop} onInput=${(e) => set({ backdrop: e.currentTarget.value })} /></div>
              ${!isBook && html`<div class="field"><label>Tráiler (enlace de YouTube)</label><input class="input" value=${f.trailerUrl} placeholder="https://youtu.be/…" onInput=${(e) => set({ trailerUrl: e.currentTarget.value })} /></div>`}
              <div class="field"><label>Géneros (separados por comas)</label><input class="input" value=${f.genres} onInput=${(e) => set({ genres: e.currentTarget.value })} /></div>
              <div class="field"><label>${isBook ? 'Autoría' : f.type === 'movie' ? 'Dirección' : 'Creadores'} (comas)</label><input class="input" value=${f.creators} onInput=${(e) => set({ creators: e.currentTarget.value })} /></div>
            </div>`}
        </div>

        <div class="row between" style="margin-top:6px">
          <button type="button" class="btn ghost" onClick=${onClose}>Cancelar</button>
          <button type="submit" class="btn big red" disabled=${saving}>${saving ? 'Guardando…' : isEdit ? '¡Guardar!' : '¡Añadir!'}</button>
        </div>
      </form>
    </${Modal}>`;
}

// Atajo para abrir el formulario desde cualquier sitio.
export function useEntryForm() {
  const [draft, setDraft] = useState(null);
  const node = draft ? html`<${EntryForm} draft=${draft} onClose=${() => setDraft(null)} />` : null;
  return [node, setDraft];
}

