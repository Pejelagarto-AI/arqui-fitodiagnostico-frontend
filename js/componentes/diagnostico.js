// Pinta un diagnóstico (estado global, tabla por parámetro y recomendaciones).
// Lo usan el formulario suelto y el detalle de una planta: mismo contrato de
// diagnóstico, misma presentación.
import {
  h,
  vaciar,
  ETIQUETAS_ESTADO_GLOBAL,
  ETIQUETAS_ESTADO_PARAMETRO,
  ETIQUETAS_PARAMETRO,
} from "../ui.js";

function chipDeParametro(estado) {
  return h("span", { class: `chip chip--${estado.toLowerCase()}` }, ETIQUETAS_ESTADO_PARAMETRO[estado] || estado);
}

export function estadoGlobalNodo(estado) {
  return h(
    "p",
    { class: `estado-global ${estado.toLowerCase()}` },
    ETIQUETAS_ESTADO_GLOBAL[estado] || estado,
  );
}

/** Devuelve el nodo con el diagnóstico completo. */
export function nodoDeDiagnostico(diagnostico) {
  const filas = diagnostico.parametros.map((parametro) => {
    const [min, max] = parametro.rangoOptimo;
    return h(
      "tr",
      {},
      h("td", {}, ETIQUETAS_PARAMETRO[parametro.nombre] || parametro.nombre),
      h("td", {}, `${parametro.valor} ${parametro.unidad}`),
      h("td", {}, `${min}–${max} ${parametro.unidad}`),
      h("td", {}, chipDeParametro(parametro.estado)),
    );
  });

  const recomendaciones =
    diagnostico.recomendaciones && diagnostico.recomendaciones.length > 0
      ? diagnostico.recomendaciones.map((texto) => h("li", {}, texto))
      : [h("li", {}, "Sin recomendaciones: todos los parámetros están en rango.")];

  return h(
    "div",
    {},
    estadoGlobalNodo(diagnostico.estado),
    h(
      "div",
      { class: "tabla-scroll" },
      h(
        "table",
        { class: "tabla-parametros" },
        h(
          "thead",
          {},
          h(
            "tr",
            {},
            h("th", { scope: "col" }, "Parámetro"),
            h("th", { scope: "col" }, "Valor"),
            h("th", { scope: "col" }, "Rango óptimo"),
            h("th", { scope: "col" }, "Estado"),
          ),
        ),
        h("tbody", {}, filas),
      ),
    ),
    h("h3", {}, "Recomendaciones"),
    h("ul", { class: "lista-recomendaciones" }, recomendaciones),
  );
}

export function pintarDiagnostico(contenedor, diagnostico) {
  vaciar(contenedor);
  contenedor.append(nodoDeDiagnostico(diagnostico));
}
