// Campos de los tres rangos óptimos de una especie (RF-C3), para crear y editar.
import { h } from "../ui.js";

const MAGNITUDES = [
  { clave: "humedad", etiqueta: "Humedad", unidad: "%" },
  { clave: "luz", etiqueta: "Luz", unidad: "lux" },
  { clave: "temperatura", etiqueta: "Temperatura", unidad: "°C" },
];

export function camposDeRangos(prefijo) {
  const entradas = {};
  const filas = MAGNITUDES.map(({ clave, etiqueta, unidad }) => {
    const min = h("input", { type: "number", step: "any", required: true, id: `${prefijo}-${clave}-min`, "aria-label": `${etiqueta} mínimo (${unidad})` });
    const max = h("input", { type: "number", step: "any", required: true, id: `${prefijo}-${clave}-max`, "aria-label": `${etiqueta} máximo (${unidad})` });
    entradas[clave] = { min, max };
    return h("div", { class: "fila-rango" }, h("span", { class: "etiqueta-rango" }, `${etiqueta} (${unidad})`), min, h("span", {}, "a"), max);
  });
  return {
    nodo: h("fieldset", { class: "rangos" }, h("legend", {}, "Rangos óptimos (mínimo y máximo)"), filas),
    valores() {
      const salida = {};
      for (const { clave } of MAGNITUDES) {
        salida[clave] = { min: parseFloat(entradas[clave].min.value), max: parseFloat(entradas[clave].max.value) };
      }
      return salida;
    },
    poner(rangos) {
      for (const { clave } of MAGNITUDES) {
        entradas[clave].min.value = rangos ? rangos[clave].min : "";
        entradas[clave].max.value = rangos ? rangos[clave].max : "";
      }
    },
  };
}
