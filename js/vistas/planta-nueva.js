// RF-D1: registrar una planta. Solo se ofrecen las especies activas
// (GET /especies); si el backend igual rechaza una descontinuada, responde 409.
import { obtenerEspecies, registrarPlanta } from "../api.js";
import { invalidarCache } from "../cache.js";
import { h, campo, campoSelect, crearAviso, conCarga, limpiarErroresDeFormulario, marcarCampoConError } from "../ui.js";

export const titulo = "Registrar planta";

export async function montar(contenedor, ctx) {
  const aviso = crearAviso();
  const especies = await obtenerEspecies();
  if (!ctx.vigente()) return;

  const apodo = campo({ id: "planta-apodo", nombre: "apodo", etiqueta: "Apodo", maxlength: "60", ayuda: "Como la llamas tú: «la del balcón», «Lola»…" });
  const especie = campoSelect({
    id: "planta-especie",
    nombre: "especie",
    etiqueta: "Especie",
    opciones: [{ valor: "", texto: "Selecciona una especie" }, ...especies.map((e) => ({ valor: e.nombre, texto: e.nombre }))],
  });
  const boton = h("button", { type: "submit", class: "boton boton-primario", id: "btn-registrar-planta" }, "Registrar");

  const formulario = h("form", { id: "formulario-planta", novalidate: true }, apodo.contenedor, especie.contenedor, aviso.elemento, boton);
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErroresDeFormulario(formulario);
    aviso.limpiar();
    try {
      const planta = await conCarga(boton, "Registrando…", () => registrarPlanta(apodo.input.value.trim(), especie.select.value));
      invalidarCache();
      // Recién creada, lo siguiente es darle su matera: el asistente (F36). «Hacerlo después» lleva al detalle.
      ctx.irA(`/plantas/${planta.id}/vincular`);
    } catch (error) {
      if (!marcarCampoConError(formulario, error)) aviso.mostrar(error);
    }
  });

  contenedor.append(
    h("section", { class: "tarjeta tarjeta--angosta" },
      h("h2", { "data-titulo": "" }, "Registrar planta"),
      formulario,
      h("p", { class: "texto-suave" }, "¿No está tu especie? ", h("a", { href: "#/solicitudes" }, "Pide que la agreguen"), "."),
      h("p", {}, h("a", { href: "#/plantas" }, "Volver a mis plantas")),
    ),
  );
}
