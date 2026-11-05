// Lógica pura del asistente de vinculación (F36): sin DOM ni red, se prueba con `node --test`
// (tests/vinculacion.test.mjs). Aquí viven tres cosas:
//  - el CÓDIGO de la matera: lo que el usuario ve y teclea son 6 letras y números («YUBUD6»); el serial
//    completo («fito-YUBUD6») es un detalle interno que se arma al llamar a la API;
//  - el enmascarado de las materas encontradas («fito-YU····» -> «YU····»);
//  - la máquina de pasos del asistente.

export const PREFIJO = "fito-";
export const LARGO_CODIGO = 6;
const PUNTOS = "····";

/** Quita lo que no es letra o número y pasa a mayúsculas: «YUB-UD6» -> «YUBUD6». */
function soloAlfanumerico(texto) {
  return String(texto ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Lo que queda en las casillas mientras se escribe o se pega: mayúsculas, sin espacios ni guiones, sin el
 * prefijo «fito» cuando se pegó el serial entero (10 caracteres limpios que empiezan en FITO) y a lo sumo 6.
 * Un código que empieza en FITO («FITO12») se respeta mientras no llegue a 10.
 */
export function limpiarEntradaDeCodigo(texto) {
  // «fito-» o «fito » escrito a mano: el prefijo se descarta apenas se completa, antes de contar los 6.
  let limpio = soloAlfanumerico(String(texto ?? "").replace(/^\s*fito[\s\-_]+/i, ""));
  if (limpio.length >= PREFIJO.length - 1 + LARGO_CODIGO && limpio.startsWith("FITO")) limpio = limpio.slice(4);
  return limpio.slice(0, LARGO_CODIGO);
}

/**
 * Del texto que escribió el usuario al serial que se manda a la API.
 *  - 6 letras y números (con o sin espacios o guiones), con o sin «fito-»: `fito-YUBUD6`;
 *  - un serial que no es de fábrica (otro nombre que registró un administrador a mano, de 8 a 64 caracteres
 *    válidos y que no empieza en «fito»): se acepta completo, tal cual;
 *  - cualquier otra cosa: error «El código tiene 6 letras y números».
 * Devuelve { ok: true, codigo, serial } o { ok: false, error }.
 */
export const ERROR_CODIGO = "El código tiene 6 letras y números";

export function normalizarCodigo(texto) {
  const crudo = String(texto ?? "").trim();
  const limpio = soloAlfanumerico(crudo);
  if (limpio.length === LARGO_CODIGO) return { ok: true, codigo: limpio, serial: `${PREFIJO}${limpio}` };
  if (limpio.length === 4 + LARGO_CODIGO && limpio.startsWith("FITO")) {
    const codigo = limpio.slice(4);
    return { ok: true, codigo, serial: `${PREFIJO}${codigo}` };
  }
  if (/^[A-Za-z0-9._-]{8,64}$/.test(crudo) && !/^fito/i.test(crudo)) return { ok: true, codigo: crudo, serial: crudo };
  return { ok: false, error: ERROR_CODIGO };
}

/** Lo que se le muestra al dueño de un serial: «fito-YUBUD6» -> «YUBUD6»; los demás, completos. */
export function codigoVisible(serial) {
  const texto = String(serial ?? "");
  return texto.startsWith(PREFIJO) ? texto.slice(PREFIJO.length) : texto;
}

/** El enmascarado que devuelve el backend, sin prefijo: «fito-YU····» -> «YU····». */
export function enmascaradoVisible(enmascarado) {
  return codigoVisible(enmascarado);
}

/**
 * ¿El código tecleado puede ser de alguna de las materas encontradas? Se comparan las letras que el
 * enmascarado deja ver (las dos primeras del código). Sin materas encontradas (entrada a mano) no hay con
 * qué comparar y se acepta. El servidor es quien decide de verdad; esto solo evita un viaje con un código que
 * claramente es de otra matera.
 */
export function coincideConEncontradas(codigo, encontradas) {
  if (!encontradas || encontradas.length === 0) return true;
  const limpio = soloAlfanumerico(codigo);
  return encontradas.some((e) => {
    const visible = soloAlfanumerico(enmascaradoVisible(e.serialEnmascarado ?? e));
    return visible.length === 0 || limpio.startsWith(visible);
  });
}

export { PUNTOS };

// ---- planta recordada para el QR ----

export const VIGENCIA_PLANTA_RECORDADA_MS = 30 * 60 * 1000;

/** El registro que se guarda en sessionStorage cuando el asistente se abre. */
export function recordarPlanta(plantaId, ahora = Date.now()) {
  return JSON.stringify({ plantaId, en: ahora });
}

/** La planta recordada si el registro es válido y tiene menos de 30 min; si no, null. */
export function plantaRecordada(registro, ahora = Date.now()) {
  if (!registro) return null;
  try {
    const { plantaId, en } = JSON.parse(registro);
    if (typeof plantaId !== "string" || !plantaId || typeof en !== "number") return null;
    if (ahora - en > VIGENCIA_PLANTA_RECORDADA_MS || ahora < en) return null;
    return plantaId;
  } catch {
    return null;
  }
}

// ---- máquina de pasos ----

export const PASOS = ["enciende", "buscando", "confirma", "conectando", "exito"];
export const TITULOS = {
  enciende: "Enciéndela",
  buscando: "Buscando tu matera",
  confirma: "Confirma que es la tuya",
  conectando: "Conectando",
  exito: "Conexión exitosa",
};
export const ESPERA_MAXIMA_CONEXION_MS = 30000;
export const INTERVALO_BUSQUEDA_MS = 2000;
export const TIEMPO_SIN_HALLAZGO_MS = 25000;

/**
 * Cuánto se busca antes de mostrar la ayuda «No encontramos tu matera». El parámetro interno `?espera=` del
 * enlace del asistente solo puede BAJARLO (lo usa la prueba de humo para no esperar 25 s); un valor ausente,
 * inválido o mayor deja los 25 s.
 */
export function esperaSinHallazgoMs(valor) {
  const n = Number(valor);
  return Number.isFinite(n) && n >= 200 && n < TIEMPO_SIN_HALLAZGO_MS ? Math.round(n) : TIEMPO_SIN_HALLAZGO_MS;
}

/** La lista de ayuda del estado «No encontramos tu matera»: icono y frase de persona. */
export const AYUDAS = [
  { icono: "corriente", titulo: "¿Está conectada a la corriente?", detalle: "Debe verse la pantalla encendida." },
  { icono: "pantalla", titulo: "¿Su pantalla muestra un código?", detalle: "Si dice «Conecta tu celular a Fito-…», todavía no tiene Wi-Fi: únete a esa red y dale la tuya." },
  { icono: "wifi", titulo: "¿Tu celular y la matera están en la misma red Wi-Fi?", detalle: "La matera solo usa redes de 2.4 GHz." },
  { icono: "reinicio", titulo: "Apágala y préndela", detalle: "Y espera unos 10 segundos." },
  { icono: "candado", titulo: "¿Ya está vinculada a otra planta?", detalle: "Una matera solo aparece si no tiene dueño." },
];

export function estadoInicial({ directo = false } = {}) {
  return { paso: directo ? "conectando" : "enciende", encontradas: [], error: null };
}

/**
 * Transiciones del asistente. Eventos: BUSCAR, ENCONTRADAS (con la lista), ESCRIBIR_A_MANO, VINCULAR,
 * FALLO (con el error), CONECTADA, REINTENTAR, ATRAS. Un evento que no aplica al paso actual no cambia nada.
 */
export function transicion(estado, evento) {
  const { paso } = estado;
  switch (evento.tipo) {
    case "BUSCAR":
      return paso === "enciende" ? { ...estado, paso: "buscando", error: null } : estado;
    case "ENCONTRADAS": {
      const encontradas = evento.encontradas ?? [];
      if (paso === "buscando" && encontradas.length > 0) return { ...estado, paso: "confirma", encontradas, error: null };
      // Ya en «confirma», la lista se actualiza sin mover al usuario (su código a medias no se pierde).
      if (paso === "confirma") return { ...estado, encontradas };
      return estado;
    }
    case "ESCRIBIR_A_MANO":
      return paso === "enciende" || paso === "buscando" ? { ...estado, paso: "confirma", error: null } : estado;
    case "VINCULAR":
      return paso === "confirma" || paso === "enciende" || paso === "buscando" ? { ...estado, paso: "conectando", error: null } : estado;
    case "FALLO":
      return paso === "conectando" ? { ...estado, paso: "confirma", error: evento.error ?? null } : estado;
    case "CONECTADA":
      return paso === "conectando" ? { ...estado, paso: "exito", error: null } : estado;
    case "REINTENTAR":
      return paso === "confirma" || paso === "conectando" ? { ...estado, paso: "conectando", error: null } : estado;
    case "ATRAS":
      if (paso === "buscando") return { ...estado, paso: "enciende", error: null };
      if (paso === "confirma") return { ...estado, paso: "buscando", error: null };
      return estado;
    default:
      return estado;
  }
}

/** «Paso 2 de 5: Buscando tu matera», para el anuncio a lectores de pantalla. */
export function anuncioDePaso(paso) {
  const n = PASOS.indexOf(paso) + 1;
  return `Paso ${n} de ${PASOS.length}: ${TITULOS[paso]}`;
}
