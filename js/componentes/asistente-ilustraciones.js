// Ilustraciones SVG del asistente de vinculación (F36). Todas se construyen con svg() (createElementNS);
// los colores salen de clases del CSS (tokens), nunca de estilos en línea, así que siguen el tema claro y oscuro.
import { svg } from "../ui.js";
import { crearIlustracionPlanta } from "./ilustracion-planta.js";

const MATERA = "M78 120h104l-12 70H90z";

/** Paso 1: una matera con su pantallita encendida (QR y código) y el Wi-Fi. */
export function ilustracionEnciende() {
  const modulos = [];
  // Un «QR» de adorno (7x7) hecho con cuadritos; no codifica nada.
  const patron = ["1110111", "1010101", "1110111", "0001000", "1101011", "0110100", "1011101"];
  patron.forEach((fila, y) => [...fila].forEach((c, x) => {
    if (c === "1") modulos.push(svg("rect", { class: "asis-qr-modulo", x: 98 + x * 5, y: 134 + y * 5, width: 5, height: 5 }));
  }));
  return svg("svg", { class: "asis-ilustracion", viewBox: "0 0 260 220", "aria-hidden": "true", focusable: "false" },
    svg("ellipse", { class: "ilu-sombra", cx: 130, cy: 204, rx: 90, ry: 9 }),
    svg("path", { class: "ilu-matera", d: MATERA }),
    svg("rect", { class: "ilu-borde", x: 70, y: 110, width: 120, height: 18, rx: 6 }),
    svg("path", { class: "ilu-tallo", d: "M130 110V60", "stroke-width": 5, "stroke-linecap": "round", fill: "none" }),
    svg("path", { class: "ilu-hoja hoja-a", d: "M130 80c-22-2-38-16-40-36 20 2 36 16 40 36Z" }),
    svg("path", { class: "ilu-hoja hoja-b", d: "M130 66c20-2 34-16 36-34-18 2-32 16-36 34Z" }),
    svg("rect", { class: "asis-pantalla", x: 90, y: 130, width: 80, height: 48, rx: 6 }),
    ...modulos,
    svg("rect", { class: "asis-codigo-linea", x: 140, y: 140, width: 22, height: 5, rx: 2 }),
    svg("rect", { class: "asis-codigo-linea", x: 140, y: 150, width: 22, height: 5, rx: 2 }),
    svg("rect", { class: "asis-codigo-linea", x: 140, y: 160, width: 14, height: 5, rx: 2 }),
    svg("g", { class: "asis-wifi", fill: "none", "stroke-width": 4, "stroke-linecap": "round" },
      svg("path", { d: "M196 52a40 40 0 0 1 56 0" }),
      svg("path", { d: "M205 63a26 26 0 0 1 38 0" }),
      svg("circle", { cx: 224, cy: 76, r: 3, class: "asis-wifi-punto" }),
    ),
  );
}

/** Paso 2: radar. Devuelve el nodo y las piezas que anima `radar()`. */
export function ilustracionRadar() {
  const ondas = [0, 1, 2].map(() => svg("circle", { class: "asis-onda", cx: 130, cy: 130, r: 110 }));
  const barrido = svg("g", { class: "asis-barrido" },
    svg("path", { class: "asis-barrido-sector", d: "M130 130L130 20A110 110 0 0 1 207.8 52.2Z" }),
    svg("path", { class: "asis-barrido-linea", d: "M130 130L130 20", "stroke-width": 3, "stroke-linecap": "round" }),
  );
  const nodo = svg("svg", { class: "asis-ilustracion asis-radar", viewBox: "0 0 260 260", "aria-hidden": "true", focusable: "false" },
    svg("circle", { class: "asis-anillo-fijo", cx: 130, cy: 130, r: 110 }),
    svg("circle", { class: "asis-anillo-fijo", cx: 130, cy: 130, r: 75 }),
    svg("circle", { class: "asis-anillo-fijo", cx: 130, cy: 130, r: 40 }),
    ...ondas,
    barrido,
    svg("circle", { class: "asis-radar-centro", cx: 130, cy: 130, r: 26 }),
    svg("path", { class: "asis-radar-matera", d: "M119 124h22l-2.5 17h-17z" }),
    svg("path", { class: "asis-radar-hoja", d: "M130 124v-9M130 118c-5 0-8-3-8-7 5 0 8 3 8 7ZM130 116c0-4 3-7 8-7 0 4-3 7-8 7Z", "stroke-width": 2.2, "stroke-linecap": "round", "stroke-linejoin": "round" }),
  );
  return { nodo, ondas, barrido };
}

/** Paso 3, opción QR: un celular apuntando a la pantallita. */
export function ilustracionQr() {
  return svg("svg", { class: "asis-ilustracion asis-ilustracion--chica", viewBox: "0 0 200 140", "aria-hidden": "true", focusable: "false" },
    svg("rect", { class: "asis-pantalla", x: 14, y: 40, width: 76, height: 56, rx: 8 }),
    svg("rect", { class: "asis-qr-modulo", x: 28, y: 52, width: 14, height: 14 }),
    svg("rect", { class: "asis-qr-modulo", x: 46, y: 52, width: 8, height: 8 }),
    svg("rect", { class: "asis-qr-modulo", x: 28, y: 70, width: 8, height: 8 }),
    svg("rect", { class: "asis-qr-modulo", x: 40, y: 72, width: 14, height: 14 }),
    svg("rect", { class: "asis-codigo-linea", x: 60, y: 52, width: 22, height: 6, rx: 3 }),
    svg("rect", { class: "asis-codigo-linea", x: 60, y: 64, width: 22, height: 6, rx: 3 }),
    svg("g", { class: "asis-celular" },
      svg("rect", { class: "asis-celular-cuerpo", x: 124, y: 14, width: 52, height: 104, rx: 10 }),
      svg("rect", { class: "asis-celular-pantalla", x: 130, y: 26, width: 40, height: 78, rx: 4 }),
      svg("path", { class: "asis-visor", d: "M138 44v-6h6M162 38h6v6M168 86v6h-6M144 92h-6v-6", fill: "none", "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round" }),
    ),
    svg("path", { class: "asis-haz", d: "M124 66L96 66", "stroke-width": 3, "stroke-dasharray": "5 5", "stroke-linecap": "round" }),
  );
}

/** Paso 4: un anillo con un arco que gira y una matera al centro. */
export function anilloDeEspera() {
  const arco = svg("circle", { class: "asis-espera-arco", cx: 50, cy: 50, r: 42, "stroke-width": 7, "stroke-linecap": "round", "stroke-dasharray": "70 200", fill: "none" });
  const nodo = svg("svg", { class: "asis-ilustracion asis-espera", viewBox: "0 0 100 100", "aria-hidden": "true", focusable: "false" },
    svg("circle", { class: "asis-espera-pista", cx: 50, cy: 50, r: 42, "stroke-width": 7, fill: "none" }),
    arco,
    svg("path", { class: "ilu-matera", d: "M36 46h28l-3.5 22H39.5z" }),
    svg("path", { class: "ilu-tallo", d: "M50 46V34", "stroke-width": 3, "stroke-linecap": "round", fill: "none" }),
    svg("path", { class: "ilu-hoja hoja-a", d: "M50 38c-6 0-10-4-10-9 6 0 10 4 10 9Z" }),
    svg("path", { class: "ilu-hoja hoja-b", d: "M50 34c0-5 4-9 10-9 0 5-4 9-10 9Z" }),
  );
  return { nodo, arco };
}

/**
 * Paso 5: la plantica de la planta (la misma ilustración del detalle, sana) dentro de un aro, con la insignia
 * del chulo. `exito()` de animaciones.js la hace crecer. `carnivora` elige la planta carnívora.
 */
export function escenaDeExito({ carnivora = false } = {}) {
  const ilustracion = crearIlustracionPlanta({ carnivora });
  ilustracion.aplicar(ilustracion.estadoVisual({ estado: "SALUDABLE", humedadPct: 60, luzPct: 70 }));
  const aro = svg("circle", { class: "asis-exito-aro", cx: 130, cy: 130, r: 122 });
  const chulo = svg("path", { class: "asis-chulo", d: "M212 40l8 8 14-17", fill: "none", "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round" });
  const insignia = svg("g", { class: "asis-insignia" }, svg("circle", { class: "asis-insignia-fondo", cx: 224, cy: 40, r: 22 }), chulo);
  const nodo = ilustracion.nodo;
  nodo.classList.add("asis-exito-escena");
  nodo.insertBefore(aro, nodo.firstChild);
  nodo.append(insignia);
  return { nodo, aro, insignia, chulo, planta: ilustracion.refs.grupoPlanta, hojas: ilustracion.refs.hojas, ilustracion };
}

/** Iconos de la lista de ayuda («No encontramos tu matera»): trazo simple, color del texto. */
export function iconoDeAyuda(tipo) {
  const dibujos = {
    corriente: [svg("path", { d: "M9 3v5M15 3v5M7 8h10v4a5 5 0 0 1-10 0zM12 17v4" })],
    pantalla: [svg("rect", { x: 4, y: 5, width: 16, height: 11, rx: 2 }), svg("path", { d: "M9 20h6M12 16v4M8 9h4M8 12h8" })],
    wifi: [svg("path", { d: "M3 9a13 13 0 0 1 18 0M6 12.5a8.5 8.5 0 0 1 12 0M9 16a4 4 0 0 1 6 0" }), svg("circle", { cx: 12, cy: 19, r: 0.8 })],
    reinicio: [svg("path", { d: "M12 3v8" }), svg("path", { d: "M7.5 6.5a8 8 0 1 0 9 0" })],
    candado: [svg("rect", { x: 5, y: 11, width: 14, height: 9, rx: 2 }), svg("path", { d: "M8 11V8a4 4 0 0 1 8 0v3" })],
  };
  return svg("svg", { class: "asis-ayuda-icono", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" }, ...(dibujos[tipo] || []));
}
