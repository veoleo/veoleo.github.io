// Pantalla de acceso / registro.
import { html, useState } from 'preact-standalone';
import { loginEmail, registerEmail, loginGoogle, resetPassword, authErrorText } from '../lib/db.js';
import { sfx } from '../lib/sound.js';
import { onomato } from '../lib/fx.js';
import { toast } from '../lib/store.js';

const SHAPES = [
  ['var(--red)', 180, '8%', '70%', 0], ['var(--teal)', 90, '40%', '8%', 1.2], ['var(--blue)', 130, '82%', '80%', 2],
  ['var(--pink)', 70, '60%', '55%', .6], ['var(--yellow)', 220, '88%', '6%', 1.6], ['var(--purple)', 60, '4%', '18%', 2.4],
];

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
      sfx.braam();
      onomato(window.innerWidth / 2, window.innerHeight / 2, mode === 'login' ? '¡HOLA!' : '¡A ESCENA!');
    } catch (x) { setErr(authErrorText(x)); sfx.error(); }
    finally { setBusy(false); }
  }
  async function google() {
    setErr('');
    try { await loginGoogle(); sfx.braam(); } catch (x) { setErr(authErrorText(x)); sfx.error(); }
  }
  async function reset() {
    if (!f.email) { setErr('Escribe tu email y te mandamos un enlace.'); return; }
    try { await resetPassword(f.email); toast('Te hemos enviado un email para cambiar la contraseña', 'ok'); }
    catch (x) { setErr(authErrorText(x)); }
  }

  return html`
    <div class="auth">
      <div class="shapes" aria-hidden="true">${SHAPES.map(([c, s, l, t, d]) => html`<i style=${`background:${c};width:${s}px;height:${s}px;left:${l};top:${t};animation-delay:-${d}s`}></i>`)}</div>
      <div>
        <div class="logo" style="font-size:2.4rem;margin-bottom:28px"><b>TV</b>Daily</div>
        <h1 class="claim">Tu diario de <span class="mark red tilt-l">series</span>, <span class="mark blue">pelis</span> y <span class="mark tilt-r">libros</span>.</h1>
        <p style="font-size:1.25rem;max-width:620px;margin-top:24px;font-weight:500">
          Registra lo que ves, lees y escuchas. Puntúa con estrellas, marca episodios, escribe notas y expórtalas a Obsidian. Sigue a tus amigos y descubre qué ver.
        </p>
        <div class="features">
          ${['⭐ Ranking visual', '📺 Episodios con sinopsis', '🎬 Tráilers y banda sonora', '📝 Notas → Obsidian', '📋 Listas automáticas', '🏆 Retos de lectura', '💬 Comentarios', '🆕 Novedades por plataforma']
            .map((t, i) => html`<span class="chip static" style=${`transform:rotate(${(i % 2 ? 1 : -1) * (i % 3)}deg)`}>${t}</span>`)}
        </div>
      </div>

      <form class="panel" style="padding:32px" onSubmit=${submit}>
        <div class="tape" style="--c:var(--pink)"></div>
        <h2 class="h2" style="margin-bottom:20px">${mode === 'login' ? '¡Entra!' : 'Crea tu cuenta'}</h2>
        <div class="stack" style="--g:14px">
          <button type="button" class="btn big" style="width:100%" onClick=${google}>
            <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            Continuar con Google
          </button>
          <div class="row" style="--g:10px"><div class="divider grow" style="margin:0"></div><span class="tiny muted">o con email</span><div class="divider grow" style="margin:0"></div></div>
          ${mode === 'register' && html`<div class="field"><label>Nombre</label><input class="input" value=${f.name} onInput=${set('name')} autocomplete="name" required /></div>`}
          <div class="field"><label>Email</label><input class="input" type="email" value=${f.email} onInput=${set('email')} autocomplete="email" required /></div>
          <div class="field"><label>Contraseña</label><input class="input" type="password" value=${f.pass} onInput=${set('pass')} autocomplete=${mode === 'login' ? 'current-password' : 'new-password'} minlength="6" required /></div>
          ${err && html`<div class="bubble" style="background:var(--red);color:var(--paper-2)">${err}</div>`}
          <button class="btn big red" disabled=${busy} type="submit">${busy ? '…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}</button>
          <div class="row between small">
            <button type="button" class="btn sm ghost" onClick=${() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}>
              ${mode === 'login' ? '¿Nueva por aquí? Regístrate' : '¿Ya tienes cuenta? Entra'}
            </button>
            ${mode === 'login' && html`<button type="button" class="btn sm ghost" onClick=${reset}>He olvidado la contraseña</button>`}
          </div>
        </div>
      </form>
    </div>`;
}
