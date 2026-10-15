// Config centralizada del front. La URL base de la API se puede sobreescribir
// sin tocar código con el query param ?api=<url>, útil para probar contra un
// mock o un backend desplegado en otro origen. El WebSocket de la vista en
// vivo se deduce de la misma URL (mismo servidor, ruta /ws) y se puede fijar
// aparte con ?ws=<url>.
//
// Con rutas por hash (#/plantas) el query param ?api= va ANTES del hash:
//   http://localhost:5500/?api=http://localhost:9090/api/v1#/plantas
const parametrosUrl = new URLSearchParams(window.location.search);

export const API_BASE = parametrosUrl.get("api") || "http://localhost:8080/api/v1";

function deducirUrlWebSocket(apiBase) {
  const url = new URL(apiBase, window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export const WS_URL = parametrosUrl.get("ws") || deducirUrlWebSocket(API_BASE);
