// Enlace corto del QR de la matera (F35): #/v/7K2M9Q redirige a #/vincular?serial=fito-7K2M9Q.
// Es pública a propósito: el redireccionamiento ocurre antes de la guarda de sesión, y como #/vincular exige
// sesión, el router manda a #/entrar?volver=... conservando el serial.
import { destinoDeEnlaceCorto } from "../rutas.js";
import { h, crearAviso } from "../ui.js";

export const titulo = "Vincular matera";

export async function montar(contenedor, ctx) {
  const destino = destinoDeEnlaceCorto(ctx.params.codigo);
  if (destino) {
    ctx.irA(destino, { reemplazar: true });
    return;
  }
  const aviso = crearAviso();
  aviso.mostrar("El enlace no es válido. Escanea de nuevo el QR de la matera.");
  contenedor.append(h("section", { class: "tarjeta tarjeta--angosta" }, h("h2", { "data-titulo": "" }, "Vincular matera"), aviso.elemento, h("p", {}, h("a", { href: "#/plantas" }, "Ir a mis plantas"))));
}
