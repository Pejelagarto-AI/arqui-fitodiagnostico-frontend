// RF-F1: registrar una medición manual (solo el dueño). El POST devuelve el
// diagnóstico ya evaluado; la vista en vivo también lo empuja por WebSocket.
import { registrarMedicion } from "../api.js";
import { h, crearAviso, crearNota, conCarga, limpiarErroresDeFormulario, marcarCampoConError } from "../ui.js";
import { camposDeMedicion } from "./medicion.js";

export function crearPanelMedicion(planta, ctx, { alRegistrar, rangos }) {
  const aviso = crearAviso();
  const nota = crearNota();
  const medicion = camposDeMedicion("med");
  if (rangos) medicion.mostrarRangos(rangos);
  const boton = h("button", { type: "submit", class: "boton boton-primario", id: "btn-registrar-medicion" }, "Registrar medición");
  const formulario = h("form", { id: "formulario-medicion", novalidate: true }, medicion.nodos, aviso.elemento, nota.elemento, boton);

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErroresDeFormulario(formulario);
    aviso.limpiar();
    nota.limpiar();
    try {
      const registro = await conCarga(boton, "Registrando…", () => registrarMedicion(planta.id, medicion.valores()));
      if (!ctx.vigente()) return;
      medicion.limpiar();
      nota.mostrar("Medición registrada.");
      alRegistrar(registro);
    } catch (error) {
      if (!marcarCampoConError(formulario, error)) aviso.mostrar(error);
    }
  });

  return h("section", { class: "tarjeta", "aria-labelledby": "titulo-medicion" }, h("h2", { id: "titulo-medicion" }, "Registrar medición"), formulario);
}
