// Enrutador por hash: #/plantas, #/plantas/<id>, #/admin/usuarios ...
// Con el hash no hace falta ninguna configuración del servidor estático (un
// refresh en #/plantas/x sigue pidiendo solo index.html). Cada pantalla es un
// módulo que se importa al visitarla: export function montar(contenedor, ctx).
import { parsearHash, resolver, mismaPantalla, decidirAcceso } from "./rutas.js";
import { h, vaciar, crearAviso, esqueletoSiTarda } from "./ui.js";
import * as sesion from "./sesion.js";
import { conTransicion } from "./transiciones.js";

let tabla = [];
let contenedor = null;
let limpiezaActual = null;
// Pantalla montada y, si la ofrece, su manera de cambiar de cara sin desmontarse (pestañas, F37).
let montadaActual = null;
let alCambiarRutaActual = null;
let numeroDeNavegacion = 0;
let marcadorActual = null;
let esPrimera = true;

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

async function navegar({ forzar = false } = {}) {
  const { ruta, query } = parsearHash(window.location.hash);
  const resuelta = resolver(tabla, ruta);

  // Pestañas (F37): la ruta nueva es otra cara de la pantalla que ya está (misma planta, otra pestaña). No se
  // desmonta nada: la pantalla cambia de pestaña y su sondeo y sus datos siguen vivos. No cuenta como navegación
  // (ctx.vigente() sigue siendo cierto para ella).
  if (!forzar && alCambiarRutaActual && sesion.haySesion() && mismaPantalla(montadaActual, resuelta)) {
    montadaActual = { entrada: resuelta.entrada, params: resuelta.params };
    document.body.dataset.patron = resuelta.entrada.patron;
    alCambiarRutaActual({ entrada: resuelta.entrada, params: resuelta.params, query });
    return;
  }

  const esta = ++numeroDeNavegacion;
  if (marcadorActual) marcadorActual.quitar();
  marcadorActual = null;
  montadaActual = null;
  alCambiarRutaActual = null;
  if (limpiezaActual) {
    try {
      limpiezaActual();
    } catch {
      // una limpieza que falla no debe impedir navegar
    }
    limpiezaActual = null;
  }

  if (!resuelta) {
    await reemplazarVista(esta, () => {
      delete document.body.dataset.acceso;
      delete document.body.dataset.patron;
      delete document.body.dataset.familia;
      contenedor.append(pantallaMensaje("Página no encontrada", `No existe la pantalla «${ruta}».`));
      anunciar("Página no encontrada");
    });
    return;
  }

  const { entrada, params } = resuelta;

  // Quién puede ver qué (rutas.js, decidirAcceso): con sesión la portada lleva al tablero; sin ella, lo privado a entrar.
  const decision = decidirAcceso(entrada.acceso, { haySesion: sesion.haySesion(), esAdmin: sesion.esAdmin(), rutaPedida: rutaActual() });
  if (decision.accion === "ir") {
    irA(decision.ruta, { reemplazar: true });
    return;
  }

  // Para el CSS: el pie solo en pantallas públicas, el indicador global fuera del detalle de planta.
  const marcarCuerpo = () => {
    document.body.dataset.acceso = entrada.acceso;
    document.body.dataset.patron = entrada.patron;
    document.body.dataset.familia = entrada.familia || "";
    // Para quien pinta la navegación (app.js): hay navegaciones que no disparan hashchange (irA con reemplazar).
    window.dispatchEvent(new Event("fito:navegacion"));
  };

  if (decision.accion === "sin-permiso") {
    await reemplazarVista(esta, () => {
      marcarCuerpo();
      contenedor.append(pantallaMensaje("Sin permiso", "Esta sección es solo para administradores."));
      anunciar("Sin permiso");
    });
    return;
  }

  // Todo lo que toca el DOM va dentro de la transición (F28): la pantalla vieja se queda a la vista hasta
  // que la nueva tiene contenido (o pasa el tope de espera) y entonces se funden.
  await reemplazarVista(esta, async () => {
    marcarCuerpo();
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
      entrada, // la fila de la tabla de rutas: trae, por ejemplo, la pestaña pedida (F37)
      irA,
      // Las pantallas lo consultan tras cada await: si el usuario ya navegó a otra, no pintan.
      vigente: () => esta === numeroDeNavegacion,
    };

    try {
      // Una pantalla devuelve su limpieza (una función) o { limpiar, alCambiarRuta } si sabe cambiar de cara
      // sin desmontarse (las pestañas del detalle de planta).
      const devuelto = await modulo.montar(contenedor, contexto);
      const limpieza = typeof devuelto === "function" ? devuelto : devuelto && devuelto.limpiar;
      marcador.quitar();
      if (esta !== numeroDeNavegacion) {
        if (typeof limpieza === "function") limpieza();
      } else {
        if (typeof limpieza === "function") limpiezaActual = limpieza;
        montadaActual = { entrada, params };
        alCambiarRutaActual = devuelto && typeof devuelto.alCambiarRuta === "function" ? devuelto.alCambiarRuta : null;
      }
    } catch (error) {
      if (esta !== numeroDeNavegacion) return;
      marcador.quitar();
      vaciar(contenedor);
      contenedor.append(pantallaMensaje("Algo salió mal", error.mensaje || error.message || "Error inesperado."));
    }
    if (esta === numeroDeNavegacion) anunciar(modulo.titulo || "Fitodiagnóstico");
  });
}

/** Cambia la pantalla dentro de una transición: vacía el contenedor y deja que `rellenar` lo llene. */
function reemplazarVista(esta, rellenar) {
  // La primera pantalla de la carga de la página no se funde con nada: se pinta directo.
  const conEfecto = !esPrimera;
  esPrimera = false;
  const actualizar = async () => {
    if (esta !== numeroDeNavegacion) return;
    vaciar(contenedor);
    await rellenar();
  };
  return conEfecto ? conTransicion(actualizar, { esperarHasta: true }) : actualizar();
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
 * Precarga (F27): al pasar el puntero, enfocar con el teclado o tocar un enlace del front, se descarga ya el
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
  window.addEventListener("hashchange", () => navegar());
  navegar();
}

/** Vuelve a pintar la pantalla actual (p. ej. tras cambiar de usuario). */
export function recargarVista() {
  navegar({ forzar: true }); // de verdad: desmonta y vuelve a montar, aunque la ruta sea la misma pestaña
}
