// Reclamar un dispositivo (dueño): el dueño escribe el serial impreso en el dispositivo y el
// dispositivo, por su cuenta, demuestra al servidor que conoce su secreto (reto HMAC) y recibe
// su token. El humano nunca ve ni copia una credencial. La lista muestra si el dispositivo ya
// se conectó (ultimaCredencialEn) y se refresca desde el sondeo de planta-detalle (F18).
import { vincularDispositivo, listarDispositivos, desvincularDispositivo } from "../api.js";
import { textoHace, estadoDeDispositivo } from "../tiempo.js";
import { h, vaciar, campo, crearAviso, crearNota, conCarga, confirmar, limpiarErroresDeFormulario, marcarCampoConError, toast } from "../ui.js";

export function crearPanelDispositivos(planta, ctx) {
  const aviso = crearAviso();
  const avisoLista = crearAviso();
  const nota = crearNota();
  const lista = h("div", { id: "lista-dispositivos", "aria-live": "polite" });
  let firma = null; // lo último que se pintó: si no cambió, no se repinta

  const serial = campo({
    id: "disp-serial",
    nombre: "serial",
    etiqueta: "Serial del dispositivo",
    maxlength: "64",
    placeholder: "fito-7K2M9Q",
    autocomplete: "off",
    spellcheck: "false",
    ayuda: "El serial viene impreso en el dispositivo. Enciéndelo antes o después: se conecta solo cuando lo vincules.",
  });
  const boton = h("button", { type: "submit", class: "boton boton-primario", id: "btn-vincular-dispositivo" }, "Vincular");
  const formulario = h("form", { id: "formulario-dispositivo", novalidate: true }, serial.contenedor, aviso.elemento, nota.elemento, boton);

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErroresDeFormulario(formulario);
    aviso.limpiar();
    nota.limpiar();
    const valor = serial.input.value.trim();
    if (!valor) {
      serial.error("Escribe el serial del dispositivo.");
      return;
    }
    try {
      const vinculo = await conCarga(boton, "Vinculando…", () => vincularDispositivo(planta.id, valor));
      if (!ctx.vigente()) return;
      formulario.reset();
      nota.mostrar(`Dispositivo ${vinculo.serial} vinculado. Apenas se conecte lo verás aquí.`);
      await cargar();
    } catch (error) {
      if (!marcarCampoConError(formulario, error)) aviso.mostrar(error);
    }
  });

  async function desvincular(dispositivo) {
    if (!(await confirmar(`¿Desvincular ${dispositivo.serial}? Dejará de reportar a esta planta y no podrá renovar su credencial.`, { aceptar: "Desvincular", peligro: true }))) return;
    try {
      await desvincularDispositivo(planta.id, dispositivo.serial);
      toast("Dispositivo desvinculado.");
      await cargar();
    } catch (error) {
      // La lista pudo quedar vieja (p. ej. ya se había desvinculado): se actualiza y se explica.
      await cargar();
      avisoLista.mostrar(error);
    }
  }

  function pintar(dispositivos) {
    vaciar(lista);
    lista.append(
      dispositivos.length === 0
        ? h("p", { class: "texto-vacio" }, "Ningún dispositivo vinculado.")
        : h("ul", { class: "lista-limpia" }, dispositivos.map((d) =>
            h("li", { class: "fila fila--separada", "data-serial": d.serial },
              h("span", {},
                h("strong", {}, d.serial), " · ",
                h("span", { class: "estado-dispositivo", "data-credencial": d.ultimaCredencialEn || "" }, estadoDeDispositivo(d)),
              ),
              h("button", { type: "button", class: "boton boton-secundario boton-chico", "data-accion": "desvincular-dispositivo", onclick: () => desvincular(d) }, "Desvincular"),
            ))),
    );
  }

  /** Trae la lista y repinta solo si cambió. Con `silencioso` (sondeo) un fallo no muestra aviso. */
  async function cargar({ silencioso = false } = {}) {
    try {
      const dispositivos = await listarDispositivos(planta.id);
      if (!ctx.vigente()) return;
      avisoLista.limpiar();
      const nueva = JSON.stringify(dispositivos.map((d) => [d.serial, d.reclamadoEn, d.ultimaCredencialEn || null]));
      if (nueva === firma) return;
      firma = nueva;
      pintar(dispositivos);
    } catch (error) {
      if (ctx.vigente() && !silencioso) avisoLista.mostrar(error);
    }
  }

  /** Reloj de pantalla: actualiza «conectado hace Xs» sin pedir nada ni repintar. */
  function actualizarTiempos(ahora = Date.now()) {
    for (const nodo of lista.querySelectorAll(".estado-dispositivo[data-credencial]")) {
      const iso = nodo.dataset.credencial;
      if (iso) nodo.textContent = `conectado ${textoHace(iso, ahora)}`;
    }
  }

  const elemento = h("section", { class: "tarjeta", "aria-labelledby": "titulo-dispositivos" },
    h("h2", { id: "titulo-dispositivos" }, "Dispositivos"),
    h("p", { class: "texto-suave" }, "Escribe el serial del dispositivo para vincularlo a esta planta. Sus diagnósticos aparecen en el historial con origen «Dispositivo»."),
    formulario,
    avisoLista.elemento,
    h("h3", {}, "Dispositivos de esta planta"),
    lista,
  );
  return { elemento, cargar, refrescar: () => cargar({ silencioso: true }), actualizarTiempos };
}
