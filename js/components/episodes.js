// Temporadas y episodios: marcar vistos, sinopsis oficial y fechas de emisión.
import { html, useState, useEffect } from 'preact-standalone';
import { Spinner, Icon } from './ui.js';
import { getSeasons, showInfo, seriesStatusFor } from '../lib/metadata.js';
import { updateEntry } from '../lib/db.js';
import { useStore, toast } from '../lib/store.js';
import { humanDate, todayISO } from '../lib/utils.js';
import { sfx } from '../lib/sound.js';
import { flash, burstAt, confetti, scan } from '../lib/fx.js';

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
      const first = s.find((x) => x.episodes.some((ep) => !watched.has(ep.code) && (!ep.airdate || ep.airdate <= today)));
      if (first) setOpen({ [first.season]: true });
    }).catch((x) => alive && setErr(x.message));
    return () => { alive = false; };
  }, [e.id, e.ids?.tmdb, e.ids?.tvmaze]);

  if (err) return html`<p class="muted">No se pudo cargar la guía de episodios (${err}).</p>`;
  if (!seasons) return html`<${Spinner} />`;
  if (!seasons.length) return html`<p class="muted">No hay guía de episodios disponible para este título.</p>`;

  const aired = seasons.flatMap((s) => s.episodes).filter((ep) => !ep.airdate || ep.airdate <= today);
  const total = seasons.reduce((a, s) => a + s.episodes.length, 0);
  const minutes = seasons.flatMap((s) => s.episodes).filter((ep) => watched.has(ep.code)).reduce((a, ep) => a + (ep.runtime || e.runtime || 0), 0);

  async function save(next, el) {
    const list = [...next].sort();
    const all = seasons.flatMap((s) => s.episodes);
    const patch = { watchedEpisodes: list, episodes: total, watchedMinutes: all.filter((ep) => next.has(ep.code)).reduce((a, ep) => a + (ep.runtime || e.runtime || 0), 0) };
    const info = await showInfo(e).catch(() => null);
    const basis = info || { aired, upcoming: all.filter((ep) => ep.airdate && ep.airdate > today), ended: /ended|cancel/i.test(e.showStatus || '') };
    const status = seriesStatusFor(e, basis, list);
    if (status !== e.status) {
      patch.status = status;
      if (status === 'completed') { patch.finishedAt = e.finishedAt || today; setTimeout(() => { flash('Serie vista', '#2ee6c5'); confetti(); sfx.braam(0.5); }, 150); }
      if (status === 'up_to_date') setTimeout(() => { flash('Al día', '#5b7fff'); sfx.chime(); }, 150);
      if (status === 'in_progress' && !e.startedAt) patch.startedAt = today;
    }
    if (info) {
      patch.showStatus = info.status; patch.nextEpisode = info.next;
      patch.ids = { ...(e.ids || {}), tvmaze: info.tvmazeId, tvdb: info.tvdbId || e.ids?.tvdb || '', imdb: e.ids?.imdb || info.imdbId || '' };
    }
    try { await updateEntry(e.id, patch); }
    catch (x) { toast('No se pudo guardar: ' + x.message, 'err'); return; }
    if (el) burstAt(el, { count: 8, spread: 40, colors: ['#c6ff3d', '#fff'] });
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
    sfx.whoosh(); scan(); save(next);
    toast(`Marcado hasta ${ep.code}`, 'ok');
  }
  function toggleSeason(s, ev) {
    ev.stopPropagation();
    if (!mine) return;
    const next = new Set(watched);
    const all = s.episodes.every((x) => next.has(x.code));
    s.episodes.forEach((x) => (all ? next.delete(x.code) : next.add(x.code)));
    if (!all) { flash(`${s.name} vista`, '#c6ff3d'); sfx.chime(); } else sfx.click();
    save(next);
  }

  return html`
    <div>
      <div class="row between" style="margin-bottom:22px">
        <div class="row" style="--g:28px">
          <div><div class="label">Vistos</div><div class="h2" style="margin-top:6px">${watched.size}<span class="muted" style="font-size:.5em"> / ${total}</span></div></div>
          ${minutes > 0 && html`<div><div class="label">Tiempo</div><div class="h2" style="margin-top:6px">${Math.round(minutes / 60)}<span class="muted" style="font-size:.5em"> h</span></div></div>`}
        </div>
        ${e.nextEpisode?.airdate && e.nextEpisode.airdate >= today && html`<span class="tag" style="--c:var(--pink)">Próximo · ${e.nextEpisode.code} · ${humanDate(e.nextEpisode.airdate)}</span>`}
      </div>
      ${seasons.map((s) => {
        const seen = s.episodes.filter((x) => watched.has(x.code)).length;
        const isOpen = !!open[s.season];
        const first = s.episodes[0]?.airdate, last = s.episodes[s.episodes.length - 1]?.airdate;
        return html`
          <section class=${'season' + (isOpen ? ' open' : '')} key=${s.season}>
            <header onClick=${() => { setOpen({ ...open, [s.season]: !isOpen }); sfx.click(); }} aria-expanded=${isOpen}>
              <span class="chev"><${Icon} name="chevron" size=${16} /></span>
              <div>
                <h4>${s.name}</h4>
                <span class="count">${s.episodes.length} EP${first ? ` · ${first.slice(0, 4)}${last && last.slice(0, 4) !== first.slice(0, 4) ? '–' + last.slice(0, 4) : ''}` : ''}</span>
              </div>
              <div class="sbar"><i style=${`width:${(seen / s.episodes.length) * 100}%`}></i></div>
              <span class="count">${seen}/${s.episodes.length}</span>
              <label class="check" onClick=${(ev) => ev.stopPropagation()} title="Temporada entera vista">
                <input type="checkbox" checked=${seen === s.episodes.length} disabled=${!mine} onChange=${(ev) => toggleSeason(s, ev)} aria-label=${`${s.name} entera vista`} />
                <span class="count hide-sm">${seen === s.episodes.length ? 'VISTA' : 'TODA'}</span>
              </label>
            </header>
            ${isOpen && html`<div class="eps">
              ${s.overview && html`<p class="soverview">${s.overview}</p>`}
              ${s.episodes.map((ep) => {
                const isSeen = watched.has(ep.code);
                const future = ep.airdate && ep.airdate > today;
                const ex = expanded[ep.code];
                return html`<div class="ep ${isSeen ? 'seen' : ''} ${future ? 'future' : ''}" key=${ep.code}>
                  <label class="check" style="padding-top:4px" title=${mine ? 'Marcar como visto' : ''}>
                    <input type="checkbox" checked=${isSeen} disabled=${!mine} onChange=${(ev) => toggle(ep, ev)} aria-label=${`Visto ${ep.code}`} />
                  </label>
                  <div class="still">${ep.image ? html`<img src=${ep.image} alt="" loading="lazy" />` : ''}</div>
                  <div>
                    <span class="code">${ep.code}</span>
                    <h5>${ep.name}</h5>
                    <div class="emeta">${ep.airdate ? humanDate(ep.airdate) : 'Sin fecha'}${future ? ' · Próximamente' : ''}${ep.runtime ? ` · ${ep.runtime} min` : ''}${ep.rating ? ` · ★ ${Number(ep.rating).toFixed(1)}` : ''}</div>
                    ${ep.overview && html`<p class=${ex ? '' : 'line-clamp-3'} onClick=${() => setExpanded({ ...expanded, [ep.code]: !ex })} title="Pulsa para leer entera">${ep.overview}</p>`}
                    ${mine && !isSeen && !future && html`<button class="btn text" style="margin-top:6px" onClick=${() => upTo(ep)}>Visto hasta aquí</button>`}
                  </div>
                </div>`;
              })}
            </div>`}
          </section>`;
      })}
    </div>`;
}
