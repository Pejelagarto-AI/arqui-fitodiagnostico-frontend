// Campos de una medición (humedad, luz, temperatura), compartidos por el diagnóstico sin cuenta y por «Medir
// a mano» en una planta. Cada campo explica qué es en una línea (js/voz-planta.js) y, cuando se conoce la
// planta, muestra su rango ideal. Teclado numérico en el celular (inputmode="decimal").
// No se validan rangos físicos en el cliente: el backend es la autoridad.
import { h, campo } from "../ui.js";
import { AYUDA_DE_MAGNITUD, textoDeRangoIdeal } from "../voz-planta.js";

export function camposDeMedicion(prefijo) {
  const numerico = { tipo: "number", step: "any", inputmode: "decimal", autocomplete: "off" };
  const humedad = campo({ id: `${prefijo}-humedad`, nombre: "humedad", etiqueta: "Humedad de la tierra (%)", ayuda: AYUDA_DE_MAGNITUD.humedad, ...numerico });
  const luz = campo({ id: `${prefijo}-luz`, nombre: "luz", etiqueta: "Luz (lux)", ayuda: AYUDA_DE_MAGNITUD.luz, ...numerico });
  const temperatura = campo({ id: `${prefijo}-temperatura`, nombre: "temperatura", etiqueta: "Temperatura (°C)", ayuda: AYUDA_DE_MAGNITUD.temperatura, ...numerico });
  const campos = [["humedad", humedad], ["luz", luz], ["temperatura", temperatura]];
  return {
    nodos: [humedad.contenedor, luz.contenedor, temperatura.contenedor],
    valores: () => ({
      humedad: parseFloat(humedad.input.value),
      luz: parseFloat(luz.input.value),
      temperatura: parseFloat(temperatura.input.value),
    }),
    limpiar() {
      humedad.input.value = "";
      luz.input.value = "";
      temperatura.input.value = "";
    },
    // Muestra «Para un potos lo ideal es de 40 a 70 %.» bajo cada campo (sin especie: «Para esta planta…»).
    mostrarRangos(rangos, especie = "") {
      for (const [clave, c] of campos) {
        const id = `${c.input.id}-rango`;
        let nodo = c.contenedor.querySelector(`#${id}`);
        if (!nodo) {
          nodo = h("p", { class: "rango-ideal", id });
          c.contenedor.insertBefore(nodo, c.contenedor.lastElementChild);
          c.input.setAttribute("aria-describedby", `${c.input.getAttribute("aria-describedby")} ${id}`);
        }
        nodo.textContent = textoDeRangoIdeal(rangos && rangos[clave], especie);
      }
    },
  };
}
