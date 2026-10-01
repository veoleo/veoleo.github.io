// Retos anuales: libros, audiolibros, series, películas y páginas.
import { html, useState, useEffect } from 'preact-standalone';
import { Ring, PosterCard, Switch, Empty } from '../components/ui.js';
import { useStore, toast } from '../lib/store.js';
import { updateMyProfile } from '../lib/db.js';
import { TYPES, entryYear } from '../lib/utils.js';
import { sfx } from '../lib/sound.js';
import { confetti, onomato } from '../lib/fx.js';

const GOALS = [
  { key: 'books', label: 'Libros', icon: '📖', color: 'var(--yellow)', types: ['book'] },
  { key: 'audiobooks', label: 'Audiolibros', icon: '🎧', color: 'var(--teal)', types: ['audiobook'] },
  { key: 'series', label: 'Series', icon: '📺', color: 'var(--blue)', types: ['series'] },
  { key: 'movies', label: 'Películas', icon: '🎬', color: 'var(--red)', types: ['movie'] },
  { key: 'pages', label: 'Páginas', icon: '📄', color: 'var(--purple)', types: ['book'], pages: true },
];
const MONTHS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export function challengeProgress(entries, year, goals = {}) {
  const done = entries.filter((e) => e.status === 'completed' && entryYear(e) === year);
  const res = {};
  for (const g of GOALS) {
    let types = g.types;
    if (g.key === 'books' && goals.audiobooksCountAsBooks) types = ['book', 'audiobook'];
    const list = done.filter((e) => types.includes(e.type));
    res[g.key] = g.pages ? list.reduce((a, e) => a + (Number(e.pages) || 0), 0) : list.length;
  }
  return { res, done };
}

export function ChallengesPage({ entries: extEntries, profile: extProfile, readOnly = false }) {
  const st = useStore();
  const entries = extEntries || st.entries;
  const profile = extProfile || st.profile;
  const years = [...new Set([new Date().getFullYear(), ...entries.map(entryYear).filter(Boolean)])].sort((a, b) => b - a);
  const [year, setYear] = useState(years[0]);
  const saved = profile?.challenges?.[year] || {};
  const [goals, setGoals] = useState(saved);
  useEffect(() => setGoals(profile?.challenges?.[year] || {}), [year, profile?.uid]);
  const { res, done } = challengeProgress(entries, year, goals);
  const active = GOALS.filter((g) => Number(goals[g.key]) > 0);

  async function save() {
    const clean = Object.fromEntries(Object.entries(goals).filter(([k, v]) => k === 'audiobooksCountAsBooks' || Number(v) > 0).map(([k, v]) => [k, k === 'audiobooksCountAsBooks' ? !!v : Number(v)]));
    try {
      await updateMyProfile({ challenges: { ...(profile?.challenges || {}), [year]: clean } });
      sfx.braam(.7); toast('Reto guardado', 'ok');
      const reached = GOALS.filter((g) => clean[g.key] && res[g.key] >= clean[g.key]);
      if (reached.length) { confetti(); sfx.chime(); onomato(window.innerWidth / 2, window.innerHeight / 3, '¡RETO CUMPLIDO!', '#2bb3a3'); }
    } catch (e) { toast('No se pudo guardar: ' + e.message, 'err'); }
  }

  const byMonth = MONTHS.map((_, m) => done.filter((e) => e.finishedAt && Number(e.finishedAt.slice(5, 7)) === m + 1));
  const maxM = Math.max(1, ...byMonth.map((l) => l.length));

  return html`<div class=${extEntries ? '' : 'page wrap'}>
    ${!extEntries && html`<h1 class="mega">Retos <span class="mark teal tilt-r">${year}</span></h1>`}
    <div class="row" style="--g:8px;margin:24px 0">
      ${years.map((y) => html`<button class="chip ${y === year ? 'on' : ''}" onClick=${() => { setYear(y); sfx.click(); }}>${y}</button>`)}
    </div>

    ${active.length ? html`<div class="grid" style="--min:220px">${active.map((g) => {
      const v = res[g.key], goal = Number(goals[g.key]);
      const ok = v >= goal;
      return html`<div class="panel" style="text-align:center;${ok ? 'background:color-mix(in srgb,' + g.color + ' 25%,var(--paper-2))' : ''}">
        ${ok && html`<span class="badge" style="position:absolute;top:-14px;right:14px;--c:var(--teal);color:var(--paper-2);transform:rotate(6deg)">¡Cumplido!</span>`}
        <div style="display:grid;place-items:center"><${Ring} value=${v} max=${goal} color=${g.color} size=${170} label=${String(v)} sub=${`de ${goal}`} /></div>
        <h3 class="h3" style="margin-top:12px">${g.icon} ${g.label}</h3>
        <p class="small muted" style="margin:4px 0 0">${ok ? '¡Lo has conseguido!' : `Te faltan ${goal - v}`}${!ok && year === new Date().getFullYear() ? ` · ritmo: ${Math.ceil((goal - v) / Math.max(1, 12 - new Date().getMonth()))}/mes` : ''}</p>
      </div>`;
    })}</div>` : html`<${Empty} word="¡RETO!" title=${readOnly ? 'Sin retos este año' : `Marca tus objetivos para ${year}`} sub=${readOnly ? '' : 'Por ejemplo: 24 libros, 12 series y 50 películas.'} />`}

    ${!readOnly && html`<div class="panel tint" style="--c:var(--yellow);margin-top:30px">
      <h3 class="h3">🎯 Objetivos de ${year}</h3>
      <div class="grid" style="--min:160px;gap:14px;margin-top:10px">
        ${GOALS.map((g) => html`<div class="field"><label>${g.icon} ${g.label}</label>
          <input class="input" type="number" min="0" inputmode="numeric" value=${goals[g.key] || ''} placeholder="0"
            onInput=${(e) => setGoals({ ...goals, [g.key]: e.currentTarget.value })} /></div>`)}
      </div>
      <div class="row between" style="margin-top:18px">
        <${Switch} checked=${!!goals.audiobooksCountAsBooks} onChange=${(v) => setGoals({ ...goals, audiobooksCountAsBooks: v })} label="Los audiolibros cuentan para el reto de libros" />
        <button class="btn big red" onClick=${save}>¡Acepto el reto!</button>
      </div>
    </div>`}

    <div class="section">
      <div class="section-head" style="--c:var(--blue)"><h2 class="h2">Mes a mes</h2></div>
      <div class="panel">
        <div class="bars">${byMonth.map((l, i) => html`<div key=${i} title=${`${l.length} terminados`}>
          <b class="small">${l.length || ''}</b>
          <i style=${`height:${(l.length / maxM) * 100}%;animation-delay:${i * 40}ms;--c:${['var(--red)', 'var(--yellow)', 'var(--teal)', 'var(--blue)', 'var(--pink)', 'var(--orange)'][i % 6]}`}></i>
          <span>${MONTHS[i]}</span></div>`)}</div>
      </div>
    </div>

    ${done.length > 0 && html`<div class="section">
      <div class="section-head" style="--c:var(--teal)"><h2 class="h2">Terminado en ${year}</h2><span class="pill-count">${done.length}</span></div>
      <div class="grid">${done.sort((a, b) => String(b.finishedAt).localeCompare(String(a.finishedAt))).map((e) => html`<${PosterCard} key=${e.id} e=${e} sub=${e.finishedAt ? new Date(e.finishedAt + 'T12:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : TYPES[e.type].label} />`)}</div>
    </div>`}
  </div>`;
}
