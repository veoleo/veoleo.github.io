// Configuración pública de la app web. La config de Firebase no es secreta:
// la seguridad la imponen las reglas de Firestore (firestore.rules).
export const firebaseConfig = {
  apiKey: 'AIzaSyC9Ki3txnwOY_gRy4WrRCeKzjewyLdMoLM',
  authDomain: 'tvdaily-7d988.firebaseapp.com',
  projectId: 'tvdaily-7d988',
  storageBucket: 'tvdaily-7d988.firebasestorage.app',
  messagingSenderId: '659329453979',
  appId: '1:659329453979:web:05670b2fcb1997872a1b3e',
};

// Clave de lectura de TMDB compartida por toda la app (opcional).
// Con ella las búsquedas de series y películas traen pósters HD, fondos,
// tráilers y reparto. Cada usuario puede poner la suya en Ajustes.
export const SHARED_TMDB_KEY = '';

// Página de apoyo (Buy Me a Coffee).
export const SUPPORT_URL = 'https://buymeacoffee.com/mariawildet';

// Contacto (sugerencias, errores, colaboraciones).
export const CONTACT_EMAIL = 'mariawilderwest@gmail.com';
