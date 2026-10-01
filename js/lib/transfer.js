// Importación y exportación de datos: TV Time, Letterboxd, Goodreads, IMDb, copias TVDaily, CSV.
import { download, loadScript, normGenres, todayISO, uniq } from './utils.js';
import { epCode, searchMedia } from './metadata.js';
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

export async function exportJSON(entries, filename = 'TVDaily.json', lists = []) {
  const notes = await getNotesBulk(entries.map((e) => e.id));
  const clean = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v && typeof v === 'object' && typeof v.toMillis === 'function' ? new Date(v.toMillis()).toISOString() : v)));
  const data = { app: 'TVDaily', version: 1, exportedAt: new Date().toISOString(), entries: clean(entries), notes: clean(notes), lists: clean(lists) };
  download(filename, JSON.stringify(data, null, 2), 'application/json');
}

export function exportCSV(entries, filename = 'TVDaily.csv', format = 'generic') {
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
  if (has('exclusive shelf') || (has('title', 'author') && h.includes('my rating'))) return 'goodreads';
  if (has('const', 'your rating') || has('const', 'title type')) return 'imdb';
  if (h.some((x) => /tv_show_name|series_name|show_name|episode_season_number|movie_name/.test(x)) || /tvtime|tv-time|tracking|seen_episode|followed/i.test(filename)) return 'tvtime';
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
export async function parseImport(files) {
  let texts = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) texts.push(...await readZip(f));
    else texts.push({ name: f.name, text: await f.text() });
  }
  const json = texts.find((t) => /\.json$/i.test(t.name) && t.text.includes('"app"') && t.text.includes('TVDaily'));
  if (json) {
    const d = JSON.parse(json.text);
    return { format: 'tvdaily', items: (d.entries || []).map((e) => ({ ...e, _oldId: e.id })), notes: d.notes || {}, lists: d.lists || [] };
  }
  const csvs = texts.filter((t) => /\.csv$/i.test(t.name)).map((t) => ({ name: t.name, rows: parseCSV(t.text) })).filter((x) => x.rows.length);
  if (!csvs.length) throw new Error('No se han encontrado ficheros CSV o JSON reconocibles.');
  const formats = csvs.map((c) => detect(c.rows, c.name));
  const items = [];
  const tv = csvs.filter((c, i) => formats[i] === 'tvtime');
  if (tv.length) items.push(...fromTVTime(tv));
  csvs.forEach((c, i) => {
    if (formats[i] === 'letterboxd') items.push(...fromLetterboxd(c.rows, c.name));
    if (formats[i] === 'goodreads') items.push(...fromGoodreads(c.rows));
    if (formats[i] === 'imdb') items.push(...fromIMDb(c.rows));
  });
  const fmt = uniq(formats.filter(Boolean));
  if (!items.length) throw new Error('Formato no reconocido. Admite exportaciones de TV Time, Letterboxd, Goodreads, IMDb y copias de TVDaily.');
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

export async function runImport(parsed, existing, { skipDuplicates = true } = {}, onProgress = () => {}) {
  const key = (e) => `${e.type}|${String(e.title).toLowerCase()}|${e.year || ''}`;
  const have = new Set(existing.map(key));
  const todo = parsed.items.filter((e) => !skipDuplicates || !have.has(key(e)));
  const clean = todo.map(({ id, _oldId, _note, _tvdb, ownerId, ownerName, ownerHandle, ownerPhoto, createdAt, updatedAt, ...rest }) => rest);
  onProgress('Guardando', 0, clean.length);
  const ids = await importEntries(clean);
  for (let i = 0; i < todo.length; i++) {
    const note = parsed.format === 'tvdaily' ? parsed.notes[todo[i]._oldId]?.body : todo[i]._note;
    const pub = parsed.format === 'tvdaily' ? !!parsed.notes[todo[i]._oldId]?.isPublic : false;
    if (note) await saveNote(ids[i], note, pub && todo[i].visibility === 'public').catch(() => {});
  }
  return todo.map((e, i) => ({ ...e, id: ids[i] }));
}

// Completa portada, ids y géneros de lo importado buscando cada título.
export async function autoEnrich(items, settings, onProgress = () => {}) {
  const queue = items.filter((e) => !e.cover);
  let done = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (queue.length) {
      const e = queue.shift();
      try {
        let hit = null;
        if (e.type === 'series' && e.ids?.tvdb) {
          const r = await fetch(`https://api.tvmaze.com/lookup/shows?thetvdb=${e.ids.tvdb}`);
          if (r.ok) { const s = await r.json(); hit = { cover: s.image?.original || s.image?.medium || '', tvmazeId: String(s.id), imdbId: s.externals?.imdb || '', year: s.premiered ? Number(s.premiered.slice(0, 4)) : null, genres: normGenres(s.genres), network: s.webChannel?.name || s.network?.name || '' }; }
        }
        if (!hit) {
          const res = await searchMedia(e.type, e.title, settings);
          hit = res.find((x) => !e.year || !x.year || Math.abs(x.year - e.year) <= 1) || res[0];
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
        }
      } catch (x) { console.warn('[TVDaily] enriquecer', e.title, x.message); }
      onProgress(++done, items.filter((x) => !x.cover).length);
    }
  }));
}

export const IMPORT_HELP = [
  { id: 'tvtime', name: 'TV Time', how: 'Pide tus datos en tvtime.com → Ajustes → «Solicitar mis datos» (GDPR). Recibirás un ZIP: súbelo tal cual o sus CSV.' },
  { id: 'letterboxd', name: 'Letterboxd', how: 'letterboxd.com → Settings → Import & Export → Export your data. Sube el ZIP o diary.csv / ratings.csv / watchlist.csv.' },
  { id: 'goodreads', name: 'Goodreads', how: 'goodreads.com → My Books → Import and export → Export Library. Sube goodreads_library_export.csv.' },
  { id: 'imdb', name: 'IMDb', how: 'imdb.com → Your ratings / Watchlist → Export. Sube el CSV.' },
  { id: 'tvdaily', name: 'TVDaily', how: 'Una copia de seguridad JSON exportada desde esta misma app (incluye notas).' },
];

export { todayISO };
