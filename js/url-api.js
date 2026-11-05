// URL base de la API por defecto (F35, ampliada en F40). Función pura, sin DOM, para probarla con `node --test`.
// Por HTTP, desde el celular el front se abre en http://<ip-del-portátil>:5500 y la API vive en el mismo host,
// puerto 8080. Por HTTPS la API es del mismo origen que la página. En file:// o sin hostname cae en localhost.

export const PUERTO_API_POR_DEFECTO = 8080;

/**
 * `ubicacion` = { protocol, hostname, host, origin } (como window.location). Devuelve la base de la API, sin barra final.
 *  - Página servida por HTTPS: la API es del MISMO origen, `${origin}/api/v1`. Delante hay un proxy que atiende el
 *    front y manda `/api/*` y `/ws*` al backend; así no hay contenido mixto (una página HTTPS no puede llamar a
 *    una API HTTP) y la cámara del lector de QR tiene contexto seguro (F40).
 *  - Página servida por HTTP: el mismo host, puerto 8080 (F35).
 *  - file:// o sin hostname: localhost.
 */
export function apiPorDefecto(ubicacion) {
  const protocolo = ubicacion && ubicacion.protocol;
  const host = ubicacion && ubicacion.hostname;
  if (protocolo === "https:" && host) {
    const origen = ubicacion.origin && ubicacion.origin !== "null" ? ubicacion.origin : `https://${ubicacion.host || host}`;
    return `${origen}/api/v1`;
  }
  const servidoPorWeb = protocolo === "http:";
  // Un hostname IPv6 llega sin corchetes en `hostname`: se los ponemos para formar la URL.
  const anfitrion = servidoPorWeb && host ? (host.includes(":") && !host.startsWith("[") ? `[${host}]` : host) : "localhost";
  return `http://${anfitrion}:${PUERTO_API_POR_DEFECTO}/api/v1`;
}
