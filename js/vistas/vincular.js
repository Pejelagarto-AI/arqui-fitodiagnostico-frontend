// Vincular una matera desde su sticker (F34): el QR del dispositivo abre #/vincular?serial=fito-XXXXXX.
// Con sesión se elige la planta propia y se reclama el serial (el mismo POST que el formulario del detalle).
import { listarPlantas, vincularDispositivo } from "../api.js";
import { invalidarCache } from "../cache.js";
import { leerPlantaRecordada } from "./vincular-asistente.js";
import { codigoVisible, normalizarCodigo } from "../vinculacion.js";
import { crearLectorQr } from "../componentes/lector-qr.js";
import { h, enlaceDeVolver, campoSelect, crearAviso, conCarga, marcarCampoConError, limpiarErroresDeFormulario } from "../ui.js";

export const titulo = "Vincular matera";

export async function montar(contenedor, ctx) {
  const serial = (ctx.query.get("serial") || "").trim();
  const aviso = crearAviso();

  if (!serial) {
    // Sin código en el enlace: se puede leer el QR de la matera aquí mismo (F40) y seguir con el código leído.
    const lector = crearLectorQr({
      alLeer: (leido) => {
        setTimeout(() => ctx.irA(`/vincular?serial=${encodeURIComponent(leido.serial)}`, { reemplazar: true }), 0);
        return true;
      },
    });
    contenedor.append(
      enlaceDeVolver("/plantas", "Mis plantas"),
      h("section", { class: "tarjeta tarjeta--angosta" },
        h("h2", { "data-titulo": "" }, "Vincular matera"),
        h("p", {}, "Lee el cuadro blanco y negro (el QR) de la pantalla de tu matera."),
        lector.nodo,
        h("p", { class: "texto-suave" }, "¿No puedes leerlo? Abre tu planta, ve a «Matera» y escribe el código."),
      ),
    );
    return () => lector.destruir();
  }

  // Si el usuario venía del asistente (planta recordada en sessionStorage), el QR vincula directo a esa planta y
  // salta al paso «Conectando» del asistente, sin preguntar cuál (F36).
  const recordada = leerPlantaRecordada();
  const normal = normalizarCodigo(serial);
  if (recordada && normal.ok) {
    ctx.irA(`/plantas/${recordada}/vincular?serial=${encodeURIComponent(normal.serial)}`, { reemplazar: true });
    return;
  }

  let plantas;
  try {
    plantas = await listarPlantas();
  } catch (error) {
    if (!ctx.vigente()) return;
    aviso.mostrar(error);
    contenedor.append(h("section", { class: "tarjeta tarjeta--angosta" }, h("h2", { "data-titulo": "" }, "Vincular matera"), aviso.elemento));
    return;
  }
  if (!ctx.vigente()) return;

  const cabecera = [
    enlaceDeVolver("/plantas", "Mis plantas"),
  ];
  const titulo2 = h("h2", { "data-titulo": "" }, "Vincular matera");
  const grande = h("p", { class: "serial-grande", id: "vincular-serial", "data-serial": serial }, codigoVisible(serial));

  if (plantas.length === 0) {
    contenedor.append(...cabecera, h("section", { class: "tarjeta tarjeta--angosta" }, titulo2, grande,
      h("p", {}, "Todavía no tienes plantas a las que vincular esta matera."),
      h("a", { href: "#/plantas/nueva", class: "boton boton-primario", id: "enlace-registrar-para-vincular" }, "Registrar una planta")));
    return;
  }

  // Con una sola planta viene preseleccionada; con varias hay que elegir.
  const planta = campoSelect({
    id: "vincular-planta",
    nombre: "planta",
    etiqueta: "Planta",
    opciones: [{ valor: "", texto: "Selecciona una planta" }, ...plantas.map((p) => ({ valor: p.id, texto: `${p.apodo} (${p.especie})` }))],
    valor: plantas.length === 1 ? plantas[0].id : "",
  });
  const boton = h("button", { type: "submit", class: "boton boton-primario", id: "btn-vincular-a-planta" }, "Vincular a esta planta");
  const formulario = h("form", { id: "formulario-vincular", novalidate: true }, planta.contenedor, aviso.elemento, boton);
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErroresDeFormulario(formulario);
    aviso.limpiar();
    if (!planta.select.value) {
      planta.error("Elige la planta a la que va esta matera.");
      return;
    }
    try {
      await conCarga(boton, "Vinculando…", () => vincularDispositivo(planta.select.value, normal.ok ? normal.serial : serial));
      invalidarCache();
      ctx.irA(`/plantas/${planta.select.value}`); // ahí aparece «esperando que se conecte»
    } catch (error) {
      // 404 serial inexistente, 409 ya reclamado: el mensaje del cuerpo, por el camino de F8.
      if (!marcarCampoConError(formulario, error)) aviso.mostrar(error);
    }
  });

  contenedor.append(...cabecera, h("section", { class: "tarjeta tarjeta--angosta" }, titulo2,
    h("p", { class: "texto-suave" }, "Vas a vincular la matera con este código:"), grande, formulario));
}
