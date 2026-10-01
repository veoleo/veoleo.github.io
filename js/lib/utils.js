// Utilidades compartidas: tipos, estados, fechas, filtros y helpers varios.

export const TYPES = {
  series: { key: 'series', label: 'Serie', plural: 'Series', icon: '📺', ico: 'tv', color: 'var(--c-series)' },
  movie: { key: 'movie', label: 'Película', plural: 'Películas', icon: '🎬', ico: 'film', color: 'var(--c-movie)' },
  book: { key: 'book', label: 'Libro', plural: 'Libros', icon: '📖', ico: 'book', color: 'var(--c-book)' },
  audiobook: { key: 'audiobook', label: 'Audiolibro', plural: 'Audiolibros', icon: '🎧', ico: 'headphones', color: 'var(--c-audio)' },
};
export const TYPE_KEYS = Object.keys(TYPES);

export const STATUS_KEYS = ['completed', 'up_to_date', 'in_progress', 'planned', 'abandoned'];
// Estados disponibles por tipo ("Al día" sólo tiene sentido en series).
export const statusKeysFor = (type) => STATUS_KEYS.filter((s) => s !== 'up_to_date' || type === 'series' || !type);

const STATUS_LABELS = {
  completed: { series: 'Vista', movie: 'Vista', book: 'Leído', audiobook: 'Escuchado', any: 'Completado' },
  up_to_date: { series: 'Al día', movie: 'Al día', book: 'Al día', audiobook: 'Al día', any: 'Al día' },
  in_progress: { series: 'Viendo', movie: 'Viendo', book: 'Leyendo', audiobook: 'Escuchando', any: 'En curso' },
  planned: { series: 'Must watch', movie: 'Must watch', book: 'Por leer', audiobook: 'Por escuchar', any: 'Pendiente' },
  abandoned: { series: 'Abandonada', movie: 'Abandonada', book: 'Abandonado', audiobook: 'Abandonado', any: 'Abandonado' },
};
export const STATUS_ICONS = { completed: '✓', up_to_date: '⟳', in_progress: '◐', planned: '✦', abandoned: '✕' };
export const STATUS_COLORS = { completed: 'var(--teal)', up_to_date: 'var(--blue)', in_progress: 'var(--yellow)', planned: 'var(--pink)', abandoned: 'var(--muted)' };
export const statusLabel = (status, type = 'any') => STATUS_LABELS[status]?.[type] || STATUS_LABELS[status]?.any || status;

export const PLATFORMS = ['Netflix', 'HBO Max', 'Disney+', 'Prime Video', 'Apple TV+', 'Movistar Plus+', 'Filmin', 'SkyShowtime', 'Atresplayer', 'RTVE Play', 'Crunchyroll', 'Cine', 'TV', 'Otro'];
export const READ_PLACES = ['Kindle', 'Papel', 'Kobo', 'Apple Books', 'Google Play Libros', 'PDF / ePub', 'Biblioteca', 'Otro'];
export const LISTEN_PLACES = ['Audible', 'Audiobookshelf', 'Storytel', 'Spotify', 'Apple Books', 'Libby', 'BookBeat', 'Podimo', 'Otro'];

export const GENRE_ES = {
  'action': 'Acción', 'action & adventure': 'Acción y aventura', 'adventure': 'Aventura', 'animation': 'Animación', 'anime': 'Anime',
  'biography': 'Biografía', 'comedy': 'Comedia', 'crime': 'Crimen', 'documentary': 'Documental', 'drama': 'Drama', 'family': 'Familia',
  'fantasy': 'Fantasía', 'history': 'Historia', 'horror': 'Terror', 'music': 'Música', 'musical': 'Musical', 'mystery': 'Misterio',
  'romance': 'Romance', 'science-fiction': 'Ciencia ficción', 'science fiction': 'Ciencia ficción', 'sci-fi & fantasy': 'Ciencia ficción y fantasía',
  'sci-fi': 'Ciencia ficción', 'thriller': 'Thriller', 'war': 'Bélica', 'western': 'Western', 'sports': 'Deportes', 'supernatural': 'Sobrenatural',
  'espionage': 'Espionaje', 'legal': 'Legal', 'medical': 'Médica', 'food': 'Gastronomía', 'travel': 'Viajes', 'children': 'Infantil',
  'kids': 'Infantil', 'reality': 'Reality', 'talk show': 'Talk show', 'soap': 'Culebrón', 'war & politics': 'Guerra y política',
  'fiction': 'Ficción', 'nonfiction': 'No ficción', 'juvenile fiction': 'Juvenil', 'young adult fiction': 'Juvenil', 'young adult': 'Juvenil',
  'biography & autobiography': 'Biografía', 'self-help': 'Autoayuda', 'psychology': 'Psicología', 'philosophy': 'Filosofía',
  'business & economics': 'Negocios', 'poetry': 'Poesía', 'comics & graphic novels': 'Cómic', 'true crime': 'True crime',
  'tv movie': 'Telefilme', 'film-noir': 'Cine negro', 'short': 'Cortometraje', 'game-show': 'Concurso', 'news': 'Noticias',
  'drama film': 'Drama', 'comedy film': 'Comedia', 'science fiction film': 'Ciencia ficción', 'action film': 'Acción', 'horror film': 'Terror',
  'thriller film': 'Thriller', 'fantasy film': 'Fantasía', 'animated film': 'Animación', 'adventure film': 'Aventura', 'crime film': 'Crimen',
  'romance film': 'Romance', 'war film': 'Bélica', 'documentary film': 'Documental', 'mystery film': 'Misterio', 'biographical film': 'Biografía',
};
export function normGenre(g) {
  if (!g) return '';
  const k = String(g).trim();
  const t = GENRE_ES[k.toLowerCase()];
  return t || k.charAt(0).toUpperCase() + k.slice(1);
}
export function normGenres(list) {
  const out = [];
  for (const g of list || []) {
    for (const part of String(g).split(/\s*[\/,]\s*/)) {
      const n = normGenre(part);
      if (n && !out.includes(n) && n.length < 40) out.push(n);
    }
  }
  return out.slice(0, 8);
}

export const toMillis = (ts) => (ts?.toMillis ? ts.toMillis() : typeof ts === 'number' ? ts : ts ? Date.parse(ts) || 0 : 0);
export const todayISO = () => new Date().toISOString().slice(0, 10);
export function humanDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}
export function timeAgo(ms) {
  if (!ms) return '';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'ahora';
  const m = Math.round(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24); if (d < 30) return `hace ${d} d`;
  return new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Año en que cuenta una entrada para filtros/listas: fecha de fin, si no la de inicio, si no la de alta.
export function entryYear(e) {
  if (e.yearUnknown) return null; // «Otros años»: visto, pero no se sabe cuándo
  if (e.watchedYear) return Number(e.watchedYear);
  const d = e.finishedAt || (e.status === 'completed' ? e.lastWatchedAt : '') || e.startedAt;
  if (d) return Number(String(d).slice(0, 4));
  if (e.source?.name === 'import') return null; // importado sin fechas: no se inventa el año de importación
  const c = toMillis(e.createdAt);
  return c ? new Date(c).getFullYear() : null;
}

export function starsText(r) {
  const v = Math.round((Number(r) || 0) * 2) / 2;
  const full = Math.floor(v), half = v % 1 ? 1 : 0;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - half);
}

export function stripHtml(s) {
  if (!s) return '';
  // DOMParser crea un documento inerte: no carga imágenes ni ejecuta nada del HTML de terceros.
  const doc = new DOMParser().parseFromString(String(s).replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n'), 'text/html');
  return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

export function slug(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
export function safeFilename(s) {
  return String(s || 'nota').replace(/[\\/:*?"<>|#^[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'nota';
}

export function debounce(fn, ms = 300) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function uniq(arr) { return [...new Set(arr.filter(Boolean))]; }

export function youtubeId(url) {
  if (!url) return '';
  if (/^[\w-]{11}$/.test(url)) return url;
  const m = String(url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : '';
}

// Reglas de filtrado (también se usan en listas automáticas).
export function matchRules(e, r = {}) {
  if (r.types?.length && !r.types.includes(e.type)) return false;
  if (r.statuses?.length && !r.statuses.includes(e.status)) return false;
  const y = entryYear(e);
  if (r.yearFrom === 'unknown' || r.yearTo === 'unknown') { if (y || e.status === 'planned') return false; }
  else {
    if (r.yearFrom && (!y || y < Number(r.yearFrom))) return false;
    if (r.yearTo && (!y || y > Number(r.yearTo))) return false;
  }
  if (r.minRating && (Number(e.rating) || 0) < Number(r.minRating)) return false;
  if (r.genres?.length && !(e.genres || []).some((g) => r.genres.includes(g))) return false;
  if (r.formats?.length) {
    const c = e.consumption || {};
    if (!r.formats.every((f) => c[f])) return false;
  }
  if (r.platform && ![e.platform, e.consumption?.readOn, e.consumption?.listenedOn].includes(r.platform)) return false;
  if (r.text) {
    const q = r.text.toLowerCase();
    const hay = [e.title, e.originalTitle, ...(e.creators || []), ...(e.tags || [])].join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export function sortEntries(list, sort = 'recent') {
  const by = {
    recent: (x, y) => (toMillis(y.updatedAt) || 0) - (toMillis(x.updatedAt) || 0),
    finished: (x, y) => String(y.finishedAt || '').localeCompare(String(x.finishedAt || '')),
    rating: (x, y) => (y.rating || 0) - (x.rating || 0) || String(x.title).localeCompare(y.title),
    title: (x, y) => String(x.title).localeCompare(String(y.title), 'es'),
    year: (x, y) => (Number(y.year) || 0) - (Number(x.year) || 0),
  }[sort] || (() => 0);
  return [...list].sort(by);
}

export function describeRules(r = {}) {
  const parts = [];
  if (r.types?.length) parts.push(r.types.map((t) => TYPES[t]?.plural).join(' + '));
  if (r.statuses?.length) parts.push(r.statuses.map((s) => statusLabel(s)).join(' / '));
  if (r.yearFrom && r.yearTo && r.yearFrom === r.yearTo) parts.push(`en ${r.yearFrom}`);
  else { if (r.yearFrom) parts.push(`desde ${r.yearFrom}`); if (r.yearTo) parts.push(`hasta ${r.yearTo}`); }
  if (r.minRating) parts.push(`≥ ${r.minRating}★`);
  if (r.genres?.length) parts.push(r.genres.join(', '));
  if (r.formats?.length) parts.push(r.formats.map((f) => (f === 'read' ? 'leídos' : 'escuchados')).join(' y '));
  if (r.platform) parts.push(r.platform);
  return parts.join(' · ') || 'Todo';
}

export function fmtDuration(min) {
  const m = Number(min); if (!m) return '';
  const h = Math.floor(m / 60), r = m % 60;
  return h ? `${h} h ${r ? r + ' min' : ''}`.trim() : `${r} min`;
}

export function initials(name) {
  return String(name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export function hashHue(s) {
  let h = 0; for (const ch of String(s || '')) h = (h * 31 + ch.charCodeAt(0)) % 360; return h;
}

// Color de la paleta cómic asignado de forma estable a un texto.
const PALETTE = ['var(--accent)', 'var(--red)', 'var(--yellow)', 'var(--teal)', 'var(--blue)', 'var(--pink)', 'var(--orange)', 'var(--purple)'];
export function paletteFor(s) { return PALETTE[hashHue(s) % PALETTE.length]; }

export function download(filename, content, mime = 'text/markdown;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

export function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });
}

// Devuelve una versión reducida de una imagen remota (menos memoria y datos, clave en iPhone).
export function img(url, w = 360) {
  if (!url) return '';
  const u = String(url);
  // TVMaze ya sirve tamaño póster: sin pasar por el redimensionador (más fiable en móvil).
  if (/static\.tvmaze\.com\/uploads\/images\//.test(u) && w <= 400 && !/large_landscape/.test(u)) return u.replace(/\/(original_untouched|medium_portrait)\//, '/medium_portrait/');
  if (/m\.media-amazon\.com/.test(u)) return u.replace(/\._V1_.*\.(jpg|png)$/, `._V1_SX${w}.jpg`);
  if (/mzstatic\.com/.test(u)) return u.replace(/\/(\d+)x(\d+)bb\.(jpg|png)$/, (m, a, b) => `/${w}x${Math.round((w * b) / a)}bb.jpg`);
  if (/image\.tmdb\.org/.test(u)) return u.replace(/\/t\/p\/(w\d+|original)\//, `/t/p/${w <= 185 ? 'w185' : w <= 342 ? 'w342' : w <= 500 ? 'w500' : w <= 780 ? 'w780' : 'w1280'}/`);
  if (/books\.google/.test(u)) return u.replace(/&fife=w\d+/, '') + `&fife=w${w}`;
  // Wikimedia: miniatura del tamaño pedido en lugar del original (pueden ser fotos de 20 MP).
  const wm = u.match(/^https?:\/\/upload\.wikimedia\.org\/wikipedia\/(\w+)\/(?!thumb\/)(\w)\/(\w\w)\/([^/?#]+)$/);
  if (wm && !/\.svg$/i.test(wm[4])) return `https://upload.wikimedia.org/wikipedia/${wm[1]}/thumb/${wm[2]}/${wm[3]}/${wm[4]}/${w}px-${wm[4]}`;
  if (/covers\.openlibrary\.org/.test(u)) return w <= 200 ? u.replace(/-L\.jpg/, '-M.jpg') : u;
  if (/^https?:\/\//.test(u) && !/ytimg\.com|wikimedia/.test(u)) {
    return `https://images.weserv.nl/?url=${encodeURIComponent(u.replace(/^https?:\/\//, ''))}&w=${w}&output=webp&q=80&we`;
  }
  return u;
}
