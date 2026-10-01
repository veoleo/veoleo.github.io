// Modo invitado («Probar sin cuenta»): aviso fijo, ventana para guardar el diario en una cuenta real
// y el bloque que sustituye a lo social (publicar, comentar, seguir), que es solo para cuentas.
import { html, useState } from 'preact-standalone';
import { Modal, Icon } from './ui.js';
import { useStore, toast } from '../lib/store.js';
import { linkGuestEmail, linkGuestGoogle, authErrorText, logout } from '../lib/db.js';
import { GOOGLE_ICON } from '../pages/auth.js';
import { sfx } from '../lib/sound.js';
import { flash, confetti } from '../lib/fx.js';
import { t } from '../lib/i18n.js';

let openSave = () => {};
export const askSaveAccount = () => openSave();

export function useIsGuest() {
  const { user, profile } = useStore();
  return !!(user?.isAnonymous || profile?.guest);
}

export function SaveAccountModal({ onClose }) {
  const [f, setF] = useState({ name: '', email: '', pass: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const done = () => { sfx.braam(0.6); confetti(80); flash('Diario guardado', '#c6ff3d'); onClose(); };
  async function google() {
    setErr(''); setBusy(true);
    try { await linkGuestGoogle(); done(); } catch (x) { setErr(x.message?.startsWith('Esa cuenta') ? x.message : authErrorText(x)); } finally { setBusy(false); }
  }
  async function email(ev) {
    ev.preventDefault(); setErr(''); setBusy(true);
    try { await linkGuestEmail(f.name.trim(), f.email.trim(), f.pass); done(); }
    catch (x) { setErr(x.message?.startsWith('Esa cuenta') ? x.message : authErrorText(x)); } finally { setBusy(false); }
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  return html`<${Modal} kicker="Gratis para siempre" title="Guarda tu diario" width=${560} onClose=${onClose}>
    <form class="stack" style="--g:18px" onSubmit=${email}>
      <p class="muted" style="margin:0">Crea tu cuenta y todo lo que has hecho como invitado se queda: títulos, episodios, notas y listas. Sin anuncios ni suscripciones, nunca.</p>
      <button type="button" class="btn lg google-btn" style="width:100%;--c:#fff;--fg:#111" disabled=${busy} onClick=${google}>${GOOGLE_ICON} Continuar con Google</button>
      <div class="row" style="--g:14px"><div class="grow" style="height:1px;background:var(--line)"></div><span class="label">o con email</span><div class="grow" style="height:1px;background:var(--line)"></div></div>
      <div class="field"><label>Nombre</label><input class="input" value=${f.name} onInput=${set('name')} autocomplete="name" required /></div>
      <div class="field"><label>Email</label><input class="input" type="email" value=${f.email} onInput=${set('email')} autocomplete="email" required /></div>
      <div class="field"><label>Contraseña</label><input class="input" type="password" minlength="6" value=${f.pass} onInput=${set('pass')} autocomplete="new-password" required /></div>
      ${err && html`<div class="err" role="alert">${err}</div>`}
      <button class="btn lg" style="width:100%" disabled=${busy}>${busy ? 'Un momento…' : 'Crear cuenta y guardar'}</button>
    </form>
  </${Modal}>`;
}

export function GuestBanner() {
  const guest = useIsGuest();
  const [open, setOpen] = useState(false);
  openSave = () => setOpen(true);
  if (!guest) return null;
  return html`<div class="guest-bar" role="status">
    <span><b>Modo invitado.</b> <span class="hide-xs">Prueba todo lo que quieras: Veoleo es gratis para siempre. </span>Crea tu cuenta para no perder tu diario.</span>
    <button class="btn sm" onClick=${() => { setOpen(true); sfx.open(); }}><${Icon} name="check" size=${14} /> Guardar mi diario</button>
    ${open && html`<${SaveAccountModal} onClose=${() => setOpen(false)} />`}
  </div>`;
}

// En lugar de publicar / comentar / seguir cuando se es invitado.
export function GuestGate({ what = 'publicar y comentar' }) {
  return html`<div class="guest-gate">
    <span>${t('Para')} ${t(what)} ${t('necesitas una cuenta (gratis para siempre). Tu diario de prueba se conserva.')}</span>
    <button class="btn sm" onClick=${() => askSaveAccount()}>Crear cuenta</button>
  </div>`;
}

// Cerrar sesión siendo invitado borra el acceso a ese diario: se avisa antes.
export function guestLogout() {
  if (!confirm(t('Si cierras la sesión de invitado perderás este diario de prueba. ¿Seguro?'))) return;
  sfx.close(); logout();
}
