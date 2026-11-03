// RF-D4 y RF-D5 (dueño): editar el apodo o la especie, y eliminar la planta.
import { obtenerEspecies, editarPlanta, eliminarPlanta } from "../api.js";
import { h, campo, campoSelect, crearAviso, crearNota, conCarga, confirmar, limpiarErroresDeFormulario, marcarCampoConError, toast } from "../ui.js";

export async function crearPanelEdicion(planta, ctx, { alEditar }) {
  const aviso = crearAviso();
  const nota = crearNota();
  const avisoBorrar = crearAviso();

  let especies = [];
  try {
    especies = await obtenerEspecies();
  } catch (error) {
    aviso.mostrar(error);
  }
  const nombres = new Set(especies.map((e) => e.nombre));
  // Si la especie de la planta ya fue desactivada no está en el catálogo activo: se ofrece igual, marcada.
  const opciones = especies.map((e) => ({ valor: e.nombre, texto: e.nombre }));
  if (!nombres.has(planta.especie)) opciones.unshift({ valor: planta.especie, texto: `${planta.especie} (descontinuada)` });

  let vigente = planta; // lo último que confirmó el servidor: a eso se vuelve si un cambio optimista falla
  const apodo = campo({ id: "editar-apodo", nombre: "apodo", etiqueta: "Apodo", valor: planta.apodo, maxlength: "60" });
  const especie = campoSelect({ id: "editar-especie", nombre: "especie", etiqueta: "Especie", opciones, valor: planta.especie });
  const boton = h("button", { type: "submit", class: "boton boton-secundario", id: "btn-guardar-planta" }, "Guardar cambios");
  const formulario = h("form", { id: "formulario-editar-planta", novalidate: true }, apodo.contenedor, especie.contenedor, aviso.elemento, nota.elemento, boton);

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErroresDeFormulario(formulario);
    aviso.limpiar();
    nota.limpiar();
    const nuevoApodo = apodo.input.value.trim();
    const antes = vigente;
    // Actualización optimista (F23): el nombre y la especie de la cabecera cambian al instante y, si el
    // servidor rechaza el cambio, vuelven a lo que había. Con el apodo vacío no se adelanta nada: es un
    // error que el servidor (y el formulario) explican junto al campo.
    if (nuevoApodo) alEditar({ ...vigente, apodo: nuevoApodo, especie: especie.select.value });
    try {
      const editada = await conCarga(boton, "Guardando…", () => editarPlanta(planta.id, nuevoApodo, especie.select.value));
      if (!ctx.vigente()) return;
      vigente = editada;
      nota.mostrar("Cambios guardados.");
      alEditar(editada);
    } catch (error) {
      if (ctx.vigente()) alEditar(antes);
      if (!marcarCampoConError(formulario, error)) aviso.mostrar(error);
    }
  });

  const botonBorrar = h("button", { type: "button", class: "boton boton-peligro", id: "btn-eliminar-planta" }, "Eliminar planta");
  botonBorrar.addEventListener("click", async () => {
    avisoBorrar.limpiar();
    const acepta = await confirmar(`Se eliminará «${vigente.apodo}» con todo su historial. Quienes la ven por invitación perderán el acceso. No se puede deshacer.`, { aceptar: "Eliminar planta", peligro: true });
    if (!acepta) return;
    try {
      await conCarga(botonBorrar, "Eliminando…", () => eliminarPlanta(planta.id));
      toast(`Planta «${vigente.apodo}» eliminada.`);
      ctx.irA("/plantas");
    } catch (error) {
      avisoBorrar.mostrar(error);
    }
  });

  return h("section", { class: "tarjeta", "aria-labelledby": "titulo-editar" },
    h("h2", { id: "titulo-editar" }, "Ajustes de la planta"),
    formulario,
    h("div", { class: "zona-peligro" },
      h("h3", {}, "Eliminar planta"),
      h("p", { class: "texto-suave" }, "Borra la planta y todo su historial. No se puede deshacer."),
      avisoBorrar.elemento,
      botonBorrar,
    ),
  );
}
