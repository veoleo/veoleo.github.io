// Tráiler, banda sonora, muestra de audiolibro y reparto.
import { html, useState, useEffect, useRef } from 'preact-standalone';
import { Icon } from './icons.js';
import { trailerSearchUrl } from '../lib/metadata.js';
import { sfx } from '../lib/sound.js';

export function Trailer({ e }) {
  const [play, setPlay] = useState(false);
  const yt = e.trailer?.youtube;
  const video = e.trailer?.video;
  useEffect(() => setPlay(false), [yt, video]);
  if (!yt && !video) {
    return html`<a class="video" href=${trailerSearchUrl(e)} target="_blank" rel="noopener" style="display:block">
      <span class="poster-btn">${e.backdrop || e.cover ? html`<img src=${e.backdrop || e.cover} alt="" />` : ''}<b></b><span>Ver tráiler en YouTube ↗</span></span>
    </a>`;
  }
  const thumb = yt ? `https://i.ytimg.com/vi/${yt}/maxresdefault.jpg` : e.backdrop || e.cover;
  return html`<div class="video">
    ${play
      ? (yt
        ? html`<iframe src=${`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0&modestbranding=1`} title=${`Tráiler de ${e.title}`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`
        : html`<video src=${video} controls autoplay playsinline poster=${thumb}></video>`)
      : html`<button class="poster-btn" onClick=${() => { sfx.open(); setPlay(true); }} aria-label="Reproducir tráiler">
          ${thumb && html`<img src=${thumb} alt="" onError=${(ev) => { if (yt) ev.currentTarget.src = `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`; }} />`}<b></b><span>Reproducir tráiler</span></button>`}
  </div>`;
}

let currentAudio = null;
const fmt = (ms) => (ms ? `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}` : '');

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
    a.volume = 0.85; a.play().catch(() => {});
    a.onended = () => setPlaying(null);
    audio.current = a; currentAudio = a; setPlaying(t.preview);
  }
  return html`<div class="ost">
    <div class="art ${playing ? 'spin' : ''}">${s?.artwork ? html`<img src=${s.artwork} alt=${s.album} />` : html`<div class="gen-poster" style="--gc:var(--pink)"><span>OST</span><b>${e.title}</b></div>`}</div>
    <div>
      ${s && html`<div class="label" style="color:var(--pink)">${s.artist}${s.year ? ` · ${s.year}` : ''}</div><h3 class="h3" style="margin-top:8px">${s.album}</h3>`}
      ${e.composer && html`<p class="muted" style="margin:10px 0 0">Música original de <span style="color:var(--text)">${e.composer}</span></p>`}
      <div class="row" style="margin-top:16px;--g:8px">
        ${s?.url && html`<a class="btn sm glass" href=${s.url} target="_blank" rel="noopener">Apple Music <${Icon} name="ext" size=${13} /></a>`}
        <a class="btn sm glass" href=${`https://open.spotify.com/search/${encodeURIComponent(s?.album || e.title + ' soundtrack')}`} target="_blank" rel="noopener">Spotify <${Icon} name="ext" size=${13} /></a>
      </div>
      ${s?.tracks?.length > 0 && html`<ul class="tracks">${s.tracks.map((t, i) => html`
        <li key=${i} class=${playing === t.preview ? 'on' : ''}>
          ${t.preview ? html`<button onClick=${() => toggle(t)} aria-label=${playing === t.preview ? 'Pausar' : 'Escuchar 30 s'}>${playing === t.preview ? html`<span class="eq"><i></i><i></i><i></i></span>` : html`<${Icon} name="play" size=${12} />`}</button>` : html`<span class="count">${String(t.n || i + 1).padStart(2, '0')}</span>`}
          <span>${t.name}${t.artist && t.artist !== s.artist ? html` <span class="muted small">· ${t.artist}</span>` : ''}</span>
          <span class="count">${fmt(t.ms)}</span>
        </li>`)}</ul>`}
    </div>
  </div>`;
}

export function AudioPreview({ src }) {
  if (!src) return null;
  return html`<div class="stack" style="--g:10px"><span class="label">Muestra del audiolibro</span><audio controls preload="none" src=${src} style="width:100%;filter:invert(.9) hue-rotate(180deg)"></audio></div>`;
}

export function CastRow({ cast }) {
  if (!cast?.length) return null;
  return html`<div class="cast">${cast.map((c, i) => html`<div key=${i}>
    <div class="ph">${c.photo ? html`<img src=${c.photo} alt=${c.name} loading="lazy" />` : c.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
    <b>${c.name}</b>${c.role && html`<span>${c.role}</span>`}</div>`)}</div>`;
}
