// Funciones puras del enrutador por hash (sin DOM): se prueban con
// `node --test` (tests/rutas.test.mjs).

/** "#/plantas/abc?x=1" -> { ruta: "/plantas/abc", query: URLSearchParams }. */
export function parsearHash(hash) {
  const sinAlmohadilla = hash.startsWith("#") ? hash.slice(1) : hash;
  const [rutaCruda, ...restoQuery] = sinAlmohadilla.split("?");
  let ruta = rutaCruda || "/";
  if (!ruta.startsWith("/")) ruta = `/${ruta}`;
  if (ruta.length > 1 && ruta.endsWith("/")) ruta = ruta.slice(0, -1);
  return { ruta, query: new URLSearchParams(restoQuery.join("?")) };
}

function compilar(patron) {
  const nombres = [];
  const fuente = patron
    .split("/")
    .map((segmento) => {
      if (segmento.startsWith(":")) {
        nombres.push(segmento.slice(1));
        return "([^/]+)";
      }
      return segmento.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { regex: new RegExp(`^${fuente}$`), nombres };
}

/** Busca la entrada de la tabla que coincide; las literales ganan a las con parámetros. */
export function resolver(tabla, ruta) {
  const candidatas = [...tabla].sort(
    (a, b) => Number(a.patron.includes(":")) - Number(b.patron.includes(":")),
  );
  for (const entrada of candidatas) {
    const { regex, nombres } = compilar(entrada.patron);
    const coincidencia = regex.exec(ruta);
    if (coincidencia) {
      const params = {};
      nombres.forEach((nombre, i) => {
        params[nombre] = decodeURIComponent(coincidencia[i + 1]);
      });
      return { entrada, params };
    }
  }
  return null;
}

/**
 * Enlace corto del QR de la matera (F35): "#/v/7k2m9q" -> "/vincular?serial=fito-7K2M9Q".
 * El prefijo "fito-" va implícito para que el QR quepa en una pantalla de 128x64. Devuelve null si el
 * código no es de 4 a 12 letras o dígitos.
 */
export function destinoDeEnlaceCorto(codigo) {
  const limpio = String(codigo ?? "").trim();
  if (!/^[A-Za-z0-9]{4,12}$/.test(limpio)) return null;
  return `/vincular?serial=fito-${limpio.toUpperCase()}`;
}

/**
 * ¿La ruta nueva es otra cara de la pantalla que ya está montada? Pasa con las pestañas del detalle de planta
 * (F37): las cuatro rutas comparten `familia` y el mismo `:id`. En ese caso el enrutador no desmonta nada: le
 * avisa a la pantalla y ella cambia de pestaña (el sondeo y lo ya cargado siguen vivos).
 */
export function mismaPantalla(montada, nueva) {
  if (!montada || !nueva) return false;
  const familia = montada.entrada.familia;
  return Boolean(familia) && familia === nueva.entrada.familia && montada.params.id === nueva.params.id;
}

/**
 * Qué hacer con una ruta según quién la pide (F38). Devuelve:
 *  - { accion: "mostrar" }
 *  - { accion: "ir", ruta } con a dónde mandar al usuario
 *  - { accion: "sin-permiso" }
 * Reglas: lo de «anonima» (portada, entrar, registro) es para quien no tiene sesión, y quien sí la tiene va a
 * su tablero; lo de «sesion» y «admin» manda a entrar (recordando a dónde quería ir); «admin» sin el rol no pasa.
 */
export function decidirAcceso(acceso, { haySesion, esAdmin, rutaPedida = "/" }) {
  if (acceso === "anonima" && haySesion) return { accion: "ir", ruta: RUTA_DE_INICIO_CON_SESION };
  if ((acceso === "sesion" || acceso === "admin") && !haySesion) return { accion: "ir", ruta: `/entrar?volver=${encodeURIComponent(rutaPedida)}` };
  if (acceso === "admin" && !esAdmin) return { accion: "sin-permiso" };
  return { accion: "mostrar" };
}

/** La casa de quien ya entró: su tablero. La de quien no, la portada («/»). */
export const RUTA_DE_INICIO_CON_SESION = "/plantas";
