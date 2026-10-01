// Punto de entrada: auth, shell, navegación e intro.
import { html, render, useState, useEffect } from 'preact-standalone';
import { useStore, setState, toast } from './lib/store.js';
import { onAuth, ensureProfile, loadSettings, watchMine, logout } from './lib/db.js';
import { useRoute } from './lib/router.js';
import { sfx, unlockAudio, isSoundOn, setSound } from './lib/sound.js';
import { observeReveal } from './lib/fx.js';
import { Avatar, Toasts } from './components/ui.js';
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

const NAV = [
  ['home', '', 'Inicio', '🏠'],
  ['discover', 'discover', 'Novedades', '🆕'],
  ['library', 'library', 'Biblioteca', '🎞'],
  ['search', 'search', 'Buscar', '🔎'],
  ['lists', 'lists', 'Listas', '📋'],
  ['challenges', 'challenges', 'Retos', '🏆'],
  ['explore', 'explore', 'Comunidad', '👥'],
];

function Intro() {
  const [show, setShow] = useState(() => {
    try { return localStorage.getItem('tvd.intro') !== 'off' && !sessionStorage.getItem('tvd.introSeen'); } catch { return false; }
  });
  useEffect(() => {
    if (!show) return;
    try { sessionStorage.setItem('tvd.introSeen', '1'); } catch { /* sin storage */ }
    sfx.braam(); // suena sólo si el navegador ya permite audio
    const t = setTimeout(() => setShow(false), 2300);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return html`<div class="intro" onClick=${() => setShow(false)} aria-hidden="true"><h1><span>TV</span><span>DAILY</span></h1><div class="sfx">¡CLACK!</div></div>`;
}

function Header({ route }) {
  const { profile, user } = useStore();
  const [menu, setMenu] = useState(false);
  const [snd, setSnd] = useState(isSoundOn());
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    setTimeout(() => window.addEventListener('click', close, { once: true }));
    return () => window.removeEventListener('click', close);
  }, [menu]);
  const active = route.name === 'item' || route.name === 'list' ? '' : route.name;
  return html`<header class="header">
    <div class="wrap">
      <a class="logo" href="#/"><b>TV</b>Daily</a>
      <nav class="nav">${NAV.map(([k, path, label]) => html`<a key=${k} href=${'#/' + path} class=${active === k ? 'on' : ''} onMouseEnter=${() => sfx.hover()}>${label}</a>`)}</nav>
      <div class="header-actions">
        <a class="btn red sm hide-sm" href="#/search">＋ Añadir</a>
        <button class="btn icon sm" style="width:44px;height:44px" title=${snd ? 'Silenciar' : 'Activar sonido'} aria-label="Sonido"
          onClick=${() => { setSound(!snd); setSnd(!snd); }}>${snd ? '🔊' : '🔇'}</button>
        <div style="position:relative">
          <${Avatar} user=${profile || { displayName: user?.email }} size=${46} onClick=${() => { setMenu(!menu); sfx.click(); }} />
          ${menu && html`<div class="menu">
            <div style="padding:8px 12px 10px;border-bottom:2px dashed rgba(22,20,31,.2);margin-bottom:6px"><b>${profile?.displayName}</b><div class="small muted">@${profile?.handle}</div></div>
            <a href=${`#/u/${user.uid}`}>👤 Mi perfil</a>
            <a href="#/challenges">🏆 Mis retos</a>
            <a href="#/settings">⚙️ Ajustes</a>
            <button onClick=${() => { logout(); sfx.whoosh(-1); }}>🚪 Cerrar sesión</button>
          </div>`}
        </div>
      </div>
    </div>
  </header>`;
}

function BottomNav({ route }) {
  const items = [NAV[0], NAV[1], NAV[3], NAV[2], NAV[4]];
  return html`<nav class="bottom-nav">${items.map(([k, path, label, icon]) => html`
    <a key=${k} href=${'#/' + path} class=${route.name === k ? 'on' : ''}><span>${icon}</span>${label}</a>`)}</nav>`;
}

function Page({ route }) {
  const [a, b] = route.parts;
  switch (route.name) {
    case 'home': return html`<${HomePage} />`;
    case 'discover': return html`<${DiscoverPage} route=${route} />`;
    case 'search': return html`<${SearchPage} route=${route} />`;
    case 'library': return html`<${LibraryPage} route=${route} />`;
    case 'item': return html`<${ItemPage} key=${b} id=${b} />`;
    case 'lists': return html`<${ListsPage} />`;
    case 'list': return html`<${ListPage} key=${b} id=${b} />`;
    case 'challenges': return html`<${ChallengesPage} />`;
    case 'explore': return html`<${ExplorePage} />`;
    case 'u': return html`<${ProfilePage} key=${b} uid=${b} route=${route} />`;
    case 'settings': return html`<${SettingsPage} />`;
    default: return html`<div class="page wrap"><h1 class="mega">404</h1><a class="btn" href="#/">Volver</a></div>`;
  }
  void a;
}

function App() {
  const st = useStore();
  const route = useRoute();
  useEffect(() => { observeReveal(); });
  if (!st.authReady) return html`<div class="boot"><span>TV</span>DAILY</div>`;
  if (!st.user) return html`<${AuthPage} /><${Toasts} />`;
  return html`
    <${Intro} />
    <${Header} route=${route} />
    <main key=${route.parts.join('/')}><${Page} route=${route} /></main>
    <${BottomNav} route=${route} />
    <${Toasts} />`;
}

/* ───────────── arranque ───────────── */

unlockAudio();
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
