// Idiomas: español (texto original de la interfaz) e inglés.
// La interfaz se escribe en español; en inglés se traduce al vuelo con un diccionario
// (texto exacto) y patrones (textos con números o nombres). Fechas y números se formatean
// con el locale del idioma activo.

function readLang() {
  try {
    const saved = localStorage.getItem('vl.lang');
    if (saved === 'es' || saved === 'en') return saved;
  } catch { /* sin storage */ }
  return /^es\b/i.test(navigator.language || 'es') ? 'es' : 'en';
}
export const LANG = readLang();
export const LOCALE = LANG === 'en' ? 'en-GB' : 'es-ES';
export const DEFAULT_REGION = LANG === 'en' ? 'US' : 'ES';
export function setLang(l) {
  try { localStorage.setItem('vl.lang', l); } catch { /* sin storage */ }
  location.reload();
}

const EN = {
  // navegación y estructura
  'Inicio': 'Home', 'Novedades': "What's new", 'Guía TV': 'TV guide', 'Guía': 'Guide', 'Noticias': 'News', 'Biblioteca': 'Library', 'Listas': 'Lists',
  'Retos': 'Challenges', 'Comunidad': 'Community', 'Buscar': 'Search', 'Buscar (⌘K)': 'Search (⌘K)', 'Añadir': 'Add', 'Ajustes': 'Settings',
  'Estadísticas': 'Stats', 'Importar y exportar': 'Import & export', 'Mi perfil': 'My profile', 'Cerrar sesión': 'Sign out', 'Atrás': 'Back',
  'Silenciar': 'Mute', 'Activar sonido': 'Unmute', 'Sonido': 'Sound', 'Busca o navega…': 'Search or jump to…', 'Tu diario': 'Your diary', 'Buscar fuera': 'Search the web',
  'Ir a': 'Go to', 'moverse': 'move', 'abrir': 'open', 'cerrar': 'close', 'Paleta de comandos': 'Command palette', 'Cerrar': 'Close',
  'Fuera de plano': 'Out of frame', 'Volver al inicio': 'Back to home', 'Ir al inicio': 'Go home', 'Reintentar': 'Retry', 'Esta pantalla ha fallado': 'This screen crashed', 'Error': 'Error',
  'Invítame a un café': 'Buy me a coffee', 'Datos de TVMaze, Wikidata, IMDb, Apple, Google Books y Open Library': 'Data from TVMaze, Wikidata, IMDb, Apple, Google Books and Open Library',
  'Tu diario de series, películas, libros y audiolibros. Hecho con cariño y sin anuncios: si te gusta, puedes apoyarlo con un café.': 'Your diary of series, movies, books and audiobooks. Made with love and no ads — if you like it, you can support it with a coffee.',
  'SERIES · CINE · LIBROS · AUDIOLIBROS': 'SERIES · MOVIES · BOOKS · AUDIOBOOKS', 'Series · Cine · Libros · Audiolibros': 'Series · Movies · Books · Audiobooks',

  // acceso
  'Acceso': 'Sign in', 'Entrar': 'Sign in', 'Crear cuenta': 'Create account', 'Nueva cuenta': 'New account', 'Continuar con Google': 'Continue with Google',
  'o con email': 'or with email', 'Nombre': 'Name', 'Email': 'Email', 'Contraseña': 'Password', 'Crear una cuenta': 'Create an account', 'Ya tengo cuenta': 'I already have an account',
  '¿Olvidaste la contraseña?': 'Forgot your password?', 'Un momento…': 'One moment…', 'Todo lo que': 'Everything you', 'ves, lees': 'watch, read', 'y escuchas.': 'and listen to.',
  'Lleva la cuenta de cada episodio, puntúa, escribe tus notas y llévalas a Obsidian. Descubre estrenos, sigue a tu gente y no te pierdas ninguna noticia.': 'Track every episode, rate, write notes and take them to Obsidian. Discover premieres, follow your people and never miss the news.',
  'Episodios con sinopsis': 'Episodes with synopses', 'Tráilers y banda sonora': 'Trailers & soundtracks', 'Notas para Obsidian': 'Notes for Obsidian', 'Listas automáticas': 'Smart lists',
  'Retos de lectura': 'Reading challenges', 'Noticias de series': 'TV news', 'Importa TV Time y Goodreads': 'Import TV Time & Goodreads',
  'Escribe tu email y te enviamos un enlace para cambiar la contraseña.': "Enter your email and we'll send you a reset link.",
  'Te hemos enviado un email para cambiar la contraseña': 'We sent you an email to reset your password',
  'Email o contraseña incorrectos.': 'Wrong email or password.', 'Contraseña incorrecta.': 'Wrong password.', 'No existe ninguna cuenta con ese email.': 'No account with that email.',
  'Ya hay una cuenta con ese email.': 'There is already an account with that email.', 'La contraseña debe tener al menos 6 caracteres.': 'The password must be at least 6 characters.',
  'El email no es válido.': 'Invalid email.', 'Has cerrado la ventana de Google.': 'You closed the Google window.', 'Demasiados intentos. Espera un momento.': 'Too many attempts. Please wait.',
  'Este dominio no está autorizado en Firebase Auth.': 'This domain is not authorized in Firebase Auth.', 'Algo ha fallado.': 'Something went wrong.', 'Hola': 'Hi', 'A bordo': 'Welcome aboard',

  // tipos y estados
  'Serie': 'Series', 'Series': 'Series', 'Película': 'Movie', 'Películas': 'Movies', 'Libro': 'Book', 'Libros': 'Books', 'Audiolibro': 'Audiobook', 'Audiolibros': 'Audiobooks',
  'Vista': 'Watched', 'Leído': 'Read', 'Escuchado': 'Listened', 'Completado': 'Completed', 'Al día': 'Up to date', 'Viendo': 'Watching', 'Leyendo': 'Reading',
  'Escuchando': 'Listening', 'En curso': 'In progress', 'Must watch': 'Must watch', 'Por leer': 'To read', 'Por escuchar': 'To listen', 'Pendiente': 'Planned',
  'Abandonada': 'Dropped', 'Abandonado': 'Dropped', 'Abandonadas': 'Dropped', 'Leídos': 'Read', 'Escuchados': 'Listened', 'Visto': 'Watched',

  // inicio
  'Buenos días': 'Good morning', 'Buenas tardes': 'Good afternoon', 'Buenas noches': 'Good evening', 'Sigue donde lo dejaste': 'Pick up where you left off',
  'Lo último en tu diario': 'Latest in your diary', 'Continuar': 'Continue', 'Abrir ficha': 'Open', 'Tu año': 'Your year', 'Series vistas': 'Series watched',
  'Películas vistas': 'Movies watched', 'Libros leídos': 'Books read', 'Horas de pantalla · total': 'Screen hours · total', 'En curso ': 'In progress',
  'Seguir viendo y leyendo': 'Keep watching & reading', 'Para ti': 'For you', 'Te puede gustar': 'You might like', 'Diario': 'Diary', 'Recientes': 'Recent',
  'Pendientes': 'To do', 'Must watch y por leer': 'Must watch & to read', 'Ver lista': 'See list', 'Lo último del mundo serie': 'Latest from the TV world', 'Todas': 'All',
  'Gente que sigues': 'People you follow', 'Explorar': 'Explore', 'Todavía no sigues a nadie. Encuentra gente en': "You don't follow anyone yet. Find people in",
  'y verás aquí lo que ven y leen.': "and you'll see what they watch and read here.", 'Sin actividad reciente.': 'No recent activity.', 'Tu diario': 'Your diary',
  'empieza aquí.': 'starts here.', 'Importar historial': 'Import history', 'Ver novedades': "See what's new",
  'Busca una serie, una película, un libro o un audiolibro y regístralo con su valoración, tus notas y los episodios que vas viendo. O importa tu historial de TV Time, Letterboxd o Goodreads.': 'Search for a series, movie, book or audiobook and log it with your rating, notes and the episodes you watch. Or import your history from TV Time, Letterboxd or Goodreads.',
  'Nota': 'Note',

  // novedades
  'Estrenos · Tendencias · Calendario': 'Premieres · Trending · Calendar', 'Plataforma': 'Platform', 'Tu calendario': 'Your calendar', 'Próximos episodios': 'Upcoming episodes',
  'Guía TV completa': 'Full TV guide', 'Ninguna de tus series tiene episodios anunciados por ahora.': 'None of your series has announced episodes yet.',
  'Recomendado': 'Recommended', 'Streaming': 'Streaming', 'Estrenos de series': 'Series premieres', 'Próximos días': 'Coming days', 'Llegan pronto': 'Coming soon',
  'Lo más visto': 'Most watched', 'Películas del momento': 'Trending movies', 'Top audiolibros': 'Top audiobooks', 'Para escuchar': 'To listen to', 'Top libros': 'Top books',
  'Para leer': 'To read', 'Tendencia': 'Trending', 'Series en tendencia': 'Trending series', 'Triunfa entre la gente que sigues': 'Hits among people you follow',
  'No hay estrenos para ese filtro ahora mismo.': 'No premieres for that filter right now.', 'Nueva serie': 'New series', 'Hoy': 'Today', 'Mañana': 'Tomorrow',

  // guía
  'Episodios · Estrenos · Parrilla': 'Episodes · Premieres · Schedule', 'Mis series': 'My series', 'Programación': 'Schedule', 'Ya emitidos': 'Already aired',
  'Te faltan por ver': "You haven't watched", 'Marcar visto': 'Mark watched', 'Nada en el horizonte': 'Nothing on the horizon', 'Por anunciar': 'TBA',
  'Cuando sigas series en emisión (Viendo, Al día o Must watch) verás aquí sus próximos episodios y los que te faltan por ver.': "When you follow airing series (Watching, Up to date or Must watch) you'll see their upcoming episodes and the ones you haven't watched here.",
  'Buscar una serie': 'Search a series', 'Ver': 'Show', 'Solo mis series': 'Only my series', 'Solo estrenos': 'Only premieres', 'Español e inglés': 'Spanish & English',
  'Canal': 'Channel', 'Todos': 'All', 'Canales de TV del país': 'TV channels of the country', 'TV España': 'TV Spain', 'TV EE. UU.': 'TV USA', 'TV Reino Unido': 'TV UK',
  'TV México': 'TV Mexico', 'TV Argentina': 'TV Argentina', 'EMISIONES': 'AIRINGS', 'Estreno de temporada': 'Season premiere', 'En tu diario': 'In your diary',
  'No hay emisiones con esos filtros.': 'No airings with those filters.',

  // noticias
  'Buscar en noticias…': 'Search news…', 'Todo': 'All', 'Cine': 'Movies', 'Plataformas': 'Platforms', 'Guardadas': 'Saved', 'Idioma': 'Language', 'Español': 'Spanish',
  'Internacional': 'International', 'Medio': 'Outlet', 'Leer en': 'Read on', 'Cargar más': 'Load more', 'Guardar': 'Save', 'Quitar de guardadas': 'Remove from saved',
  'No hay noticias con esos filtros.': 'No news with those filters.', 'medios · actualizado': 'outlets · updated',
  'Aún no has guardado noticias. Pulsa el marcador de cualquier noticia para tenerla aquí.': "You haven't saved any news yet. Tap the bookmark on any story to keep it here.",
  'SERIES · ': 'SERIES · ', 'CINE · ': 'MOVIES · ', 'PLATAFORMAS · ': 'PLATFORMS · ',

  // buscar
  'Buscar series': 'Search series', 'Crear a mano': 'Create manually', 'Sin resultados': 'No results', 'Nada para “': 'Nothing for “',
  'Prueba con el título original o créalo a mano: podrás añadir portada, tráiler y todo lo demás.': 'Try the original title or create it manually: you can add a cover, trailer and everything else.',
  'Crear “': 'Create “', 'Escribe un título. Enter abre el primer resultado.': 'Type a title. Enter opens the first result.', 'RESULTADOS PARA “': 'RESULTS FOR “',
  'Vista previa': 'Preview', 'Fuente · ': 'Source · ', 'Ya está en tu diario': 'Already in your diary', 'Cargando tráiler, banda sonora y ficha': 'Loading trailer, soundtrack and details',
  'Tráiler': 'Trailer', 'Banda sonora': 'Soundtrack', 'Reparto': 'Cast', 'Estreno': 'Premiere', 'Próximo': 'Next', 'Episodios': 'Episodes', 'Páginas': 'Pages',
  'Editorial': 'Publisher', 'Música': 'Music', 'Dónde verlo': 'Where to watch', 'Consulta las plataformas en JustWatch.': 'Check platforms on JustWatch.',
  'Stream it or skip it': 'Stream it or skip it', 'Dirección': 'Director', 'Creación': 'Created by', 'Autoría': 'Author',

  // biblioteca y filtros
  'Estado': 'Status', 'Ranking': 'Rating', 'Cualquiera': 'Any', 'Afinar': 'Refine', 'Todos los años': 'All years', 'Todos los géneros': 'All genres',
  'Cualquier plataforma': 'Any platform', 'Leído o escuchado': 'Read or listened', 'Recientes ': 'Recent', 'Fecha de fin': 'Finish date', 'Mejor valoradas': 'Top rated',
  'Título A–Z': 'Title A–Z', 'Año de estreno': 'Release year', 'Título, autoría, etiqueta…': 'Title, author, tag…', 'Limpiar filtros': 'Clear filters',
  'Nada coincide con esos filtros.': 'Nothing matches those filters.', 'RESULTADO': 'RESULT', 'RESULTADOS': 'RESULTS', 'Vacía,': 'Empty,', 'de momento.': 'for now.',
  'Busca tu primera serie, película o libro, o trae tu historial de TV Time, Letterboxd o Goodreads.': 'Search your first series, movie or book, or bring your history from TV Time, Letterboxd or Goodreads.',
  'Importar': 'Import', 'Exportar': 'Export',

  // exportar
  'Bóveda de Obsidian (.zip)': 'Obsidian vault (.zip)', 'Una nota por título en carpetas por tipo, con portada, valoración, episodios y tu nota. Índice con Dataview, listas y snippet CSS.': 'One note per title in folders by type, with cover, rating, episodes and your note. Dataview index, lists and CSS snippet.',
  'Obsidian completo': 'Full Obsidian vault', 'Todo tu diario como bóveda de Obsidian: una nota por título con portada, valoración, episodios con sinopsis y tu nota, más índice con Dataview y listas.': 'Your whole diary as an Obsidian vault: one note per title with cover, rating, episodes with synopses and your note, plus a Dataview index and lists.', 'Bóveda .zip': 'Vault .zip', 'Un solo .md': 'Single .md', 'Más formatos': 'More formats', 'CSV, Letterboxd o Goodreads.': 'CSV, Letterboxd or Goodreads.',
  'Un único Markdown': 'A single Markdown', 'Todas las notas en un solo archivo .md.': 'All notes in a single .md file.', 'Hoja de cálculo (CSV)': 'Spreadsheet (CSV)',
  'Título, tipo, estado, valoración, fechas, plataforma y más.': 'Title, type, status, rating, dates, platform and more.', 'CSV para Letterboxd': 'CSV for Letterboxd',
  'Tus películas en el formato de importación de Letterboxd.': 'Your movies in Letterboxd import format.', 'CSV para Goodreads': 'CSV for Goodreads',
  'Tus libros en el formato de importación de Goodreads.': 'Your books in Goodreads import format.', 'Copia de seguridad (JSON)': 'Backup (JSON)',
  'Todo, incluidas tus notas. Se puede volver a importar.': 'Everything, including your notes. It can be imported again.', 'Exportado': 'Exported',
  ' · INCLUYE EPISODIOS CON SINOPSIS': ' · INCLUDES EPISODES WITH SYNOPSES', 'Falló la exportación: ': 'Export failed: ',

  // ficha
  'Editar': 'Edit', 'Compartir': 'Share', 'Copiar Markdown': 'Copy Markdown', 'Actualizar datos': 'Refresh data', 'Eliminar': 'Delete', 'Resumen': 'Overview',
  'Nota ': 'Note', 'Comentarios': 'Comments', 'Temporadas': 'Seasons', 'Markdown · Obsidian': 'Markdown · Obsidian', 'Mi nota': 'My note', 'Vídeo': 'Video',
  'Intérpretes': 'Performers', 'Conversación': 'Conversation', 'Narración': 'Narrator', 'Géneros': 'Genres', 'Publicado': 'Published', 'Progreso': 'Progress',
  'Lo vi en': 'Watched on', 'Empezado': 'Started', 'Terminado': 'Finished', 'Revisionado': 'Rewatched', 'Etiquetas': 'Tags', 'Enlaces': 'Links',
  'Sin datos de plataforma.': 'No platform data.', 'Sin sinopsis.': 'No synopsis.', 'Pulsa actualizar para buscarla.': 'Tap refresh to look for it.',
  'No disponible': 'Not available', 'Esta entrada no existe o es privada.': 'This entry does not exist or is private.', 'Privada': 'Private',
  'Se borrará de tu diario junto con su nota. No se puede deshacer.': 'It will be removed from your diary along with its note. This cannot be undone.',
  'Cancelar': 'Cancel', 'Eliminada': 'Deleted', 'Actualizado': 'Updated', 'Markdown copiado': 'Markdown copied', 'Nota .md descargada': '.md note downloaded',
  'Web oficial ↗': 'Official site ↗', 'En emisión': 'Running', 'Finalizada': 'Ended', 'Renovada': 'Renewed', 'Cancelada': 'Canceled', 'Por decidir': 'TBD',
  'En producción': 'In production', 'En desarrollo': 'In development', 'Reproducir tráiler': 'Play trailer', 'Ver tráiler en YouTube ↗': 'Watch trailer on YouTube ↗',
  'Música original de': 'Original music by', 'Muestra del audiolibro': 'Audiobook sample', 'Escuchar 30 s': 'Listen 30 s', 'Pausar': 'Pause',

  // episodios
  'Vistos': 'Watched', 'Tiempo': 'Time', 'Temporada entera vista': 'Whole season watched', 'VISTA': 'WATCHED', 'TODA': 'ALL', 'Sin fecha': 'No date',
  ' · Próximamente': ' · Coming soon', 'Pulsa para leer entera': 'Tap to read all', 'Visto hasta aquí': 'Watched up to here', 'Marcar como visto': 'Mark as watched',
  'No hay guía de episodios disponible para este título.': 'No episode guide available for this title.', 'Serie vista': 'Series watched',

  // nota y social
  'Escribir': 'Write', 'Nota pública': 'Public note', 'Nota privada': 'Private note', 'Guardar nota': 'Save note', 'Nota guardada': 'Note saved',
  'Todavía no has escrito nada.': "You haven't written anything yet.", 'La nota es privada.': 'The note is private.', 'Sin nota.': 'No note.',
  'Lo que te ha parecido. Markdown y callouts de Obsidian: **negrita**, > citas, - listas, > [!tip]…': 'What did you think? Markdown and Obsidian callouts: **bold**, > quotes, - lists, > [!tip]…',
  'La entrada es privada: hazla visible para publicar la nota': 'The entry is private: make it visible to publish the note',
  'Todavía no hay comentarios.': 'No comments yet.', 'Escribe un comentario…': 'Write a comment…', 'Enviar': 'Send', 'Borrar': 'Delete', 'Borrar comentario': 'Delete comment',
  'GUARDANDO…': 'SAVING…', 'CAMBIOS SIN GUARDAR': 'UNSAVED CHANGES', 'Negrita': 'Bold', 'Cursiva': 'Italic', 'Título': 'Title', 'Cita': 'Quote', 'Lista': 'List',
  'Tarea': 'Task', 'Callout de Obsidian': 'Obsidian callout', 'Spoiler plegable': 'Collapsible spoiler',

  // formulario
  'Añadir a tu diario': 'Add to your diary', 'Nueva entrada': 'New entry', 'Valoración': 'Rating', 'Se guardará en tu lista Abandonadas.': 'It will go to your Dropped list.',
  'Se guardará en': 'It will go to', 'Revisionados': 'Rewatches', 'Dónde lo ves': 'Where you watch it', '¿Dónde lo leíste?': 'Where did you read it?',
  '¿Dónde lo escuchaste?': 'Where did you listen to it?', 'Quién lo narra': 'Narrated by', 'comfort, relectura, con amigos…': 'comfort, reread, with friends…',
  'Visible en tu perfil': 'Visible on your profile', 'Solo para ti': 'Only for you', '— la nota tiene su propia privacidad': '— the note has its own privacy',
  'Datos de la ficha': 'Entry details', 'Año': 'Year', 'Fecha de estreno / publicación': 'Release / publication date', 'Portada (URL)': 'Cover (URL)',
  'Imagen de fondo (URL)': 'Background image (URL)', 'Tráiler de YouTube': 'YouTube trailer', 'Guardando…': 'Saving…', 'Guardar cambios': 'Save changes',
  'Falta el título': 'Title is missing', 'Añadido': 'Added', 'En la lista': 'On the list', 'Guardado': 'Saved', 'Abandonada ': 'Dropped', 'Editar ': 'Edit',
  'Papel': 'Paper', 'Otro': 'Other', 'Cine ': 'Cinema', 'TV': 'TV',

  // listas
  'Colecciones': 'Collections', 'Nueva lista': 'New list', 'Automáticas': 'Automatic', 'Personales': 'Personal', 'Mis listas': 'My lists',
  'Crea listas a mano o automáticas con tus propias reglas. Algunas ideas:': 'Create manual lists or smart lists with your own rules. Some ideas:',
  'Por año': 'By year', 'Archivo': 'Archive', 'Automática · ': 'Smart · ', 'título': 'title', 'títulos': 'titles', 'VACÍA': 'EMPTY', 'Series y películas pendientes': 'Series and movies to watch',
  'Por leer y escuchar': 'To read & listen', 'Libros y audiolibros pendientes': 'Books and audiobooks to go', 'Lo que estás viendo, leyendo o escuchando': "What you're watching, reading or listening to",
  'Series en emisión que llevas al día': "Airing series you're up to date with", 'Lo que dejaste a medias': 'What you left halfway', 'Obras maestras': 'Masterpieces',
  'Todo lo que tiene 5 estrellas': 'Everything rated 5 stars', 'Thrillers de 4★ o más': 'Thrillers 4★ or more', 'Audiolibros escuchados': 'Audiobooks listened',
  'Para ver en compañía': 'To watch together', 'Editar lista': 'Edit list', 'Sin nombre': 'Untitled', 'Series de culto': 'Cult series', 'Descripción': 'Description',
  'Tipo': 'Type', 'Manual': 'Manual', 'Automática': 'Smart', 'Añades títulos desde «Editar» en cada ficha.': 'Add titles from "Edit" on each entry.',
  'Se rellena sola con todo lo que cumpla las reglas.': 'Fills itself with everything that matches the rules.', 'Tipos': 'Types', 'Años': 'Years', 'Desde': 'From',
  'Hasta': 'To', 'Mínimo': 'Minimum', 'Formato': 'Format', 'Pública en tu perfil': 'Public on your profile', 'Guardar lista': 'Save list', 'Lista guardada': 'List saved',
  'Ponle nombre a la lista': 'Give the list a name', 'Lista': 'List', 'Lista automática': 'Smart list', 'Nota de lista (.md)': 'List note (.md)', 'Eliminar lista': 'Delete list',
  'ORDEN': 'SORT', 'Quitar': 'Remove', 'Añade títulos desde «Editar» en cada ficha.': 'Add titles from "Edit" on each entry.', 'Lista eliminada': 'List deleted',
  'Cuando algo cumpla las reglas aparecerá aquí.': 'When something matches the rules it will show up here.', 'No existe o es privada.': "It doesn't exist or is private.",
  'Se borra la lista; los títulos siguen en tu diario.': 'The list is deleted; the titles stay in your diary.',

  // retos
  'Retos de lectura y visionado': 'Reading & watching challenges', 'Objetivos': 'Goals', 'Guardar objetivos': 'Save goals', 'Los audiolibros cuentan como libros': 'Audiobooks count as books',
  'Ponte un objetivo': 'Set a goal', 'Sin retos este año': 'No challenges this year', 'Ritmo': 'Pace', 'Mes a mes': 'Month by month', 'CUMPLIDO': 'DONE',
  'Reto cumplido': 'Challenge completed', 'Reto aceptado': 'Challenge accepted',

  // estadísticas
  'Títulos terminados': 'Titles finished', 'De pantalla': 'Screen time', 'Páginas ': 'Pages', 'Nota media': 'Average rating', 'Actividad': 'Activity',
  'Cada día cuenta': 'Every day counts', 'Por mes': 'By month', 'Terminados': 'Finished', 'Tus notas': 'Your ratings', 'Distribución': 'Distribution', 'Géneros ': 'Genres',
  'Lo que más te gusta': 'What you love most', 'Dónde': 'Where', 'Recurrentes': 'Recurring', 'Lo mejor': 'The best', 'Tus favoritos': 'Your favorites',
  'Sin datos todavía.': 'No data yet.', 'Siempre': 'All time',

  // comunidad
  'Gente · Actividad pública': 'People · Public activity', 'Invitar': 'Invite', 'En directo': 'Live', 'Personas': 'People', '@usuario': '@username',
  'Nadie por aquí todavía.': 'Nobody here yet.', 'Todavía no hay actividad pública de otras personas. Invita a tus amigos.': 'No public activity from others yet. Invite your friends.',
  'Seguir': 'Follow', 'Siguiendo': 'Following', 'Seguidores': 'Followers', 'Editar perfil': 'Edit profile', 'Compartir perfil': 'Share profile', 'Perfil no encontrado': 'Profile not found',
  'Nada público todavía.': 'Nothing public yet.', 'Sin listas públicas.': 'No public lists.',

  // ajustes
  'Cuenta y preferencias': 'Account & preferences', 'Perfil': 'Profile', 'Preferencias': 'Preferences', 'Cuenta': 'Account', 'Usuario': 'Username', 'Bio': 'Bio',
  'Foto (URL)': 'Photo (URL)', 'Ver perfil público': 'View public profile', 'Guardar perfil': 'Save profile', 'Perfil guardado': 'Profile saved',
  'Efectos al abrir y guardar': 'Effects when opening and saving', 'Sonidos de interfaz': 'Interface sounds', 'Volumen': 'Volume',
  'Animación de entrada al abrir la app': 'Intro animation when opening the app', 'Región': 'Region', 'País de las novedades': "Country for what's new",
  'Rankings de películas, libros y audiolibros de ese país.': 'Movie, book and audiobook charts from that country.', 'País actualizado': 'Country updated',
  'Atajos': 'Shortcuts', 'Teclado': 'Keyboard', 'Buscar en todo y navegar': 'Search everything and navigate', 'Ir al buscador': 'Go to search', 'Cerrar ventanas': 'Close windows',
  'Así se exporta cada título a Obsidian. Usa': 'This is how each title is exported to Obsidian. Use', 'y bloques condicionales': 'and conditional blocks',
  'Plantilla': 'Template', 'Campos disponibles': 'Available fields', 'Nombre de archivo': 'File name', 'EJEMPLO:': 'EXAMPLE:', 'Episodios en la nota': 'Episodes in the note',
  'Todos, con sinopsis': 'All, with synopses', 'Solo los vistos': 'Only watched', 'No incluir': "Don't include", 'Restaurar original': 'Restore original',
  'Snippet CSS': 'CSS snippet', 'Guardar plantilla': 'Save template', 'Plantilla guardada': 'Template saved', 'Plantilla original restaurada (falta guardar)': 'Original template restored (not saved yet)',
  'Acceso ': 'Sign-in', 'Email y contraseña': 'Email & password', 'Importar y exportar datos': 'Import & export data', 'España': 'Spain', 'México': 'Mexico',
  'Estados Unidos': 'United States', 'Reino Unido': 'United Kingdom', 'Idioma ': 'Language', 'Es gratis y sin anuncios. Si quieres apoyarlo, invítame a un café.': "It's free and ad-free. If you want to support it, buy me a coffee.",

  // datos
  'Importar · Exportar · Copias': 'Import · Export · Backups', 'Tus datos': 'Your data', 'Trae tu historial': 'Bring your history', 'Elegir archivos': 'Choose files',
  'Leyendo archivos…': 'Reading files…', 'Importando…': 'Importing…', 'Completando portadas, episodios y estados…': 'Filling in covers, episodes and statuses…',
  'Formato detectado': 'Detected format', 'Episodios vistos': 'Episodes watched', 'Completar portadas, episodios y estados automáticamente (recomendado)': 'Fill in covers, episodes and statuses automatically (recommended)',
  'Importación completada': 'Import completed', 'Ver biblioteca': 'See library', 'Importar otro servicio': 'Import another service', 'Importar de nuevo': 'Import again',
  'O suelta aquí cualquier archivo (ZIP, CSV o JSON): el formato se detecta solo': 'Or drop any file here (ZIP, CSV or JSON): the format is detected automatically',
  'Llévatelo': 'Take it with you', 'Formato TV Time': 'TV Time format', 'Obsidian y más': 'Obsidian & more', 'Copia de seguridad': 'Backup', 'Copia de Veoleo': 'Veoleo backup',
  'Episodios vistos, series seguidas y películas con la misma estructura que la descarga de datos de TV Time. Ideal para bingers que cambian de app.': 'Watched episodes, followed series and movies with the same structure as the TV Time data download. Perfect for bingers switching apps.',
  'Bóveda de Markdown con Dataview, un único .md, CSV, Letterboxd o Goodreads.': 'Markdown vault with Dataview, a single .md, CSV, Letterboxd or Goodreads.',
  'CSV de episodios y películas vistos para importar en Trakt.': 'CSV of watched episodes and movies to import into Trakt.',
  'JSON con todas tus entradas, notas y listas. Se puede volver a importar.': 'JSON with all your entries, notes and lists. It can be imported again.',
  'Pide tus datos en tvtime.com → Ajustes → «Solicitar mis datos» (GDPR). Recibirás un ZIP: súbelo tal cual o sus CSV.': 'Request your data on tvtime.com → Settings → "Request my data" (GDPR). You will get a ZIP: upload it as is or its CSVs.',
  'netflix.com → Cuenta → Perfiles → tu perfil → «Actividad de visionado» → «Descargar todo». Sube NetflixViewingHistory.csv.': 'netflix.com → Account → Profiles → your profile → "Viewing activity" → "Download all". Upload NetflixViewingHistory.csv.',
  'letterboxd.com → Settings → Import & Export → Export your data. Sube el ZIP o diary.csv / ratings.csv / watchlist.csv.': 'letterboxd.com → Settings → Import & Export → Export your data. Upload the ZIP or diary.csv / ratings.csv / watchlist.csv.',
  'goodreads.com → My Books → Import and export → Export Library. Sube goodreads_library_export.csv.': 'goodreads.com → My Books → Import and export → Export Library. Upload goodreads_library_export.csv.',
  'imdb.com → Your ratings / Watchlist → Export. Sube el CSV.': 'imdb.com → Your ratings / Watchlist → Export. Upload the CSV.',
  'Una copia de seguridad JSON exportada desde esta misma app (incluye notas).': 'A JSON backup exported from this app (includes notes).',
  'No se han encontrado ficheros CSV o JSON reconocibles.': 'No recognizable CSV or JSON files were found.',
  '¿Conectar Netflix, Movistar Plus+, HBO Max o Prime Video para que se añada solo lo que ves? Ninguna de estas plataformas ofrece una conexión pública para apps de terceros. Netflix sí permite descargar tu historial completo: impórtalo aquí cuando quieras y Veoleo añade lo nuevo y salta lo que ya tienes.': "Connect Netflix, Movistar Plus+, HBO Max or Prime Video so what you watch is added automatically? None of these platforms offers a public connection for third-party apps. Netflix does let you download your full history: import it here whenever you like and Veoleo adds what's new and skips what you already have.",

  // toasts y mensajes
  'Enlace copiado': 'Link copied', 'Copia el enlace:': 'Copy the link:', 'Guardar ': 'Save', 'No se pudo guardar: ': "Couldn't save: ", 'No se pudo actualizar: ': "Couldn't refresh: ",
  'No se pudo guardar la nota: ': "Couldn't save the note: ", 'No se pudo comentar: ': "Couldn't comment: ", 'No se pudo guardar el me gusta': "Couldn't save the like",
  'Falló la importación: ': 'Import failed: ', 'No se pudo cargar tu perfil: ': "Couldn't load your profile: ", 'Necesitas iniciar sesión': 'You need to sign in',
  'Cargando': 'Loading', 'Obra maestra': 'Masterpiece', 'Al día ': 'Up to date', 'Exportar a Markdown': 'Export to Markdown', 'Copiar enlace': 'Copy link',

  'Automática ·': 'Smart ·', 'Por ejemplo: 24 libros, 12 series y 50 películas en': 'For example: 24 books, 12 series and 50 movies in',
  '· Próximamente': '· Coming soon', 'Español': 'Spanish',


  // comunidad, publicaciones y perfil
  '¿Qué estás viendo, leyendo o escuchando?': 'What are you watching, reading or listening to?', 'Busca en tu diario…': 'Search your diary…',
  'Nada en tu diario con ese nombre.': 'Nothing in your diary with that name.', 'Cambiar título': 'Change title', 'Adjuntar título': 'Attach title', 'Spoiler': 'Spoiler',
  'Publicando…': 'Posting…', 'Publicar': 'Post', 'No se pudo responder: ': "Couldn't reply: ", 'Borrar respuesta': 'Delete reply', 'Responder…': 'Reply…', 'Responder': 'Reply',
  'Spoiler · pulsa para ver': 'Spoiler · tap to reveal', 'Me gusta': 'Like', 'Todavía no hay publicaciones.': 'No posts yet.', 'Publicado': 'Posted',
  'Escribe algo o elige un título': 'Write something or pick a title', '¿Borrar esta publicación?': 'Delete this post?', 'Compartir en Comunidad': 'Share to Community',
  'Personalizar perfil': 'Customize profile', 'Portada y color': 'Cover & color', 'Sin portada': 'No cover', 'Encuadre vertical': 'Vertical framing', 'Color de acento': 'Accent color',
  'De tu diario': 'From your diary', 'Buscar imágenes': 'Search images', 'URL': 'URL', 'Busca una serie o película: Severance, Dune, The Bear…': 'Search a series or movie: Severance, Dune, The Bear…',
  'Usar': 'Use', 'Imágenes panorámicas de TVMaze y pósters de películas.': 'Wide images from TVMaze and movie posters.',
  'Añade series y películas a tu diario para usar sus imágenes.': 'Add series and movies to your diary to use their images.', 'Sin imágenes para esa búsqueda.': 'No images for that search.',
  'Perfil actualizado': 'Profile updated', 'Top 4': 'Top 4', 'Elige un favorito': 'Pick a favorite', 'Nada con ese filtro.': 'Nothing with that filter.', '+ FAVORITO': '+ FAVORITE',
  'Qué ve, lee y escucha la gente': 'What people watch, read and listen to', 'Para todos': 'Everyone', 'Diarios': 'Diaries',
  'Cuando sigas a gente, aquí verás lo que comparten.': "When you follow people, you'll see what they share here.",
  'Nadie ha publicado todavía. ¡Estrena el muro: cuenta qué estás viendo!': "Nobody has posted yet. Break the ice: tell everyone what you're watching!",
  'Publicación no encontrada': 'Post not found', 'Ir a Comunidad': 'Go to Community', 'Ahora mismo': 'Right now', 'Favoritos': 'Favorites', 'Publicaciones': 'Posts',
  'Comparte qué estás viendo: aparecerá aquí y en Comunidad.': "Share what you're watching: it will show up here and in Community.", 'Sin publicaciones todavía.': 'No posts yet.',
  'Web o red social': 'Website or social', 'Ubicación': 'Location', 'Portada y color del perfil': 'Profile cover & color', 'letterboxd.com/tu-usuario': 'letterboxd.com/your-username',
  'Qué es Veoleo': 'What is Veoleo', 'Contacto:': 'Contact:', 'Qué puedes hacer en Veoleo →': 'What you can do on Veoleo →', 'Language': 'Language', 'Obsidian': 'Obsidian',

  'Privacidad': 'Privacy', 'Quién ve tu diario': 'Who sees your diary',
  'Tu email nunca se muestra a nadie. Lo público solo lo ven personas con cuenta en Veoleo; lo privado solo tú. Las notas tienen su propia privacidad y una nota nunca es visible si su entrada es privada.': 'Your email is never shown to anyone. Public items are only visible to people with a Veoleo account; private ones only to you. Notes have their own privacy and a note is never visible if its entry is private.',
  'Lo que añada o importe será privado por defecto': 'Make everything I add or import private by default', 'Lo nuevo será privado': 'New items will be private', 'Lo nuevo será público': 'New items will be public',
  'Hacer todo privado': 'Make everything private', 'Hacer todo público': 'Make everything public', 'Aplicando…': 'Applying…',
  '¿Hacer privado todo tu diario? Nadie más podrá ver tus entradas ni tus notas.': 'Make your whole diary private? Nobody else will be able to see your entries or notes.',
  '¿Hacer público todo tu diario? Las notas seguirán siendo privadas salvo que las publiques.': 'Make your whole diary public? Notes stay private unless you publish them.',
  'Esta entrada es privada: al publicar, el título y tu progreso serán visibles en Comunidad.': 'This entry is private: posting will show its title and your progress in Community.',

  'Buscando sinopsis…': 'Looking for a synopsis…', 'Más': 'More', 'Secciones': 'Sections', 'Más secciones': 'More sections', 'Mi perfil': 'My profile',


  // importar de plataformas y guía
  'Pegar lista': 'Paste list', 'Plataformas': 'Platforms', 'Canales de TV': 'TV channels', 'Todas': 'All',
  'La sesión había caducado. Cierra sesión, vuelve a entrar e importa de nuevo: lo que ya se guardó no se duplicará.': "Your session had expired. Sign out, sign back in and import again: anything already saved won't be duplicated.",
  'amazon.es → Cuenta → «Solicitar mis datos» → Prime Video. Amazon te envía un ZIP: sube el CSV del historial de visionado (o el ZIP entero).': 'amazon.com → Account → "Request your data" → Prime Video. Amazon sends you a ZIP: upload the viewing history CSV (or the whole ZIP).',
  'privacy.apple.com → «Obtener una copia de tus datos» → Apple Media Services. Sube el CSV de actividad de la app TV. También puedes pegar la lista.': 'privacy.apple.com → "Get a copy of your data" → Apple Media Services. Upload the TV app activity CSV. You can also paste the list.',
  'Disney+ no ofrece descarga del historial. Copia los títulos de «Seguir viendo» y tu lista y pégalos aquí, uno por línea.': 'Disney+ has no history download. Copy the titles from "Continue watching" and your list and paste them here, one per line.',
  'HBO Max no permite descargar el historial. Pega los títulos que has visto, uno por línea («Serie: Temporada 1: Episodio» o solo el título).': 'HBO Max has no history download. Paste the titles you watched, one per line ("Series: Season 1: Episode" or just the title).',
  'Movistar Plus+ no tiene exportación. Pega la lista de lo que has visto, uno por línea; se marca con la plataforma Movistar Plus+.': 'Movistar Plus+ has no export. Paste what you watched, one per line; it will be tagged with Movistar Plus+.',
  'Filmin no tiene exportación. Copia los títulos de «Vistas» o «Mi lista» y pégalos aquí, uno por línea.': 'Filmin has no export. Copy the titles from "Watched" or "My list" and paste them here, one per line.',
  'SkyShowtime no tiene exportación. Pega los títulos, uno por línea.': 'SkyShowtime has no export. Paste the titles, one per line.',


  // tarjetas para compartir
  'He terminado': 'I finished', 'He visto': 'I watched', 'He leído': 'I read', 'He escuchado': 'I listened to', 'Al día con': 'Up to date with',
  'Estoy viendo': "I'm watching", 'Estoy leyendo': "I'm reading", 'Estoy escuchando': "I'm listening to", 'En mi lista': 'On my list', 'He abandonado': 'I dropped',
  'Temporada': 'Season', 'Horas': 'Hours', 'Minutos': 'Minutes', 'Veces vista': 'Times watched', 'Día': 'Day', 'Días': 'Days',
  '★ Obra maestra': '★ Masterpiece', 'Maratón': 'Binge', 'Lectura larga': 'Long read', 'Revisionado': 'Rewatch',
  'Tarjeta para Instagram': 'Instagram card', 'Tarjeta': 'Card', 'Compartir enlace': 'Share link', 'Color': 'Color', 'Insignias': 'Badges',
  'Incluir un trozo de mi nota': 'Include part of my note', "Incluir mi nota (aún no has escrito)": "Include my note (you haven't written one yet)",
  'En el móvil, «Compartir» abre Instagram, WhatsApp y el resto de apps. En el ordenador se descarga el PNG.': 'On your phone, "Share" opens Instagram, WhatsApp and other apps. On a computer the PNG is downloaded.',
  'Imagen descargada: súbela a Instagram desde tu galería': 'Image downloaded: upload it to Instagram from your gallery', 'Tarjeta lista': 'Card ready',
  'Story 9:16': 'Story 9:16', 'Post 4:5': 'Post 4:5', 'PNG': 'PNG',


  // excel
  'Excel con portadas': 'Excel with covers', 'Excel con portadas (.xlsx)': 'Excel with covers (.xlsx)', 'Descargar .xlsx': 'Download .xlsx',
  'Una hoja por tipo con portada, estado, estrellas, fechas, progreso, plataforma y tus notas, más una hoja de resumen. Filtros y cabecera fija.': 'One sheet per type with cover, status, stars, dates, progress, platform and your notes, plus a summary sheet. Filters and frozen header.',
  'Una hoja por tipo con portada, estado, estrellas, fechas, progreso y tus notas, más un resumen.': 'One sheet per type with cover, status, stars, dates, progress and your notes, plus a summary.',
  'No hay títulos de ese año': 'No titles from that year', 'Resumen ': 'Summary', 'Todo tu diario': 'Your whole diary', 'exportado el': 'exported on', 'Total': 'Total',
  'Portada': 'Cover', 'Autoría': 'Author', 'Enlace': 'Link',

  'A las que ya tienes se les completan las fechas (empezado, último episodio visto y terminado) con las de este archivo.': 'Titles you already have get their dates (started, last episode watched and finished) filled in from this file.',

  'Movida a tu lista Abandonadas': 'Moved to your Dropped list', 'Abandonar serie': 'Drop series',

  'No lo sé · Otros años': "Don't know · Other years", 'Otro año…': 'Another year…', 'Otro año': 'Another year', 'Otros años': 'Other years', 'En «Otros años»': 'In "Other years"',
  '¿Qué año lo viste?': 'What year did you watch it?', '¿Qué año lo terminaste?': 'What year did you finish it?', '¿Cuándo lo dejaste?': 'When did you drop it?',
  'Irá a «Otros años»: cuenta en tu diario pero no en las listas ni retos de un año concreto.': 'It will go to "Other years": it counts in your diary but not in lists or challenges for a specific year.',
  'Movida a «Otros años»': 'Moved to "Other years"', 'Año actualizado': 'Year updated',

  'Sonido activado': 'Sound on', 'Sonido silenciado': 'Sound muted',


  // invitados y «gratis para siempre»
  'Probar sin cuenta': 'Try it without an account', 'Con una biblioteca de ejemplo · en un clic': 'With a sample library · one click', 'o crea tu diario': 'or create your diary',
  'Gratis para siempre · Sin anuncios · Sin tarjeta': 'Free forever · No ads · No credit card', 'Gratis para siempre': 'Free forever',
  'Veoleo es y será gratis para siempre: sin anuncios, sin suscripciones y sin vender tus datos.': 'Veoleo is and will always be free: no ads, no subscriptions and no selling your data.',
  'Modo invitado.': 'Guest mode.', 'Prueba todo lo que quieras: Veoleo es gratis para siempre.': 'Try everything you want: Veoleo is free forever.',
  'Crea tu cuenta para no perder tu diario.': "Create your account so you don't lose your diary.", 'Guardar mi diario': 'Save my diary', 'Guarda tu diario': 'Save your diary',
  'Crea tu cuenta y todo lo que has hecho como invitado se queda: títulos, episodios, notas y listas. Sin anuncios ni suscripciones, nunca.': 'Create your account and everything you did as a guest stays: titles, episodes, notes and lists. No ads or subscriptions, ever.',
  'Crear cuenta y guardar': 'Create account and save', 'Diario guardado': 'Diary saved', 'Bienvenida': 'Welcome', 'Invitado': 'Guest',
  'Para': 'To', 'publicar': 'post', 'comentar': 'comment', 'responder': 'reply', 'necesitas una cuenta (gratis para siempre). Tu diario de prueba se conserva.': 'you need an account (free forever). Your trial diary is kept.',
  'Si cierras la sesión de invitado perderás este diario de prueba. ¿Seguro?': "If you sign out of guest mode you'll lose this trial diary. Are you sure?",
  'Esa cuenta ya existe. Cierra la sesión de invitado y entra con ella (el diario de prueba no se pasa a una cuenta que ya existe).': "That account already exists. Sign out of guest mode and sign in with it (the trial diary can't be moved to an existing account).",
  'El modo invitado no está disponible ahora mismo.': 'Guest mode is not available right now.', 'Esta cuenta ya está guardada.': 'This account is already saved.',


  // grafo
  'Grafo': 'Graph', 'Tu diario como red · al estilo Obsidian': 'Your diary as a network · Obsidian style', 'Imagen para compartir': 'Image to share', 'Conectar por': 'Connect by',
  'Mostrar': 'Show', 'Personas': 'People', 'Años': 'Years', 'nodos': 'nodes', 'conexiones': 'connections', 'Tu grafo': 'Your graph',
  'Pellizca para ampliar · toca un nodo': 'Pinch to zoom · tap a node', 'Rueda para ampliar · arrastra para moverte · clic para abrir': 'Scroll to zoom · drag to move · click to open',
  'La imagen usa los mismos filtros que el grafo: cambia lo que conectas, los tipos o el año antes de exportar.': 'The image uses the same filters as the graph: change connections, types or year before exporting.',
  'Mi universo en Veoleo': 'My universe on Veoleo', 'Imagen lista': 'Image ready', 'No se pudo cargar el grafo': "Couldn't load the graph", 'Grafo de tu diario': 'Graph of your diary',

  'Etiquetas': 'Labels', 'Principales': 'Main', 'Ninguna': 'None', 'Volver a mi vista': 'Back to my view',
  'La imagen empieza con la misma vista que tienes en el grafo.': 'The image starts with the same view you have in the graph.',
  'Arrastra y amplía la vista previa': 'Drag and zoom the preview', '(rueda o pellizco) para encuadrar justo lo que quieres compartir.': '(scroll or pinch) to frame exactly what you want to share.',

  'Seleccionar': 'Select', 'Terminar selección': 'Done selecting', 'Ninguno': 'None', 'Año…': 'Year…', 'Privacidad…': 'Privacy…', 'actualizados': 'updated', 'Eliminados': 'Deleted',
  'Episodios vistos': 'Episodes watched', 'Solo 1 episodio': 'Only 1 episode', '1–2 episodios': '1–2 episodes', 'Hasta 5 episodios': 'Up to 5 episodes',
  'Cualquier origen': 'Any source', 'Importados': 'Imported', 'Añadidos a mano': 'Added manually', 'Series con pocos episodios vistos: útil para limpiar importaciones': 'Series with few episodes watched: handy for cleaning up imports',

  // géneros
  'Acción': 'Action', 'Acción y aventura': 'Action & adventure', 'Aventura': 'Adventure', 'Animación': 'Animation', 'Anime': 'Anime', 'Biografía': 'Biography', 'Comedia': 'Comedy',
  'Crimen': 'Crime', 'Documental': 'Documentary', 'Drama': 'Drama', 'Familia': 'Family', 'Fantasía': 'Fantasy', 'Historia': 'History', 'Terror': 'Horror', 'Musical': 'Musical',
  'Misterio': 'Mystery', 'Romance': 'Romance', 'Ciencia ficción': 'Science fiction', 'Ciencia ficción y fantasía': 'Sci-fi & fantasy', 'Thriller': 'Thriller', 'Bélica': 'War',
  'Western': 'Western', 'Deportes': 'Sports', 'Sobrenatural': 'Supernatural', 'Espionaje': 'Espionage', 'Legal': 'Legal', 'Médica': 'Medical', 'Gastronomía': 'Food',
  'Viajes': 'Travel', 'Infantil': 'Kids', 'Reality': 'Reality', 'Talk show': 'Talk show', 'Culebrón': 'Soap', 'Guerra y política': 'War & politics', 'Ficción': 'Fiction',
  'No ficción': 'Nonfiction', 'Juvenil': 'Young adult', 'Autoayuda': 'Self-help', 'Psicología': 'Psychology', 'Filosofía': 'Philosophy', 'Negocios': 'Business', 'Poesía': 'Poetry',
  'Cómic': 'Comics', 'True crime': 'True crime', 'Telefilme': 'TV movie', 'Cine negro': 'Film noir', 'Cortometraje': 'Short', 'Concurso': 'Game show',
};

const PATTERNS = [
  [/^(\d+) seleccionados?$/, (m, n) => `${n} selected`], [/^Seleccionar todo \((\d+)\)$/, 'Select all ($1)'],
  [/^¿Eliminar (\d+) títulos de tu diario\? Se borran también sus notas\. No se puede deshacer\.$/, 'Delete $1 titles from your diary? Their notes are deleted too. This cannot be undone.'],
  [/^(\d+) actualizados$/, '$1 updated'],
  [/^(\d+) portadas? encontradas?$/, (m, n) => `${n} cover${n === '1' ? '' : 's'} found`],
  [/^Este año · (\d{4})$/, 'This year · $1'], [/^Año · (\d{4})$/, 'Year · $1'], [/^Quitar de (\d{4})$/, 'Remove from $1'],
  [/^Ver las (\d+)$/, 'See all $1'],
  [/^¿Abandonar (.+)\? Pasará a tu lista Abandonadas y dejará de salir aquí\.$/, 'Drop $1? It will move to your Dropped list and stop showing here.'],
  [/^Fechas actualizadas en (\d+)$/, 'Dates updated on $1'],
  [/^(\d+) en Excel$/, '$1 in Excel'],
  [/^Nº (\d+) de (\d{4})$/, 'No. $1 of $2'], [/^Reto (\d{4}): (\d+)\/(\d+)$/, '$1 challenge: $2/$3'],
  [/^Otras plataformas \((\d+)\)$/, 'Other platforms ($1)'], [/^Revisar (\d*)$/, 'Review $1'],
  [/^(\d+) LÍNEAS · SE MARCARÁN CON LA PLATAFORMA (.*)$/, '$1 LINES · WILL BE TAGGED WITH $2'],
  [/^Hoy no hay estrenos de episodios en (.+)\. Prueba otro día o quita filtros\.$/, 'No new episodes on $1 that day. Try another day or clear filters.'],
  [/^(\d+) entradas ahora (privadas|públicas)$/, (m, n, w) => `${n} entries now ${w === 'privadas' ? 'private' : 'public'}`],
  [/^¿Qué te está pareciendo (.+)\?$/, 'What do you think of $1 so far?'], [/^Progreso · (\d+)%$/, 'Progress · $1%'],
  [/^Valoración ([\d.]+) de 5$/, 'Rating $1 of 5'],
  [/^Temporada (\d+)$/, 'Season $1'], [/^Temporada (\d+) vista$/, 'Season $1 watched'], [/^Temporada (\d+)$/i, 'Season $1'],
  [/^(\d+) temporadas$/, '$1 seasons'], [/^(\d+) páginas$/, '$1 pages'], [/^(\d+) EP · (.+)$/, '$1 EP · $2'],
  [/^(\d+)\s*\/\s*(\S+) episodios$/, '$1 / $2 episodes'], [/^(\d+) episodios$/, '$1 episodes'], [/^(\d+)\/(\S+) episodios$/, '$1/$2 episodes'],
  [/^Porque te gustó (.+)$/, 'Because you liked $1'], [/^Diario de (.+)$/, "$1's diary"], [/^Nota de (.+)$/, "$1's note"],
  [/^En (\d+) d$/, 'In $1 d'], [/^Leer en (.+)$/, 'Read on $1'], [/^Importar de (.+)$/, 'Import from $1'], [/^Marcado hasta (.+)$/, 'Marked up to $1'],
  [/^Retos (\d{4})$/, 'Challenges $1'], [/^Mi (\d{4})$/, 'My $1'], [/^Tu (\d{4})$/, 'Your $1'], [/^Todo lo terminado en (\d{4})$/, 'Everything finished in $1'],
  [/^Lo mejor de (\d{4})$/, 'Best of $1'], [/^Terminado en (\d{4})$/, 'Finished in $1'], [/^de (\d+)$/, 'of $1'],
  [/^Series vistas en (\d{4})$/, 'Series watched in $1'], [/^Películas vistas en (\d{4})$/, 'Movies watched in $1'], [/^Libros leídos en (\d{4})$/, 'Books read in $1'],
  [/^Audiolibros escuchados en (\d{4})$/, 'Audiobooks listened in $1'], [/^(\d+) POR DELANTE DEL RITMO$/, '$1 AHEAD OF PACE'], [/^(\d+) POR DEBAJO DEL RITMO$/, '$1 BEHIND PACE'],
  [/^Por ejemplo: 24 libros, 12 series y 50 películas en (\d{4})\.$/, 'For example: 24 books, 12 series and 50 movies in $1.'],
  [/^GUARDADA (.+)$/, 'SAVED $1'], [/^(\d+) TÍTULOS AHORA MISMO · (.*)$/, '$1 TITLES RIGHT NOW · $2'], [/^(\d+) ENTRADAS · (\d+) LISTAS$/, '$1 ENTRIES · $2 LISTS'],
  [/^(\d+) importados$/, '$1 imported'], [/^(\d+) títulos de (.+)$/, '$1 titles from $2'], [/^Saltar (\d+) que ya están en tu diario$/, 'Skip $1 already in your diary'],
  [/^Importar (\d+)$/, 'Import $1'], [/^Exportar (\d+)$/, 'Export $1'], [/^(\d+) entradas$/, '$1 entries'], [/^✓ Importado (.+)$/, '✓ Imported $1'],
  [/^Buscar “(.+)” en (series|películas|libros|audiolibros)$/, (m, q, w) => `Search “${q}” in ${{ series: 'series', películas: 'movies', libros: 'books', audiolibros: 'audiobooks' }[w]}`],
  [/^Buscar (series|películas|libros|audiolibros) · (.+)$/, (m, w, s) => `Search ${{ series: 'series', películas: 'movies', libros: 'books', audiolibros: 'audiobooks' }[w]} · ${s}`],
  [/^(.+) vista$/, '$1 watched'], [/^hace (\d+) (min|h|d)$/, '$1 $2 ago'], [/^HACE (\d+) (MIN|H|D)$/, '$1 $2 AGO'], [/^ahora$/i, 'now'],
  [/^(\d+) serie actualizada: (.*)$/, '1 series updated: $2'], [/^(\d+) series actualizadas: (.*)$/, '$1 series updated: $2'],
  [/^Próximo · (.+)$/, 'Next · $1'], [/^Tráiler de (.+)$/, 'Trailer of $1'], [/^Visto (S\d+E\d+)$/, 'Watched $1'], [/^(.+) entera vista$/, '$1 fully watched'],
  [/^(\d+) (título|títulos)$/, (m, n) => `${n} ${n === '1' ? 'title' : 'titles'}`], [/^Automática · (\d+) (título|títulos)(.*)$/, (m, n, w, r) => `Smart · ${n} ${n === '1' ? 'title' : 'titles'}${r.replace('Privada', 'Private')}`],
];

const cache = new Map();
let UPPER = null;
// Traduce un texto (exacto, por segmentos «·» o por patrones). En español devuelve el original.
export function t(s) {
  if (LANG !== 'en' || s == null) return s;
  const str = String(s);
  if (cache.has(str)) return cache.get(str);
  const core = str.trim();
  // Decimales de valoraciones y medias: 4,5 → 4.5
  if (/^\d,\d★?\+?$/.test(core) || /· \d,5★/.test(core)) {
    const res = str.replace(/\b(\d),(\d)(?=★|\+|$|\s)/g, '$1.$2');
    return res === str ? str : t(res);
  }
  if (!core || !/[a-záéíóúñ¿¡]/i.test(core)) return str;
  let out = null;
  if (EN[core] != null) out = EN[core];
  if (out == null && core === core.toUpperCase()) {
    if (!UPPER) { UPPER = {}; for (const k in EN) UPPER[k.toUpperCase()] = EN[k].toUpperCase(); }
    if (UPPER[core] != null) out = UPPER[core];
  }
  if (out == null && /^[a-záéíóúñ]/.test(core) && EN[core[0].toUpperCase() + core.slice(1)] != null) out = EN[core[0].toUpperCase() + core.slice(1)].toLowerCase();
  if (out == null) for (const [re, rep] of PATTERNS) if (re.test(core)) { out = core.replace(re, rep); break; }
  if (out == null && core.includes(' · ')) {
    const parts = core.split(' · ');
    const tr = parts.map((p) => (EN[p] != null ? EN[p] : PATTERNS.reduce((acc, [re, rep]) => (acc === p && re.test(p) ? p.replace(re, rep) : acc), p)));
    if (tr.some((x, i) => x !== parts[i])) out = tr.join(' · ');
  }
  const res = out == null ? str : str.replace(core, out);
  if (cache.size > 5000) cache.clear();
  cache.set(str, res);
  return res;
}

// Traducción automática del DOM: textos y atributos visibles.
const ATTRS = ['placeholder', 'title', 'aria-label'];
function translateNode(n) {
  if (n.nodeType === 3) {
    const p = n.parentNode;
    if (!p || /^(SCRIPT|STYLE|TEXTAREA|CODE|PRE)$/.test(p.nodeName) || p.closest?.('.prose, [data-no-i18n]')) return;
    const v = n.data; const tr = t(v);
    if (tr !== v) n.data = tr;
  } else if (n.nodeType === 1) {
    if (n.closest?.('[data-no-i18n]')) return;
    for (const a of ATTRS) { const v = n.getAttribute?.(a); if (v) { const tr = t(v); if (tr !== v) n.setAttribute(a, tr); } }
    if (/^(SCRIPT|STYLE|TEXTAREA|CODE|PRE)$/.test(n.nodeName) || n.classList?.contains('prose')) return;
    for (let c = n.firstChild; c; c = c.nextSibling) translateNode(c);
  }
}
export function startDomTranslation(root = document.body) {
  if (LANG !== 'en') return;
  translateNode(root);
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') translateNode(m.target);
      else if (m.type === 'attributes') translateNode(m.target);
      else m.addedNodes.forEach(translateNode);
    }
  }).observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

// Fechas y números en el idioma activo aunque el código pida 'es-ES'.
if (LANG === 'en') {
  const map = (l) => (l === 'es-ES' ? LOCALE : l);
  const dts = Date.prototype.toLocaleDateString, ds = Date.prototype.toLocaleString, ns = Number.prototype.toLocaleString;
  Date.prototype.toLocaleDateString = function (l, o) { return dts.call(this, map(l), o); };
  Date.prototype.toLocaleString = function (l, o) { return ds.call(this, map(l), o); };
  Number.prototype.toLocaleString = function (l, o) { return ns.call(this, map(l), o); };
}
