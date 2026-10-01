// Pantalla de acceso / registro con muro animado de pósters.
import { html, useState, useEffect } from 'preact-standalone';
import { Icon, Scramble, SupportButton, LangToggle } from '../components/ui.js';
import { loginEmail, registerEmail, loginGoogle, resetPassword, authErrorText } from '../lib/db.js';
import { appleTop } from '../lib/metadata.js';
import { img } from '../lib/utils.js';
import { sfx } from '../lib/sound.js';
import { flash } from '../lib/fx.js';
import { toast } from '../lib/store.js';

function Wall() {
  const [posters, setPosters] = useState([]);
  useEffect(() => {
    // Sólo en pantallas grandes: en móvil el muro se oculta para ahorrar memoria.
    if (window.matchMedia('(max-width: 900px), (pointer: coarse)').matches) return;
    appleTop('movie', 'es', 36).catch(() => []).then((a) => setPosters(a.map((x) => img(x.cover, 220)).filter(Boolean)));
  }, []);
  if (!posters.length) return null;
  const cols = Array.from({ length: 6 }, (_, c) => posters.filter((_, i) => i % 6 === c));
  return html`<div class="wall" aria-hidden="true">${cols.map((col, c) => html`<div class="col" key=${c}>
    ${[...col, ...col].map((src, i) => html`<div class="tile" key=${i}><img src=${src} alt="" loading="lazy" /></div>`)}</div>`)}</div>`;
}

export function AuthPage() {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', pass: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });

  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      if (mode === 'login') await loginEmail(f.email, f.pass);
      else await registerEmail(f.name.trim(), f.email, f.pass);
      sfx.braam(0.5); flash(mode === 'login' ? 'Hola' : 'A bordo', '#c6ff3d');
    } catch (x) { setErr(authErrorText(x)); sfx.error(); }
    finally { setBusy(false); }
  }
  async function google() {
    setErr('');
    try { await loginGoogle(); sfx.braam(0.5); } catch (x) { setErr(authErrorText(x)); sfx.error(); }
  }
  async function reset() {
    if (!f.email) { setErr('Escribe tu email y te enviamos un enlace para cambiar la contraseña.'); return; }
    try { await resetPassword(f.email); toast('Te hemos enviado un email para cambiar la contraseña', 'ok'); }
    catch (x) { setErr(authErrorText(x)); }
  }

  return html`
    <div class="auth">
      <section class="art">
        <${Wall} />
        <div class="row between" style="position:relative;z-index:2"><a class="logo" href="#/"><i></i>Veoleo</a><${LangToggle} /></div>
        <div>
          <div class="kicker">Series · Cine · Libros · Audiolibros</div>
          <h1 class="claim" style="margin-top:22px"><${Scramble} text="Todo lo que" ms=${600} /><br /><span class="grad-text">ves, lees</span><br />y escuchas.</h1>
          <p class="lead" style="margin-top:28px">Lleva la cuenta de cada episodio, puntúa, escribe tus notas y llévalas a Obsidian. Descubre estrenos, sigue a tu gente y no te pierdas ninguna noticia.</p>
          <div class="features">
            ${['Episodios con sinopsis', 'Tráilers y banda sonora', 'Notas para Obsidian', 'Listas automáticas', 'Retos de lectura', 'Noticias de series', 'Importa TV Time y Goodreads', 'Comunidad']
              .map((t) => html`<span>${t}</span>`)}
          </div>
        </div>
        <div class="row between"><a class="label" href="#/about" style="text-decoration:none">Qué puedes hacer en Veoleo →</a><${SupportButton} quiet /></div>
      </section>

      <form class="form" onSubmit=${submit}>
        <div class="stack" style="--g:22px;max-width:440px;width:100%">
          <div>
            <div class="label">${mode === 'login' ? 'Acceso' : 'Nueva cuenta'}</div>
            <h2 class="h1" style="margin-top:12px">${mode === 'login' ? 'Entrar' : 'Crear cuenta'}</h2>
          </div>
          <button type="button" class="btn lg google-btn" style="width:100%;--c:#fff;--fg:#111" onClick=${google}>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            Continuar con Google
          </button>
          <div class="row" style="--g:14px"><div class="grow" style="height:1px;background:var(--line)"></div><span class="label">o con email</span><div class="grow" style="height:1px;background:var(--line)"></div></div>
          ${mode === 'register' && html`<div class="field"><label>Nombre</label><input class="input" value=${f.name} onInput=${set('name')} autocomplete="name" required /></div>`}
          <div class="field"><label>Email</label><input class="input" type="email" value=${f.email} onInput=${set('email')} autocomplete="email" required /></div>
          <div class="field"><label>Contraseña</label><input class="input" type="password" value=${f.pass} onInput=${set('pass')} autocomplete=${mode === 'login' ? 'current-password' : 'new-password'} minlength="6" required /></div>
          ${err && html`<div class="err" role="alert">${err}</div>`}
          <button class="btn lg" style="width:100%" disabled=${busy} type="submit">${busy ? 'Un momento…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}<${Icon} name="chevron" /></button>
          <div class="row between">
            <button type="button" class="btn text" onClick=${() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); sfx.click(); }}>
              ${mode === 'login' ? 'Crear una cuenta' : 'Ya tengo cuenta'}
            </button>
            ${mode === 'login' && html`<button type="button" class="btn text" onClick=${reset}>¿Olvidaste la contraseña?</button>`}
          </div>
        </div>
      </form>
    </div>`;
}
