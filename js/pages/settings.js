// Ajustes: perfil, sonido y efectos, fuentes de metadatos, plantilla Markdown y exportación.
import { html, useState, useMemo } from 'preact-standalone';
import { Avatar, Switch, Seg } from '../components/ui.js';
import { ExportModal } from './library.js';
import { useStore, toast } from '../lib/store.js';
import { updateMyProfile, changeHandle, saveSettings, logout } from '../lib/db.js';
import { DEFAULT_TEMPLATE, PLACEHOLDERS, renderTemplate, entryContext, renderMarkdown, OBSIDIAN_CSS, filenameFor } from '../lib/markdown.js';
import { isSoundOn, setSound, getVolume, setVolume, sfx } from '../lib/sound.js';
import { download } from '../lib/utils.js';
import { SHARED_TMDB_KEY } from '../config.js';

const SAMPLE = {
  id: 'demo', type: 'series', title: 'Severance', year: 2022, releaseDate: '2022-02-18', status: 'completed', rating: 4.5,
  cover: 'https://static.tvmaze.com/uploads/images/medium_portrait/548/1371406.jpg', genres: ['Drama', 'Misterio', 'Ciencia ficción'],
  creators: ['Dan Erickson'], platform: 'Apple TV+', network: 'Apple TV+', startedAt: '2025-01-10', finishedAt: '2025-02-02',
  overview: 'Mark lidera un equipo de oficina cuyos recuerdos han sido divididos quirúrgicamente entre su vida laboral y personal.',
  trailer: { youtube: 'xEQP4VVuyrY' }, composer: 'Theodore Shapiro', watchedEpisodes: ['S01E01', 'S01E02'], tags: ['culto'],
  cast: [{ name: 'Adam Scott', role: 'Mark Scout' }, { name: 'Britt Lower', role: 'Helly R.' }],
};

export function SettingsPage() {
  const { profile, settings, entries, lists, user } = useStore();
  const [p, setP] = useState({ displayName: profile?.displayName || '', handle: profile?.handle || '', bio: profile?.bio || '', photoURL: profile?.photoURL || '' });
  const [s, setS] = useState({
    tmdbKey: settings.tmdbKey || '', region: settings.region || 'ES', mdTemplate: settings.mdTemplate || DEFAULT_TEMPLATE,
    filenamePattern: settings.filenamePattern || '{{title}} ({{year}})', exportEpisodes: settings.exportEpisodes || 'all',
  });
  const [sound, setSnd] = useState(isSoundOn());
  const [vol, setVol] = useState(getVolume());
  const [intro, setIntro] = useState(() => { try { return localStorage.getItem('tvd.intro') !== 'off'; } catch { return true; } });
  const [preview, setPreview] = useState(false);
  const [exp, setExp] = useState(false);

  const sampleMd = useMemo(() => renderTemplate(s.mdTemplate, entryContext(SAMPLE, { body: '**Brutal.** La mejor oficina de la tele.\n\n> [!quote] Favorita\n> «The work is mysterious and important.»' }, {
    seasons: [{ season: 1, name: 'Temporada 1', episodes: [
      { season: 1, number: 1, code: 'S01E01', name: 'Good News About Hell', airdate: '2022-02-18', overview: 'Mark es ascendido…' },
      { season: 1, number: 2, code: 'S01E02', name: 'Half Loop', airdate: '2022-02-18', overview: 'Helly intenta dimitir…' },
      { season: 1, number: 3, code: 'S01E03', name: 'In Perpetuity', airdate: '2022-02-25', overview: 'El equipo visita la sala de Perpetuidad…' }] }],
    episodesMode: s.exportEpisodes,
  })), [s.mdTemplate, s.exportEpisodes]);

  async function saveProfile() {
    try {
      if (p.handle !== profile.handle) p.handle = await changeHandle(p.handle);
      await updateMyProfile({ displayName: p.displayName.trim() || profile.displayName, bio: p.bio.slice(0, 280), photoURL: p.photoURL.trim() });
      setP({ ...p }); sfx.chime(); toast('Perfil guardado', 'ok');
    } catch (e) { toast(e.message, 'err'); sfx.error(); }
  }
  async function saveSet(patch) {
    try { await saveSettings(patch); toast('Ajustes guardados', 'ok'); sfx.pop(); } catch (e) { toast(e.message, 'err'); }
  }

  return html`<div class="page wrap">
    <h1 class="mega">Ajus<span class="mark tilt-r">tes</span></h1>
    <div class="cols-2" style="margin-top:30px;align-items:start">
      <div class="stack" style="--g:30px">

        <section class="panel">
          <div class="tape" style="--c:var(--pink)"></div>
          <h3 class="h2">Perfil</h3>
          <div class="row" style="--g:20px;margin:16px 0">
            <${Avatar} user=${{ ...profile, ...p }} size=${90} />
            <div class="stack grow" style="--g:12px">
              <div class="field"><label>Nombre</label><input class="input" value=${p.displayName} onInput=${(e) => setP({ ...p, displayName: e.currentTarget.value })} /></div>
              <div class="field"><label>Usuario</label><input class="input" value=${p.handle} onInput=${(e) => setP({ ...p, handle: e.currentTarget.value })} /></div>
            </div>
          </div>
          <div class="field"><label>Bio</label><textarea class="input" rows="3" maxlength="280" value=${p.bio} onInput=${(e) => setP({ ...p, bio: e.currentTarget.value })}></textarea></div>
          <div class="field" style="margin-top:12px"><label>URL de la foto</label><input class="input" value=${p.photoURL} placeholder="https://…" onInput=${(e) => setP({ ...p, photoURL: e.currentTarget.value })} /></div>
          <div class="row between" style="margin-top:18px">
            <a class="btn ghost" href=${`#/u/${user.uid}`}>Ver mi perfil público</a>
            <button class="btn red" onClick=${saveProfile}>Guardar perfil</button>
          </div>
        </section>

        <section class="panel">
          <h3 class="h2">Plantilla de nota Markdown</h3>
          <p class="muted" style="margin:6px 0 16px">Así se exporta cada serie, peli o libro a Obsidian. Usa <code>{{campo}}</code> y bloques condicionales <code>{{#campo}}…{{/campo}}</code>.</p>
          <${Seg} value=${preview ? 'p' : 'e'} onChange=${(v) => setPreview(v === 'p')} options=${[{ value: 'e', label: '✎ Plantilla' }, { value: 'p', label: '👁 Ejemplo', c: 'var(--teal)', fg: 'var(--paper-2)' }]} />
          <div style="margin-top:14px">
            ${preview
              ? html`<div class="panel flat prose" style="max-height:620px;overflow:auto" dangerouslySetInnerHTML=${{ __html: renderMarkdown(sampleMd.replace(/^---[\s\S]*?---\n/, (m) => '```yaml\n' + m + '```\n')) }}></div>`
              : html`<textarea class="textarea" style="min-height:460px" value=${s.mdTemplate} onInput=${(e) => setS({ ...s, mdTemplate: e.currentTarget.value })}></textarea>`}
          </div>
          <details style="margin-top:14px"><summary style="cursor:pointer;font-weight:800">Campos disponibles</summary>
            <div class="row" style="--g:6px;margin-top:10px">${PLACEHOLDERS.map(([k, d]) => html`<span class="chip static" title=${d} style="font-size:.78rem;padding:4px 10px"><code>{{${k}}}</code> ${d}</span>`)}</div>
          </details>
          <div class="row" style="--g:16px;margin-top:18px">
            <div class="field grow"><label>Nombre de archivo</label><input class="input" value=${s.filenamePattern} onInput=${(e) => setS({ ...s, filenamePattern: e.currentTarget.value })} />
              <span class="small muted">Ejemplo: ${filenameFor(SAMPLE, s.filenamePattern)}</span></div>
            <div class="field"><label>Episodios en la nota</label>
              <select class="select" value=${s.exportEpisodes} onChange=${(e) => setS({ ...s, exportEpisodes: e.currentTarget.value })}>
                <option value="all">Todos, con sinopsis</option><option value="watched">Solo los vistos</option><option value="none">No incluir</option>
              </select></div>
          </div>
          <div class="row between" style="margin-top:18px">
            <button class="btn ghost" onClick=${() => { setS({ ...s, mdTemplate: DEFAULT_TEMPLATE }); toast('Plantilla original restaurada (falta guardar)'); }}>↺ Restaurar original</button>
            <button class="btn red" onClick=${() => saveSet({ mdTemplate: s.mdTemplate === DEFAULT_TEMPLATE ? '' : s.mdTemplate, filenamePattern: s.filenamePattern, exportEpisodes: s.exportEpisodes })}>Guardar plantilla</button>
          </div>
        </section>
      </div>

      <aside class="stack" style="--g:30px">
        <section class="panel tint" style="--c:var(--pink)">
          <h3 class="h3">🔊 Sonido y efectos</h3>
          <div class="stack" style="--g:14px">
            <${Switch} checked=${sound} onChange=${(v) => { setSnd(v); setSound(v); }} label="Efectos de sonido cinematográficos" />
            <div class="field"><label>Volumen</label><input type="range" min="0" max="1" step="0.05" value=${vol} onInput=${(e) => { setVol(e.currentTarget.value); setVolume(e.currentTarget.value); }} onChange=${() => sfx.tick(4)} /></div>
            <div class="row" style="--g:8px">
              <button class="btn sm" onClick=${() => sfx.braam()}>Braam</button><button class="btn sm" onClick=${() => sfx.whoosh()}>Whoosh</button>
              <button class="btn sm" onClick=${() => sfx.chime()}>Logro</button><button class="btn sm" onClick=${() => sfx.riser()}>Tensión</button>
            </div>
            <${Switch} checked=${intro} onChange=${(v) => { setIntro(v); try { localStorage.setItem('tvd.intro', v ? 'on' : 'off'); } catch { /* sin storage */ } }} label="Intro animada al abrir" />
          </div>
        </section>

        <section class="panel tint" style="--c:var(--teal)">
          <h3 class="h3">🔑 Fuentes de metadatos</h3>
          <p class="small" style="margin:0 0 12px">Series, libros y audiolibros funcionan sin clave. Con una <b>clave gratuita de TMDB</b> tendrás pósters HD, fondos, tráilers, sinopsis de episodios en español, estrenos de cine, plataformas y recomendaciones.</p>
          <ol class="small" style="margin:0 0 12px;padding-left:18px">
            <li>Crea una cuenta en <a href="https://www.themoviedb.org/signup" target="_blank" rel="noopener">themoviedb.org</a>.</li>
            <li>Ve a <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">Ajustes → API</a> y copia la «Clave de la API» o el «Token de lectura».</li>
          </ol>
          <div class="field"><label>Clave TMDB ${SHARED_TMDB_KEY ? '(opcional, ya hay una compartida)' : ''}</label><input class="input" type="password" autocomplete="off" value=${s.tmdbKey} onInput=${(e) => setS({ ...s, tmdbKey: e.currentTarget.value.trim() })} placeholder="Solo la verás tú" /></div>
          <div class="field" style="margin-top:12px"><label>País para plataformas y estrenos</label>
            <select class="select" value=${s.region} onChange=${(e) => setS({ ...s, region: e.currentTarget.value })}>
              ${[['ES', 'España'], ['MX', 'México'], ['AR', 'Argentina'], ['CO', 'Colombia'], ['CL', 'Chile'], ['US', 'Estados Unidos'], ['GB', 'Reino Unido']].map(([v, l]) => html`<option value=${v}>${l}</option>`)}
            </select></div>
          <button class="btn teal" style="margin-top:14px" onClick=${() => saveSet({ tmdbKey: s.tmdbKey, region: s.region })}>Guardar fuentes</button>
        </section>

        <section class="panel tint" style="--c:var(--yellow)">
          <h3 class="h3">🗂 Obsidian</h3>
          <div class="stack" style="--g:10px">
            <button class="btn" onClick=${() => setExp(true)} disabled=${!entries.length}>⬇ Exportar todo (${entries.length})</button>
            <button class="btn" onClick=${() => { download('tvdaily.css', OBSIDIAN_CSS, 'text/css'); sfx.pop(); }}>🎨 Descargar snippet CSS</button>
            <p class="small muted" style="margin:0">Copia el snippet en <code>.obsidian/snippets/</code> y actívalo en Apariencia. Con Dataview tendrás tablas dinámicas en el índice.</p>
          </div>
        </section>

        <button class="btn ink" onClick=${() => { logout(); sfx.whoosh(-1); }}>Cerrar sesión</button>
      </aside>
    </div>
    ${exp && html`<${ExportModal} entries=${entries} name="TVDaily" settings=${settings} lists=${lists} onClose=${() => setExp(false)} />`}
  </div>`;
}
