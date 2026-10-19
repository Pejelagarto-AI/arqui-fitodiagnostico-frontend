// Detalle de una planta: diagnóstico vigente (actualizado por sondeo), historial,
// y, según el rol, medir / compartir / editar (dueño) o renunciar (invitado).
// El invitado ve todo en solo lectura: los paneles de modificación ni se crean
// (el backend igual los rechazaría con 403, D36).
import { obtenerPlanta, obtenerEspecies, renunciarAPlanta } from "../api.js";
import { h, crearAviso, conCarga, confirmar, toast } from "../ui.js";
import { crearPanelVigente } from "../componentes/planta-vigente.js";
import { crearPanelHistorial } from "../componentes/planta-historial.js";
import { crearPanelMedicion } from "../componentes/planta-medicion.js";
import { crearPanelCompartir } from "../componentes/planta-compartir.js";
import { crearPanelEdicion } from "../componentes/planta-edicion.js";
import { crearSondeo, textoActualizado } from "../sondeo.js";

export const titulo = "Planta";

// El estado de la planta se actualiza por sondeo (R6): cada INTERVALO_SONDEO_MS se pide el
// diagnóstico vigente y la página actual del historial. El WebSocket queda solo para los
// avisos (toasts y ACCESO_PERDIDO), que llegan por app.js. El indicador reusa los
// data-estado del indicador de conexión: conectado = al día, reconectando = fallando.
const ESTADO_DEL_INDICADOR = { activo: "conectado", error: "reconectando", detenido: "rechazado", pausado: "inactivo" };

export async function montar(contenedor, ctx) {
  const id = ctx.params.id;
  let planta;
  try {
    planta = await obtenerPlanta(id);
  } catch (error) {
    // 404: no existe o no es tuya ni compartida contigo (D35); el mensaje del cuerpo lo explica.
    if (!ctx.vigente()) return;
    const aviso = crearAviso();
    aviso.mostrar(error);
    contenedor.append(
      h("section", { class: "tarjeta" }, h("h2", { "data-titulo": "" }, "No se pudo abrir la planta"), aviso.elemento, h("p", {}, h("a", { href: "#/plantas" }, "Volver a mis plantas"))),
    );
    return;
  }
  if (!ctx.vigente()) return;

  // ---- encabezado ----
  const nombreNodo = h("span", { id: "planta-nombre" }, planta.apodo);
  const especieNodo = h("span", { id: "planta-especie-texto", class: "texto-suave" }, planta.especie);
  const estadoVivo = h("span", { class: "indicador-conexion", id: "indicador-planta", "data-estado": "conectando" });
  const textoVivo = h("span", { id: "texto-actualizado" }, "actualizando…");
  estadoVivo.append(h("span", { class: "punto-conexion", "aria-hidden": "true" }), textoVivo);
  const avisoCabecera = crearAviso();

  const cabecera = h("section", { class: "tarjeta" },
    h("div", { class: "encabezado-seccion" },
      h("h2", { "data-titulo": "" }, nombreNodo),
      planta.esDueno ? null : h("span", { class: "chip chip--riesgo", id: "etiqueta-compartida" }, "Compartida contigo · solo lectura"),
    ),
    h("p", {}, especieNodo),
    estadoVivo,
    avisoCabecera.elemento,
  );

  const vigente = crearPanelVigente(id, ctx);
  const historial = crearPanelHistorial(id, ctx);
  contenedor.append(h("p", {}, h("a", { href: "#/plantas" }, "← Mis plantas")), cabecera, vigente.elemento);

  const limpiezas = [];

  // ---- paneles según el rol ----
  let compartir = null;
  if (planta.esDueno) {
    let rangos = null;
    try {
      const especies = await obtenerEspecies();
      const coincide = especies.find((e) => e.nombre === planta.especie);
      rangos = coincide ? coincide.rangos : null;
    } catch {
      // los rangos son una ayuda: sin ellos igual se puede medir
    }
    if (!ctx.vigente()) return;

    contenedor.append(crearPanelMedicion(planta, ctx, {
      rangos,
      alRegistrar: () => {
        // El POST ya guardó: se pide el vigente y el historial sin esperar al próximo sondeo.
        Promise.all([vigente.cargar({ resaltar: true }), historial.irAPrimera()]);
      },
    }));
    contenedor.append(historial.elemento);
    compartir = crearPanelCompartir(planta, ctx);
    contenedor.append(compartir.elemento);
    const edicion = await crearPanelEdicion(planta, ctx, {
      alEditar: (editada) => {
        planta = editada;
        nombreNodo.textContent = editada.apodo;
        especieNodo.textContent = editada.especie;
      },
    });
    if (!ctx.vigente()) return;
    contenedor.append(edicion);
  } else {
    contenedor.append(historial.elemento);
    const avisoRenuncia = crearAviso();
    const botonRenunciar = h("button", { type: "button", class: "boton boton-secundario", id: "btn-renunciar" }, "Dejar de ver esta planta");
    botonRenunciar.addEventListener("click", async () => {
      avisoRenuncia.limpiar();
      if (!(await confirmar(`Dejarás de ver «${planta.apodo}». Para volver a verla necesitarás otra invitación.`, { aceptar: "Dejar de verla", peligro: true }))) return;
      try {
        await conCarga(botonRenunciar, "Saliendo…", () => renunciarAPlanta(id));
        toast("Ya no ves esa planta.");
        ctx.irA("/plantas");
      } catch (error) {
        avisoRenuncia.mostrar(error);
      }
    });
    contenedor.append(h("section", { class: "tarjeta" }, h("h2", {}, "Acceso"), h("p", { class: "texto-suave" }, "Ves esta planta porque su dueño te invitó. No puedes modificarla."), avisoRenuncia.elemento, botonRenunciar));
  }

  // ---- datos y sondeo (R6) ----
  await Promise.all([vigente.cargar(), historial.cargar(), compartir ? compartir.cargar() : null]);
  if (!ctx.vigente()) return;

  let estadoSondeo = "activo";
  const pintarIndicador = () => {
    estadoVivo.dataset.estado = ESTADO_DEL_INDICADOR[estadoSondeo] || "conectando";
    if (estadoSondeo === "error") textoVivo.textContent = "sin conexión con el servidor, reintentando…";
    else if (estadoSondeo === "detenido") textoVivo.textContent = "actualización detenida";
    else if (estadoSondeo === "pausado") textoVivo.textContent = "en pausa (pestaña oculta)";
    else textoVivo.textContent = textoActualizado(sondeo.ultimoExito());
  };

  const sondeo = crearSondeo({
    // Ya se cargó arriba: la primera vuelta espera un intervalo. Un fallo cambia el
    // indicador y el aviso de la cabecera (uno solo, que se reemplaza); nunca un toast.
    tarea: () => Promise.all([vigente.cargar({ resaltar: true, silencioso: true }), historial.refrescar()]),
    alCambiar: ({ estado, error }) => {
      estadoSondeo = estado;
      if (estado === "error" || estado === "detenido") avisoCabecera.mostrar(error);
      else if (estado === "activo") avisoCabecera.limpiar();
      pintarIndicador();
    },
  });
  sondeo.iniciar({ inmediato: false, cargadoEn: Date.now() });
  pintarIndicador();
  // «actualizado hace Xs» corre solo en pantalla, sin pedir nada.
  const reloj = setInterval(() => {
    if (estadoSondeo === "activo") pintarIndicador();
  }, 1000);
  limpiezas.push(() => sondeo.detener(), () => clearInterval(reloj));

  // Si el dueño me quita el acceso o elimina la planta, esta pantalla ya no tiene sentido.
  const alAviso = (evento) => {
    const { tipo, datos } = evento.detail;
    if (tipo === "ACCESO_PERDIDO" && datos && datos.plantaId === id) ctx.irA("/plantas");
  };
  window.addEventListener("fito:aviso", alAviso);
  limpiezas.push(() => window.removeEventListener("fito:aviso", alAviso));

  return () => limpiezas.forEach((limpiar) => limpiar());
}
