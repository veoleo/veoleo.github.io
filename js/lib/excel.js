// Exportación a Excel (.xlsx) con portadas en una columna, valoración, fechas, notas y una hoja de resumen.
import { loadScript, TYPES, statusLabel, entryYear } from './utils.js';
import { t } from './i18n.js';

const EXCELJS = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
const TYPE_ARGB = { series: 'FF5B7FFF', movie: 'FFFF4D61', book: 'FFFFC53D', audiobook: 'FF2EE6C5' };
const STATUS_ARGB = { completed: 'FF2EE6C5', up_to_date: 'FF5B7FFF', in_progress: 'FFFFC53D', planned: 'FFFF5FAE', abandoned: 'FF8A8FA3' };
const INK = 'FF05060A', PAPER = 'FFF6F7FB', LINE = 'FFE3E6EF', ACCENT = 'FFC6FF3D';

const starText = (r) => (r > 0 ? '★'.repeat(Math.floor(r)) + (r % 1 ? '½' : '') : '');
const plain = (md) => String(md || '').replace(/^>\s*\[![^\]]+\][+-]?\s*/gm, '').replace(/[#>*_`~]/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\n{3,}/g, '\n\n').trim();

async function thumb(url) {
  if (!url) return null;
  try {
    const r = await fetch(`https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=120&h=180&fit=cover&output=jpg&q=80`);
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  } catch { return null; }
}
async function pool(items, n, fn) {
  const q = [...items.keys()];
  await Promise.all(Array.from({ length: n }, async () => { while (q.length) { const i = q.shift(); await fn(items[i], i); } }));
}

function styleHeader(row) {
  row.height = 30;
  row.eachCell((c) => {
    c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } };
    c.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    c.border = { bottom: { style: 'medium', color: { argb: ACCENT } } };
  });
}

export async function exportExcel(entries, notesById = {}, { name = 'Veoleo', year = '', onProgress = () => {} } = {}) {
  await loadScript(EXCELJS);
  const list = (year ? entries.filter((e) => entryYear(e) === Number(year)) : entries)
    .slice().sort((a, b) => String(b.finishedAt || b.startedAt || '').localeCompare(String(a.finishedAt || a.startedAt || '')) || a.title.localeCompare(b.title));
  const wb = new window.ExcelJS.Workbook();
  wb.creator = 'Veoleo'; wb.created = new Date();

  // ── Resumen ──
  const sum = wb.addWorksheet(t('Resumen'), { views: [{ showGridLines: false }] });
  sum.columns = [{ width: 4 }, { width: 26 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }];
  sum.mergeCells('B2:G2');
  sum.getCell('B2').value = `VEOLEO · ${year ? year : t('Todo tu diario')}`;
  sum.getCell('B2').font = { name: 'Arial Black', size: 22, color: { argb: INK } };
  sum.getCell('B3').value = `${list.length} ${t('títulos')} · ${t('exportado el')} ${new Date().toLocaleDateString()}`;
  sum.getCell('B3').font = { name: 'Arial', size: 10, color: { argb: 'FF7D8399' } };
  const head = sum.getRow(5); head.values = ['', t('Tipo'), t('Total'), t('Completado'), t('En curso'), t('Pendiente'), t('Nota media')]; styleHeader(head);
  let r = 6;
  for (const T of Object.values(TYPES)) {
    const of = list.filter((e) => e.type === T.key);
    if (!of.length) continue;
    const rated = of.filter((e) => e.rating > 0);
    const row = sum.getRow(r++);
    row.values = ['', t(T.plural), of.length, of.filter((e) => e.status === 'completed').length, of.filter((e) => ['in_progress', 'up_to_date'].includes(e.status)).length,
      of.filter((e) => e.status === 'planned').length, rated.length ? Number((rated.reduce((a, e) => a + e.rating, 0) / rated.length).toFixed(2)) : ''];
    row.height = 24;
    row.getCell(2).font = { name: 'Arial', bold: true, size: 11 };
    row.getCell(2).border = { left: { style: 'thick', color: { argb: TYPE_ARGB[T.key] } } };
    row.eachCell((c, i) => { if (i > 1) { c.alignment = { vertical: 'middle' }; c.border = { ...(c.border || {}), bottom: { style: 'thin', color: { argb: LINE } } }; } });
  }

  // ── una hoja por tipo, con portada ──
  const cols = [
    { header: t('Portada'), key: 'cover', width: 11 }, { header: t('Título'), key: 'title', width: 34 }, { header: t('Estado'), key: 'status', width: 14 },
    { header: t('Valoración'), key: 'stars', width: 12 }, { header: '★', key: 'rating', width: 6 }, { header: t('Año'), key: 'year', width: 7 },
    { header: t('Empezado'), key: 'started', width: 12 }, { header: t('Terminado'), key: 'finished', width: 12 }, { header: t('Progreso'), key: 'progress', width: 13 },
    { header: t('Dónde'), key: 'where', width: 16 }, { header: t('Géneros'), key: 'genres', width: 22 }, { header: t('Autoría'), key: 'creators', width: 22 },
    { header: t('Etiquetas'), key: 'tags', width: 16 }, { header: t('Mi nota'), key: 'note', width: 60 }, { header: t('Enlace'), key: 'link', width: 12 },
  ];
  const base = `${location.origin}${location.pathname}#/item/`;
  const imgs = new Map();
  let done = 0; const total = list.length;
  await pool(list, 6, async (e) => { const b = await thumb(e.cover); if (b) imgs.set(e.id, b); onProgress(++done, total); });

  for (const T of Object.values(TYPES)) {
    const of = list.filter((e) => e.type === T.key);
    if (!of.length) continue;
    const ws = wb.addWorksheet(t(T.plural), { views: [{ state: 'frozen', ySplit: 1, xSplit: 2, showGridLines: false }], properties: { tabColor: { argb: TYPE_ARGB[T.key] } } });
    ws.columns = cols;
    styleHeader(ws.getRow(1));
    of.forEach((e, i) => {
      const eps = (e.watchedEpisodes || []).length;
      const progress = e.type === 'series' ? (eps ? `${eps}${e.episodes ? '/' + e.episodes : ''} ep` : '')
        : e.type === 'book' ? (e.pages ? `${e.pages} pág` : '') : e.runtime ? `${e.runtime} min` : '';
      const where = [e.platform, e.consumption?.readOn, e.consumption?.listenedOn].filter(Boolean).join(' · ');
      const row = ws.addRow({
        title: e.title, status: t(statusLabel(e.status, e.type)), stars: starText(e.rating), rating: e.rating || null, year: e.year || null,
        started: e.startedAt || '', finished: e.finishedAt || '', progress, where, genres: (e.genres || []).map(t).join(', '),
        creators: (e.creators || []).join(', '), tags: (e.tags || []).join(', '), note: plain(notesById[e.id]?.body),
        link: { text: 'Veoleo ↗', hyperlink: base + e.id },
      });
      row.height = 74;
      const zebra = i % 2 ? 'FFFFFFFF' : PAPER;
      row.eachCell({ includeEmpty: true }, (c, n) => {
        c.alignment = { vertical: 'middle', wrapText: n === 2 || n === 14 || n === 11 || n === 12 };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebra } };
        c.font = { name: 'Arial', size: 10, color: { argb: 'FF1B1D26' } };
        c.border = { bottom: { style: 'thin', color: { argb: LINE } } };
      });
      row.getCell('title').font = { name: 'Arial', bold: true, size: 11, color: { argb: INK } };
      row.getCell('stars').font = { name: 'Arial', size: 12, color: { argb: 'FFE0A800' } };
      row.getCell('status').font = { name: 'Arial', bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
      row.getCell('status').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_ARGB[e.status] || 'FF8A8FA3' } };
      row.getCell('status').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('note').font = { name: 'Arial', italic: true, size: 9, color: { argb: 'FF3A3D4A' } };
      row.getCell('link').font = { name: 'Arial', size: 9, color: { argb: 'FF3B5BDB' }, underline: true };
      const buf = imgs.get(e.id);
      if (buf) {
        const id = wb.addImage({ buffer: buf, extension: 'jpeg' });
        ws.addImage(id, { tl: { col: 0.12, row: row.number - 1 + 0.06 }, ext: { width: 46, height: 69 }, editAs: 'oneCell' });
      }
    });
    ws.autoFilter = { from: { row: 1, column: 2 }, to: { row: of.length + 1, column: cols.length } };
  }

  const out = await wb.xlsx.writeBuffer();
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `${name}${year ? '-' + year : ''}.xlsx`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return list.length;
}
