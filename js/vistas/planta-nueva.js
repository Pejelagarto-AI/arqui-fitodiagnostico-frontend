// RF-D1: registrar una planta. Solo se ofrecen las especies activas
// (GET /especies); si el backend igual rechaza una descontinuada, responde 409.
import { obtenerEspecies, registrarPlanta } from "../api.js";
import { invalidarCache } from "../cache.js";
import { h, campo, campoSelect, enlaceDeVolver, crearAviso, conCarga, limpiarErroresDeFormulario, marcarCampoConError } from "../ui.js";

export const titulo = "Tu planta nueva";

export async function montar(contenedor, ctx) {
  const aviso = crearAviso();
  const especies = await obtenerEspecies();
  if (!ctx.vigente()) return;

  const apodo = campo({ id: "planta-apodo", nombre: "apodo", etiqueta: "¿Cómo la llamas?", maxlength: "60", ayuda: "Un nombre para reconocerla: «la del balcón», «Lola»…" });
  const especie = campoSelect({
    id: "planta-especie",
    nombre: "especie",
    etiqueta: "¿Qué planta es?",
    opciones: [{ valor: "", texto: "Elige tu planta" }, ...especies.map((e) => ({ valor: e.nombre, texto: e.nombre }))],
  });
  const boton = h("button", { type: "submit", class: "boton boton-primario", id: "btn-registrar-planta" }, "Guardar y seguir");
  especie.contenedor.insertBefore(h("p", { class: "rango-optimo" }, "De esto dependen sus valores ideales de agua, luz y temperatura."), especie.contenedor.lastElementChild);

  const formulario = h("form", { id: "formulario-planta", novalidate: true }, apodo.contenedor, especie.contenedor, aviso.elemento,
    h("p", { class: "texto-suave" }, "Después te ayudamos a conectar su matera."),
    h("p", { class: "texto-suave" }, "¿No encuentras tu planta en la lista? ", h("a", { href: "#/solicitudes" }, "Pide que la agreguemos"), "."),
    h("div", { class: "accion-fija" }, boton));
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErroresDeFormulario(formulario);
    aviso.limpiar();
    try {
      const planta = await conCarga(boton, "Guardando…", () => registrarPlanta(apodo.input.value.trim(), especie.select.value));
      invalidarCache();
      // Recién creada, lo siguiente es darle su matera: el asistente (F36). «Hacerlo después» lleva al detalle.
      ctx.irA(`/plantas/${planta.id}/vincular`);
    } catch (error) {
      if (!marcarCampoConError(formulario, error)) aviso.mostrar(error);
    }
  });

  contenedor.append(
    enlaceDeVolver("/plantas", "Mis plantas"),
    h("section", { class: "tarjeta tarjeta--angosta" },
      h("h2", { "data-titulo": "" }, "Tu planta nueva"),
      h("p", { class: "texto-suave entradilla" }, "Cuéntanos cuál es y cómo la llamas."),
      formulario,
    ),
  );
}
