// Fábrica de dispositivos (admin): registrar un dispositivo (serial + secreto, que se entrega
// UNA vez, como el enlace de invitación en F14) y ver cuáles están sin reclamar o reclamados.
import { registrarDispositivoDeFabrica, listarDispositivosDeFabrica } from "../api.js";
import { estadoDeDispositivo } from "../tiempo.js";
import { crearQr, urlDeVinculacion } from "../componentes/qr.js";
import { h, enlaceDeVolver, vaciar, campo, crearAviso, crearNota, conCarga, copiarAlPortapapeles, formatearFecha, limpiarErroresDeFormulario, marcarCampoConError } from "../ui.js";

export const titulo = "Dispositivos de fábrica";

/** El comando listo para arrancar el simulador con este dispositivo. */
export function comandoDelSimulador(serial, secreto) {
  return `FITO_SERIAL=${serial} FITO_SECRETO=${secreto} python3 simulador/simulador_esp32.py --especie potos`;
}

export async function montar(contenedor, ctx) {
  const avisoLista = crearAviso();
  const avisoForm = crearAviso();
  const lista = h("div", { id: "lista-dispositivos-fabrica" });
  const resultado = h("div", { id: "dispositivo-registrado", "aria-live": "polite" });

  const serial = campo({
    id: "fab-serial",
    nombre: "serial",
    etiqueta: "Serial (opcional)",
    requerido: false,
    maxlength: "64",
    placeholder: "fito-7K2M9Q",
    autocomplete: "off",
    spellcheck: "false",
    ayuda: "Si lo dejas vacío el servidor genera uno (fito- y 6 caracteres).",
  });
  const boton = h("button", { type: "submit", class: "boton boton-primario", id: "btn-registrar-dispositivo" }, "Registrar dispositivo");
  const formulario = h("form", { id: "formulario-fabrica", novalidate: true }, serial.contenedor, avisoForm.elemento, boton);

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErroresDeFormulario(formulario);
    avisoForm.limpiar();
    try {
      const creado = await conCarga(boton, "Registrando…", () => registrarDispositivoDeFabrica(serial.input.value.trim()));
      if (!ctx.vigente()) return;
      formulario.reset();
      pintarSticker(creado);
      pintarQr(creado);
      await cargar();
    } catch (error) {
      if (!marcarCampoConError(formulario, error)) avisoForm.mostrar(error);
    }
  });

  /** Una fila «valor + Copiar» con su propio aviso de copiado. */
  function filaCopiable({ etiqueta, valor, idValor, idBoton }) {
    const entrada = h("input", { type: "text", readonly: true, id: idValor, "aria-label": etiqueta });
    entrada.value = valor;
    const nota = crearNota();
    const copiar = h("button", { type: "button", class: "boton boton-secundario", id: idBoton }, "Copiar");
    copiar.addEventListener("click", async () => {
      if (await copiarAlPortapapeles(valor)) nota.mostrar(`${etiqueta}: copiado.`);
      else {
        entrada.select();
        nota.mostrar("No se pudo copiar solo: quedó seleccionado, cópialo con Ctrl+C.");
      }
    });
    return h("div", {}, h("p", {}, h("strong", {}, etiqueta)), h("div", { class: "enlace-copiable" }, entrada, copiar), nota.elemento);
  }

  function pintarSticker(creado) {
    vaciar(resultado);
    resultado.append(
      h("h3", {}, `Dispositivo ${creado.serial} registrado`),
      filaCopiable({ etiqueta: "Serial", valor: creado.serial, idValor: "valor-serial", idBoton: "btn-copiar-serial" }),
      filaCopiable({ etiqueta: "Secreto", valor: creado.secreto, idValor: "valor-secreto", idBoton: "btn-copiar-secreto" }),
      filaCopiable({ etiqueta: "Comando del simulador", valor: comandoDelSimulador(creado.serial, creado.secreto), idValor: "valor-comando", idBoton: "btn-copiar-comando" }),
      h("div", { class: "sticker-qr", id: "sticker-qr" }, h("p", { class: "texto-suave" }, "Sticker del dispositivo: quien lo escanee llega a vincularlo a su planta.")),
      h("p", { class: "texto-suave" }, "El secreto se muestra una sola vez: cópialo ahora (el servidor no lo vuelve a entregar). El serial va impreso en el dispositivo; el secreto, grabado adentro."),
    );
  }

  /** Dibuja el QR del sticker (URL absoluta de #/vincular), el serial en texto y el botón de imprimir. */
  async function pintarQr(creado) {
    const zona = resultado.querySelector("#sticker-qr");
    try {
      const url = urlDeVinculacion(creado.serial, window.location.origin, window.location.pathname);
      const dibujo = await crearQr(url, { etiqueta: `QR para vincular el dispositivo ${creado.serial}` });
      if (!ctx.vigente() || !zona.isConnected) return;
      zona.append(
        h("div", { class: "sticker-hoja" }, dibujo, h("p", { class: "sticker-serial", id: "sticker-serial" }, creado.serial)),
        h("button", { type: "button", class: "boton boton-secundario", id: "btn-imprimir-sticker", onclick: () => window.print() }, "Imprimir sticker"),
      );
    } catch (error) {
      zona.append(h("p", { class: "banner-error", role: "alert" }, error.message));
    }
  }

  async function cargar() {
    try {
      const dispositivos = await listarDispositivosDeFabrica();
      if (!ctx.vigente()) return;
      avisoLista.limpiar();
      vaciar(lista);
      if (dispositivos.length === 0) {
        lista.append(h("p", { class: "texto-vacio" }, "Todavía no hay dispositivos registrados."));
        return;
      }
      lista.append(
        h("div", { class: "tabla-scroll" },
          h("table", { class: "tabla-parametros", id: "tabla-dispositivos" },
            h("thead", {}, h("tr", {}, ["Serial", "Estado", "Planta", "Conexión", "Registrado"].map((t) => h("th", { scope: "col" }, t)))),
            h("tbody", {}, dispositivos.map((d) =>
              h("tr", { "data-serial": d.serial },
                h("td", {}, h("code", {}, d.serial)),
                h("td", {}, h("span", { class: `chip chip--${d.estado === "RECLAMADO" ? "optimo" : "bajo"}` }, d.estado === "RECLAMADO" ? "Reclamado" : "Sin reclamar")),
                h("td", {}, d.plantaId ? h("code", {}, d.plantaId) : "—"),
                h("td", {}, d.estado === "RECLAMADO" ? estadoDeDispositivo(d) : "—"),
                h("td", {}, formatearFecha(d.creadoEn)),
              ))),
          ),
        ),
        h("p", { class: "texto-suave" }, `${dispositivos.length} dispositivo${dispositivos.length === 1 ? "" : "s"}`),
      );
    } catch (error) {
      if (ctx.vigente()) avisoLista.mostrar(error);
    }
  }

  contenedor.append(
    enlaceDeVolver("/admin", "Administración"),
    h("section", { class: "tarjeta tarjeta--ancha" }, h("h2", { "data-titulo": "" }, "Dispositivos de fábrica"), avisoLista.elemento, lista),
    h("section", { class: "tarjeta tarjeta--ancha" }, h("h2", {}, "Registrar dispositivo"), formulario, resultado),
  );
  await cargar();
}
