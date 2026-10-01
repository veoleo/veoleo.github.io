// Publicaciones de la comunidad: qué estás viendo o leyendo, por dónde vas y qué te parece.
import { html, useState, useEffect, useMemo } from 'preact-standalone';
import { Avatar, Cover, BgImg, Stars, Modal, Spinner, Icon, Switch, shareLink } from './ui.js';
import { useStore, toast } from '../lib/store.js';
import {
  createPost, deletePost, entrySnapshot, likePost, myPostLikes, watchReplies, addReply, deleteReply, updateEntry,
} from '../lib/db.js';
import { TYPES, STATUS_COLORS, statusLabel, timeAgo, toMillis } from '../lib/utils.js';
import { renderMarkdown } from '../lib/markdown.js';
import { sfx } from '../lib/sound.js';
import { t } from '../lib/i18n.js';
import { burstAt, flash } from '../lib/fx.js';

const MAX = 500;
const postUrl = (id) => `${location.origin}${location.pathname}#/post/${id}`;

// Orden del selector: primero lo que tienes en curso, luego lo último que has tocado.
function pickable(entries) {
  const rank = { in_progress: 0, up_to_date: 1, completed: 2, planned: 3, abandoned: 4 };
  return [...entries].sort((a, b) => (rank[a.status] ?? 5) - (rank[b.status] ?? 5) || toMillis(b.updatedAt) - toMillis(a.updatedAt));
}

function progressText(pr, type) {
  if (!pr) return '';
  if (type === 'series' && pr.total) return `${pr.last ? pr.last + ' · ' : ''}${pr.done}/${pr.total} EP`;
  if (type === 'series' && pr.last) return pr.last;
  return pr.pct != null ? `${pr.pct}%` : '';
}

/* ── tira con el título adjunto ── */
export function EntryStrip({ en, href }) {
  if (!en) return null;
  const T = TYPES[en.type] || TYPES.series;
  const pct = en.progress?.pct;
  return html`<a class="pstrip" href=${href || 'javascript:void 0'} style=${`--c:${STATUS_COLORS[en.status] || T.color}`}>
    <div class="bg"><${BgImg} src=${en.backdrop || en.cover} w=${900} /></div>
    <div class="cv"><${Cover} src=${en.cover} title=${en.title} type=${en.type} w=${160} /></div>
    <div class="tx">
      <span class="st">${statusLabel(en.status, en.type)}${progressText(en.progress, en.type) ? html` · <b>${progressText(en.progress, en.type)}</b>` : ''}</span>
      <h4>${en.title}</h4>
      <span class="count">${T.label}${en.year ? ` · ${en.year}` : ''}</span>
      ${en.rating > 0 && html`<${Stars} value=${en.rating} readOnly size=${13} showValue=${false} />`}
    </div>
    ${pct != null && html`<i class="pbar" style=${`--p:${pct}%`}></i>`}
  </a>`;
}

/* ── compositor ── */
export function PostComposer({ preset = null, onPosted, autoFocus = false }) {
  const { entries, profile } = useStore();
  const [text, setText] = useState('');
  const [entryId, setEntryId] = useState(preset?.id || '');
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState('');
  const [pct, setPct] = useState(null);
  const [spoiler, setSpoiler] = useState(false);
  const [busy, setBusy] = useState(false);
  const entry = entries.find((e) => e.id === entryId) || (preset?.id === entryId ? preset : null);
  useEffect(() => { setPct(entry && entry.type !== 'series' ? (entry.progressPct ?? (entry.status === 'completed' ? 100 : 0)) : null); }, [entryId]);
  const options = useMemo(() => pickable(entries).filter((e) => !q || e.title.toLowerCase().includes(q.toLowerCase())).slice(0, 40), [entries, q]);
  const snap = entry ? entrySnapshot(entry, pct) : null;

  async function publish(ev) {
    ev?.preventDefault();
    if (busy || (!text.trim() && !entry)) return;
    setBusy(true);
    try {
      if (entry && entry.type !== 'series' && pct != null && pct !== entry.progressPct && entries.some((e) => e.id === entry.id)) {
        await updateEntry(entry.id, { progressPct: pct }).catch(() => {});
      }
      const id = await createPost({ text, entry: snap, spoiler });
      setText(''); setSpoiler(false); if (!preset) setEntryId('');
      sfx.chime(); flash('Publicado', '#c6ff3d');
      onPosted?.(id);
    } catch (x) { toast(x.message, 'err'); sfx.error(); }
    finally { setBusy(false); }
  }

  return html`<form class="composer" onSubmit=${publish}>
    <${Avatar} user=${profile} size=${46} />
    <div class="stack" style="--g:14px;min-width:0">
      <textarea class="ctext" rows="2" maxlength=${MAX} placeholder=${entry ? `¿Qué te está pareciendo ${entry.title}?` : '¿Qué estás viendo, leyendo o escuchando?'}
        value=${text} autofocus=${autoFocus} onInput=${(e) => setText(e.currentTarget.value)}
        onKeyDown=${(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) publish(e); }}></textarea>
      ${snap && html`<div class="cattach"><${EntryStrip} en=${snap} />
        <button type="button" class="btn icon text" title="Quitar" aria-label="Quitar" onClick=${() => setEntryId('')}><${Icon} name="close" size=${16} /></button></div>`}
      ${entry && entry.type !== 'series' && html`<div class="field" style="max-width:420px"><label>Progreso · ${pct ?? 0}%</label>
        <input type="range" min="0" max="100" step="5" value=${pct ?? 0} onInput=${(e) => setPct(Number(e.currentTarget.value))} /></div>`}
      ${picking && html`<div class="cpick">
        <input class="input" placeholder="Busca en tu diario…" value=${q} onInput=${(e) => setQ(e.currentTarget.value)} />
        <div class="cpick-list">${options.map((e) => html`<button type="button" key=${e.id} onClick=${() => { setEntryId(e.id); setPicking(false); setQ(''); sfx.tick(3); }}>
          <span class="th"><${Cover} src=${e.cover} title=${e.title} type=${e.type} w=${80} /></span>
          <span class="nm">${e.title}</span><span class="count" style=${`color:${STATUS_COLORS[e.status]}`}>${statusLabel(e.status, e.type)}</span></button>`)}
          ${!options.length && html`<p class="muted small" style="padding:12px 0">Nada en tu diario con ese nombre.</p>`}</div>
      </div>`}
      <div class="row between" style="--g:10px">
        <div class="row" style="--g:6px">
          <button type="button" class="btn sm ghost" onClick=${() => { setPicking(!picking); sfx.click(); }}><${Icon} name="plus" size=${14} /> ${entry ? 'Cambiar título' : 'Adjuntar título'}</button>
          <${Switch} checked=${spoiler} onChange=${setSpoiler} label="Spoiler" />
        </div>
        <div class="row" style="--g:12px"><span class="count">${text.length}/${MAX}</span>
          <button class="btn" disabled=${busy || (!text.trim() && !entry)}>${busy ? 'Publicando…' : 'Publicar'}</button></div>
      </div>
    </div>
  </form>`;
}

export function ComposerModal({ entry, onClose }) {
  return html`<${Modal} kicker="Comunidad" title="Compartir" width=${720} onClose=${onClose}>
    <${PostComposer} preset=${entry} autoFocus onPosted=${(id) => { onClose(); location.hash = `#/post/${id}`; }} />
  </${Modal}>`;
}

/* ── respuestas ── */
export function Replies({ post }) {
  const { user, profile } = useStore();
  const [list, setList] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => watchReplies(post.id, setList, () => setList([])), [post.id]);
  async function send(ev) {
    ev.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try { await addReply(post.id, text); setText(''); sfx.pop(); }
    catch (x) { toast('No se pudo responder: ' + x.message, 'err'); }
    finally { setBusy(false); }
  }
  return html`<div class="replies">
    ${list === null ? html`<${Spinner} />` : list.map((r) => html`<div class="reply" key=${r.id}>
      <${Avatar} user=${r} size=${32} href=${`#/u/${r.authorId}`} />
      <div style="min-width:0">
        <div class="row" style="--g:10px"><a class="who" href=${`#/u/${r.authorId}`}>${r.authorName}</a><span class="when">${timeAgo(toMillis(r.createdAt) || Date.now())}</span>
          ${(r.authorId === user?.uid || post.authorId === user?.uid) && html`<button class="btn text" style="margin-left:auto" title="Borrar" aria-label="Borrar respuesta"
            onClick=${() => deleteReply(post.id, r.id).catch((x) => toast(x.message, 'err'))}><${Icon} name="trash" size=${13} /></button>`}</div>
        <div class="prose rtext" dangerouslySetInnerHTML=${{ __html: renderMarkdown(r.text) }}></div>
      </div></div>`)}
    <form class="reply" onSubmit=${send}>
      <${Avatar} user=${profile} size=${32} />
      <div class="row" style="--g:10px;align-items:flex-end">
        <textarea class="input grow" rows="1" style="min-height:44px;resize:vertical" maxlength="999" placeholder="Responder…" value=${text}
          onInput=${(x) => setText(x.currentTarget.value)} onKeyDown=${(x) => { if (x.key === 'Enter' && !x.shiftKey) send(x); }}></textarea>
        <button class="btn sm" disabled=${busy || !text.trim()}>Enviar</button>
      </div>
    </form>
  </div>`;
}

/* ── publicación ── */
export function PostCard({ p, liked = false, open = false, onDeleted }) {
  const { user } = useStore();
  const [on, setOn] = useState(liked);
  const [n, setN] = useState(p.likeCount || 0);
  const [showReplies, setShowReplies] = useState(open);
  const [reveal, setReveal] = useState(!p.spoiler);
  const [gone, setGone] = useState(false);
  useEffect(() => setOn(liked), [liked]);
  if (gone) return null;
  const mine = p.authorId === user?.uid;
  async function toggleLike(ev) {
    const el = ev.currentTarget; const next = !on;
    setOn(next); setN(n + (next ? 1 : -1));
    if (next) { sfx.pop(); burstAt(el, { count: 8, spread: 36 }); } else sfx.click();
    try { await likePost(p.id, next); } catch (x) { setOn(!next); setN(n); toast(x.message, 'err'); }
  }
  async function remove() {
    if (!confirm(t('¿Borrar esta publicación?'))) return;
    try { await deletePost(p.id); setGone(true); onDeleted?.(p.id); sfx.close(); } catch (x) { toast(x.message, 'err'); }
  }
  const entryHref = p.entry ? (mine ? `#/item/${p.entry.id}` : `#/search?type=${p.entry.type}&q=${encodeURIComponent(p.entry.title)}`) : '';
  return html`<article class="post">
    <${Avatar} user=${p} size=${46} href=${`#/u/${p.authorId}`} />
    <div class="pbody">
      <header class="row" style="--g:10px">
        <a class="who" href=${`#/u/${p.authorId}`}>${p.authorName}</a>
        ${p.authorHandle && html`<span class="when">@${p.authorHandle}</span>`}
        <a class="when" href=${`#/post/${p.id}`}>${timeAgo(toMillis(p.createdAt) || Date.now())}</a>
      </header>
      ${p.text && html`<div class=${'ptext' + (reveal ? '' : ' blur')} onClick=${() => !reveal && setReveal(true)}>
        ${!reveal && html`<span class="spoil">Spoiler · pulsa para ver</span>`}
        <div class="prose" dangerouslySetInnerHTML=${{ __html: renderMarkdown(p.text) }}></div></div>`}
      ${p.entry && html`<${EntryStrip} en=${p.entry} href=${entryHref} />`}
      <footer class="pacts">
        <button class=${'pact' + (on ? ' on' : '')} onClick=${toggleLike} aria-pressed=${on} title="Me gusta"><${Icon} name="heart" size=${17} /><span>${n || ''}</span></button>
        <button class=${'pact' + (showReplies ? ' on2' : '')} onClick=${() => { setShowReplies(!showReplies); sfx.click(); }} title="Responder"><${Icon} name="chat" size=${17} /><span>${p.replyCount || ''}</span></button>
        <button class="pact" onClick=${() => shareLink({ title: p.entry?.title || p.authorName, text: p.text?.slice(0, 120) || '', url: postUrl(p.id) })} title="Compartir"><${Icon} name="share" size=${17} /></button>
        ${mine && html`<button class="pact" style="margin-left:auto" onClick=${remove} title="Borrar"><${Icon} name="trash" size=${16} /></button>`}
      </footer>
      ${showReplies && html`<${Replies} post=${p} />`}
    </div>
  </article>`;
}

/* ── feed ── */
export function PostFeed({ posts, empty }) {
  const [liked, setLiked] = useState(new Set());
  const ids = (posts || []).map((p) => p.id).join(',');
  useEffect(() => { if (posts?.length) myPostLikes(posts.map((p) => p.id)).then(setLiked).catch(() => {}); }, [ids]);
  if (!posts) return html`<${Spinner} />`;
  if (!posts.length) return empty || html`<p class="muted">Todavía no hay publicaciones.</p>`;
  return html`<div class="posts">${posts.map((p) => html`<${PostCard} key=${p.id} p=${p} liked=${liked.has(p.id)} />`)}</div>`;
}
