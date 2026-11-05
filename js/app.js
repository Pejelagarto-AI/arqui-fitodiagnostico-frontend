// Punto de entrada: arma el menú, el indicador de conexión y el enrutador, y
// engancha la sesión con la vista en vivo. La lógica de cada pantalla vive en
// js/vistas/*.js; la llamada a la API, en api.js; el WebSocket, en envivo.js.
import { alVencerLaSesion } from "./api.js";
import * as sesion from "./sesion.js";
import * as envivo from "./envivo.js";
import { h, svg, vaciar, toast } from "./ui.js";
import { iniciarRouter, irA, rutaActual } from "./router.js";
import { invalidarCache } from "./cache.js";
import { patronesDePestanas } from "./pestanas.js";

// acceso: "publica" | "anonima" (solo sin sesión) | "sesion" | "admin"
const RUTAS = [
  // La raíz es la portada (F38): qué es el producto y por dónde empezar. Con sesión lleva al tablero.
  { patron: "/", acceso: "anonima", vista: () => import("./vistas/portada.js") },
  { patron: "/diagnostico", acceso: "publica", vista: () => import("./vistas/diagnostico-suelto.js") },
  { patron: "/entrar", acceso: "anonima", vista: () => import("./vistas/entrar.js") },
  { patron: "/registro", acceso: "anonima", vista: () => import("./vistas/registro.js") },
  { patron: "/recuperar", acceso: "anonima", vista: () => import("./vistas/recuperar.js") },
  // Rutas que usan los enlaces de los correos (RutasDelFront del backend).
  { patron: "/restablecer", acceso: "publica", vista: () => import("./vistas/restablecer.js") },
  { patron: "/invitacion", acceso: "publica", vista: () => import("./vistas/invitacion.js") },
  { patron: "/perfil", acceso: "sesion", vista: () => import("./vistas/perfil.js") },
  { patron: "/plantas", acceso: "sesion", vista: () => import("./vistas/plantas.js") },
  { patron: "/plantas/nueva", acceso: "sesion", vista: () => import("./vistas/planta-nueva.js") },
  { patron: "/plantas/:id/vincular", acceso: "sesion", vista: () => import("./vistas/vincular-asistente.js") },
  // El detalle de planta tiene una ruta por pestaña (F37): la misma pantalla, que cambia de cara sin desmontarse.
  ...patronesDePestanas().map(({ patron, pestana }) => ({ patron, pestana, familia: "planta", acceso: "sesion", vista: () => import("./vistas/planta-detalle.js") })),
  { patron: "/v/:codigo", acceso: "publica", vista: () => import("./vistas/vinculo-corto.js") },
  { patron: "/vincular", acceso: "sesion", vista: () => import("./vistas/vincular.js") },
  { patron: "/solicitudes", acceso: "sesion", vista: () => import("./vistas/solicitudes.js") },
  { patron: "/admin", acceso: "admin", vista: () => import("./vistas/admin-inicio.js") },
  { patron: "/admin/usuarios", acceso: "admin", vista: () => import("./vistas/admin-usuarios.js") },
  { patron: "/admin/usuarios/:id", acceso: "admin", vista: () => import("./vistas/admin-usuario.js") },
  { patron: "/admin/especies", acceso: "admin", vista: () => import("./vistas/admin-especies.js") },
  { patron: "/admin/solicitudes", acceso: "admin", vista: () => import("./vistas/admin-solicitudes.js") },
  { patron: "/admin/dispositivos", acceso: "admin", vista: () => import("./vistas/admin-dispositivos.js") },
];

// Avisos en vivo (WebSocket). No es el estado de la planta (eso lo dice el sondeo en su cabecera):
// aquí es solo un punto discreto con el texto como tooltip y para lectores de pantalla.
const ETIQUETAS_CONEXION = {
  inactivo: "Avisos en vivo: sin conexión",
  conectando: "Avisos en vivo: conectando…",
  conectado: "Avisos en vivo: conectado",
  reconectando: "Avisos en vivo: reconectando…",
  rechazado: "Avisos en vivo: conexión rechazada",
};

const navegacion = document.getElementById("navegacion");
const barraInferior = document.getElementById("barra-inferior");
const vista = document.getElementById("vista");

/** ¿La ruta `ruta` del menú es la sección donde está el usuario? «/» solo en la portada; el resto, por prefijo. */
function estaActiva(ruta) {
  const actual = window.location.hash.slice(1).split("?")[0] || "/";
  // Vincular una matera (#/vincular, #/v/...) es parte de «Plantas».
  if (ruta === "/plantas" && (actual === "/vincular" || actual.startsWith("/v/"))) return true;
  return ruta === "/" ? actual === "/" : actual === ruta || actual.startsWith(`${ruta}/`);
}

function enlaceDeMenu(ruta, texto) {
  return h("a", { href: `#${ruta}`, "data-ruta": ruta, "aria-current": estaActiva(ruta) ? "page" : null }, texto);
}

// ---- barra inferior (teléfono, F37): iconos SVG propios, de trazo, construidos con createElementNS ----
const TRAZOS = {
  plantas: ["M12 21v-9", "M12 13c-4.2 0-7-2.8-7-7 4.2 0 7 2.8 7 7Z", "M12 16c0-3.9 2.6-6.5 6.5-6.5 0 3.9-2.6 6.5-6.5 6.5Z"],
  diagnostico: ["M3 12h4l2.5-6 4 12 2.5-6H21"],
  especies: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z", "M12 8v8", "M8 12h8"],
  perfil: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M4.5 20.5c1-3.5 4-5.5 7.5-5.5s6.5 2 7.5 5.5"],
  admin: ["M12 3l7 3v5.5c0 4.3-2.9 7.8-7 9.5-4.1-1.7-7-5.2-7-9.5V6l7-3Z", "M9 12l2 2 4-4"],
};

function icono(nombre) {
  return svg("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" },
    TRAZOS[nombre].map((d) => svg("path", { d })));
}

function pestanaDeBarra(ruta, texto, nombreIcono) {
  return h("a", { href: `#${ruta}`, class: "barra-pestana", "data-ruta": ruta, "aria-current": estaActiva(ruta) ? "page" : null },
    h("span", { class: "barra-icono" }, icono(nombreIcono)), h("span", { class: "barra-texto" }, texto));
}

function pintarBarraInferior(usuario) {
  vaciar(barraInferior);
  // Sin sesión no hay barra: la portada trae sus propias acciones (crear cuenta, entrar, probar) y la marca
  // de la cabecera vuelve a ella. La barra es la navegación de quien ya está dentro.
  barraInferior.hidden = !usuario;
  document.body.dataset.sesion = usuario ? "si" : "no";
  if (!usuario) return;
  const pestanas = [
    pestanaDeBarra("/plantas", "Plantas", "plantas"),
    pestanaDeBarra("/diagnostico", "Diagnóstico", "diagnostico"),
    pestanaDeBarra("/solicitudes", "Especies", "especies"),
    sesion.esAdmin() ? pestanaDeBarra("/admin", "Admin", "admin") : null,
    pestanaDeBarra("/perfil", "Perfil", "perfil"),
  ];
  barraInferior.append(...pestanas.filter(Boolean));
}

/** Tras cada navegación: solo se mueve aria-current (en el menú de arriba y en la barra de abajo), sin repintar. */
function marcarActivos() {
  for (const enlace of document.querySelectorAll("#navegacion a[data-ruta], #barra-inferior a[data-ruta]")) {
    if (estaActiva(enlace.dataset.ruta)) enlace.setAttribute("aria-current", "page");
    else enlace.removeAttribute("aria-current");
  }
}

function indicadorDeConexion() {
  const punto = h("span", { class: "punto-conexion", "aria-hidden": "true" });
  const texto = h("span", { class: "solo-lector" });
  const nodo = h("span", { class: "indicador-conexion indicador-conexion--global", id: "indicador-conexion", "data-estado": "inactivo" }, punto, texto);
  envivo.alCambiarEstado((estado) => {
    nodo.dataset.estado = estado;
    texto.textContent = ETIQUETAS_CONEXION[estado] || estado;
    nodo.title = texto.textContent;
  });
  return nodo;
}

function pintarMenu() {
  vaciar(navegacion);
  const usuario = sesion.usuario();
  const enlaces = usuario ? [] : [enlaceDeMenu("/diagnostico", "Probar sin cuenta")];
  if (usuario) {
    enlaces.push(enlaceDeMenu("/plantas", "Mis plantas"), enlaceDeMenu("/diagnostico", "Diagnóstico rápido"), enlaceDeMenu("/solicitudes", "Solicitar especie"));
    if (sesion.esAdmin()) enlaces.push(enlaceDeMenu("/admin", "Administración"));
  }

  const derecha = usuario
    ? [
        indicadorDeConexion(),
        h("a", { href: "#/perfil", class: "nombre-usuario", "data-ruta": "/perfil", "aria-current": estaActiva("/perfil") ? "page" : null }, usuario.nombre),
        h("button", { type: "button", class: "boton boton-secundario boton-chico", id: "btn-cerrar-sesion", onclick: cerrarSesion }, "Cerrar sesión"),
      ]
    : [enlaceDeMenu("/entrar", "Iniciar sesión"), enlaceDeMenu("/registro", "Crear cuenta")];

  navegacion.append(h("div", { class: "menu-enlaces" }, enlaces), h("div", { class: "menu-sesion" }, derecha));
  pintarBarraInferior(usuario);
}

function cerrarSesion() {
  sesion.cerrar();
  toast("Sesión cerrada.");
  irA("/");
}

// Sesión -> menú y vista en vivo. Los avisos globales (RF-G3, RF-H5) llegan por
// /user/queue/avisos en cualquier pantalla: se escuchan mientras haya sesión.
let bajaDeAvisos = null;

function alLlegarUnAviso(aviso) {
  invalidarCache(); // un aviso (acceso perdido, solicitud resuelta) dice que lo guardado ya no es fiable
  toast(aviso.mensaje, aviso.tipo === "ACCESO_PERDIDO" ? "error" : "info");
  // Las pantallas que muestran esa información se refrescan solas.
  window.dispatchEvent(new CustomEvent("fito:aviso", { detail: aviso }));
}

function sincronizarVivo() {
  if (sesion.haySesion() && !bajaDeAvisos) {
    bajaDeAvisos = envivo.suscribir(envivo.DESTINO_AVISOS, alLlegarUnAviso);
  } else if (!sesion.haySesion() && bajaDeAvisos) {
    bajaDeAvisos = null;
    envivo.desconectar();
  }
}

sesion.alCambiar(() => {
  invalidarCache(); // otra sesión no debe ver lo de la anterior
  sincronizarVivo();
  pintarMenu();
});
window.addEventListener("hashchange", pintarMenu);
window.addEventListener("fito:navegacion", marcarActivos);

// 401 con un token que creíamos vigente: caducó (o la cuenta ya no existe).
alVencerLaSesion(() => {
  if (!sesion.haySesion()) return;
  sesion.cerrar();
  toast("Tu sesión caducó. Inicia sesión de nuevo.", "error");
  irA(`/entrar?volver=${encodeURIComponent(rutaActual())}`);
});

// El servidor rechazó la conexión en vivo: probablemente el token ya no vale.
envivo.alSerRechazado(async () => {
  const { obtenerCuenta } = await import("./api.js");
  try {
    await obtenerCuenta(); // si el token murió, esto dispara el flujo de 401
  } catch {
    // los errores de red se ven en el indicador; los 401 los maneja alVencerLaSesion
  }
});

sincronizarVivo();
pintarMenu();
iniciarRouter(RUTAS, vista);
