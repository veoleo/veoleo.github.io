// Ajustes: perfil, preferencias, plantilla Markdown para Obsidian y cuenta.
import { html, useState, useMemo } from 'preact-standalone';
import { Avatar, Switch, Tabs, Icon, SectionHead, Scramble } from '../components/ui.js';
import { useStore, toast } from '../lib/store.js';
import { updateMyProfile, changeHandle, saveSettings, logout } from '../lib/db.js';
import { DEFAULT_TEMPLATE, PLACEHOLDERS, renderTemplate, entryContext, renderMarkdown, OBSIDIAN_CSS, filenameFor } from '../lib/markdown.js';
import { isSoundOn, setSound, getVolume, setVolume, sfx } from '../lib/sound.js';
import { download } from '../lib/utils.js';
import { flash } from '../lib/fx.js';

const SAMPLE = {
  id: 'demo', type: 'series', title: 'Severance', year: 2022, releaseDate: '2022-02-18', status: 'completed', rating: 4.5,
  cover: 'https://static.tvmaze.com/uploads/images/medium_portrait/548/1371406.jpg', genres: ['Drama', 'Misterio', 'Ciencia ficción'],
  creators: ['Dan Erickson'], platform: 'Apple TV', network: 'Apple TV', startedAt: '2025-01-10', finishedAt: '2025-02-02',
  overview: 'Mark lidera un equipo de oficina cuyos recuerdos han sido divididos quirúrgicamente entre su vida laboral y personal.',
  trailer: { youtube: 'xEQP4VVuyrY' }, composer: 'Theodore Shapiro', watchedEpisodes: ['S01E01', 'S01E02'], tags: ['culto'],
  cast: [{ name: 'Adam Scott', role: 'Mark Scout' }, { name: 'Britt Lower', role: 'Helly R.' }],
};

export function SettingsPage() {
  const { profile, settings, user } = useStore();
  const [tab, setTab] = useState('profile');
  const [p, setP] = useState({ displayName: profile?.displayName || '', handle: profile?.handle || '', bio: profile?.bio || '', photoURL: profile?.photoURL || '' });
  const [s, setS] = useState({
    region: settings.region || 'ES', mdTemplate: settings.mdTemplate || DEFAULT_TEMPLATE,
    filenamePattern: settings.filenamePattern || '{{title}} ({{year}})', exportEpisodes: settings.exportEpisodes || 'all',
  });
  const [sound, setSnd] = useState(isSoundOn());
  const [vol, setVol] = useState(getVolume());
  const [intro, setIntro] = useState(() => { try { return localStorage.getItem('tvd.intro') !== 'off'; } catch { return true; } });
  const [preview, setPreview] = useState(false);

  const sampleMd = useMemo(() => renderTemplate(s.mdTemplate, entryContext(SAMPLE, { body: '**Brutal.** La mejor oficina de la tele.\n\n> [!quote] Favorita\n> «The work is mysterious and important.»' }, {
    seasons: [{ season: 1, name: 'Temporada 1', episodes: [
      { season: 1, number: 1, code: 'S01E01', name: 'Good News About Hell', airdate: '2022-02-18', overview: 'Mark es ascendido a jefe de equipo.' },
      { season: 1, number: 2, code: 'S01E02', name: 'Half Loop', airdate: '2022-02-18', overview: 'El equipo forma a Helly.' },
      { season: 1, number: 3, code: 'S01E03', name: 'In Perpetuity', airdate: '2022-02-25', overview: 'Visita a la sala de Perpetuidad.' }] }],
    episodesMode: s.exportEpisodes,
  })), [s.mdTemplate, s.exportEpisodes]);

  async function saveProfile() {
    try {
      let handle = p.handle;
      if (handle !== profile.handle) handle = await changeHandle(handle);
      await updateMyProfile({ displayName: p.displayName.trim() || profile.displayName, bio: p.bio.slice(0, 280), photoURL: p.photoURL.trim() });
      setP({ ...p, handle }); sfx.chime(); flash('Perfil guardado', '#c6ff3d');
    } catch (e) { toast(e.message, 'err'); sfx.error(); }
  }
  async function saveSet(patch, msg = 'Guardado') {
    try { await saveSettings(patch); toast(msg, 'ok'); sfx.pop(); } catch (e) { toast(e.message, 'err'); }
  }

  return html`<div class="page wrap">
    <div class="page-head"><div><div class="kicker">Cuenta y preferencias</div><h1 class="display" style="margin-top:20px"><${Scramble} text="Ajustes" /></h1></div></div>
    <${Tabs} value=${tab} onChange=${setTab} options=${[
      { value: 'profile', label: 'Perfil' }, { value: 'prefs', label: 'Preferencias' }, { value: 'obsidian', label: 'Obsidian' }, { value: 'account', label: 'Cuenta' }]} />

    <div style="margin-top:56px;max-width:960px">
      ${tab === 'profile' && html`<div class="stack" style="--g:28px">
        <div class="row" style="--g:28px;align-items:flex-end"><${Avatar} user=${{ ...profile, ...p }} size=${110} />
          <div class="stack grow" style="--g:16px;min-width:260px">
            <div class="field"><label>Nombre</label><input class="input" value=${p.displayName} onInput=${(e) => setP({ ...p, displayName: e.currentTarget.value })} /></div>
            <div class="field"><label>Usuario</label><input class="input" value=${p.handle} onInput=${(e) => setP({ ...p, handle: e.currentTarget.value })} /></div>
          </div>
        </div>
        <div class="field"><label>Bio</label><textarea class="input" rows="3" maxlength="280" value=${p.bio} onInput=${(e) => setP({ ...p, bio: e.currentTarget.value })}></textarea></div>
        <div class="field"><label>Foto (URL)</label><input class="input" value=${p.photoURL} placeholder="https://…" onInput=${(e) => setP({ ...p, photoURL: e.currentTarget.value })} /></div>
        <div class="row between"><a class="btn ghost" href=${`#/u/${user.uid}`}>Ver perfil público</a><button class="btn lg" onClick=${saveProfile}>Guardar perfil</button></div>
      </div>`}

      ${tab === 'prefs' && html`<div class="stack" style="--g:36px">
        <div class="stack" style="--g:16px">
          <${SectionHead} kicker="Sonido" title="Efectos al abrir y guardar" />
          <${Switch} checked=${sound} onChange=${(v) => { setSnd(v); setSound(v); }} label="Sonidos de interfaz" />
          ${sound && html`<div class="field" style="max-width:420px"><label>Volumen</label><input type="range" min="0" max="1" step="0.05" value=${vol} onInput=${(e) => { setVol(e.currentTarget.value); setVolume(e.currentTarget.value); }} onChange=${() => sfx.open()} /></div>`}
          <${Switch} checked=${intro} onChange=${(v) => { setIntro(v); try { localStorage.setItem('tvd.intro', v ? 'on' : 'off'); } catch { /* sin storage */ } }} label="Animación de entrada al abrir la app" />
        </div>
        <div class="stack" style="--g:16px">
          <${SectionHead} kicker="Región" title="País de las novedades" />
          <select class="select" style="max-width:420px" value=${s.region} onChange=${(e) => { setS({ ...s, region: e.currentTarget.value }); saveSet({ region: e.currentTarget.value }, 'País actualizado'); }}>
            ${[['ES', 'España'], ['MX', 'México'], ['AR', 'Argentina'], ['CO', 'Colombia'], ['CL', 'Chile'], ['US', 'Estados Unidos'], ['GB', 'Reino Unido']].map(([v, l]) => html`<option value=${v}>${l}</option>`)}
          </select>
          <span class="small muted">Rankings de películas, libros y audiolibros de ese país.</span>
        </div>
        <div class="stack" style="--g:16px">
          <${SectionHead} kicker="Atajos" title="Teclado" />
          <dl class="kv" style="max-width:520px">
            <dt><span class="kbd">⌘ K</span></dt><dd>Buscar en todo y navegar</dd>
            <dt><span class="kbd">/</span></dt><dd>Ir al buscador</dd>
            <dt><span class="kbd">⌘ S</span></dt><dd>Guardar nota</dd>
            <dt><span class="kbd">Esc</span></dt><dd>Cerrar ventanas</dd>
          </dl>
        </div>
      </div>`}

      ${tab === 'obsidian' && html`<div class="stack" style="--g:24px">
        <p class="lead">Así se exporta cada título a Obsidian. Usa <code>{{campo}}</code> y bloques condicionales <code>{{#campo}}…{{/campo}}</code>.</p>
        <${Tabs} value=${preview ? 'p' : 'e'} onChange=${(v) => setPreview(v === 'p')} options=${[{ value: 'e', label: 'Plantilla' }, { value: 'p', label: 'Vista previa', c: 'var(--teal)' }]} />
        ${preview
          ? html`<div class="prose" style="max-height:640px;overflow:auto" dangerouslySetInnerHTML=${{ __html: renderMarkdown(sampleMd.replace(/^---[\s\S]*?---\n/, (m) => '```yaml\n' + m + '```\n')) }}></div>`
          : html`<textarea class="textarea" style="min-height:480px" value=${s.mdTemplate} onInput=${(e) => setS({ ...s, mdTemplate: e.currentTarget.value })}></textarea>`}
        <details><summary class="label" style="cursor:pointer">Campos disponibles</summary>
          <div class="row" style="--g:8px;margin-top:14px">${PLACEHOLDERS.map(([k, d]) => html`<span class="chip static" title=${d}><code>{{${k}}}</code> ${d}</span>`)}</div>
        </details>
        <div class="row" style="--g:20px">
          <div class="field grow"><label>Nombre de archivo</label><input class="input" value=${s.filenamePattern} onInput=${(e) => setS({ ...s, filenamePattern: e.currentTarget.value })} />
            <span class="count">EJEMPLO: ${filenameFor(SAMPLE, s.filenamePattern)}</span></div>
          <div class="field"><label>Episodios en la nota</label>
            <select class="select" value=${s.exportEpisodes} onChange=${(e) => setS({ ...s, exportEpisodes: e.currentTarget.value })}>
              <option value="all">Todos, con sinopsis</option><option value="watched">Solo los vistos</option><option value="none">No incluir</option>
            </select></div>
        </div>
        <div class="row between">
          <div class="row" style="--g:8px">
            <button class="btn ghost" onClick=${() => { setS({ ...s, mdTemplate: DEFAULT_TEMPLATE }); toast('Plantilla original restaurada (falta guardar)', 'info'); }}>Restaurar original</button>
            <button class="btn ghost" onClick=${() => { download('tvdaily.css', OBSIDIAN_CSS, 'text/css'); sfx.pop(); }}><${Icon} name="download" size=${14} /> Snippet CSS</button>
          </div>
          <button class="btn lg" onClick=${() => saveSet({ mdTemplate: s.mdTemplate === DEFAULT_TEMPLATE ? '' : s.mdTemplate, filenamePattern: s.filenamePattern, exportEpisodes: s.exportEpisodes }, 'Plantilla guardada')}>Guardar plantilla</button>
        </div>
      </div>`}

      ${tab === 'account' && html`<div class="stack" style="--g:28px">
        <dl class="kv" style="max-width:640px">
          <dt>Email</dt><dd>${user.email || '—'}</dd>
          <dt>Acceso</dt><dd>${(user.providerData || []).map((x) => (x.providerId === 'google.com' ? 'Google' : 'Email y contraseña')).join(', ') || '—'}</dd>
          <dt>Usuario</dt><dd>@${profile?.handle}</dd>
        </dl>
        <div class="row"><a class="btn ghost" href="#/data"><${Icon} name="database" /> Importar y exportar datos</a><button class="btn danger" onClick=${() => { sfx.close(); logout(); }}><${Icon} name="logout" /> Cerrar sesión</button></div>
      </div>`}
    </div>
  </div>`;
}
