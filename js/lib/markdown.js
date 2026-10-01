// Exportación a Markdown con sabor Obsidian: frontmatter, callouts, Dataview, embeds.
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  TYPES, statusLabel, starsText, humanDate, safeFilename, fmtDuration, download, loadScript, toMillis,
} from './utils.js';
import { getSeasons, deciderUrl, justwatchUrl, platformsOf } from './metadata.js';

/* ───────────── Render para previsualizar en la app ───────────── */

export function renderMarkdown(md) {
  let h = marked.parse(String(md || ''), { gfm: true, breaks: true });
  h = DOMPurify.sanitize(h);
  // Callouts de Obsidian: > [!tipo] Título
  h = h.replace(/<blockquote>\s*<p>\[!([\w-]+)\]([+-]?)\s*([^<\n]*)(?:<br>\n?|\n)?/g,
    (m, type, fold, title) => `<blockquote class="callout" data-callout="${type}"><p class="callout-title">${title || type}</p><p>`);
  return h;
}

/* ───────────── Motor de plantillas tipo mustache ───────────── */

export function renderTemplate(tpl, ctx) {
  const sec = /\{\{([#^])\s*([\w]+)\s*\}\}([\s\S]*?)\{\{\/\s*\2\s*\}\}/g;
  let out = tpl, prev;
  do {
    prev = out;
    out = out.replace(sec, (m, kind, key, inner) => {
      const v = ctx[key];
      const truthy = Array.isArray(v) ? v.length > 0 : !!v;
      return (kind === '#' ? truthy : !truthy) ? inner : '';
    });
  } while (out !== prev);
  out = out.replace(/\{\{\s*([\w]+)\s*\}\}/g, (m, k) => (ctx[k] ?? '') + '');
  return out.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export const DEFAULT_TEMPLATE = `---
title: "{{titleYaml}}"
{{#originalTitle}}original_title: "{{originalTitleYaml}}"
{{/originalTitle}}type: {{typeKey}}
year: {{year}}
{{#releaseDate}}release_date: {{releaseDate}}
{{/releaseDate}}status: {{statusKey}}
rating: {{rating}}
genres: [{{genresYaml}}]
{{#creators}}creators: [{{creatorsYaml}}]
{{/creators}}{{#started}}started: {{started}}
{{/started}}{{#finished}}finished: {{finished}}
{{/finished}}{{#platform}}platform: "{{platform}}"
{{/platform}}{{#whereYaml}}streaming: [{{whereYaml}}]
{{/whereYaml}}{{#formatsYaml}}formats: [{{formatsYaml}}]
{{/formatsYaml}}{{#episodesProgress}}episodes_watched: "{{episodesProgress}}"
{{/episodesProgress}}cover: "{{cover}}"
{{#backdrop}}banner: "{{backdrop}}"
{{/backdrop}}{{#trailerUrl}}trailer: "{{trailerUrl}}"
{{/trailerUrl}}tags: [{{tagsYaml}}]
cssclasses: [veoleo, veoleo-{{typeKey}}]
veoleo_id: "{{id}}"
---

# {{emoji}} {{title}}{{#year}} ({{year}}){{/year}}

{{#cover}}![portada|260]({{cover}})
{{/cover}}
> [!veoleo-rating] {{stars}} · {{ratingText}}
> **{{typeLabel}}** · {{statusLabel}}{{#finished}} · 🗓 {{finishedHuman}}{{/finished}}{{#platform}} · 📺 {{platform}}{{/platform}}{{#formatsText}}
> {{formatsText}}{{/formatsText}}

{{#tagline}}*«{{tagline}}»*
{{/tagline}}
{{ficha}}

{{#overview}}> [!abstract]- Sinopsis
{{overviewQuote}}
{{/overview}}

## ✍️ Mi nota

{{#note}}{{note}}{{/note}}{{^note}}_Sin notas todavía._{{/note}}

{{#episodesSection}}## 📺 Episodios · {{episodesProgress}}

{{episodesSection}}
{{/episodesSection}}
{{#trailerEmbed}}## 🎬 Tráiler

{{trailerEmbed}}
{{/trailerEmbed}}
{{#soundtrack}}## 🎵 Banda sonora

{{soundtrackBlock}}
{{/soundtrack}}
{{#castList}}## 🎭 Reparto

{{castList}}
{{/castList}}
---
{{links}}

*Exportado desde Veoleo · {{exportedAt}}*
`;

export const PLACEHOLDERS = [
  ['title', 'Título'], ['originalTitle', 'Título original'], ['year', 'Año'], ['releaseDate', 'Fecha de estreno'], ['typeLabel', 'Tipo'], ['emoji', 'Emoji del tipo'],
  ['statusLabel', 'Estado'], ['rating', 'Nota (0-5)'], ['stars', 'Estrellas ★★★★½'], ['cover', 'URL portada'], ['backdrop', 'URL fondo'],
  ['overview', 'Sinopsis'], ['genres', 'Géneros'], ['creators', 'Creadores / autoría'], ['cast', 'Reparto'], ['platform', 'Plataforma'],
  ['where', 'Dónde verlo (streaming)'], ['started', 'Inicio'], ['finished', 'Fin'], ['formatsText', 'Leído/escuchado y dónde'],
  ['note', 'Tu nota'], ['trailerUrl', 'URL tráiler'], ['trailerEmbed', 'Tráiler embebido'], ['soundtrackBlock', 'Banda sonora'],
  ['episodesSection', 'Episodios con sinopsis'], ['episodesProgress', 'Progreso episodios'], ['nextEpisode', 'Próximo episodio'],
  ['ficha', 'Ficha técnica'], ['links', 'Enlaces'], ['tagsYaml', 'Etiquetas (YAML)'], ['id', 'ID Veoleo'],
];

/* ───────────── Contexto de una entrada ───────────── */

const yq = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const yamlList = (a) => (a || []).filter(Boolean).map((x) => `"${yq(x)}"`).join(', ');
const quote = (s) => String(s || '').split('\n').map((l) => '> ' + l).join('\n');
const tagify = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9/]+/g, '-').replace(/^-|-$/g, '');

function creatorsLabel(type) {
  return { series: 'Creada por', movie: 'Dirección', book: 'Autoría', audiobook: 'Autoría' }[type] || 'Autoría';
}

function fichaBlock(e) {
  const rows = [];
  const add = (k, v) => { if (v) rows.push(`> | ${k} | ${String(v).replace(/\|/g, '/')} |`); };
  add(creatorsLabel(e.type), (e.creators || []).join(', '));
  add('Géneros', (e.genres || []).join(', '));
  add('Estreno', e.releaseDate ? humanDate(e.releaseDate) : e.year);
  if (e.type === 'series') {
    add('Temporadas', e.seasons); add('Episodios', e.episodes); add('Cadena', e.network);
    add('Estado de la serie', e.showStatus);
    if (e.nextEpisode?.airdate) add('Próximo episodio', `${e.nextEpisode.code} · ${humanDate(e.nextEpisode.airdate)}`);
  }
  if (e.type === 'movie') add('Duración', fmtDuration(e.runtime));
  if (e.type === 'series' && e.runtime) add('Duración episodio', fmtDuration(e.runtime));
  add('Dónde verlo', platformsOf(e).join(', '));
  if (e.type === 'book' || e.type === 'audiobook') { add('Páginas', e.pages); add('Editorial', e.publisher); add('ISBN', e.isbn); add('Narración', e.narrator); }
  add('Compositor', e.composer);
  add('Idioma original', e.language);
  if (!rows.length) return '';
  return ['> [!info]- Ficha técnica', '> | | |', '> |---|---|', ...rows].join('\n');
}

function formatsText(e) {
  const c = e.consumption || {};
  const p = [];
  if (c.read) p.push(`📖 Leído${c.readOn ? ' en ' + c.readOn : ''}`);
  if (c.listened) p.push(`🎧 Escuchado${c.listenedOn ? ' en ' + c.listenedOn : ''}`);
  return p.join(' · ');
}

function soundtrackBlock(e) {
  const s = e.soundtrack;
  if (!s && !e.composer) return '';
  const lines = [];
  if (s) {
    lines.push(`> [!veoleo-music] ${s.album}`);
    lines.push(`> **${s.artist}**${s.year ? ' · ' + s.year : ''}${s.url ? ` · [Escuchar en Apple Music](${s.url})` : ''}`);
    if (s.artwork) lines.push(`> ![|120](${s.artwork})`);
    if (s.tracks?.length) {
      lines.push('>', '> | # | Pista | Duración |', '> |---|---|---|');
      for (const t of s.tracks.slice(0, 30)) {
        const mm = t.ms ? `${Math.floor(t.ms / 60000)}:${String(Math.floor((t.ms % 60000) / 1000)).padStart(2, '0')}` : '';
        lines.push(`> | ${t.n || ''} | ${String(t.name).replace(/\|/g, '/')} | ${mm} |`);
      }
    }
  }
  if (e.composer) lines.push(s ? '>' : '> [!veoleo-music] Banda sonora', `> 🎼 Compositor: **${e.composer}**`);
  return lines.join('\n');
}

export function episodesBlock(e, seasons, mode = 'all') {
  if (!seasons?.length) return '';
  const watched = new Set(e.watchedEpisodes || []);
  const out = [];
  for (const s of seasons) {
    const eps = mode === 'watched' ? s.episodes.filter((x) => watched.has(x.code)) : s.episodes;
    if (!eps.length) continue;
    const seen = s.episodes.filter((x) => watched.has(x.code)).length;
    const full = seen === s.episodes.length;
    out.push(`> [!veoleo-season]${full ? '-' : '+'} ${s.name} · ${seen}/${s.episodes.length} vistos`);
    for (const ep of eps) {
      out.push(`> - [${watched.has(ep.code) ? 'x' : ' '}] **${ep.code} · ${ep.name}**${ep.airdate ? ` — 📅 ${ep.airdate}` : ''}${ep.runtime ? ` · ${ep.runtime} min` : ''}`);
      if (ep.overview) out.push(`>   ${ep.overview.replace(/\n+/g, ' ')}`);
    }
    out.push('');
  }
  return out.join('\n').trim();
}

export function entryContext(e, note, { seasons = null, episodesMode = 'all' } = {}) {
  const T = TYPES[e.type] || TYPES.series;
  const yt = e.trailer?.youtube;
  const trailerUrl = yt ? `https://www.youtube.com/watch?v=${yt}` : e.trailer?.url || '';
  const tags = ['veoleo', `veoleo/${e.type}`, `estado/${tagify(statusLabel(e.status, e.type))}`, ...(e.genres || []).map((g) => `genero/${tagify(g)}`), ...(e.tags || []).map(tagify)];
  const watched = (e.watchedEpisodes || []).length;
  const totalEps = seasons ? seasons.reduce((a, s) => a + s.episodes.length, 0) : e.episodes || 0;
  const links = [
    e.externalUrl && `[Ficha en ${e.source?.name || 'origen'}](${e.externalUrl})`,
    e.imdbId && `[IMDb](https://www.imdb.com/title/${e.imdbId}/)`,
    e.wikiUrl && `[Wikipedia](${e.wikiUrl})`,
    e.homepage && `[Web oficial](${e.homepage})`,
    (e.type === 'series' || e.type === 'movie') && `[Decider · Stream It or Skip It](${deciderUrl(e)})`,
    (e.type === 'series' || e.type === 'movie') && `[Dónde verlo (JustWatch)](${e.providers?.link || justwatchUrl(e)})`,
  ].filter(Boolean).join(' · ');
  const castList = (e.cast || []).slice(0, 10).map((c) => `- **${c.name}**${c.role ? ` · ${c.role}` : ''}`).join('\n');
  const where = platformsOf(e);
  return {
    id: e.id || '', title: e.title, titleYaml: yq(e.title), originalTitle: e.originalTitle || '', originalTitleYaml: yq(e.originalTitle),
    year: e.year || '', releaseDate: e.releaseDate || '', typeKey: e.type, typeLabel: T.label, emoji: T.icon,
    statusKey: e.status, statusLabel: statusLabel(e.status, e.type),
    rating: e.rating || 0, stars: starsText(e.rating), ratingText: e.rating ? `${e.rating}/5` : 'Sin valorar',
    cover: e.cover || '', backdrop: e.backdrop || '', overview: e.overview || '', overviewQuote: quote(e.overview), tagline: e.tagline || '',
    genres: (e.genres || []).join(', '), genresYaml: yamlList(e.genres),
    creators: (e.creators || []).join(', '), creatorsYaml: yamlList(e.creators),
    cast: (e.cast || []).slice(0, 8).map((c) => c.name).join(', '), castList,
    platform: e.platform || '', where: where.join(', '), whereYaml: yamlList(where),
    started: e.startedAt || '', finished: e.finishedAt || '', startedHuman: humanDate(e.startedAt), finishedHuman: humanDate(e.finishedAt),
    formatsText: formatsText(e), formatsYaml: yamlList([e.consumption?.read && `leído${e.consumption.readOn ? ': ' + e.consumption.readOn : ''}`, e.consumption?.listened && `escuchado${e.consumption.listenedOn ? ': ' + e.consumption.listenedOn : ''}`]),
    note: note?.body?.trim() || '', tagsYaml: yamlList(tags),
    trailerUrl, trailerEmbed: yt ? `![](${trailerUrl})` : trailerUrl ? `[Ver tráiler](${trailerUrl})` : '',
    soundtrack: !!(e.soundtrack || e.composer), soundtrackBlock: soundtrackBlock(e), composer: e.composer || '',
    episodesSection: e.type === 'series' && episodesMode !== 'none' ? episodesBlock(e, seasons, episodesMode) : '',
    episodesProgress: e.type === 'series' && (watched || totalEps) ? `${watched}/${totalEps || '?'}` : '',
    nextEpisode: e.nextEpisode?.airdate ? `${e.nextEpisode.code} · ${humanDate(e.nextEpisode.airdate)}` : '',
    ficha: fichaBlock(e), links, exportedAt: new Date().toLocaleString('es-ES'),
  };
}

export function filenameFor(e, pattern = '{{title}} ({{year}})') {
  return safeFilename(pattern.replace(/\{\{\s*title\s*\}\}/g, e.title).replace(/\{\{\s*year\s*\}\}/g, e.year || 's.f.').replace(/\{\{\s*type\s*\}\}/g, TYPES[e.type]?.label || '').replace(/\s*\(\s*\)/g, '')) + '.md';
}

/* ───────────── Exportación ───────────── */

async function seasonsIfNeeded(e, settings) {
  const mode = settings.exportEpisodes || 'all';
  if (e.type !== 'series' || mode === 'none') return null;
  if (mode === 'watched' && !(e.watchedEpisodes || []).length) return null;
  try { return await getSeasons(e, settings); } catch { return null; }
}

export async function entryToMarkdown(e, note, settings = {}) {
  const seasons = await seasonsIfNeeded(e, settings);
  return renderTemplate(settings.mdTemplate || DEFAULT_TEMPLATE, entryContext(e, note, { seasons, episodesMode: settings.exportEpisodes || 'all' }));
}

export async function exportEntry(e, note, settings = {}) {
  const md = await entryToMarkdown(e, note, settings);
  download(filenameFor(e, settings.filenamePattern), md);
  return md;
}

const FOLDERS = { series: 'Series', movie: 'Películas', book: 'Libros', audiobook: 'Audiolibros' };

async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

export function indexNote(entries, lists = []) {
  const byType = (t) => entries.filter((e) => e.type === t);
  const lines = [
    '---', 'cssclasses: [veoleo, veoleo-index]', 'tags: [veoleo]', '---', '',
    '# 🎬 Veoleo · Índice', '',
    `> [!veoleo-rating] ${entries.length} entradas · exportado el ${new Date().toLocaleDateString('es-ES')}`,
    '> Las tablas dinámicas necesitan el plugin **Dataview**. Debajo tienes también un índice estático.', '',
  ];
  for (const t of Object.keys(FOLDERS)) {
    if (!byType(t).length) continue;
    lines.push(`## ${TYPES[t].icon} ${TYPES[t].plural}`, '', '```dataview',
      'TABLE WITHOUT ID ("![|60](" + cover + ")") AS " ", file.link AS Título, year AS Año, rating AS "★", status AS Estado, finished AS Fin',
      `FROM #veoleo/${t}`, 'SORT rating DESC, finished DESC', '```', '');
  }
  lines.push('## 📅 Por año', '', '```dataview', 'TABLE WITHOUT ID file.link AS Título, type AS Tipo, rating AS "★"', 'FROM #veoleo', 'WHERE finished', 'GROUP BY dateformat(date(finished), "yyyy") AS Año', '```', '');
  lines.push('## 🗂 Índice estático', '');
  for (const t of Object.keys(FOLDERS)) {
    const list = byType(t); if (!list.length) continue;
    lines.push(`### ${TYPES[t].plural}`, '');
    for (const e of list.sort((a, b) => (b.rating || 0) - (a.rating || 0))) {
      lines.push(`- [[${FOLDERS[t]}/${filenameFor(e).replace(/\.md$/, '')}|${e.title}]] ${e.year ? `(${e.year})` : ''} · ${starsText(e.rating)} · ${statusLabel(e.status, e.type)}`);
    }
    lines.push('');
  }
  if (lists.length) {
    lines.push('## 📋 Listas', '');
    for (const l of lists) lines.push(`- [[Listas/${safeFilename(l.name)}|${l.emoji || '📋'} ${l.name}]]`);
  }
  return lines.join('\n') + '\n';
}

export function listNote(list, items, pattern) {
  const lines = [
    '---', `title: "${yq(list.name)}"`, 'tags: [veoleo, veoleo/lista]', 'cssclasses: [veoleo, veoleo-list]', '---', '',
    `# ${list.emoji || '📋'} ${list.name}`, '',
  ];
  if (list.description) lines.push(`> ${list.description}`, '');
  if (list.rulesText) lines.push(`> [!veoleo-season] Lista automática`, `> ${list.rulesText}`, '');
  for (const e of items) {
    lines.push(`- [[${FOLDERS[e.type]}/${filenameFor(e, pattern).replace(/\.md$/, '')}|${e.title}]]${e.year ? ` (${e.year})` : ''} · ${TYPES[e.type]?.icon} · ${starsText(e.rating)}`);
  }
  return lines.join('\n') + '\n';
}

// Exportación masiva: .zip con carpetas por tipo, índice Dataview, listas y snippet CSS.
export async function bulkExportZip(entries, notesById, settings = {}, lists = [], onProgress = () => {}, zipName = 'Veoleo-Obsidian.zip') {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
  const zip = new window.JSZip();
  const root = zip.folder('Veoleo');
  let done = 0;
  await pool(entries, 4, async (e) => {
    const md = await entryToMarkdown(e, notesById[e.id], settings);
    root.folder(FOLDERS[e.type] || 'Otros').file(filenameFor(e, settings.filenamePattern), md);
    onProgress(++done, entries.length);
  });
  root.file('Veoleo · Índice.md', indexNote(entries, lists));
  for (const l of lists) {
    if (!l.items?.length) continue;
    root.folder('Listas').file(safeFilename(l.name) + '.md', listNote(l, l.items, settings.filenamePattern));
  }
  root.file('_snippet-veoleo.css', OBSIDIAN_CSS);
  root.file('LEEME.md', README_EXPORT);
  const blob = await zip.generateAsync({ type: 'blob' });
  download(zipName, blob, 'application/zip');
}

// Exportación masiva en un único .md.
export async function bulkExportSingle(entries, notesById, settings = {}, onProgress = () => {}, name = 'Veoleo.md') {
  const parts = [`# 🎬 Veoleo · ${entries.length} entradas\n\n*Exportado el ${new Date().toLocaleString('es-ES')}*\n`];
  let done = 0;
  const mds = await pool(entries, 4, async (e) => {
    const md = await entryToMarkdown(e, notesById[e.id], settings);
    onProgress(++done, entries.length);
    // sin frontmatter y con los títulos un nivel más abajo
    return md.replace(/^---[\s\S]*?---\n/, '').replace(/^(#{1,5}) /gm, '#$1 ');
  });
  download(name, parts.concat(mds).join('\n\n---\n\n'));
}

export const README_EXPORT = `# Cómo usar esta exportación en Obsidian

1. Copia la carpeta **Veoleo** dentro de tu bóveda.
2. Copia \`_snippet-veoleo.css\` a \`.obsidian/snippets/veoleo.css\` y actívalo en *Ajustes → Apariencia → Fragmentos CSS*.
3. (Opcional) Instala **Dataview** para las tablas dinámicas del índice y **Banners** para usar el fondo como banner.
`;

// Snippet CSS para que las notas se vean con estética cómic en Obsidian.
export const OBSIDIAN_CSS = `/* Veoleo · snippet para Obsidian */
.veoleo {
  --vl-ink: #16141f; --vl-paper: #fff8ec; --vl-red: #f2545b; --vl-yellow: #f9c846;
  --vl-teal: #2bb3a3; --vl-blue: #3b6cf6; --vl-pink: #ee7ba8; --vl-purple: #8e6cef;
}
.veoleo .inline-title, .veoleo h1 {
  font-family: "Bricolage Grotesque", "Arial Black", system-ui, sans-serif;
  font-weight: 800; font-size: 2.6em; letter-spacing: -0.02em; line-height: 1.02;
}
.veoleo h2 { font-weight: 800; border-bottom: 3px solid var(--vl-ink); padding-bottom: .15em; }
.theme-dark .veoleo h2 { border-color: currentColor; }
.veoleo img[alt="portada"] {
  float: right; margin: 0 0 1em 1.2em; border: 3px solid var(--vl-ink); border-radius: 12px;
  box-shadow: 6px 6px 0 var(--vl-ink); transform: rotate(1.5deg);
}
.veoleo .callout {
  border: 3px solid var(--vl-ink); border-radius: 14px; box-shadow: 5px 5px 0 var(--vl-ink);
  mix-blend-mode: normal;
}
.callout[data-callout="veoleo-rating"] { --callout-color: 249, 200, 70; --callout-icon: lucide-star; background: rgb(249 200 70 / .25); }
.callout[data-callout="veoleo-rating"] .callout-title-inner { font-size: 1.5em; letter-spacing: .08em; }
.callout[data-callout="veoleo-music"] { --callout-color: 238, 123, 168; --callout-icon: lucide-music; }
.callout[data-callout="veoleo-season"] { --callout-color: 59, 108, 246; --callout-icon: lucide-tv; }
.veoleo .callout[data-callout="abstract"] { --callout-color: 43, 179, 163; }
.veoleo .callout[data-callout="info"] { --callout-color: 142, 108, 239; }
.veoleo table { border: 2px solid var(--vl-ink); border-radius: 10px; overflow: hidden; }
.veoleo .task-list-item-checkbox:checked { background-color: var(--vl-teal); border-color: var(--vl-ink); }
.veoleo-series h1 { color: var(--vl-blue); }
.veoleo-movie h1 { color: var(--vl-red); }
.veoleo-book h1 { color: #d9a400; }
.veoleo-audiobook h1 { color: var(--vl-teal); }
`;

export function sortForExport(entries) {
  return [...entries].sort((a, b) => (toMillis(b.updatedAt) || 0) - (toMillis(a.updatedAt) || 0));
}
