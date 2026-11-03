// View Transitions (F28): fundido entre pantallas del enrutador y entre estados de una lista, con la
// ilustración de la planta como elemento compartido entre la tarjeta del tablero y la cabecera del detalle.
// Regla: nunca más de 300 ms en total, nunca con prefers-reduced-motion y nunca bloquear la entrada
// (el CSS pone pointer-events:none a la capa de la transición). Sin soporte del navegador, o con
// movimiento reducido, la actualización corre directo y sin efecto.
import { movimientoReducido } from "./animaciones.js";

/** Lo máximo que se espera a que lleguen los datos de la pantalla nueva antes de animar con lo que haya. */
export const TOPE_ESPERA_MS = 200;

function disponible() {
  return typeof document !== "undefined" && typeof document.startViewTransition === "function" && !movimientoReducido();
}

/**
 * Corre `actualizar` (que cambia el DOM y puede ser async) dentro de una transición. Devuelve lo que devuelva
 * `actualizar`. Si `esperar` es una promesa, la transición se detiene a lo más TOPE_ESPERA_MS esperándola (para
 * que la pantalla nueva ya tenga contenido cuando termina el fundido, sin congelar la página si los datos tardan).
 */
export async function conTransicion(actualizar, { esperarHasta = false } = {}) {
  if (!disponible()) return actualizar();
  let trabajo;
  const transicion = document.startViewTransition(() => {
    trabajo = Promise.resolve().then(actualizar);
    const sinError = trabajo.catch(() => {}); // el error se relanza abajo; aquí no debe abortar la transición
    return esperarHasta ? Promise.race([sinError, new Promise((r) => setTimeout(r, TOPE_ESPERA_MS))]) : sinError;
  });
  // Una transición nueva salta la anterior y sus promesas se rechazan («Transition was skipped»): no es un error.
  transicion.ready.catch(() => {});
  transicion.finished.catch(() => {});
  await transicion.updateCallbackDone.catch(() => {});
  return trabajo; // la pantalla puede seguir cargando después del tope: se espera al trabajo, no a la animación
}

// ---- elemento compartido: la ilustración de la planta ----

export const NOMBRE_ILUSTRACION = "planta-ilustracion";
let plantaActiva = null;

/** La última planta que el usuario abrió desde el tablero (o con la que volvió): su tarjeta lleva el nombre compartido. */
export function recordarPlantaActiva(id) {
  plantaActiva = id === null || id === undefined ? null : String(id);
}
export const esPlantaActiva = (id) => plantaActiva !== null && String(id) === plantaActiva;

/** view-transition-name por CSSOM (la CSP prohíbe estilos en línea en el marcado, pero no esto). */
export function nombrarParaTransicion(nodo, nombre = NOMBRE_ILUSTRACION) {
  if (nodo) nodo.style.viewTransitionName = nombre;
}
export function quitarNombreDeTransicion(nodo) {
  if (nodo) nodo.style.viewTransitionName = "";
}
