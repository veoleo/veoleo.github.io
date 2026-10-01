// Sincronización de series con su emisión real (TVMaze):
//  · reconcilia estados (Viendo → Al día → Vista) al entrar en la app
//  · calcula tus próximos episodios y los emitidos que te faltan por ver
import { showInfo, seriesStatusFor, memoize } from './metadata.js';
import { updateEntry } from './db.js';
import { todayISO } from './utils.js';

async function pool(items, n, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => {
    while (queue.length) { const it = queue.shift(); try { await fn(it); } catch (e) { console.warn('[TVDaily] sync', e.message); } }
  }));
}

const ACTIVE = (e) => e.type === 'series' && e.status !== 'abandoned'
  && (['in_progress', 'up_to_date', 'planned'].includes(e.status) || (e.status === 'completed' && !/ended|cancel/i.test(e.showStatus || '')));

// Ajusta estado, próximo episodio e ids de tus series. Devuelve cuántas cambiaron de estado.
let reconciled = new Set();
export async function reconcileSeries(entries) {
  const todo = entries.filter((e) => ACTIVE(e) && !reconciled.has(e.id)).slice(0, 40);
  const moved = { completed: [], up_to_date: [], in_progress: [] };
  await pool(todo, 3, async (e) => {
    reconciled.add(e.id);
    const info = await showInfo(e);
    if (!info) return;
    const patch = {};
    const status = seriesStatusFor(e, info);
    if (status !== e.status && (e.watchedEpisodes || []).length) {
      patch.status = status;
      if (status === 'completed' && !e.finishedAt) patch.finishedAt = todayISO();
      moved[status]?.push(e.title);
    }
    if (info.status && info.status !== e.showStatus) patch.showStatus = info.status;
    if (JSON.stringify(info.next || null) !== JSON.stringify(e.nextEpisode || null)) patch.nextEpisode = info.next || null;
    if (info.total && info.total !== e.episodes) patch.episodes = info.total;
    if (!e.ids?.tvmaze || (!e.ids?.tvdb && info.tvdbId)) patch.ids = { ...(e.ids || {}), tvmaze: info.tvmazeId, tvdb: e.ids?.tvdb || info.tvdbId || '', imdb: e.ids?.imdb || info.imdbId || '' };
    if (!e.cover && info.cover) patch.cover = info.cover;
    if (!e.network && info.network) patch.network = info.network;
    if (Object.keys(patch).length) await updateEntry(e.id, patch);
  });
  return moved;
}
export function resetReconcile() { reconciled = new Set(); }

// Próximos episodios (90 días) y emitidos recientes sin ver (21 días) de tus series.
export function myEpisodes(entries) {
  const series = entries.filter(ACTIVE).slice(0, 50);
  const key = series.map((e) => `${e.id}:${(e.watchedEpisodes || []).length}`).join(',');
  return memoize(`myeps|${key}`, 15 * 60000, async () => {
    const today = todayISO();
    const limit = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
    const since = new Date(Date.now() - 21 * 864e5).toISOString().slice(0, 10);
    const upcoming = [], pending = [];
    await pool(series, 4, async (e) => {
      const info = await showInfo(e);
      if (!info) return;
      const platform = e.network || info.network || e.platform || '';
      for (const x of info.upcoming) if (x.airdate <= limit) upcoming.push({ ...x, e, platform });
      const watched = new Set(e.watchedEpisodes || []);
      if (e.status !== 'planned') {
        for (const x of info.aired) if (x.airdate >= since && !watched.has(x.code)) pending.push({ ...x, e, platform });
      }
    });
    upcoming.sort((a, b) => (a.airdate + a.airtime).localeCompare(b.airdate + b.airtime));
    pending.sort((a, b) => b.airdate.localeCompare(a.airdate));
    return { upcoming, pending };
  });
}
