// Año en que se vio/leyó: este año, otro año concreto o «Otros años» (no se sabe).
import { html } from 'preact-standalone';
import { Chip } from './ui.js';
import { entryYear, todayISO } from '../lib/utils.js';

export const CUR_YEAR = new Date().getFullYear();
export const YEARS = Array.from({ length: CUR_YEAR - 1949 }, (_, i) => CUR_YEAR - i);

// Valor del selector: 'this' | número de año | 'unknown'
export function yearChoiceOf(e, isNew = false) {
  if (e.yearUnknown) return 'unknown';
  if (e.watchedYear) return Number(e.watchedYear) === CUR_YEAR ? 'this' : Number(e.watchedYear);
  if (isNew) return 'this';
  const y = entryYear(e);
  return !y ? 'unknown' : y === CUR_YEAR ? 'this' : y;
}

// Cambios a guardar según la elección (la fecha exacta solo se conserva si cuadra con el año elegido).
export function yearPatch(choice, finishedAt = '') {
  const fy = finishedAt ? Number(String(finishedAt).slice(0, 4)) : null;
  if (choice === 'unknown') return { yearUnknown: true, watchedYear: null, finishedAt: '' };
  if (choice === 'this' || Number(choice) === CUR_YEAR) return { yearUnknown: false, watchedYear: null, finishedAt: fy === CUR_YEAR ? finishedAt : todayISO() };
  return { yearUnknown: false, watchedYear: Number(choice), finishedAt: fy === Number(choice) ? finishedAt : '' };
}

export function YearPicker({ value, onChange, compact = false }) {
  const other = typeof value === 'number' && value !== CUR_YEAR;
  return html`<div class=${'year-pick' + (compact ? ' compact' : '')} role="group" aria-label="Año">
    <${Chip} on=${value === 'this'} color="var(--accent)" onClick=${() => onChange('this')}>Este año · ${CUR_YEAR}</${Chip}>
    <select class=${'select' + (other ? ' on' : '')} value=${other ? String(value) : ''} aria-label="Otro año"
      onChange=${(e) => e.currentTarget.value && onChange(Number(e.currentTarget.value))}>
      <option value="">${other ? '' : 'Otro año…'}</option>
      ${YEARS.filter((y) => y !== CUR_YEAR).map((y) => html`<option value=${y}>${y}</option>`)}
    </select>
    <${Chip} on=${value === 'unknown'} color="var(--purple)" fg="#fff" onClick=${() => onChange('unknown')}>No lo sé · Otros años</${Chip}>
  </div>`;
}
