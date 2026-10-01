// Comunidad (explorar personas y actividad pública) y perfiles.
import { html, useState, useEffect } from 'preact-standalone';
import { Avatar, Spinner, Tabs, useAsync, Icon, SectionHead, Scramble, shareLink } from '../components/ui.js';
import { FilteredGrid, readFilters } from './library.js';
import { ChallengesPage } from './challenges.js';
import { itemsOfList, ListCard } from './lists.js';
import { useStore, toast } from '../lib/store.js';
import { searchUsers, recentUsers, exploreEntries, getUser, publicEntriesOf, publicListsOf, follow, unfollow, followCounts } from '../lib/db.js';
import { toMillis, debounce, TYPES } from '../lib/utils.js';
import { sfx } from '../lib/sound.js';
import { burstAt } from '../lib/fx.js';
import { FeedItem } from './home.js';
import { askSaveAccount } from '../components/guest.js';
import { PostComposer, PostFeed, PostCard, EntryStrip } from '../components/posts.js';
import { CoverPicker, Top4 } from '../components/profile-kit.js';
import { latestPosts, postsFrom, postsOf, getPost, entrySnapshot } from '../lib/db.js';
import { img } from '../lib/utils.js';

export function FollowButton({ uid, onChange }) {
  const { following, user } = useStore();
  const on = following.includes(uid);
  if (!user || uid === user.uid) return null;
  if (user.isAnonymous) return html`<button class="btn" onClick=${() => askSaveAccount()}><${Icon} name="plus" /> Seguir</button>`;
  return html`<button class="btn ${on ? 'ghost' : ''}" onClick=${async (ev) => {
    const el = ev.currentTarget;
    try {
      if (on) { await unfollow(uid); sfx.click(); }
      else { await follow(uid); sfx.pop(); burstAt(el, { count: 10, spread: 50 }); }
      onChange?.(!on);
    } catch (e) { toast(e.message, 'err'); }
  }}>${on ? html`<${Icon} name="check" /> Siguiendo` : html`<${Icon} name="plus" /> Seguir`}</button>`;
}

function UserRow({ u }) {
  return html`<div class="feed-item" style="grid-template-columns:auto 1fr auto">
    <${Avatar} user=${u} size=${48} href=${`#/u/${u.uid}`} />
    <a href=${`#/u/${u.uid}`} style="min-width:0;text-decoration:none">
      <div style="font-weight:600">${u.displayName}</div><div class="count">@${u.handle}</div>
      ${u.bio && html`<p class="small muted line-clamp-3" style="margin:6px 0 0">${u.bio}</p>`}
    </a>
    <${FollowButton} uid=${u.uid} />
  </div>`;
}

export function ExplorePage() {
  const { user, following } = useStore();
  const [q, setQ] = useState('');
  const [users, setUsers] = useState(null);
  const [tab, setTab] = useState('all');
  const [posts, setPosts] = useState(null);
  const [bump, setBump] = useState(0);
  const activity = useAsync(async () => (tab !== 'diary' ? [] : (await exploreEntries(60)).sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt)).slice(0, 40)), [tab]);
  useEffect(() => { recentUsers().then(setUsers).catch(() => setUsers([])); }, []);
  useEffect(() => {
    if (tab === 'diary') return;
    setPosts(null);
    const load = tab === 'following' ? (following.length ? postsFrom([...following, user.uid]) : Promise.resolve([])) : latestPosts(60);
    load.then(setPosts).catch((e) => { console.warn('[Veoleo] posts', e.message); setPosts([]); });
  }, [tab, bump, following.length]);
  const run = debounce((v) => (v ? searchUsers(v) : recentUsers()).then(setUsers).catch(() => setUsers([])), 300);
  const others = (users || []).filter((u) => u.uid !== user.uid);

  return html`<div class="page wrap">
    <div class="page-head"><div><div class="kicker">Qué ve, lee y escucha la gente</div><h1 class="display" style="margin-top:20px"><${Scramble} text="Comunidad" /></h1></div>
      <button class="btn glass" onClick=${() => shareLink({ title: 'Veoleo', text: 'Únete a Veoleo', url: `${location.origin}${location.pathname}` })}><${Icon} name="share" /> Invitar</button></div>
    <div class="cols-2">
      <section style="min-width:0">
        <${PostComposer} onPosted=${() => { setTab('all'); setBump(bump + 1); }} />
        <div style="margin:18px 0 6px"><${Tabs} value=${tab} onChange=${setTab} options=${[
          { value: 'all', label: 'Para todos' }, { value: 'following', label: 'Siguiendo', c: 'var(--blue)' }, { value: 'diary', label: 'Diarios', c: 'var(--teal)' }]} /></div>
        ${tab === 'diary'
          ? (activity.loading ? html`<${Spinner} />` : activity.data?.filter((e) => e.ownerId !== user.uid).length
            ? html`<div>${activity.data.filter((e) => e.ownerId !== user.uid).slice(0, 30).map((e) => html`<${FeedItem} key=${e.id} e=${e} />`)}</div>`
            : html`<p class="muted" style="margin-top:20px">Todavía no hay actividad pública de otras personas. Invita a tus amigos.</p>`)
          : html`<${PostFeed} posts=${posts} empty=${html`<p class="muted" style="margin-top:20px">${tab === 'following'
              ? 'Cuando sigas a gente, aquí verás lo que comparten.' : 'Nadie ha publicado todavía. ¡Estrena el muro: cuenta qué estás viendo!'}</p>`} />`}
      </section>
      <aside>
        <${SectionHead} kicker="Buscar" title="Personas" color="var(--blue)" />
        <input class="input" placeholder="@usuario" value=${q} onInput=${(e) => { setQ(e.currentTarget.value); run(e.currentTarget.value); }} />
        <div style="margin-top:12px">
          ${users === null ? html`<${Spinner} />` : others.map((u) => html`<${UserRow} key=${u.uid} u=${u} />`)}
          ${users && !others.length && html`<p class="muted" style="margin-top:16px">Nadie por aquí todavía.</p>`}
        </div>
      </aside>
    </div>
  </div>`;
}

export function PostPage({ id }) {
  const post = useAsync(() => getPost(id), [id]);
  return html`<div class="page wrap" style="max-width:820px">
    <div class="kicker">Comunidad</div>
    ${post.loading ? html`<${Spinner} />` : post.data ? html`<${PostCard} p=${post.data} open />`
      : html`<div class="empty"><h1 class="h1" style="margin:20px 0">Publicación no encontrada</h1><a class="btn" href="#/explore">Ir a Comunidad</a></div>`}
  </div>`;
}

export function ProfilePage({ uid, route }) {
  const st = useStore();
  const isMe = uid === st.user.uid;
  const [tab, setTab] = useState(route.query.tab || 'posts');
  const [filters, setFilters] = useState(() => readFilters({}));
  const [bump, setBump] = useState(0);
  const [editCover, setEditCover] = useState(false);
  const [postBump, setPostBump] = useState(0);
  const prof = useAsync(() => (isMe ? Promise.resolve(st.profile) : getUser(uid)), [uid, isMe && st.profile]);
  const ents = useAsync(() => (isMe ? Promise.resolve(st.entries) : publicEntriesOf(uid)), [uid, isMe && st.entries.length]);
  const lists = useAsync(async () => (isMe ? st.lists : await publicListsOf(uid)), [uid, isMe && st.lists.length]);
  const counts = useAsync(() => followCounts(uid), [uid, bump]);
  const posts = useAsync(() => postsOf(uid).catch(() => []), [uid, postBump]);

  if (prof.loading) return html`<div class="page wrap"><${Spinner} /></div>`;
  const p = prof.data;
  if (!p) return html`<div class="page wrap"><div class="empty"><h1 class="display">Perfil no encontrado</h1></div></div>`;
  const entries = ents.data || [];
  const accent = p.accent || 'var(--accent)';
  const now = entries.filter((e) => e.status === 'in_progress' && (isMe ? true : e.visibility === 'public'))
    .sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt)).slice(0, 4);
  const site = (p.website || '').trim();

  return html`<div class="page wrap" style=${`--pc:${accent}`}>
    <div class=${'pcover' + (p.coverURL ? '' : ' blank')}>
      ${p.coverURL && html`<img src=${img(p.coverURL, 1800)} alt="" style=${`object-position:50% ${p.coverPos ?? 35}%`} referrerpolicy="no-referrer"
        onError=${(e) => { if (e.currentTarget.src !== p.coverURL) e.currentTarget.src = p.coverURL; }} />`}
      ${isMe && html`<button class="btn sm glass edit" onClick=${() => setEditCover(true)}><${Icon} name="image" size=${14} /> Portada y color</button>`}
    </div>
    <div class="phead">
      <div class="row" style="--g:28px;align-items:flex-end">
        <${Avatar} user=${p} size=${132} />
        <div class="stack" style="--g:10px">
          <div class="kicker">@${p.handle}${p.location ? ` · ${p.location}` : ''}</div>
          <h1 class="h1"><${Scramble} text=${p.displayName} /></h1>
          ${p.bio && html`<p class="lead" style="font-size:1.02rem">${p.bio}</p>`}
          ${site && html`<div class="plinks"><a href=${/^https?:/.test(site) ? site : 'https://' + site} target="_blank" rel="noopener nofollow">${site.replace(/^https?:\/\//, '').replace(/\/$/, '')} ↗</a></div>`}
        </div>
      </div>
      <div class="row">
        ${isMe ? html`<a class="btn ghost" href="#/settings"><${Icon} name="edit" /> Editar perfil</a>` : html`<${FollowButton} uid=${uid} onChange=${() => setBump(bump + 1)} />`}
        <button class="btn icon glass" title="Compartir perfil" aria-label="Compartir perfil" onClick=${() => shareLink({ title: p.displayName, url: `${location.origin}${location.pathname}#/u/${uid}` })}><${Icon} name="share" /></button>
      </div>
    </div>
    <div class="stats" style="margin-top:40px">
      <div class="stat"><b>${counts.data?.followers ?? '—'}</b><span>Seguidores</span></div>
      <div class="stat"><b>${counts.data?.following ?? '—'}</b><span>Siguiendo</span></div>
      ${Object.values(TYPES).map((t) => html`<div class="stat" style=${`--c:${t.color}`}><b>${entries.filter((e) => e.type === t.key && e.status === 'completed').length}</b><span>${t.plural}</span></div>`)}
    </div>

    ${(now.length > 0 || (p.favorites || []).length > 0 || isMe) && html`<div class="cols-2" style="margin-top:56px;align-items:start">
      <section style="min-width:0">${now.length > 0 && html`<${SectionHead} kicker="Ahora mismo" title="En curso" color=${accent} />
        <div class="now">${now.map((e) => html`<${EntryStrip} key=${e.id} en=${entrySnapshot(e)} href=${isMe ? `#/item/${e.id}` : `#/search?type=${e.type}&q=${encodeURIComponent(e.title)}`} />`)}</div>`}</section>
      <aside>${((p.favorites || []).length > 0 || isMe) && html`<${SectionHead} kicker="Favoritos" title="Top 4" color=${accent} /><${Top4} favorites=${p.favorites || []} editable=${isMe} />`}</aside>
    </div>`}

    <div style="margin:64px 0 24px">
      <${Tabs} value=${tab} onChange=${setTab} options=${[
        { value: 'posts', label: 'Publicaciones', n: (posts.data || []).length, c: accent },
        { value: 'library', label: 'Biblioteca', n: entries.length }, { value: 'lists', label: 'Listas', n: (lists.data || []).length, c: 'var(--pink)' }, { value: 'challenges', label: 'Retos', c: 'var(--teal)' }]} />
    </div>

    ${tab === 'posts' ? html`<div style="max-width:820px">
        ${isMe && html`<${PostComposer} onPosted=${() => setPostBump(postBump + 1)} />`}
        <${PostFeed} posts=${posts.loading ? null : posts.data} empty=${html`<p class="muted" style="margin-top:20px">${isMe ? 'Comparte qué estás viendo: aparecerá aquí y en Comunidad.' : 'Sin publicaciones todavía.'}</p>`} /></div>`
      : ents.loading ? html`<${Spinner} />`
      : tab === 'library' ? (entries.length ? html`<${FilteredGrid} entries=${entries} filters=${filters} setFilters=${setFilters} exportName=${'Veoleo-' + p.handle} showExport=${isMe} />` : html`<p class="lead">Nada público todavía.</p>`)
      : tab === 'lists' ? html`<div class="grid" style="--min:280px;gap:48px 40px">
          ${(lists.data || []).map((l) => html`<${ListCard} key=${l.id} l=${{ ...l, items: itemsOfList(l, entries), c: l.kind === 'smart' ? 'var(--teal)' : 'var(--purple)' }} />`)}
          ${!(lists.data || []).length && html`<p class="muted">Sin listas públicas.</p>`}
        </div>`
      : html`<${ChallengesPage} entries=${entries} profile=${p} readOnly=${!isMe} />`}
    ${editCover && html`<${CoverPicker} onClose=${() => setEditCover(false)} />`}
  </div>`;
}
