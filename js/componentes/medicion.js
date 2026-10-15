// Campos de una medición (humedad, luz, temperatura) con su rango óptimo,
// compartidos por el formulario suelto y el de registrar medición en planta.
// No se validan rangos físicos en el cliente: el backend es la autoridad.
import { h, campo } from "../ui.js";

export function camposDeMedicion(prefijo) {
  const humedad = campo({ id: `${prefijo}-humedad`, nombre: "humedad", etiqueta: "Humedad del sustrato (%)", tipo: "number", step: "any" });
  const luz = campo({ id: `${prefijo}-luz`, nombre: "luz", etiqueta: "Luz (lux)", tipo: "number", step: "any" });
  const temperatura = campo({ id: `${prefijo}-temperatura`, nombre: "temperatura", etiqueta: "Temperatura (°C)", tipo: "number", step: "any" });
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
    // Muestra "Óptimo: min–max unidad" bajo cada campo.
    mostrarRangos(rangos) {
      for (const [clave, c] of [["humedad", humedad], ["luz", luz], ["temperatura", temperatura]]) {
        const id = `${c.input.id}-rango`;
        let nodo = c.contenedor.querySelector(`#${id}`);
        if (!nodo) {
          nodo = h("p", { class: "rango-optimo", id });
          c.contenedor.insertBefore(nodo, c.contenedor.lastElementChild);
        }
        const rango = rangos && rangos[clave];
        nodo.textContent = rango ? `Óptimo: ${rango.min}–${rango.max} ${rango.unidad}` : "";
      }
    },
  };
}
