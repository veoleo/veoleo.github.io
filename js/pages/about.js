// Qué es Veoleo: todo lo que hace la web, en español e inglés (texto propio, sin pasar por el traductor).
import { html } from 'preact-standalone';
import { Icon, Scramble, SupportButton, LangToggle } from '../components/ui.js';
import { LANG } from '../lib/i18n.js';
import { CONTACT_EMAIL } from '../config.js';

const F = [
  { c: 'var(--accent)', href: '#/library', ico: 'grid',
    es: ['Tu diario', 'Series, películas, libros y audiolibros en un solo sitio.', [
      'Estados: Viendo, Al día, Vista, Must watch, Pendiente y Abandonada (con su propia lista)',
      'Valoración con estrellas y medias estrellas',
      'Dónde lo viste, leíste o escuchaste: Netflix, Kindle, Audible, Audiobookshelf, papel…',
      'Libros leídos y/o escuchados, revisionados, etiquetas y fechas',
      'Cada entrada pública o privada']],
    en: ['Your diary', 'Series, movies, books and audiobooks in one place.', [
      'Statuses: Watching, Up to date, Watched, Must watch, Planned and Dropped (with its own list)',
      'Star ratings with half stars',
      'Where you watched, read or listened: Netflix, Kindle, Audible, Audiobookshelf, paper…',
      'Books read and/or listened, rewatches, tags and dates',
      'Every entry public or private']] },
  { c: 'var(--blue)', href: '#/library?type=series', ico: 'tv',
    es: ['Episodios', 'Cada temporada con la sinopsis oficial de cada episodio.', [
      'Marca episodios sueltos, «visto hasta aquí» o la temporada entera',
      'Al marcarlo todo, la serie pasa sola a Al día (si sigue en emisión) o a Vista (si ha terminado)',
      'Las series terminadas y vistas salen de «Viendo» automáticamente',
      'Tiempo total visto y progreso por temporada']],
    en: ['Episodes', 'Every season with the official synopsis of each episode.', [
      'Mark single episodes, "watched up to here" or a whole season',
      'When everything is marked the series moves to Up to date (still airing) or Watched (ended)',
      'Ended and fully watched series leave "Watching" automatically',
      'Total time watched and progress per season']] },
  { c: 'var(--teal)', href: '#/search', ico: 'search',
    es: ['Búsqueda y fichas', 'Metadatos de varias fuentes, sin claves ni configuración.', [
      'TVMaze, IMDb, Wikidata, Wikipedia, Apple, Google Books y Open Library',
      'Portada, fondo, tráiler de YouTube, reparto y banda sonora',
      'Dónde verlo (JustWatch) y «Stream it or skip it» de Decider',
      'Fechas de estreno por título y por episodio']],
    en: ['Search & details', 'Metadata from several sources, no keys or setup.', [
      'TVMaze, IMDb, Wikidata, Wikipedia, Apple, Google Books and Open Library',
      'Cover, backdrop, YouTube trailer, cast and soundtrack',
      'Where to watch (JustWatch) and Decider\'s "Stream it or skip it"',
      'Release dates per title and per episode']] },
  { c: 'var(--yellow)', href: '#/discover', ico: 'spark',
    es: ['Novedades y recomendaciones', 'Lo que llega y lo que te va a gustar.', [
      'Estrenos de series y tendencias, filtrables por plataforma',
      'Tops de películas, libros y audiolibros de tu país',
      'Recomendaciones según lo que mejor has valorado',
      'Lo que triunfa entre la gente que sigues']],
    en: ["What's new & recommendations", "What's coming and what you'll love.", [
      'Series premieres and trends, filterable by platform',
      'Top movies, books and audiobooks in your country',
      'Recommendations based on what you rated best',
      'Hits among the people you follow']] },
  { c: 'var(--orange)', href: '#/guide', ico: 'guide',
    es: ['Guía TV', 'Como la programación de siempre, pero de tus series.', [
      'Próximos episodios de tus series con fecha y cuenta atrás',
      'Lo que ya se ha emitido y aún no has visto',
      'Parrilla del día por país, canal y plataforma']],
    en: ['TV guide', 'Like the old TV listings, but for your shows.', [
      'Upcoming episodes of your series with dates and countdown',
      "What already aired that you haven't watched",
      'Daily schedule by country, channel and platform']] },
  { c: 'var(--red)', href: '#/news', ico: 'news',
    es: ['Noticias', 'El mundo serie, cine y plataformas, actualizado cada hora.', [
      'Más de 25 medios en español e inglés',
      'Guarda tus noticias favoritas y comparte el enlace']],
    en: ['News', 'TV, film and streaming news, updated every hour.', [
      'More than 25 outlets in Spanish and English',
      'Save your favorite stories and share the link']] },
  { c: 'var(--pink)', href: '#/lists', ico: 'list',
    es: ['Listas', 'Manuales o automáticas, públicas o privadas.', [
      'Must watch, Por leer, Al día y Abandonadas ya hechas',
      'Listas automáticas con reglas: «Series vistas en 2025», «Thrillers de 4★»…',
      'Filtros por año, valoración, género, plataforma y formato']],
    en: ['Lists', 'Manual or smart, public or private.', [
      'Must watch, To read, Up to date and Dropped built in',
      'Smart lists with rules: "Series watched in 2025", "Thrillers 4★+"…',
      'Filters by year, rating, genre, platform and format']] },
  { c: 'var(--mint)', href: '#/challenges', ico: 'trophy',
    es: ['Retos y estadísticas', 'Ponte objetivos y mira tu año en números.', [
      'Retos anuales de libros, series y películas con ritmo mes a mes',
      'Mapa de actividad, horas de pantalla, páginas, géneros y plataformas']],
    en: ['Challenges & stats', 'Set goals and see your year in numbers.', [
      'Yearly challenges for books, series and movies with monthly pace',
      'Activity map, screen hours, pages, genres and platforms']] },
  { c: 'var(--purple)', href: '#/data', ico: 'obsidian',
    es: ['Notas y Obsidian', 'Escribe en Markdown y llévatelo todo.', [
      'Notas con callouts de Obsidian, públicas o privadas',
      'Exporta una nota .md o tu diario entero como bóveda de Obsidian (.zip)',
      'Una nota por título con portada, valoración y episodios, índice con Dataview y snippet CSS',
      'Plantilla configurable en Ajustes']],
    en: ['Notes & Obsidian', 'Write in Markdown and take everything with you.', [
      'Notes with Obsidian callouts, public or private',
      'Export one .md note or your whole diary as an Obsidian vault (.zip)',
      'One note per title with cover, rating and episodes, Dataview index and CSS snippet',
      'Configurable template in Settings']] },
  { c: 'var(--accent)', href: '#/explore', ico: 'users',
    es: ['Comunidad', 'Comparte lo que estás viendo y por dónde vas.', [
      'Publicaciones con el título adjunto, tu estado y tu progreso',
      'Me gusta, respuestas, avisos de spoiler y enlace para compartir',
      'Perfil con portada (elige imágenes de tus series o busca cualquiera), color y Top 4',
      'Sigue a gente y comenta sus fichas']],
    en: ['Community', "Share what you're watching and how far you are.", [
      'Posts with the title attached, your status and your progress',
      'Likes, replies, spoiler warnings and a share link',
      'Profile with a cover (pick images from your series or search any), accent color and Top 4',
      'Follow people and comment on their entries']] },
  { c: 'var(--blue)', href: '#/data', ico: 'database',
    es: ['Importar y exportar', 'Trae tu historial y llévatelo cuando quieras.', [
      'Importa TV Time, Netflix, Letterboxd, Goodreads, IMDb y copias de Veoleo',
      'Exporta en formato TV Time, Trakt, Letterboxd, Goodreads, CSV y JSON']],
    en: ['Import & export', 'Bring your history and take it whenever you want.', [
      'Import TV Time, Netflix, Letterboxd, Goodreads, IMDb and Veoleo backups',
      'Export to TV Time format, Trakt, Letterboxd, Goodreads, CSV and JSON']] },
  { c: 'var(--text-2)', href: '#/settings', ico: 'settings',
    es: ['La app', 'Rápida, instalable y gratis.', [
      'Instálala en el móvil desde el navegador (PWA)',
      'Español e inglés con la bandera de arriba',
      'Búsqueda global con ⌘K y sonidos sutiles opcionales',
      'Gratis para siempre: sin anuncios, sin suscripciones, sin vender tus datos y sin claves que configurar',
      'Pruébala sin cuenta con una biblioteca de ejemplo y guárdala cuando quieras']],
    en: ['The app', 'Fast, installable and free.', [
      'Install it on your phone from the browser (PWA)',
      'Spanish and English with the flag at the top',
      'Global search with ⌘K and optional subtle sounds',
      'Free, no ads and no keys to configure']] },
];

export function AboutPage({ public: isPublic = false }) {
  const L = LANG === 'en' ? 'en' : 'es';
  return html`<div data-no-i18n>
    ${isPublic && html`<header class="header"><div class="wrap"><a class="logo" href="#/"><i></i><span class="lt">Veoleo</span></a>
      <div class="header-actions"><${LangToggle} /><a class="btn sm" href="#/">${L === 'en' ? 'Sign in' : 'Entrar'}</a></div></div></header>`}
    <div class="page wrap about">
      <div class="page-head"><div>
        <div class="kicker">${L === 'en' ? 'Series · Movies · Books · Audiobooks' : 'Series · Cine · Libros · Audiolibros'}</div>
        <h1 class="display" style="margin-top:20px"><${Scramble} text=${L === 'en' ? 'What is Veoleo' : 'Qué es Veoleo'} /></h1>
        <div class="free-badge" style="margin-top:22px">${L === 'en' ? 'Free forever · No ads · No credit card · No API keys' : 'Gratis para siempre · Sin anuncios · Sin tarjeta · Sin claves'}</div>
        <p class="lead" style="margin-top:22px">${L === 'en'
          ? 'Your diary of everything you watch, read and listen to: episodes, ratings, notes, lists, news and people. Everything works on its own, free and without ads.'
          : 'Tu diario de todo lo que ves, lees y escuchas: episodios, valoraciones, notas, listas, noticias y gente. Todo funciona solo, gratis y sin anuncios.'}</p>
        ${isPublic && html`<div class="row" style="margin-top:26px"><a class="btn lg" href="#/">${L === 'en' ? 'Try it without an account' : 'Probar sin cuenta'}</a></div>`}
      </div></div>
      <div class="feat-grid">${F.map((f, i) => {
        const [t, d, items] = f[L];
        return html`<section class="feat" key=${i} style=${`--c:${f.c}`}>
          <div class="fn"><span>${String(i + 1).padStart(2, '0')}</span><${Icon} name=${f.ico} size=${22} /></div>
          <h2>${t}</h2><p class="fd">${d}</p>
          <ul>${items.map((x) => html`<li>${x}</li>`)}</ul>
          ${!isPublic && html`<a class="btn sm ghost" href=${f.href}>${L === 'en' ? 'Open' : 'Abrir'} →</a>`}
        </section>`;
      })}</div>
      <section class="about-contact">
        <div class="kicker">${L === 'en' ? 'Contact' : 'Contacto'}</div>
        <p class="lead">${L === 'en' ? 'Ideas, bugs or collaborations? Write to me:' : '¿Ideas, errores o colaboraciones? Escríbeme:'}</p>
        <a class="mail" href=${`mailto:${CONTACT_EMAIL}?subject=Veoleo`}>${CONTACT_EMAIL}</a>
      </section>
      <div class="row between" style="margin-top:48px;gap:20px">
        <a class="btn lg" href=${isPublic ? '#/' : '#/search'}>${isPublic ? (L === 'en' ? 'Create your account' : 'Crea tu cuenta') : (L === 'en' ? 'Add something' : 'Añadir algo')}</a>
        <${SupportButton} label=${L === 'en' ? 'Buy me a coffee' : 'Invítame a un café'} />
      </div>
    </div>
  </div>`;
}
