// RF-F6: diagnóstico de una medición suelta, sin cuenta ni planta (#/diagnostico). Es el «Prueba sin cuenta»
// de la portada (F38): quien todavía no tiene matera escribe lo que midió y la planta le dice cómo está.
// Dos momentos en la misma ruta, uno a la vez: el formulario (qué planta es y los tres valores, cada uno con
// su explicación) y el resultado (la planta ilustrada reaccionando, lo que «dice», los tres valores contra su
// rango y qué hacer), con la invitación a crear cuenta para guardar el historial.
import { obtenerEspecies, diagnosticar } from "../api.js";
import * as sesion from "../sesion.js";
import { h, vaciar, crearAviso, limpiarErroresDeFormulario, marcarCampoConError, conCarga } from "../ui.js";
import { camposDeMedicion } from "../componentes/medicion.js";
import { crearCarruselEspecies } from "../componentes/carrusel-especies.js";
import { opcionesDeEspecies } from "../componentes/carrusel-estado.js";
import { crearVistaDeDiagnostico } from "../componentes/diagnostico.js";
import { crearIlustracionPlanta } from "../componentes/ilustracion-planta.js";
import { esCarnivora } from "../componentes/especie.js";
import { nivelesDeDiagnostico } from "../componentes/escala.js";
import { fraseDePlanta } from "../voz-planta.js";
import { balancear, entrada, llenarBarra, contar } from "../animaciones.js";

export const titulo = "Diagnóstico sin cuenta";

export async function montar(contenedor, ctx) {
  const conSesion = sesion.haySesion();
  let especiesPorNombre = new Map();
  let pararBalanceo = () => {};

  const avisoEspecies = crearAviso();
  const avisoGeneral = crearAviso();
  // F42: carrusel de mascotas; su <select> oculto conserva el id «especie-select», el name y el evento change.
  const carrusel = crearCarruselEspecies({
    id: "especie-select",
    nombre: "especie",
    etiqueta: "¿Qué planta es?",
    ayuda: "Desliza y elige la tuya. Cada planta tiene sus valores ideales: los verás debajo de cada dato.",
  });
  const selectEspecie = carrusel.select;
  const medicion = camposDeMedicion("suelto");
  const boton = h("button", { type: "submit", id: "btn-diagnosticar", class: "boton boton-primario" }, "Ver cómo está");
  const btnReintentar = h("button", { type: "button", id: "btn-reintentar-especies", class: "boton boton-secundario" }, "Reintentar");

  const formulario = h(
    "form",
    { id: "formulario-diagnostico", novalidate: true },
    carrusel.contenedor,
    medicion.nodos,
    h("details", { class: "ayuda-plegable" },
      h("summary", {}, "¿Con qué mido esto?"),
      h("p", {}, "La humedad, con un medidor de los que se clavan en la tierra. La luz, con una app de luxómetro en el celular, apoyado junto a la planta. La temperatura, con cualquier termómetro de ambiente."),
      h("p", {}, "Con una matera Fitodiagnóstico no mides nada: ella lo hace sola y te avisa.")),
    avisoGeneral.elemento,
    h("div", { class: "accion-fija" }, boton),
  );

  // ---- momento 1: el formulario ----
  const pantallaFormulario = h("section", { class: "tarjeta tarjeta--angosta", id: "seccion-formulario", "aria-labelledby": "titulo-formulario" },
    h("h2", { id: "titulo-formulario", "data-titulo": "" }, "¿Cómo está tu planta?"),
    h("p", { class: "texto-suave entradilla" }, conSesion
      ? "Dinos qué mediste y te decimos cómo está. Esta medición es de prueba: no se guarda en ninguna de tus plantas."
      : "¿No tienes matera todavía? Dinos qué mediste y te decimos cómo está tu planta."),
    h("div", { class: "banner-error-con-accion" }, avisoEspecies.elemento, btnReintentar),
    formulario,
  );
  btnReintentar.hidden = true;

  // ---- momento 2: el resultado ----
  const zonaIlustracion = h("div", { class: "resultado-ilustracion", "aria-hidden": "true" });
  const frase = h("p", { class: "resultado-frase", id: "resultado-frase" });
  const tituloResultado = h("h2", { id: "titulo-resultado", tabindex: "-1" }, "Así está tu planta");
  const resultado = h("div", { id: "zona-resultado" });
  const invitacion = conSesion
    ? h("div", { class: "resultado-invitacion" },
        h("p", {}, "Para que quede en el historial, mídela desde su ficha: abre la planta y ve a «Más»."),
        h("a", { href: "#/plantas", class: "boton boton-secundario" }, "Ir a mis plantas"))
    : h("div", { class: "resultado-invitacion" },
        h("p", {}, h("strong", {}, "Esto fue una sola medición."), " Con una cuenta guardas el historial, ves cómo cambia y te avisamos qué hacer cada día."),
        h("a", { href: "#/registro", class: "boton boton-primario", id: "resultado-crear-cuenta" }, "Crear cuenta"));
  const otra = h("button", { type: "button", class: "boton boton-secundario", id: "btn-otra-medicion" }, "Probar con otra medición");
  const pantallaResultado = h("section", { class: "tarjeta tarjeta--angosta resultado-suelto", id: "seccion-resultado", "aria-labelledby": "titulo-resultado", hidden: true },
    h("div", { class: "resultado-cabeza" }, zonaIlustracion, h("div", { class: "resultado-voz" }, tituloResultado, h("div", { class: "resultado-globo" }, frase))),
    resultado,
    invitacion,
    otra,
  );

  contenedor.append(pantallaFormulario, pantallaResultado);

  function mostrarFormulario() {
    pararBalanceo();
    pararBalanceo = () => {};
    pantallaResultado.hidden = true;
    pantallaFormulario.hidden = false;
    window.scrollTo(0, 0);
    document.getElementById("titulo-formulario").focus({ preventScroll: true });
  }

  function mostrarResultado(diagnostico) {
    const especie = diagnostico.especie || selectEspecie.value;
    // La planta reacciona: nace en su estado neutro y se acomoda al diagnóstico (agua, sol, hojas).
    pararBalanceo();
    vaciar(zonaIlustracion);
    const ilustracion = crearIlustracionPlanta({ carnivora: esCarnivora(especie) });
    zonaIlustracion.append(ilustracion.nodo);
    tituloResultado.textContent = `Así está tu ${especie}`;
    frase.textContent = fraseDePlanta(diagnostico);
    pantallaResultado.dataset.estado = diagnostico.estado;

    vaciar(resultado);
    const vista = crearVistaDeDiagnostico(diagnostico);
    resultado.append(vista.nodo);

    pantallaFormulario.hidden = true;
    pantallaResultado.hidden = false;
    window.scrollTo(0, 0);
    tituloResultado.focus({ preventScroll: true });

    ilustracion.aplicar(ilustracion.estadoVisual({ estado: diagnostico.estado, ...nivelesDeDiagnostico(diagnostico) }), { animar: true });
    if (diagnostico.estado !== "SALUDABLE") ilustracion.morder();
    pararBalanceo = balancear(ilustracion.refs.grupoHojas);
    entrada([zonaIlustracion, frase.parentElement], { y: 10, escalon: 0.12 });
    vista.burbujas.forEach((b, i) => {
      llenarBarra(b.relleno, { retraso: 0.25 + 0.12 * i });
      contar(b.valorReal.parentElement, b.parametro.valor, { retraso: 0.25 + 0.12 * i });
    });
    entrada(vista.burbujas.map((b) => b.nodo), { y: 14, escalon: 0.08, retraso: 0.2 });
  }

  async function cargarEspecies() {
    avisoEspecies.limpiar();
    btnReintentar.hidden = true;
    carrusel.cargando("Cargando plantas…");
    try {
      const especies = await obtenerEspecies();
      if (!ctx.vigente()) return;
      especiesPorNombre = new Map(especies.map((e) => [e.nombre, e.rangos]));
      carrusel.poner(opcionesDeEspecies(especies));
    } catch (error) {
      if (!ctx.vigente()) return;
      carrusel.fallo("No se pudo cargar la lista de plantas");
      avisoEspecies.mostrar(error);
      btnReintentar.hidden = false;
    }
  }

  selectEspecie.addEventListener("change", () => medicion.mostrarRangos(especiesPorNombre.get(selectEspecie.value), selectEspecie.value));
  btnReintentar.addEventListener("click", cargarEspecies);
  otra.addEventListener("click", mostrarFormulario);

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErroresDeFormulario(formulario);
    avisoGeneral.limpiar();
    try {
      const diagnostico = await conCarga(boton, "Un momento…", () =>
        diagnosticar({ especie: selectEspecie.value, ...medicion.valores() }),
      );
      if (!ctx.vigente()) return;
      mostrarResultado(diagnostico);
    } catch (error) {
      if (!marcarCampoConError(formulario, error)) avisoGeneral.mostrar(error);
      // El primer campo con error queda a la vista y con el foco: el botón está abajo, el error puede estar arriba.
      const conError = formulario.querySelector("[aria-invalid='true']");
      if (conError) conError.focus();
    }
  });

  await cargarEspecies();
  return () => {
    pararBalanceo();
    carrusel.limpiar();
  };
}
