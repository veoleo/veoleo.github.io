// Tarjetas para compartir (Instagram, stories…) estilo Strava: «He terminado», portada, valoración,
// estadísticas, insignias y un trozo de tu nota. Se dibujan en canvas y se comparten como PNG.
import { html, useState, useEffect, useRef } from 'preact-standalone';
import { Modal, Tabs, Switch, Icon } from './ui.js';
import { useStore, toast } from '../lib/store.js';
import { getNote } from '../lib/db.js';
import { TYPES, entryYear } from '../lib/utils.js';
import { challengeProgress } from '../pages/challenges.js';
import { t, LANG, LOCALE } from '../lib/i18n.js';
import { sfx } from '../lib/sound.js';
import { flash } from '../lib/fx.js';

const FORMATS = { story: [1080, 1920], post: [1080, 1350] };
const ACCENT = { series: '#5b7fff', movie: '#ff4d61', book: '#ffc53d', audiobook: '#2ee6c5' };
const SWATCHES = ['#c6ff3d', '#2ee6c5', '#5b7fff', '#9a7bff', '#ff5fae', '#ff4d61', '#ff8a3d', '#ffc53d'];

const KICKER = {
  completed: { series: 'He terminado', movie: 'He visto', book: 'He leído', audiobook: 'He escuchado' },
  up_to_date: { series: 'Al día con', movie: 'He visto', book: 'He leído', audiobook: 'He escuchado' },
  in_progress: { series: 'Estoy viendo', movie: 'Estoy viendo', book: 'Estoy leyendo', audiobook: 'Estoy escuchando' },
  planned: { series: 'En mi lista', movie: 'En mi lista', book: 'En mi lista', audiobook: 'En mi lista' },
  abandoned: { series: 'He abandonado', movie: 'He abandonado', book: 'He abandonado', audiobook: 'He abandonado' },
};

// Imagen con CORS (a través del redimensionador) para poder exportar el canvas.
function loadImg(url, w = 1200) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const im = new Image();
    im.crossOrigin = 'anonymous';
    const timer = setTimeout(() => resolve(null), 12000);
    im.onload = () => { clearTimeout(timer); resolve(im); };
    im.onerror = () => { clearTimeout(timer); resolve(null); };
    im.src = `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=${w}&output=jpg&q=88`;
  });
}

function plainNote(md) {
  return String(md || '')
    .replace(/^>\s*\[![^\]]+\][+-]?.*$/gm, '').replace(/^[#>\-*\s]+/gm, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`~]/g, '').replace(/\s+/g, ' ').trim();
}

function daysBetween(a, b) {
  if (!a || !b) return null;
  const d = Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1;
  return d > 0 && d < 3650 ? d : null;
}

// Estadísticas grandes (como los datos de una actividad en Strava).
function statsFor(e) {
  const out = [];
  const days = daysBetween(e.startedAt, e.finishedAt);
  if (e.type === 'series') {
    const eps = (e.watchedEpisodes || []).length;
    const seasons = new Set((e.watchedEpisodes || []).map((c) => c.slice(0, 3))).size;
    const rt = Number(e.runtime) || 45;
    if (eps) out.push([String(eps), 'Episodios']);
    if (seasons) out.push([String(seasons), seasons === 1 ? 'Temporada' : 'Temporadas']);
    if (eps) out.push([String(Math.max(1, Math.round((eps * rt) / 60))), 'Horas']);
    else if (e.episodes) out.push([String(e.episodes), 'Episodios']);
  } else if (e.type === 'movie') {
    if (e.runtime) out.push([String(e.runtime), 'Minutos']);
    if (e.year) out.push([String(e.year), 'Año']);
    if (e.rewatch) out.push([String(Number(e.rewatch) + 1), 'Veces vista']);
  } else {
    if (e.pages && e.type === 'book') out.push([String(e.pages), 'Páginas']);
    if (e.runtime && e.type === 'audiobook') out.push([String(Math.round(e.runtime / 60) || 1), 'Horas']);
    if (days) out.push([String(days), days === 1 ? 'Día' : 'Días']);
    if (e.year) out.push([String(e.year), 'Año']);
  }
  if (days && e.type === 'series' && out.length < 3) out.push([String(days), days === 1 ? 'Día' : 'Días']);
  if (e.platform && out.length < 3) out.push([e.platform, 'Dónde']);
  return out.slice(0, 3);
}

// Insignias: obra maestra, maratón, número del año, reto anual, revisionado, lectura larga.
function badgesFor(e, entries, profile) {
  const b = [];
  if (e.rating >= 5) b.push('★ Obra maestra');
  const days = daysBetween(e.startedAt, e.finishedAt);
  if (e.type === 'series' && e.status === 'completed' && days && days <= 7 && (e.watchedEpisodes || []).length >= 6) b.push('Maratón');
  if (e.type === 'book' && Number(e.pages) >= 500) b.push('Lectura larga');
  if (Number(e.rewatch) > 0) b.push('Revisionado');
  const year = entryYear(e);
  if (e.status === 'completed' && year) {
    const sameYear = entries.filter((x) => x.type === e.type && x.status === 'completed' && entryYear(x) === year)
      .sort((a, c) => String(a.finishedAt || '').localeCompare(String(c.finishedAt || '')));
    const n = sameYear.findIndex((x) => x.id === e.id) + 1;
    if (n > 0) b.push(`Nº ${n} de ${year}`);
    const goals = profile?.challenges?.[year] || {};
    const key = { book: 'books', audiobook: 'audiobooks', series: 'series', movie: 'movies' }[e.type];
    if (Number(goals[key]) > 0) {
      const { res } = challengeProgress(entries, year, goals);
      b.push(`Reto ${year}: ${res[key]}/${goals[key]}`);
    }
  }
  return b.slice(0, 3);
}

function chamfer(ctx, x, y, w, h, c) {
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + w - c, y); ctx.lineTo(x + w, y + c); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath();
}
function coverFit(ctx, im, x, y, w, h) {
  const r = Math.max(w / im.width, h / im.height);
  const iw = im.width * r, ih = im.height * r;
  ctx.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}
function wrap(ctx, text, maxW, maxLines) {
  const words = String(text).split(/\s+/); const lines = []; let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(last + '…').width > maxW && last.length) last = last.slice(0, -1);
    lines[maxLines - 1] = last.replace(/\s+\S*$/, '') + '…';
  }
  return lines;
}
function stars(ctx, x, y, size, value, color) {
  const path = (cx, cy, r) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.45 : r; ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); }
    ctx.closePath();
  };
  for (let i = 0; i < 5; i++) {
    const cx = x + size / 2 + i * size * 1.12, cy = y + size / 2;
    path(cx, cy, size / 2); ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fill();
    const fill = Math.max(0, Math.min(1, value - i));
    if (fill > 0) { ctx.save(); ctx.beginPath(); ctx.rect(cx - size / 2, cy - size / 2, size * fill, size); ctx.clip(); path(cx, cy, size / 2); ctx.fillStyle = color; ctx.fill(); ctx.restore(); }
  }
}
const F = (w, size, fam = 'Archivo') => `${w} ${size}px ${fam === 'mono' ? '"Geist Mono", ui-monospace, monospace' : fam === 'body' ? 'Geist, system-ui, sans-serif' : 'Archivo, "Helvetica Neue", Arial, sans-serif'}`;

export async function drawCard(canvas, { e, format = 'story', accent, note, showNote, badges, profile }) {
  const [W, H] = FORMATS[format];
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  try { await Promise.all([document.fonts.load(F(800, 100)), document.fonts.load(F(500, 30, 'mono')), document.fonts.load(F(500, 30, 'body'))]); } catch { /* fuentes del sistema */ }
  const [bg, cover] = await Promise.all([loadImg(e.backdrop || e.cover, 1400), loadImg(e.cover, 900)]);
  const story = format === 'story';
  const P = 80;

  // fondo: imagen oscurecida + brillo del color de acento
  ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, W, H);
  if (bg) { ctx.save(); ctx.globalAlpha = 0.42; ctx.filter = 'blur(6px) saturate(1.1)'; coverFit(ctx, bg, -40, -40, W + 80, H * (story ? 0.62 : 0.7)); ctx.restore(); }
  let g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(5,6,10,.35)'); g.addColorStop(story ? 0.45 : 0.5, 'rgba(5,6,10,.82)'); g.addColorStop(1, '#05060a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(W * 0.15, H * 0.12, 0, W * 0.15, H * 0.12, W * 0.9);
  g.addColorStop(0, accent + '40'); g.addColorStop(1, accent + '00');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // rejilla sutil
  ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }

  // cabecera: logo y fecha
  ctx.fillStyle = accent; chamfer(ctx, P, 70, 46, 46, 12); ctx.fill();
  ctx.fillStyle = '#05060a'; ctx.beginPath(); ctx.moveTo(P + 16, 82); ctx.lineTo(P + 34, 93); ctx.lineTo(P + 16, 104); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#eef0f7'; ctx.font = F(800, 34); ctx.textBaseline = 'middle'; ctx.fillText('VEOLEO', P + 64, 94);
  const date = new Date((e.finishedAt || '') + 'T12:00:00');
  const dateTxt = (isNaN(date) ? new Date() : date).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
  ctx.font = F(500, 26, 'mono'); ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(238,240,247,.75)'; ctx.fillText(dateTxt, W - P, 94); ctx.textAlign = 'left';

  // medidas previas para centrar el bloque en vertical
  const text = showNote ? plainNote(note) : '';
  const stats = statsFor(e);
  let size = story ? 128 : 104; const maxLines = story ? 3 : 2;
  let lines;
  do { ctx.font = F(800, size); lines = wrap(ctx, e.title.toUpperCase(), W - P * 2, maxLines + 1); size -= 6; } while (lines.length > maxLines && size > 56);
  size += 6; ctx.font = F(800, size); lines = wrap(ctx, e.title.toUpperCase(), W - P * 2, maxLines);
  const noteLines = story ? 4 : 2;
  const cw = story ? (text ? 470 : 540) : 360, ch = cw * 1.5;
  const blockH = ch + (story ? 70 : 50) + lines.length * size * 0.98 + 84 + (stats.length ? (story ? 204 : 174) : 0) + (text ? (story ? 210 : 110) : 0);
  const top = 150, bottom = H - 130;
  const cy = Math.max(top + 20, top + (bottom - top - blockH) / 2);

  // portada + bloque lateral
  ctx.save(); chamfer(ctx, P, cy, cw, ch, 34); ctx.clip();
  if (cover) coverFit(ctx, cover, P, cy, cw, ch);
  else { const gg = ctx.createLinearGradient(P, cy, P + cw, cy + ch); gg.addColorStop(0, accent); gg.addColorStop(1, '#14151c'); ctx.fillStyle = gg; ctx.fillRect(P, cy, cw, ch); }
  ctx.restore();
  ctx.strokeStyle = accent; ctx.lineWidth = 3; chamfer(ctx, P, cy, cw, ch, 34); ctx.stroke();

  const sx = P + cw + 48, sw = W - P - sx;
  let y = cy + 10;
  ctx.textBaseline = 'top';
  ctx.fillStyle = accent; ctx.fillRect(sx, y + 14, 36, 4);
  ctx.font = F(600, 26, 'mono'); ctx.fillText(t(TYPES[e.type]?.label || '').toUpperCase(), sx + 50, y);
  y += 60;
  const kicker = t(KICKER[e.status]?.[e.type] || 'He terminado').toUpperCase();
  ctx.fillStyle = '#eef0f7'; ctx.font = F(800, story ? 64 : 54);
  for (const l of wrap(ctx, kicker, sw, 3)) { ctx.fillText(l, sx, y); y += story ? 66 : 56; }
  y += 24;
  if (e.rating > 0) {
    stars(ctx, sx, y, story ? 50 : 42, e.rating, '#ffc53d'); y += story ? 66 : 56;
    ctx.font = F(600, 30, 'mono'); ctx.fillStyle = '#ffc53d'; ctx.fillText(String(e.rating).replace('.', LANG === 'en' ? '.' : ',') + ' / 5', sx, y); y += 56;
  }
  // insignias
  for (const b of badges) {
    ctx.font = F(600, story ? 25 : 22, 'mono');
    const txt = t(b).toUpperCase(); const bw = Math.min(sw, ctx.measureText(txt).width + 36);
    ctx.fillStyle = accent + '26'; chamfer(ctx, sx, y, bw, 52, 12); ctx.fill();
    ctx.strokeStyle = accent; ctx.lineWidth = 2; chamfer(ctx, sx, y, bw, 52, 12); ctx.stroke();
    ctx.fillStyle = '#eef0f7'; ctx.textBaseline = 'middle'; ctx.fillText(txt, sx + 18, y + 27); ctx.textBaseline = 'top';
    y += 66;
  }

  // título
  y = cy + ch + (story ? 70 : 50);
  ctx.font = F(800, size); ctx.fillStyle = '#ffffff';
  for (const l of lines.slice(0, maxLines)) { ctx.fillText(l, P, y); y += size * 0.98; }
  const meta = [e.year, (e.creators || [])[0], (e.genres || []).slice(0, 2).map((x) => t(x)).join(' · '), e.platform].filter(Boolean).join('  ·  ');
  ctx.font = F(500, 28, 'mono'); ctx.fillStyle = 'rgba(238,240,247,.72)';
  y += 14; ctx.fillText(wrap(ctx, meta.toUpperCase(), W - P * 2, 1)[0] || '', P, y); y += 70;

  // estadísticas
  if (stats.length) {
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P, y); ctx.lineTo(W - P, y); ctx.stroke();
    y += 34;
    const colW = (W - P * 2) / stats.length;
    stats.forEach(([v, label], i) => {
      const x = P + i * colW;
      ctx.fillStyle = i === 0 ? accent : '#ffffff';
      let fs = story ? 96 : 80; ctx.font = F(800, fs);
      while (ctx.measureText(v).width > colW - 24 && fs > 34) { fs -= 4; ctx.font = F(800, fs); }
      ctx.fillText(v, x, y);
      ctx.font = F(600, 24, 'mono'); ctx.fillStyle = 'rgba(238,240,247,.7)'; ctx.fillText(t(label).toUpperCase(), x, y + (story ? 104 : 88));
    });
    y += story ? 170 : 140;
  }

  // nota
  if (text && y < H - 200) {
    ctx.fillStyle = accent; ctx.fillRect(P, y + 6, 6, story ? 150 : 100);
    ctx.font = F(400, story ? 38 : 32, 'body'); ctx.fillStyle = '#eef0f7';
    const nl = wrap(ctx, `«${text}»`, W - P * 2 - 40, noteLines);
    nl.forEach((l, i) => ctx.fillText(l, P + 34, y + i * (story ? 50 : 44)));
  }

  // pie
  ctx.textBaseline = 'alphabetic';
  ctx.font = F(600, 28, 'mono'); ctx.fillStyle = 'rgba(238,240,247,.85)';
  ctx.fillText(profile?.handle ? '@' + profile.handle : '', P, H - 70);
  ctx.textAlign = 'right'; ctx.fillStyle = accent; ctx.fillText('veoleo.github.io', W - P, H - 70); ctx.textAlign = 'left';
}

const fileName = (e, format) => `veoleo-${String(e.title).toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${format}.png`;

export function ShareCardModal({ e, onClose }) {
  const { entries, profile: me, user } = useStore();
  const mine = e.ownerId === user?.uid;
  const profile = mine ? me : { handle: e.ownerHandle, challenges: {} };
  const [format, setFormat] = useState('story');
  const [accent, setAccent] = useState(ACCENT[e.type] || '#c6ff3d');
  const [showNote, setShowNote] = useState(true);
  const [showBadges, setShowBadges] = useState(true);
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(true);
  const ref = useRef();
  const badges = showBadges ? badgesFor(e, mine ? entries : [e], profile) : [];
  useEffect(() => { getNote(e.id).then((n) => setNote(n?.body || '')).catch(() => setNote('')); }, [e.id]);
  useEffect(() => {
    if (note === null) return;
    setBusy(true);
    drawCard(ref.current, { e, format, accent, note, showNote, badges, profile }).catch((x) => toast(x.message, 'err')).finally(() => setBusy(false));
  }, [format, accent, showNote, showBadges, note]);

  const blob = () => new Promise((res, rej) => ref.current.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo generar la imagen'))), 'image/png'));
  async function share() {
    try {
      const file = new File([await blob()], fileName(e, format), { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: e.title, text: `${e.title} · Veoleo` }); sfx.chime(); return; }
      download(file); toast(t('Imagen descargada: súbela a Instagram desde tu galería'), 'ok', 6000);
    } catch (x) { if (x.name !== 'AbortError') toast(x.message, 'err'); }
  }
  function download(file) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000); sfx.pop(); flash(t('Tarjeta lista'), accent);
  }
  return html`<${Modal} kicker="Compartir" title="Tarjeta para Instagram" width=${980} onClose=${onClose}
    actions=${html`<button class="btn ghost" disabled=${busy} onClick=${async () => download(new File([await blob()], fileName(e, format), { type: 'image/png' }))}><${Icon} name="download" size=${14} /> PNG</button>
      <button class="btn" disabled=${busy} onClick=${share}><${Icon} name="share" size=${14} /> Compartir</button>`}>
    <div class="sharecard">
      <div class=${'sc-prev ' + format}><canvas ref=${ref}></canvas>${busy && html`<div class="sc-busy"><div class="loader inline"><i></i><i></i><i></i></div></div>`}</div>
      <div class="stack" style="--g:22px">
        <${Tabs} value=${format} onChange=${setFormat} options=${[{ value: 'story', label: 'Story 9:16' }, { value: 'post', label: 'Post 4:5' }]} />
        <div class="field"><label>Color</label>
          <div class="swatches">${SWATCHES.concat(ACCENT[e.type] && !SWATCHES.includes(ACCENT[e.type]) ? [ACCENT[e.type]] : []).map((c) => html`<button key=${c} class=${accent === c ? 'on' : ''} style=${`--sw:${c}`} aria-label=${c} onClick=${() => setAccent(c)}></button>`)}</div></div>
        <${Switch} checked=${showBadges} onChange=${setShowBadges} label="Insignias" />
        <${Switch} checked=${showNote} onChange=${setShowNote} label=${note ? 'Incluir un trozo de mi nota' : 'Incluir mi nota (aún no has escrito)'} />
        <p class="small muted" style="margin:0">En el móvil, «Compartir» abre Instagram, WhatsApp y el resto de apps. En el ordenador se descarga el PNG.</p>
      </div>
    </div>
  </${Modal}>`;
}
