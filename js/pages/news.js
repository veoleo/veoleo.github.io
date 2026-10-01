// Noticias del mundo de las series: agregadas cada hora por GitHub Actions (data/news.json).
import { html, useState, useMemo } from 'preact-standalone';
import { useAsync, Chip, Spinner, ShareButtons, Tabs, Icon, Scramble } from '../components/ui.js';
import { timeAgo } from '../lib/utils.js';
import { setQuery } from '../lib/router.js';

let newsPromise = null;
export function loadNews(force = false) {
  if (!newsPromise || force) {
    const bust = Math.floor(Date.now() / 600000); // cambia cada 10 min
    newsPromise = fetch(`./data/news.json?v=${bust}`).then((r) => (r.ok ? r.json() : { items: [], sources: [] })).catch(() => ({ items: [], sources: [] }));
  }
  return newsPromise;
}

function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }

export function NewsCard({ n }) {
  return html`<article class="news-item reveal in">
    <a href=${n.link} target="_blank" rel="noopener">
      <div class="img">${n.image ? html`<img src=${n.image} alt="" loading="lazy" referrerpolicy="no-referrer" onError=${(e) => { e.currentTarget.style.display = 'none'; }} />` : html`<div class="gen-poster" style="--gc:var(--blue)"><span>${n.sourceName}</span><b>${n.sourceName}</b></div>`}</div>
      <span class="tag" style=${`--c:${n.lang === 'es' ? 'var(--accent)' : 'var(--blue)'}`}>${n.sourceName} · ${timeAgo(n.date * 1000)}</span>
      <h3>${n.title}</h3>
      ${n.summary && html`<p>${n.summary}</p>`}
    </a>
    <div class="src"><span class="count">${host(n.link)}</span><${ShareButtons} title=${n.title} url=${n.link} /></div>
  </article>`;
}

export function NewsPage({ route }) {
  const st = useAsync(() => loadNews(), []);
  const [lang, setLang] = useState(route.query.lang || 'all');
  const [src, setSrc] = useState(route.query.src || '');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(30);
  const data = st.data || { items: [], sources: [] };

  const items = useMemo(() => data.items.filter((n) =>
    (lang === 'all' || n.lang === lang) && (!src || n.source === src)
    && (!q || (n.title + ' ' + n.summary).toLowerCase().includes(q.toLowerCase()))), [data, lang, src, q]);
  const sources = data.sources.filter((s) => lang === 'all' || s.lang === lang);
  const [top, ...rest] = items;
  const upd = (patch) => { const n = { lang, src, ...patch }; setQuery({ lang: n.lang === 'all' ? '' : n.lang, src: n.src }); };

  return html`<div class="page wrap">
    <div class="page-head">
      <div>
        <div class="kicker">${data.sources.length} fuentes · actualizado ${data.generatedAt ? timeAgo(data.generatedAt * 1000) : '…'}</div>
        <h1 class="display" style="margin-top:20px"><${Scramble} text="Noticias" /></h1>
      </div>
      <input class="input" style="max-width:340px" placeholder="Buscar en noticias…" value=${q} onInput=${(e) => setQ(e.currentTarget.value)} />
    </div>

    <${Tabs} value=${lang} onChange=${(v) => { setLang(v); setSrc(''); upd({ lang: v, src: '' }); }} options=${[
      { value: 'all', label: 'Todas', n: data.items.length }, { value: 'es', label: 'En español', n: data.items.filter((x) => x.lang === 'es').length },
      { value: 'en', label: 'Internacional', n: data.items.filter((x) => x.lang === 'en').length }]} />
    <div class="row" style="--g:8px;margin:20px 0 48px">
      <${Chip} on=${!src} onClick=${() => { setSrc(''); upd({ src: '' }); }}>Todas las fuentes</${Chip}>
      ${sources.map((s) => html`<${Chip} key=${s.id} on=${src === s.id} onClick=${() => { const v = src === s.id ? '' : s.id; setSrc(v); upd({ src: v }); }}>${s.name}</${Chip}>`)}
    </div>

    ${st.loading ? html`<${Spinner} />` : !items.length ? html`<p class="muted">No hay noticias con esos filtros.</p>` : html`
      ${top && html`<div class="news-feature">
        <a class="img" href=${top.link} target="_blank" rel="noopener">${top.image && html`<img src=${top.image} alt="" referrerpolicy="no-referrer" />`}</a>
        <div class="stack" style="--g:18px">
          <span class="tag" style="--c:var(--accent)">${top.sourceName} · ${timeAgo(top.date * 1000)}</span>
          <a href=${top.link} target="_blank" rel="noopener" style="text-decoration:none"><h2>${top.title}</h2></a>
          ${top.summary && html`<p class="lead" style="font-size:1rem">${top.summary}</p>`}
          <div class="row between"><a class="btn ghost sm" href=${top.link} target="_blank" rel="noopener">Leer en ${top.sourceName} <${Icon} name="ext" size=${13} /></a><${ShareButtons} title=${top.title} url=${top.link} /></div>
        </div>
      </div>`}
      <div class="news" style="margin-top:72px">${rest.slice(0, limit).map((n) => html`<${NewsCard} key=${n.id} n=${n} />`)}</div>
      ${rest.length > limit && html`<div class="row" style="justify-content:center;margin-top:56px"><button class="btn ghost lg" onClick=${() => setLimit(limit + 30)}>Cargar más</button></div>`}
    `}
  </div>`;
}
