// Capa de acceso a Firebase (Auth + Firestore).
import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, updateProfile as updateAuthProfile, sendPasswordResetEmail,
  signInAnonymously, linkWithCredential, linkWithPopup, linkWithRedirect, EmailAuthProvider,
} from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot,
  query, where, orderBy, limit, serverTimestamp, getCountFromServer, writeBatch, increment, runTransaction,
} from 'firebase/firestore';
import { firebaseConfig } from '../config.js';
import { getState, setState } from './store.js';
import { slug } from './utils.js';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
let db;
try {
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch {
  db = initializeFirestore(app, {});
}
export { db };

const withId = (d) => ({ id: d.id, ...d.data() });
const uidOrThrow = () => {
  const u = getState().user; if (!u) throw new Error('Necesitas iniciar sesión');
  return u.uid;
};

/* ───────────── Auth ───────────── */

export function onAuth(cb) { return onAuthStateChanged(auth, cb); }
export const loginEmail = (email, pass) => signInWithEmailAndPassword(auth, email, pass);
let pendingName = '';
export async function registerEmail(name, email, pass) {
  pendingName = String(name || '').trim();
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  if (name) await updateAuthProfile(cred.user, { displayName: name });
  return cred;
}
// Popup en navegador; redirección si es la app instalada o el popup está bloqueado.
export async function loginGoogle() {
  const provider = new GoogleAuthProvider();
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) return signInWithRedirect(auth, provider);
  try { return await signInWithPopup(auth, provider); }
  catch (e) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/web-storage-unsupported'].includes(e?.code)) return signInWithRedirect(auth, provider);
    throw e;
  }
}
export const logout = () => signOut(auth);
export const resetPassword = (email) => sendPasswordResetEmail(auth, email);

export function authErrorText(e) {
  const c = e?.code || '';
  return {
    'auth/invalid-credential': 'Email o contraseña incorrectos.',
    'auth/admin-restricted-operation': 'El modo invitado no está disponible ahora mismo.',
    'auth/provider-already-linked': 'Esta cuenta ya está guardada.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/user-not-found': 'No existe ninguna cuenta con ese email.',
    'auth/email-already-in-use': 'Ya hay una cuenta con ese email.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/invalid-email': 'El email no es válido.',
    'auth/popup-closed-by-user': 'Has cerrado la ventana de Google.',
    'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
    'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase Auth.',
  }[c] || e?.message || 'Algo ha fallado.';
}

/* ───────────── Perfil ───────────── */

// Probar sin cuenta: sesión de invitado con una biblioteca de ejemplo (gratis, sin datos personales).
export const loginGuest = () => signInAnonymously(auth);
export const isGuest = () => !!auth.currentUser?.isAnonymous;

// Convertir la sesión de invitado en una cuenta real conservando todo lo hecho.
async function promoteGuest(user, name) {
  const displayName = (name || user.displayName || '').trim() || 'Fan de Veoleo';
  await updateDoc(doc(db, 'users', user.uid), { guest: false, displayName, photoURL: user.photoURL || getState().profile?.photoURL || '' });
  setState({ profile: { ...getState().profile, guest: false, displayName, photoURL: user.photoURL || getState().profile?.photoURL || '' }, user: auth.currentUser });
  const h = slug(displayName).replace(/-/g, '').slice(0, 16);
  if (h.length >= 3) await changeHandle(h).catch(() => changeHandle(h + Math.floor(100 + Math.random() * 900)).catch(() => {}));
}
const linkError = (e) => {
  if (e?.code === 'auth/credential-already-in-use' || e?.code === 'auth/email-already-in-use') {
    return new Error('Esa cuenta ya existe. Cierra la sesión de invitado y entra con ella (el diario de prueba no se pasa a una cuenta que ya existe).');
  }
  return e;
};
export async function linkGuestEmail(name, email, pass) {
  try {
    const cred = await linkWithCredential(auth.currentUser, EmailAuthProvider.credential(email, pass));
    if (name) await updateAuthProfile(cred.user, { displayName: name });
    await promoteGuest(cred.user, name);
  } catch (e) { throw linkError(e); }
}
export async function linkGuestGoogle() {
  const provider = new GoogleAuthProvider();
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
  try {
    if (standalone) return await linkWithRedirect(auth.currentUser, provider);
    const res = await linkWithPopup(auth.currentUser, provider);
    const g = res.user.providerData.find((p) => p.providerId === 'google.com');
    if (g && !res.user.displayName) await updateAuthProfile(res.user, { displayName: g.displayName, photoURL: g.photoURL });
    await promoteGuest({ ...res.user, displayName: res.user.displayName || g?.displayName, photoURL: res.user.photoURL || g?.photoURL }, res.user.displayName || g?.displayName);
  } catch (e) { throw linkError(e); }
}

export async function ensureProfile(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const p = snap.data();
    // Vuelta de vincular con Google por redirección (app instalada): la cuenta ya no es de invitado.
    if (p.guest && !user.isAnonymous) {
      const g = user.providerData.find((x) => x.providerId === 'google.com');
      const displayName = user.displayName || g?.displayName || p.displayName;
      await updateDoc(ref, { guest: false, displayName, photoURL: user.photoURL || g?.photoURL || '' }).catch(() => {});
      return { ...p, guest: false, displayName, photoURL: user.photoURL || g?.photoURL || '' };
    }
    return p;
  }
  if (user.isAnonymous) {
    let handle = 'invitado' + Math.floor(100000 + Math.random() * 900000);
    await setDoc(doc(db, 'handles', handle), { uid: user.uid }).catch(() => { handle = ''; });
    const profile = { uid: user.uid, displayName: 'Invitado', handle, photoURL: '', bio: '', challenges: {}, guest: true, createdAt: serverTimestamp() };
    await setDoc(ref, profile);
    const { SAMPLE_ENTRIES } = await import('./sample.js');
    await importEntries(SAMPLE_ENTRIES).catch((e) => console.warn('[Veoleo] ejemplo', e.message));
    return profile;
  }
  // El @usuario nunca se deriva del email para no exponerlo.
  const name = user.displayName || pendingName;
  const base = (slug(name).replace(/-/g, '') || 'fan').slice(0, 16).padEnd(3, '0');
  let handle = base;
  for (let i = 0; i < 6; i++) {
    try { await setDoc(doc(db, 'handles', handle), { uid: user.uid }); break; }
    catch { handle = base + Math.floor(1000 + Math.random() * 9000); }
  }
  const profile = {
    uid: user.uid,
    displayName: name || 'Fan de Veoleo',
    handle,
    photoURL: user.photoURL || '',
    bio: '',
    challenges: {},
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, profile);
  return profile;
}

export async function updateMyProfile(patch) {
  const uid = uidOrThrow();
  await updateDoc(doc(db, 'users', uid), patch);
  setState({ profile: { ...getState().profile, ...patch } });
}

export async function changeHandle(newHandle) {
  const uid = uidOrThrow();
  const h = slug(newHandle).replace(/-/g, '').slice(0, 24);
  if (h.length < 3) throw new Error('El usuario debe tener al menos 3 caracteres (a-z, 0-9).');
  const old = getState().profile?.handle;
  if (h === old) return h;
  const ref = doc(db, 'handles', h);
  const ex = await getDoc(ref);
  if (ex.exists() && ex.data().uid !== uid) throw new Error(`@${h} ya está cogido.`);
  await setDoc(ref, { uid });
  await updateMyProfile({ handle: h });
  if (old) await deleteDoc(doc(db, 'handles', old)).catch(() => {});
  return h;
}

export async function getUser(uid) {
  const s = await getDoc(doc(db, 'users', uid));
  return s.exists() ? s.data() : null;
}
export async function findUserByHandle(handle) {
  const s = await getDoc(doc(db, 'handles', slug(handle).replace(/-/g, '')));
  return s.exists() ? getUser(s.data().uid) : null;
}
export async function searchUsers(prefix) {
  const p = slug(prefix).replace(/-/g, '');
  if (!p) return recentUsers();
  const q = query(collection(db, 'users'), where('handle', '>=', p), where('handle', '<=', p + ''), limit(20));
  return (await getDocs(q)).docs.map((d) => d.data()).filter((u) => !u.guest);
}
export async function recentUsers(n = 24) {
  const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(n + 20));
  return (await getDocs(q)).docs.map((d) => d.data()).filter((u) => !u.guest).slice(0, n);
}

/* ───────────── Ajustes privados ───────────── */

export async function loadSettings(uid) {
  const s = await getDoc(doc(db, 'users', uid, 'private', 'settings'));
  return s.exists() ? s.data() : {};
}
export async function saveSettings(patch) {
  const uid = uidOrThrow();
  await setDoc(doc(db, 'users', uid, 'private', 'settings'), patch, { merge: true });
  setState({ settings: { ...getState().settings, ...patch } });
}

/* ───────────── Noticias guardadas (privadas) ───────────── */

export async function loadSavedNews(uid) {
  try {
    const s = await getDoc(doc(db, 'users', uid, 'private', 'news'));
    return s.exists() ? s.data().items || [] : [];
  } catch { return []; }
}
export async function toggleSavedNews(n) {
  const uid = uidOrThrow();
  const cur = getState().savedNews || [];
  const has = cur.some((x) => x.id === n.id);
  const items = has ? cur.filter((x) => x.id !== n.id)
    : [{ id: n.id, title: n.title, link: n.link, image: n.image || '', sourceName: n.sourceName, lang: n.lang, cat: n.cat || '', date: n.date, summary: (n.summary || '').slice(0, 300), savedAt: Date.now() }, ...cur].slice(0, 300);
  setState({ savedNews: items });
  try { await setDoc(doc(db, 'users', uid, 'private', 'news'), { items }); }
  catch (e) { setState({ savedNews: cur }); throw e; }
  return !has;
}

/* ───────────── Suscripciones en vivo ───────────── */

export function watchMine(uid) {
  const unsubs = [];
  unsubs.push(onSnapshot(query(collection(db, 'entries'), where('ownerId', '==', uid)), (snap) => {
    setState({ entries: snap.docs.map(withId), entriesReady: true });
  }, (e) => { console.error('[Veoleo] entries', e); setState({ entriesReady: true }); }));
  unsubs.push(onSnapshot(query(collection(db, 'lists'), where('ownerId', '==', uid)), (snap) => {
    setState({ lists: snap.docs.map(withId) });
  }, (e) => console.error('[Veoleo] lists', e)));
  unsubs.push(onSnapshot(query(collection(db, 'follows'), where('followerId', '==', uid)), (snap) => {
    setState({ following: snap.docs.map((d) => d.data().followingId) });
  }, (e) => console.error('[Veoleo] follows', e)));
  return () => unsubs.forEach((u) => u());
}

/* ───────────── Entradas ───────────── */

function ownerFields() {
  const p = getState().profile || {};
  return { ownerName: p.displayName || '', ownerHandle: p.handle || '', ownerPhoto: p.photoURL || '' };
}

// Firestore no admite undefined: lo limpiamos en profundidad.
function clean(o) {
  if (Array.isArray(o)) return o.map(clean);
  if (o && typeof o === 'object' && !(o.constructor && o.constructor.name !== 'Object')) {
    const r = {};
    for (const [k, v] of Object.entries(o)) if (v !== undefined) r[k] = clean(v);
    return r;
  }
  return o;
}

// Privacidad por defecto (Ajustes → Privacidad).
export const defaultVisibility = () => (getState().settings?.privateByDefault || auth.currentUser?.isAnonymous ? 'private' : 'public');

export async function createEntry(data) {
  const uid = uidOrThrow();
  const ref = await addDoc(collection(db, 'entries'), clean({
    ...data, visibility: data.visibility || defaultVisibility(), ownerId: uid, ...ownerFields(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }));
  return ref.id;
}
export async function updateEntry(id, patch) {
  await updateDoc(doc(db, 'entries', id), clean({ ...patch, ...ownerFields(), updatedAt: serverTimestamp() }));
}
export async function deleteEntry(id) {
  const uid = uidOrThrow();
  await deleteDoc(doc(db, 'notes', id)).catch(() => {});
  await deleteDoc(doc(db, 'entries', id));
  // quitarla de las listas manuales que la contengan
  for (const l of getState().lists.filter((l) => l.ownerId === uid && (l.itemIds || []).includes(id))) {
    await updateDoc(doc(db, 'lists', l.id), { itemIds: l.itemIds.filter((x) => x !== id) }).catch(() => {});
  }
}
export async function getEntry(id) {
  const local = getState().entries.find((e) => e.id === id);
  if (local) return local;
  const s = await getDoc(doc(db, 'entries', id));
  return s.exists() ? withId(s) : null;
}
export function watchEntry(id, cb, onErr) {
  return onSnapshot(doc(db, 'entries', id), (s) => cb(s.exists() ? withId(s) : null), onErr);
}

export async function publicEntriesOf(uid) {
  const q = query(collection(db, 'entries'), where('ownerId', '==', uid), where('visibility', '==', 'public'));
  return (await getDocs(q)).docs.map(withId);
}

export async function feedFor(uids) {
  if (!uids.length) return [];
  const chunks = [];
  for (let i = 0; i < uids.length; i += 30) chunks.push(uids.slice(i, i + 30));
  const all = [];
  for (const c of chunks) {
    const q = query(collection(db, 'entries'), where('ownerId', 'in', c), where('visibility', '==', 'public'), limit(200));
    all.push(...(await getDocs(q)).docs.map(withId));
  }
  return all;
}

export async function exploreEntries(n = 48) {
  try {
    const q = query(collection(db, 'entries'), where('visibility', '==', 'public'), orderBy('updatedAt', 'desc'), limit(n));
    return (await getDocs(q)).docs.map(withId);
  } catch (e) {
    // Sin índice compuesto todavía: pedimos sin ordenar y ordenamos en cliente.
    console.warn('[Veoleo] explore sin índice', e?.message);
    const q = query(collection(db, 'entries'), where('visibility', '==', 'public'), limit(n * 3));
    return (await getDocs(q)).docs.map(withId);
  }
}

/* ───────────── Notas ───────────── */

export async function getNote(entryId) {
  try {
    const s = await getDoc(doc(db, 'notes', entryId));
    return s.exists() ? s.data() : null;
  } catch { return null; } // nota privada de otra persona
}
export async function saveNote(entryId, body, isPublic) {
  const uid = uidOrThrow();
  await setDoc(doc(db, 'notes', entryId), { ownerId: uid, body, isPublic: !!isPublic, updatedAt: serverTimestamp() });
  await updateDoc(doc(db, 'entries', entryId), { hasNote: !!body.trim(), notePublic: !!isPublic, updatedAt: serverTimestamp() });
}
export async function getNotesBulk(ids) {
  const out = {};
  await Promise.all(ids.map(async (id) => { const n = await getNote(id); if (n) out[id] = n; }));
  return out;
}

/* ───────────── Comentarios y likes ───────────── */

export function watchComments(entryId, cb, onErr) {
  const q = query(collection(db, 'entries', entryId, 'comments'), orderBy('createdAt', 'asc'), limit(300));
  return onSnapshot(q, (s) => cb(s.docs.map(withId)), onErr);
}
export async function addComment(entryId, text) {
  const uid = uidOrThrow();
  const p = getState().profile || {};
  await addDoc(collection(db, 'entries', entryId, 'comments'), {
    authorId: uid, authorName: p.displayName || '', authorHandle: p.handle || '', authorPhoto: p.photoURL || '',
    text: String(text).slice(0, 1999), createdAt: serverTimestamp(),
  });
}
export const deleteComment = (entryId, cid) => deleteDoc(doc(db, 'entries', entryId, 'comments', cid));

export async function getLikes(entryId) {
  try { return (await getDocs(collection(db, 'entries', entryId, 'likes'))).docs.map((d) => d.id); }
  catch { return []; }
}
export async function setLike(entryId, on) {
  const uid = uidOrThrow();
  const ref = doc(db, 'entries', entryId, 'likes', uid);
  if (on) await setDoc(ref, { at: serverTimestamp() }); else await deleteDoc(ref);
}

/* ───────────── Seguir ───────────── */

export async function follow(targetUid) {
  const uid = uidOrThrow();
  await setDoc(doc(db, 'follows', `${uid}_${targetUid}`), { followerId: uid, followingId: targetUid, createdAt: serverTimestamp() });
}
export async function unfollow(targetUid) {
  const uid = uidOrThrow();
  await deleteDoc(doc(db, 'follows', `${uid}_${targetUid}`));
}
export async function followCounts(uid) {
  const [a, b] = await Promise.all([
    getCountFromServer(query(collection(db, 'follows'), where('followingId', '==', uid))),
    getCountFromServer(query(collection(db, 'follows'), where('followerId', '==', uid))),
  ]);
  return { followers: a.data().count, following: b.data().count };
}
export async function followersOf(uid) {
  const s = await getDocs(query(collection(db, 'follows'), where('followingId', '==', uid), limit(200)));
  return s.docs.map((d) => d.data().followerId);
}

/* ───────────── Listas ───────────── */

export async function createList(data) {
  const uid = uidOrThrow();
  const ref = await addDoc(collection(db, 'lists'), clean({ itemIds: [], isPublic: defaultVisibility() === 'public', ...data, ownerId: uid, ...ownerFields(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  return ref.id;
}
export const updateList = (id, patch) => updateDoc(doc(db, 'lists', id), clean({ ...patch, updatedAt: serverTimestamp() }));
export const deleteList = (id) => deleteDoc(doc(db, 'lists', id));
export async function getList(id) {
  const local = getState().lists.find((l) => l.id === id);
  if (local) return local;
  const s = await getDoc(doc(db, 'lists', id));
  return s.exists() ? withId(s) : null;
}
export async function publicListsOf(uid) {
  const q = query(collection(db, 'lists'), where('ownerId', '==', uid), where('isPublic', '==', true));
  return (await getDocs(q)).docs.map(withId);
}

export async function importEntries(items, onProgress = () => {}) {
  const uid = uidOrThrow();
  const own = ownerFields();
  // Token fresco antes de una escritura larga (en móvil la sesión puede haber caducado en segundo plano).
  await auth.currentUser?.getIdToken(true).catch(() => {});
  const ids = [];
  const STEP = 150;
  for (let i = 0; i < items.length; i += STEP) {
    const chunk = items.slice(i, i + STEP);
    const write = async () => {
      const b = writeBatch(db); const chunkIds = [];
      for (const it of chunk) {
        const ref = doc(collection(db, 'entries'));
        chunkIds.push(ref.id);
        const visibility = defaultVisibility() === 'private' ? 'private' : (it.visibility === 'private' ? 'private' : 'public');
        b.set(ref, clean({ ...it, visibility, ownerId: uid, ...own, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
      }
      await b.commit();
      return chunkIds;
    };
    let got;
    try { got = await write(); }
    catch (e) {
      if (e?.code !== 'permission-denied') throw e;
      await auth.currentUser?.getIdToken(true);
      got = await write();
    }
    ids.push(...got);
    onProgress(ids.length, items.length);
  }
  return ids;
}

/* ───────────── Publicaciones (estado, progreso y conversación) ───────────── */

const POST_MAX = 500;
function postAuthor() {
  const p = getState().profile || {};
  return { authorName: p.displayName || '', authorHandle: p.handle || '', authorPhoto: p.photoURL || '' };
}
// Instantánea de la entrada que acompaña a la publicación (lo que estás viendo/leyendo y por dónde vas).
export function entrySnapshot(e, pct) {
  if (!e) return null;
  const watched = e.watchedEpisodes || [];
  const last = [...watched].sort().pop() || '';
  const total = Number(e.episodes) || 0;
  const done = e.type === 'series' ? watched.length : 0;
  const p = e.type === 'series' ? (total ? Math.round((done / total) * 100) : null)
    : pct != null ? Math.max(0, Math.min(100, Math.round(pct))) : (e.status === 'completed' ? 100 : (e.progressPct ?? null));
  return {
    id: e.id, title: e.title, type: e.type, year: e.year || null, cover: e.cover || '', backdrop: e.backdrop || '',
    status: e.status || '', rating: e.rating || 0, progress: { pct: p, done, total, last },
  };
}
export async function createPost({ text = '', entry = null, spoiler = false }) {
  const uid = uidOrThrow();
  const body = String(text).trim().slice(0, POST_MAX);
  if (!body && !entry) throw new Error('Escribe algo o elige un título');
  const ref = await addDoc(collection(db, 'posts'), clean({
    authorId: uid, ...postAuthor(), text: body, entry, spoiler: !!spoiler,
    likeCount: 0, replyCount: 0, createdAt: serverTimestamp(),
  }));
  return ref.id;
}
export const deletePost = (id) => deleteDoc(doc(db, 'posts', id));
export async function getPost(id) {
  const s = await getDoc(doc(db, 'posts', id));
  return s.exists() ? withId(s) : null;
}
export async function latestPosts(n = 60) {
  const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(n));
  return (await getDocs(q)).docs.map(withId);
}
const byNewest = (a, b) => (b.createdAt?.toMillis?.() || Date.now()) - (a.createdAt?.toMillis?.() || Date.now());
export async function postsOf(uid, n = 100) {
  const q = query(collection(db, 'posts'), where('authorId', '==', uid), limit(n));
  return (await getDocs(q)).docs.map(withId).sort(byNewest);
}
export async function postsFrom(uids) {
  const all = [];
  for (let i = 0; i < uids.length; i += 30) {
    const q = query(collection(db, 'posts'), where('authorId', 'in', uids.slice(i, i + 30)), limit(150));
    all.push(...(await getDocs(q)).docs.map(withId));
  }
  return all.sort(byNewest);
}
export async function myPostLikes(postIds) {
  const uid = uidOrThrow();
  const res = await Promise.all(postIds.map((id) => getDoc(doc(db, 'posts', id, 'likes', uid)).then((s) => s.exists()).catch(() => false)));
  return new Set(postIds.filter((_, i) => res[i]));
}
export async function likePost(id, on) {
  const uid = uidOrThrow();
  const likeRef = doc(db, 'posts', id, 'likes', uid);
  await runTransaction(db, async (tx) => {
    const ex = await tx.get(likeRef);
    if (on === ex.exists()) return;
    if (on) tx.set(likeRef, { at: serverTimestamp() }); else tx.delete(likeRef);
    tx.update(doc(db, 'posts', id), { likeCount: increment(on ? 1 : -1) });
  });
}
export function watchReplies(postId, cb, onErr) {
  const q = query(collection(db, 'posts', postId, 'replies'), orderBy('createdAt', 'asc'), limit(200));
  return onSnapshot(q, (s) => cb(s.docs.map(withId)), onErr);
}
export async function addReply(postId, text) {
  const uid = uidOrThrow();
  const b = writeBatch(db);
  b.set(doc(collection(db, 'posts', postId, 'replies')), { authorId: uid, ...postAuthor(), text: String(text).trim().slice(0, 999), createdAt: serverTimestamp() });
  b.update(doc(db, 'posts', postId), { replyCount: increment(1) });
  await b.commit();
}
export async function deleteReply(postId, rid) {
  const b = writeBatch(db);
  b.delete(doc(db, 'posts', postId, 'replies', rid));
  b.update(doc(db, 'posts', postId), { replyCount: increment(-1) });
  await b.commit();
}

// Cambia la visibilidad de todo tu diario de una vez (y oculta las notas si pasa a privado).
export async function setAllVisibility(visibility, entries) {
  const uid = uidOrThrow();
  const list = entries.filter((e) => e.visibility !== visibility);
  for (let i = 0; i < list.length; i += 200) {
    const b = writeBatch(db);
    for (const e of list.slice(i, i + 200)) {
      b.update(doc(db, 'entries', e.id), { visibility, ...(visibility === 'private' ? { notePublic: false } : {}), updatedAt: serverTimestamp() });
      if (visibility === 'private' && e.hasNote) b.set(doc(db, 'notes', e.id), { ownerId: uid, isPublic: false, updatedAt: serverTimestamp() }, { merge: true });
    }
    await b.commit();
  }
  return list.length;
}
