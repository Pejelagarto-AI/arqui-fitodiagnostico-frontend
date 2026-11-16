// Pestañas del detalle de planta (F37): lógica pura, sin DOM, probada con `node --test`
// (tests/pestanas.test.mjs). La pestaña activa vive en la URL: #/plantas/:id (Hoy),
// #/plantas/:id/historial, #/plantas/:id/matera y #/plantas/:id/mas. Así atrás y recargar
// conservan dónde estaba el usuario, y un enlace puede apuntar a una pestaña concreta.
// F54: «Mascota» (#/plantas/:id/mascota) es pestaña en el teléfono; en escritorio no tiene botón y su sección va
// dentro de «Hoy» (hay ancho para las dos), así que ahí #/plantas/:id/mascota muestra «Hoy» con la mascota.

/**
 * En orden de aparición. `soloDueno`: el invitado no la ve (F11: sus controles ni se crean). `soloTelefono`: en
 * escritorio no es pestaña sino una sección de «Hoy» (F54).
 */
export const PESTANAS_PLANTA = [
  { clave: "hoy", sufijo: "", etiqueta: "Hoy", soloDueno: false },
  { clave: "mascota", sufijo: "/mascota", etiqueta: "Mascota", soloDueno: false, soloTelefono: true },
  { clave: "historial", sufijo: "/historial", etiqueta: "Historial", soloDueno: false },
  { clave: "matera", sufijo: "/matera", etiqueta: "Matera", soloDueno: true },
  { clave: "mas", sufijo: "/mas", etiqueta: "Más", soloDueno: false },
];

export const PESTANA_POR_DEFECTO = "hoy";

/** Las pestañas que le tocan a quien mira la planta. */
export function pestanasDePlanta({ esDueno }) {
  return PESTANAS_PLANTA.filter((p) => esDueno || !p.soloDueno);
}

/** "/plantas/abc/historial" para (abc, "historial"); una clave desconocida da la ruta de «Hoy». */
export function rutaDePestana(id, clave) {
  const pestana = PESTANAS_PLANTA.find((p) => p.clave === clave) || PESTANAS_PLANTA[0];
  return `/plantas/${encodeURIComponent(id)}${pestana.sufijo}`;
}

/** Patrones del enrutador, uno por pestaña: [{ patron: "/plantas/:id/historial", pestana: "historial" }, ...]. */
export function patronesDePestanas() {
  return PESTANAS_PLANTA.map((p) => ({ patron: `/plantas/:id${p.sufijo}`, pestana: p.clave }));
}

/**
 * La pestaña que se muestra de verdad: la pedida si esa persona la tiene; si no (un invitado que abre
 * .../matera, una clave rara), «Hoy».
 */
export function pestanaValida(clave, disponibles) {
  return disponibles.some((p) => p.clave === clave) ? clave : PESTANA_POR_DEFECTO;
}

/** Las claves que tienen botón a la vista (las flechas recorren solo esas). */
export function clavesConBoton(disponibles, { escritorio = false } = {}) {
  return disponibles.filter((p) => !(escritorio && p.soloTelefono)).map((p) => p.clave);
}

/** El panel que se ve para una pestaña: en escritorio «Mascota» se ve dentro de «Hoy». */
export function panelVisible(clave, { escritorio = false } = {}) {
  const pestana = PESTANAS_PLANTA.find((p) => p.clave === clave);
  return escritorio && pestana && pestana.soloTelefono ? PESTANA_POR_DEFECTO : clave;
}

/**
 * Navegación con teclado del patrón «tabs» de WAI-ARIA: flechas a los lados (con vuelta), Inicio y Fin.
 * Devuelve la clave a la que se mueve el foco, o null si la tecla no es de navegación.
 */
export function pestanaVecina(claves, actual, tecla) {
  const i = claves.indexOf(actual);
  if (i < 0 || claves.length === 0) return null;
  if (tecla === "ArrowRight") return claves[(i + 1) % claves.length];
  if (tecla === "ArrowLeft") return claves[(i - 1 + claves.length) % claves.length];
  if (tecla === "Home") return claves[0];
  if (tecla === "End") return claves[claves.length - 1];
  return null;
}

/**
 * Qué pide el sondeo según la pestaña a la vista. El diagnóstico vigente va siempre (pinta el estado
 * de la cabecera, que se ve en todas). El historial se pide en «Hoy» (de ahí salen las minigráficas) y en
 * «Historial»; los dispositivos, solo en «Matera». Lo que no se ve no se pide ni se repinta.
 */
export function consultasDeSondeo(clave, { escritorio = false } = {}) {
  const visible = panelVisible(clave, { escritorio });
  return {
    vigente: true,
    historial: visible === "hoy" || visible === "historial",
    dispositivos: visible === "matera",
    // F54: la consulta de la mascota, donde se ve (pestaña en el teléfono, sección de «Hoy» en escritorio)
    mascota: clave === "mascota" || (escritorio && visible === "hoy"),
  };
}

/** Título de la pestaña del navegador: «Lola · Historial». */
export function tituloDePestana(apodo, clave) {
  const pestana = PESTANAS_PLANTA.find((p) => p.clave === clave);
  return !pestana || pestana.clave === PESTANA_POR_DEFECTO ? apodo : `${apodo} · ${pestana.etiqueta}`;
}
