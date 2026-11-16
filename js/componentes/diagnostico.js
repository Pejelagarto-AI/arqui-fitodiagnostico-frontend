// Pinta un diagnóstico: estado global, una burbuja por parámetro (valor, estado, barra con la
// banda óptima y minigráfica de tendencia) y «Qué hacer hoy». Lo usan el formulario suelto y el
// detalle de una planta: mismo contrato de diagnóstico, misma presentación.
import {
  h,
  svg,
  vaciar,
  ETIQUETAS_ESTADO_GLOBAL,
  ETIQUETAS_ESTADO_PARAMETRO,
  ETIQUETAS_PARAMETRO,
} from "../ui.js";
import { escalaDe, porcentaje, numeroLegible, serieDeParametro, recomendacionesPorParametro } from "./escala.js";
import { crearMinigrafica } from "./minigrafica.js";
import { dibujarLinea } from "../animaciones.js";
import { recomendacionEnPalabras } from "../voz-planta.js";

const FLECHAS = { BAJO: "↓", ALTO: "↑", OPTIMO: "" };

function atributosDeIcono() {
  return { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" };
}

/** Iconos propios de cada magnitud (gota, sol, termómetro), construidos con createElementNS. */
export function iconoDeParametro(nombre) {
  if (nombre === "humedad") return svg("svg", atributosDeIcono(), svg("path", { d: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" }));
  if (nombre === "luz") {
    return svg("svg", atributosDeIcono(),
      svg("circle", { cx: 12, cy: 12, r: 4 }),
      svg("path", { d: "M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" }),
    );
  }
  return svg("svg", atributosDeIcono(), svg("path", { d: "M10 4a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0Z" }));
}

function chipDeParametro(estado) {
  return h("span", { class: `chip chip--${estado.toLowerCase()}` },
    FLECHAS[estado] ? h("span", { class: "chip-flecha", "aria-hidden": "true" }, FLECHAS[estado]) : null,
    ETIQUETAS_ESTADO_PARAMETRO[estado] || estado,
  );
}

export function estadoGlobalNodo(estado, { resumen = false } = {}) {
  return h(
    "p",
    { class: `estado-global ${estado.toLowerCase()}${resumen ? " estado-global--resumen" : ""}` },
    ETIQUETAS_ESTADO_GLOBAL[estado] || estado,
  );
}

/**
 * Diagnóstico de mentira para el esqueleto de carga (ui.esqueletoSiTarda): mismos tres parámetros y
 * unidades que el real, así `crearVistaDeDiagnostico(..., { esqueleto: true })` ocupa el mismo alto.
 */
export const DIAGNOSTICO_DE_ESQUELETO = {
  estado: "SALUDABLE",
  parametros: [
    { nombre: "humedad", valor: 50, unidad: "%", estado: "OPTIMO", rangoOptimo: [40, 60] },
    { nombre: "luz", valor: 500, unidad: "lx", estado: "OPTIMO", rangoOptimo: [400, 600] },
    { nombre: "temperatura", valor: 22, unidad: "°C", estado: "OPTIMO", rangoOptimo: [18, 26] },
  ],
  recomendaciones: [],
};

const cifra = (n) => Number(n).toLocaleString("es-CO", { maximumFractionDigits: 1 });

/**
 * F49. La luz del día con la regla de la fase 8 del backend: `exposicionLuminica` trae las horas con luz y el lux
 * efectivo de las últimas 24 h. Devuelve { horas, lux, texto } o null si no hay historial (`base: INSTANTANEA`, o un
 * servidor viejo sin el campo): entonces no se muestran horas. Puro.
 */
export function luzDelDia(diagnostico) {
  const e = diagnostico && diagnostico.exposicionLuminica;
  if (!e || e.base !== "ACUMULADA" || e.horasDeLuz == null || e.luxEfectivo == null) return null;
  return { horas: e.horasDeLuz, lux: e.luxEfectivo, texto: `Hoy: ${cifra(e.horasDeLuz)} h de luz, ${cifra(e.luxEfectivo)} lx efectivos` };
}

/** F49. ¿La luz de este diagnóstico no cuenta? De noche (`periodo: "NOCHE"`) la luz no entra al estado (D121). */
export function luzNoCuenta(diagnostico) {
  return Boolean(diagnostico) && diagnostico.periodo === "NOCHE";
}

export const DE_NOCHE_NO_CUENTA = "de noche no cuenta";

function burbujaDeParametro(parametro, { esqueleto = false, noche = false, dia = null } = {}) {
  const nombre = parametro.nombre;
  const etiqueta = ETIQUETAS_PARAMETRO[nombre] || nombre;
  const [min, max] = parametro.rangoOptimo;
  const escala = escalaDe(nombre, parametro.rangoOptimo, parametro.valor);
  const izquierda = porcentaje(min, escala);
  const derecha = porcentaje(max, escala);

  const banda = h("div", { class: "pista-optima" });
  banda.style.left = `${izquierda}%`;
  banda.style.width = `${derecha - izquierda}%`;
  const relleno = h("div", { class: "pista-valor" });
  relleno.style.width = `${porcentaje(parametro.valor, escala)}%`;
  const pista = h("div", {
    class: "pista",
    role: "img",
    "aria-label": `${etiqueta}: ${parametro.valor} ${parametro.unidad}; lo ideal es de ${min} a ${max} ${parametro.unidad}`,
  }, banda, relleno);

  const esLuz = nombre === "luz";
  const valorReal = h("span", { class: "num-valor" }, String(parametro.valor));
  const valorAnimado = h("span", { class: "num-anim", "aria-hidden": "true" });
  const ranura = h("div", { class: "tendencia" });

  // En el esqueleto no hay datos: sin data-parametro/estado ni el rol de imagen de la barra.
  if (esqueleto) pista.removeAttribute("role");
  // F49: de noche la ficha de luz va en gris (CSS por `data-noche`) y en vez del estado dice que no cuenta; con
  // historial, el número es el de ahora y debajo va la luz del día.
  const deNoche = esLuz && noche && !esqueleto;
  const delDia = esLuz && !esqueleto ? dia : null;
  const nodo = h("section", { class: "burbuja", "data-parametro": esqueleto ? null : nombre, "data-estado": esqueleto ? null : parametro.estado, "data-noche": deNoche ? "true" : null },
    h("div", { class: "burbuja-icono" }, iconoDeParametro(nombre)),
    h("h3", {}, etiqueta),
    h("div", { class: "num" }, valorReal, valorAnimado, h("small", {}, delDia ? `${parametro.unidad} ahora` : parametro.unidad)),
    delDia ? h("p", { class: "burbuja-dia" }, delDia.texto) : null,
    deNoche ? h("span", { class: "chip chip--noche" }, DE_NOCHE_NO_CUENTA) : chipDeParametro(parametro.estado),
    pista,
    h("div", { class: "pista-ley" },
      h("span", {}, numeroLegible(escala[0])),
      h("span", {}, `ideal ${numeroLegible(min)}–${numeroLegible(max)}`),
      h("span", {}, numeroLegible(escala[1])),
    ),
    ranura,
  );
  return { nodo, ranura, parametro, pista, relleno, valorReal };
}

function listaDeRecomendaciones(diagnostico) {
  const recomendaciones = diagnostico.recomendaciones || [];
  if (recomendaciones.length === 0) {
    return h("ul", { class: "recom" }, h("li", { class: "recom-ok" }, "Todo en rango. Hoy no hay que hacer nada."));
  }
  const iconos = new Map(diagnostico.parametros.map((p) => [p.nombre, p]));
  return h("ul", { class: "recom" },
    recomendacionesPorParametro(diagnostico.parametros, recomendaciones).map(({ texto, parametro }) => {
      // Primero qué hacer; el porqué, con las palabras de la app, después (js/voz-planta.js).
      const { accion, detalle } = recomendacionEnPalabras(texto, parametro ? iconos.get(parametro) : null);
      return h("li", { "data-parametro": parametro || null, "data-estado": parametro ? iconos.get(parametro).estado : null },
        parametro ? h("span", { class: "recom-icono" }, iconoDeParametro(parametro)) : null,
        h("span", { class: "recom-texto" }, h("strong", { class: "recom-accion" }, accion), detalle ? h("span", { class: "recom-detalle" }, ` ${detalle}`) : null),
      );
    }),
  );
}

/**
 * Arma la vista del diagnóstico. Devuelve { nodo, burbujas, actualizarSerie(registros) }:
 * `actualizarSerie` recibe una página del historial (más reciente primero) y dibuja la minigráfica
 * de cada parámetro sin repintar el resto; así el sondeo la mantiene al día.
 */
export function crearVistaDeDiagnostico(diagnostico, { serie = null, resumen = false, esqueleto = false } = {}) {
  const contextoDeLuz = { noche: luzNoCuenta(diagnostico), dia: luzDelDia(diagnostico) };
  const burbujas = diagnostico.parametros.map((p) => burbujaDeParametro(p, { esqueleto, ...contextoDeLuz }));
  let firmaDeSerie = null;

  function actualizarSerie(registros) {
    const firma = (registros || []).map((r) => r.id).join(",");
    if (firma === firmaDeSerie) return;
    firmaDeSerie = firma;
    for (const burbuja of burbujas) {
      vaciar(burbuja.ranura);
      const { nodo, linea } = crearMinigrafica({
        valores: serieDeParametro(registros, burbuja.parametro.nombre),
        rangoOptimo: burbuja.parametro.rangoOptimo,
        etiqueta: ETIQUETAS_PARAMETRO[burbuja.parametro.nombre] || burbuja.parametro.nombre,
        unidad: burbuja.parametro.unidad,
      });
      burbuja.linea = linea;
      if (nodo) {
        burbuja.ranura.append(h("span", { class: "tendencia-etiqueta" }, "últimas lecturas"), nodo);
        dibujarLinea(linea, { retraso: 0.3 });
      }
    }
  }
  if (serie) actualizarSerie(serie);

  const nodo = h(
    "div",
    { class: "diagnostico" },
    // El esqueleto no lleva .estado-global ni .recom: lo que espera el humo y los lectores es el dato real.
    esqueleto ? h("p", { class: "estado-esqueleto", "aria-hidden": "true" }, "Cargando") : estadoGlobalNodo(diagnostico.estado, { resumen }),
    h("div", { class: "burbujas" }, burbujas.map((b) => b.nodo)),
    h("section", { class: "que-hacer" }, h("h3", {}, "Qué hacer hoy"),
      esqueleto ? h("ul", { class: "recom" }, h("li", {}, h("span", {}, "Cargando las recomendaciones de hoy"))) : listaDeRecomendaciones(diagnostico)),
  );
  return { nodo, burbujas, actualizarSerie };
}

/** Devuelve el nodo con el diagnóstico completo. */
export function nodoDeDiagnostico(diagnostico, opciones) {
  return crearVistaDeDiagnostico(diagnostico, opciones).nodo;
}

export function pintarDiagnostico(contenedor, diagnostico) {
  vaciar(contenedor);
  contenedor.append(nodoDeDiagnostico(diagnostico));
}
