// RF-H1 y RF-H2: pedir una especie nueva y ver el estado de mis solicitudes.
import { enviarSolicitudDeEspecie, listarMisSolicitudes } from "../api.js";
import { h, vaciar, campo, crearAviso, crearNota, conCarga, chipDeSolicitud, formatearFecha, limpiarErroresDeFormulario, marcarCampoConError } from "../ui.js";

export const titulo = "Solicitar especie";

function itemDeSolicitud(s) {
  return h("li", { class: "solicitud-item" },
    h("div", { class: "fila" }, h("strong", {}, s.nombre), chipDeSolicitud(s.estado)),
    s.justificacion ? h("p", { class: "texto-suave" }, s.justificacion) : null,
    s.respuesta ? h("p", {}, h("em", {}, "Respuesta del administrador: "), s.respuesta) : null,
    h("p", { class: "texto-suave" }, `Enviada ${formatearFecha(s.creadaEn)}`, s.resueltaEn ? ` · resuelta ${formatearFecha(s.resueltaEn)}` : ""),
  );
}

export async function montar(contenedor, ctx) {
  const avisoForm = crearAviso();
  const notaForm = crearNota();
  const avisoLista = crearAviso();
  const lista = h("div", { id: "lista-solicitudes" });

  const nombre = campo({ id: "solicitud-nombre", nombre: "nombre", etiqueta: "Nombre de la especie", maxlength: "120" });
  const justificacion = campo({ id: "solicitud-justificacion", nombre: "justificacion", etiqueta: "Justificación (opcional)", tipo: "textarea", requerido: false, maxlength: "1000", ayuda: "Por qué la necesitas o dónde encontrar sus rangos ideales." });
  const boton = h("button", { type: "submit", class: "boton boton-primario", id: "btn-enviar-solicitud" }, "Enviar solicitud");
  const formulario = h("form", { id: "formulario-solicitud", novalidate: true }, nombre.contenedor, justificacion.contenedor, avisoForm.elemento, notaForm.elemento, boton);

  async function cargar() {
    try {
      const solicitudes = await listarMisSolicitudes();
      if (!ctx.vigente()) return;
      avisoLista.limpiar();
      vaciar(lista);
      lista.append(
        solicitudes.length === 0
          ? h("p", { class: "texto-vacio" }, "Todavía no has enviado solicitudes.")
          : h("ul", { class: "lista-limpia" }, solicitudes.map(itemDeSolicitud)),
      );
    } catch (error) {
      if (ctx.vigente()) avisoLista.mostrar(error);
    }
  }

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErroresDeFormulario(formulario);
    avisoForm.limpiar();
    notaForm.limpiar();
    try {
      await conCarga(boton, "Enviando…", () => enviarSolicitudDeEspecie(nombre.input.value.trim(), justificacion.input.value.trim()));
      formulario.reset();
      notaForm.mostrar("Solicitud enviada. Te avisaremos cuando la resuelvan.");
      await cargar();
    } catch (error) {
      if (!marcarCampoConError(formulario, error)) avisoForm.mostrar(error);
    }
  });

  contenedor.append(
    h("section", { class: "tarjeta" }, h("h2", { "data-titulo": "" }, "Solicitar una especie"), formulario),
    h("section", { class: "tarjeta" }, h("h2", {}, "Mis solicitudes"), avisoLista.elemento, lista),
  );
  await cargar();

  // RF-H5: cuando resuelven una solicitud llega el aviso en vivo y la lista se actualiza.
  const alAviso = (evento) => {
    if (evento.detail.tipo === "SOLICITUD_RESUELTA") cargar();
  };
  window.addEventListener("fito:aviso", alAviso);
  return () => window.removeEventListener("fito:aviso", alAviso);
}
