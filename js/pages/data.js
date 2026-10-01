// Datos: importar historial (TV Time, Letterboxd, Goodreads, IMDb, TVDaily) y exportar en varios formatos.
import { html, useState } from 'preact-standalone';
import { Icon, Switch, SectionHead, Scramble, PosterCard } from '../components/ui.js';
import { ExportModal } from './library.js';
import { useStore, toast } from '../lib/store.js';
import { parseImport, runImport, autoEnrich, exportCSV, exportJSON, IMPORT_HELP } from '../lib/transfer.js';
import { TYPES } from '../lib/utils.js';
import { sfx } from '../lib/sound.js';
import { flash, confetti } from '../lib/fx.js';

export function DataPage() {
  const { entries, lists, settings } = useStore();
  const [parsed, setParsed] = useState(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState('');
  const [prog, setProg] = useState(null);
  const [skipDup, setSkipDup] = useState(true);
  const [enrichOn, setEnrichOn] = useState(true);
  const [exp, setExp] = useState(false);

  async function onFiles(files) {
    if (!files?.length) return;
    setBusy('Leyendo archivos…');
    try {
      const p = await parseImport([...files]);
      setParsed(p); sfx.open();
    } catch (e) { toast(e.message, 'err'); sfx.error(); }
    finally { setBusy(''); }
  }
  async function doImport() {
    setBusy('Importando…');
    try {
      const created = await runImport(parsed, entries, { skipDuplicates: skipDup }, () => {});
      flash(`${created.length} importados`, '#c6ff3d'); confetti(60); sfx.braam(0.5);
      setParsed(null);
      if (enrichOn && created.length) {
        setBusy('Completando portadas y fichas…');
        await autoEnrich(created, settings, (d, t) => setProg([d, t]));
        toast('Portadas y fichas completadas', 'ok');
      }
    } catch (e) { toast('Falló la importación: ' + e.message, 'err'); }
    finally { setBusy(''); setProg(null); }
  }

  const counts = parsed ? Object.values(TYPES).map((t) => [t, parsed.items.filter((x) => x.type === t.key).length]).filter(([, n]) => n) : [];
  const dupKey = (e) => `${e.type}|${String(e.title).toLowerCase()}|${e.year || ''}`;
  const have = new Set(entries.map(dupKey));
  const dups = parsed ? parsed.items.filter((x) => have.has(dupKey(x))).length : 0;
  const eps = parsed ? parsed.items.reduce((a, x) => a + (x.watchedEpisodes?.length || 0), 0) : 0;

  return html`<div class="page wrap">
    <div class="page-head"><div><div class="kicker">Importar · Exportar · Copias</div><h1 class="display" style="margin-top:20px"><${Scramble} text="Tus datos" /></h1></div></div>

    <div class="cols-2">
      <section>
        <${SectionHead} kicker="Importar" title="Trae tu historial" />
        ${busy ? html`<div class="stack" style="--g:18px;padding:40px 0">
            <div class="loader inline"><i></i><i></i><i></i></div><h3 class="h2">${busy}</h3>
            ${prog && html`<span class="count">${prog[0]} / ${prog[1]}</span><div class="season"><div class="sbar"><i style=${`width:${(prog[0] / Math.max(1, prog[1])) * 100}%`}></i></div></div>`}
          </div>`
        : parsed ? html`<div class="stack" style="--g:24px">
            <div><div class="label">Formato detectado</div><h3 class="h2" style="margin-top:8px">${parsed.format === 'tvdaily' ? 'Copia de TVDaily' : parsed.format.replace('tvtime', 'TV Time').replace('letterboxd', 'Letterboxd').replace('goodreads', 'Goodreads').replace('imdb', 'IMDb')}</h3></div>
            <div class="stats">${counts.map(([t, n]) => html`<div class="stat" style=${`--c:${t.color}`}><b>${n}</b><span>${t.plural}</span></div>`)}
              ${eps > 0 && html`<div class="stat"><b>${eps}</b><span>Episodios vistos</span></div>`}</div>
            ${dups > 0 && html`<${Switch} checked=${skipDup} onChange=${setSkipDup} label=${`Saltar ${dups} que ya están en tu diario`} />`}
            <${Switch} checked=${enrichOn} onChange=${setEnrichOn} label="Completar portadas, géneros y fichas automáticamente" />
            <div class="grid" style="--min:120px;gap:20px 14px">${parsed.items.slice(0, 12).map((e, i) => html`<${PosterCard} key=${i} e=${e} href="javascript:void 0" onClick=${(ev) => ev.preventDefault()} />`)}</div>
            <div class="row"><button class="btn lg" onClick=${doImport}><${Icon} name="upload" /> Importar ${skipDup ? parsed.items.length - dups : parsed.items.length}</button><button class="btn lg ghost" onClick=${() => setParsed(null)}>Cancelar</button></div>
          </div>`
        : html`<label class=${'dropzone' + (over ? ' over' : '')}
            onDragOver=${(e) => { e.preventDefault(); setOver(true); }} onDragLeave=${() => setOver(false)}
            onDrop=${(e) => { e.preventDefault(); setOver(false); onFiles(e.dataTransfer.files); }}>
            <input type="file" multiple accept=".csv,.json,.zip" style="display:none" onChange=${(e) => onFiles(e.currentTarget.files)} />
            <${Icon} name="upload" size=${32} />
            <h3 class="h2" style="margin:18px 0 10px">Suelta aquí tus archivos</h3>
            <p class="muted" style="margin:0">ZIP, CSV o JSON · o pulsa para elegirlos</p>
          </label>
          <div style="margin-top:36px">${IMPORT_HELP.map((h) => html`<div class="list-card" style="padding:18px 0;--c:var(--blue)"><h3>${h.name}</h3><p class="muted small" style="margin:8px 0 0">${h.how}</p></div>`)}</div>`}
      </section>

      <aside>
        <${SectionHead} kicker="Exportar" title="Llévatelo" color="var(--teal)" />
        <div class="stack" style="--g:0">
          ${[
            ['Obsidian y otros formatos', 'Bóveda Markdown, CSV, Letterboxd, Goodreads…', () => setExp(true)],
            ['CSV de episodios (Trakt)', 'Episodios vistos y películas en formato de importación de Trakt.', () => { exportCSV(entries, 'TVDaily-trakt.csv', 'trakt'); sfx.pop(); }],
            ['Copia de seguridad completa', 'JSON con todas tus entradas, notas y listas.', async () => { await exportJSON(entries, 'TVDaily-backup.json', lists); sfx.pop(); }],
          ].map(([t, d, fn]) => html`<button class="list-card" style="--c:var(--teal);text-align:left;background:none;border:0;border-top:1px solid var(--line);cursor:pointer;width:100%;color:inherit;font:inherit;padding:22px 0"
              disabled=${!entries.length} onClick=${fn}><h3>${t}</h3><span class="muted small" style="display:block;margin-top:8px">${d}</span></button>`)}
        </div>
        <p class="count" style="margin-top:20px">${entries.length} ENTRADAS · ${lists.length} LISTAS</p>
      </aside>
    </div>
    ${exp && html`<${ExportModal} entries=${entries} name="TVDaily" settings=${settings} lists=${lists} onClose=${() => setExp(false)} />`}
  </div>`;
}
