# 📺 TVDaily

Tu diario de **series, películas, libros y audiolibros** con estética de cómic moderno, efectos visuales y sonido cinematográfico sintetizado.

**App:** https://wilderwests.github.io/TVDaily/

## Qué hace

- **Buscador multi-fuente** con portada, sinopsis (en español vía Wikipedia cuando existe), tráiler de YouTube, banda sonora con previews de 30 s, reparto y dónde verlo.
  - Series: TMDB (opcional) · TVMaze · IMDb
  - Películas: TMDB (opcional) · IMDb + Wikidata
  - Libros: Google Books · Open Library
  - Audiolibros: Apple Books · Google Books
- **Episodios por temporada**: marca los que has visto, con la sinopsis oficial, fecha de emisión y miniatura de cada uno; "visto hasta aquí", temporada completa y próximo episodio.
- **Ranking visual de estrellas** (medias estrellas), estados *Vista / Viendo / Must watch / Abandonada* (lo abandonado va a su lista).
- **Libros y audiolibros**: leído y/o escuchado y dónde (Kindle, papel, Audible, Audiobookshelf, Storytel…).
- **Filtros** por tipo, estado, año, ranking mínimo, género, plataforma y formato.
- **Listas**: del sistema (Must watch, Por leer, Abandonadas, Obras maestras…), **automáticas por año** ("Series vistas en 2025"), listas inteligentes con reglas propias y listas manuales.
- **Retos** anuales de libros, audiolibros, series, películas y páginas, con progreso mes a mes.
- **Novedades y recomendaciones**: estrenos de series y pelis, filtro por plataforma, calendario de próximos episodios, recomendaciones personales y lo que triunfa entre la gente que sigues. Enlace a **Decider · Stream It or Skip It** y JustWatch.
- **Social**: perfiles, seguir, comentarios, me gusta. Cada entrada puede ser pública o privada y **cada nota tiene su propia privacidad**.
- **Exportación Markdown para Obsidian**: nota individual o masiva (.zip con carpetas, índice con Dataview, listas y snippet CSS, o un único .md). **Plantilla configurable** con `{{campos}}` y bloques condicionales.

## Arquitectura

Sin paso de compilación: módulos ES servidos tal cual (Preact + htm desde CDN) y Firebase (Auth + Firestore).

```
index.html          importmap y capas de textura
css/app.css         estética cómic (tinta, papel, color mate)
js/main.js          shell, rutas, intro
js/lib/             db (Firebase), metadata (fuentes), markdown (Obsidian), sound (Web Audio), fx, store, router
js/components/      UI, formulario, episodios, medios, social, vista previa
js/pages/           inicio, novedades, buscar, biblioteca, ficha, listas, retos, comunidad, perfil, ajustes
firestore.rules     reglas de seguridad
obsidian/tvdaily.css snippet para Obsidian
```

## Desarrollo local

```bash
python3 -m http.server 8765
```

y abre http://localhost:8765 (localhost ya está autorizado en Firebase Auth).

## Clave de TMDB (opcional, recomendada)

Sin clave funcionan series, libros, audiolibros y películas vía IMDb/Wikidata. Con una clave gratuita de [TMDB](https://www.themoviedb.org/settings/api) se activan pósters HD, fondos, tráilers, sinopsis de episodios en español, estrenos de cine, plataformas por país y recomendaciones. Cada persona puede ponerla en **Ajustes**, o puedes ponerla para toda la app en `js/config.js` (`SHARED_TMDB_KEY`).

## Firebase

Proyecto `tvdaily-7d988`. Si cambias `firestore.rules`, publícalas en la consola (Firestore → Reglas) o con `firebase deploy --only firestore`.
