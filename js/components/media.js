// Tráiler, banda sonora y reparto.
import { html, useState, useEffect, useRef } from 'preact-standalone';
import { trailerSearchUrl } from '../lib/metadata.js';
import { sfx } from '../lib/sound.js';

export function Trailer({ e }) {
  const [play, setPlay] = useState(false);
  const yt = e.trailer?.youtube;
  useEffect(() => setPlay(false), [yt]);
  if (!yt) {
    return html`<div class="panel tint flat" style="--c:var(--red)">
      <p style="margin:0 0 12px;font-weight:600">No hemos encontrado el tráiler automáticamente.</p>
      <a class="btn red" href=${trailerSearchUrl(e)} target="_blank" rel="noopener">▶ Buscar tráiler en YouTube</a>
    </div>`;
  }
  return html`<div class="video">
    ${play
      ? html`<iframe src=${`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0&modestbranding=1`} title=${`Tráiler de ${e.title}`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`
      : html`<button class="poster-btn" onClick=${() => { sfx.riser(0.7); setTimeout(() => setPlay(true), 500); }} aria-label="Reproducir tráiler">
          <img src=${`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="" /><b>▶</b></button>`}
  </div>`;
}

let currentAudio = null;
export function Soundtrack({ e }) {
  const s = e.soundtrack;
  const [playing, setPlaying] = useState(null);
  const audio = useRef(null);
  useEffect(() => () => { audio.current?.pause(); }, []);
  if (!s && !e.composer) return null;
  function toggle(t) {
    if (playing === t.preview) { audio.current?.pause(); setPlaying(null); return; }
    currentAudio?.pause();
    const a = new Audio(t.preview);
    a.volume = 0.8; a.play().catch(() => {});
    a.onended = () => setPlaying(null);
    audio.current = a; currentAudio = a; setPlaying(t.preview);
  }
  return html`<div class="ost">
    ${s?.artwork ? html`<div class="art ${playing ? 'spin' : ''}"><img src=${s.artwork} alt=${s.album} /></div>` : html`<div class="art" style="display:grid;place-items:center;font-size:3rem;background:var(--pink)">🎵</div>`}
    <div>
      ${s && html`<h4 class="h3">${s.album}</h4><p style="margin:4px 0 0;font-weight:600">${s.artist}${s.year ? ` · ${s.year}` : ''}</p>`}
      ${e.composer && html`<p style="margin:6px 0 0">🎼 Compositor: <b>${e.composer}</b></p>`}
      <div class="row" style="margin-top:10px;--g:8px">
        ${s?.url && html`<a class="btn sm pink" href=${s.url} target="_blank" rel="noopener">Apple Music ↗</a>`}
        <a class="btn sm" href=${`https://open.spotify.com/search/${encodeURIComponent((s?.album || e.title + ' soundtrack'))}`} target="_blank" rel="noopener">Spotify ↗</a>
      </div>
      ${s?.tracks?.length > 0 && html`<ul class="tracks">${s.tracks.map((t, i) => html`
        <li key=${i} class=${playing === t.preview ? 'on' : ''}>
          ${t.preview ? html`<button onClick=${() => toggle(t)} aria-label=${playing === t.preview ? 'Pausar' : 'Escuchar 30 s'}>${playing === t.preview ? '❚❚' : '▶'}</button>` : html`<span></span>`}
          <span><b>${t.name}</b>${t.artist && t.artist !== s.artist ? html` <span class="muted small">· ${t.artist}</span>` : ''}</span>
          <span class="small muted">${t.ms ? `${Math.floor(t.ms / 60000)}:${String(Math.floor((t.ms % 60000) / 1000)).padStart(2, '0')}` : ''}</span>
        </li>`)}</ul>`}
    </div>
  </div>`;
}

export function AudioPreview({ src }) {
  if (!src) return null;
  return html`<div class="panel tint flat" style="--c:var(--teal)"><p class="label" style="margin:0 0 8px">🎧 Muestra del audiolibro</p><audio controls preload="none" src=${src} style="width:100%"></audio></div>`;
}

export function CastRow({ cast }) {
  if (!cast?.length) return null;
  return html`<div class="cast">${cast.map((c, i) => html`<div key=${i}>
    <div class="ph">${c.photo ? html`<img src=${c.photo} alt=${c.name} loading="lazy" />` : c.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
    <b>${c.name}</b>${c.role && html`<span>${c.role}</span>`}</div>`)}</div>`;
}
