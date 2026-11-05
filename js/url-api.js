// URL base de la API por defecto (F35). Función pura, sin DOM, para probarla con `node --test`.
// Desde el celular el front se abre en http://<ip-del-portátil>:5500, así que la API vive en el mismo
// host, puerto 8080. En file:// o sin hostname (no hay a quién apuntar) cae en localhost.

export const PUERTO_API_POR_DEFECTO = 8080;

/** `ubicacion` = { protocol, hostname } (como window.location). Devuelve la base de la API, sin barra final. */
export function apiPorDefecto(ubicacion) {
  const protocolo = ubicacion && ubicacion.protocol;
  const host = ubicacion && ubicacion.hostname;
  const servidoPorWeb = protocolo === "http:" || protocolo === "https:";
  // Un hostname IPv6 llega sin corchetes en `hostname`: se los ponemos para formar la URL.
  const anfitrion = servidoPorWeb && host ? (host.includes(":") && !host.startsWith("[") ? `[${host}]` : host) : "localhost";
  return `http://${anfitrion}:${PUERTO_API_POR_DEFECTO}/api/v1`;
}
