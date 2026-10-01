// Datos: importar historial (TV Time, Netflix, Letterboxd, Goodreads, IMDb, Veoleo) y exportar en varios formatos.
import { html, useState, useRef, useEffect } from 'preact-standalone';
import { parseHash } from '../lib/router.js';
import { Icon, Switch, SectionHead, Scramble, PosterCard } from '../components/ui.js';
import { ExportModal } from './library.js';
import { useStore, toast } from '../lib/store.js';
import { parseImport, runImport, autoEnrich, exportCSV, exportJSON, exportTVTime, IMPORT_HELP, dupKey, parseTitleList } from '../lib/transfer.js';
import { Modal } from '../components/ui.js';
import { exportExcel } from '../lib/excel.js';
import { getNotesBulk } from '../lib/db.js';
import { entryYear } from '../lib/utils.js';
import { TYPES } from '../lib/utils.js';
import { sfx } from '../lib/sound.js';
import { flash, confetti } from '../lib/fx.js';

const SRC_C = { tvtime: 'var(--yellow)', netflix: 'var(--red)', letterboxd: 'var(--teal)', goodreads: 'var(--orange)', imdb: 'var(--yellow)', veoleo: 'var(--accent)', prime: 'var(--blue)', apple: 'var(--text-2)', disney: 'var(--blue)', hbo: 'var(--purple)', movistar: 'var(--teal)', filmin: 'var(--pink)', skyshowtime: 'var(--purple)' };
const FMT = { tvtime: 'TV Time', netflix: 'Netflix', letterboxd: 'Letterboxd', goodreads: 'Goodreads', imdb: 'IMDb', veoleo: 'Copia de Veoleo' };
const fmtName = (f) => f.split(' + ').map((x) => FMT[x] || x).join(' + ');

export function DataPage() {
  const { entries, lists, settings } = useStore();
  const [parsed, setParsed] = useState(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState('');
  const [prog, setProg] = useState(null);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(() => { try { return JSON.parse(localStorage.getItem('tvd.imports') || '{}'); } catch { return {}; } });
  const [skipDup, setSkipDup] = useState(true);
  const [enrichOn, setEnrichOn] = useState(true);
  const [exp, setExp] = useState(false);
  const [platform, setPlatform] = useState('');
  const [paste, setPaste] = useState(null);
  const [xYear, setXYear] = useState('');
  const [xProg, setXProg] = useState(null);
  const years = [...new Set(entries.map(entryYear).filter(Boolean))].sort((a, b) => b - a);
  async function excel() {
    const list = xYear ? entries.filter((e) => entryYear(e) === Number(xYear)) : entries;
    if (!list.length) { toast('No hay títulos de ese año', 'info'); return; }
    setXProg([0, list.length]);
    try {
      const notes = await getNotesBulk(list.map((e) => e.id));
      const n = await exportExcel(list, notes, { name: 'Veoleo', year: xYear, onProgress: (d, t) => setXProg([d, t]) });
      sfx.braam(0.4); flash(`${n} en Excel`, '#c6ff3d');
    } catch (x) { toast('Falló la exportación: ' + x.message, 'err'); }
    finally { setXProg(null); }
  }
  const fileRef = useRef();
  // Desde el menú de arriba: #/data?go=import | export
  useEffect(() => {
    const go = parseHash().query.go;
    if (go) setTimeout(() => document.getElementById(go === 'export' ? 'exportar' : 'importar')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  }, [location.hash]);

  async function onFiles(files) {
    if (!files?.length) return;
    setResult(null); setBusy('Leyendo archivos…');
    try { setParsed(await parseImport([...files], { platform })); sfx.open(); }
    catch (e) { toast(e.message, 'err'); sfx.error(); }
    finally { setBusy(''); if (fileRef.current) fileRef.current.value = ''; }
  }
  async function doImport() {
    setBusy('Importando…');
    const fmt = parsed.format;
    try {
      const created = await runImport(parsed, entries, { skipDuplicates: skipDup }, (label, d, t) => { if (t) setProg([d, t]); });
      setProg(null);
      flash(`${created.length} importados`, '#c6ff3d'); confetti(60); sfx.braam(0.5);
      setParsed(null);
      if (enrichOn && created.length) {
        setBusy('Completando portadas, episodios y estados…');
        await autoEnrich(created, settings, (d, t) => setProg([d, t]));
      }
      const h = { ...history }; fmt.split(' + ').forEach((f) => { h[f] = { at: Date.now(), n: created.length }; });
      setHistory(h); try { localStorage.setItem('tvd.imports', JSON.stringify(h)); } catch { /* sin storage */ }
      setResult({ fmt, n: created.length, dated: parsed.datesUpdated || 0, byType: Object.values(TYPES).map((t) => [t, created.filter((x) => x.type === t.key).length]).filter(([, n]) => n) });
    } catch (e) {
      const perm = /permission|insufficient/i.test(e.message || '');
      toast(perm ? 'La sesión había caducado. Cierra sesión, vuelve a entrar e importa de nuevo: lo que ya se guardó no se duplicará.' : 'Falló la importación: ' + e.message, 'err', 9000);
    }
    finally { setBusy(''); setProg(null); }
  }

  const counts = parsed ? Object.values(TYPES).map((t) => [t, parsed.items.filter((x) => x.type === t.key).length]).filter(([, n]) => n) : [];
  const have = new Set(entries.map(dupKey));
  const dups = parsed ? parsed.items.filter((x) => have.has(dupKey(x))).length : 0;
  const eps = parsed ? parsed.items.reduce((a, x) => a + (x.watchedEpisodes?.length || 0) + Object.values(x._nfSeasons || {}).reduce((s, n) => s + n, 0), 0) : 0;
  const pick = (plat = '') => { setPlatform(plat); fileRef.current?.click(); };

  return html`<div class="page wrap">
    <div class="page-head"><div><div class="kicker">Importar · Exportar · Copias</div><h1 class="display" style="margin-top:20px"><${Scramble} text="Tus datos" /></h1></div></div>
    <input ref=${fileRef} type="file" multiple accept=".csv,.json,.zip" style="display:none" onChange=${(e) => onFiles(e.currentTarget.files)} />

    <section id="importar" style="scroll-margin-top:100px">
      <${SectionHead} kicker="Importar" title="Trae tu historial">${!busy && !parsed && html`<button class="btn" onClick=${() => pick('')}><${Icon} name="upload" /> Elegir archivos</button>`}</${SectionHead}>

      ${busy ? html`<div class="stack" style="--g:18px;padding:40px 0">
          <div class="loader inline"><i></i><i></i><i></i></div><h3 class="h2">${busy}</h3>
          ${prog && html`<span class="count">${prog[0]} / ${prog[1]}</span><div class="season"><div class="sbar"><i style=${`width:${(prog[0] / Math.max(1, prog[1])) * 100}%`}></i></div></div>`}
        </div>`
      : parsed ? html`<div class="stack" style="--g:28px">
          <div><div class="label">Formato detectado</div><h3 class="h1" style="margin-top:10px">${fmtName(parsed.format)}</h3></div>
          <div class="stats">${counts.map(([t, n]) => html`<div class="stat" style=${`--c:${t.color}`}><b>${n}</b><span>${t.plural}</span></div>`)}
            ${eps > 0 && html`<div class="stat"><b>${eps}</b><span>Episodios vistos</span></div>`}</div>
          ${dups > 0 && html`<${Switch} checked=${skipDup} onChange=${setSkipDup} label=${`Saltar ${dups} que ya están en tu diario`} />`}
          ${dups > 0 && html`<p class="small muted" style="margin:-12px 0 0">A las que ya tienes se les completan las fechas (empezado, último episodio visto y terminado) con las de este archivo.</p>`}
          <${Switch} checked=${enrichOn} onChange=${setEnrichOn} label="Completar portadas, episodios y estados automáticamente (recomendado)" />
          <div class="grid" style="--min:120px;gap:20px 14px">${parsed.items.slice(0, 12).map((e, i) => html`<${PosterCard} key=${i} e=${e} href="javascript:void 0" onClick=${(ev) => ev.preventDefault()} />`)}</div>
          <div class="row"><button class="btn lg" onClick=${doImport}><${Icon} name="upload" /> Importar ${skipDup ? parsed.items.length - dups : parsed.items.length}</button><button class="btn lg ghost" onClick=${() => setParsed(null)}>Cancelar</button></div>
        </div>`
      : html`
        ${result && html`<div class="panel" style="margin-bottom:40px">
          <div class="label" style="color:var(--accent)">Importación completada</div>
          <h3 class="h2" style="margin:12px 0 18px">${result.n} títulos de ${fmtName(result.fmt)}</h3>
          <div class="row" style="--g:22px">${result.byType.map(([t, n]) => html`<span class="tag" style=${`--c:${t.color}`}>${n} ${t.plural}</span>`)}
            ${result.dated > 0 && html`<span class="tag" style="--c:var(--teal)">Fechas actualizadas en ${result.dated}</span>`}</div>
          <div class="row" style="margin-top:24px"><a class="btn" href="#/library">Ver biblioteca</a><button class="btn ghost" onClick=${() => pick('')}><${Icon} name="upload" /> Importar otro servicio</button></div>
        </div>`}
        <div class="src-tiles">${IMPORT_HELP.map((h) => html`<div class="src-tile" key=${h.id} style=${`--c:${SRC_C[h.id] || 'var(--accent)'}`}>
          <h3>${h.name}</h3><p>${h.how}</p>
          ${history[h.id] && html`<span class="done">✓ Importado ${new Date(history[h.id].at).toLocaleDateString('es-ES')}</span>`}
          ${h.paste ? html`<button class="btn sm ${history[h.id] ? 'ghost' : ''}" onClick=${() => setPaste(h)}><${Icon} name="list" size=${14} /> Pegar lista</button>`
            : html`<div class="row" style="--g:6px"><button class="btn sm ${history[h.id] ? 'ghost' : ''}" onClick=${() => pick(h.platform || '')}><${Icon} name="upload" size=${14} /> ${history[h.id] ? 'Importar de nuevo' : `Importar de ${h.name}`}</button>
              ${h.platform && html`<button class="btn sm ghost" onClick=${() => setPaste(h)}>Pegar lista</button>`}</div>`}
        </div>`)}</div>
        <label class=${'dropzone' + (over ? ' over' : '')} style="margin-top:24px"
          onDragOver=${(e) => { e.preventDefault(); setOver(true); }} onDragLeave=${() => setOver(false)}
          onDrop=${(e) => { e.preventDefault(); setOver(false); onFiles(e.dataTransfer.files); }} onClick=${(e) => { e.preventDefault(); pick(''); }}>
          <span class="label">O suelta aquí cualquier archivo (ZIP, CSV o JSON): el formato se detecta solo</span>
        </label>
        <p class="small muted" style="margin-top:24px;max-width:780px">¿Conectar Netflix, Movistar Plus+, HBO Max o Prime Video para que se añada solo lo que ves? Ninguna de estas plataformas ofrece una conexión pública para apps de terceros. Netflix sí permite descargar tu historial completo: impórtalo aquí cuando quieras y Veoleo añade lo nuevo y salta lo que ya tienes.</p>
      `}
    </section>

    <section class="section" id="exportar" style="scroll-margin-top:100px">
      <${SectionHead} kicker="Exportar" title="Llévatelo" color="var(--teal)"><span class="count">${entries.length} ENTRADAS · ${lists.length} LISTAS</span></${SectionHead}>
      <div class="src-tiles">
        <div class="src-tile wide" style="--c:#21a366"><h3><${Icon} name="grid" size=${20} /> Excel con portadas</h3>
          <p>Una hoja por tipo con portada, estado, estrellas, fechas, progreso, plataforma y tus notas, más una hoja de resumen. Filtros y cabecera fija.</p>
          <div class="row" style="--g:8px">
            <select class="select" style="max-width:180px" value=${xYear} onChange=${(e) => setXYear(e.currentTarget.value)}>
              <option value="">Todo</option>${years.map((y) => html`<option value=${y}>${y}</option>`)}</select>
            <button class="btn sm excel" disabled=${!entries.length || !!xProg} onClick=${excel}><${Icon} name="download" size=${14} /> ${xProg ? `${xProg[0]}/${xProg[1]}` : 'Descargar .xlsx'}</button>
          </div></div>
        <div class="src-tile wide" style="--c:var(--purple)"><h3><${Icon} name="obsidian" size=${20} /> Obsidian completo</h3>
          <p>Todo tu diario como bóveda de Obsidian: una nota por título con portada, valoración, episodios con sinopsis y tu nota, más índice con Dataview y listas.</p>
          <div class="row" style="--g:8px"><button class="btn sm obsidian" disabled=${!entries.length} onClick=${() => setExp('zip')}><${Icon} name="download" size=${14} /> Bóveda .zip</button>
            <button class="btn sm ghost" disabled=${!entries.length} onClick=${() => setExp('single')}>Un solo .md</button></div></div>
        ${[
        ['Formato TV Time', 'Episodios vistos, series seguidas y películas con la misma estructura que la descarga de datos de TV Time. Ideal para bingers que cambian de app.', 'var(--yellow)', async () => { await exportTVTime(entries); sfx.pop(); }],
        ['Trakt', 'CSV de episodios y películas vistos para importar en Trakt.', 'var(--red)', () => { exportCSV(entries, 'Veoleo-trakt.csv', 'trakt'); sfx.pop(); }],
        ['Más formatos', 'CSV, Letterboxd o Goodreads.', 'var(--teal)', () => setExp(true)],
        ['Copia de seguridad', 'JSON con todas tus entradas, notas y listas. Se puede volver a importar.', 'var(--accent)', async () => { await exportJSON(entries, 'Veoleo-backup.json', lists); sfx.pop(); }],
      ].map(([t, d, c, fn]) => html`<div class="src-tile" key=${t} style=${`--c:${c}`}><h3>${t}</h3><p>${d}</p>
        <button class="btn sm" disabled=${!entries.length} onClick=${fn}><${Icon} name="download" size=${14} /> Exportar</button></div>`)}</div>
    </section>
    ${paste && html`<${PasteModal} src=${paste} onClose=${() => setPaste(null)} onParsed=${(p) => { setPaste(null); setResult(null); setParsed(p); sfx.open(); }} />`}
    ${exp && html`<${ExportModal} entries=${entries} name="Veoleo" settings=${settings} lists=${lists} auto=${exp === true ? '' : exp} onClose=${() => setExp(false)} />`}
  </div>`;
}

function PasteModal({ src, onClose, onParsed }) {
  const [text, setText] = useState('');
  const n = text.split(/\r?\n/).filter((l) => l.trim()).length;
  return html`<${Modal} kicker="Importar" title=${src.name} width=${720} onClose=${onClose}
    actions=${html`<button class="btn" disabled=${!n} onClick=${() => { const p = parseTitleList(text, src.platform); if (p.items.length) onParsed(p); else toast('No hay títulos', 'err'); }}>Revisar ${n || ''}</button>`}>
    <p class="muted" style="margin:0 0 14px">${src.how}</p>
    <textarea class="textarea" style="min-height:300px" autofocus placeholder=${'The Last of Us: Temporada 1: Cuando estás perdido en la oscuridad\nThe Last of Us: Temporada 1: Infectados\nLa sociedad de la nieve (2023)\nSucession'}
      value=${text} onInput=${(e) => setText(e.currentTarget.value)}></textarea>
    <span class="count" style="display:block;margin-top:10px">${n} LÍNEAS · SE MARCARÁN CON LA PLATAFORMA ${String(src.platform || '').toUpperCase()}</span>
  </${Modal}>`;
}
