// Datos: importar historial (TV Time, Netflix, Letterboxd, Goodreads, IMDb, TVDaily) y exportar en varios formatos.
import { html, useState, useRef } from 'preact-standalone';
import { Icon, Switch, SectionHead, Scramble, PosterCard } from '../components/ui.js';
import { ExportModal } from './library.js';
import { useStore, toast } from '../lib/store.js';
import { parseImport, runImport, autoEnrich, exportCSV, exportJSON, exportTVTime, IMPORT_HELP } from '../lib/transfer.js';
import { TYPES } from '../lib/utils.js';
import { sfx } from '../lib/sound.js';
import { flash, confetti } from '../lib/fx.js';

const SRC_C = { tvtime: 'var(--yellow)', netflix: 'var(--red)', letterboxd: 'var(--teal)', goodreads: 'var(--orange)', imdb: 'var(--yellow)', tvdaily: 'var(--accent)' };
const FMT = { tvtime: 'TV Time', netflix: 'Netflix', letterboxd: 'Letterboxd', goodreads: 'Goodreads', imdb: 'IMDb', tvdaily: 'Copia de TVDaily' };
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
  const fileRef = useRef();

  async function onFiles(files) {
    if (!files?.length) return;
    setResult(null); setBusy('Leyendo archivos…');
    try { setParsed(await parseImport([...files])); sfx.open(); }
    catch (e) { toast(e.message, 'err'); sfx.error(); }
    finally { setBusy(''); if (fileRef.current) fileRef.current.value = ''; }
  }
  async function doImport() {
    setBusy('Importando…');
    const fmt = parsed.format;
    try {
      const created = await runImport(parsed, entries, { skipDuplicates: skipDup }, () => {});
      flash(`${created.length} importados`, '#c6ff3d'); confetti(60); sfx.braam(0.5);
      setParsed(null);
      if (enrichOn && created.length) {
        setBusy('Completando portadas, episodios y estados…');
        await autoEnrich(created, settings, (d, t) => setProg([d, t]));
      }
      const h = { ...history }; fmt.split(' + ').forEach((f) => { h[f] = { at: Date.now(), n: created.length }; });
      setHistory(h); try { localStorage.setItem('tvd.imports', JSON.stringify(h)); } catch { /* sin storage */ }
      setResult({ fmt, n: created.length, byType: Object.values(TYPES).map((t) => [t, created.filter((x) => x.type === t.key).length]).filter(([, n]) => n) });
    } catch (e) { toast('Falló la importación: ' + e.message, 'err'); }
    finally { setBusy(''); setProg(null); }
  }

  const counts = parsed ? Object.values(TYPES).map((t) => [t, parsed.items.filter((x) => x.type === t.key).length]).filter(([, n]) => n) : [];
  const dupKey = (e) => `${e.type}|${String(e.title).toLowerCase()}|${e.year || ''}`;
  const have = new Set(entries.map(dupKey));
  const dups = parsed ? parsed.items.filter((x) => have.has(dupKey(x))).length : 0;
  const eps = parsed ? parsed.items.reduce((a, x) => a + (x.watchedEpisodes?.length || 0) + Object.values(x._nfSeasons || {}).reduce((s, n) => s + n, 0), 0) : 0;
  const pick = () => fileRef.current?.click();

  return html`<div class="page wrap">
    <div class="page-head"><div><div class="kicker">Importar · Exportar · Copias</div><h1 class="display" style="margin-top:20px"><${Scramble} text="Tus datos" /></h1></div></div>
    <input ref=${fileRef} type="file" multiple accept=".csv,.json,.zip" style="display:none" onChange=${(e) => onFiles(e.currentTarget.files)} />

    <section>
      <${SectionHead} kicker="Importar" title="Trae tu historial">${!busy && !parsed && html`<button class="btn" onClick=${pick}><${Icon} name="upload" /> Elegir archivos</button>`}</${SectionHead}>

      ${busy ? html`<div class="stack" style="--g:18px;padding:40px 0">
          <div class="loader inline"><i></i><i></i><i></i></div><h3 class="h2">${busy}</h3>
          ${prog && html`<span class="count">${prog[0]} / ${prog[1]}</span><div class="season"><div class="sbar"><i style=${`width:${(prog[0] / Math.max(1, prog[1])) * 100}%`}></i></div></div>`}
        </div>`
      : parsed ? html`<div class="stack" style="--g:28px">
          <div><div class="label">Formato detectado</div><h3 class="h1" style="margin-top:10px">${fmtName(parsed.format)}</h3></div>
          <div class="stats">${counts.map(([t, n]) => html`<div class="stat" style=${`--c:${t.color}`}><b>${n}</b><span>${t.plural}</span></div>`)}
            ${eps > 0 && html`<div class="stat"><b>${eps}</b><span>Episodios vistos</span></div>`}</div>
          ${dups > 0 && html`<${Switch} checked=${skipDup} onChange=${setSkipDup} label=${`Saltar ${dups} que ya están en tu diario`} />`}
          <${Switch} checked=${enrichOn} onChange=${setEnrichOn} label="Completar portadas, episodios y estados automáticamente (recomendado)" />
          <div class="grid" style="--min:120px;gap:20px 14px">${parsed.items.slice(0, 12).map((e, i) => html`<${PosterCard} key=${i} e=${e} href="javascript:void 0" onClick=${(ev) => ev.preventDefault()} />`)}</div>
          <div class="row"><button class="btn lg" onClick=${doImport}><${Icon} name="upload" /> Importar ${skipDup ? parsed.items.length - dups : parsed.items.length}</button><button class="btn lg ghost" onClick=${() => setParsed(null)}>Cancelar</button></div>
        </div>`
      : html`
        ${result && html`<div class="panel" style="margin-bottom:40px">
          <div class="label" style="color:var(--accent)">Importación completada</div>
          <h3 class="h2" style="margin:12px 0 18px">${result.n} títulos de ${fmtName(result.fmt)}</h3>
          <div class="row" style="--g:22px">${result.byType.map(([t, n]) => html`<span class="tag" style=${`--c:${t.color}`}>${n} ${t.plural}</span>`)}</div>
          <div class="row" style="margin-top:24px"><a class="btn" href="#/library">Ver biblioteca</a><button class="btn ghost" onClick=${pick}><${Icon} name="upload" /> Importar otro servicio</button></div>
        </div>`}
        <div class="src-tiles">${IMPORT_HELP.map((h) => html`<div class="src-tile" key=${h.id} style=${`--c:${SRC_C[h.id] || 'var(--accent)'}`}>
          <h3>${h.name}</h3><p>${h.how}</p>
          ${history[h.id] && html`<span class="done">✓ Importado ${new Date(history[h.id].at).toLocaleDateString('es-ES')}</span>`}
          <button class="btn sm ${history[h.id] ? 'ghost' : ''}" onClick=${pick}><${Icon} name="upload" size=${14} /> ${history[h.id] ? 'Importar de nuevo' : `Importar de ${h.name}`}</button>
        </div>`)}</div>
        <label class=${'dropzone' + (over ? ' over' : '')} style="margin-top:24px"
          onDragOver=${(e) => { e.preventDefault(); setOver(true); }} onDragLeave=${() => setOver(false)}
          onDrop=${(e) => { e.preventDefault(); setOver(false); onFiles(e.dataTransfer.files); }} onClick=${(e) => { e.preventDefault(); pick(); }}>
          <span class="label">O suelta aquí cualquier archivo (ZIP, CSV o JSON): el formato se detecta solo</span>
        </label>
        <p class="small muted" style="margin-top:24px;max-width:780px">¿Conectar Netflix, Movistar Plus+, HBO Max o Prime Video para que se añada solo lo que ves? Ninguna de estas plataformas ofrece una conexión pública para apps de terceros. Netflix sí permite descargar tu historial completo: impórtalo aquí cuando quieras y TVDaily añade lo nuevo y salta lo que ya tienes.</p>
      `}
    </section>

    <section class="section">
      <${SectionHead} kicker="Exportar" title="Llévatelo" color="var(--teal)"><span class="count">${entries.length} ENTRADAS · ${lists.length} LISTAS</span></${SectionHead}>
      <div class="src-tiles">${[
        ['Formato TV Time', 'Episodios vistos, series seguidas y películas con la misma estructura que la descarga de datos de TV Time. Ideal para bingers que cambian de app.', 'var(--yellow)', async () => { await exportTVTime(entries); sfx.pop(); }],
        ['Obsidian y más', 'Bóveda de Markdown con Dataview, un único .md, CSV, Letterboxd o Goodreads.', 'var(--purple)', () => setExp(true)],
        ['Trakt', 'CSV de episodios y películas vistos para importar en Trakt.', 'var(--red)', () => { exportCSV(entries, 'TVDaily-trakt.csv', 'trakt'); sfx.pop(); }],
        ['Copia de seguridad', 'JSON con todas tus entradas, notas y listas. Se puede volver a importar.', 'var(--accent)', async () => { await exportJSON(entries, 'TVDaily-backup.json', lists); sfx.pop(); }],
      ].map(([t, d, c, fn]) => html`<div class="src-tile" key=${t} style=${`--c:${c}`}><h3>${t}</h3><p>${d}</p>
        <button class="btn sm" disabled=${!entries.length} onClick=${fn}><${Icon} name="download" size=${14} /> Exportar</button></div>`)}</div>
    </section>
    ${exp && html`<${ExportModal} entries=${entries} name="TVDaily" settings=${settings} lists=${lists} onClose=${() => setExp(false)} />`}
  </div>`;
}
