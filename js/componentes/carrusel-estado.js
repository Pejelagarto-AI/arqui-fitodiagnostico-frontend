// Lógica pura del carrusel de especies (F42): qué tarjetas hay, qué dice cada una y a cuál se va con cada tecla
// o al soltar el dedo. Sin DOM: se prueba con Node. El DOM está en carrusel-especies.js.
import { familiaDe } from "./especie.js";

const MAGNITUDES = [
  ["humedad", "Humedad", "%"],
  ["luz", "Luz", "lux"],
  ["temperatura", "", "°C"],
];

function numero(v) {
  return Number(v).toLocaleString("es-CO", { maximumFractionDigits: 1 });
}

/** «Humedad 40–70 % · Luz 1.000–10.000 lux · 18–27 °C». Sin rangos (especie descontinuada), cadena vacía. */
export function resumenDeRangos(rangos) {
  if (!rangos) return "";
  return MAGNITUDES.filter(([clave]) => rangos[clave])
    .map(([clave, etiqueta, unidad]) => `${etiqueta ? `${etiqueta} ` : ""}${numero(rangos[clave].min)}–${numero(rangos[clave].max)} ${unidad}`)
    .join(" · ");
}

/**
 * Una tarjeta por especie, en el orden de la API (RF5: nunca una lista escrita a mano). Si `actual` (la especie
 * de una planta que se edita) ya no está en el catálogo activo, va primero, marcada como descontinuada.
 */
export function opcionesDeEspecies(especies, { actual = "" } = {}) {
  const opciones = (especies || []).map((e) => ({ valor: e.nombre, nombre: e.nombre, familia: familiaDe(e.nombre), resumen: resumenDeRangos(e.rangos), rangos: e.rangos || null, descontinuada: false }));
  if (actual && !opciones.some((o) => o.valor === actual)) {
    opciones.unshift({ valor: actual, nombre: actual, familia: familiaDe(actual), resumen: "", rangos: null, descontinuada: true });
  }
  return opciones;
}

/** Pide las especies a la API (`obtener` es `obtenerEspecies` de api.js) y arma las tarjetas. */
export async function cargarOpciones(obtener, { actual = "" } = {}) {
  const especies = await obtener();
  return opcionesDeEspecies(especies, { actual });
}

/**
 * Índice al que lleva una tecla en el grupo de radios, o null si la tecla no es del carrusel. Las flechas no dan
 * la vuelta (es una fila con principio y fin, y las flechas de pantalla se apagan en los extremos). Sin selección
 * (`indice` -1), la flecha derecha va a la primera y la izquierda también.
 */
export function indiceTrasTecla(indice, tecla, total) {
  if (total <= 0) return null;
  const ultimo = total - 1;
  switch (tecla) {
    case "ArrowRight":
    case "ArrowDown":
      return indice < 0 ? 0 : Math.min(ultimo, indice + 1);
    case "ArrowLeft":
    case "ArrowUp":
      return indice < 0 ? 0 : Math.max(0, indice - 1);
    case "Home":
      return 0;
    case "End":
      return ultimo;
    default:
      return null;
  }
}

/** La tarjeta cuyo centro queda más cerca del centro de la vista (al soltar el dedo o terminar el desplazamiento). */
export function indiceMasCercano(centros, centroVista) {
  let mejor = -1;
  let distancia = Infinity;
  centros.forEach((c, i) => {
    const d = Math.abs(c - centroVista);
    if (d < distancia) {
      distancia = d;
      mejor = i;
    }
  });
  return mejor;
}

/** scrollLeft que deja centrada una tarjeta (con su inicio y ancho dentro de la pista), sin pasarse de los bordes. */
export function desplazamientoParaCentrar(inicio, ancho, anchoVista, maximo = Infinity) {
  const x = inicio + ancho / 2 - anchoVista / 2;
  return Math.max(0, Math.min(maximo, Math.round(x)));
}
