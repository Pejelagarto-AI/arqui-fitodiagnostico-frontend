// RF-E1, RF-E3, RF-E5 (dueño): generar el enlace de invitación, ver y revocar
// las invitaciones pendientes, y ver y revocar a los invitados.
import { generarInvitacion, listarInvitaciones, revocarInvitacion, listarInvitados, revocarInvitado } from "../api.js";
import { h, vaciar, campo, crearAviso, crearNota, conCarga, confirmar, copiarAlPortapapeles, formatearFecha, limpiarErroresDeFormulario, marcarCampoConError, toast } from "../ui.js";

export function crearPanelCompartir(planta, ctx) {
  const avisoGenerar = crearAviso();
  const avisoListas = crearAviso();
  const resultado = h("div", { id: "enlace-generado" });
  const pendientes = h("div", { id: "lista-pendientes" });
  const invitados = h("div", { id: "lista-invitados" });

  const correo = campo({ id: "inv-correo-destino", nombre: "correo", etiqueta: "Correo del invitado (opcional)", tipo: "email", requerido: false, maxlength: "254", ayuda: "Si lo pones, el backend también le envía el enlace por correo. Sin correo, tú repartes el enlace." });
  const boton = h("button", { type: "submit", class: "boton boton-primario", id: "btn-generar-enlace" }, "Generar enlace de invitación");
  const formulario = h("form", { id: "formulario-compartir", novalidate: true }, correo.contenedor, avisoGenerar.elemento, boton);

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErroresDeFormulario(formulario);
    avisoGenerar.limpiar();
    try {
      const invitacion = await conCarga(boton, "Generando…", () => generarInvitacion(planta.id, correo.input.value.trim()));
      if (!ctx.vigente()) return;
      formulario.reset();
      pintarEnlace(invitacion);
      await cargarListas();
    } catch (error) {
      if (!marcarCampoConError(formulario, error)) avisoGenerar.mostrar(error);
    }
  });

  function pintarEnlace(invitacion) {
    vaciar(resultado);
    const campoEnlace = h("input", { type: "text", readonly: true, id: "valor-enlace", "aria-label": "Enlace de invitación" });
    campoEnlace.value = invitacion.enlace;
    const nota = crearNota();
    const botonCopiar = h("button", { type: "button", class: "boton boton-secundario", id: "btn-copiar-enlace" }, "Copiar");
    botonCopiar.addEventListener("click", async () => {
      const copiado = await copiarAlPortapapeles(invitacion.enlace);
      if (copiado) nota.mostrar("Enlace copiado.");
      else {
        campoEnlace.select();
        nota.mostrar("No se pudo copiar solo: el enlace quedó seleccionado, cópialo con Ctrl+C.");
      }
    });
    resultado.append(
      h("div", { class: "enlace-copiable" }, campoEnlace, botonCopiar),
      nota.elemento,
      h("p", { class: "texto-suave" },
        `Se muestra una sola vez y sirve para una persona. Vence ${formatearFecha(invitacion.expiraEn)}.`,
        invitacion.correoDestino ? ` Se envió también a ${invitacion.correoDestino}.` : "",
      ),
    );
  }

  async function revocarPendiente(invitacion) {
    if (!(await confirmar("¿Revocar esta invitación? El enlace dejará de funcionar.", { aceptar: "Revocar", peligro: true }))) return;
    try {
      await revocarInvitacion(planta.id, invitacion.id);
      toast("Invitación revocada.");
      await cargarListas();
    } catch (error) {
      // La lista pudo quedar vieja (p. ej. el enlace ya se aceptó): se actualiza y se explica el error.
      await cargarListas();
      avisoListas.mostrar(error);
    }
  }

  async function revocarAcceso(invitado) {
    if (!(await confirmar(`¿Quitarle el acceso a ${invitado.nombre}? Se le avisará.`, { aceptar: "Quitar acceso", peligro: true }))) return;
    try {
      await revocarInvitado(planta.id, invitado.id);
      toast("Acceso revocado.");
      await cargarListas();
    } catch (error) {
      await cargarListas();
      avisoListas.mostrar(error);
    }
  }

  async function cargarListas() {
    try {
      const [pend, inv] = await Promise.all([listarInvitaciones(planta.id), listarInvitados(planta.id)]);
      if (!ctx.vigente()) return;
      avisoListas.limpiar();
      vaciar(pendientes);
      vaciar(invitados);
      const vigentes = pend.filter((i) => i.estado === "PENDIENTE");
      pendientes.append(
        vigentes.length === 0
          ? h("p", { class: "texto-vacio" }, "No hay invitaciones pendientes.")
          : h("ul", { class: "lista-limpia" }, vigentes.map((i) =>
              h("li", { class: "fila fila--separada" },
                h("span", {}, `Creada ${formatearFecha(i.creadaEn)} · vence ${formatearFecha(i.expiraEn)}`, i.correoDestino ? ` · para ${i.correoDestino}` : ""),
                h("button", { type: "button", class: "boton boton-secundario boton-chico", "data-accion": "revocar-invitacion", onclick: () => revocarPendiente(i) }, "Revocar"),
              ))),
      );
      invitados.append(
        inv.length === 0
          ? h("p", { class: "texto-vacio" }, "Nadie más ve esta planta.")
          : h("ul", { class: "lista-limpia" }, inv.map((i) =>
              h("li", { class: "fila fila--separada" },
                h("span", {}, h("strong", {}, i.nombre), ` · ${i.correo} · desde ${formatearFecha(i.otorgadoEn)}`),
                h("button", { type: "button", class: "boton boton-secundario boton-chico", "data-accion": "revocar-invitado", onclick: () => revocarAcceso(i) }, "Quitar acceso"),
              ))),
      );
    } catch (error) {
      if (ctx.vigente()) avisoListas.mostrar(error);
    }
  }

  const elemento = h("section", { class: "tarjeta", "aria-labelledby": "titulo-compartir" },
    h("h2", { id: "titulo-compartir" }, "Compartir"),
    h("p", { class: "texto-suave" }, "Quien acepte el enlace verá la planta en solo lectura."),
    formulario,
    resultado,
    avisoListas.elemento,
    h("h3", {}, "Invitaciones pendientes"),
    pendientes,
    h("h3", {}, "Personas con acceso"),
    invitados,
  );
  return { elemento, cargar: cargarListas };
}
