// RF-F4: diagnóstico vigente de una planta. Cubre el caso "sin diagnóstico"
// (D45: el backend responde 200 con hayDiagnostico:false, no 404).
import { obtenerDiagnosticoVigente } from "../api.js";
import { h, vaciar, crearAviso, formatearFechaRelativa, esqueletoSiTarda } from "../ui.js";
import { entrada, llenarBarra, contar } from "../animaciones.js";
import { crearVistaDeDiagnostico, DIAGNOSTICO_DE_ESQUELETO } from "./diagnostico.js";

const ORIGENES = { MANUAL: "medición manual", DISPOSITIVO: "dispositivo" };

export function crearPanelVigente(plantaId, ctx, { alCambiarEstado = () => {} } = {}) {
  // Identidad de lo pintado: el sondeo vuelve a pedir lo mismo cada pocos segundos
  // y no hay por qué repintar (ni parpadear) si no cambió nada.
  let pintado = null;
  let serie = null; // última página 0 del historial (la trae el sondeo) para las minigráficas
  let vista = null;
  const aviso = crearAviso();
  // Mientras llega el primer diagnóstico: el mismo componente con datos de mentira, como esqueleto que
  // solo se ve si la carga pasa de 300 ms. El texto para lectores de pantalla está desde el principio.
  const esqueleto = h("div", { class: "esqueleto-diagnostico" }, crearVistaDeDiagnostico(DIAGNOSTICO_DE_ESQUELETO, { resumen: true, esqueleto: true }).nodo);
  const cancelarEsqueleto = esqueletoSiTarda(esqueleto);
  const cuerpo = h("div", { id: "diagnostico-vigente", "aria-live": "polite", "aria-busy": "true" }, h("p", { class: "solo-lector" }, "Cargando diagnóstico…"), esqueleto);
  const elemento = h("section", { class: "bloque-vigente", "aria-labelledby": "titulo-vigente" }, h("h2", { id: "titulo-vigente", class: "titulo-bloque" }, "Cómo está hoy"), aviso.elemento, cuerpo);

  function terminarCarga() {
    cancelarEsqueleto();
    cuerpo.removeAttribute("aria-busy");
  }

  function pintar(respuesta, resaltar) {
    terminarCarga();
    const identidad = respuesta.hayDiagnostico ? respuesta.diagnostico.id : "sin-diagnostico";
    if (identidad === pintado) return;
    // Resaltar solo si ya había algo pintado y llegó otro (no en la primera carga).
    const hayCambio = pintado !== null;
    pintado = identidad;
    resaltar = resaltar && hayCambio;
    vaciar(cuerpo);
    vista = null;
    alCambiarEstado(respuesta.hayDiagnostico ? respuesta.diagnostico.diagnostico : null, { cambio: hayCambio });
    if (!respuesta.hayDiagnostico) {
      cuerpo.append(
        h("div", { class: "sin-diagnostico", id: "sin-diagnostico" },
          h("p", {}, h("strong", {}, "Sin diagnóstico todavía.")),
          h("p", { class: "texto-suave" }, respuesta.mensaje || "Registra una medición para obtener el primero."),
        ),
      );
      return;
    }
    const registro = respuesta.diagnostico;
    vista = crearVistaDeDiagnostico(registro.diagnostico, { serie, resumen: true });
    const contenido = h("div", {},
      h("p", { class: "texto-suave", id: "meta-vigente" }, `Registrado ${formatearFechaRelativa(registro.registradoEn)} · ${ORIGENES[registro.origen] || registro.origen}`),
      vista.nodo,
    );
    cuerpo.append(contenido);
    // Las burbujas entran escalonadas; la barra se llena y el número cuenta (el valor real ya está en el DOM).
    vista.burbujas.forEach((b, i) => {
      llenarBarra(b.relleno, { retraso: 0.12 * i });
      contar(b.valorReal.parentElement, b.parametro.valor, { retraso: 0.12 * i });
    });
    entrada(vista.burbujas.map((b) => b.nodo), { y: 14, escalon: 0.08 });
    entrada(vista.nodo.querySelectorAll(".recom li"), { y: 8, duracion: 0.35, escalon: 0.08, retraso: 0.4 });
  }

  // `silencioso`: lo usa el sondeo, que decide qué mostrar cuando falla; aquí solo relanza el error.
  async function cargar({ resaltar = false, silencioso = false } = {}) {
    try {
      const respuesta = await obtenerDiagnosticoVigente(plantaId);
      if (!ctx.vigente()) return;
      aviso.limpiar();
      pintar(respuesta, resaltar);
    } catch (error) {
      if (silencioso) throw error;
      if (ctx.vigente()) {
        // Sin nada pintado todavía, el esqueleto no debe quedarse girando bajo el aviso de error.
        if (pintado === null) {
          terminarCarga();
          vaciar(cuerpo);
        }
        aviso.mostrar(error);
      }
    }
  }

  /** Página 0 del historial (más reciente primero): alimenta las minigráficas de tendencia. */
  function ponerSerie(registros) {
    serie = registros;
    if (vista) vista.actualizarSerie(registros);
  }

  return { elemento, cargar, ponerSerie };
}
