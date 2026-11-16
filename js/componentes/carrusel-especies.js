// Carrusel de especies (F42): reemplaza el <select> de «¿Qué planta es?». Una tarjeta por especie de GET /especies
// con su mascota animada (F41), el nombre y los rangos; se elige deslizando (scroll-snap + arrastre con el mouse),
// tocando una tarjeta, con las flechas de pantalla o con el teclado (flechas, Home, End).
//
// Accesibilidad y formulario: la pista es un `role="radiogroup"` con una tarjeta `role="radio"` por especie (foco
// itinerante: solo la elegida está en el orden de tabulación). El valor del formulario sigue en un <select> nativo,
// visualmente oculto y fuera del árbol de accesibilidad, que conserva el id y el name de antes: así no cambian la
// validación (`marcarCampoConError` busca por name y le da el foco: el foco rebota a la tarjeta elegida), quien
// lee `select.value`, quien escucha su `change` (`mostrarRangos` del diagnóstico) ni la prueba de humo
// (`selectOption("#especie-select", ...)` mueve el carrusel). Ver F42 para lo descartado.
import { h, svg } from "../ui.js";
import { crearMascota } from "./mascota.js";
import { animarMascota, deslizarPista, resaltarTarjeta } from "../animaciones.js";
import { indiceTrasTecla, indiceMasCercano, desplazamientoParaCentrar } from "./carrusel-estado.js";

const flecha = (d) => svg("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false" }, svg("path", { d, fill: "none", stroke: "currentColor", "stroke-width": 2.5, "stroke-linecap": "round", "stroke-linejoin": "round" }));

/**
 * Devuelve { contenedor, select, error(texto), poner(opciones, valor), cargando(texto), fallo(texto), limpiar() }.
 * `opciones` sale de `opcionesDeEspecies` (carrusel-estado.js). Con `textoVacio` el select arranca sin elegir
 * (el formulario lo valida); sin él, se elige la primera.
 */
export function crearCarruselEspecies({ id, nombre = "especie", etiqueta, ayuda = "", textoVacio = "Elige tu planta", idAyuda = `${id}-ayuda` }) {
  const idError = `${id}-error`;
  const idEtiqueta = `${id}-etiqueta`;
  const select = h("select", { id, name: nombre, required: true, class: "solo-lector carrusel-select", tabindex: "-1", "aria-hidden": "true", disabled: true });
  const zonaError = h("p", { class: "error-campo", id: idError, "aria-live": "polite" });
  const nota = h("p", { class: "carrusel-nota texto-suave", "aria-live": "polite" });
  const pista = h("div", { class: "carrusel-pista", role: "radiogroup", "aria-labelledby": idEtiqueta, "aria-describedby": [ayuda ? idAyuda : "", idError].filter(Boolean).join(" "), "aria-required": "true" });
  const anterior = h("button", { type: "button", class: "carrusel-flecha carrusel-flecha--anterior", "aria-label": "Planta anterior", tabindex: "-1" }, flecha("M15 5l-7 7 7 7"));
  const siguiente = h("button", { type: "button", class: "carrusel-flecha carrusel-flecha--siguiente", "aria-label": "Planta siguiente", tabindex: "-1" }, flecha("M9 5l7 7-7 7"));
  const marco = h("div", { class: "carrusel" }, pista, anterior, siguiente);
  const contenedor = h("div", { class: "campo campo-carrusel" },
    h("label", { for: id, id: idEtiqueta }, etiqueta),
    select,
    marco,
    nota,
    ayuda ? h("p", { class: "rango-optimo", id: idAyuda }, ayuda) : null,
    zonaError);

  let tarjetas = [];
  let opciones = [];
  let elegido = -1;
  let programatico = false; // la pista se mueve por código: el scroll no elige
  let esperaScroll = null;
  let paradas = [];

  const centroDe = (t) => t.offsetLeft + t.offsetWidth / 2;

  function actualizarFlechas() {
    const i = elegido < 0 ? indiceMasCercano(tarjetas.map(centroDe), pista.scrollLeft + pista.clientWidth / 2) : elegido;
    anterior.disabled = tarjetas.length === 0 || i <= 0;
    siguiente.disabled = tarjetas.length === 0 || i >= tarjetas.length - 1;
  }

  function centrar(indice, { animar = true } = {}) {
    const t = tarjetas[indice];
    if (!t || pista.clientWidth === 0) return;
    const x = desplazamientoParaCentrar(t.offsetLeft, t.offsetWidth, pista.clientWidth, pista.scrollWidth - pista.clientWidth);
    programatico = true;
    const fin = () => {
      // el último evento de scroll llega después del último cuadro: se suelta un momento después
      setTimeout(() => { programatico = false; }, 60);
      actualizarFlechas();
    };
    if (animar) deslizarPista(pista, x, { alTerminar: fin });
    else {
      pista.scrollLeft = x;
      fin();
    }
  }

  /** Elige la tarjeta `indice`: marca el radio, pone el valor en el select y avisa con `change` (si `emitir`). */
  function seleccionar(indice, { centrarla = true, animar = true, enfocar = false, emitir = true } = {}) {
    if (indice < 0 || indice >= tarjetas.length) return;
    const cambio = indice !== elegido;
    elegido = indice;
    tarjetas.forEach((t, i) => {
      t.setAttribute("aria-checked", String(i === indice));
      t.tabIndex = i === indice ? 0 : -1;
    });
    if (enfocar) tarjetas[indice].focus({ preventScroll: true });
    if (centrarla) centrar(indice, { animar });
    resaltarTarjeta(tarjetas.map((t) => t.firstElementChild), indice);
    actualizarFlechas();
    if (cambio && select.value !== opciones[indice].valor) {
      select.value = opciones[indice].valor;
      if (emitir) select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function crearTarjeta(opcion, i) {
    const mascota = crearMascota(opcion.familia);
    paradas.push(animarMascota(mascota));
    const tarjeta = h("div", { class: "carrusel-tarjeta", role: "radio", "aria-checked": "false", tabindex: "-1", "data-valor": opcion.valor, "data-familia": mascota.familia },
      h("div", { class: "carrusel-contenido" },
        h("div", { class: "carrusel-dibujo" }, mascota.nodo),
        h("span", { class: "carrusel-nombre" }, opcion.nombre),
        opcion.descontinuada ? h("span", { class: "carrusel-marca" }, "Descontinuada") : null,
        opcion.resumen ? h("span", { class: "carrusel-rangos" }, opcion.resumen) : null));
    tarjeta.addEventListener("click", () => {
      if (arrastre.movio) return;
      seleccionar(i, { enfocar: true });
    });
    return tarjeta;
  }

  function detenerMascotas() {
    paradas.forEach((parar) => parar());
    paradas = [];
  }

  /** Pinta las tarjetas de `lista` y elige `valor` (centrada, sin animar). */
  function poner(lista, valor = "") {
    detenerMascotas();
    opciones = lista;
    elegido = -1;
    select.replaceChildren(
      ...(textoVacio ? [h("option", { value: "" }, textoVacio)] : []),
      ...lista.map((o) => h("option", { value: o.valor }, o.descontinuada ? `${o.nombre} (descontinuada)` : o.nombre)),
    );
    tarjetas = lista.map(crearTarjeta);
    pista.replaceChildren(...tarjetas);
    select.disabled = lista.length === 0;
    nota.textContent = lista.length === 0 ? "Todavía no hay plantas en el catálogo." : "";
    marco.hidden = lista.length === 0;
    const indice = lista.findIndex((o) => o.valor === valor);
    if (indice >= 0) seleccionar(indice, { animar: false, emitir: false });
    else if (!textoVacio && lista.length) seleccionar(0, { animar: false, emitir: false });
    else {
      select.value = "";
      if (tarjetas[0]) tarjetas[0].tabIndex = 0;
      resaltarTarjeta([], -1);
    }
    // Si la pista aún no tiene ancho (pantalla sin montar, sección plegada) se centra cuando lo tenga.
    requestAnimationFrame(() => {
      if (elegido >= 0) centrar(elegido, { animar: false });
      actualizarFlechas();
    });
  }

  function cargando(texto = "Cargando plantas…") {
    detenerMascotas();
    tarjetas = [];
    opciones = [];
    elegido = -1;
    select.replaceChildren(h("option", { value: "" }, texto));
    select.disabled = true;
    pista.replaceChildren();
    marco.hidden = true;
    nota.textContent = texto;
  }

  function fallo(texto = "No se pudo cargar la lista de plantas") {
    cargando(texto);
  }

  // ---- el select sigue siendo la fuente de verdad ----
  // Alguien (la prueba de humo, un restablecimiento) cambió el select: el carrusel lo sigue, sin reemitir.
  select.addEventListener("change", () => {
    const i = opciones.findIndex((o) => o.valor === select.value);
    if (i >= 0 && i !== elegido) seleccionar(i, { emitir: false });
  });
  // El foco que llega al select (la etiqueta, marcarCampoConError) se pasa a la tarjeta elegida, o a la primera.
  select.addEventListener("focus", () => {
    const destino = tarjetas[elegido >= 0 ? elegido : 0];
    if (destino) destino.focus();
  });
  // aria-invalid del select (lo pone la validación) se refleja en el radiogroup, que es lo que oye el lector.
  new MutationObserver(() => {
    if (select.hasAttribute("aria-invalid")) pista.setAttribute("aria-invalid", select.getAttribute("aria-invalid"));
    else pista.removeAttribute("aria-invalid");
  }).observe(select, { attributes: true, attributeFilter: ["aria-invalid"] });

  // ---- teclado ----
  pista.addEventListener("keydown", (evento) => {
    const actual = tarjetas.indexOf(document.activeElement);
    if ((evento.key === " " || evento.key === "Enter") && actual >= 0) {
      evento.preventDefault();
      seleccionar(actual);
      return;
    }
    const destino = indiceTrasTecla(actual >= 0 ? actual : elegido, evento.key, tarjetas.length);
    if (destino === null) return;
    evento.preventDefault();
    seleccionar(destino, { enfocar: true });
  });

  // ---- flechas de pantalla ----
  const paso = (delta) => {
    const base = elegido >= 0 ? elegido : indiceMasCercano(tarjetas.map(centroDe), pista.scrollLeft + pista.clientWidth / 2) - (delta > 0 ? 1 : 0);
    seleccionar(Math.max(0, Math.min(tarjetas.length - 1, base + delta)));
  };
  anterior.addEventListener("click", () => paso(-1));
  siguiente.addEventListener("click", () => paso(1));

  // ---- deslizar: al quedarse quieta la pista, se elige la tarjeta del centro ----
  pista.addEventListener("scroll", () => {
    if (programatico || arrastre.activo) return;
    clearTimeout(esperaScroll);
    esperaScroll = setTimeout(() => {
      if (programatico || tarjetas.length === 0) return;
      const i = indiceMasCercano(tarjetas.map(centroDe), pista.scrollLeft + pista.clientWidth / 2);
      if (i >= 0 && i !== elegido) seleccionar(i, { centrarla: false });
      else actualizarFlechas();
    }, 140);
  }, { passive: true });

  // ---- arrastrar con el mouse (en táctil el desplazamiento nativo ya lo hace) ----
  const arrastre = { activo: false, movio: false, x0: 0, scroll0: 0 };
  pista.addEventListener("pointerdown", (evento) => {
    if (evento.pointerType !== "mouse" || evento.button !== 0 || tarjetas.length === 0) return;
    Object.assign(arrastre, { activo: true, movio: false, x0: evento.clientX, scroll0: pista.scrollLeft });
  });
  pista.addEventListener("pointermove", (evento) => {
    if (!arrastre.activo) return;
    const dx = evento.clientX - arrastre.x0;
    if (!arrastre.movio && Math.abs(dx) > 6) {
      arrastre.movio = true;
      pista.classList.add("carrusel-pista--libre", "carrusel-pista--arrastrando");
      pista.setPointerCapture(evento.pointerId);
    }
    if (arrastre.movio) pista.scrollLeft = arrastre.scroll0 - dx;
  });
  const soltar = () => {
    if (!arrastre.activo) return;
    arrastre.activo = false;
    pista.classList.remove("carrusel-pista--arrastrando");
    if (arrastre.movio) {
      pista.classList.remove("carrusel-pista--libre");
      const i = indiceMasCercano(tarjetas.map(centroDe), pista.scrollLeft + pista.clientWidth / 2);
      seleccionar(i);
      // el click que sigue al soltar no debe elegir otra tarjeta
      setTimeout(() => { arrastre.movio = false; }, 0);
    }
  };
  pista.addEventListener("pointerup", soltar);
  pista.addEventListener("pointercancel", soltar);

  // Cambia el ancho (rotar el teléfono, abrir la sección plegada): la elegida vuelve al centro, sin animar.
  const observador = typeof ResizeObserver === "function" ? new ResizeObserver(() => {
    if (elegido >= 0) centrar(elegido, { animar: false });
    else actualizarFlechas();
  }) : null;
  if (observador) observador.observe(pista);

  return {
    contenedor,
    select,
    pista,
    error(texto) {
      zonaError.textContent = texto || "";
      if (texto) select.setAttribute("aria-invalid", "true");
      else select.removeAttribute("aria-invalid");
    },
    poner,
    cargando,
    fallo,
    /** Detiene las mascotas y deja de observar el ancho. Lo llama la pantalla al salir. */
    limpiar() {
      detenerMascotas();
      clearTimeout(esperaScroll);
      if (observador) observador.disconnect();
    },
  };
}
