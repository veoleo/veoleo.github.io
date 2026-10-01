// Temporadas y episodios: marcar vistos, sinopsis oficial y fechas de emisión.
import { html, useState, useEffect } from 'preact-standalone';
import { Spinner } from './ui.js';
import { getSeasons } from '../lib/metadata.js';
import { updateEntry } from '../lib/db.js';
import { useStore, toast } from '../lib/store.js';
import { humanDate, todayISO } from '../lib/utils.js';
import { sfx } from '../lib/sound.js';
import { onomato, burstAt, confetti } from '../lib/fx.js';

export function EpisodesPanel({ e, mine }) {
  const { settings } = useStore();
  const [seasons, setSeasons] = useState(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState({});
  const [expanded, setExpanded] = useState({});
  const watched = new Set(e.watchedEpisodes || []);
  const today = todayISO();

  useEffect(() => {
    let alive = true;
    setSeasons(null); setErr('');
    getSeasons(e, settings).then((s) => {
      if (!alive) return;
      setSeasons(s);
      // abrir la primera temporada no terminada
      const firstOpen = s.find((x) => x.episodes.some((ep) => !watched.has(ep.code) && (!ep.airdate || ep.airdate <= today)));
      if (firstOpen) setOpen({ [firstOpen.season]: true });
    }).catch((x) => alive && setErr(x.message));
    return () => { alive = false; };
  }, [e.id, e.ids?.tmdb, e.ids?.tvmaze]);

  if (err) return html`<p class="muted">No se pudieron cargar los episodios (${err}).</p>`;
  if (!seasons) return html`<${Spinner} />`;
  if (!seasons.length) return html`<p class="muted">No hay guía de episodios para esta serie en las fuentes disponibles.</p>`;

  const aired = seasons.flatMap((s) => s.episodes).filter((ep) => !ep.airdate || ep.airdate <= today);
  const total = seasons.reduce((a, s) => a + s.episodes.length, 0);

  async function save(next, el) {
    const list = [...next].sort();
    const patch = { watchedEpisodes: list, episodes: total };
    const allAired = aired.length > 0 && aired.every((ep) => next.has(ep.code));
    if (list.length && e.status === 'planned') { patch.status = 'in_progress'; patch.startedAt = e.startedAt || today; }
    if (allAired && e.status !== 'completed' && aired.length === total) {
      patch.status = 'completed'; patch.finishedAt = e.finishedAt || today;
      setTimeout(() => { onomato(window.innerWidth / 2, window.innerHeight / 2, '¡SERIE VISTA!', '#2bb3a3'); confetti(); sfx.braam(); }, 150);
    }
    try { await updateEntry(e.id, patch); }
    catch (x) { toast('No se pudo guardar: ' + x.message, 'err'); return; }
    if (el) burstAt(el, { count: 8, spread: 46 });
  }
  function toggle(ep, ev) {
    if (!mine) return;
    const next = new Set(watched);
    if (next.has(ep.code)) { next.delete(ep.code); sfx.click(); } else { next.add(ep.code); sfx.tick(6); }
    save(next, ev?.currentTarget);
  }
  function upTo(ep) {
    const next = new Set(watched);
    for (const s of seasons) for (const x of s.episodes) {
      if (x.season < ep.season || (x.season === ep.season && x.number <= ep.number)) next.add(x.code);
    }
    sfx.whoosh(); save(next);
    toast(`Marcado hasta ${ep.code}`, 'ok');
  }
  function toggleSeason(s, ev) {
    ev.stopPropagation();
    const next = new Set(watched);
    const all = s.episodes.every((x) => next.has(x.code));
    s.episodes.forEach((x) => (all ? next.delete(x.code) : next.add(x.code)));
    if (!all) { onomato(ev.clientX, ev.clientY, '¡TEMPORADA!', '#3b6cf6'); sfx.chime(); } else sfx.click();
    save(next);
  }

  return html`
    <div>
      <div class="row between" style="margin-bottom:16px">
        <div class="row"><span class="pill-count">${watched.size}/${total}</span><b>episodios vistos</b></div>
        ${e.nextEpisode?.airdate && e.nextEpisode.airdate >= today && html`<span class="badge" style="--c:var(--pink)">🔜 ${e.nextEpisode.code} · ${humanDate(e.nextEpisode.airdate)}</span>`}
      </div>
      ${seasons.map((s) => {
        const seen = s.episodes.filter((x) => watched.has(x.code)).length;
        const isOpen = !!open[s.season];
        const first = s.episodes[0]?.airdate, last = s.episodes[s.episodes.length - 1]?.airdate;
        return html`
          <section class="season" key=${s.season}>
            <header onClick=${() => { setOpen({ ...open, [s.season]: !isOpen }); sfx.click(); }} aria-expanded=${isOpen}>
              <span style="font-size:1.3rem">${isOpen ? '▾' : '▸'}</span>
              <div style="min-width:150px">
                <h4>${s.name}</h4>
                <span class="small muted">${s.episodes.length} episodios${first ? ` · ${first.slice(0, 4)}${last && last.slice(0, 4) !== first.slice(0, 4) ? '–' + last.slice(0, 4) : ''}` : ''}</span>
              </div>
              <div class="bar"><i style=${`width:${(seen / s.episodes.length) * 100}%`}></i></div>
              <b class="small">${seen}/${s.episodes.length}</b>
              ${mine && html`<button class="btn sm ${seen === s.episodes.length ? 'teal' : ''}" onClick=${(ev) => toggleSeason(s, ev)}>${seen === s.episodes.length ? '✓ Vista' : 'Marcar toda'}</button>`}
            </header>
            ${isOpen && html`<div class="eps">
              ${s.overview && html`<p class="small" style="margin:0;padding:14px 18px;border-bottom:2px dashed rgba(22,20,31,.2)">${s.overview}</p>`}
              ${s.episodes.map((ep) => {
                const isSeen = watched.has(ep.code);
                const future = ep.airdate && ep.airdate > today;
                const ex = expanded[ep.code];
                return html`<div class="ep ${isSeen ? 'seen' : ''} ${future ? 'future' : ''}" key=${ep.code}>
                  <label class="check" style="align-self:start;padding-top:2px" title=${mine ? 'Marcar como visto' : ''}>
                    <input type="checkbox" checked=${isSeen} disabled=${!mine} onChange=${(ev) => toggle(ep, ev)} aria-label=${`Visto ${ep.code}`} />
                  </label>
                  <div>
                    ${ep.image && html`<div class="still"><img src=${ep.image} alt="" loading="lazy" /></div>`}
                    <div class="row" style="--g:8px">
                      <span class="code">${ep.code}</span>
                      <h5>${ep.name}</h5>
                    </div>
                    <div class="small muted" style="margin-top:4px;font-weight:600">
                      ${ep.airdate ? `📅 ${humanDate(ep.airdate)}` : 'Sin fecha'}${future ? ' · próximamente' : ''}${ep.runtime ? ` · ${ep.runtime} min` : ''}${ep.rating ? ` · ★ ${Number(ep.rating).toFixed(1)}` : ''}
                    </div>
                    ${ep.overview && html`<p class=${ex ? '' : 'line-clamp-3'} onClick=${() => setExpanded({ ...expanded, [ep.code]: !ex })} style="cursor:pointer" title="Pulsa para ver entera">${ep.overview}</p>`}
                    ${mine && !isSeen && !future && html`<button class="btn sm ghost" style="margin-top:6px" onClick=${() => upTo(ep)}>✓✓ Visto hasta aquí</button>`}
                  </div>
                </div>`;
              })}
            </div>`}
          </section>`;
      })}
    </div>`;
}
