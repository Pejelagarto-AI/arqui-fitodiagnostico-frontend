// Ilustración SVG de una planta en su matera que reacciona a los datos (propuesta 3 de la auditoría UX):
// el agua de la matera sube con la humedad, el sol brilla según la luz y las hojas caen cuando el
// estado empeora. Se construye con createElementNS; no entra ningún dato como marcado.
import { svg } from "../ui.js";
import { interpolar } from "../animaciones.js";

// Cuánto se inclinan las hojas por estado (grados): saludable erguida, crítica caída.
const CAIDA = { SALUDABLE: 0, EN_RIESGO: 10, CRITICO: 22, SIN_DIAGNOSTICO: 14 };
const NIVEL_AGUA_VACIA = 230; // y del borde inferior de la matera
const NIVEL_AGUA_LLENA = 150; // y del borde superior

// Hojas: [ruta, origen x, origen y, clase de color]
const HOJAS = [
  ["M130 120c-30-2-52-22-56-50 28 2 50 22 56 50Z", 130, 120, "hoja-a"],
  ["M130 100c30-2 52-22 56-50-28 2-50 22-56 50Z", 130, 100, "hoja-b"],
  ["M130 80c-24-4-40-22-42-46 22 4 38 22 42 46Z", 130, 80, "hoja-a"],
  ["M130 68c22-6 36-24 36-46-20 6-34 24-36 46Z", 130, 68, "hoja-b"],
];

let contador = 0;

/** Estado visual de la ilustración para (estado, humedadPct, luzPct): valores finales, sin animar. */
export function estadoVisual({ estado, humedadPct = 0, luzPct = 0 }) {
  const clave = estado || "SIN_DIAGNOSTICO";
  const sinDatos = clave === "SIN_DIAGNOSTICO";
  return {
    clave,
    caida: CAIDA[clave] ?? CAIDA.SIN_DIAGNOSTICO,
    aguaY: NIVEL_AGUA_VACIA - (humedadPct / 100) * (NIVEL_AGUA_VACIA - NIVEL_AGUA_LLENA),
    solOpacidad: sinDatos ? 0.2 : 0.35 + (luzPct / 100) * 0.65,
    solEscala: sinDatos ? 0.8 : 0.8 + (luzPct / 100) * 0.4,
  };
}

/** Devuelve { nodo, refs, actualizar(datos, { animar }) }. `nodo` es el <svg>. */
export function crearIlustracionPlanta({ mini = false } = {}) {
  const idClip = `clip-agua-${++contador}`;
  const matera = "M78 150h104l-12 80H90z";
  const agua = svg("rect", { class: "ilu-agua", x: 60, y: NIVEL_AGUA_VACIA, width: 140, height: 90, "clip-path": `url(#${idClip})` });
  const hojas = HOJAS.map(([d, ox, oy, clase]) => svg("path", { class: `ilu-hoja ${clase}`, d, "data-ox": ox, "data-oy": oy }));
  const grupoHojas = svg("g", { class: "ilu-hojas" }, hojas);
  const sol = svg("g", { class: "ilu-sol" },
    svg("circle", { cx: 216, cy: 44, r: 16 }),
    svg("path", { d: "M216 18v-8M216 78v-8M190 44h-8M250 44h-8M198 26l-6-6M240 68l-6-6M198 62l-6 6M240 20l-6 6", "stroke-width": 3, "stroke-linecap": "round" }),
  );

  const nodo = svg("svg", { class: `ilustracion-planta${mini ? " ilustracion-planta--mini" : ""}`, viewBox: "0 0 260 260", "aria-hidden": "true", focusable: "false", "data-estado": "SIN_DIAGNOSTICO" },
    svg("ellipse", { class: "ilu-sombra", cx: 130, cy: 236, rx: 90, ry: 10 }),
    svg("path", { class: "ilu-matera", d: matera }),
    svg("rect", { class: "ilu-borde", x: 70, y: 140, width: 120, height: 18, rx: 6 }),
    svg("clipPath", { id: idClip }, svg("path", { d: matera })),
    agua,
    svg("path", { class: "ilu-tallo", d: "M130 150V70", "stroke-width": 5, "stroke-linecap": "round" }),
    grupoHojas,
    sol,
  );

  const refs = { agua, hojas, grupoHojas, sol };

  /** Pinta unos valores numéricos (los del cuadro actual de una animación, o los finales). */
  function pintarNumeros({ caida, aguaY, solOpacidad, solEscala }) {
    agua.setAttribute("y", aguaY.toFixed(1));
    hojas.forEach((hoja, i) => {
      const angulo = i % 2 ? caida : -caida;
      hoja.setAttribute("transform", `rotate(${angulo.toFixed(2)} ${hoja.dataset.ox} ${hoja.dataset.oy})`);
    });
    sol.setAttribute("opacity", solOpacidad.toFixed(2));
    sol.setAttribute("transform", `translate(216 44) scale(${solEscala.toFixed(2)}) translate(-216 -44)`);
  }

  let actual = null;

  /**
   * Lleva la ilustración al estado `visual`. Con `animar` y movimiento permitido el agua sube y las hojas
   * giran con GSAP; si no, el estado final se aplica directo. El color por estado cambia siempre al instante.
   */
  function aplicar(visual, { animar = false } = {}) {
    nodo.dataset.estado = visual.clave;
    const numeros = { caida: visual.caida, aguaY: visual.aguaY, solOpacidad: visual.solOpacidad, solEscala: visual.solEscala };
    const animado = animar && actual && interpolar(nodo, actual, numeros, pintarNumeros);
    if (!animado) pintarNumeros(numeros);
    actual = numeros;
  }

  aplicar(estadoVisual({ estado: null }));
  return { nodo, refs, aplicar, estadoVisual };
}
