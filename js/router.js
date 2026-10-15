// Enrutador por hash: #/plantas, #/plantas/<id>, #/admin/usuarios ...
// Con el hash no hace falta ninguna configuración del servidor estático (un
// refresh en #/plantas/x sigue pidiendo solo index.html). Cada pantalla es un
// módulo que se importa al visitarla: export function montar(contenedor, ctx).
import { parsearHash, resolver } from "./rutas.js";
import { h, vaciar, crearAviso } from "./ui.js";
import * as sesion from "./sesion.js";

let tabla = [];
let contenedor = null;
let limpiezaActual = null;
let numeroDeNavegacion = 0;

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

async function navegar() {
  const esta = ++numeroDeNavegacion;
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
    contenedor.append(pantallaMensaje("Página no encontrada", `No existe la pantalla «${ruta}».`));
    anunciar("Página no encontrada");
    return;
  }

  const { entrada, params } = resuelta;

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

  contenedor.append(h("p", { class: "texto-vacio", role: "status" }, "Cargando…"));

  let modulo;
  try {
    modulo = await entrada.vista();
  } catch {
    if (esta !== numeroDeNavegacion) return;
    vaciar(contenedor);
    contenedor.append(pantallaMensaje("No se pudo cargar la pantalla", "Falló la descarga del módulo de esta pantalla. Revisa la conexión y recarga."));
    return;
  }
  if (esta !== numeroDeNavegacion) return;
  vaciar(contenedor);

  const contexto = {
    params,
    query,
    irA,
    // Las pantallas lo consultan tras cada await: si el usuario ya navegó a otra, no pintan.
    vigente: () => esta === numeroDeNavegacion,
  };

  try {
    const limpieza = await modulo.montar(contenedor, contexto);
    if (esta !== numeroDeNavegacion) {
      if (typeof limpieza === "function") limpieza();
    } else if (typeof limpieza === "function") {
      limpiezaActual = limpieza;
    }
  } catch (error) {
    if (esta !== numeroDeNavegacion) return;
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

export function iniciarRouter(rutas, nodoContenedor) {
  tabla = rutas;
  contenedor = nodoContenedor;
  window.addEventListener("hashchange", navegar);
  navegar();
}

/** Vuelve a pintar la pantalla actual (p. ej. tras cambiar de usuario). */
export function recargarVista() {
  navegar();
}
