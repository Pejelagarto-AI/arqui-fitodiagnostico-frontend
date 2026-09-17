// Unica capa que llama a fetch. Todo el resto del front habla con estas dos
// funciones y recibe siempre un ErrorApi normalizado cuando algo falla, sin
// importar si el problema fue de red, de la API o de un cuerpo mal formado.
import { API_BASE } from "./config.js";

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

function errorDeRed(url) {
  return new ErrorApi({
    codigo: "API_NO_DISPONIBLE",
    mensaje: `No se pudo conectar con la API en ${url}. Verifica que el backend este corriendo.`,
    status: null,
  });
}

async function leerCuerpoJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function manejarRespuesta(response) {
  if (response.ok) {
    const cuerpo = await leerCuerpoJson(response);
    if (cuerpo === null) {
      throw new ErrorApi({
        codigo: "RESPUESTA_INVALIDA",
        mensaje: "La API respondio 200 pero el cuerpo no es JSON valido.",
        status: response.status,
      });
    }
    return cuerpo;
  }

  const cuerpo = await leerCuerpoJson(response);
  if (cuerpo === null) {
    throw new ErrorApi({
      codigo: "RESPUESTA_INVALIDA",
      mensaje: `La API respondio con error ${response.status} y un cuerpo que no es JSON valido.`,
      status: response.status,
    });
  }

  const { error, mensaje, detalle } = cuerpo;
  throw new ErrorApi({
    codigo: error || "ERROR_DESCONOCIDO",
    mensaje: mensaje || "Ocurrio un error inesperado consultando la API.",
    campo: detalle && detalle.campo ? detalle.campo : null,
    status: response.status,
  });
}

export async function obtenerEspecies() {
  const url = `${API_BASE}/especies`;
  let response;
  try {
    response = await fetch(url);
  } catch {
    throw errorDeRed(url);
  }
  return manejarRespuesta(response);
}

export async function diagnosticar(medicion) {
  const url = `${API_BASE}/diagnosticos`;
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(medicion),
    });
  } catch {
    throw errorDeRed(url);
  }
  return manejarRespuesta(response);
}
