// RF-H3 y RF-H4: solicitudes de especie pendientes; aprobar o rechazar con respuesta.
// Aprobar NO da de alta la especie (eso es POST /admin/especies): por eso, tras
// aprobar se ofrece ir a crearla con el nombre ya puesto.
import { adminListarSolicitudes, adminAprobarSolicitud, adminRechazarSolicitud } from "../api.js";
import { h, vaciar, campo, crearAviso, formatearFecha, toast } from "../ui.js";

export const titulo = "Solicitudes de especie";

export async function montar(contenedor, ctx) {
  const aviso = crearAviso();
  const lista = h("div", { id: "lista-pendientes-admin" });

  function tarjetaDe(s) {
    const avisoFila = crearAviso();
    const respuesta = campo({ id: `resp-${s.id}`, nombre: "respuesta", etiqueta: "Respuesta para quien la pidió (opcional)", tipo: "textarea", requerido: false, maxlength: "1000" });
    const aprobar = h("button", { type: "button", class: "boton boton-primario", "data-accion": "aprobar" }, "Aprobar");
    const rechazar = h("button", { type: "button", class: "boton boton-secundario", "data-accion": "rechazar" }, "Rechazar");
    const resolver = async (aprobada) => {
      avisoFila.limpiar();
      aprobar.disabled = true;
      rechazar.disabled = true;
      try {
        const texto = respuesta.input.value.trim();
        await (aprobada ? adminAprobarSolicitud(s.id, texto) : adminRechazarSolicitud(s.id, texto));
        toast(`Solicitud de «${s.nombre}» ${aprobada ? "aprobada" : "rechazada"}.`);
        if (aprobada) ctx.irA(`/admin/especies?nueva=${encodeURIComponent(s.nombre)}`);
        else await cargar();
      } catch (error) {
        avisoFila.mostrar(error);
        aprobar.disabled = false;
        rechazar.disabled = false;
        if (error.status === 409 || error.status === 404) await cargar(); // ya resuelta u otra cosa: refrescar
      }
    };
    aprobar.addEventListener("click", () => resolver(true));
    rechazar.addEventListener("click", () => resolver(false));
    return h("li", { class: "solicitud-item", "data-solicitud": s.id },
      h("p", {}, h("strong", {}, s.nombre), h("span", { class: "texto-suave" }, ` · enviada ${formatearFecha(s.creadaEn)}`)),
      s.justificacion ? h("p", { class: "texto-suave" }, s.justificacion) : null,
      respuesta.contenedor,
      avisoFila.elemento,
      h("div", { class: "acciones" }, aprobar, rechazar),
    );
  }

  async function cargar() {
    try {
      const pendientes = await adminListarSolicitudes();
      if (!ctx.vigente()) return;
      aviso.limpiar();
      vaciar(lista);
      lista.append(
        pendientes.length === 0
          ? h("p", { class: "texto-vacio" }, "No hay solicitudes pendientes.")
          : h("ul", { class: "lista-limpia" }, pendientes.map(tarjetaDe)),
      );
    } catch (error) {
      if (ctx.vigente()) aviso.mostrar(error);
    }
  }

  contenedor.append(
    h("p", {}, h("a", { href: "#/admin" }, "← Administración")),
    h("section", { class: "tarjeta tarjeta--ancha" },
      h("h2", { "data-titulo": "" }, "Solicitudes pendientes"),
      h("p", { class: "texto-suave" }, "Aprobar avisa al solicitante, pero no crea la especie: te llevamos a crearla con el nombre ya escrito."),
      aviso.elemento,
      lista,
    ),
  );
  await cargar();
}
