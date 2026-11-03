// Reclamar un dispositivo (dueño): el dueño escribe el serial impreso en el dispositivo y el
// dispositivo, por su cuenta, demuestra al servidor que conoce su secreto (reto HMAC) y recibe
// su token. El humano nunca ve ni copia una credencial. La lista muestra si el dispositivo ya
// se conectó (ultimaCredencialEn) y se refresca desde el sondeo de planta-detalle (F18).
import { conTransicion } from "../transiciones.js";
import { vincularDispositivo, listarDispositivos, desvincularDispositivo } from "../api.js";
import { textoHace, estadoDeDispositivo } from "../tiempo.js";
import { h, svg, vaciar, campo, crearAviso, crearNota, conCarga, limpiarErroresDeFormulario, marcarCampoConError, toastConDeshacer } from "../ui.js";

function iconoDeMatera() {
  return svg("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", class: "matera-icono" },
    svg("path", { d: "M5 9h14l-1.5 11h-11z" }),
    svg("path", { d: "M4 9V7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" }),
    svg("path", { d: "M9 13h6M10 16h4" }),
  );
}

export function crearPanelDispositivos(planta, ctx) {
  const aviso = crearAviso();
  const avisoLista = crearAviso();
  const nota = crearNota();
  const lista = h("div", { id: "lista-dispositivos", "aria-live": "polite" });
  let firma = null; // lo último que se pintó: si no cambió, no se repinta
  let ultimos = []; // última lista del servidor
  const ocultos = new Set(); // seriales «desvinculados» a la espera del plazo de Deshacer (F25)

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
  const boton = h("button", { type: "submit", class: "boton boton-secundario", id: "btn-vincular-dispositivo" }, "Vincular");
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

  // Desvincular se puede deshacer: sin diálogo de confirmación, el dispositivo desaparece de la lista ya y la
  // petición sale pasado el plazo del toast (F25). Mientras tanto el sondeo no lo vuelve a pintar.
  function desvincular(dispositivo) {
    ocultos.add(dispositivo.serial);
    conTransicion(repintar);
    toastConDeshacer(`Dispositivo ${dispositivo.serial} desvinculado.`, {
      ejecutar: () => desvincularDispositivo(planta.id, dispositivo.serial),
      alDeshacer: () => {
        ocultos.delete(dispositivo.serial);
        if (ctx.vigente()) conTransicion(repintar);
      },
      // La lista pudo quedar vieja (p. ej. ya se había desvinculado): se actualiza y se explica.
      alFallar: async (error) => {
        ocultos.delete(dispositivo.serial);
        if (!ctx.vigente()) return;
        await cargar();
        avisoLista.mostrar(error);
      },
      alTerminar: async (error) => {
        if (error) return;
        ocultos.delete(dispositivo.serial);
        if (ctx.vigente()) await cargar();
      },
    });
  }

  function repintar() {
    firma = null;
    pintar(ultimos);
  }

  function pintar(todos) {
    const dispositivos = todos.filter((d) => !ocultos.has(d.serial));
    vaciar(lista);
    lista.append(
      dispositivos.length === 0
        ? h("p", { class: "texto-vacio" }, "Ninguna matera vinculada todavía.")
        : h("ul", { class: "lista-limpia" }, dispositivos.map((d) =>
            h("li", { class: "matera", "data-serial": d.serial, "data-conectada": d.ultimaCredencialEn ? "si" : "no" },
              iconoDeMatera(),
              h("div", { class: "matera-datos" },
                h("strong", {}, d.serial),
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
      ultimos = dispositivos;
      const nueva = JSON.stringify(dispositivos.filter((d) => !ocultos.has(d.serial)).map((d) => [d.serial, d.reclamadoEn, d.ultimaCredencialEn || null]));
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
    h("h2", { id: "titulo-dispositivos" }, "Tu matera"),
    h("p", { class: "texto-suave" }, "Lo que mide la matera llega solo al historial con origen «Dispositivo»."),
    avisoLista.elemento,
    lista,
    h("h3", {}, "Vincular una matera"),
    formulario,
  );
  return { elemento, cargar, refrescar: () => cargar({ silencioso: true }), actualizarTiempos };
}
