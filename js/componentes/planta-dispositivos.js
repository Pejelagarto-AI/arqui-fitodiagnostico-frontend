// Vincular un dispositivo (dueño): el backend genera un token para que el
// dispositivo (o el simulador) envíe mediciones a esta planta. El token se
// muestra UNA sola vez, en la respuesta del POST: aquí no se guarda ni se vuelve
// a pedir. Al volver a vincular el mismo dispositivo se genera uno nuevo.
import { vincularDispositivo } from "../api.js";
import { h, vaciar, campo, crearAviso, crearNota, conCarga, copiarAlPortapapeles, formatearFecha, limpiarErroresDeFormulario, marcarCampoConError } from "../ui.js";

export function crearPanelDispositivos(planta, ctx) {
  const aviso = crearAviso();
  const resultado = h("div", { id: "token-generado", "aria-live": "polite" });

  const dispositivo = campo({
    id: "disp-id",
    nombre: "dispositivoId",
    etiqueta: "Identificador del dispositivo",
    maxlength: "64",
    placeholder: "esp32-01",
    ayuda: "El nombre con el que el dispositivo se identifica, por ejemplo esp32-01.",
  });
  const boton = h("button", { type: "submit", class: "boton boton-primario", id: "btn-vincular-dispositivo" }, "Generar token");
  const formulario = h("form", { id: "formulario-dispositivo", novalidate: true }, dispositivo.contenedor, aviso.elemento, boton);

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErroresDeFormulario(formulario);
    aviso.limpiar();
    const id = dispositivo.input.value.trim();
    if (!id) {
      dispositivo.error("Escribe el identificador del dispositivo.");
      return;
    }
    try {
      const vinculo = await conCarga(boton, "Generando…", () => vincularDispositivo(planta.id, id));
      if (!ctx.vigente()) return;
      formulario.reset();
      pintarToken(vinculo);
    } catch (error) {
      if (!marcarCampoConError(formulario, error)) aviso.mostrar(error);
    }
  });

  function pintarToken(vinculo) {
    vaciar(resultado);
    const campoToken = h("input", { type: "text", readonly: true, id: "valor-token", "aria-label": "Token del dispositivo" });
    campoToken.value = vinculo.token;
    const nota = crearNota();
    const botonCopiar = h("button", { type: "button", class: "boton boton-secundario", id: "btn-copiar-token" }, "Copiar");
    botonCopiar.addEventListener("click", async () => {
      if (await copiarAlPortapapeles(vinculo.token)) nota.mostrar("Token copiado.");
      else {
        campoToken.select();
        nota.mostrar("No se pudo copiar solo: el token quedó seleccionado, cópialo con Ctrl+C.");
      }
    });
    resultado.append(
      h("p", {}, h("strong", {}, `Token para ${vinculo.dispositivoId}`)),
      h("div", { class: "enlace-copiable" }, campoToken, botonCopiar),
      nota.elemento,
      h("p", { class: "texto-suave" },
        "Se muestra una sola vez: cópialo ahora. El simulador lo necesita en la variable de entorno ",
        h("code", {}, "FITO_TOKEN_DISPOSITIVO"),
        `. Vence ${formatearFecha(vinculo.expira)}.`,
      ),
    );
  }

  return h("section", { class: "tarjeta", "aria-labelledby": "titulo-dispositivos" },
    h("h2", { id: "titulo-dispositivos" }, "Vincular dispositivo"),
    h("p", { class: "texto-suave" }, "Genera el token con el que un dispositivo envía mediciones a esta planta. Sus diagnósticos aparecen en el historial con origen «Dispositivo»."),
    formulario,
    resultado,
  );
}
