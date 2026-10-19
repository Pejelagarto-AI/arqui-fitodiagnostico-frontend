// Unica capa que llama a fetch. Todo el resto del front habla con estas
// funciones y recibe siempre un ErrorApi normalizado cuando algo falla, sin
// importar si el problema fue de red, de la API o de un cuerpo mal formado.
// (El WebSocket de la vista en vivo es el otro canal y vive solo en envivo.js.)
import { API_BASE } from "./config.js";
import * as sesion from "./sesion.js";

const TIEMPO_MAXIMO_MS = 20000;

export class ErrorApi extends Error {
  constructor({ codigo, mensaje, campo = null, status = null }) {
    super(mensaje);
    this.name = "ErrorApi";
    this.codigo = codigo;
    this.mensaje = mensaje;
    this.campo = campo;
    this.status = status;
  }
}

// Quien navega (app.js) decide qué hacer cuando la API dice 401 con una sesión
// que creíamos vigente: descartar el token y volver a iniciar sesión.
let manejadorSesionVencida = () => {};
export function alVencerLaSesion(manejador) {
  manejadorSesionVencida = manejador;
}

function errorDeRed(url) {
  return new ErrorApi({
    codigo: "API_NO_DISPONIBLE",
    mensaje: `No se pudo conectar con la API en ${url}. Verifica que el backend este corriendo.`,
    status: null,
  });
}

async function leerCuerpoJson(response) {
  try {
    const texto = await response.text();
    if (texto === "") return { vacio: true };
    return { valor: JSON.parse(texto) };
  } catch {
    return null;
  }
}

async function manejarRespuesta(response, conSesion) {
  const lectura = await leerCuerpoJson(response);

  if (response.ok) {
    if (lectura === null) {
      throw new ErrorApi({
        codigo: "RESPUESTA_INVALIDA",
        mensaje: `La API respondio ${response.status} pero el cuerpo no es JSON valido.`,
        status: response.status,
      });
    }
    // 204 No Content (cerrar, eliminar, revocar...): no hay nada que devolver.
    return lectura.vacio ? null : lectura.valor;
  }

  if (response.status === 401 && conSesion) {
    manejadorSesionVencida();
  }

  if (lectura === null || lectura.vacio) {
    throw new ErrorApi({
      codigo: "RESPUESTA_INVALIDA",
      mensaje: `La API respondio con error ${response.status} y un cuerpo que no es JSON valido.`,
      status: response.status,
    });
  }

  const { error, mensaje, detalle } = lectura.valor || {};
  throw new ErrorApi({
    codigo: error || "ERROR_DESCONOCIDO",
    mensaje: mensaje || "Ocurrio un error inesperado consultando la API.",
    campo: detalle && detalle.campo ? detalle.campo : null,
    status: response.status,
  });
}

/**
 * Una petición. `publico: true` NO manda el token: Spring rechaza con 401 un
 * token vencido incluso en rutas públicas, y el registro o el diagnóstico
 * suelto no tienen por qué fallar por eso.
 */
async function pedir(metodo, ruta, { cuerpo, publico = false, sinCache = false } = {}) {
  const url = `${API_BASE}${ruta}`;
  const cabeceras = {};
  const opciones = { method: metodo, headers: cabeceras };
  if (cuerpo !== undefined) {
    // Siempre application/json: sin él la API responde 415 (D50).
    cabeceras["Content-Type"] = "application/json";
    opciones.body = JSON.stringify(cuerpo);
  }
  const jwt = publico ? null : sesion.token();
  if (jwt) cabeceras.Authorization = `Bearer ${jwt}`;
  if (sinCache) opciones.cache = "no-cache";

  const controlador = new AbortController();
  opciones.signal = controlador.signal;
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_MAXIMO_MS);

  let response;
  try {
    response = await fetch(url, opciones);
  } catch {
    throw errorDeRed(url);
  } finally {
    clearTimeout(temporizador);
  }
  return manejarRespuesta(response, Boolean(jwt));
}

const seg = encodeURIComponent;

// ---- sin cuenta (RF-F6) ----

// sinCache: GET /especies llega con Cache-Control max-age=300; tras activar o
// desactivar una especie el front revalida en vez de mostrar el catálogo viejo.
export const obtenerEspecies = () => pedir("GET", "/especies", { publico: true, sinCache: true });
export const diagnosticar = (medicion) => pedir("POST", "/diagnosticos", { cuerpo: medicion, publico: true });

// ---- sesión y cuenta ----

export const registrar = (datos) => pedir("POST", "/auth/registro", { cuerpo: datos, publico: true });
export const iniciarSesion = (correo, contrasena) =>
  pedir("POST", "/auth/sesion", { cuerpo: { correo, contrasena }, publico: true });
export const solicitarRecuperacion = (correo) =>
  pedir("POST", "/auth/recuperacion", { cuerpo: { correo }, publico: true });
export const restablecerContrasena = (token, contrasenaNueva) =>
  pedir("POST", "/auth/restablecimiento", { cuerpo: { token, contrasenaNueva }, publico: true });

export const obtenerCuenta = () => pedir("GET", "/cuenta");
export const actualizarCuenta = (datos) => pedir("PUT", "/cuenta", { cuerpo: datos });
export const cambiarContrasena = (contrasenaActual, contrasenaNueva) =>
  pedir("PUT", "/cuenta/contrasena", { cuerpo: { contrasenaActual, contrasenaNueva } });
export const eliminarCuenta = () => pedir("DELETE", "/cuenta");

// ---- plantas ----

export const listarPlantas = () => pedir("GET", "/plantas");
export const listarPlantasCompartidas = () => pedir("GET", "/plantas/compartidas");
export const registrarPlanta = (apodo, especie) => pedir("POST", "/plantas", { cuerpo: { apodo, especie } });
export const obtenerPlanta = (id) => pedir("GET", `/plantas/${seg(id)}`);
export const editarPlanta = (id, apodo, especie) => pedir("PUT", `/plantas/${seg(id)}`, { cuerpo: { apodo, especie } });
export const eliminarPlanta = (id) => pedir("DELETE", `/plantas/${seg(id)}`);
export const registrarMedicion = (id, medicion) => pedir("POST", `/plantas/${seg(id)}/mediciones`, { cuerpo: medicion });
export const obtenerDiagnosticoVigente = (id) => pedir("GET", `/plantas/${seg(id)}/diagnostico`);
export const obtenerHistorial = (id, pagina = 0, tamano = 10) =>
  pedir("GET", `/plantas/${seg(id)}/diagnosticos?pagina=${pagina}&tamano=${tamano}`);

// ---- dispositivos (dueño) ----

// Devuelve { dispositivoId, plantaId, token, expira }. El token solo se muestra en esta respuesta.
export const vincularDispositivo = (plantaId, dispositivoId) =>
  pedir("POST", `/plantas/${seg(plantaId)}/dispositivos`, { cuerpo: { dispositivoId } });

// ---- compartir ----

export const generarInvitacion = (plantaId, correo) =>
  pedir("POST", `/plantas/${seg(plantaId)}/invitaciones`, { cuerpo: correo ? { correo } : {} });
export const listarInvitaciones = (plantaId) => pedir("GET", `/plantas/${seg(plantaId)}/invitaciones`);
export const revocarInvitacion = (plantaId, invitacionId) =>
  pedir("DELETE", `/plantas/${seg(plantaId)}/invitaciones/${seg(invitacionId)}`);
export const listarInvitados = (plantaId) => pedir("GET", `/plantas/${seg(plantaId)}/invitados`);
export const revocarInvitado = (plantaId, invitadoId) =>
  pedir("DELETE", `/plantas/${seg(plantaId)}/invitados/${seg(invitadoId)}`);
export const renunciarAPlanta = (plantaId) => pedir("DELETE", `/plantas/compartidas/${seg(plantaId)}`);
export const aceptarInvitacion = (token) => pedir("POST", "/invitaciones/aceptar", { cuerpo: { token } });
export const aceptarInvitacionConRegistro = (datos) =>
  pedir("POST", "/invitaciones/aceptar-con-registro", { cuerpo: datos, publico: true });

// ---- solicitudes de especie ----

export const enviarSolicitudDeEspecie = (nombre, justificacion) =>
  pedir("POST", "/solicitudes-especie", { cuerpo: justificacion ? { nombre, justificacion } : { nombre } });
export const listarMisSolicitudes = () => pedir("GET", "/solicitudes-especie");

// ---- administración ----

export const adminListarUsuarios = (texto) =>
  pedir("GET", texto ? `/admin/usuarios?q=${seg(texto)}` : "/admin/usuarios");
export const adminObtenerUsuario = (id) => pedir("GET", `/admin/usuarios/${seg(id)}`);
export const adminEditarUsuario = (id, datos) => pedir("PUT", `/admin/usuarios/${seg(id)}`, { cuerpo: datos });
export const adminEliminarUsuario = (id) => pedir("DELETE", `/admin/usuarios/${seg(id)}`);
export const adminOtorgarAdministrador = (id) => pedir("PUT", `/admin/usuarios/${seg(id)}/rol-administrador`);
export const adminRevocarAdministrador = (id) => pedir("DELETE", `/admin/usuarios/${seg(id)}/rol-administrador`);

export const adminListarEspecies = () => pedir("GET", "/admin/especies");
export const adminCrearEspecie = (nombre, rangos) => pedir("POST", "/admin/especies", { cuerpo: { nombre, rangos } });
export const adminEditarEspecie = (nombre, rangos) =>
  pedir("PUT", `/admin/especies/${seg(nombre)}`, { cuerpo: { rangos } });
export const adminDesactivarEspecie = (nombre) => pedir("POST", `/admin/especies/${seg(nombre)}/desactivar`);
export const adminReactivarEspecie = (nombre) => pedir("POST", `/admin/especies/${seg(nombre)}/reactivar`);

export const adminListarSolicitudes = () => pedir("GET", "/admin/solicitudes-especie");
export const adminAprobarSolicitud = (id, respuesta) =>
  pedir("POST", `/admin/solicitudes-especie/${seg(id)}/aprobar`, { cuerpo: respuesta ? { respuesta } : {} });
export const adminRechazarSolicitud = (id, respuesta) =>
  pedir("POST", `/admin/solicitudes-especie/${seg(id)}/rechazar`, { cuerpo: respuesta ? { respuesta } : {} });
