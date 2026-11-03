// Minigráfica de tendencia de un parámetro: las últimas lecturas como una línea, con la banda
// óptima de fondo (propuesta 2 de la auditoría UX). SVG con createElementNS: los valores entran
// solo como números en atributos, nunca como marcado.
import { svg } from "../ui.js";
import { porcentaje, numeroLegible } from "./escala.js";

const ANCHO = 300;
const ALTO = 46;
const MARGEN = 4;

/**
 * Devuelve { nodo, linea }: `linea` es el <path> que anima js/animaciones.js con strokeDashoffset.
 * `valores` va del más viejo al más nuevo; con menos de dos no hay tendencia que dibujar.
 */
export function crearMinigrafica({ valores, rangoOptimo, etiqueta, unidad }) {
  if (valores.length < 2) return { nodo: null, linea: null };

  const [rMin, rMax] = rangoOptimo;
  const todos = [...valores, rMin, rMax];
  const limites = [Math.min(...todos), Math.max(...todos)];
  const x = (i) => MARGEN + (i * (ANCHO - 2 * MARGEN)) / (valores.length - 1);
  const y = (v) => ALTO - MARGEN - (porcentaje(v, limites) / 100) * (ALTO - 2 * MARGEN);
  const trazo = valores.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const ultimoX = x(valores.length - 1).toFixed(1);
  const ultimoY = y(valores[valores.length - 1]).toFixed(1);

  const linea = svg("path", { class: "min-linea", d: trazo, "vector-effect": "non-scaling-stroke" });
  const nodo = svg(
    "svg",
    {
      class: "minigrafica",
      viewBox: `0 0 ${ANCHO} ${ALTO}`,
      preserveAspectRatio: "none",
      role: "img",
      "aria-label": `Últimas ${valores.length} lecturas de ${etiqueta}: ${valores.map(numeroLegible).join(", ")} ${unidad}`,
    },
    svg("rect", { class: "min-banda", x: 0, y: y(rMax).toFixed(1), width: ANCHO, height: Math.max(1, y(rMin) - y(rMax)).toFixed(1) }),
    svg("path", { class: "min-area", d: `${trazo} L${ultimoX},${ALTO} L${x(0).toFixed(1)},${ALTO} Z` }),
    linea,
    // Punto de la última lectura: un tramo de largo cero con extremos redondos no se deforma con el viewBox.
    svg("path", { class: "min-punto", d: `M${ultimoX},${ultimoY} L${ultimoX},${ultimoY}`, "vector-effect": "non-scaling-stroke" }),
  );
  return { nodo, linea };
}
