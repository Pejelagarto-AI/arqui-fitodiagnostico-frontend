// Config centralizada del front. La URL base de la API se puede sobreescribir
// sin tocar código con el query param ?api=<url>, útil para probar contra un
// mock o un backend desplegado en otro origen. El WebSocket de la vista en
// vivo se deduce de la misma URL (mismo servidor, ruta /ws) y se puede fijar
// aparte con ?ws=<url>.
//
// Sin ?api=, la API se busca en el mismo host que sirve el front, puerto 8080 (F35): así el celular que
// abre http://<ip-del-portátil>:5500 le habla al portátil y no a su propio localhost.
// Si la página llega por HTTPS, la API es del mismo origen (`https://host/api/v1`) y el WebSocket `wss://host/ws`
// (F40): lo resuelve el proxy que sirve el front. `?api=` sigue teniendo prioridad en los dos casos.
//
// Con rutas por hash (#/plantas) el query param ?api= va ANTES del hash:
//   http://localhost:5500/?api=http://localhost:9090/api/v1#/plantas
import { apiPorDefecto } from "./url-api.js";

const parametrosUrl = new URLSearchParams(window.location.search);

export const API_BASE = parametrosUrl.get("api") || apiPorDefecto(window.location);

function deducirUrlWebSocket(apiBase) {
  const url = new URL(apiBase, window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export const WS_URL = parametrosUrl.get("ws") || deducirUrlWebSocket(API_BASE);
