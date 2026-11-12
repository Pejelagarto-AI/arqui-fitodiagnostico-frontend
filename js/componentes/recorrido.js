// Recorrido guiado (F39): la parte que toca el DOM. Una capa oscura con un recorte iluminado sobre el
// elemento real (el foco) y un globo con una o dos frases, «Siguiente», «Omitir» y puntos de progreso.
// Qué paradas hay, cuándo toca y dónde va el globo lo decide js/tour.js (puro, probado con Node).
//
// Reglas: se cierra con Esc; el foco del teclado queda atrapado en el globo; cada parada se anuncia en una
// región aria-live; se recoloca al rotar, al cambiar de tamaño y si la página se mueve por debajo (el sondeo
// puede cambiar alturas); el globo nunca tapa lo que explica; con movimiento reducido no hay deslizamientos;
// sin almacenamiento funciona igual. Sin librerías: el recorte es un box-shadow gigante alrededor del foco.
import { h } from "../ui.js";
import { moverCaja, aparecer } from "../animaciones.js";
import {
  RECORRIDOS, paradasDisponibles, recorridoApagado, crearMemoria, tocaMostrar, siguienteParada, paradaAnterior,
  anuncioDeParada, topeDeseado, colocar,
} from "../tour.js";

function almacenLocal() {
  try {
    return window.localStorage;
  } catch {
    return null; // almacenamiento bloqueado: el recorrido se recuerda solo mientras dure la pestaña
  }
}

const memoria = crearMemoria(almacenLocal());
let cerrarAbierto = null;

const seVe = (nodo) => {
  const caja = nodo.getBoundingClientRect();
  return caja.width > 0 && caja.height > 0 && getComputedStyle(nodo).visibility !== "hidden";
};

/** El primer elemento visible que cumple el selector, o null. */
function buscar(selector) {
  for (const nodo of document.querySelectorAll(selector)) if (seVe(nodo)) return nodo;
  return null;
}

/** ¿El elemento está fijo a la ventana (la barra inferior)? Entonces no tiene sentido desplazar la página hacia él. */
function estaFijo(nodo) {
  for (let n = nodo; n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).position === "fixed") return true;
  return false;
}

function apagado() {
  const consultaDelHash = window.location.hash.includes("?") ? window.location.hash.slice(window.location.hash.indexOf("?") + 1) : "";
  return recorridoApagado({ busqueda: window.location.search, consultaDelHash, almacenado: memoria.apagado() });
}

/**
 * Abre el recorrido `nombre` ("tablero" | "detalle") si toca: no está apagado, no se ha visto, no hay otro
 * abierto y hay al menos dos paradas con su elemento a la vista. `vigente` es el de la pantalla (ctx.vigente):
 * si el usuario ya se fue, no se abre. Devuelve true si se abrió.
 */
export function lanzarRecorridoSiToca(nombre, { vigente = () => true } = {}) {
  if (!RECORRIDOS[nombre] || !vigente()) return false;
  const paradas = paradasDisponibles(RECORRIDOS[nombre], (selector) => Boolean(buscar(selector)));
  if (!tocaMostrar({ apagado: apagado(), visto: memoria.visto(nombre), abierto: Boolean(cerrarAbierto), paradas: paradas.length })) return false;
  abrir(nombre, paradas);
  return true;
}

/** «Ver el recorrido otra vez» (Perfil): se olvidan los dos y vuelven a salir donde toca. */
export function olvidarRecorridos() {
  memoria.olvidar();
}

/** Cierra el que esté abierto sin darlo por visto (al cambiar de pantalla). */
export function cerrarRecorrido() {
  if (cerrarAbierto) cerrarAbierto({ recordar: false });
}
window.addEventListener("fito:navegacion", cerrarRecorrido);

function abrir(nombre, paradas) {
  const focoPrevio = document.activeElement;
  let indice = 0;
  let objetivo = null;
  let ultimaCaja = "";

  const titulo = h("h2", { class: "tour-titulo", id: "tour-titulo" });
  const texto = h("p", { class: "tour-texto", id: "tour-texto" });
  const puntos = h("ol", { class: "tour-puntos", "aria-hidden": "true" }, paradas.map(() => h("li", {})));
  const cuenta = h("span", { class: "tour-cuenta", id: "tour-cuenta" });
  const omitir = h("button", { type: "button", class: "tour-omitir", id: "btn-tour-omitir" }, "Omitir");
  const atras = h("button", { type: "button", class: "boton boton-secundario boton-chico", id: "btn-tour-atras" }, "Atrás");
  const siguiente = h("button", { type: "button", class: "boton boton-primario boton-chico", id: "btn-tour-siguiente" }, "Siguiente");
  const flecha = h("span", { class: "tour-flecha", "aria-hidden": "true" });
  const globo = h("section", { class: "tour-globo", id: "tour-globo", role: "dialog", "aria-modal": "true", "aria-labelledby": "tour-titulo", "aria-describedby": "tour-texto" },
    flecha, titulo, texto,
    h("div", { class: "tour-progreso" }, puntos, cuenta),
    h("div", { class: "tour-pie" }, omitir, h("div", { class: "tour-botones" }, atras, siguiente)),
  );
  const foco = h("div", { class: "tour-foco", "aria-hidden": "true" });
  const vivo = h("p", { class: "solo-lector", role: "status", "aria-live": "polite", id: "tour-anuncio" });
  const capa = h("div", { class: "tour", id: "tour", "data-recorrido": nombre }, foco, globo, vivo);

  /** Pone el foco y el globo donde toca para el elemento actual. */
  function recolocar({ animar = false } = {}) {
    if (!objetivo || !objetivo.isConnected || !seVe(objetivo)) return;
    const caja = objetivo.getBoundingClientRect();
    const lugar = colocar({
      objetivo: { top: caja.top, left: caja.left, width: caja.width, height: caja.height },
      ventana: { ancho: window.innerWidth, alto: window.innerHeight },
      globo: { ancho: globo.offsetWidth, alto: globo.offsetHeight },
    });
    const firma = JSON.stringify(lugar);
    if (firma === ultimaCaja) return;
    ultimaCaja = firma;
    moverCaja(foco, lugar.foco, { animar });
    moverCaja(globo, lugar.globo, { animar });
    globo.dataset.lado = lugar.lado;
    flecha.style.left = `${lugar.flecha}px`;
  }

  /** Trae el elemento a la vista (centrado con su globo si caben) y lo enfoca. */
  function acomodar({ animar }) {
    if (!objetivo) return;
    if (!estaFijo(objetivo)) {
      const caja = objetivo.getBoundingClientRect();
      const tope = topeDeseado({ altoObjetivo: caja.height, altoGlobo: globo.offsetHeight, altoVentana: window.innerHeight });
      window.scrollBy(0, Math.round(caja.top - tope));
    }
    ultimaCaja = "";
    recolocar({ animar });
  }

  function mostrar(nuevo, { animar = true } = {}) {
    // Una parada cuyo elemento ya no está (la pantalla cambió por debajo) se salta hacia adelante.
    let i = nuevo;
    let nodo = null;
    while (i !== null && !(nodo = buscar(paradas[i].selector))) i = siguienteParada(i, paradas.length);
    if (i === null) {
      cerrar();
      return;
    }
    indice = i;
    objetivo = nodo;
    const parada = paradas[indice];
    titulo.textContent = parada.titulo;
    texto.textContent = parada.texto;
    cuenta.textContent = `${indice + 1} de ${paradas.length}`;
    [...puntos.children].forEach((punto, k) => {
      if (k === indice) punto.dataset.activo = "";
      else delete punto.dataset.activo;
    });
    atras.hidden = indice === 0;
    siguiente.textContent = siguienteParada(indice, paradas.length) === null ? "Listo" : "Siguiente";
    capa.dataset.parada = parada.clave;
    vivo.textContent = anuncioDeParada(parada, indice, paradas.length);
    acomodar({ animar });
  }

  function cerrar({ recordar = true } = {}) {
    if (cerrarAbierto !== cerrar) return;
    cerrarAbierto = null;
    if (recordar) memoria.marcarVisto(nombre);
    clearInterval(reloj);
    window.removeEventListener("resize", alCambiarTamano);
    window.removeEventListener("orientationchange", alCambiarTamano);
    document.removeEventListener("keydown", alTeclear, true);
    capa.remove();
    // El foco vuelve a donde estaba, si eso sigue en la página.
    if (focoPrevio && focoPrevio.isConnected && typeof focoPrevio.focus === "function") focoPrevio.focus({ preventScroll: true });
  }

  const alCambiarTamano = () => acomodar({ animar: false });

  function alTeclear(evento) {
    if (evento.key === "Escape") {
      evento.preventDefault();
      evento.stopPropagation();
      cerrar();
      return;
    }
    if (evento.key === "Tab") {
      // Foco atrapado: Tab da la vuelta entre los botones del globo.
      const botones = [omitir, atras, siguiente].filter((b) => !b.hidden);
      const actual = botones.indexOf(document.activeElement);
      const destino = botones[(actual + (evento.shiftKey ? -1 : 1) + botones.length) % botones.length] || siguiente;
      evento.preventDefault();
      destino.focus({ preventScroll: true });
      return;
    }
    // La página no se desplaza por debajo con el teclado mientras el recorrido está abierto.
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(evento.key)) evento.preventDefault();
  }

  siguiente.addEventListener("click", () => {
    const proxima = siguienteParada(indice, paradas.length);
    if (proxima === null) cerrar();
    else mostrar(proxima);
  });
  atras.addEventListener("click", () => {
    mostrar(paradaAnterior(indice));
    if (atras.hidden) siguiente.focus({ preventScroll: true }); // el botón con el foco desapareció en la primera parada
  });
  omitir.addEventListener("click", () => cerrar());
  // Tocar fuera del globo no hace nada ni se lleva el foco del teclado (lo de abajo no se puede usar todavía).
  capa.addEventListener("pointerdown", (evento) => {
    if (globo.contains(evento.target)) return;
    evento.preventDefault();
    if (!globo.contains(document.activeElement)) siguiente.focus({ preventScroll: true });
  });
  capa.addEventListener("focusout", () => {
    // Si el foco se escapa del globo (un clic en la capa, un lector que salta), vuelve a «Siguiente».
    setTimeout(() => {
      if (cerrarAbierto === cerrar && !globo.contains(document.activeElement)) siguiente.focus({ preventScroll: true });
    }, 0);
  });
  // Ni la rueda ni el dedo desplazan la página a través de la capa.
  capa.addEventListener("wheel", (evento) => evento.preventDefault(), { passive: false });
  capa.addEventListener("touchmove", (evento) => evento.preventDefault(), { passive: false });

  document.body.append(capa);
  cerrarAbierto = cerrar;
  document.addEventListener("keydown", alTeclear, true);
  window.addEventListener("resize", alCambiarTamano);
  window.addEventListener("orientationchange", alCambiarTamano);
  // Si la página cambia por debajo (llega una lectura, se estira una tarjeta), el foco sigue a su elemento.
  const reloj = setInterval(() => recolocar({ animar: false }), 400);

  mostrar(0, { animar: false });
  aparecer(globo);
  siguiente.focus({ preventScroll: true });
}
