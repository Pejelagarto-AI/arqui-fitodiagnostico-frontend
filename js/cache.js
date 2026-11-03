// Caché en memoria para «stale-while-revalidate» (F23): al volver a una pantalla ya vista se pinta lo
// último que se supo al instante y se pide lo fresco por detrás. Puro (sin DOM ni red), se prueba con Node.
//
// Qué SÍ se guarda: lo que cambia poco y donde un dato viejo por unos cientos de ms no cuesta nada (la
// ficha de una planta: apodo, especie, rol; las listas de «Mis plantas» y «Compartidas»).
// Qué NUNCA se guarda: el diagnóstico vigente y el historial. Eso lo trae siempre fresco el sondeo (F16): una
// lectura vieja mostrada como actual es justo lo que este sistema existe para evitar.
//
// Se vive en memoria (no en sessionStorage): un F5 la vacía y nada sale de la pestaña. Se vacía al cambiar
// la sesión y tras cualquier cambio propio (crear, editar, eliminar, aceptar una invitación), para no
// mostrarle a alguien el efecto contrario a lo que acaba de hacer.
const entradas = new Map();

export const leerCache = (clave) => entradas.get(clave);
export const guardarCache = (clave, valor) => {
  entradas.set(clave, valor);
  return valor;
};
export const invalidarCache = () => entradas.clear();

/** Mismo contenido (listas de objetos simples): evita repintar cuando lo fresco no cambió nada. */
export function sonIguales(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Cuánto va a esperar `alVolver` entre dos revalidaciones por foco o red, para no pedir en ráfaga. */
export const ESPERA_MINIMA_REVALIDAR_MS = 3000;

/**
 * Revalida cuando la ventana recupera el foco o vuelve la red. `revalidar()` la pone la pantalla; no se llama
 * más de una vez cada ESPERA_MINIMA_REVALIDAR_MS. Devuelve la función que quita los oyentes.
 */
export function alVolver(revalidar, { objetivo = globalThis, ahora = Date.now, espera = ESPERA_MINIMA_REVALIDAR_MS } = {}) {
  let ultima = ahora();
  const disparar = () => {
    if (ahora() - ultima < espera) return;
    ultima = ahora();
    revalidar();
  };
  objetivo.addEventListener("focus", disparar);
  objetivo.addEventListener("online", disparar);
  return () => {
    objetivo.removeEventListener("focus", disparar);
    objetivo.removeEventListener("online", disparar);
  };
}
