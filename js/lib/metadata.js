// Buscador de metadatos multi-fuente.
//  Series:      TMDB (si hay clave) · TVMaze · IMDb
//  Películas:   TMDB (si hay clave) · IMDb
//  Libros:      Google Books · Open Library
//  Audiolibros: Apple Books (iTunes) · Google Books
//  Extras:      Wikidata (tráiler de YouTube, compositor, géneros) · Wikipedia ES (sinopsis)
//               iTunes (banda sonora con previews de 30 s)
import { normGenres, stripHtml } from './utils.js';
import { SHARED_TMDB_KEY } from '../config.js';

const cache = new Map();
async function getJSON(url, opts = {}) {
  const { noCache, ...fetchOpts } = opts;
  const k = url + (fetchOpts.headers ? JSON.stringify(fetchOpts.headers) : '');
  if (!noCache && cache.has(k)) return cache.get(k);
  const p = fetch(url, fetchOpts).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status} · ${new URL(url).host}`);
    return r.json();
  });
  if (noCache) return p;
  cache.set(k, p);
  // Caché acotada: en móviles la memoria es limitada.
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  p.catch(() => cache.delete(k));
  return p;
}

// Memoriza resultados ya procesados durante un tiempo (no las respuestas en bruto).
const memo = new Map();
export async function memoize(key, ttlMs, fn) {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.t < ttlMs) return hit.p;
  const p = fn();
  memo.set(key, { t: Date.now(), p });
  p.catch(() => memo.delete(key));
  return p;
}
const yearOf = (d) => (d ? Number(String(d).slice(0, 4)) || null : null);
const https = (u) => (u ? String(u).replace(/^http:/, 'https:') : '');

export const SOURCES = {
  tmdb: { name: 'TMDB', color: 'var(--teal)' },
  tvmaze: { name: 'TVMaze', color: 'var(--blue)' },
  imdb: { name: 'IMDb', color: 'var(--yellow)' },
  google: { name: 'Google Books', color: 'var(--red)' },
  openlibrary: { name: 'Open Library', color: 'var(--purple)' },
  itunes: { name: 'Apple', color: 'var(--pink)' },
  manual: { name: 'Manual', color: 'var(--mint)' },
};

/* ───────────── TMDB ───────────── */

const TMDB_IMG = 'https://image.tmdb.org/t/p/';
function tmdbKey(settings) { return (settings?.tmdbKey || SHARED_TMDB_KEY || '').trim(); }
async function tmdb(path, params, key) {
  const bearer = key.length > 40;
  const u = new URL('https://api.themoviedb.org/3' + path);
  for (const [k, v] of Object.entries({ language: 'es-ES', ...params })) u.searchParams.set(k, v);
  if (!bearer) u.searchParams.set('api_key', key);
  return getJSON(u.toString(), bearer ? { headers: { Authorization: 'Bearer ' + key } } : {});
}
async function tmdbSearch(type, q, key) {
  const kind = type === 'series' ? 'tv' : 'movie';
  const d = await tmdb(`/search/${kind}`, { query: q, include_adult: 'false' }, key);
  return (d.results || []).slice(0, 16).map((r) => ({
    source: 'tmdb', sourceId: String(r.id), tmdbId: String(r.id), type,
    title: r.name || r.title, originalTitle: r.original_name || r.original_title,
    year: yearOf(r.first_air_date || r.release_date), releaseDate: r.first_air_date || r.release_date || '',
    cover: r.poster_path ? TMDB_IMG + 'w500' + r.poster_path : '',
    backdrop: r.backdrop_path ? TMDB_IMG + 'w1280' + r.backdrop_path : '',
    overview: r.overview || '',
  }));
}
async function tmdbDetails(type, id, key) {
  const kind = type === 'series' ? 'tv' : 'movie';
  const d = await tmdb(`/${kind}/${id}`, { append_to_response: 'videos,credits,external_ids', include_video_language: 'es,en,null' }, key);
  const vids = (d.videos?.results || []).filter((v) => v.site === 'YouTube');
  const trailer = vids.find((v) => v.type === 'Trailer' && v.iso_639_1 === 'es') || vids.find((v) => v.type === 'Trailer') || vids.find((v) => v.type === 'Teaser') || vids[0];
  const crew = d.credits?.crew || [];
  const creators = kind === 'tv'
    ? (d.created_by || []).map((c) => c.name)
    : crew.filter((c) => c.job === 'Director').map((c) => c.name);
  const composer = crew.filter((c) => /Original Music Composer|Music/.test(c.job)).map((c) => c.name)[0] || '';
  return {
    title: d.name || d.title, originalTitle: d.original_name || d.original_title,
    year: yearOf(d.first_air_date || d.release_date),
    cover: d.poster_path ? TMDB_IMG + 'w780' + d.poster_path : '',
    backdrop: d.backdrop_path ? TMDB_IMG + 'original' + d.backdrop_path : '',
    overview: d.overview || '', tagline: d.tagline || '',
    genres: normGenres((d.genres || []).map((g) => g.name)),
    creators: creators.slice(0, 6),
    cast: (d.credits?.cast || []).slice(0, 12).map((c) => ({ name: c.name, role: c.character || '', photo: c.profile_path ? TMDB_IMG + 'w185' + c.profile_path : '' })),
    runtime: d.runtime || d.episode_run_time?.[0] || null,
    seasons: d.number_of_seasons || null, episodes: d.number_of_episodes || null,
    network: d.networks?.[0]?.name || d.production_companies?.[0]?.name || '',
    language: d.original_language || '',
    imdbId: d.external_ids?.imdb_id || d.imdb_id || '',
    externalUrl: `https://www.themoviedb.org/${kind}/${id}`,
    homepage: d.homepage || '',
    trailer: trailer ? { youtube: trailer.key, name: trailer.name } : null,
    composer, tmdbId: String(id),
    releaseDate: d.first_air_date || d.release_date || '',
    lastAirDate: d.last_air_date || '',
    showStatus: d.status || '',
    nextEpisode: d.next_episode_to_air ? { code: epCode(d.next_episode_to_air.season_number, d.next_episode_to_air.episode_number), name: d.next_episode_to_air.name, airdate: d.next_episode_to_air.air_date } : null,
  };
}

/* ───────────── TVMaze ───────────── */

async function tvmazeSearch(q) {
  const d = await getJSON(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`);
  return d.slice(0, 14).map(({ show: s }) => ({
    source: 'tvmaze', sourceId: String(s.id), type: 'series',
    title: s.name, year: yearOf(s.premiered), releaseDate: s.premiered || '',
    cover: https(s.image?.medium || s.image?.original || ''),
    overview: stripHtml(s.summary), imdbId: s.externals?.imdb || '', tvmazeId: String(s.id), tvdbId: s.externals?.thetvdb ? String(s.externals.thetvdb) : '',
    network: s.network?.name || s.webChannel?.name || '',
  }));
}
async function tvmazeDetails(id) {
  const [s, imgs] = await Promise.all([
    getJSON(`https://api.tvmaze.com/shows/${id}?embed[]=cast&embed[]=crew&embed[]=seasons&embed[]=nextepisode`),
    getJSON(`https://api.tvmaze.com/shows/${id}/images`).catch(() => []),
  ]);
  const bg = imgs.find((i) => i.type === 'background' && i.main) || imgs.find((i) => i.type === 'background');
  const seasons = s._embedded?.seasons || [];
  const nx = s._embedded?.nextepisode;
  return {
    nextEpisode: nx ? { code: epCode(nx.season, nx.number || 0), name: nx.name, airdate: nx.airdate } : null,
    title: s.name, year: yearOf(s.premiered),
    cover: https(s.image?.original || ''),
    backdrop: https(bg?.resolutions?.original?.url || ''),
    overview: stripHtml(s.summary),
    genres: normGenres(s.genres),
    creators: (s._embedded?.crew || []).filter((c) => c.type === 'Creator').map((c) => c.person.name).slice(0, 5),
    cast: (s._embedded?.cast || []).slice(0, 12).map((c) => ({ name: c.person.name, role: c.character?.name || '', photo: https(c.person.image?.medium || '') })),
    runtime: s.averageRuntime || s.runtime || null,
    seasons: seasons.length || null,
    episodes: seasons.reduce((a, x) => a + (x.episodeOrder || 0), 0) || null,
    network: s.network?.name || s.webChannel?.name || '',
    language: s.language || '',
    imdbId: s.externals?.imdb || '',
    externalUrl: s.url, homepage: s.officialSite || '',
    showStatus: s.status, tvmazeId: String(id), tvdbId: s.externals?.thetvdb ? String(s.externals.thetvdb) : '',
    releaseDate: s.premiered || '', lastAirDate: s.ended || '',
  };
}

/* ───────────── IMDb (sugerencias vía JSONP, sin clave) ───────────── */

let jsonpN = 0;
function imdbSuggest(q) {
  const clean = q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!clean) return Promise.resolve([]);
  const key = 'imdb:' + clean;
  if (cache.has(key)) return cache.get(key);
  // El servidor llama a imdb$<1ª palabra>_<resto con %20>: registramos variantes.
  const sp = clean.split(' ');
  const names = new Set([
    'imdb$' + (sp.length > 1 ? sp[0] + '_' + sp.slice(1).join('%20') : clean),
    'imdb$' + clean.replace(/ /g, '_'),
    'imdb$' + clean.replace(/ /g, '%20'),
  ]);
  const p = new Promise((resolve) => {
    const id = ++jsonpN;
    const s = document.createElement('script');
    let done = false;
    const finish = (data) => {
      if (done) return; done = true;
      names.forEach((n) => { try { delete window[n]; } catch { window[n] = undefined; } });
      s.remove();
      resolve(data?.d || []);
    };
    names.forEach((n) => { window[n] = finish; });
    s.src = `https://sg.media-imdb.com/suggests/${clean[0]}/${encodeURIComponent(clean)}.json?_=${id}`;
    s.onerror = () => finish(null);
    setTimeout(() => finish(null), 7000);
    document.head.appendChild(s);
  });
  cache.set(key, p);
  return p;
}
function imdbImg(i, w = 600) {
  const u = Array.isArray(i) ? i[0] : i?.imageUrl;
  return u ? u.replace(/\._V1_.*\.jpg$/, `._V1_SX${w}.jpg`) : '';
}
async function imdbSearch(type, q) {
  // El servidor de IMDb genera un callback JS inválido si la consulta tiene espacios.
  if (/\s/.test(q.trim())) return [];
  const d = await imdbSuggest(q);
  const ok = type === 'series' ? ['tvSeries', 'tvMiniSeries'] : ['movie', 'tvMovie', 'video', 'short'];
  return d.filter((r) => /^tt/.test(r.id) && ok.includes(r.qid)).map((r) => ({
    source: 'imdb', sourceId: r.id, type, title: r.l, year: r.y || null,
    cover: imdbImg(r.i), imdbId: r.id, stars: r.s || '',
  }));
}

/* ───────────── Wikidata + Wikipedia ───────────── */

// Búsqueda de películas/series en Wikidata (CORS abierto) con póster de IMDb por su id.
export async function wikidataSearch(type, q) {
  const re = type === 'series' ? /serie|series|televisi|miniserie|sitcom|anime/i : /película|film|movie|largometraje|documental|cortometraje/i;
  const res = await Promise.all(['es', 'en'].map((l) => getJSON(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(q)}&language=${l}&uselang=es&type=item&limit=15&format=json&origin=*`).catch(() => ({ search: [] }))));
  const hits = res.flatMap((r) => r.search || []).filter((x) => re.test(x.description || ''));
  const ids = [...new Set(hits.map((x) => x.id))].slice(0, 14);
  if (!ids.length) return [];
  const sparql = `SELECT ?item ?itemLabel ?imdb ?date ?dirLabel WHERE { VALUES ?item { ${ids.map((i) => 'wd:' + i).join(' ')} } ?item wdt:P345 ?imdb . OPTIONAL { ?item wdt:P577 ?date } OPTIONAL { ?item wdt:P57 ?dir } SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". } }`;
  const d = await getJSON('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql)).catch(() => null);
  const by = new Map();
  for (const r of d?.results?.bindings || []) {
    const id = r.item.value.split('/').pop();
    const cur = by.get(id) || { id, title: r.itemLabel?.value, imdb: r.imdb?.value, years: [], dirs: [] };
    if (r.date?.value) cur.years.push(Number(r.date.value.slice(0, 4)));
    if (r.dirLabel?.value && !cur.dirs.includes(r.dirLabel.value)) cur.dirs.push(r.dirLabel.value);
    by.set(id, cur);
  }
  const rows = ids.map((i) => by.get(i)).filter((x) => x && /^tt\d+$/.test(x.imdb || ''));
  const posters = await Promise.all(rows.map((x) => imdbSuggest(x.imdb).then((r) => r[0]).catch(() => null)));
  return rows.map((x, i) => ({
    source: 'imdb', sourceId: x.imdb, type, imdbId: x.imdb, wikidata: x.id,
    title: x.title, year: x.years.length ? Math.min(...x.years) : posters[i]?.y || null,
    cover: imdbImg(posters[i]?.i), creators: x.dirs.slice(0, 3), stars: posters[i]?.s || '',
  }));
}

function cleanWdGenre(g) {
  return g.replace(/^(película|cine|serie de televisión|serie|telenovela|programa de televisión)( de| del)?\s*/i, '')
    .replace(/\s*(film|television series)$/i, '').trim();
}
export async function wikidataByImdb(imdbId) {
  if (!imdbId) return null;
  const sparql = `SELECT ?yt ?composerLabel ?directorLabel ?genreLabel ?duration ?esTitle ?enTitle WHERE {
    ?item wdt:P345 "${imdbId}" .
    OPTIONAL { ?item wdt:P1651 ?yt }
    OPTIONAL { ?item wdt:P86 ?composer }
    OPTIONAL { ?item wdt:P57 ?director }
    OPTIONAL { ?item wdt:P136 ?genre }
    OPTIONAL { ?item wdt:P2047 ?duration }
    OPTIONAL { ?es schema:about ?item ; schema:isPartOf <https://es.wikipedia.org/> ; schema:name ?esTitle }
    OPTIONAL { ?en schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?enTitle }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
  } LIMIT 300`;
  const d = await getJSON('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql));
  const rows = d.results?.bindings || [];
  if (!rows.length) return null;
  const col = (k) => [...new Set(rows.map((r) => r[k]?.value).filter(Boolean))];
  return {
    youtube: col('yt')[0] || '',
    composers: col('composerLabel').filter((x) => !/^Q\d+$/.test(x)),
    directors: col('directorLabel').filter((x) => !/^Q\d+$/.test(x)),
    genres: normGenres(col('genreLabel').filter((x) => !/^Q\d+$/.test(x)).map(cleanWdGenre)),
    duration: Number(col('duration')[0]) || null,
    esTitle: col('esTitle')[0] || '',
    enTitle: col('enTitle')[0] || '',
  };
}
async function wikiSummary(lang, title) {
  if (!title) return null;
  try {
    const d = await getJSON(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
    return { extract: d.extract || '', url: d.content_urls?.desktop?.page || '', image: d.originalimage?.source || '' };
  } catch { return null; }
}

/* ───────────── iTunes: banda sonora y audiolibros ───────────── */

const itunesArt = (u, s = 600) => (u ? u.replace(/\/\d+x\d+bb\./, `/${s}x${s}bb.`) : '');

export async function findSoundtrack(title, year, composerHint = '') {
  if (!title) return null;
  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const t = norm(title);
  const kw = /(soundtrack|score|music from|original|banda sonora|\bost\b|bso|motion picture|series)/;
  let best = null, bestScore = 0;
  for (const term of [`${title} soundtrack`, `${title} original score`, title]) {
    let d;
    try { d = await getJSON(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=album&limit=15`); }
    catch { continue; }
    for (const a of d.results || []) {
      const n = norm(a.collectionName);
      let s = 0;
      if (n.includes(t)) s += 3;
      if (kw.test(n)) s += 3;
      if (composerHint && norm(a.artistName).includes(norm(composerHint).split(' ').pop())) s += 3;
      const y = yearOf(a.releaseDate);
      if (year && y && Math.abs(y - year) <= 1) s += 2;
      if (s > bestScore) { bestScore = s; best = a; }
    }
    if (bestScore >= 8) break;
  }
  if (!best || bestScore < 6) return null;
  let tracks = [];
  try {
    const l = await getJSON(`https://itunes.apple.com/lookup?id=${best.collectionId}&entity=song&limit=60`);
    tracks = (l.results || []).filter((r) => r.wrapperType === 'track').map((r) => ({
      n: r.trackNumber, name: r.trackName, artist: r.artistName, ms: r.trackTimeMillis || 0, preview: r.previewUrl || '',
    }));
  } catch { /* sin pistas */ }
  return {
    album: best.collectionName, artist: best.artistName, artwork: itunesArt(best.artworkUrl100),
    year: yearOf(best.releaseDate), url: best.collectionViewUrl, tracks: tracks.slice(0, 50),
  };
}

async function itunesAudiobooks(q, country = 'es') {
  const d = await getJSON(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=audiobook&limit=16&country=${country.toLowerCase()}`);
  return (d.results || []).map((r) => ({
    source: 'itunes', sourceId: String(r.collectionId), type: 'audiobook',
    title: r.collectionName, year: yearOf(r.releaseDate),
    cover: itunesArt(r.artworkUrl100), creators: [r.artistName],
    overview: stripHtml(r.description), genres: normGenres([r.primaryGenreName]),
    audioPreview: r.previewUrl || '', externalUrl: r.collectionViewUrl,
  }));
}

/* ───────────── Libros ───────────── */

function gbCover(v) {
  const u = v.imageLinks?.extraLarge || v.imageLinks?.large || v.imageLinks?.medium || v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail;
  if (!u) return '';
  return https(u).replace('&edge=curl', '').replace(/&zoom=\d/, '&zoom=1') + '&fife=w800';
}
function gbMap(it, type) {
  const v = it.volumeInfo || {};
  const isbn = (v.industryIdentifiers || []).find((x) => x.type === 'ISBN_13')?.identifier || (v.industryIdentifiers || [])[0]?.identifier || '';
  return {
    source: 'google', sourceId: it.id, type,
    title: v.subtitle && v.title.length < 30 ? `${v.title}: ${v.subtitle}` : v.title,
    year: yearOf(v.publishedDate), cover: gbCover(v), creators: v.authors || [],
    overview: stripHtml(v.description || ''), genres: normGenres((v.categories || []).flatMap((c) => c.split('/'))).filter((g) => g !== 'General'),
    pages: v.pageCount || null, publisher: v.publisher || '', language: v.language || '', isbn,
    externalUrl: https(v.infoLink || v.canonicalVolumeLink || ''),
  };
}
async function googleBooks(q, type) {
  const d = await getJSON(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=16&printType=books`);
  return (d.items || []).map((it) => gbMap(it, type));
}
async function googleDetails(id, type) {
  const d = await getJSON(`https://www.googleapis.com/books/v1/volumes/${id}`);
  return gbMap(d, type);
}
async function openLibrary(q, type) {
  const d = await getJSON(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=14&fields=key,title,author_name,first_publish_year,cover_i,subject,number_of_pages_median,isbn,publisher,language`);
  return (d.docs || []).map((r) => ({
    source: 'openlibrary', sourceId: r.key, type,
    title: r.title, year: r.first_publish_year || null,
    cover: r.cover_i ? `https://covers.openlibrary.org/b/id/${r.cover_i}-L.jpg` : '',
    creators: (r.author_name || []).slice(0, 4),
    genres: normGenres((r.subject || []).slice(0, 5)),
    pages: r.number_of_pages_median || null, publisher: r.publisher?.[0] || '', isbn: r.isbn?.[0] || '',
    externalUrl: `https://openlibrary.org${r.key}`,
  }));
}
async function openLibraryDetails(key) {
  const d = await getJSON(`https://openlibrary.org${key}.json`);
  const desc = typeof d.description === 'string' ? d.description : d.description?.value || '';
  return { overview: desc.replace(/\(\[source\]\[\d+\]\)|\[\d+\]: .*$/gms, '').trim(), genres: normGenres((d.subjects || []).slice(0, 6)) };
}

/* ───────────── API pública ───────────── */

function interleave(...lists) {
  const out = []; const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
}
function dedupe(list) {
  const seen = new Set();
  return list.filter((r) => {
    const keys = [`t:${String(r.title).toLowerCase().trim()}|${r.year || ''}`];
    if (r.imdbId) keys.push('i:' + r.imdbId);
    if (keys.some((k) => seen.has(k))) return false;
    keys.forEach((k) => seen.add(k)); return true;
  });
}

export async function searchMedia(type, q, settings = {}) {
  q = String(q || '').trim();
  if (q.length < 2) return [];
  const key = tmdbKey(settings);
  const safe = (p) => p.catch((e) => { console.warn('[TVDaily] fuente falló:', e.message); return []; });
  let lists = [];
  if (type === 'series') lists = await Promise.all([key ? safe(tmdbSearch('series', q, key)) : [], safe(tvmazeSearch(q)), safe(imdbSearch('series', q))]);
  else if (type === 'movie') lists = await Promise.all([key ? safe(tmdbSearch('movie', q, key)) : [], safe(imdbSearch('movie', q)), safe(wikidataSearch('movie', q))]);
  else if (type === 'book') lists = await Promise.all([safe(googleBooks(q, 'book')), safe(openLibrary(q, 'book'))]);
  else if (type === 'audiobook') lists = await Promise.all([safe(itunesAudiobooks(q, settings.region || 'ES')), safe(googleBooks(q, 'audiobook'))]);
  return dedupe(type === 'series' && !key ? [...lists[1], ...lists[2]] : interleave(...lists)).slice(0, 30);
}

// Completa un resultado con todos los datos posibles: ficha, tráiler, banda sonora...
export async function enrich(r, settings = {}, onProgress = () => {}) {
  const key = tmdbKey(settings);
  let d = { ...r };
  const merge = (x) => { if (!x) return; for (const [k, v] of Object.entries(x)) if (v && (!Array.isArray(v) || v.length) && !d[k]) d[k] = v; };
  const over = (x) => { if (!x) return; for (const [k, v] of Object.entries(x)) if (v && (!Array.isArray(v) || v.length)) d[k] = v; };

  try {
    if (r.source === 'tmdb') over(await tmdbDetails(r.type, r.sourceId, key));
    else if (r.source === 'tvmaze') over(await tvmazeDetails(r.sourceId));
    else if (r.source === 'google') over(await googleDetails(r.sourceId, r.type));
    else if (r.source === 'openlibrary') merge(await openLibraryDetails(r.sourceId));
    else if (r.source === 'itunes' && r.type === 'movie') over(await itunesMovieDetails(r.sourceId, (settings.region || 'es').toLowerCase()));
  } catch (e) { console.warn('[TVDaily] detalles', e.message); }
  onProgress({ ...d });

  if (r.type === 'series' || r.type === 'movie') {
    // Si venía de IMDb/TVMaze y hay TMDB, intentamos cruzar por IMDb id para traer fondos y tráiler.
    if (key && d.imdbId && r.source !== 'tmdb') {
      try {
        const f = await tmdb(`/find/${d.imdbId}`, { external_source: 'imdb_id' }, key);
        const hit = (r.type === 'series' ? f.tv_results : f.movie_results)?.[0];
        if (hit) { merge(await tmdbDetails(r.type, hit.id, key)); d.tmdbId = String(hit.id); }
      } catch { /* sin cruce */ }
    }
    if (!d.imdbId) {
      let hits = await imdbSearch(r.type, d.originalTitle || d.title).catch(() => []);
      if (!hits.length) hits = await wikidataSearch(r.type, d.originalTitle || d.title).catch(() => []);
      const h = hits.find((x) => !d.year || !x.year || Math.abs(x.year - d.year) <= 1);
      if (h) { d.imdbId = h.imdbId; if (!d.cover) d.cover = h.cover; }
    }
    const wd = await wikidataByImdb(d.imdbId).catch(() => null);
    if (wd) {
      if (!d.trailer && wd.youtube) d.trailer = { youtube: wd.youtube };
      if (!d.composer && wd.composers[0]) d.composer = wd.composers.join(', ');
      if (!d.creators?.length && wd.directors.length) d.creators = wd.directors;
      if (!d.genres?.length && wd.genres.length) d.genres = wd.genres;
      if (!d.runtime && wd.duration) d.runtime = wd.duration;
      // Sinopsis en español desde Wikipedia si no tenemos una en español.
      const needEs = !d.overview || (r.source !== 'tmdb' && !/[áéíóúñ¿¡]/i.test(d.overview));
      if (needEs) {
        const es = await wikiSummary('es', wd.esTitle);
        if (es?.extract) { d.overview = es.extract; d.wikiUrl = es.url; }
        else if (!d.overview) { const en = await wikiSummary('en', wd.enTitle); if (en?.extract) { d.overview = en.extract; d.wikiUrl = en.url; } }
      }
    }
    if (key && d.tmdbId) d.providers = await watchProviders(r.type, d.tmdbId, settings).catch(() => null);
    onProgress({ ...d });
    d.soundtrack = await findSoundtrack(d.originalTitle || d.title, d.year, d.composer).catch(() => null);
    if (!d.soundtrack && d.originalTitle && d.originalTitle !== d.title) d.soundtrack = await findSoundtrack(d.title, d.year, d.composer).catch(() => null);
    if (!d.backdrop) d.backdrop = '';
  }
  if (r.type === 'audiobook' && !d.audioPreview && r.source !== 'itunes') {
    try {
      const a = await itunesAudiobooks(`${d.title} ${d.creators?.[0] || ''}`);
      const hit = a.find((x) => x.title.toLowerCase().includes(String(d.title).toLowerCase().slice(0, 12)));
      if (hit) { d.audioPreview = hit.audioPreview; if (!d.cover) d.cover = hit.cover; }
    } catch { /* sin preview */ }
  }
  d.genres = normGenres(d.genres || []);
  onProgress({ ...d });
  return d;
}

// Campos que guardamos en Firestore a partir de un resultado enriquecido.
export function toEntryFields(d) {
  return {
    type: d.type, title: d.title || 'Sin título', originalTitle: d.originalTitle && d.originalTitle !== d.title ? d.originalTitle : '',
    year: d.year || null, cover: d.cover || '', backdrop: d.backdrop || '', overview: d.overview || '', tagline: d.tagline || '',
    genres: d.genres || [], creators: d.creators || [], cast: (d.cast || []).slice(0, 12),
    runtime: d.runtime || null, seasons: d.seasons || null, episodes: d.episodes || null, pages: d.pages || null,
    network: d.network || '', publisher: d.publisher || '', language: d.language || '', isbn: d.isbn || '',
    imdbId: d.imdbId || '', composer: d.composer || '', narrator: d.narrator || '',
    trailer: d.trailer || null, soundtrack: d.soundtrack || null, audioPreview: d.audioPreview || '',
    externalUrl: d.externalUrl || '', homepage: d.homepage || '', wikiUrl: d.wikiUrl || '',
    releaseDate: d.releaseDate || '', lastAirDate: d.lastAirDate || '', showStatus: d.showStatus || '',
    nextEpisode: d.nextEpisode || null, providers: d.providers || null,
    source: { name: d.source || 'manual', id: d.sourceId || '' },
    ids: { tmdb: d.tmdbId || (d.source === 'tmdb' ? d.sourceId : '') || '', tvmaze: d.tvmazeId || (d.source === 'tvmaze' ? d.sourceId : '') || '', imdb: d.imdbId || '', itunes: d.itunesId || (d.source === 'itunes' ? d.sourceId : '') || '', tvdb: d.tvdbId || '' },
  };
}

export function hasTmdb(settings) { return !!tmdbKey(settings); }

export const deciderUrl = (e) => `https://decider.com/?s=${encodeURIComponent(`stream it or skip it ${e.title}`)}`;
export const justwatchUrl = (e) => `https://www.justwatch.com/es/buscar?q=${encodeURIComponent(e.title)}`;

/* ───────────── Dónde verlo (TMDB · datos de JustWatch) ───────────── */

export async function watchProviders(type, tmdbId, settings = {}, region = settings.region || 'ES') {
  const key = tmdbKey(settings);
  if (!key || !tmdbId) return null;
  const kind = type === 'series' ? 'tv' : 'movie';
  const d = await tmdb(`/${kind}/${tmdbId}/watch/providers`, {}, key);
  const r = d.results?.[region];
  if (!r) return { region, flatrate: [], rent: [], buy: [], link: '' };
  const map = (a) => (a || []).slice(0, 8).map((p) => ({ name: p.provider_name, logo: p.logo_path ? TMDB_IMG + 'w92' + p.logo_path : '' }));
  return { region, link: r.link || '', flatrate: map(r.flatrate || r.free || r.ads), rent: map(r.rent), buy: map(r.buy) };
}

// Plataformas en texto para mostrar/filtrar (streaming primero, si no la cadena).
export function platformsOf(e) {
  const p = e.providers?.flatrate?.map((x) => x.name) || [];
  return p.length ? p : e.network ? [e.network] : [];
}

/* ───────────── Novedades y recomendaciones ───────────── */

function tmdbCard(r, type) {
  return {
    source: 'tmdb', sourceId: String(r.id), type, tmdbId: String(r.id),
    title: r.name || r.title, year: yearOf(r.first_air_date || r.release_date), releaseDate: r.first_air_date || r.release_date || '',
    cover: r.poster_path ? TMDB_IMG + 'w500' + r.poster_path : '', backdrop: r.backdrop_path ? TMDB_IMG + 'w1280' + r.backdrop_path : '',
    overview: r.overview || '', score: r.vote_average || null,
  };
}

/* ───────────── Apple (rankings con CORS, sin clave) ───────────── */

const appleImg = (u, w = 600, h = 900) => (u ? u.replace(/\/\d+x\d+bb\.(png|jpg)$/, `/${w}x${h}bb.jpg`) : '');
const APPLE_FEEDS = { movie: 'topmovies', audiobook: 'topaudiobooks', book: 'toppaidebooks' };

export async function appleTop(type, country = 'es', limit = 40) {
  const d = await getJSON(`https://itunes.apple.com/${country.toLowerCase()}/rss/${APPLE_FEEDS[type]}/limit=${limit}/json`);
  return (d.feed?.entry || []).map((e) => {
    const imgs = e['im:image'] || [];
    const big = imgs[imgs.length - 1]?.label || '';
    const links = Array.isArray(e.link) ? e.link : [e.link];
    const preview = links.find((l) => l?.attributes?.rel === 'enclosure')?.attributes?.href || '';
    const id = e.id?.attributes?.['im:id'] || '';
    const rel = e['im:releaseDate']?.label || '';
    return {
      source: 'itunes', sourceId: id, itunesId: id, type,
      title: e['im:name']?.label || '', year: yearOf(rel), releaseDate: rel.slice(0, 10),
      cover: type === 'movie' ? appleImg(big, 600, 900) : appleImg(big, 600, 600),
      overview: stripHtml(e.summary?.label || ''), creators: e['im:artist']?.label ? [e['im:artist'].label] : [],
      genres: normGenres([e.category?.attributes?.label || e.category?.attributes?.term].filter(Boolean)),
      trailer: type === 'movie' && preview ? { video: preview } : null,
      audioPreview: type === 'audiobook' ? preview : '',
      externalUrl: links.find((l) => l?.attributes?.rel === 'alternate')?.attributes?.href || '',
      network: type === 'movie' ? 'Apple TV' : '',
    };
  }).filter((x) => x.title);
}

async function itunesMovieDetails(id, country = 'es') {
  const d = await getJSON(`https://itunes.apple.com/lookup?id=${id}&country=${country}`);
  const r = d.results?.[0];
  if (!r) return {};
  return {
    title: r.trackName, year: yearOf(r.releaseDate), releaseDate: (r.releaseDate || '').slice(0, 10),
    cover: appleImg(r.artworkUrl100, 600, 900), overview: stripHtml(r.longDescription || r.shortDescription || ''),
    creators: r.artistName ? [r.artistName] : [], genres: normGenres([r.primaryGenreName]),
    runtime: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 60000) : null,
    trailer: r.previewUrl ? { video: r.previewUrl } : null, externalUrl: r.trackViewUrl, network: 'Apple TV',
  };
}

/* ───────────── Novedades y recomendaciones (sin claves) ───────────── */

function tvmazeCard(s, extra = {}) {
  return {
    source: 'tvmaze', sourceId: String(s.id), tvmazeId: String(s.id), type: 'series',
    title: s.name, year: yearOf(s.premiered), releaseDate: s.premiered || '', cover: https(s.image?.medium || s.image?.original || ''),
    overview: stripHtml(s.summary), network: s.webChannel?.name || s.network?.name || '', imdbId: s.externals?.imdb || '',
    genres: normGenres(s.genres), weight: s.weight || 0, language: s.language || '', ...extra,
  };
}

async function tvmazePremieres(daysBack = 7, daysFwd = 10) {
  const today = new Date().toISOString().slice(0, 10);
  const days = [];
  for (let i = -daysBack; i <= daysFwd; i++) days.push(new Date(Date.now() + i * 864e5).toISOString().slice(0, 10));
  const lists = await Promise.all(days.map((d) => getJSON(`https://api.tvmaze.com/schedule/web?date=${d}`, { noCache: true }).catch(() => [])));
  const seen = new Set(); const out = [];
  for (const ep of lists.flat()) {
    const s = ep._embedded?.show; if (!s || ep.number !== 1 || seen.has(s.id)) continue;
    seen.add(s.id);
    out.push(tvmazeCard(s, { releaseDate: ep.airdate, premiereLabel: ep.season === 1 ? 'Nueva serie' : `Temporada ${ep.season}`, upcoming: ep.airdate > today }));
  }
  return out;
}

// Las plataformas de streaming que más estrenan, para filtrar.
export const STREAMERS = ['Netflix', 'HBO Max', 'Disney+', 'Prime Video', 'Apple TV', 'Paramount+', 'Hulu', 'Peacock', 'Movistar Plus+', 'Filmin', 'SkyShowtime'];
const sameStreamer = (a = '', b = '') => {
  const n = (x) => x.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^max$/, 'hbomax').replace('appletv+', 'appletv');
  return n(a) === n(b) || n(a).startsWith(n(b)) || n(b).startsWith(n(a));
};

export function discoverSections(settings = {}, { provider = '' } = {}) {
  return memoize(`disc|${provider}|${settings.region || 'ES'}`, 20 * 60000, () => discoverSectionsRaw(settings, { provider }));
}
async function discoverSectionsRaw(settings = {}, { provider = '' } = {}) {
  const key = tmdbKey(settings);
  const country = (settings.region || 'ES').toLowerCase();
  const safe = (p) => p.catch((e) => { console.warn('[TVDaily] novedades', e.message); return []; });
  const [prem, movies, audio, books] = await Promise.all([
    safe(memoize('prem', 30 * 60000, () => tvmazePremieres())), safe(memoize(`top-movie-${country}`, 60 * 60000, () => appleTop('movie', country))),
    safe(memoize(`top-audio-${country}`, 60 * 60000, () => appleTop('audiobook', country, 30))), safe(memoize(`top-book-${country}`, 60 * 60000, () => appleTop('book', country, 30))),
  ]);
  const byProv = (x) => !provider || sameStreamer(x.network, provider);
  const byWeight = (a, b) => b.weight - a.weight;
  const sections = [
    { id: 'premieres', kicker: 'Streaming', title: 'Estrenos de series', items: prem.filter((x) => !x.upcoming && byProv(x)).sort(byWeight).slice(0, 40) },
    { id: 'upcoming', kicker: 'Próximos días', title: 'Llegan pronto', items: prem.filter((x) => x.upcoming && byProv(x)).sort((a, b) => a.releaseDate.localeCompare(b.releaseDate)).slice(0, 40) },
  ];
  if (!provider || sameStreamer('Apple TV', provider)) sections.push({ id: 'movies', kicker: 'Lo más visto', title: 'Películas del momento', items: movies });
  if (!provider) {
    sections.push({ id: 'audiobooks', kicker: 'Top audiolibros', title: 'Para escuchar', items: audio });
    sections.push({ id: 'books', kicker: 'Top libros', title: 'Para leer', items: books });
  }
  if (key) {
    try {
      const tr = await tmdb('/trending/tv/week', {}, key);
      sections.splice(1, 0, { id: 'trend-tv', kicker: 'Tendencia', title: 'Series en tendencia', items: (tr.results || []).map((r) => tmdbCard(r, 'series')) });
    } catch { /* opcional */ }
  }
  return sections.filter((s) => s.items.length);
}

export async function providerOptions() {
  return STREAMERS.map((n) => ({ id: n, name: n }));
}

// Recomendaciones: candidatos de novedades puntuados según tus géneros y plataformas favoritos.
export async function recommendationsFor(entries, settings = {}) {
  const liked = entries.filter((e) => (e.rating || 0) >= 4 || e.status === 'completed');
  if (!liked.length) return [];
  const gw = {}, pw = {};
  for (const e of liked) {
    const w = (e.rating || 3) - 2.5;
    for (const g of e.genres || []) gw[g] = (gw[g] || 0) + w;
    const p = e.network || e.platform; if (p) pw[p] = (pw[p] || 0) + 1;
  }
  const secs = await discoverSections(settings).catch(() => []);
  const have = new Set(entries.map((e) => `${e.type}|${String(e.title).toLowerCase()}`));
  const seen = new Set();
  const scored = [];
  for (const it of secs.flatMap((s) => s.items)) {
    const k = `${it.type}|${String(it.title).toLowerCase()}`;
    if (have.has(k) || seen.has(k)) continue; seen.add(k);
    const gs = (it.genres || []).map((g) => [g, gw[g] || 0]).sort((a, b) => b[1] - a[1]);
    let score = gs.reduce((a, [, w]) => a + w, 0) + (pw[it.network] || 0) * 0.6 + (it.weight || 0) / 50;
    if (score <= 0.5) continue;
    const top = gs[0]?.[1] > 0 ? gs[0][0] : '';
    const fav = liked.filter((e) => top && (e.genres || []).includes(top)).sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
    scored.push({ ...it, score, because: fav ? fav.title : top });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 24);
}

// Próximo episodio de una serie (para el calendario).
export async function nextEpisodeOf(e, settings = {}) {
  const key = tmdbKey(settings);
  if (key && e.ids?.tmdb) {
    try {
      const d = await tmdb(`/tv/${e.ids.tmdb}`, {}, key);
      const n = d.next_episode_to_air;
      return n ? { code: epCode(n.season_number, n.episode_number), name: n.name, airdate: n.air_date, overview: n.overview || '' } : null;
    } catch { /* fallback */ }
  }
  const id = await tvmazeIdFor(e);
  if (!id) return null;
  try {
    const s = await getJSON(`https://api.tvmaze.com/shows/${id}?embed=nextepisode`);
    const n = s._embedded?.nextepisode;
    return n ? { code: epCode(n.season, n.number || 0), name: n.name, airdate: n.airdate, overview: stripHtml(n.summary) } : null;
  } catch { return null; }
}

export function trailerSearchUrl(e) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${e.title} ${e.year || ''} trailer`)}`;
}

/* ───────────── Episodios y temporadas ───────────── */

export const epCode = (s, n) => `S${String(s).padStart(2, '0')}E${String(n).padStart(2, '0')}`;

export async function tvmazeIdFor(e) {
  if (e.ids?.tvmaze) return e.ids.tvmaze;
  if (e.source?.name === 'tvmaze') return e.source.id;
  if (e.ids?.tvdb) {
    try { const s = await getJSON(`https://api.tvmaze.com/lookup/shows?thetvdb=${e.ids.tvdb}`); return String(s.id); } catch { /* sigue */ }
  }
  const imdb = e.ids?.imdb || e.imdbId;
  if (imdb) {
    try { const s = await getJSON(`https://api.tvmaze.com/lookup/shows?imdb=${imdb}`); return String(s.id); } catch { /* no está */ }
  }
  try { const s = await getJSON(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(e.originalTitle || e.title)}`); return String(s.id); } catch { return ''; }
}

// Devuelve [{ season, name, overview, episodes:[{season, number, code, name, airdate, runtime, overview, image}] }]
export async function getSeasons(e, settings = {}) {
  const key = tmdbKey(settings);
  let tmdbId = e.ids?.tmdb || (e.source?.name === 'tmdb' ? e.source.id : '');
  if (key && !tmdbId && (e.ids?.imdb || e.imdbId)) {
    try {
      const f = await tmdb(`/find/${e.ids?.imdb || e.imdbId}`, { external_source: 'imdb_id' }, key);
      tmdbId = f.tv_results?.[0]?.id ? String(f.tv_results[0].id) : '';
    } catch { /* sin cruce */ }
  }
  if (key && tmdbId) {
    try {
      const show = await tmdb(`/tv/${tmdbId}`, {}, key);
      const nums = (show.seasons || []).map((s) => s.season_number).filter((n) => n > 0);
      const seasons = await Promise.all(nums.map((n) => tmdb(`/tv/${tmdbId}/season/${n}`, {}, key).catch(() => null)));
      const out = seasons.filter(Boolean).map((s) => ({
        season: s.season_number, name: s.name, overview: s.overview || '', poster: s.poster_path ? TMDB_IMG + 'w342' + s.poster_path : '',
        episodes: (s.episodes || []).map((ep) => ({
          season: ep.season_number, number: ep.episode_number, code: epCode(ep.season_number, ep.episode_number),
          name: ep.name, airdate: ep.air_date || '', runtime: ep.runtime || null, overview: ep.overview || '',
          image: ep.still_path ? TMDB_IMG + 'w300' + ep.still_path : '', rating: ep.vote_average || null,
        })),
      }));
      // Si TMDB no tiene sinopsis en español para algún episodio, caemos a TVMaze más abajo sólo si faltan todas.
      if (out.some((s) => s.episodes.some((x) => x.overview))) return out;
    } catch (err) { console.warn('[TVDaily] TMDB temporadas', err.message); }
  }
  const id = await tvmazeIdFor(e);
  if (!id) return [];
  const [eps, seas] = await Promise.all([
    getJSON(`https://api.tvmaze.com/shows/${id}/episodes`),
    getJSON(`https://api.tvmaze.com/shows/${id}/seasons`).catch(() => []),
  ]);
  const by = new Map();
  for (const s of seas) if (s.number > 0) by.set(s.number, { season: s.number, name: s.name || `Temporada ${s.number}`, overview: stripHtml(s.summary), poster: https(s.image?.medium || ''), episodes: [] });
  for (const ep of eps) {
    if (!ep.number) continue; // especiales sin número
    if (!by.has(ep.season)) by.set(ep.season, { season: ep.season, name: `Temporada ${ep.season}`, overview: '', poster: '', episodes: [] });
    by.get(ep.season).episodes.push({
      season: ep.season, number: ep.number, code: epCode(ep.season, ep.number), name: ep.name,
      airdate: ep.airdate || '', runtime: ep.runtime || null, overview: stripHtml(ep.summary),
      image: https(ep.image?.medium || ''), rating: ep.rating?.average || null,
    });
  }
  return [...by.values()].filter((s) => s.episodes.length).sort((a, b) => a.season - b.season)
    .map((s) => ({ ...s, name: /^Temporada|^Season/.test(s.name) || !s.name ? `Temporada ${s.season}` : s.name }));
}

/* ───────────── Emisión: estado de la serie, episodios emitidos y próximos ───────────── */

const ENDED = /ended|canceled|cancelled/i;

// Información de emisión de una serie (TVMaze), procesada y memorizada 30 min.
export function showInfo(e) {
  return memoize(`info|${e.id || e.title}`, 30 * 60000, async () => {
    const id = await tvmazeIdFor(e);
    if (!id) return null;
    const s = await getJSON(`https://api.tvmaze.com/shows/${id}?embed[]=episodes`, { noCache: true });
    const today = new Date().toISOString().slice(0, 10);
    const eps = (s._embedded?.episodes || []).filter((x) => x.number).map((x) => ({
      code: epCode(x.season, x.number), season: x.season, number: x.number, name: x.name,
      airdate: x.airdate || '', airtime: x.airtime || '', runtime: x.runtime || s.averageRuntime || null, image: https(x.image?.medium || ''),
    }));
    const aired = eps.filter((x) => x.airdate && x.airdate <= today);
    const upcoming = eps.filter((x) => x.airdate && x.airdate > today).sort((a, b) => a.airdate.localeCompare(b.airdate));
    return {
      tvmazeId: String(id), tvdbId: s.externals?.thetvdb ? String(s.externals.thetvdb) : '', imdbId: s.externals?.imdb || '',
      status: s.status || '', ended: ENDED.test(s.status || ''), network: s.webChannel?.name || s.network?.name || '',
      cover: https(s.image?.original || ''), total: eps.length, aired, upcoming, episodes: eps,
      next: upcoming[0] ? { code: upcoming[0].code, name: upcoming[0].name, airdate: upcoming[0].airdate } : null,
    };
  });
}

// Estado que le corresponde a una serie según lo visto y su emisión.
export function seriesStatusFor(e, info, watchedList = e.watchedEpisodes || []) {
  // Nunca tocamos lo abandonado ni lo que se marcó como visto a mano sin episodios.
  if (!info || e.status === 'abandoned') return e.status;
  const watched = new Set(watchedList);
  if (!watched.size) return e.status;
  const allAired = info.aired.length > 0 && info.aired.every((x) => watched.has(x.code));
  if (allAired) return info.ended && !info.upcoming.length ? 'completed' : 'up_to_date';
  if (e.status === 'completed') return 'completed';
  return 'in_progress';
}

// Programación de un día: streaming global + TV de un país, ya simplificada.
export function scheduleFor(date, country = 'ES') {
  return memoize(`sched|${date}|${country}`, 30 * 60000, async () => {
    const [web, tv] = await Promise.all([
      getJSON(`https://api.tvmaze.com/schedule/web?date=${date}`, { noCache: true }).catch(() => []),
      getJSON(`https://api.tvmaze.com/schedule?country=${country}&date=${date}`, { noCache: true }).catch(() => []),
    ]);
    const seen = new Set();
    return [...web, ...tv].map((ep) => {
      const sh = ep._embedded?.show || ep.show; if (!sh) return null;
      const k = `${sh.id}|${ep.season}|${ep.number}`; if (seen.has(k)) return null; seen.add(k);
      return {
        showId: String(sh.id), title: sh.name, cover: https(sh.image?.medium || ''), platform: sh.webChannel?.name || sh.network?.name || 'Otros',
        code: ep.number ? epCode(ep.season, ep.number) : 'ESP', name: ep.name, airtime: ep.airtime || '', runtime: ep.runtime || null,
        premiere: ep.number === 1, newShow: ep.number === 1 && ep.season === 1, language: sh.language || '', genres: normGenres(sh.genres),
        weight: sh.weight || 0, imdbId: sh.externals?.imdb || '', year: yearOf(sh.premiered),
      };
    }).filter(Boolean);
  });
}
