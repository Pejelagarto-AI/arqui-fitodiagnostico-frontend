// Estado de la sesión del front: el JWT, cuándo caduca y el usuario que lo
// recibió. Es el único sitio que toca el almacenamiento del navegador.
//
// Decisión F1: sessionStorage. Sobrevive a recargar la página (F5) pero muere
// al cerrar la pestaña, y no se comparte entre pestañas. Riesgo asumido: un XSS
// podría leerlo (cualquier JS de la página puede); por eso el front no usa
// innerHTML con datos y la página trae una Content-Security-Policy sin scripts
// en línea. Ver docs/IMPLEMENTACION-CORTE2.md.
const CLAVE = "fitodiagnostico.sesion";

let actual = null;
const oyentes = new Set();

function leerAlmacenada() {
  try {
    const crudo = window.sessionStorage.getItem(CLAVE);
    if (!crudo) return null;
    const guardada = JSON.parse(crudo);
    if (!guardada.token || !guardada.expiraEn || Date.parse(guardada.expiraEn) <= Date.now()) {
      window.sessionStorage.removeItem(CLAVE);
      return null;
    }
    return guardada;
  } catch {
    return null;
  }
}

function persistir() {
  try {
    if (actual) window.sessionStorage.setItem(CLAVE, JSON.stringify(actual));
    else window.sessionStorage.removeItem(CLAVE);
  } catch {
    // Almacenamiento bloqueado: la sesión queda solo en memoria (se pierde al recargar).
  }
}

function avisar() {
  for (const oyente of oyentes) oyente();
}

actual = leerAlmacenada();

/** Guarda la respuesta de POST /auth/sesion. */
export function iniciar({ token, expiraEn, usuario }) {
  actual = { token, expiraEn, usuario };
  persistir();
  avisar();
}

/** Cerrar sesión (RF-A3, D22): el servidor no guarda estado, basta con descartar el token. */
export function cerrar() {
  actual = null;
  persistir();
  avisar();
}

export function actualizarUsuario(usuario) {
  if (!actual) return;
  actual = { ...actual, usuario };
  persistir();
  avisar();
}

export function token() {
  if (actual && Date.parse(actual.expiraEn) <= Date.now()) cerrar();
  return actual ? actual.token : null;
}

export function usuario() {
  return actual ? actual.usuario : null;
}

export function haySesion() {
  return token() !== null;
}

export function esAdmin() {
  return Boolean(actual && actual.usuario && actual.usuario.roles.includes("ADMINISTRADOR"));
}

/** Llama a `oyente` cada vez que la sesión cambia. Devuelve la función para dejar de oír. */
export function alCambiar(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}
