// Vista en vivo (RF-G2): UNICO archivo que abre un WebSocket. Habla STOMP 1.2
// con el broker del backend (`/ws`, sin SockJS) usando el codec de stomp.js.
//
// Contrato del backend (D59):
//  - el primer frame CONNECT lleva `Authorization: Bearer <JWT>` (el navegador
//    no puede poner cabeceras en el handshake del WebSocket, pero si en STOMP);
//  - destinos: /user/queue/plantas/{id} y /user/queue/avisos;
//  - el cliente no puede enviar (SEND se rechaza), solo escucha.
//
// Una sola conexión por sesión; las vistas se suscriben y se dan de baja.
// Si se cae, reintenta con espera creciente (1 s, 2 s, 4 s ... hasta 30 s) y
// vuelve a suscribir todo lo que seguía activo.
import { WS_URL } from "./config.js";
import * as sesion from "./sesion.js";
import { codificar, decodificar } from "./stomp.js";

const ESPERA_INICIAL_MS = 1000;
const ESPERA_MAXIMA_MS = 30000;
const ESTABLE_TRAS_MS = 10000;

/** Estados: inactivo | conectando | conectado | reconectando | rechazado */
let estado = "inactivo";
let socket = null;
let conectadoAlgunaVez = false;
let cerradoAMano = false;
let intentos = 0;
let temporizadorReintento = null;
let temporizadorEstable = null;
let contadorDeIds = 0;

// destino -> { id, oyentes:Set<fn> }
const suscripciones = new Map();
const oyentesDeEstado = new Set();
const oyentesDeReconexion = new Set();
const oyentesDeRechazo = new Set();

function cambiarEstado(nuevo) {
  if (estado === nuevo) return;
  estado = nuevo;
  for (const oyente of oyentesDeEstado) oyente(estado);
}

function enviar(comando, cabeceras) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(codificar(comando, cabeceras));
  }
}

function suscribirEnElServidor(destino, suscripcion) {
  enviar("SUBSCRIBE", { id: suscripcion.id, destination: destino });
}

function alRecibirTrama(trama) {
  if (trama.comando === "CONNECTED") {
    const reconexion = conectadoAlgunaVez;
    conectadoAlgunaVez = true;
    cambiarEstado("conectado");
    for (const [destino, suscripcion] of suscripciones) suscribirEnElServidor(destino, suscripcion);
    clearTimeout(temporizadorEstable);
    temporizadorEstable = setTimeout(() => {
      intentos = 0;
    }, ESTABLE_TRAS_MS);
    if (reconexion) for (const oyente of oyentesDeReconexion) oyente();
    return;
  }

  if (trama.comando === "MESSAGE") {
    const destino = [...suscripciones].find(([, s]) => s.id === trama.cabeceras.subscription);
    if (!destino) return;
    let mensaje;
    try {
      mensaje = JSON.parse(trama.cuerpo);
    } catch {
      return;
    }
    for (const oyente of [...destino[1].oyentes]) oyente(mensaje);
    return;
  }

  if (trama.comando === "ERROR") {
    // Antes de CONNECTED: token inválido o cuenta inexistente. Reintentar no sirve.
    if (estado === "conectando" || (estado === "reconectando" && !conectadoAlgunaVez)) {
      cerradoAMano = true;
      cambiarEstado("rechazado");
      const motivo = trama.cabeceras.message || "El servidor rechazó la conexión en vivo.";
      for (const oyente of oyentesDeRechazo) oyente(motivo);
    }
    // Después: el servidor cierra el socket y onclose reintenta con espera.
  }
}

function abrir() {
  clearTimeout(temporizadorReintento);
  const jwt = sesion.token();
  if (!jwt) {
    cambiarEstado("inactivo");
    return;
  }
  cambiarEstado(conectadoAlgunaVez ? "reconectando" : "conectando");

  let ws;
  try {
    ws = new WebSocket(WS_URL);
  } catch {
    programarReintento();
    return;
  }
  socket = ws;

  ws.onopen = () => {
    ws.send(
      codificar("CONNECT", {
        "accept-version": "1.2",
        "heart-beat": "0,0",
        Authorization: `Bearer ${jwt}`,
      }),
    );
  };
  ws.onmessage = (evento) => {
    if (typeof evento.data !== "string") return;
    for (const trama of decodificar(evento.data)) alRecibirTrama(trama);
  };
  ws.onclose = () => {
    if (socket !== ws) return;
    socket = null;
    clearTimeout(temporizadorEstable);
    if (!cerradoAMano && sesion.haySesion()) programarReintento();
    else if (estado !== "rechazado") cambiarEstado("inactivo");
  };
  // onerror siempre va seguido de onclose; no hay nada más que hacer aquí.
  ws.onerror = () => {};
}

function programarReintento() {
  cambiarEstado("reconectando");
  const espera = Math.min(ESPERA_INICIAL_MS * 2 ** intentos, ESPERA_MAXIMA_MS);
  intentos += 1;
  clearTimeout(temporizadorReintento);
  temporizadorReintento = setTimeout(abrir, espera);
}

/** Abre la conexión si hay sesión y no hay una abierta. */
export function conectar() {
  if (socket || !sesion.haySesion()) return;
  cerradoAMano = false;
  if (estado === "rechazado") estado = "inactivo";
  abrir();
}

/** Cierra a mano (cerrar sesión): no reintenta y olvida las suscripciones. */
export function desconectar() {
  cerradoAMano = true;
  clearTimeout(temporizadorReintento);
  clearTimeout(temporizadorEstable);
  suscripciones.clear();
  conectadoAlgunaVez = false;
  intentos = 0;
  if (socket) {
    const ws = socket;
    socket = null;
    ws.close();
  }
  cambiarEstado("inactivo");
}

/**
 * Escucha un destino (p. ej. `/user/queue/plantas/<id>`). Devuelve la función
 * que da de baja el oyente. Conecta si hace falta.
 */
export function suscribir(destino, oyente) {
  let suscripcion = suscripciones.get(destino);
  if (!suscripcion) {
    contadorDeIds += 1;
    suscripcion = { id: `sub-${contadorDeIds}`, oyentes: new Set() };
    suscripciones.set(destino, suscripcion);
    if (estado === "conectado") suscribirEnElServidor(destino, suscripcion);
  }
  suscripcion.oyentes.add(oyente);
  conectar();

  return () => {
    const vigente = suscripciones.get(destino);
    if (!vigente) return;
    vigente.oyentes.delete(oyente);
    if (vigente.oyentes.size === 0) {
      suscripciones.delete(destino);
      if (estado === "conectado") enviar("UNSUBSCRIBE", { id: vigente.id });
    }
  };
}

export const destinoDePlanta = (id) => `/user/queue/plantas/${id}`;
export const DESTINO_AVISOS = "/user/queue/avisos";

function registrar(conjunto, oyente) {
  conjunto.add(oyente);
  return () => conjunto.delete(oyente);
}

/** Avisa del estado actual y de cada cambio. */
export function alCambiarEstado(oyente) {
  oyente(estado);
  return registrar(oyentesDeEstado, oyente);
}

/** Se llama cuando la conexión vuelve tras una caída: los datos pudieron cambiar mientras tanto. */
export function alReconectar(oyente) {
  return registrar(oyentesDeReconexion, oyente);
}

/** Se llama si el servidor rechaza la conexión (token inválido). */
export function alSerRechazado(oyente) {
  return registrar(oyentesDeRechazo, oyente);
}

export function estadoActual() {
  return estado;
}

// Si el navegador recupera la red, no esperar al próximo reintento.
window.addEventListener("online", () => {
  if (estado === "reconectando" && !socket) abrir();
});
