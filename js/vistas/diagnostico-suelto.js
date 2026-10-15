// RF-F6: diagnóstico de una medición suelta, sin cuenta ni planta. Es la
// pantalla original del corte 1; sigue accesible para cualquiera.
import { obtenerEspecies, diagnosticar } from "../api.js";
import { h, vaciar, crearAviso, limpiarErroresDeFormulario, marcarCampoConError, conCarga } from "../ui.js";
import { camposDeMedicion } from "../componentes/medicion.js";
import { pintarDiagnostico } from "../componentes/diagnostico.js";

export const titulo = "Diagnóstico rápido";

export async function montar(contenedor, ctx) {
  let especiesPorNombre = new Map();

  const avisoEspecies = crearAviso();
  const avisoGeneral = crearAviso();
  const selectEspecie = h("select", { id: "especie-select", name: "especie", required: true, "aria-describedby": "especie-select-error", disabled: true });
  const errorEspecie = h("p", { class: "error-campo", id: "especie-select-error", "aria-live": "polite" });
  const medicion = camposDeMedicion("suelto");
  const boton = h("button", { type: "submit", id: "btn-diagnosticar", class: "boton boton-primario" }, "Diagnosticar");
  const btnReintentar = h("button", { type: "button", id: "btn-reintentar-especies", class: "boton boton-secundario" }, "Reintentar");
  const resultado = h("div", { id: "zona-resultado" });

  const formulario = h(
    "form",
    { id: "formulario-diagnostico", novalidate: true },
    h("div", { class: "campo" }, h("label", { for: "especie-select" }, "Especie"), selectEspecie, errorEspecie),
    medicion.nodos,
    avisoGeneral.elemento,
    boton,
  );

  const cuerpoResultado = h("section", { class: "tarjeta", id: "seccion-resultado", "aria-labelledby": "titulo-resultado", "aria-live": "polite" },
    h("h2", { id: "titulo-resultado" }, "Diagnóstico"),
    resultado,
  );
  resultado.append(h("p", { class: "texto-vacio" }, "Todavía no hay ningún diagnóstico. Completa el formulario y consulta."));

  contenedor.append(
    h("section", { class: "tarjeta", "aria-labelledby": "titulo-formulario" },
      h("h2", { id: "titulo-formulario", "data-titulo": "" }, "Nueva medición"),
      h("p", { class: "texto-suave" }, "Sin cuenta: la medición no se guarda. Si quieres seguir tus plantas, ",
        h("a", { href: "#/registro" }, "crea una cuenta"), "."),
      h("div", { class: "banner-error-con-accion" }, avisoEspecies.elemento, btnReintentar),
      formulario,
    ),
    cuerpoResultado,
  );
  btnReintentar.hidden = true;

  function opcion(valor, texto, extra = {}) {
    return h("option", { value: valor, ...extra }, texto);
  }

  async function cargarEspecies() {
    avisoEspecies.limpiar();
    btnReintentar.hidden = true;
    selectEspecie.disabled = true;
    vaciar(selectEspecie);
    selectEspecie.append(opcion("", "Cargando especies…", { disabled: true, selected: true }));
    try {
      const especies = await obtenerEspecies();
      if (!ctx.vigente()) return;
      especiesPorNombre = new Map(especies.map((e) => [e.nombre, e.rangos]));
      vaciar(selectEspecie);
      selectEspecie.append(opcion("", "Selecciona una especie", { selected: true }));
      for (const especie of especies) selectEspecie.append(opcion(especie.nombre, especie.nombre));
      selectEspecie.disabled = false;
    } catch (error) {
      if (!ctx.vigente()) return;
      vaciar(selectEspecie);
      selectEspecie.append(opcion("", "No se pudieron cargar las especies", { disabled: true, selected: true }));
      avisoEspecies.mostrar(error);
      btnReintentar.hidden = false;
    }
  }

  selectEspecie.addEventListener("change", () => medicion.mostrarRangos(especiesPorNombre.get(selectEspecie.value)));
  btnReintentar.addEventListener("click", cargarEspecies);

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErroresDeFormulario(formulario);
    avisoGeneral.limpiar();
    try {
      const diagnostico = await conCarga(boton, "Consultando…", () =>
        diagnosticar({ especie: selectEspecie.value, ...medicion.valores() }),
      );
      if (!ctx.vigente()) return;
      pintarDiagnostico(resultado, diagnostico);
    } catch (error) {
      if (!marcarCampoConError(formulario, error)) avisoGeneral.mostrar(error);
    }
  });

  await cargarEspecies();
}
