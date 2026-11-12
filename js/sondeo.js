// Sondeo periódico (polling, R6): repite `tarea` cada INTERVALO_SONDEO_MS para
// que la pantalla de una planta se actualice sola. No toca la red ni el DOM:
// la tarea (que llama a api.js) y el pintado los pone quien lo usa; por eso se
// puede probar con Node.
//
// Reglas:
//  - nunca hay dos tareas a la vez: la siguiente se programa al terminar la anterior;
//  - con la pestaña oculta se pausa y al volver consulta de inmediato;
//  - si la tarea falla reintenta con espera creciente (el doble, hasta 30 s) y
//    notifica siempre el mismo estado «error» (la pantalla lo reemplaza, no lo apila);
//  - 401, 403 y 404 no se reintentan: no mejoran solos (sesión vencida, acceso
//    quitado o planta eliminada).
export const INTERVALO_SONDEO_MS = 5000;
const ESPERA_MAXIMA_MS = 30000;
const SIN_REINTENTO = new Set([401, 403, 404]);

/**
 * Estados que se notifican a `alCambiar({ estado, error, ultimoExito })`:
 *  - activo: la última consulta salió bien;
 *  - error: falló y se reintentará;
 *  - detenido: falló sin remedio (ver SIN_REINTENTO);
 *  - pausado: pestaña oculta o sondeo detenido a mano.
 */
export function crearSondeo({ tarea, alCambiar = () => {}, intervaloMs = INTERVALO_SONDEO_MS, documento = globalThis.document, ahora = Date.now }) {
  let temporizador = null;
  let corriendo = false;
  let enCurso = false;
  let fallos = 0;
  let ultimoExito = null;
  let generacion = 0; // invalida una tarea que vuelve después de detener()

  const oculta = () => Boolean(documento) && documento.visibilityState === "hidden";
  const notificar = (estado, error = null) => alCambiar({ estado, error, ultimoExito });

  function programar(espera) {
    clearTimeout(temporizador);
    temporizador = setTimeout(ciclo, espera);
  }

  async function ciclo() {
    if (!corriendo || enCurso || oculta()) return;
    enCurso = true;
    const mia = generacion;
    try {
      await tarea();
      if (mia !== generacion) return;
      fallos = 0;
      ultimoExito = ahora();
      notificar("activo");
      programar(intervaloMs);
    } catch (error) {
      if (mia !== generacion) return;
      fallos += 1;
      if (SIN_REINTENTO.has(error && error.status)) {
        corriendo = false;
        notificar("detenido", error);
        return;
      }
      // Cada fallo notifica el mismo estado: quien pinta lo reemplaza, no lo acumula.
      notificar("error", error);
      programar(Math.min(intervaloMs * 2 ** fallos, ESPERA_MAXIMA_MS));
    } finally {
      if (mia === generacion) enCurso = false;
    }
  }

  function alCambiarVisibilidad() {
    if (!corriendo) return;
    if (oculta()) {
      generacion += 1;
      enCurso = false;
      clearTimeout(temporizador);
      notificar("pausado");
    } else {
      programar(0);
    }
  }

  return {
    /** Arranca. Si `inmediato` es false, la primera consulta espera un intervalo (los datos ya se cargaron). */
    iniciar({ inmediato = true, cargadoEn = null } = {}) {
      if (corriendo) return;
      corriendo = true;
      if (cargadoEn !== null) ultimoExito = cargadoEn;
      if (documento) documento.addEventListener("visibilitychange", alCambiarVisibilidad);
      if (oculta()) notificar("pausado");
      else programar(inmediato ? 0 : intervaloMs);
    },
    /** Para y descarta lo que esté en vuelo. Al salir de la pantalla. */
    detener() {
      corriendo = false;
      generacion += 1;
      enCurso = false;
      clearTimeout(temporizador);
      if (documento) documento.removeEventListener("visibilitychange", alCambiarVisibilidad);
    },
    /** Consulta ya (p. ej. tras registrar una medición) y sigue con el ritmo normal. */
    ahoraMismo() {
      if (corriendo && !oculta()) programar(0);
    },
    ultimoExito: () => ultimoExito,
  };
}

/** Texto del indicador: «actualizado hace 3 s», «hace 2 min». */
export function textoActualizado(ultimoExito, ahora = Date.now()) {
  if (ultimoExito === null || ultimoExito === undefined) return "actualizando…";
  const segundos = Math.max(0, Math.floor((ahora - ultimoExito) / 1000));
  if (segundos < 2) return "actualizado ahora";
  if (segundos < 60) return `actualizado hace ${segundos} s`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `actualizado hace ${minutos} min`;
  return `actualizado hace ${Math.floor(minutos / 60)} h`;
}
