// Grafo de tu diario, al estilo de la vista de grafo de Obsidian: cada título conectado con sus géneros,
// personas (dirección, creación, autoría), plataformas, años y listas. Interactivo y exportable como imagen.
import { html, useState, useEffect, useRef, useMemo } from 'preact-standalone';
import { Modal, Tabs, Chip, Icon, Scramble, Spinner } from '../components/ui.js';
import { useStore, toast } from '../lib/store.js';
import { loadScript, entryYear, TYPES, uniq } from '../lib/utils.js';
import { canonPlatform } from '../lib/metadata.js';
import { t, LANG } from '../lib/i18n.js';
import { sfx } from '../lib/sound.js';
import { flash } from '../lib/fx.js';

const D3 = 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js';
const TYPE_COL = { series: '#5b7fff', movie: '#ff4d61', book: '#ffc53d', audiobook: '#2ee6c5' };
const HUBS = {
  genre: { label: 'Géneros', col: '#9a7bff' },
  person: { label: 'Personas', col: '#ff5fae' },
  platform: { label: 'Plataformas', col: '#c6ff3d' },
  year: { label: 'Años', col: '#b9bfd3' },
  list: { label: 'Listas', col: '#ff8a3d' },
};
const SMALL = typeof matchMedia === 'function' && matchMedia('(max-width: 900px), (pointer: coarse)').matches;

// Nodos y enlaces a partir del diario.
export function buildGraph(entries, lists, { hubs, types, year }) {
  let list = entries.filter((e) => types.includes(e.type) && (!year || String(entryYear(e)) === String(year)));
  const cap = SMALL ? 260 : 900;
  if (list.length > cap) list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, cap);
  const nodes = []; const links = []; const hubIndex = new Map();
  const hub = (kind, name) => {
    const key = kind + '|' + name;
    if (!hubIndex.has(key)) { hubIndex.set(key, { id: key, kind, name, deg: 0 }); }
    return hubIndex.get(key);
  };
  for (const e of list) {
    const n = { id: e.id, kind: 'entry', type: e.type, name: e.title, rating: e.rating || 0, deg: 0 };
    nodes.push(n);
    const add = (kind, name) => { if (!name) return; const h = hub(kind, name); h.deg++; n.deg++; links.push({ source: n.id, target: h.id }); };
    if (hubs.includes('genre')) (e.genres || []).slice(0, 4).forEach((g) => add('genre', g));
    if (hubs.includes('person')) (e.creators || []).filter((p) => p && !/unknown/i.test(p)).slice(0, 2).forEach((p) => add('person', p.replace(/\s+/g, ' ').trim()));
    if (hubs.includes('platform')) uniq([e.platform, e.network, e.consumption?.readOn, e.consumption?.listenedOn].map((p) => (p ? canonPlatform(p) : ''))).filter((p) => p && p !== 'Otros').slice(0, 2).forEach((p) => add('platform', p));
    if (hubs.includes('year')) { const y = entryYear(e); if (y) add('year', String(y)); }
  }
  if (hubs.includes('list')) {
    const ids = new Set(list.map((e) => e.id));
    for (const l of lists.filter((x) => x.kind !== 'smart')) for (const id of l.itemIds || []) if (ids.has(id)) {
      const h = hub('list', l.name); h.deg++; links.push({ source: id, target: h.id }); nodes.find((n) => n.id === id).deg++;
    }
  }
  // Las personas con un solo título solo añaden ruido.
  const keep = [...hubIndex.values()].filter((h) => h.kind !== 'person' || h.deg >= 2);
  const keepIds = new Set(keep.map((h) => h.id));
  return { nodes: [...nodes, ...keep], links: links.filter((l) => !String(l.target).includes('|') || keepIds.has(l.target)), entries: list.length, hubs: keep.length };
}

const radius = (n) => (n.kind === 'entry' ? 3 + (n.rating || 0) * 0.9 : Math.min(26, 5 + Math.sqrt(n.deg) * 2.6));
const colorOf = (n) => (n.kind === 'entry' ? TYPE_COL[n.type] || '#fff' : HUBS[n.kind]?.col || '#fff');

// Dibuja el grafo en un canvas (pantalla e imagen exportada). Las etiquetas no se pisan:
// se colocan por importancia (nodos con más conexiones primero) y se omiten las que chocarían.
// labelMode: 'auto' | 'all' | 'none'. textPx: tamaño de letra fijo en píxeles (imagen) o null (pantalla).
function draw(ctx, nodes, links, tr, { w, h, focus = null, neighbors = null, labelMode = 'auto', textPx = null, clear = true }) {
  ctx.save();
  if (clear) ctx.clearRect(0, 0, w, h);
  ctx.translate(tr.x, tr.y); ctx.scale(tr.k, tr.k);
  ctx.lineWidth = (textPx ? 1.1 : 0.6) / tr.k;
  for (const l of links) {
    const on = focus && (l.source.id === focus.id || l.target.id === focus.id);
    ctx.strokeStyle = on ? 'rgba(198,255,61,.65)' : focus ? 'rgba(255,255,255,.035)' : textPx ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.09)';
    ctx.beginPath(); ctx.moveTo(l.source.x, l.source.y); ctx.lineTo(l.target.x, l.target.y); ctx.stroke();
  }
  for (const n of nodes) {
    const dim = focus && n !== focus && !neighbors?.has(n.id);
    ctx.globalAlpha = dim ? 0.15 : 1;
    ctx.fillStyle = colorOf(n);
    ctx.beginPath(); ctx.arc(n.x, n.y, radius(n), 0, Math.PI * 2); ctx.fill();
    if (n.kind !== 'entry') { ctx.strokeStyle = 'rgba(5,6,10,.9)'; ctx.lineWidth = 1.5 / tr.k; ctx.stroke(); }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (labelMode === 'none') return;
  // Etiquetas en coordenadas de pantalla para poder detectar choques.
  const wanted = nodes.filter((n) => {
    if (focus) return n === focus || neighbors?.has(n.id);
    if (labelMode === 'all') return true;
    return n.kind !== 'entry' ? n.deg >= (tr.k > 1.4 ? 2 : 3) : !textPx && tr.k > 2.2;
  }).sort((a, b) => (b === focus) - (a === focus) || (a.kind === 'entry') - (b.kind === 'entry') || b.deg - a.deg);
  const placed = [];
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (const n of wanted) {
    const base = n.kind === 'entry' ? 11 : 12 + Math.min(9, Math.sqrt(n.deg) * 1.2);
    const fs = textPx ? base * textPx : base * Math.min(1.35, Math.max(0.85, tr.k * 0.9));
    ctx.font = `${n.kind === 'entry' ? 500 : 700} ${fs}px Geist, system-ui, sans-serif`;
    const label = t(n.name).slice(0, 30);
    const x = tr.x + n.x * tr.k, y = tr.y + (n.y + radius(n)) * tr.k + 3;
    if (x < -50 || x > w + 50 || y < -20 || y > h + 20) continue;
    const tw = ctx.measureText(label).width, box = [x - tw / 2 - 3, y - 1, x + tw / 2 + 3, y + fs + 2];
    if (n !== focus && placed.some((p) => box[0] < p[2] && box[2] > p[0] && box[1] < p[3] && box[3] > p[1])) continue;
    placed.push(box);
    ctx.fillStyle = 'rgba(5,6,10,.55)'; ctx.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
    ctx.fillStyle = n.kind === 'entry' ? 'rgba(238,240,247,.9)' : '#ffffff';
    ctx.fillText(label, x, y);
  }
  ctx.restore();
}

export function GraphPage() {
  const { entries, lists, profile, entriesReady } = useStore();
  const [hubs, setHubs] = useState(['genre', 'person', 'platform']);
  const [types, setTypes] = useState(Object.keys(TYPES));
  const [year, setYear] = useState('');
  const [ready, setReady] = useState(!!window.d3);
  const [hover, setHover] = useState(null);
  const [share, setShare] = useState(false);
  const canvas = useRef(); const wrap = useRef(); const state = useRef({});
  const years = useMemo(() => uniq(entries.map(entryYear)).sort((a, b) => b - a), [entries]);
  const graph = useMemo(() => (entriesReady ? buildGraph(entries, lists, { hubs, types, year }) : null), [entries, lists, hubs.join(), types.join(), year, entriesReady]);

  useEffect(() => { if (!window.d3) loadScript(D3).then(() => setReady(true)).catch(() => toast('No se pudo cargar el grafo', 'err')); }, []);

  useEffect(() => {
    if (!ready || !graph || !canvas.current) return;
    const d3 = window.d3; const cv = canvas.current; const box = wrap.current.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = box.width, h = Math.max(420, Math.min(innerHeight * 0.72, 900));
    cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const nodes = graph.nodes.map((n) => ({ ...n })); const links = graph.links.map((l) => ({ ...l }));
    const adj = new Map(nodes.map((n) => [n.id, new Set()]));
    for (const l of links) { adj.get(l.source)?.add(l.target); adj.get(l.target)?.add(l.source); }
    let tr = d3.zoomIdentity.translate(w / 2, h / 2).scale(SMALL ? 0.55 : 0.7);
    let focus = null;
    const render = () => draw(ctx, nodes, links, tr, { w, h, focus, neighbors: focus ? adj.get(focus.id) : null });
    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d) => d.id).distance((l) => (l.target.kind === 'year' ? 70 : 42)).strength(0.35))
      .force('charge', d3.forceManyBody().strength((d) => (d.kind === 'entry' ? -28 : -90 - d.deg * 4)).theta(0.9))
      .force('collide', d3.forceCollide((d) => radius(d) + 1.5))
      .force('x', d3.forceX(0).strength(0.04)).force('y', d3.forceY(0).strength(0.04))
      .alphaDecay(SMALL ? 0.05 : 0.03)
      .on('tick', render);
    const zoom = d3.zoom().scaleExtent([0.15, 6]).on('zoom', (ev) => { tr = ev.transform; render(); });
    d3.select(cv).call(zoom).call(zoom.transform, tr);
    const pick = (ev) => {
      const [px, py] = d3.pointer(ev, cv);
      const [x, y] = tr.invert([px, py]);
      return sim.find(x, y, 14 / tr.k);
    };
    const move = (ev) => { const n = pick(ev); if (n !== focus) { focus = n || null; setHover(n ? { name: n.name, kind: n.kind, type: n.type, deg: n.deg } : null); render(); cv.style.cursor = n ? 'pointer' : 'grab'; } };
    const click = (ev) => {
      const n = pick(ev); if (!n) return;
      // En el móvil, el primer toque resalta el nodo y sus conexiones; el segundo lo abre.
      if (SMALL && n !== focus) { focus = n; setHover({ name: n.name, kind: n.kind, type: n.type, deg: n.deg }); render(); return; }
      if (n.kind === 'entry') location.hash = `#/item/${n.id}`;
      else if (n.kind === 'genre') location.hash = `#/library?genre=${encodeURIComponent(n.name)}`;
      else if (n.kind === 'platform') location.hash = `#/library?platform=${encodeURIComponent(n.name)}`;
      else if (n.kind === 'year') location.hash = `#/library?year=${n.name}`;
      else if (n.kind === 'person') location.hash = `#/library?q=${encodeURIComponent(n.name)}`;
    };
    cv.addEventListener('mousemove', move); cv.addEventListener('click', click);
    state.current = { nodes, links, sim, w, h, getTr: () => tr };
    return () => { sim.stop(); cv.removeEventListener('mousemove', move); cv.removeEventListener('click', click); d3.select(cv).on('.zoom', null); };
  }, [ready, graph]);

  const toggle = (arr, set, k) => { set(arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k]); sfx.click(); };
  return html`<div class="page wrap">
    <div class="page-head"><div><div class="kicker">Tu diario como red · al estilo Obsidian</div><h1 class="display" style="margin-top:20px"><${Scramble} text="Grafo" /></h1></div>
      <button class="btn" disabled=${!graph?.entries} onClick=${() => setShare(true)}><${Icon} name="image" /> Imagen para compartir</button></div>
    <div class="filters" style="margin-bottom:18px">
      <div class="filter-row"><span class="label">Conectar por</span>
        ${Object.entries(HUBS).map(([k, h]) => html`<${Chip} key=${k} on=${hubs.includes(k)} color=${h.col} onClick=${() => toggle(hubs, setHubs, k)}>${h.label}</${Chip}>`)}</div>
      <div class="filter-row"><span class="label">Mostrar</span>
        ${Object.values(TYPES).map((T) => html`<${Chip} key=${T.key} on=${types.includes(T.key)} color=${TYPE_COL[T.key]} onClick=${() => toggle(types, setTypes, T.key)}>${T.plural}</${Chip}>`)}
        <select class="select" style="width:auto" value=${year} onChange=${(e) => setYear(e.currentTarget.value)}><option value="">Todos los años</option>${years.map((y) => html`<option value=${y}>${y}</option>`)}</select></div>
    </div>
    <div class="graph-wrap" ref=${wrap}>
      ${(!ready || !graph) && html`<div class="graph-load"><${Spinner} /></div>`}
      <canvas ref=${canvas} aria-label="Grafo de tu diario"></canvas>
      <div class="graph-info">${hover ? html`<b style=${`color:${hover.kind === 'entry' ? TYPE_COL[hover.type] : HUBS[hover.kind]?.col}`}>${hover.name}</b><span>${hover.kind === 'entry' ? t(TYPES[hover.type]?.label) : `${t(HUBS[hover.kind]?.label)} · ${hover.deg} ${hover.deg === 1 ? t('título') : t('títulos')}`}</span>`
        : html`<span>${graph ? `${graph.entries} ${t('títulos')} · ${graph.hubs} ${t('nodos')} · ${graph.links.length} ${t('conexiones')}` : ''}</span><span class="muted">${SMALL ? t('Pellizca para ampliar · toca un nodo') : t('Rueda para ampliar · arrastra para moverte · clic para abrir')}</span>`}</div>
    </div>
    ${share && graph && state.current.nodes && html`<${GraphShareModal} graph=${graph} live=${state.current} profile=${profile} onClose=${() => setShare(false)} />`}
  </div>`;
}

/* ── imagen para redes: lo que ves (y ajustas en la vista previa) es lo que compartes ── */
const FMT = { post: [1080, 1350], story: [1080, 1920] };
const frameOf = (format) => { const [W, H] = FMT[format]; return { W, H, x0: 50, y0: 300, w: W - 100, h: H - 300 - 210 }; };
// Vista inicial: lo que se ve ahora mismo en el grafo de la pantalla, ajustado al recuadro de la imagen.
function initialView(live, format) {
  const f = frameOf(format); const tr = live.getTr();
  const onScreen = live.nodes.filter((n) => { const x = tr.x + n.x * tr.k, y = tr.y + n.y * tr.k; return x >= 0 && x <= live.w && y >= 0 && y <= live.h; });
  const pts = onScreen.length > 3 ? onScreen : live.nodes;
  const q = (arr, p) => { const a2 = [...arr].sort((m, n) => m - n); return a2[Math.max(0, Math.min(a2.length - 1, Math.round(p * (a2.length - 1))))]; };
  const xs = pts.map((n) => n.x), ys = pts.map((n) => n.y);
  const minX = q(xs, 0.02), maxX = q(xs, 0.98), minY = q(ys, 0.02), maxY = q(ys, 0.98);
  const k = Math.min(f.w / Math.max(40, maxX - minX), f.h / Math.max(40, maxY - minY)) * 0.9;
  return { k, x: f.x0 + f.w / 2 - ((minX + maxX) / 2) * k, y: f.y0 + f.h / 2 - ((minY + maxY) / 2) * k };
}

function paintShare(canvas, live, graph, profile, format, view, labelMode) {
  const { W, H, x0, y0, w, h } = frameOf(format);
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W * 0.5, y0 + h / 2, 0, W * 0.5, y0 + h / 2, W * 0.85);
  g.addColorStop(0, 'rgba(91,127,255,.16)'); g.addColorStop(1, 'rgba(5,6,10,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.beginPath(); ctx.rect(0, y0 - 30, W, h + 60); ctx.clip();
  draw(ctx, live.nodes, live.links, view, { w: W, h: H, labelMode, textPx: 1.9, clear: false });
  ctx.restore();
  const P = 60;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#c6ff3d'; ctx.fillRect(P, 92, 44, 44);
  ctx.fillStyle = '#05060a'; ctx.beginPath(); ctx.moveTo(P + 15, 103); ctx.lineTo(P + 33, 114); ctx.lineTo(P + 15, 125); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#eef0f7'; ctx.font = '800 34px Archivo, Arial, sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText('VEOLEO', P + 62, 116);
  ctx.textBaseline = 'alphabetic'; ctx.font = '800 78px Archivo, Arial, sans-serif'; ctx.fillStyle = '#ffffff';
  ctx.fillText(LANG === 'en' ? 'MY UNIVERSE' : 'MI UNIVERSO', P, 230);
  ctx.font = '600 26px "Geist Mono", monospace'; ctx.fillStyle = 'rgba(238,240,247,.7)';
  ctx.fillText(`${graph.entries} ${t('títulos').toUpperCase()} · ${graph.hubs} ${t('nodos').toUpperCase()} · ${graph.links.length} ${t('conexiones').toUpperCase()}`, P, 272);
  let lx = P; const ly = H - 150;
  const legend = [...Object.entries(TYPE_COL).filter(([k2]) => graph.nodes.some((n) => n.type === k2)).map(([k2, c]) => [t(TYPES[k2].plural), c]),
    ...Object.entries(HUBS).filter(([k2]) => graph.nodes.some((n) => n.kind === k2)).map(([, hb]) => [t(hb.label), hb.col])];
  ctx.font = '600 22px "Geist Mono", monospace';
  for (const [label, c] of legend) {
    const tw = ctx.measureText(label.toUpperCase()).width;
    if (lx + tw + 40 > W - P) break;
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(lx + 8, ly - 8, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(238,240,247,.8)'; ctx.fillText(label.toUpperCase(), lx + 24, ly);
    lx += tw + 56;
  }
  ctx.font = '600 28px "Geist Mono", monospace';
  ctx.fillStyle = 'rgba(238,240,247,.85)'; ctx.fillText(profile?.handle && !profile.guest ? '@' + profile.handle : '', P, H - 70);
  ctx.textAlign = 'right'; ctx.fillStyle = '#c6ff3d'; ctx.fillText('veoleo.github.io', W - P, H - 70);
}

function GraphShareModal({ graph, live, profile, onClose }) {
  const [format, setFormat] = useState('post');
  const [labelMode, setLabelMode] = useState('auto');
  const ref = useRef(); const view = useRef(null); const base = useRef(null); const raf = useRef(0);
  const paint = () => { clearTimeout(raf.current); raf.current = setTimeout(() => paintShare(ref.current, live, graph, profile, format, view.current, labelMode), 16); };
  // Encuadre: arrastrar y pellizcar/rueda sobre la vista previa.
  useEffect(() => {
    const d3 = window.d3; const cv = ref.current;
    base.current = initialView(live, format); view.current = { ...base.current };
    const zoom = d3.zoom().scaleExtent([0.2, 8]).on('zoom', (ev) => {
      const f = cv.width / cv.getBoundingClientRect().width; const T = ev.transform; const b = base.current;
      view.current = { k: b.k * T.k, x: T.x * f + T.k * b.x, y: T.y * f + T.k * b.y };
      paint();
    });
    d3.select(cv).call(zoom).call(zoom.transform, d3.zoomIdentity);
    paint();
    return () => d3.select(cv).on('.zoom', null);
  }, [format]);
  useEffect(() => { if (view.current) paint(); }, [labelMode]);
  const file = () => new Promise((res) => { clearTimeout(raf.current); paintShare(ref.current, live, graph, profile, format, view.current, labelMode); ref.current.toBlob((b) => res(new File([b], `veoleo-grafo-${format}.png`, { type: 'image/png' })), 'image/png'); });
  async function shareIt() {
    try {
      const f = await file();
      if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], title: 'Veoleo', text: t('Mi universo en Veoleo') }); return; }
      save(f);
    } catch (x) { if (x.name !== 'AbortError') toast(x.message, 'err'); }
  }
  function save(f) { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); sfx.pop(); flash(t('Imagen lista'), '#c6ff3d'); }
  return html`<${Modal} kicker="Compartir" title="Tu grafo" width=${900} onClose=${onClose}
    actions=${html`<button class="btn ghost" onClick=${async () => save(await file())}><${Icon} name="download" size=${14} /> PNG</button>
      <button class="btn" onClick=${shareIt}><${Icon} name="share" size=${14} /> Compartir</button>`}>
    <div class="sharecard">
      <div class=${'sc-prev graph-prev ' + format}><canvas ref=${ref} aria-label="Vista previa: arrastra y amplía para encuadrar"></canvas></div>
      <div class="stack" style="--g:20px">
        <${Tabs} value=${format} onChange=${setFormat} options=${[{ value: 'post', label: 'Post 4:5' }, { value: 'story', label: 'Story 9:16' }]} />
        <div class="field"><span class="label">Etiquetas</span>
          <div class="row" style="--g:8px">${[['auto', 'Principales'], ['all', 'Todas'], ['none', 'Ninguna']].map(([k, l]) => html`<${Chip} key=${k} on=${labelMode === k} onClick=${() => setLabelMode(k)}>${l}</${Chip}>`)}</div></div>
        <p class="small muted" style="margin:0">La imagen empieza con la misma vista que tienes en el grafo. <b>Arrastra y amplía la vista previa</b> (rueda o pellizco) para encuadrar justo lo que quieres compartir.</p>
        <button class="btn ghost sm" style="align-self:flex-start" onClick=${() => { const d3 = window.d3; d3.select(ref.current).call(d3.zoom().transform, d3.zoomIdentity); view.current = { ...base.current }; paint(); }}>Volver a mi vista</button>
      </div>
    </div>
  </${Modal}>`;
}
