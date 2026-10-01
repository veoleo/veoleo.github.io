// Estado global mínimo con suscripción (sin dependencias).
import { useState, useEffect } from 'preact-standalone';

const state = {
  authReady: false,
  user: null,        // usuario de Firebase Auth
  profile: null,     // users/{uid}
  settings: {},      // users/{uid}/private/settings
  entries: [],       // entradas propias (en vivo)
  entriesReady: false,
  lists: [],         // listas propias (en vivo)
  following: [],     // uids que sigo
  savedNews: [],     // noticias guardadas
  toasts: [],
};
const subs = new Set();
let version = 0;

export const getState = () => state;
export function setState(patch) {
  Object.assign(state, typeof patch === 'function' ? patch(state) : patch);
  version++;
  subs.forEach((f) => f());
}
export function useStore() {
  const [, force] = useState(0);
  const seen = version;
  useEffect(() => {
    const f = () => force((x) => x + 1);
    subs.add(f);
    // Si el estado cambió entre el render y la suscripción, re-renderizamos.
    if (version !== seen) f();
    return () => subs.delete(f);
  }, []);
  return state;
}

let toastId = 0;
export function toast(text, kind = 'info', ms = 3200) {
  const id = ++toastId;
  setState({ toasts: [...state.toasts, { id, text, kind }] });
  setTimeout(() => setState({ toasts: state.toasts.filter((t) => t.id !== id) }), ms);
}
