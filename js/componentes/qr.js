// QR del sticker de un dispositivo (F34). La librería (js/vendor/qrcode.js, qrcode-generator) solo entrega la
// matriz de módulos; el SVG se construye aquí con createElementNS (nunca con innerHTML ni con la salida HTML de
// la librería). `rutaDeModulos` y `urlDeVinculacion` son puras y se prueban con Node.
import { svg } from "../ui.js";

const ZONA_QUIETA = 4; // módulos blancos alrededor, lo que pide la especificación del QR

/** URL absoluta que codifica el sticker: abre la pantalla de vincular con el serial ya puesto. */
export function urlDeVinculacion(serial, origen, rutaDeLaPagina) {
  return `${origen}${rutaDeLaPagina}#/vincular?serial=${encodeURIComponent(serial)}`;
}

/** Trazo único con un cuadrado de 1x1 por módulo oscuro: "M x y h1 v1 h-1z". `esOscuro(fila, columna)`. */
export function rutaDeModulos(esOscuro, cuenta) {
  const partes = [];
  for (let fila = 0; fila < cuenta; fila += 1) {
    for (let columna = 0; columna < cuenta; columna += 1) {
      if (esOscuro(fila, columna)) partes.push(`M${columna + ZONA_QUIETA} ${fila + ZONA_QUIETA}h1v1h-1z`);
    }
  }
  return partes.join("");
}

let cargaDeLaLibreria = null;

/** Carga js/vendor/qrcode.js una sola vez (script clásico del mismo origen: la CSP lo admite). */
function cargarLibreria() {
  if (globalThis.qrcode) return Promise.resolve(globalThis.qrcode);
  if (!cargaDeLaLibreria) {
    cargaDeLaLibreria = new Promise((resolver, rechazar) => {
      const script = document.createElement("script");
      script.src = new URL("../vendor/qrcode.js", import.meta.url).href;
      script.onload = () => resolver(globalThis.qrcode);
      script.onerror = () => {
        cargaDeLaLibreria = null;
        rechazar(new Error("No se pudo cargar el generador de QR."));
      };
      document.head.append(script);
    });
  }
  return cargaDeLaLibreria;
}

/** SVG del QR de `texto`. Fondo blanco y módulos negros fijos: tiene que leerse igual en tema oscuro y al imprimir. */
export async function crearQr(texto, { etiqueta = "Código QR" } = {}) {
  const qrcode = await cargarLibreria();
  const qr = qrcode(0, "M"); // tipo 0: la librería elige el tamaño mínimo
  qr.addData(texto);
  qr.make();
  const cuenta = qr.getModuleCount();
  const lado = cuenta + ZONA_QUIETA * 2;
  return svg("svg", { viewBox: `0 0 ${lado} ${lado}`, class: "qr", role: "img", "aria-label": etiqueta, "shape-rendering": "crispEdges" },
    svg("rect", { width: lado, height: lado, fill: "#ffffff" }),
    svg("path", { d: rutaDeModulos((f, c) => qr.isDark(f, c), cuenta), fill: "#000000" }),
  );
}
