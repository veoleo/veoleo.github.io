// Comunidad (explorar personas y actividad pública) y perfiles.
import { html, useState, useEffect } from 'preact-standalone';
import { Avatar, PosterCard, Spinner, Empty, Seg, useAsync } from '../components/ui.js';
import { FilteredGrid, readFilters } from './library.js';
import { ChallengesPage } from './challenges.js';
import { itemsOfList } from './lists.js';
import { useStore, toast } from '../lib/store.js';
import {
  searchUsers, recentUsers, exploreEntries, getUser, publicEntriesOf, publicListsOf, follow, unfollow, followCounts,
} from '../lib/db.js';
import { toMillis, debounce, TYPES } from '../lib/utils.js';
import { sfx } from '../lib/sound.js';
import { burstAt } from '../lib/fx.js';
import { FeedItem } from './home.js';

export function FollowButton({ uid, onChange }) {
  const { following, user } = useStore();
  const on = following.includes(uid);
  if (!user || uid === user.uid) return null;
  return html`<button class="btn ${on ? '' : 'blue'}" onClick=${async (ev) => {
    const el = ev.currentTarget;
    try {
      if (on) { await unfollow(uid); sfx.click(); }
      else { await follow(uid); sfx.pop(); burstAt(el, { count: 10, spread: 50 }); }
      onChange?.(!on);
    } catch (e) { toast(e.message, 'err'); }
  }}>${on ? '✓ Siguiendo' : '＋ Seguir'}</button>`;
}

function UserCard({ u }) {
  return html`<div class="panel" style="padding:18px;display:flex;gap:14px;align-items:center">
    <${Avatar} user=${u} size=${58} href=${`#/u/${u.uid}`} />
    <a href=${`#/u/${u.uid}`} style="flex:1;min-width:0;text-decoration:none">
      <b style="display:block;font-size:1.1rem">${u.displayName}</b><span class="small muted">@${u.handle}</span>
      ${u.bio && html`<p class="small line-clamp-3" style="margin:4px 0 0">${u.bio}</p>`}
    </a>
    <${FollowButton} uid=${u.uid} />
  </div>`;
}

export function ExplorePage() {
  const { user } = useStore();
  const [q, setQ] = useState('');
  const [users, setUsers] = useState(null);
  const activity = useAsync(async () => (await exploreEntries(60)).sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt)).slice(0, 40), []);
  useEffect(() => { recentUsers().then(setUsers).catch(() => setUsers([])); }, []);
  const run = debounce((v) => (v ? searchUsers(v) : recentUsers()).then(setUsers).catch(() => setUsers([])), 300);

  return html`<div class="page wrap">
    <h1 class="mega">La <span class="mark teal tilt-l">comunidad</span></h1>
    <div class="cols-2" style="margin-top:30px">
      <div>
        <div class="section-head" style="--c:var(--red)"><h2 class="h2">Actividad pública</h2></div>
        ${activity.loading ? html`<${Spinner} />` : activity.data?.length
          ? html`<div class="stack" style="--g:12px">${activity.data.filter((e) => e.ownerId !== user.uid).slice(0, 30).map((e) => html`<${FeedItem} key=${e.id} e=${e} />`)}</div>`
          : html`<p class="muted">Todavía no hay actividad pública.</p>`}
      </div>
      <aside>
        <div class="section-head" style="--c:var(--blue)"><h2 class="h2">Personas</h2></div>
        <input class="input" placeholder="Buscar @usuario" value=${q} onInput=${(e) => { setQ(e.currentTarget.value); run(e.currentTarget.value); }} />
        <div class="stack" style="--g:14px;margin-top:16px">
          ${users === null ? html`<${Spinner} />` : users.filter((u) => u.uid !== user.uid).map((u) => html`<${UserCard} key=${u.uid} u=${u} />`)}
          ${users?.length === 0 && html`<p class="muted">Nadie con ese usuario.</p>`}
        </div>
      </aside>
    </div>
  </div>`;
}

export function ProfilePage({ uid, route }) {
  const st = useStore();
  const isMe = uid === st.user.uid;
  const [tab, setTab] = useState(route.query.tab || 'library');
  const [filters, setFilters] = useState(() => readFilters({}));
  const [bump, setBump] = useState(0);
  const prof = useAsync(() => (isMe ? Promise.resolve(st.profile) : getUser(uid)), [uid, isMe && st.profile]);
  const ents = useAsync(() => (isMe ? Promise.resolve(st.entries) : publicEntriesOf(uid)), [uid, isMe && st.entries.length]);
  const lists = useAsync(async () => {
    const ls = isMe ? st.lists : await publicListsOf(uid);
    return ls.map((l) => ({ ...l }));
  }, [uid, isMe && st.lists.length]);
  const counts = useAsync(() => followCounts(uid), [uid, bump]);

  if (prof.loading) return html`<div class="page wrap"><${Spinner} /></div>`;
  const p = prof.data;
  if (!p) return html`<div class="page wrap"><${Empty} word="¿QUIÉN?" title="Este perfil no existe" /></div>`;
  const entries = ents.data || [];
  const stats = Object.values(TYPES).map((t) => [t, entries.filter((e) => e.type === t.key && e.status === 'completed').length]);

  return html`<div class="page wrap">
    <div class="panel color halftone" style="--c:var(--yellow);padding:34px">
      <div class="row" style="--g:26px;align-items:center">
        <${Avatar} user=${p} size=${130} />
        <div class="stack grow" style="--g:8px;min-width:240px">
          <h1 class="h1">${p.displayName}</h1>
          <span style="font-weight:700;font-size:1.1rem">@${p.handle}</span>
          ${p.bio && html`<p style="margin:4px 0 0;font-size:1.05rem;max-width:640px">${p.bio}</p>`}
          <div class="row" style="--g:16px;margin-top:6px;font-weight:700">
            <span><span class="pill-count">${counts.data?.followers ?? '…'}</span> seguidores</span>
            <span><span class="pill-count">${counts.data?.following ?? '…'}</span> siguiendo</span>
            <span><span class="pill-count">${entries.length}</span> entradas${isMe ? '' : ' públicas'}</span>
          </div>
        </div>
        <div class="stack" style="--g:10px">
          ${isMe ? html`<a class="btn" href="#/settings">✎ Editar perfil</a>` : html`<${FollowButton} uid=${uid} onChange=${() => setBump(bump + 1)} />`}
        </div>
      </div>
      <div class="grid" style="--min:150px;gap:12px;margin-top:24px">
        ${stats.map(([t, n]) => html`<div class="stat ${t.key === 'book' ? '' : 'dark'}" style=${`--c:${t.color};padding:14px`}><b style="font-size:2.2rem">${n}</b><span>${t.icon} ${t.plural}</span></div>`)}
      </div>
    </div>

    <div style="margin:30px 0 10px">
      <${Seg} value=${tab} onChange=${setTab} options=${[
        { value: 'library', label: '🎞 Biblioteca', c: 'var(--blue)', fg: 'var(--paper-2)' },
        { value: 'lists', label: '📋 Listas', c: 'var(--pink)' },
        { value: 'challenges', label: '🏆 Retos', c: 'var(--teal)', fg: 'var(--paper-2)' }]} />
    </div>

    ${ents.loading ? html`<${Spinner} />`
      : tab === 'library' ? (entries.length ? html`<${FilteredGrid} entries=${entries} filters=${filters} setFilters=${setFilters} exportName=${'TVDaily-' + p.handle} showExport=${isMe} />` : html`<${Empty} word="¡SILENCIO!" title="Nada público todavía" />`)
      : tab === 'lists' ? html`<div class="grid" style="--min:260px;margin-top:20px">
          ${(lists.data || []).map((l) => {
            const items = itemsOfList(l, entries);
            return html`<a class="list-card" key=${l.id} href=${`#/list/${l.id}`} style="--c:var(--paper-2)"><span class="emoji">${l.emoji || '📋'}</span><h3>${l.name}</h3>
              <div class="small">${l.kind === 'smart' ? '⚡ Automática · ' : ''}${items.length} elementos</div>
              <div class="stackp">${items.slice(0, 6).map((e) => html`<div><img src=${e.cover} alt="" /></div>`)}</div></a>`;
          })}
          ${!(lists.data || []).length && html`<p class="muted">Sin listas públicas.</p>`}
        </div>`
      : html`<div style="margin-top:10px"><${ChallengesPage} entries=${entries} profile=${p} readOnly=${!isMe} /></div>`}
  </div>`;
}
