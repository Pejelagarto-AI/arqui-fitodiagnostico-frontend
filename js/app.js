// Punto de entrada: arma el menú, el indicador de conexión y el enrutador, y
// engancha la sesión con la vista en vivo. La lógica de cada pantalla vive en
// js/vistas/*.js; la llamada a la API, en api.js; el WebSocket, en envivo.js.
import { alVencerLaSesion } from "./api.js";
import * as sesion from "./sesion.js";
import * as envivo from "./envivo.js";
import { h, vaciar, toast } from "./ui.js";
import { iniciarRouter, irA, rutaActual } from "./router.js";

// acceso: "publica" | "anonima" (solo sin sesión) | "sesion" | "admin"
const RUTAS = [
  { patron: "/", acceso: "publica", vista: () => import("./vistas/diagnostico-suelto.js") },
  { patron: "/entrar", acceso: "anonima", vista: () => import("./vistas/entrar.js") },
  { patron: "/registro", acceso: "anonima", vista: () => import("./vistas/registro.js") },
  { patron: "/recuperar", acceso: "anonima", vista: () => import("./vistas/recuperar.js") },
  // Rutas que usan los enlaces de los correos (RutasDelFront del backend).
  { patron: "/restablecer", acceso: "publica", vista: () => import("./vistas/restablecer.js") },
  { patron: "/invitacion", acceso: "publica", vista: () => import("./vistas/invitacion.js") },
  { patron: "/perfil", acceso: "sesion", vista: () => import("./vistas/perfil.js") },
  { patron: "/plantas", acceso: "sesion", vista: () => import("./vistas/plantas.js") },
  { patron: "/plantas/nueva", acceso: "sesion", vista: () => import("./vistas/planta-nueva.js") },
  { patron: "/plantas/:id", acceso: "sesion", vista: () => import("./vistas/planta-detalle.js") },
  { patron: "/solicitudes", acceso: "sesion", vista: () => import("./vistas/solicitudes.js") },
  { patron: "/admin", acceso: "admin", vista: () => import("./vistas/admin-inicio.js") },
  { patron: "/admin/usuarios", acceso: "admin", vista: () => import("./vistas/admin-usuarios.js") },
  { patron: "/admin/usuarios/:id", acceso: "admin", vista: () => import("./vistas/admin-usuario.js") },
  { patron: "/admin/especies", acceso: "admin", vista: () => import("./vistas/admin-especies.js") },
  { patron: "/admin/solicitudes", acceso: "admin", vista: () => import("./vistas/admin-solicitudes.js") },
];

const ETIQUETAS_CONEXION = {
  inactivo: "En vivo: sin conexión",
  conectando: "En vivo: conectando…",
  conectado: "En vivo: conectado",
  reconectando: "En vivo: reconectando…",
  rechazado: "En vivo: rechazada",
};

const navegacion = document.getElementById("navegacion");
const vista = document.getElementById("vista");

function enlaceDeMenu(ruta, texto) {
  const actual = window.location.hash.slice(1).split("?")[0] || "/";
  const activo = ruta === "/" ? actual === "/" : actual === ruta || actual.startsWith(`${ruta}/`);
  return h("a", { href: `#${ruta}`, "aria-current": activo ? "page" : null }, texto);
}

function indicadorDeConexion() {
  const punto = h("span", { class: "punto-conexion", "aria-hidden": "true" });
  const texto = h("span", {});
  const nodo = h("span", { class: "indicador-conexion", id: "indicador-conexion", "data-estado": "inactivo" }, punto, texto);
  envivo.alCambiarEstado((estado) => {
    nodo.dataset.estado = estado;
    texto.textContent = ETIQUETAS_CONEXION[estado] || estado;
  });
  return nodo;
}

function pintarMenu() {
  vaciar(navegacion);
  const usuario = sesion.usuario();
  const enlaces = [enlaceDeMenu("/", "Diagnóstico rápido")];
  if (usuario) {
    enlaces.push(enlaceDeMenu("/plantas", "Mis plantas"), enlaceDeMenu("/solicitudes", "Solicitar especie"));
    if (sesion.esAdmin()) enlaces.push(enlaceDeMenu("/admin", "Administración"));
  }

  const derecha = usuario
    ? [
        indicadorDeConexion(),
        h("a", { href: "#/perfil", class: "nombre-usuario", "aria-current": window.location.hash.startsWith("#/perfil") ? "page" : null }, usuario.nombre),
        h("button", { type: "button", class: "boton boton-secundario boton-chico", id: "btn-cerrar-sesion", onclick: cerrarSesion }, "Cerrar sesión"),
      ]
    : [enlaceDeMenu("/entrar", "Iniciar sesión"), enlaceDeMenu("/registro", "Crear cuenta")];

  navegacion.append(h("div", { class: "menu-enlaces" }, enlaces), h("div", { class: "menu-sesion" }, derecha));
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
  sincronizarVivo();
  pintarMenu();
});
window.addEventListener("hashchange", pintarMenu);

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
