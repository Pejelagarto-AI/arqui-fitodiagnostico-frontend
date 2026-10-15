// Utilidades de interfaz compartidas por todas las pantallas. Regla de oro
// anti-XSS: el contenido que viene de la API se inserta SIEMPRE como texto
// (textContent / nodos de texto), nunca con innerHTML.

/** Crea un elemento: h("button", { class: "boton", onclick: fn }, "Texto", otroNodo). */
export function h(etiqueta, atributos = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(atributos || {})) {
    if (valor === undefined || valor === null || valor === false) continue;
    if (clave.startsWith("on") && typeof valor === "function") {
      nodo.addEventListener(clave.slice(2).toLowerCase(), valor);
    } else if (clave === "class") {
      nodo.className = valor;
    } else if (valor === true) {
      nodo.setAttribute(clave, "");
    } else {
      nodo.setAttribute(clave, valor);
    }
  }
  agregar(nodo, hijos);
  return nodo;
}

function agregar(nodo, hijos) {
  for (const hijo of hijos.flat(Infinity)) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    nodo.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
}

export function vaciar(nodo) {
  nodo.replaceChildren();
}

// ---- fechas y etiquetas ----

export function formatearFecha(iso) {
  if (!iso) return "";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return String(iso);
  return fecha.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

export const ETIQUETAS_ESTADO_GLOBAL = {
  SALUDABLE: "Saludable",
  EN_RIESGO: "En riesgo",
  CRITICO: "Crítico",
};

export const ETIQUETAS_ESTADO_PARAMETRO = { BAJO: "Bajo", OPTIMO: "Óptimo", ALTO: "Alto" };

export const ETIQUETAS_PARAMETRO = {
  humedad: "Humedad del sustrato",
  luz: "Luz",
  temperatura: "Temperatura",
};

export const ETIQUETAS_ESTADO_SOLICITUD = { PENDIENTE: "Pendiente", APROBADA: "Aprobada", RECHAZADA: "Rechazada" };

export function chipDeEstadoGlobal(estado) {
  return h("span", { class: `chip chip--${estado.toLowerCase()}` }, ETIQUETAS_ESTADO_GLOBAL[estado] || estado);
}

export function chipDeSolicitud(estado) {
  const clase = { PENDIENTE: "riesgo", APROBADA: "saludable", RECHAZADA: "critico" }[estado] || "riesgo";
  return h("span", { class: `chip chip--${clase}` }, ETIQUETAS_ESTADO_SOLICITUD[estado] || estado);
}

// ---- errores visibles ----

/**
 * Zona de aviso con role="alert". `mostrar(error)` acepta un ErrorApi, un Error
 * o un texto; `limpiar()` la oculta. Todas las pantallas tienen al menos una.
 */
export function crearAviso() {
  const texto = h("p");
  const elemento = h("div", { class: "banner-error", role: "alert", hidden: true }, texto);
  return {
    elemento,
    mostrar(error) {
      texto.textContent = typeof error === "string" ? error : error.mensaje || error.message || String(error);
      elemento.hidden = false;
    },
    limpiar() {
      texto.textContent = "";
      elemento.hidden = true;
    },
  };
}

/** Aviso de éxito o información (role="status"). */
export function crearNota() {
  const texto = h("p");
  const elemento = h("div", { class: "banner-ok", role: "status", hidden: true }, texto);
  return {
    elemento,
    mostrar(mensaje) {
      texto.textContent = mensaje;
      elemento.hidden = false;
    },
    limpiar() {
      texto.textContent = "";
      elemento.hidden = true;
    },
  };
}

// ---- formularios ----

/**
 * Un campo con etiqueta, input y zona de error enlazada por aria-describedby.
 * Devuelve { contenedor, input, error(texto) }.
 */
export function campo({ id, etiqueta, tipo = "text", nombre, requerido = true, ayuda, valor = "", ...extra }) {
  const idError = `${id}-error`;
  const idAyuda = `${id}-ayuda`;
  const atributos = {
    id,
    name: nombre || id,
    required: requerido,
    "aria-describedby": ayuda ? `${idAyuda} ${idError}` : idError,
    ...extra,
  };
  const input = tipo === "textarea" ? h("textarea", { rows: "3", ...atributos }) : h("input", { type: tipo, ...atributos });
  input.value = valor;
  const zonaError = h("p", { class: "error-campo", id: idError, "aria-live": "polite" });
  const contenedor = h(
    "div",
    { class: "campo" },
    h("label", { for: id }, etiqueta),
    input,
    ayuda ? h("p", { class: "rango-optimo", id: idAyuda }, ayuda) : null,
    zonaError,
  );
  return {
    contenedor,
    input,
    error(texto) {
      zonaError.textContent = texto || "";
      if (texto) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    },
  };
}

/** Un <select> con etiqueta y zona de error. `opciones`: [{ valor, texto, deshabilitada? }]. */
export function campoSelect({ id, etiqueta, nombre, opciones, valor = "", requerido = true }) {
  const idError = `${id}-error`;
  const select = h("select", { id, name: nombre || id, required: requerido, "aria-describedby": idError });
  for (const o of opciones) select.append(h("option", { value: o.valor, disabled: o.deshabilitada }, o.texto));
  select.value = valor;
  const zonaError = h("p", { class: "error-campo", id: idError, "aria-live": "polite" });
  return {
    contenedor: h("div", { class: "campo" }, h("label", { for: id }, etiqueta), select, zonaError),
    select,
    error(texto) {
      zonaError.textContent = texto || "";
      if (texto) select.setAttribute("aria-invalid", "true");
      else select.removeAttribute("aria-invalid");
    },
  };
}

/** Quita las marcas de error de un formulario antes de reenviarlo. */
export function limpiarErroresDeFormulario(formulario) {
  for (const input of formulario.querySelectorAll("[aria-invalid]")) input.removeAttribute("aria-invalid");
  for (const zona of formulario.querySelectorAll(".error-campo")) zona.textContent = "";
}

/**
 * Si el error nombra un campo del formulario (`detalle.campo`) lo pinta junto
 * a ese campo y devuelve true; si no, devuelve false y quien llama lo muestra
 * en su aviso general.
 */
export function marcarCampoConError(formulario, error) {
  if (!error || !error.campo) return false;
  const input = formulario.querySelector(`[name="${CSS.escape(error.campo)}"]`);
  if (!input) return false;
  input.setAttribute("aria-invalid", "true");
  const idError = `${input.id}-error`;
  const zona = formulario.querySelector(`#${CSS.escape(idError)}`);
  if (zona) zona.textContent = error.mensaje;
  input.focus();
  return true;
}

/**
 * Corre `accion` con el botón deshabilitado y un texto de espera, para que un
 * doble clic no mande dos peticiones. Devuelve lo que devuelva la acción.
 */
export async function conCarga(boton, textoEspera, accion) {
  const original = boton.textContent;
  boton.disabled = true;
  boton.textContent = textoEspera;
  try {
    return await accion();
  } finally {
    boton.disabled = false;
    boton.textContent = original;
  }
}

// ---- toasts ----

function zonaDeToasts() {
  let zona = document.getElementById("zona-toasts");
  if (!zona) {
    zona = h("div", { id: "zona-toasts", class: "zona-toasts", role: "status", "aria-live": "polite" });
    document.body.append(zona);
  }
  return zona;
}

export function toast(mensaje, tipo = "info") {
  const nodo = h("div", { class: `toast toast--${tipo}` }, mensaje);
  zonaDeToasts().append(nodo);
  setTimeout(() => nodo.remove(), 6000);
}

// ---- confirmación ----

/** Diálogo de confirmación accesible (<dialog>). Resuelve true si aceptan. */
export function confirmar(mensaje, { aceptar = "Aceptar", peligro = false } = {}) {
  return new Promise((resolver) => {
    const dialogo = h("dialog", { class: "dialogo", "aria-label": "Confirmación" });
    const cerrar = (valor) => {
      dialogo.close();
      dialogo.remove();
      resolver(valor);
    };
    dialogo.append(
      h("p", {}, mensaje),
      h(
        "div",
        { class: "acciones" },
        h("button", { type: "button", class: "boton boton-secundario", onclick: () => cerrar(false) }, "Cancelar"),
        h(
          "button",
          { type: "button", class: `boton ${peligro ? "boton-peligro" : "boton-primario"}`, "data-confirmar": "si", onclick: () => cerrar(true) },
          aceptar,
        ),
      ),
    );
    dialogo.addEventListener("cancel", (e) => {
      e.preventDefault();
      cerrar(false);
    });
    document.body.append(dialogo);
    dialogo.showModal();
  });
}

// ---- portapapeles ----

export async function copiarAlPortapapeles(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Contextos no seguros o permiso denegado: respaldo con un textarea temporal.
    const area = h("textarea", { "aria-hidden": "true" });
    area.style.position = "fixed";
    area.style.opacity = "0";
    area.value = texto;
    document.body.append(area);
    area.select();
    let copiado = false;
    try {
      copiado = document.execCommand("copy");
    } catch {
      copiado = false;
    }
    area.remove();
    return copiado;
  }
}

/** Enlace de una ruta del front (con hash). */
export function enlace(ruta, texto, clase = "") {
  return h("a", { href: `#${ruta}`, class: clase }, texto);
}
