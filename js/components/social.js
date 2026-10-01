// Nota personal (Markdown, pública o privada), comentarios y "me gusta".
import { html, useState, useEffect, useRef } from 'preact-standalone';
import { Avatar, Switch, Spinner } from './ui.js';
import { getNote, saveNote, watchComments, addComment, deleteComment, getLikes, setLike } from '../lib/db.js';
import { renderMarkdown } from '../lib/markdown.js';
import { useStore, toast } from '../lib/store.js';
import { timeAgo, toMillis } from '../lib/utils.js';
import { sfx } from '../lib/sound.js';
import { burstAt, onomato } from '../lib/fx.js';

const TOOLS = [
  ['B', '**', '**', 'Negrita'], ['I', '_', '_', 'Cursiva'], ['H', '\n## ', '', 'Título'], ['❝', '\n> ', '', 'Cita'],
  ['•', '\n- ', '', 'Lista'], ['☐', '\n- [ ] ', '', 'Tarea'], ['💡', '\n> [!tip] ', '\n> ', 'Callout'], ['⚠', '\n> [!warning] Spoiler\n> ', '', 'Spoiler'],
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

  if (note === undefined) return html`<${Spinner} />`;
  if (!mine) {
    if (!note?.body) return html`<p class="muted">${e.hasNote ? '🔒 La nota es privada.' : 'Sin nota.'}</p>`;
    return html`<div class="panel prose" dangerouslySetInnerHTML=${{ __html: renderMarkdown(note.body) }}></div>`;
  }

  function insert([, a, b]) {
    const el = ta.current; if (!el) return;
    const s = el.selectionStart, en = el.selectionEnd;
    const sel = body.slice(s, en);
    const next = body.slice(0, s) + a + sel + b + body.slice(en);
    setBody(next); setDirty(true); sfx.click();
    requestAnimationFrame(() => { el.focus(); el.selectionStart = s + a.length; el.selectionEnd = s + a.length + sel.length; });
  }
  async function save(ev) {
    setSaving(true);
    try {
      await saveNote(e.id, body, pub && e.visibility === 'public');
      setDirty(false); sfx.braam(.6); toast('Nota guardada', 'ok');
      if (ev) onomato(ev.clientX, ev.clientY - 40, '¡ANOTADO!', '#8e6cef');
      setMode('preview');
    } catch (x) { toast('No se pudo guardar la nota: ' + x.message, 'err'); }
    finally { setSaving(false); }
  }

  return html`
    <div class="stack" style="--g:14px">
      <div class="row between">
        <div class="seg" style="box-shadow:none">
          <button class=${mode === 'edit' ? 'on' : ''} onClick=${() => setMode('edit')}>✎ Escribir</button>
          <button class=${mode === 'preview' ? 'on' : ''} onClick=${() => setMode('preview')}>👁 Vista previa</button>
        </div>
        <${Switch} checked=${pub && e.visibility === 'public'} onChange=${(v) => {
          if (v && e.visibility !== 'public') { toast('La entrada es privada: hazla visible para publicar la nota', 'err'); return; }
          setPub(v); setDirty(true);
        }} label=${html`<b>${pub && e.visibility === 'public' ? '🌍 Nota pública' : '🔒 Nota privada'}</b>`} />
      </div>
      ${mode === 'edit' ? html`
        <div class="row" style="--g:6px">${TOOLS.map((t) => html`<button class="btn sm" title=${t[3]} onClick=${() => insert(t)}>${t[0]}</button>`)}</div>
        <textarea ref=${ta} class="textarea" placeholder="¿Qué te ha parecido? Escribe en Markdown: **negrita**, > citas, - listas, > [!tip] callouts de Obsidian…"
          value=${body} onInput=${(x) => { setBody(x.currentTarget.value); setDirty(true); }}
          onKeyDown=${(x) => { if ((x.metaKey || x.ctrlKey) && x.key === 's') { x.preventDefault(); save(); } }}></textarea>`
      : html`<div class="panel prose" style="min-height:120px" dangerouslySetInnerHTML=${{ __html: body ? renderMarkdown(body) : '<p class="muted">Sin nota todavía.</p>' }}></div>`}
      <div class="row between">
        <span class="small muted">${note?.updatedAt ? `Guardada ${timeAgo(toMillis(note.updatedAt))}` : ''}${dirty ? ' · cambios sin guardar' : ''} · ⌘S para guardar</span>
        <button class="btn red" disabled=${saving || !dirty} onClick=${save}>${saving ? 'Guardando…' : '💾 Guardar nota'}</button>
      </div>
    </div>`;
}

export function LikeButton({ e }) {
  const { user } = useStore();
  const [likes, setLikes] = useState([]);
  useEffect(() => { getLikes(e.id).then(setLikes); }, [e.id]);
  const liked = likes.includes(user?.uid);
  return html`<button class="btn ${liked ? 'pink' : ''}" aria-pressed=${liked} onClick=${async (ev) => {
    const el = ev.currentTarget;
    const next = liked ? likes.filter((x) => x !== user.uid) : [...likes, user.uid];
    setLikes(next);
    if (!liked) { sfx.pop(); burstAt(el, { count: 12, spread: 60, colors: ['#ee7ba8', '#f2545b', '#f9c846'] }); }
    try { await setLike(e.id, !liked); } catch { setLikes(likes); toast('No se pudo guardar el me gusta', 'err'); }
  }}>${liked ? '♥' : '♡'} ${likes.length || ''}</button>`;
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
    <div class="stack" style="--g:6px">
      ${list === null ? html`<${Spinner} />` : list.length === 0 ? html`<p class="muted">Nadie ha comentado todavía. ¡Rompe el hielo!</p>` : list.map((c) => html`
        <div class="comment" key=${c.id}>
          <${Avatar} user=${c} size=${42} href=${`#/u/${c.authorId}`} />
          <div>
            <div class="bubble">
              <div class="row between small" style="margin-bottom:4px">
                <a href=${`#/u/${c.authorId}`} style="font-weight:800;text-decoration:none">${c.authorName}${c.authorHandle ? html` <span class="muted">@${c.authorHandle}</span>` : ''}</a>
                <span class="row muted" style="--g:8px">${timeAgo(toMillis(c.createdAt))}
                  ${(c.authorId === user?.uid || e.ownerId === user?.uid) && html`<button class="btn sm ghost" style="padding:2px 8px" title="Borrar" onClick=${() => deleteComment(e.id, c.id).catch((x) => toast(x.message, 'err'))}>✕</button>`}
                </span>
              </div>
              <div class="prose" style="font-size:.98rem" dangerouslySetInnerHTML=${{ __html: renderMarkdown(c.text) }}></div>
            </div>
          </div>
        </div>`)}
      <form class="comment" style="margin-top:8px" onSubmit=${send}>
        <${Avatar} user=${profile} size=${42} />
        <div class="row" style="--g:10px;align-items:flex-start">
          <textarea class="input grow" rows="2" style="min-height:52px;resize:vertical" placeholder="Escribe un comentario…" value=${text}
            onInput=${(x) => setText(x.currentTarget.value)} maxlength="1999"
            onKeyDown=${(x) => { if (x.key === 'Enter' && (x.metaKey || x.ctrlKey)) send(x); }}></textarea>
          <button class="btn blue" disabled=${busy || !text.trim()}>Enviar</button>
        </div>
      </form>
    </div>`;
}
