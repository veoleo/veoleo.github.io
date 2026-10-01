// Nota personal (Markdown, pública o privada), comentarios y "me gusta".
import { html, useState, useEffect, useRef } from 'preact-standalone';
import { Avatar, Switch, Spinner, Tabs, Icon } from './ui.js';
import { getNote, saveNote, watchComments, addComment, deleteComment, getLikes, setLike } from '../lib/db.js';
import { renderMarkdown } from '../lib/markdown.js';
import { useStore, toast } from '../lib/store.js';
import { timeAgo, toMillis } from '../lib/utils.js';
import { sfx } from '../lib/sound.js';
import { burstAt, flash } from '../lib/fx.js';

const TOOLS = [
  ['B', '**', '**', 'Negrita'], ['I', '_', '_', 'Cursiva'], ['H', '\n## ', '', 'Título'], ['“', '\n> ', '', 'Cita'],
  ['—', '\n- ', '', 'Lista'], ['☐', '\n- [ ] ', '', 'Tarea'], ['TIP', '\n> [!tip] ', '\n> ', 'Callout de Obsidian'], ['SPOILER', '\n> [!warning]- Spoiler\n> ', '', 'Spoiler plegable'],
];

export function NoteEditor({ e, mine }) {
  const [note, setNote] = useState(undefined);
  const [body, setBody] = useState('');
  const [pub, setPub] = useState(false);
  const [mode, setMode] = useState('edit');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const ta = useRef();

  useEffect(() => {
    let alive = true;
    getNote(e.id).then((n) => {
      if (!alive) return;
      setNote(n); setBody(n?.body || ''); setPub(!!n?.isPublic);
      setMode(n?.body ? 'preview' : 'edit');
    });
    return () => { alive = false; };
  }, [e.id]);

  // Autoguardado suave: 2,5 s después de dejar de escribir.
  useEffect(() => {
    if (!dirty || !mine) return;
    const t = setTimeout(() => save(null, true), 2500);
    return () => clearTimeout(t);
  }, [body, pub, dirty]);

  if (note === undefined) return html`<${Spinner} />`;
  if (!mine) {
    if (!note?.body) return html`<p class="muted">${e.hasNote ? 'La nota es privada.' : 'Sin nota.'}</p>`;
    return html`<div class="prose" dangerouslySetInnerHTML=${{ __html: renderMarkdown(note.body) }}></div>`;
  }

  function insert([, a, b]) {
    const el = ta.current; if (!el) return;
    const s = el.selectionStart, en = el.selectionEnd;
    const sel = body.slice(s, en);
    setBody(body.slice(0, s) + a + sel + b + body.slice(en)); setDirty(true); sfx.click();
    requestAnimationFrame(() => { el.focus(); el.selectionStart = s + a.length; el.selectionEnd = s + a.length + sel.length; });
  }
  async function save(ev, silent = false) {
    setSaving(true);
    try {
      await saveNote(e.id, body, pub && e.visibility === 'public');
      setDirty(false);
      if (!silent) { sfx.braam(0.35); flash('Nota guardada', '#9a7bff'); setMode('preview'); }
    } catch (x) { toast('No se pudo guardar la nota: ' + x.message, 'err'); }
    finally { setSaving(false); }
  }

  return html`
    <div class="stack" style="--g:18px">
      <div class="row between">
        <div style="flex:1;min-width:240px"><${Tabs} value=${mode} onChange=${setMode} options=${[{ value: 'edit', label: 'Escribir' }, { value: 'preview', label: 'Vista previa' }]} /></div>
        <${Switch} checked=${pub && e.visibility === 'public'} onChange=${(v) => {
          if (v && e.visibility !== 'public') { toast('La entrada es privada: hazla visible para publicar la nota', 'err'); return; }
          setPub(v); setDirty(true);
        }} label=${pub && e.visibility === 'public' ? 'Nota pública' : 'Nota privada'} />
      </div>
      ${mode === 'edit' ? html`
        <div class="row" style="--g:4px">${TOOLS.map((t) => html`<button class="btn sm glass" title=${t[3]} onClick=${() => insert(t)}>${t[0]}</button>`)}</div>
        <textarea ref=${ta} class="textarea" placeholder="Lo que te ha parecido. Markdown y callouts de Obsidian: **negrita**, > citas, - listas, > [!tip]…"
          value=${body} onInput=${(x) => { setBody(x.currentTarget.value); setDirty(true); }}
          onKeyDown=${(x) => { if ((x.metaKey || x.ctrlKey) && x.key === 's') { x.preventDefault(); save(); } }}></textarea>`
      : html`<div class="prose" style="min-height:80px" dangerouslySetInnerHTML=${{ __html: body ? renderMarkdown(body) : '<p class="muted">Todavía no has escrito nada.</p>' }}></div>`}
      <div class="row between">
        <span class="count">${saving ? 'GUARDANDO…' : dirty ? 'CAMBIOS SIN GUARDAR' : note?.updatedAt ? `GUARDADA ${timeAgo(toMillis(note.updatedAt)).toUpperCase()}` : ''} · ⌘S</span>
        <button class="btn" disabled=${saving || !dirty} onClick=${save}>Guardar nota</button>
      </div>
    </div>`;
}

export function LikeButton({ e }) {
  const { user } = useStore();
  const [likes, setLikes] = useState([]);
  useEffect(() => { getLikes(e.id).then(setLikes); }, [e.id]);
  const liked = likes.includes(user?.uid);
  return html`<button class="btn ${liked ? 'on' : 'ghost'}" aria-pressed=${liked} onClick=${async (ev) => {
    const el = ev.currentTarget;
    const next = liked ? likes.filter((x) => x !== user.uid) : [...likes, user.uid];
    setLikes(next);
    if (!liked) { sfx.pop(); burstAt(el, { count: 12, spread: 60, colors: ['#ff5fae', '#ff4d61', '#fff'] }); }
    try { await setLike(e.id, !liked); } catch { setLikes(likes); toast('No se pudo guardar el me gusta', 'err'); }
  }}><${Icon} name="heart" /> ${likes.length || ''}</button>`;
}

export function Comments({ e }) {
  const { user, profile } = useStore();
  const [list, setList] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => watchComments(e.id, setList, () => setList([])), [e.id]);

  async function send(ev) {
    ev.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try { await addComment(e.id, text.trim()); setText(''); sfx.pop(); }
    catch (x) { toast('No se pudo comentar: ' + x.message, 'err'); }
    finally { setBusy(false); }
  }
  return html`
    <div>
      ${list === null ? html`<${Spinner} />` : list.length === 0 ? html`<p class="muted" style="margin:0 0 20px">Todavía no hay comentarios.</p>` : list.map((c) => html`
        <div class="comment" key=${c.id}>
          <${Avatar} user=${c} size=${40} href=${`#/u/${c.authorId}`} />
          <div>
            <div class="row between">
              <div class="row" style="--g:10px"><a class="who" href=${`#/u/${c.authorId}`}>${c.authorName}</a>${c.authorHandle && html`<span class="when">@${c.authorHandle}</span>`}<span class="when">${timeAgo(toMillis(c.createdAt))}</span></div>
              ${(c.authorId === user?.uid || e.ownerId === user?.uid) && html`<button class="btn text" title="Borrar" aria-label="Borrar comentario" onClick=${() => deleteComment(e.id, c.id).catch((x) => toast(x.message, 'err'))}><${Icon} name="trash" size=${14} /></button>`}
            </div>
            <div class="prose" style="font-size:.98rem;margin-top:6px" dangerouslySetInnerHTML=${{ __html: renderMarkdown(c.text, { strict: true }) }}></div>
          </div>
        </div>`)}
      <form class="comment" onSubmit=${send}>
        <${Avatar} user=${profile} size=${40} />
        <div class="row" style="--g:12px;align-items:flex-end">
          <textarea class="input grow" rows="2" style="min-height:52px;resize:vertical" placeholder="Escribe un comentario…" value=${text}
            onInput=${(x) => setText(x.currentTarget.value)} maxlength="1999"
            onKeyDown=${(x) => { if (x.key === 'Enter' && (x.metaKey || x.ctrlKey)) send(x); }}></textarea>
          <button class="btn" disabled=${busy || !text.trim()}>Enviar</button>
        </div>
      </form>
    </div>`;
}
