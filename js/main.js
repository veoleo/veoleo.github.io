// Punto de entrada: auth, shell, navegación, paleta de comandos e intro.
import { html, render, useState, useEffect, useRef } from 'preact-standalone';
import { useStore, setState, toast } from './lib/store.js';
import { onAuth, ensureProfile, loadSettings, watchMine, logout } from './lib/db.js';
import { useRoute, go } from './lib/router.js';
import { sfx, unlockAudio, isSoundOn, setSound } from './lib/sound.js';
import { observeReveal, trackCursor } from './lib/fx.js';
import { Avatar, Toasts, Icon, Cover } from './components/ui.js';
import { TYPES, statusLabel } from './lib/utils.js';
import { AuthPage } from './pages/auth.js';
import { HomePage } from './pages/home.js';
import { SearchPage } from './pages/search.js';
import { DiscoverPage } from './pages/discover.js';
import { LibraryPage } from './pages/library.js';
import { ItemPage } from './pages/item.js';
import { ListsPage, ListPage } from './pages/lists.js';
import { ChallengesPage } from './pages/challenges.js';
import { ExplorePage, ProfilePage } from './pages/social.js';
import { SettingsPage } from './pages/settings.js';
import { NewsPage } from './pages/news.js';
import { StatsPage } from './pages/stats.js';
import { DataPage } from './pages/data.js';

const NAV = [
  ['home', '', 'Inicio', 'home'],
  ['discover', 'discover', 'Novedades', 'spark'],
  ['news', 'news', 'Noticias', 'news'],
  ['library', 'library', 'Biblioteca', 'grid'],
  ['lists', 'lists', 'Listas', 'list'],
  ['challenges', 'challenges', 'Retos', 'trophy'],
  ['explore', 'explore', 'Comunidad', 'users'],
];

function Intro() {
  const [show, setShow] = useState(() => {
    try { return localStorage.getItem('tvd.intro') !== 'off' && !sessionStorage.getItem('tvd.introSeen'); } catch { return false; }
  });
  useEffect(() => {
    if (!show) return;
    try { sessionStorage.setItem('tvd.introSeen', '1'); } catch { /* sin storage */ }
    sfx.open();
    const t = setTimeout(() => setShow(false), 2700);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return html`<div class="intro" onClick=${() => setShow(false)} aria-hidden="true">
    <h1>${'TVDAILY'.split('').map((ch, i) => html`<span style=${`animation-delay:${0.08 * i}s`}>${ch}</span>`)}</h1>
    <div class="lbl">SERIES · CINE · LIBROS · AUDIOLIBROS</div><div class="ibar"></div>
  </div>`;
}

/* ───────────── paleta de comandos (⌘K) ───────────── */

function Palette({ onClose }) {
  const { entries } = useStore();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef();
  useEffect(() => { input.current?.focus(); sfx.open(); }, []);
  const ql = q.trim().toLowerCase();
  const nav = [...NAV, ['search', 'search', 'Buscar', 'search'], ['stats', 'stats', 'Estadísticas', 'chart'], ['data', 'data', 'Importar y exportar', 'database'], ['settings', 'settings', 'Ajustes', 'settings']]
    .filter(([, , l]) => !ql || l.toLowerCase().includes(ql)).map(([k, path, label, icon]) => ({ kind: 'nav', label, icon, href: '#/' + path }));
  const mine = ql ? entries.filter((e) => e.title.toLowerCase().includes(ql)).slice(0, 8).map((e) => ({ kind: 'entry', e, label: e.title, href: `#/item/${e.id}` })) : [];
  const searches = ql.length > 1 ? Object.values(TYPES).map((t) => ({ kind: 'search', label: `Buscar “${q.trim()}” en ${t.plural.toLowerCase()}`, icon: t.ico, href: `#/search?type=${t.key}&q=${encodeURIComponent(q.trim())}` })) : [];
  const items = [...mine, ...searches, ...nav];
  const open = (it) => { if (!it) return; location.hash = it.href; onClose(); };
  return html`<div class="overlay" onMouseDown=${(e) => e.target === e.currentTarget && onClose()}>
    <div class="palette glass" role="dialog" aria-label="Paleta de comandos">
      <input ref=${input} placeholder="Busca o navega…" value=${q} onInput=${(e) => { setQ(e.currentTarget.value); setSel(0); }}
        onKeyDown=${(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); sfx.tick(2); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); sfx.tick(1); }
          if (e.key === 'Enter') { e.preventDefault(); open(items[sel]); }
          if (e.key === 'Escape') onClose();
        }} />
      <ul>
        ${mine.length > 0 && html`<li class="grp label">Tu diario</li>`}
        ${items.map((it, i) => html`${i === mine.length && searches.length ? html`<li class="grp label">Buscar fuera</li>` : ''}${i === mine.length + searches.length ? html`<li class="grp label">Ir a</li>` : ''}
          <li class=${i === sel ? 'sel' : ''} onMouseEnter=${() => setSel(i)}><a href=${it.href} onClick=${(e) => { e.preventDefault(); open(it); }}>
            <span class="th">${it.kind === 'entry' ? html`<${Cover} src=${it.e.cover} title=${it.e.title} type=${it.e.type} />` : html`<${Icon} name=${it.icon} />`}</span>
            <span>${it.label}</span>
            <span class="count">${it.kind === 'entry' ? statusLabel(it.e.status, it.e.type).toUpperCase() : '↵'}</span>
          </a></li>`)}
      </ul>
      <div class="foot"><span class="count"><span class="kbd">↑↓</span> moverse</span><span class="count"><span class="kbd">↵</span> abrir</span><span class="count"><span class="kbd">esc</span> cerrar</span></div>
    </div>
  </div>`;
}

function Header({ route, onPalette }) {
  const { profile, user } = useStore();
  const [menu, setMenu] = useState(false);
  const [snd, setSnd] = useState(isSoundOn());
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    const t = setTimeout(() => window.addEventListener('click', close, { once: true }));
    return () => { clearTimeout(t); window.removeEventListener('click', close); };
  }, [menu]);
  const active = route.name;
  return html`<header class="header">
    <div class="wrap">
      <a class="logo" href="#/"><i></i>TVDaily</a>
      <nav class="nav">${NAV.map(([k, path, label]) => html`<a key=${k} href=${'#/' + path} class=${active === k ? 'on' : ''} onMouseEnter=${() => sfx.hover()}>${label}</a>`)}</nav>
      <div class="header-actions">
        <button class="btn sm glass hide-sm" onClick=${onPalette} title="Buscar (⌘K)"><${Icon} name="search" size=${14} /> Buscar <span class="kbd">⌘K</span></button>
        <a class="btn sm" href="#/search"><${Icon} name="plus" size=${14} /><span class="hide-sm">Añadir</span></a>
        <button class="btn icon glass" title=${snd ? 'Silenciar' : 'Activar sonido'} aria-label="Sonido" onClick=${() => { setSound(!snd); setSnd(!snd); }}><${Icon} name=${snd ? 'sound' : 'mute'} /></button>
        <div style="position:relative">
          <${Avatar} user=${profile || { displayName: user?.email }} size=${38} onClick=${() => { setMenu(!menu); sfx.click(); }} />
          ${menu && html`<div class="menu glass">
            <div class="head"><div style="font-weight:600">${profile?.displayName}</div><div class="count">@${profile?.handle}</div></div>
            <a href=${`#/u/${user.uid}`}><${Icon} name="user" /> Mi perfil</a>
            <a href="#/stats"><${Icon} name="chart" /> Estadísticas</a>
            <a href="#/data"><${Icon} name="database" /> Importar y exportar</a>
            <a href="#/settings"><${Icon} name="settings" /> Ajustes</a>
            <button onClick=${() => { sfx.close(); logout(); }}><${Icon} name="logout" /> Cerrar sesión</button>
          </div>`}
        </div>
      </div>
    </div>
  </header>`;
}

function BottomNav({ route }) {
  const items = [['home', '', 'Inicio', 'home'], ['discover', 'discover', 'Novedades', 'spark'], ['search', 'search', 'Buscar', 'search'], ['library', 'library', 'Biblioteca', 'grid'], ['news', 'news', 'Noticias', 'news']];
  return html`<nav class="bottom-nav">${items.map(([k, path, label, icon]) => html`
    <a key=${k} href=${'#/' + path} class=${route.name === k ? 'on' : ''}><${Icon} name=${icon} />${label}</a>`)}</nav>`;
}

function Page({ route }) {
  const b = route.parts[1];
  switch (route.name) {
    case 'home': return html`<${HomePage} />`;
    case 'discover': return html`<${DiscoverPage} route=${route} />`;
    case 'news': return html`<${NewsPage} route=${route} />`;
    case 'search': return html`<${SearchPage} route=${route} />`;
    case 'library': return html`<${LibraryPage} route=${route} />`;
    case 'item': return html`<${ItemPage} key=${b} id=${b} />`;
    case 'lists': return html`<${ListsPage} />`;
    case 'list': return html`<${ListPage} key=${b} id=${b} />`;
    case 'challenges': return html`<${ChallengesPage} />`;
    case 'stats': return html`<${StatsPage} />`;
    case 'data': return html`<${DataPage} />`;
    case 'explore': return html`<${ExplorePage} />`;
    case 'u': return html`<${ProfilePage} key=${b} uid=${b} route=${route} />`;
    case 'settings': return html`<${SettingsPage} />`;
    default: return html`<div class="page wrap"><div class="empty"><div class="kicker">404</div><h1 class="display" style="margin:20px 0">Fuera de plano</h1><div class="row"><a class="btn" href="#/">Volver al inicio</a></div></div></div>`;
  }
}

function App() {
  const st = useStore();
  const route = useRoute();
  const [palette, setPalette] = useState(false);
  useEffect(() => { observeReveal(); });
  useEffect(() => {
    const k = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); }
      else if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName || '') && !document.activeElement?.isContentEditable) { e.preventDefault(); go('search'); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  if (!st.authReady) return html`<div class="boot"><b>TVDAILY</b></div>`;
  if (!st.user) return html`<${AuthPage} /><${Toasts} />`;
  return html`
    <${Intro} />
    <${Header} route=${route} onPalette=${() => setPalette(true)} />
    <main key=${route.parts.join('/')}><${Page} route=${route} /></main>
    <${BottomNav} route=${route} />
    ${palette && html`<${Palette} onClose=${() => setPalette(false)} />`}
    <${Toasts} />`;
}

/* ───────────── arranque ───────────── */

unlockAudio();
trackCursor();
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
let stop = null;
onAuth(async (user) => {
  stop?.(); stop = null;
  if (!user) {
    setState({ authReady: true, user: null, profile: null, settings: {}, entries: [], entriesReady: false, lists: [], following: [] });
    return;
  }
  setState({ user });
  try {
    const [profile, settings] = await Promise.all([ensureProfile(user), loadSettings(user.uid)]);
    setState({ profile, settings, authReady: true });
  } catch (e) {
    console.error('[TVDaily] perfil', e);
    setState({ profile: { uid: user.uid, displayName: user.displayName || user.email, handle: '', photoURL: user.photoURL || '', challenges: {} }, settings: {}, authReady: true });
    toast('No se pudo cargar tu perfil: ' + e.message, 'err', 6000);
  }
  stop = watchMine(user.uid);
});

const root = document.getElementById('app');
root.textContent = '';
render(html`<${App} />`, root);
