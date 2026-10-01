// Router por hash: #/ruta/param?clave=valor
import { useState, useEffect } from 'preact-standalone';
import { sfx } from './sound.js';

export function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const query = Object.fromEntries(new URLSearchParams(qs));
  return { parts, query, name: parts[0] || 'home' };
}

// Al cambiar de pantalla se empieza siempre arriba (sin animación ni restauración del navegador).
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
export function scrollTop() {
  document.documentElement.scrollTop = 0; document.body.scrollTop = 0;
  window.scrollTo(0, 0);
}

export function useRoute() {
  const [route, setRoute] = useState(parseHash());
  useEffect(() => {
    const h = () => {
      setRoute(parseHash());
      sfx.whoosh();
      scrollTop();
    };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return route;
}

export function go(path, query) {
  const qs = query ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null)).toString() : '';
  const target = '#/' + String(path).replace(/^#?\/?/, '') + (qs === '?' ? '' : qs);
  if (location.hash === target) return;
  location.hash = target;
}

// Actualiza la query sin disparar scroll ni sonido (filtros).
export function setQuery(query) {
  const { parts } = parseHash();
  const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null && !(Array.isArray(v) && !v.length))).toString();
  history.replaceState(null, '', '#/' + parts.map(encodeURIComponent).join('/') + (qs ? '?' + qs : ''));
}
