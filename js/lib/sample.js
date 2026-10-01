// Biblioteca de ejemplo para quien prueba Veoleo sin cuenta: se puede editar, borrar y exportar como cualquier diario.
const eps = (season, n) => Array.from({ length: n }, (_, i) => `S${String(season).padStart(2, '0')}E${String(i + 1).padStart(2, '0')}`);
const tvm = (path) => `https://static.tvmaze.com/uploads/images/original_untouched/${path}`;
const ol = (id) => `https://covers.openlibrary.org/b/id/${id}-L.jpg`;
const y = new Date().getFullYear();

const base = { backdrop: '', overview: '', cast: [], tags: [], visibility: 'private', hasNote: false, notePublic: false, rewatch: 0, consumption: null, source: { name: 'sample', id: '' } };

export const SAMPLE_ENTRIES = [
  { type: 'series', title: 'Severance', year: 2022, cover: tvm('548/1371406.jpg'), platform: 'Apple TV+', network: 'Apple TV', genres: ['Drama', 'Ciencia ficción', 'Misterio'], creators: ['Dan Erickson'],
    status: 'in_progress', rating: 4.5, startedAt: `${y}-01-12`, finishedAt: '', watchedEpisodes: [...eps(1, 9), ...eps(2, 4)], episodes: 19, ids: { tvmaze: '44933', imdb: 'tt11280740' }, tags: ['culto'] },
  { type: 'series', title: 'The Bear', year: 2022, cover: tvm('629/1574642.jpg'), platform: 'Disney+', network: 'Hulu', genres: ['Drama', 'Comedia', 'Gastronomía'], creators: ['Christopher Storer'],
    status: 'up_to_date', rating: 4.5, startedAt: `${y - 1}-06-02`, finishedAt: `${y}-07-01`, watchedEpisodes: [...eps(1, 8), ...eps(2, 10), ...eps(3, 10)], episodes: 38, ids: { tvmaze: '54198', imdb: 'tt14452776' } },
  { type: 'series', title: 'Succession', year: 2018, cover: tvm('453/1134275.jpg'), platform: 'HBO Max', network: 'HBO', genres: ['Drama', 'Familia'], creators: ['Jesse Armstrong'],
    status: 'completed', rating: 5, startedAt: `${y - 2}-03-01`, finishedAt: `${y - 2}-05-28`, watchedEpisodes: [...eps(1, 10), ...eps(2, 10), ...eps(3, 9), ...eps(4, 10)], episodes: 39, ids: { tvmaze: '23470', imdb: 'tt7660850' } },
  { type: 'series', title: 'Shōgun', year: 2024, cover: tvm('506/1265637.jpg'), platform: 'Disney+', network: 'Hulu', genres: ['Drama', 'Aventura', 'Historia'],
    status: 'completed', rating: 4.5, startedAt: `${y - 1}-03-01`, finishedAt: `${y - 1}-04-23`, watchedEpisodes: eps(1, 10), episodes: 10, ids: { tvmaze: '37336', imdb: 'tt2788316' } },
  { type: 'series', title: 'Slow Horses', year: 2022, cover: tvm('641/1604425.jpg'), platform: 'Apple TV+', network: 'Apple TV', genres: ['Drama', 'Thriller', 'Espionaje'],
    status: 'planned', rating: 0, startedAt: '', finishedAt: '', watchedEpisodes: [], ids: { tvmaze: '45039', imdb: 'tt5875444' } },
  { type: 'series', title: 'The Last of Us', year: 2023, cover: tvm('563/1409008.jpg'), platform: 'HBO Max', network: 'HBO', genres: ['Drama', 'Acción', 'Terror'],
    status: 'abandoned', rating: 3, startedAt: `${y - 1}-02-10`, finishedAt: `${y - 1}-02-20`, watchedEpisodes: eps(1, 3), episodes: 16, ids: { tvmaze: '46562', imdb: 'tt3581920' } },
  { type: 'series', title: 'Breaking Bad', year: 2008, cover: tvm('501/1253519.jpg'), platform: 'Netflix', network: 'AMC', genres: ['Drama', 'Crimen', 'Thriller'],
    status: 'completed', rating: 5, startedAt: '', finishedAt: '', yearUnknown: true, watchedEpisodes: [...eps(1, 7), ...eps(2, 13), ...eps(3, 13), ...eps(4, 13), ...eps(5, 16)], episodes: 62, ids: { tvmaze: '169', imdb: 'tt0903747' } },
  { type: 'movie', title: 'Oppenheimer', year: 2023, cover: 'https://m.media-amazon.com/images/M/MV5BN2JkMDc5MGQtZjg3YS00NmFiLWIyZmQtZTJmNTM5MjVmYTQ4XkEyXkFqcGc@._V1_.jpg', platform: 'Cine',
    genres: ['Drama', 'Historia'], creators: ['Christopher Nolan'], status: 'completed', rating: 4.5, startedAt: '', finishedAt: `${y - 2}-07-22`, runtime: 180, ids: { imdb: 'tt15398776' } },
  { type: 'movie', title: 'Dune: Part Two', year: 2024, cover: 'https://m.media-amazon.com/images/M/MV5BNTc0YmQxMjEtODI5MC00NjFiLTlkMWUtOGQ5NjFmYWUyZGJhXkEyXkFqcGc@._V1_.jpg', platform: 'Cine',
    genres: ['Ciencia ficción', 'Aventura'], creators: ['Denis Villeneuve'], status: 'completed', rating: 5, startedAt: '', finishedAt: `${y - 1}-03-03`, runtime: 166, ids: { imdb: 'tt15239678' } },
  { type: 'movie', title: 'Past Lives', year: 2023, cover: 'https://m.media-amazon.com/images/M/MV5BYjQyMTNhNjUtN2VmYy00NWRhLTkwOTctMGVmNTBmNDIxYjZhXkEyXkFqcGc@._V1_.jpg', platform: 'Filmin',
    genres: ['Drama', 'Romance'], creators: ['Celine Song'], status: 'planned', rating: 0, startedAt: '', finishedAt: '', runtime: 106, ids: { imdb: 'tt13238346' } },
  { type: 'book', title: 'Project Hail Mary', year: 2021, cover: ol(11200092), creators: ['Andy Weir'], genres: ['Ciencia ficción'], pages: 496,
    status: 'completed', rating: 5, startedAt: `${y}-02-01`, finishedAt: `${y}-02-19`, consumption: { read: true, listened: false, readOn: 'Kindle', listenedOn: '' } },
  { type: 'book', title: 'Dune', year: 1965, cover: ol(11481354), creators: ['Frank Herbert'], genres: ['Ciencia ficción'], pages: 608,
    status: 'in_progress', rating: 0, startedAt: `${y}-08-15`, finishedAt: '', progressPct: 40, consumption: { read: true, listened: false, readOn: 'Papel', listenedOn: '' } },
  { type: 'audiobook', title: 'The Seven Husbands of Evelyn Hugo', year: 2017, cover: ol(8354226), creators: ['Taylor Jenkins Reid'], genres: ['Ficción', 'Romance'],
    status: 'completed', rating: 4, startedAt: `${y}-05-02`, finishedAt: `${y}-05-20`, consumption: { read: false, listened: true, readOn: '', listenedOn: 'Audible' } },
  { type: 'book', title: 'Atomic Habits', year: 2018, cover: ol(12539702), creators: ['James Clear'], genres: ['No ficción', 'Autoayuda'], pages: 320,
    status: 'planned', rating: 0, startedAt: '', finishedAt: '', consumption: { read: true, listened: false, readOn: '', listenedOn: '' } },
].map((e) => ({ ...base, ...e }));
