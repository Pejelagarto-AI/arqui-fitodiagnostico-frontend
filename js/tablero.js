// Lógica pura del tablero «Mis plantas» (F37): sin DOM, probada con Node (tests/tablero.test.mjs).
// El resumen por estado hace de filtro (tocar «En riesgo» deja solo esas plantas) y «Qué hacer hoy» se pliega
// a las primeras: así el tablero no vuelve a ser un scroll largo cuando hay muchas plantas.

/** Claves del resumen: el total y cada estado. «SIN» junta lo que no tiene lectura o no se pudo leer. */
export const FILTROS = ["total", "SALUDABLE", "EN_RIESGO", "CRITICO", "SIN"];

/** A qué filtro pertenece una planta según su lectura ({ tipo: "datos", registro } | { tipo: "vacio" | "fallo" } | undefined). */
export function claveDeLectura(lectura) {
  if (!lectura) return null; // todavía no llegó: no cuenta en ningún estado
  return lectura.tipo === "datos" ? lectura.registro.diagnostico.estado : "SIN";
}

/** Cuántas plantas hay en cada filtro. `lecturas` es un Map de id de planta a lectura. */
export function cuentaPorEstado(plantas, lecturas) {
  const cuenta = { total: plantas.length, SALUDABLE: 0, EN_RIESGO: 0, CRITICO: 0, SIN: 0 };
  for (const planta of plantas) {
    const clave = claveDeLectura(lecturas.get(planta.id));
    if (clave && clave in cuenta) cuenta[clave] += 1;
  }
  return cuenta;
}

/** ¿La planta con esa lectura se ve con el filtro puesto? «total» deja ver todas. */
export function pasaElFiltro(lectura, filtro) {
  return filtro === "total" || claveDeLectura(lectura) === filtro;
}

/** Un filtro que se quedó sin plantas (la que estaba en riesgo ya se recuperó) vuelve a «total». */
export function filtroVigente(filtro, cuenta) {
  return FILTROS.includes(filtro) && cuenta[filtro] > 0 ? filtro : "total";
}

/** Cuántos pendientes de «Qué hacer hoy» se ven sin desplegar. */
export const PENDIENTES_A_LA_VISTA = 3;

/** Parte una lista en lo que se ve y lo que queda plegado. Si solo sobraría uno, se muestra entero: no vale un botón. */
export function plegar(lista, maximo = PENDIENTES_A_LA_VISTA) {
  if (lista.length <= maximo + 1) return { visibles: lista, plegados: [] };
  return { visibles: lista.slice(0, maximo), plegados: lista.slice(maximo) };
}
