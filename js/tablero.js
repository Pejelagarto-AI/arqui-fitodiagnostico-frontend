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

// ---- F56: el tablero en una llamada (fase 13 del backend) ----
// `GET /plantas` trae por planta `mascota { vitalidad, animo, racha, accesorio }` y `salud { estado, mensaje }`, cada una
// `null` cuando no hay. Un backend viejo no manda las claves: ahí el tablero conserva el camino de antes (F54, F55), una
// consulta a `GET .../mascota` y otra a `GET .../dispositivos` por tarjeta visible. Distinguir «null» (el servidor dice
// que no hay) de «clave ausente» (el servidor no sabe) es lo que evita pedir de más con el backend nuevo.

/** ¿Esta planta del listado trae el resumen del servidor (aunque sea `null`)? Una clave ausente es un backend viejo. */
export function traeResumen(planta) {
  return Boolean(planta) && (Object.hasOwn(planta, "mascota") || Object.hasOwn(planta, "salud"));
}

/** Las plantas que siguen necesitando el camino de respaldo (dos peticiones por tarjeta): las que vienen sin las claves. */
export function plantasSinResumen(lista) {
  return lista.filter((p) => !traeResumen(p));
}

/** La lista sin `mascota` ni `salud`: lo que identifica a las tarjetas (plantas, apodos, especies), para repintar solo si eso cambió. */
export function sinResumen(lista) {
  return lista.map(({ mascota, salud, ...resto }) => resto);
}

/** El chip de salud del listado: { mala, texto, estado }. FALLA es «revisa la matera»; SIN_NOTICIAS, «sin noticias»; OK o null, nada. */
export function chipDeSaludDelListado(salud) {
  if (!salud || (salud.estado !== "FALLA" && salud.estado !== "SIN_NOTICIAS")) return { mala: false, texto: "", estado: "OK" };
  return { mala: true, texto: salud.estado === "SIN_NOTICIAS" ? "sin noticias" : "revisa la matera", estado: salud.estado };
}
