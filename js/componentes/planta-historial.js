// RF-F5: historial paginado de diagnósticos de una planta (el más reciente primero).
import { conTransicion } from "../transiciones.js";
import { obtenerHistorial } from "../api.js";
import { h, vaciar, crearAviso, formatearFechaRelativa, chipDeEstadoGlobal, esqueletoSiTarda } from "../ui.js";

const TAMANO = 10;
const ORIGENES = { MANUAL: "a mano", DISPOSITIVO: "matera" };

function valorDeParametro(parametros, nombre) {
  const p = parametros.find((x) => x.nombre === nombre);
  if (!p) return h("span", { class: "hist-valor" }, "—");
  return h("span", { class: `hist-valor valor-${p.estado.toLowerCase()}`, title: nombre }, `${p.valor} ${p.unidad}`);
}

export function crearPanelHistorial(plantaId, ctx, { alRecibir = () => {} } = {}) {
  let pagina = 0;
  let firmaPintada = null; // evita repintar la tabla cuando el sondeo trae lo mismo
  const aviso = crearAviso();
  // Esqueleto del historial: tres renglones con la altura de los reales (sin <table>: el humo cuenta las filas reales).
  const esqueleto = h("div", { class: "historial-esqueleto", "aria-hidden": "true" }, [1, 2, 3].map(() => h("div", { class: "hist-fila-esqueleto" }, h("span", {}, "Cargando"), h("span", {}, "Cargando el historial"))));
  const cancelarEsqueleto = esqueletoSiTarda(esqueleto);
  const cuerpo = h("div", { id: "historial", "aria-busy": "true" }, h("p", { class: "solo-lector" }, "Cargando historial…"), esqueleto);
  const elemento = h("section", { class: "tarjeta", "aria-labelledby": "titulo-historial" }, h("h2", { id: "titulo-historial" }, "Historial"), h("p", { class: "texto-suave" }, "Cada lectura de tu planta, la más reciente primero."), aviso.elemento, cuerpo);

  function pintar(respuesta) {
    cancelarEsqueleto();
    cuerpo.removeAttribute("aria-busy");
    const firma = `${respuesta.pagina}|${respuesta.total}|${respuesta.contenido.map((r) => r.id).join(",")}`;
    if (firma === firmaPintada) return;
    firmaPintada = firma;
    vaciar(cuerpo);
    if (respuesta.total === 0) {
      cuerpo.append(h("p", { class: "texto-vacio" }, "Aún no hay lecturas. Irán apareciendo aquí a medida que lleguen."));
      return;
    }
    // Una lista con forma de tabla: sigue siendo <table id="tabla-historial"> (una fila por registro) pero
    // cada fila se dibuja como renglón: estado, cuándo y origen, y los tres valores (hallazgo 7).
    const filas = respuesta.contenido.map((registro) =>
      h("tr", { role: "row", "data-estado": registro.diagnostico.estado },
        h("td", { role: "cell", class: "hist-estado" }, h("span", { class: "punto-estado", "aria-hidden": "true" }), chipDeEstadoGlobal(registro.diagnostico.estado)),
        h("td", { role: "cell", class: "hist-cuando" }, `${formatearFechaRelativa(registro.registradoEn)} · ${ORIGENES[registro.origen] || registro.origen}`),
        h("td", { role: "cell", class: "hist-valores" },
          ["humedad", "luz", "temperatura"].map((n) => valorDeParametro(registro.diagnostico.parametros, n)),
        ),
      ),
    );
    const anterior = h("button", { type: "button", class: "boton boton-secundario boton-chico", id: "btn-pagina-anterior", disabled: respuesta.pagina === 0, onclick: () => cargar(respuesta.pagina - 1) }, "Anterior");
    const siguiente = h("button", { type: "button", class: "boton boton-secundario boton-chico", id: "btn-pagina-siguiente", disabled: respuesta.pagina + 1 >= respuesta.totalDePaginas, onclick: () => cargar(respuesta.pagina + 1) }, "Siguiente");
    const unaSolaPagina = respuesta.totalDePaginas <= 1;
    anterior.hidden = unaSolaPagina;
    siguiente.hidden = unaSolaPagina;
    cuerpo.append(
      h("div", { class: "historial-lista" },
        h("table", { class: "tabla-historial", id: "tabla-historial", role: "table", "aria-label": "Historial de lecturas" },
          h("thead", { class: "solo-lector" }, h("tr", { role: "row" }, ["Estado", "Cuándo y quién la midió", "Humedad, luz y temperatura"].map((t) => h("th", { scope: "col", role: "columnheader" }, t)))),
          h("tbody", {}, filas),
        ),
      ),
      h("div", { class: "paginacion" }, anterior,
        // Con una sola página no hay nada que pasar: solo se dice cuántas lecturas hay.
        h("span", { id: "info-pagina" }, `${unaSolaPagina ? "" : `Página ${respuesta.pagina + 1} de ${respuesta.totalDePaginas} · `}${respuesta.total} lectura${respuesta.total === 1 ? "" : "s"}`),
        siguiente),
    );
  }

  async function cargar(numero = pagina, silencioso = false) {
    try {
      const respuesta = await obtenerHistorial(plantaId, numero, TAMANO);
      if (!ctx.vigente()) return;
      // Si la página pedida ya no existe (se eliminó algo), volver a la última.
      if (respuesta.contenido.length === 0 && respuesta.total > 0 && numero > 0) {
        await cargar(respuesta.totalDePaginas - 1, silencioso);
        return;
      }
      pagina = respuesta.pagina;
      alRecibir(respuesta);
      aviso.limpiar();
      // Al cambiar de página a mano la lista se funde; el sondeo (silencioso) repinta sin efecto.
      if (!silencioso && firmaPintada !== null) await conTransicion(() => pintar(respuesta));
      else pintar(respuesta);
    } catch (error) {
      // El sondeo (silencioso) decide qué mostrar; aquí solo relanza el error.
      if (silencioso) throw error;
      if (ctx.vigente()) {
        if (firmaPintada === null) {
          cancelarEsqueleto();
          vaciar(cuerpo);
        }
        aviso.mostrar(error);
      }
    }
  }

  return {
    elemento,
    cargar: () => cargar(pagina),
    irAPrimera: () => cargar(0),
    // Para el sondeo: la misma página que el usuario está mirando, sin saltar a la primera.
    refrescar: () => cargar(pagina, true),
  };
}
