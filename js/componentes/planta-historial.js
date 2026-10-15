// RF-F5: historial paginado de diagnósticos de una planta (el más reciente primero).
import { obtenerHistorial } from "../api.js";
import { h, vaciar, crearAviso, formatearFecha, chipDeEstadoGlobal } from "../ui.js";

const TAMANO = 10;
const ORIGENES = { MANUAL: "Manual", DISPOSITIVO: "Dispositivo" };

function celdaDeParametro(parametros, nombre) {
  const p = parametros.find((x) => x.nombre === nombre);
  if (!p) return h("td", {}, "—");
  return h("td", { class: `valor-${p.estado.toLowerCase()}` }, `${p.valor} ${p.unidad}`);
}

export function crearPanelHistorial(plantaId, ctx) {
  let pagina = 0;
  const aviso = crearAviso();
  const cuerpo = h("div", { id: "historial" }, h("p", { class: "texto-vacio" }, "Cargando historial…"));
  const elemento = h("section", { class: "tarjeta", "aria-labelledby": "titulo-historial" }, h("h2", { id: "titulo-historial" }, "Historial"), aviso.elemento, cuerpo);

  function pintar(respuesta) {
    vaciar(cuerpo);
    if (respuesta.total === 0) {
      cuerpo.append(h("p", { class: "texto-vacio" }, "Todavía no hay mediciones en el historial."));
      return;
    }
    const filas = respuesta.contenido.map((registro) =>
      h("tr", {},
        h("td", {}, formatearFecha(registro.registradoEn)),
        h("td", {}, ORIGENES[registro.origen] || registro.origen),
        h("td", {}, chipDeEstadoGlobal(registro.diagnostico.estado)),
        celdaDeParametro(registro.diagnostico.parametros, "humedad"),
        celdaDeParametro(registro.diagnostico.parametros, "luz"),
        celdaDeParametro(registro.diagnostico.parametros, "temperatura"),
      ),
    );
    const anterior = h("button", { type: "button", class: "boton boton-secundario boton-chico", id: "btn-pagina-anterior", disabled: respuesta.pagina === 0, onclick: () => cargar(respuesta.pagina - 1) }, "Anterior");
    const siguiente = h("button", { type: "button", class: "boton boton-secundario boton-chico", id: "btn-pagina-siguiente", disabled: respuesta.pagina + 1 >= respuesta.totalDePaginas, onclick: () => cargar(respuesta.pagina + 1) }, "Siguiente");
    cuerpo.append(
      h("div", { class: "tabla-scroll" },
        h("table", { class: "tabla-parametros", id: "tabla-historial" },
          h("thead", {}, h("tr", {}, ["Fecha", "Origen", "Estado", "Humedad", "Luz", "Temperatura"].map((t) => h("th", { scope: "col" }, t)))),
          h("tbody", {}, filas),
        ),
      ),
      h("div", { class: "paginacion" }, anterior,
        h("span", { id: "info-pagina" }, `Página ${respuesta.pagina + 1} de ${respuesta.totalDePaginas} · ${respuesta.total} registro${respuesta.total === 1 ? "" : "s"}`),
        siguiente),
    );
  }

  async function cargar(numero = pagina) {
    try {
      const respuesta = await obtenerHistorial(plantaId, numero, TAMANO);
      if (!ctx.vigente()) return;
      // Si la página pedida ya no existe (se eliminó algo), volver a la última.
      if (respuesta.contenido.length === 0 && respuesta.total > 0 && numero > 0) {
        await cargar(respuesta.totalDePaginas - 1);
        return;
      }
      pagina = respuesta.pagina;
      aviso.limpiar();
      pintar(respuesta);
    } catch (error) {
      if (ctx.vigente()) aviso.mostrar(error);
    }
  }

  return { elemento, cargar: () => cargar(pagina), irAPrimera: () => cargar(0) };
}
