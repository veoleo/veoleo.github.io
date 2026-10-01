// Retos anuales: libros, audiolibros, series, películas y páginas.
import { html, useState, useEffect } from 'preact-standalone';
import { Ring, PosterCard, Switch, Tabs, SectionHead, Scramble, LazyGrid } from '../components/ui.js';
import { useStore, toast } from '../lib/store.js';
import { updateMyProfile } from '../lib/db.js';
import { entryYear } from '../lib/utils.js';
import { sfx } from '../lib/sound.js';
import { confetti, flash } from '../lib/fx.js';

const GOALS = [
  { key: 'books', label: 'Libros', color: 'var(--yellow)', types: ['book'] },
  { key: 'audiobooks', label: 'Audiolibros', color: 'var(--teal)', types: ['audiobook'] },
  { key: 'series', label: 'Series', color: 'var(--blue)', types: ['series'] },
  { key: 'movies', label: 'Películas', color: 'var(--red)', types: ['movie'] },
  { key: 'pages', label: 'Páginas', color: 'var(--purple)', types: ['book'], pages: true },
];
const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

export function challengeProgress(entries, year, goals = {}) {
  const done = entries.filter((e) => e.status === 'completed' && entryYear(e) === year);
  const res = {};
  for (const g of GOALS) {
    const types = g.key === 'books' && goals.audiobooksCountAsBooks ? ['book', 'audiobook'] : g.types;
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
  const [goals, setGoals] = useState(profile?.challenges?.[year] || {});
  useEffect(() => setGoals(profile?.challenges?.[year] || {}), [year, profile?.uid]);
  const { res, done } = challengeProgress(entries, year, goals);
  const active = GOALS.filter((g) => Number(goals[g.key]) > 0);
  const now = new Date();
  const yearPct = year === now.getFullYear() ? (now - new Date(year, 0, 1)) / (new Date(year + 1, 0, 1) - new Date(year, 0, 1)) : 1;

  async function save() {
    const clean = Object.fromEntries(Object.entries(goals).filter(([k, v]) => k === 'audiobooksCountAsBooks' || Number(v) > 0).map(([k, v]) => [k, k === 'audiobooksCountAsBooks' ? !!v : Number(v)]));
    try {
      await updateMyProfile({ challenges: { ...(profile?.challenges || {}), [year]: clean } });
      sfx.braam(0.4);
      const reached = GOALS.filter((g) => clean[g.key] && res[g.key] >= clean[g.key]);
      if (reached.length) { confetti(); sfx.chime(); flash('Reto cumplido', '#2ee6c5'); } else flash('Reto aceptado', '#c6ff3d');
    } catch (e) { toast('No se pudo guardar: ' + e.message, 'err'); }
  }

  const byMonth = MONTHS.map((_, m) => done.filter((e) => e.finishedAt && Number(e.finishedAt.slice(5, 7)) === m + 1));
  const maxM = Math.max(1, ...byMonth.map((l) => l.length));

  return html`<div class=${extEntries ? '' : 'page wrap'}>
    ${!extEntries && html`<div class="page-head"><div><div class="kicker">Retos de lectura y visionado</div><h1 class="display" style="margin-top:20px"><${Scramble} text=${`Retos ${year}`} /></h1></div></div>`}
    <${Tabs} value=${year} onChange=${setYear} options=${years.map((y) => ({ value: y, label: String(y) }))} />

    ${active.length ? html`<div class="grid" style="--min:230px;gap:56px 32px;margin-top:56px">${active.map((g) => {
      const v = res[g.key], goal = Number(goals[g.key]);
      const ok = v >= goal;
      const expected = Math.round(goal * yearPct);
      return html`<div class="stack" style="--g:18px;align-items:flex-start">
        <${Ring} value=${v} max=${goal} color=${g.color} size=${190} label=${String(v)} sub=${`de ${goal}`} />
        <div><h3 class="h3">${g.label}</h3>
          <p class="count" style="margin:8px 0 0">${ok ? 'CUMPLIDO' : v >= expected ? `${v - expected} POR DELANTE DEL RITMO` : `${expected - v} POR DEBAJO DEL RITMO`}</p></div>
      </div>`;
    })}</div>` : html`<div class="empty" style="padding:56px 0"><h2 class="h1">${readOnly ? 'Sin retos este año' : 'Ponte un objetivo'}</h2>${!readOnly && html`<p class="lead" style="margin-top:16px">Por ejemplo: 24 libros, 12 series y 50 películas en ${year}.</p>`}</div>`}

    ${!readOnly && html`<section class="section">
      <${SectionHead} kicker="Objetivos" title=${`Tu ${year}`} />
      <div class="grid" style="--min:170px;gap:20px">
        ${GOALS.map((g) => html`<div class="field"><label>${g.label}</label>
          <input class="input" type="number" min="0" inputmode="numeric" value=${goals[g.key] || ''} placeholder="0"
            onInput=${(e) => setGoals({ ...goals, [g.key]: e.currentTarget.value })} /></div>`)}
      </div>
      <div class="row between" style="margin-top:24px">
        <${Switch} checked=${!!goals.audiobooksCountAsBooks} onChange=${(v) => setGoals({ ...goals, audiobooksCountAsBooks: v })} label="Los audiolibros cuentan como libros" />
        <button class="btn lg" onClick=${save}>Guardar objetivos</button>
      </div>
    </section>`}

    <section class="section">
      <${SectionHead} kicker="Ritmo" title="Mes a mes" color="var(--blue)" />
      <div class="bars">${byMonth.map((l, i) => html`<div key=${i} title=${`${l.length} terminados`}>
        <b>${l.length || ''}</b><i style=${`height:${(l.length / maxM) * 100}%;animation-delay:${i * 40}ms`}></i><span>${MONTHS[i]}</span></div>`)}</div>
    </section>

    ${done.length > 0 && html`<section class="section">
      <${SectionHead} kicker=${`${done.length} títulos`} title=${`Terminado en ${year}`} color="var(--teal)" />
      <${LazyGrid} items=${[...done].sort((a, b) => String(b.finishedAt).localeCompare(String(a.finishedAt)))} render=${(e) => html`<${PosterCard} key=${e.id} e=${e}
        sub=${e.finishedAt ? new Date(e.finishedAt + 'T12:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : ''} />`} />
    </section>`}
  </div>`;
}
