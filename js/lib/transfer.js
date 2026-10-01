// Importación y exportación de datos: TV Time, Letterboxd, Goodreads, IMDb, copias Veoleo, CSV.
import { download, loadScript, normGenres, todayISO, uniq } from './utils.js';
import { epCode, searchMedia, showInfo, seriesStatusFor } from './metadata.js';
import { getNotesBulk, importEntries, saveNote, updateEntry } from './db.js';

/* ───────────── CSV ───────────── */

export function parseCSV(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = (rows.shift() || []).map((h) => h.trim());
  return rows.filter((r) => r.some((c) => c.trim())).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

const esc = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function toCSV(rows) {
  if (!rows.length) return '';
  const head = Object.keys(rows[0]);
  return [head.join(','), ...rows.map((r) => head.map((h) => esc(r[h])).join(','))].join('\n');
}

/* ───────────── Exportar ───────────── */

export async function exportJSON(entries, filename = 'Veoleo.json', lists = []) {
  const notes = await getNotesBulk(entries.map((e) => e.id));
  const clean = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v && typeof v === 'object' && typeof v.toMillis === 'function' ? new Date(v.toMillis()).toISOString() : v)));
  const data = { app: 'Veoleo', version: 1, exportedAt: new Date().toISOString(), entries: clean(entries), notes: clean(notes), lists: clean(lists) };
  download(filename, JSON.stringify(data, null, 2), 'application/json');
}

export function exportCSV(entries, filename = 'Veoleo.csv', format = 'generic') {
  let rows;
  if (format === 'letterboxd') {
    rows = entries.map((e) => ({ imdbID: e.ids?.imdb || e.imdbId || '', Title: e.title, Year: e.year || '', Rating: e.rating || '', WatchedDate: e.finishedAt || '', Rewatch: e.rewatch ? 'true' : 'false', Tags: (e.tags || []).join(', ') }));
  } else if (format === 'goodreads') {
    const shelf = { completed: 'read', in_progress: 'currently-reading', planned: 'to-read', abandoned: 'abandoned' };
    rows = entries.map((e) => ({ Title: e.title, Author: (e.creators || [])[0] || '', ISBN: e.isbn || '', 'My Rating': Math.round(e.rating || 0), 'Date Read': (e.finishedAt || '').replace(/-/g, '/'), 'Exclusive Shelf': shelf[e.status] || '', Shelves: shelf[e.status] || '', 'Number of Pages': e.pages || '', 'Year Published': e.year || '' }));
  } else if (format === 'trakt') {
    rows = [];
    for (const e of entries.filter((x) => x.type === 'series')) {
      for (const code of e.watchedEpisodes || []) {
        const m = code.match(/^S(\d+)E(\d+)$/); if (!m) continue;
        rows.push({ type: 'episode', title: e.title, year: e.year || '', imdb_id: e.ids?.imdb || e.imdbId || '', tvdb_id: e.ids?.tvdb || '', season: Number(m[1]), episode: Number(m[2]), watched_at: e.finishedAt || e.startedAt || '' });
      }
    }
    for (const e of entries.filter((x) => x.type === 'movie' && x.status === 'completed')) {
      rows.push({ type: 'movie', title: e.title, year: e.year || '', imdb_id: e.ids?.imdb || e.imdbId || '', tvdb_id: '', season: '', episode: '', watched_at: e.finishedAt || '' });
    }
  } else {
    rows = entries.map((e) => ({
      Title: e.title, Type: e.type, Status: e.status, Rating: e.rating || '', Year: e.year || '', Started: e.startedAt || '', Finished: e.finishedAt || '',
      Platform: e.platform || e.network || '', Read: e.consumption?.read ? 'yes' : '', ReadOn: e.consumption?.readOn || '', Listened: e.consumption?.listened ? 'yes' : '', ListenedOn: e.consumption?.listenedOn || '',
      Genres: (e.genres || []).join('; '), Creators: (e.creators || []).join('; '), EpisodesWatched: (e.watchedEpisodes || []).length || '', Episodes: e.episodes || '',
      Tags: (e.tags || []).join('; '), IMDb: e.ids?.imdb || e.imdbId || '', Visibility: e.visibility,
    }));
  }
  download(filename, '﻿' + toCSV(rows), 'text/csv;charset=utf-8');
}

/* ───────────── Importar ───────────── */

const pickCol = (row, names) => { for (const n of names) { const k = Object.keys(row).find((h) => h.toLowerCase() === n); if (k && row[k] !== '') return row[k]; } return ''; };
const isoDate = (s) => {
  if (!s) return '';
  const t = s.trim().replace(/\//g, '-');
  const m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  const d = new Date(s); return isNaN(d) ? '' : d.toISOString().slice(0, 10);
};
const base = (type, title, extra = {}) => ({
  type, title, year: null, cover: '', backdrop: '', overview: '', genres: [], creators: [], cast: [], status: 'completed', rating: 0,
  startedAt: '', finishedAt: '', platform: '', consumption: null, tags: [], visibility: 'public', watchedEpisodes: [], hasNote: false, notePublic: false,
  source: { name: 'import', id: '' }, ids: { tmdb: '', tvmaze: '', imdb: '', itunes: '' }, ...extra,
});

function detect(rows, filename = '') {
  const h = Object.keys(rows[0] || {}).map((x) => x.toLowerCase());
  const has = (...k) => k.every((x) => h.includes(x));
  if (has('letterboxd uri')) return 'letterboxd';
  if ((h.length <= 3 && has('title', 'date')) || /netflixviewinghistory|viewingactivity/i.test(filename)) return 'netflix';
  if (has('exclusive shelf') || (has('title', 'author') && h.includes('my rating'))) return 'goodreads';
  if (has('const', 'your rating') || has('const', 'title type')) return 'imdb';
  if (h.some((x) => /tv_show_name|series_name|show_name|episode_season_number|movie_name/.test(x)) || /tvtime|tv-time|tracking|seen_episode|followed/i.test(filename)) return 'tvtime';
  if (TITLE_COLS.some((c) => h.includes(c))) return 'generic';
  return '';
}

function fromLetterboxd(rows, filename) {
  const watchlist = /watchlist/i.test(filename);
  return rows.filter((r) => r.Name).map((r) => base('movie', r.Name, {
    year: Number(r.Year) || null, rating: Number(r.Rating) || 0, status: watchlist ? 'planned' : 'completed',
    finishedAt: watchlist ? '' : isoDate(r['Watched Date'] || r.Date), rewatch: /yes|true/i.test(r.Rewatch || '') ? 1 : 0,
    tags: (r.Tags || '').split(',').map((t) => t.trim()).filter(Boolean), externalUrl: r['Letterboxd URI'] || '', _note: r.Review || '',
  }));
}

function fromGoodreads(rows) {
  const st = { read: 'completed', 'currently-reading': 'in_progress', 'to-read': 'planned' };
  return rows.filter((r) => r.Title).map((r) => {
    const shelves = `${r['Exclusive Shelf'] || ''},${r.Bookshelves || ''}`.toLowerCase();
    const status = /abandon|dnf|did-not-finish/.test(shelves) ? 'abandoned' : st[(r['Exclusive Shelf'] || '').toLowerCase()] || 'completed';
    const isAudio = /audio/.test(shelves) || /audio/i.test(r.Binding || '');
    return base(isAudio ? 'audiobook' : 'book', r.Title.replace(/\s*\(.*#\d+\)$/, ''), {
      year: Number(r['Original Publication Year'] || r['Year Published']) || null, rating: Number(r['My Rating']) || 0, status,
      finishedAt: isoDate(r['Date Read']), startedAt: '', creators: uniq([r.Author, ...(r['Additional Authors'] || '').split(',').map((x) => x.trim())]),
      pages: Number(r['Number of Pages']) || null, publisher: r.Publisher || '', isbn: (r.ISBN13 || r.ISBN || '').replace(/[="]/g, ''),
      consumption: { read: !isAudio, listened: isAudio, readOn: '', listenedOn: '' }, _note: r['My Review'] || '',
      tags: (r.Bookshelves || '').split(',').map((t) => t.trim()).filter((t) => t && !/^(read|to-read|currently-reading)$/.test(t)),
    });
  });
}

function fromIMDb(rows) {
  const typeOf = (t) => (/tv(series|miniseries)/i.test(t.replace(/\s/g, '')) ? 'series' : /movie|video|short/i.test(t) ? 'movie' : '');
  return rows.map((r) => {
    const type = typeOf(r['Title Type'] || 'movie'); if (!type || !r.Title) return null;
    return base(type, r.Title, {
      year: Number(r.Year) || null, rating: r['Your Rating'] ? Math.round(Number(r['Your Rating'])) / 2 : 0,
      finishedAt: isoDate(r['Date Rated'] || r.Created), status: r['Your Rating'] ? 'completed' : 'planned',
      genres: normGenres((r.Genres || '').split(',')), creators: (r.Directors || '').split(',').map((x) => x.trim()).filter(Boolean),
      imdbId: r.Const, ids: { tmdb: '', tvmaze: '', imdb: r.Const || '', itunes: '' }, runtime: Number(r['Runtime (mins)']) || null,
    });
  }).filter(Boolean);
}

// TV Time (exportación de datos personales): episodios vistos + series y pelis seguidas.
function fromTVTime(fileRows) {
  const shows = new Map(); const movies = new Map();
  for (const { rows } of fileRows) {
    for (const r of rows) {
      const movie = pickCol(r, ['movie_name', 'movie_title']);
      if (movie || /movie/i.test(pickCol(r, ['entity_type', 'type']))) {
        const name = movie || pickCol(r, ['title', 'name']); if (!name) continue;
        const m = movies.get(name) || base('movie', name, { status: 'planned' });
        const watched = pickCol(r, ['watched_at', 'seen_at', 'created_at', 'updated_at']);
        if (/watch|seen/i.test(Object.keys(r).join(' ')) || pickCol(r, ['watched_at', 'seen_at'])) { m.status = 'completed'; m.finishedAt = isoDate(watched) || m.finishedAt; }
        movies.set(name, m);
        continue;
      }
      const name = pickCol(r, ['tv_show_name', 'series_name', 'show_name', 'series', 'show']);
      if (!name) continue;
      const s = shows.get(name) || base('series', name, { status: 'in_progress', _tvdb: '', _dates: [] });
      const tvdb = pickCol(r, ['tv_show_id', 'series_id', 'show_id', 'tvdb_id', 'show_tvdb_id']);
      if (tvdb && /^\d+$/.test(tvdb)) s._tvdb = tvdb;
      const se = Number(pickCol(r, ['episode_season_number', 'season_number', 'season']));
      const ep = Number(pickCol(r, ['episode_number', 'number', 'episode']));
      if (se >= 1 && ep >= 1) s.watchedEpisodes.push(epCode(se, ep));
      const d = isoDate(pickCol(r, ['created_at', 'watched_at', 'updated_at', 'date']));
      if (d) s._dates.push(d);
      if (/archiv|stopped/i.test(pickCol(r, ['status', 'archived', 'is_archived']))) s.status = 'abandoned';
      shows.set(name, s);
    }
  }
  const out = [];
  for (const s of shows.values()) {
    s.watchedEpisodes = uniq(s.watchedEpisodes).sort();
    if (!s.watchedEpisodes.length && s.status !== 'abandoned') s.status = 'planned';
    const ds = s._dates.sort();
    s.startedAt = ds[0] || ''; s.finishedAt = s.status === 'completed' ? ds[ds.length - 1] || '' : '';
    if (s._tvdb) s.ids = { ...s.ids, tvdb: s._tvdb };
    delete s._dates;
    out.push(s);
  }
  return [...out, ...movies.values()];
}

// Netflix: «Título: Temporada 2: Nombre del episodio» + fecha. Agrupa por serie y cuenta episodios por temporada.
const SEASON_RE = /^(temporada|season|parte|part|volumen|volume|libro|book|capítulo|chapter|serie limitada|limited series|miniserie|miniseries|colección|collection)\b\s*(\d+)?/i;
function netflixDate(s) {
  const m = String(s).match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (!m) return isoDate(s);
  let [, a, b, y] = m; a = +a; b = +b; y = +y; if (y < 100) y += 2000;
  const [d, mo] = a > 12 ? [a, b] : b > 12 ? [b, a] : [a, b]; // ambiguo → día/mes (formato español)
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
const EPISODE_RE = /^(episode|episodio|capítulo|capitulo|chapter|ep\.?)\s*\d+/i;
function fromNetflix(rows) {
  const shows = new Map(); const movies = new Map();
  const titleOf = (r) => String(r.Title || r.title || r.Título || '').trim();
  // Un mismo prefijo «Serie: …» que aparece varias veces es una serie aunque Netflix no ponga «Temporada»
  // (miniseries y series limitadas).
  const prefixCount = new Map();
  for (const r of rows) { const p = titleOf(r).split(': '); if (p.length > 1) prefixCount.set(p[0], (prefixCount.get(p[0]) || 0) + 1); }
  const addEp = (name, season, ep, date) => {
    const s = shows.get(name) || base('series', name, { status: 'in_progress', platform: 'Netflix', _nf: {}, _dates: [] });
    (s._nf[season] = s._nf[season] || new Set()).add(ep);
    if (date) s._dates.push(date);
    shows.set(name, s);
  };
  for (const r of rows) {
    const title = titleOf(r);
    const date = netflixDate(r.Date || r.date || r.Fecha || r['Start Time'] || '');
    if (!title) continue;
    const parts = title.split(': ');
    const si = parts.findIndex((p, i) => i > 0 && SEASON_RE.test(p));
    if (si > 0) {
      const m = parts[si].match(SEASON_RE);
      addEp(parts.slice(0, si).join(': '), m && m[2] ? Number(m[2]) : 1, parts.slice(si + 1).join(': ') || parts[si], date);
    } else if (parts.length > 1 && (prefixCount.get(parts[0]) >= 2 || EPISODE_RE.test(parts[1]))) {
      addEp(parts[0], 1, parts.slice(1).join(': '), date);
    } else {
      const mv = movies.get(title) || base('movie', title, { status: 'completed', platform: 'Netflix', finishedAt: date });
      if (date && (!mv.finishedAt || date > mv.finishedAt)) mv.finishedAt = date;
      movies.set(title, mv);
    }
  }
  const out = [];
  for (const s of shows.values()) {
    const ds = s._dates.sort();
    s.startedAt = ds[0] || ''; s.finishedAt = '';
    s._nfSeasons = Object.fromEntries(Object.entries(s._nf).map(([k, v]) => [k, v.size]));
    delete s._nf; delete s._dates;
    out.push(s);
  }
  return [...out, ...movies.values()];
}

// Historiales de otras plataformas (Prime Video, Apple TV…) o cualquier CSV con una columna de título.
const TITLE_COLS = ['title', 'título', 'titulo', 'title name', 'content title', 'program title', 'show title', 'nombre', 'name', 'película', 'pelicula', 'serie', 'series', 'contenido'];
const SERIES_COLS = ['series title', 'series name', 'show name', 'show', 'serie', 'nombre de la serie'];
const SEASON_COLS = ['season', 'season number', 'temporada'];
const EPISODE_COLS = ['episode title', 'episode name', 'episode', 'episodio', 'título del episodio'];
const DATE_COLS = ['date', 'fecha', 'start time', 'playback start', 'playback date', 'watched', 'watch date', 'last watched', 'date watched', 'event start timestamp', 'timestamp'];
export const PLATFORM_FILES = [
  [/prime|amazon/i, 'Prime Video'], [/apple|tv[ _-]?app|play[ _-]?activity/i, 'Apple TV+'], [/disney/i, 'Disney+'], [/hbo|\bmax\b/i, 'HBO Max'],
  [/movistar/i, 'Movistar Plus+'], [/filmin/i, 'Filmin'], [/skyshowtime/i, 'SkyShowtime'],
];
function fromGeneric(rows, filename, platform = '') {
  const keys = Object.keys(rows[0] || {});
  const col = (list) => keys.find((k) => list.includes(k.toLowerCase().trim()));
  const cT = col(TITLE_COLS), cS = col(SERIES_COLS), cSe = col(SEASON_COLS), cE = col(EPISODE_COLS), cD = col(DATE_COLS);
  const plat = platform || PLATFORM_FILES.find(([re]) => re.test(filename))?.[1] || '';
  const norm = rows.map((r) => {
    const series = cS ? String(r[cS] || '').trim() : '';
    const ep = cE ? String(r[cE] || '').trim() : '';
    const season = cSe ? String(r[cSe] || '').replace(/\D/g, '') : '';
    let title = series && ep ? `${series}: Season ${season || 1}: ${ep}` : String((cT && r[cT]) || series || '').trim();
    if (!series && ep && title && ep !== title) title = `${title}: Season ${season || 1}: ${ep}`;
    // «The Boys - Temporada 1 - Episodio 3» → formato Netflix.
    title = title.replace(/\s+[-–]\s+(?=(temporada|season|episodio|episode|cap[ií]tulo)\b)/gi, ': ');
    return { Title: title, Date: cD ? String(r[cD] || '').slice(0, 10) : '' };
  }).filter((r) => r.Title);
  return fromNetflix(norm).map((e) => ({ ...e, platform: plat }));
}
// Lista pegada a mano (una línea por título). Formatos: «Serie: Temporada 1: Episodio», «Película», «Título (2021)».
export function parseTitleList(text, platform = '') {
  const rows = String(text || '').split(/\r?\n/).map((l) => l.replace(/^[-*•\d.)\s]+(?=\D)/, '').trim()).filter(Boolean)
    .map((l) => ({ Title: l.replace(/\s+[-–]\s+(?=(temporada|season|episodio|episode|cap[ií]tulo)\b)/gi, ': '), Date: '' }));
  const items = fromNetflix(rows).map((e) => {
    const m = e.title.match(/^(.*)\s\((\d{4})\)$/);
    return { ...e, platform, ...(m ? { title: m[1], year: Number(m[2]) } : {}) };
  });
  return { format: platform || 'Lista', items };
}

async function readZip(file) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
  const zip = await window.JSZip.loadAsync(file);
  const out = [];
  for (const [name, f] of Object.entries(zip.files)) {
    if (f.dir || !/\.(csv|json)$/i.test(name)) continue;
    out.push({ name: name.split('/').pop(), text: await f.async('string') });
  }
  return out;
}

// Lee uno o varios ficheros (CSV, JSON o ZIP) y devuelve { format, items, notes, lists }.
export async function parseImport(files, { platform = '' } = {}) {
  let texts = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) texts.push(...await readZip(f));
    else texts.push({ name: f.name, text: await f.text() });
  }
  const json = texts.find((t) => /\.json$/i.test(t.name) && t.text.includes('"app"') && (t.text.includes('Veoleo') || t.text.includes('TVDaily')));
  if (json) {
    const d = JSON.parse(json.text);
    return { format: 'veoleo', items: (d.entries || []).map((e) => ({ ...e, _oldId: e.id })), notes: d.notes || {}, lists: d.lists || [] };
  }
  const csvs = texts.filter((t) => /\.csv$/i.test(t.name)).map((t) => ({ name: t.name, rows: parseCSV(t.text) })).filter((x) => x.rows.length);
  if (!csvs.length) throw new Error('No se han encontrado ficheros CSV o JSON reconocibles.');
  let formats = csvs.map((c) => detect(c.rows, c.name));
  // Si hay un formato conocido (TV Time, Netflix…), los demás CSV del ZIP no se importan como genéricos.
  if (formats.some((f) => f && f !== 'generic')) formats = formats.map((f) => (f === 'generic' ? '' : f));
  const items = [];
  const tv = csvs.filter((c, i) => formats[i] === 'tvtime');
  if (tv.length) items.push(...fromTVTime(tv));
  csvs.forEach((c, i) => {
    if (formats[i] === 'letterboxd') items.push(...fromLetterboxd(c.rows, c.name));
    if (formats[i] === 'netflix') items.push(...fromNetflix(c.rows));
    if (formats[i] === 'goodreads') items.push(...fromGoodreads(c.rows));
    if (formats[i] === 'imdb') items.push(...fromIMDb(c.rows));
    if (formats[i] === 'generic') items.push(...fromGeneric(c.rows, c.name, platform));
  });
  const fmt = uniq(formats.filter(Boolean).map((f) => (f === 'generic' ? (platform || PLATFORM_FILES.find(([re]) => csvs.some((c) => re.test(c.name)))?.[1] || 'CSV') : f)));
  if (!items.length) throw new Error('Formato no reconocido. Admite exportaciones de TV Time, Netflix, Letterboxd, Goodreads, IMDb y copias de Veoleo.');
  // Fusiona duplicados (p. ej. diary.csv + ratings.csv de Letterboxd).
  const merged = new Map();
  for (const it of items) {
    const k = `${it.type}|${it.title.toLowerCase()}|${it.year || ''}`;
    const prev = merged.get(k);
    if (!prev) { merged.set(k, it); continue; }
    merged.set(k, { ...prev, rating: it.rating || prev.rating, finishedAt: it.finishedAt || prev.finishedAt, status: prev.status === 'completed' ? prev.status : it.status,
      watchedEpisodes: uniq([...(prev.watchedEpisodes || []), ...(it.watchedEpisodes || [])]), _note: prev._note || it._note });
  }
  return { format: fmt.join(' + '), items: [...merged.values()], notes: {}, lists: [] };
}

// Título normalizado para detectar duplicados aunque cambien año, mayúsculas o signos («The Americans (2013)» = «The Americans»).
export const normTitle = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\(\d{4}\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export const dupKey = (e) => `${e.type}|${normTitle(e.title)}`;

export async function runImport(parsed, existing, { skipDuplicates = true } = {}, onProgress = () => {}) {
  const have = new Set(existing.map(dupKey));
  const todo = parsed.items.filter((e) => !skipDuplicates || !have.has(dupKey(e)));
  const clean = todo.map(({ id, _oldId, _note, _tvdb, _nfSeasons, ownerId, ownerName, ownerHandle, ownerPhoto, createdAt, updatedAt, ...rest }) => rest);
  onProgress('Guardando', 0, clean.length);
  const ids = await importEntries(clean, (d, t) => onProgress('Guardando', d, t));
  for (let i = 0; i < todo.length; i++) {
    const note = parsed.format === 'veoleo' ? parsed.notes[todo[i]._oldId]?.body : todo[i]._note;
    const pub = parsed.format === 'veoleo' ? !!parsed.notes[todo[i]._oldId]?.isPublic : false;
    if (note) await saveNote(ids[i], note, pub && todo[i].visibility === 'public').catch(() => {});
  }
  return todo.map((e, i) => ({ ...e, id: ids[i] }));
}

// Completa portada, ids y géneros de lo importado buscando cada título.
export async function autoEnrich(items, settings, onProgress = () => {}) {
  const queue = items.filter((e) => !e.cover || e.type === 'series');
  const total = queue.length;
  let done = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (queue.length) {
      const e = queue.shift();
      try {
        let hit = null;
        if (e.cover) { /* ya tiene ficha: sólo sincronizar episodios */ } else if (e.type === 'series' && e.ids?.tvdb) {
          const r = await fetch(`https://api.tvmaze.com/lookup/shows?thetvdb=${e.ids.tvdb}`);
          if (r.ok) { const s = await r.json(); hit = { cover: s.image?.original || s.image?.medium || '', tvmazeId: String(s.id), imdbId: s.externals?.imdb || '', year: s.premiered ? Number(s.premiered.slice(0, 4)) : null, genres: normGenres(s.genres), network: s.webChannel?.name || s.network?.name || '' }; }
        }
        if (!hit && !e.cover) {
          const res = await searchMedia(e.type, e.title, settings);
          hit = res.find((x) => normTitle(x.title) === normTitle(e.title) && (!e.year || !x.year || Math.abs(x.year - e.year) <= 1))
            || res.find((x) => !e.year || !x.year || Math.abs(x.year - e.year) <= 1) || res[0];
          // «Serie: Episodio» que Netflix lista sin temporada y se tomó por película: si la serie existe, se corrige.
          if (e.type === 'movie' && (!hit || normTitle(hit.title) !== normTitle(e.title))) {
            const prefix = e.title.includes(': ') ? e.title.split(': ')[0] : e.title;
            const show = (await searchMedia('series', prefix, settings).catch(() => [])).find((x) => normTitle(x.title) === normTitle(prefix));
            if (show) {
              const fix = { type: 'series', title: show.title, status: 'in_progress', finishedAt: '', startedAt: e.finishedAt || e.startedAt || '' };
              await updateEntry(e.id, fix); Object.assign(e, fix); hit = show;
            }
          }
        }
        if (hit) {
          const patch = {
            cover: (hit.cover || '').replace('http://', 'https://'), year: e.year || hit.year || null,
            genres: e.genres?.length ? e.genres : hit.genres || [], network: hit.network || e.network || '',
            creators: e.creators?.length ? e.creators : hit.creators || [], overview: hit.overview || '',
            ids: { ...(e.ids || {}), tvmaze: hit.tvmazeId || e.ids?.tvmaze || '', imdb: hit.imdbId || e.ids?.imdb || '', tmdb: hit.tmdbId || '', itunes: hit.itunesId || '' },
          };
          if (hit.source && hit.sourceId) patch.source = { name: hit.source, id: hit.sourceId };
          await updateEntry(e.id, patch);
          Object.assign(e, patch);
        }
        if (e.type === 'series') await syncImportedSeries(e);
      } catch (x) { console.warn('[Veoleo] enriquecer', e.title, x.message); }
      onProgress(++done, total);
    }
  }));
}

// Tras importar una serie: episodios de Netflix (primeros N de cada temporada), total, estado y próximo episodio.
async function syncImportedSeries(e) {
  const info = await showInfo(e).catch(() => null);
  if (!info) return;
  let watched = e.watchedEpisodes || [];
  if (e._nfSeasons) {
    const set = new Set(watched);
    for (const [season, n] of Object.entries(e._nfSeasons)) {
      info.episodes.filter((x) => x.season === Number(season)).slice(0, n).forEach((x) => set.add(x.code));
    }
    watched = [...set].sort();
  }
  const patch = { watchedEpisodes: watched, episodes: info.total, showStatus: info.status, nextEpisode: info.next || null,
    ids: { ...(e.ids || {}), tvmaze: info.tvmazeId, tvdb: e.ids?.tvdb || info.tvdbId || '', imdb: e.ids?.imdb || info.imdbId || '' } };
  if (!e.cover && info.cover) patch.cover = info.cover;
  const status = seriesStatusFor({ ...e, watchedEpisodes: watched }, info, watched);
  if (status !== e.status) { patch.status = status; if (status === 'completed' && !e.finishedAt) patch.finishedAt = e.startedAt || ''; }
  await updateEntry(e.id, patch);
}

// Exportación en el formato de la descarga de datos de TV Time (para quien mueve su historial entre apps).
export async function exportTVTime(entries, filename = 'Veoleo-formato-TVTime.zip') {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
  const zip = new window.JSZip();
  const seen = [], followed = [], movies = [];
  for (const e of entries.filter((x) => x.type === 'series')) {
    const tvdb = e.ids?.tvdb || '';
    followed.push({ tv_show_id: tvdb, tv_show_name: e.title, created_at: e.startedAt || '', status: e.status === 'abandoned' ? 'stopped' : e.status === 'completed' ? 'ended' : 'watching', imdb_id: e.ids?.imdb || e.imdbId || '' });
    for (const code of e.watchedEpisodes || []) {
      const m = code.match(/^S(\d+)E(\d+)$/); if (!m) continue;
      seen.push({ tv_show_id: tvdb, tv_show_name: e.title, episode_season_number: Number(m[1]), episode_number: Number(m[2]), created_at: e.finishedAt || e.startedAt || '' });
    }
  }
  for (const e of entries.filter((x) => x.type === 'movie')) {
    movies.push({ movie_name: e.title, year: e.year || '', imdb_id: e.ids?.imdb || e.imdbId || '', watched_at: e.status === 'completed' ? e.finishedAt || '' : '', status: e.status === 'planned' ? 'watchlist' : e.status === 'completed' ? 'watched' : e.status, rating: e.rating || '' });
  }
  zip.file('seen_episode.csv', '\uFEFF' + toCSV(seen));
  zip.file('followed_tv_show.csv', '\uFEFF' + toCSV(followed));
  zip.file('tracking-prod-records-movies.csv', '\uFEFF' + toCSV(movies));
  zip.file('LEEME.txt', 'Exportado desde Veoleo con la misma estructura que la descarga de datos de TV Time\n(seen_episode.csv, followed_tv_show.csv). tv_show_id es el identificador de TheTVDB.\n');
  download(filename, await zip.generateAsync({ type: 'blob' }), 'application/zip');
}

export const IMPORT_HELP = [
  { id: 'tvtime', name: 'TV Time', how: 'Pide tus datos en tvtime.com → Ajustes → «Solicitar mis datos» (GDPR). Recibirás un ZIP: súbelo tal cual o sus CSV.' },
  { id: 'netflix', name: 'Netflix', how: 'netflix.com → Cuenta → Perfiles → tu perfil → «Actividad de visionado» → «Descargar todo». Sube NetflixViewingHistory.csv.' },
  { id: 'letterboxd', name: 'Letterboxd', how: 'letterboxd.com → Settings → Import & Export → Export your data. Sube el ZIP o diary.csv / ratings.csv / watchlist.csv.' },
  { id: 'goodreads', name: 'Goodreads', how: 'goodreads.com → My Books → Import and export → Export Library. Sube goodreads_library_export.csv.' },
  { id: 'imdb', name: 'IMDb', how: 'imdb.com → Your ratings / Watchlist → Export. Sube el CSV.' },
  { id: 'prime', name: 'Prime Video', platform: 'Prime Video', how: 'amazon.es → Cuenta → «Solicitar mis datos» → Prime Video. Amazon te envía un ZIP: sube el CSV del historial de visionado (o el ZIP entero).' },
  { id: 'apple', name: 'Apple TV+', platform: 'Apple TV+', how: 'privacy.apple.com → «Obtener una copia de tus datos» → Apple Media Services. Sube el CSV de actividad de la app TV. También puedes pegar la lista.' },
  { id: 'disney', name: 'Disney+', platform: 'Disney+', paste: true, how: 'Disney+ no ofrece descarga del historial. Copia los títulos de «Seguir viendo» y tu lista y pégalos aquí, uno por línea.' },
  { id: 'hbo', name: 'HBO Max', platform: 'HBO Max', paste: true, how: 'HBO Max no permite descargar el historial. Pega los títulos que has visto, uno por línea («Serie: Temporada 1: Episodio» o solo el título).' },
  { id: 'movistar', name: 'Movistar Plus+', platform: 'Movistar Plus+', paste: true, how: 'Movistar Plus+ no tiene exportación. Pega la lista de lo que has visto, uno por línea; se marca con la plataforma Movistar Plus+.' },
  { id: 'filmin', name: 'Filmin', platform: 'Filmin', paste: true, how: 'Filmin no tiene exportación. Copia los títulos de «Vistas» o «Mi lista» y pégalos aquí, uno por línea.' },
  { id: 'skyshowtime', name: 'SkyShowtime', platform: 'SkyShowtime', paste: true, how: 'SkyShowtime no tiene exportación. Pega los títulos, uno por línea.' },
  { id: 'veoleo', name: 'Veoleo', how: 'Una copia de seguridad JSON exportada desde esta misma app (incluye notas).' },
];

export { todayISO };
