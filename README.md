# TVDaily

Tu diario de **series, películas, libros y audiolibros**. Interfaz futurista, sin configuración: todo funciona sin claves de API.

**App:** https://wilderwests.github.io/TVDaily/

## Funciones

- **Buscador multi-fuente** (sin claves): TVMaze, IMDb, Wikidata/Wikipedia, Apple, Google Books y Open Library. Portada, sinopsis (en español cuando existe), tráiler (YouTube o vídeo de Apple), banda sonora con previews de 30 s, reparto y dónde verlo.
- **Episodios por temporada** con la sinopsis oficial, fecha de emisión y miniatura; marcar vistos, "visto hasta aquí", temporada completa, tiempo visto y próximo episodio.
- **Valoración con medias estrellas**, estados *Vista / Viendo / Must watch / Abandonada*, revisionados, plataforma y, en libros y audiolibros, leído/escuchado y dónde (Kindle, Audible, Audiobookshelf…).
- **Biblioteca con filtros** por tipo, estado, año, ranking, género, plataforma y formato.
- **Listas** del sistema, automáticas por año ("Series vistas en 2025"), inteligentes con reglas y manuales. Compartibles.
- **Novedades**: estrenos de series por plataforma, películas, libros y audiolibros del momento, calendario de tus próximos episodios y recomendaciones según tus gustos. Enlaces a *Stream it or skip it* (Decider) y JustWatch.
- **Noticias** de 16+ medios (ES e internacionales) actualizadas cada hora, con botones para compartir.
- **Estadísticas**: mapa de actividad, horas de pantalla, páginas, distribución de notas, géneros, plataformas y lo mejor del año.
- **Retos** anuales con ritmo previsto.
- **Comunidad**: perfiles, seguir, comentarios, me gusta; entradas y notas públicas o privadas por separado.
- **Importar** desde TV Time (exportación de datos), Letterboxd, Goodreads, IMDb o copia de TVDaily, con autocompletado de portadas.
- **Exportar** a Obsidian (bóveda .zip con Dataview y snippet CSS, o un solo .md, plantilla configurable), CSV, Letterboxd, Goodreads, Trakt y JSON.
- **Paleta de comandos** (⌘K), atajos, instalable como app (PWA) y sonidos sutiles de interfaz.

## Arquitectura

Sin paso de compilación: módulos ES (Preact + htm desde CDN) y Firebase (Auth + Firestore). GitHub Actions publica en GitHub Pages en cada push y cada hora regenera `data/news.json` (`scripts/build_news.py`, solo librería estándar de Python).

```
index.html · manifest.webmanifest · sw.js
css/app.css
js/main.js                 shell, rutas, paleta ⌘K
js/lib/                    db, metadata, markdown, transfer, sound, fx, store, router, utils
js/components/             ui, icons, entry-form, episodes, media, preview, social
js/pages/                  home, discover, news, search, library, item, lists, challenges, stats, data, social, settings, auth
scripts/build_news.py      agregador de noticias
firestore.rules            reglas de seguridad
obsidian/tvdaily.css       snippet para Obsidian
```

## Desarrollo local

```bash
python3 -m http.server 8765
```

Abre http://localhost:8765 (localhost está autorizado en Firebase Auth).

## Firebase

Proyecto `tvdaily-7d988`. Si cambias `firestore.rules`, publícalas en la consola (Firestore → Reglas) o con `firebase deploy --only firestore`.
