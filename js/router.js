// Enrutador por hash: #/plantas, #/plantas/<id>, #/admin/usuarios ...
// Con el hash no hace falta ninguna configuración del servidor estático (un
// refresh en #/plantas/x sigue pidiendo solo index.html). Cada pantalla es un
// módulo que se importa al visitarla: export function montar(contenedor, ctx).
import { parsearHash, resolver } from "./rutas.js";
import { h, vaciar, crearAviso, esqueletoSiTarda } from "./ui.js";
import * as sesion from "./sesion.js";

let tabla = [];
let contenedor = null;
let limpiezaActual = null;
let numeroDeNavegacion = 0;
let marcadorActual = null;

export function irA(ruta, { reemplazar = false } = {}) {
  const destino = `#${ruta}`;
  if (reemplazar) {
    history.replaceState(null, "", destino);
    navegar();
  } else if (window.location.hash === destino) {
    navegar();
  } else {
    window.location.hash = destino;
  }
}

/** Ruta actual (sin #) incluyendo el query: sirve de `volver` tras iniciar sesión. */
export function rutaActual() {
  const { ruta, query } = parsearHash(window.location.hash);
  const texto = query.toString();
  return texto ? `${ruta}?${texto}` : ruta;
}

function pantallaMensaje(titulo, mensaje) {
  const aviso = crearAviso();
  aviso.mostrar(mensaje);
  return h("section", { class: "tarjeta" }, h("h2", { tabindex: "-1", "data-titulo": "" }, titulo), aviso.elemento, h("p", {}, h("a", { href: "#/" }, "Volver al inicio")));
}

/**
 * Marcador de «cargando» de una pantalla: una tarjeta con la forma de las reales, como esqueleto que
 * solo se ve si la carga pasa de 300 ms (antes, invisible: nada parpadea). Lo retira el primer
 * contenido que la pantalla agregue (las pantallas piden sus datos antes de pintar y no saben de
 * este marcador) o, como respaldo, el final de `montar`.
 */
function crearMarcadorDeCarga() {
  const tarjeta = h("div", { class: "tarjeta", "aria-hidden": "true" }, h("h2", {}, "Cargando"), h("p", {}, "Cargando el contenido de la pantalla"), h("p", {}, "Un momento"));
  const nodo = h("div", { class: "vista-cargando", role: "status" }, h("span", { class: "solo-lector" }, "Cargando…"), tarjeta);
  const cancelarEsqueleto = esqueletoSiTarda(tarjeta);
  const observador = new MutationObserver(() => {
    if (contenedor.children.length > 1 || !contenedor.contains(nodo)) marcador.quitar();
  });
  const marcador = {
    nodo,
    quitar() {
      cancelarEsqueleto();
      observador.disconnect();
      nodo.remove();
    },
  };
  observador.observe(contenedor, { childList: true });
  return marcador;
}

async function navegar() {
  const esta = ++numeroDeNavegacion;
  if (marcadorActual) marcadorActual.quitar();
  marcadorActual = null;
  if (limpiezaActual) {
    try {
      limpiezaActual();
    } catch {
      // una limpieza que falla no debe impedir navegar
    }
    limpiezaActual = null;
  }
  vaciar(contenedor);

  const { ruta, query } = parsearHash(window.location.hash);
  const resuelta = resolver(tabla, ruta);

  if (!resuelta) {
    delete document.body.dataset.acceso;
    delete document.body.dataset.patron;
    contenedor.append(pantallaMensaje("Página no encontrada", `No existe la pantalla «${ruta}».`));
    anunciar("Página no encontrada");
    return;
  }

  const { entrada, params } = resuelta;
  // Para el CSS: el pie solo en pantallas públicas, el indicador global fuera del detalle de planta.
  document.body.dataset.acceso = entrada.acceso;
  document.body.dataset.patron = entrada.patron;

  if (entrada.acceso === "anonima" && sesion.haySesion()) {
    irA("/plantas", { reemplazar: true });
    return;
  }
  if ((entrada.acceso === "sesion" || entrada.acceso === "admin") && !sesion.haySesion()) {
    irA(`/entrar?volver=${encodeURIComponent(rutaActual())}`, { reemplazar: true });
    return;
  }
  if (entrada.acceso === "admin" && !sesion.esAdmin()) {
    contenedor.append(pantallaMensaje("Sin permiso", "Esta sección es solo para administradores."));
    anunciar("Sin permiso");
    return;
  }

  const marcador = crearMarcadorDeCarga();
  marcadorActual = marcador;
  contenedor.append(marcador.nodo);

  let modulo;
  try {
    modulo = await entrada.vista();
  } catch {
    if (esta !== numeroDeNavegacion) return;
    marcador.quitar();
    vaciar(contenedor);
    contenedor.append(pantallaMensaje("No se pudo cargar la pantalla", "Falló la descarga del módulo de esta pantalla. Revisa la conexión y recarga."));
    return;
  }
  if (esta !== numeroDeNavegacion) return;

  const contexto = {
    params,
    query,
    irA,
    // Las pantallas lo consultan tras cada await: si el usuario ya navegó a otra, no pintan.
    vigente: () => esta === numeroDeNavegacion,
  };

  try {
    const limpieza = await modulo.montar(contenedor, contexto);
    marcador.quitar();
    if (esta !== numeroDeNavegacion) {
      if (typeof limpieza === "function") limpieza();
    } else if (typeof limpieza === "function") {
      limpiezaActual = limpieza;
    }
  } catch (error) {
    if (esta !== numeroDeNavegacion) return;
    marcador.quitar();
    vaciar(contenedor);
    contenedor.append(pantallaMensaje("Algo salió mal", error.mensaje || error.message || "Error inesperado."));
  }
  anunciar(modulo.titulo || "Fitodiagnóstico");
}

// Tras navegar: título de la pestaña y foco al encabezado, para lectores de pantalla y teclado.
function anunciar(titulo) {
  document.title = `${titulo} — Fitodiagnóstico`;
  const encabezado = contenedor.querySelector("[data-titulo]") || contenedor.querySelector("h2");
  if (encabezado) {
    encabezado.setAttribute("tabindex", "-1");
    encabezado.focus({ preventScroll: true });
  }
  window.scrollTo(0, 0);
}

/**
 * Precarga (F23): al pasar el puntero, enfocar con el teclado o tocar un enlace del front, se descarga ya el
 * módulo de su pantalla (import() es perezoso: sin esto el primer clic espera el JS). Solo baja el módulo:
 * ningún dato ni petición a la API, así que no cambia nada en el servidor ni hay nada que excluir (cerrar sesión
 * es un botón, no un enlace). Es lo que hace el prefetch de «speculation rules» para un sitio de páginas, pero
 * adaptado a un enrutador por hash, donde no hay documentos que precargar.
 */
function precargarDestino(evento) {
  const enlace = evento.target instanceof Element ? evento.target.closest("a[href^='#/']") : null;
  if (!enlace) return;
  const { ruta } = parsearHash(enlace.getAttribute("href"));
  const resuelta = resolver(tabla, ruta);
  if (resuelta) resuelta.entrada.vista().catch(() => {}); // si falla, ya lo dirá navegar() al visitar
}

export function iniciarRouter(rutas, nodoContenedor) {
  tabla = rutas;
  contenedor = nodoContenedor;
  for (const tipo of ["pointerover", "focusin", "touchstart"]) document.addEventListener(tipo, precargarDestino, { passive: true });
  window.addEventListener("hashchange", navegar);
  navegar();
}

/** Vuelve a pintar la pantalla actual (p. ej. tras cambiar de usuario). */
export function recargarVista() {
  navegar();
}
