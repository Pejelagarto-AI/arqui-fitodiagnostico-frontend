// Petición retrasada detrás de un «Deshacer» (F25). Puro: sin DOM ni red, se prueba con Node.
// La acción reversible (desvincular, revocar una invitación) se refleja ya en pantalla y la petición
// de verdad sale pasado el plazo; si el usuario deshace antes, la petición simplemente no sale.
export const TIEMPO_DESHACER_MS = 7000; // entre 5 y 10 s: da tiempo de ver el toast y leerlo

/**
 * Programa `ejecutar` para dentro de `ms`. Devuelve { deshacer, pendiente }:
 *  - deshacer(): cancela si todavía no salió y devuelve true; devuelve false si ya salió;
 *  - pendiente(): true mientras espera.
 * `alTerminar(error|null)` se llama cuando `ejecutar` acaba (bien o con error).
 */
export function retrasar(ejecutar, { ms = TIEMPO_DESHACER_MS, alTerminar = () => {}, temporizador = globalThis } = {}) {
  let estado = "esperando"; // esperando | ejecutada | deshecha
  const id = temporizador.setTimeout(async () => {
    if (estado !== "esperando") return;
    estado = "ejecutada";
    try {
      await ejecutar();
      alTerminar(null);
    } catch (error) {
      alTerminar(error);
    }
  }, ms);
  return {
    deshacer() {
      if (estado !== "esperando") return false;
      estado = "deshecha";
      temporizador.clearTimeout(id);
      return true;
    },
    pendiente: () => estado === "esperando",
  };
}
