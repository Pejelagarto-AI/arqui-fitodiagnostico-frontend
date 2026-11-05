// Detalle de una planta, en pestañas (F37): una cabecera compacta con la planta y su estado y, debajo,
// «Hoy» (los tres valores y qué hacer), «Historial», «Matera» (solo el dueño) y «Más» (medir a mano,
// compartir y ajustes para el dueño; renunciar para el invitado). La pestaña activa vive en la URL
// (js/pestanas.js) y cambiar de pestaña no desmonta la pantalla: el sondeo y lo cargado siguen vivos.
// El invitado ve todo en solo lectura: los paneles de modificación ni se crean
// (el backend igual los rechazaría con 403, D36).
import { obtenerPlanta, obtenerEspecies, renunciarAPlanta } from "../api.js";
import { h, enlaceDeVolver, crearAviso, conCarga, confirmar, toast, ETIQUETAS_ESTADO_GLOBAL } from "../ui.js";
import { crearIlustracionPlanta } from "../componentes/ilustracion-planta.js";
import { nivelesDeDiagnostico } from "../componentes/escala.js";
import { crearPanelVigente } from "../componentes/planta-vigente.js";
import { crearPanelHistorial } from "../componentes/planta-historial.js";
import { crearPanelMedicion } from "../componentes/planta-medicion.js";
import { crearPanelCompartir } from "../componentes/planta-compartir.js";
import { crearPanelEdicion } from "../componentes/planta-edicion.js";
import { crearPanelDispositivos } from "../componentes/planta-dispositivos.js";
import { entrada, cambiarEstado, balancear } from "../animaciones.js";
import { crearSondeo, textoActualizado } from "../sondeo.js";
import { leerCache, guardarCache, invalidarCache, alVolver } from "../cache.js";
import { recargarVista } from "../router.js";
import { recordarPlantaActiva, nombrarParaTransicion, conTransicion } from "../transiciones.js";
import { pestanasDePlanta, pestanaValida, pestanaVecina, rutaDePestana, consultasDeSondeo, tituloDePestana } from "../pestanas.js";

export const titulo = "Planta";

// El estado de la planta se actualiza por sondeo (R6): cada INTERVALO_SONDEO_MS se pide el
// diagnóstico vigente y la página actual del historial. El WebSocket queda solo para los
// avisos (toasts y ACCESO_PERDIDO), que llegan por app.js. El indicador reusa los
// data-estado del indicador de conexión: conectado = al día, reconectando = fallando.
const ESTADO_DEL_INDICADOR = { activo: "conectado", error: "reconectando", detenido: "rechazado", pausado: "inactivo" };

export async function montar(contenedor, ctx) {
  const id = ctx.params.id;
  // Stale-while-revalidate (F26): la ficha de la planta (apodo, especie, rol) sale de la caché si ya se vio y
  // se revalida por detrás. El diagnóstico vigente y el historial NO se cachean: los trae el sondeo, siempre frescos.
  const clave = `planta:${id}`;
  let planta = leerCache(clave);
  let revalidacion = null;
  if (planta) {
    revalidacion = obtenerPlanta(id).then((fresca) => ({ fresca }), (error) => ({ error }));
  } else {
    try {
      planta = guardarCache(clave, await obtenerPlanta(id));
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
  }
  if (!ctx.vigente()) return;

  // ---- encabezado: nombre, estado global (lo primero que se ve) e indicador del sondeo ----
  const nombreNodo = h("span", { id: "planta-nombre" }, planta.apodo);
  const especieNodo = h("span", { id: "planta-especie-texto" }, planta.especie);
  const estadoNodo = h("p", { class: "estado-planta", id: "estado-planta", "data-estado": "SIN_DIAGNOSTICO" }, "Sin diagnóstico");
  const estadoVivo = h("span", { class: "indicador-conexion", id: "indicador-planta", "data-estado": "conectando" });
  const textoVivo = h("span", { id: "texto-actualizado" }, "actualizando…");
  estadoVivo.append(h("span", { class: "punto-conexion", "aria-hidden": "true" }), textoVivo);
  const avisoCabecera = crearAviso();

  const cabecera = h("section", { class: "tarjeta cabecera-planta" },
    h("div", { class: "cabecera-planta-ilustracion", id: "ilustracion-planta" }),
    h("div", { class: "cabecera-planta-texto" },
      h("h2", { "data-titulo": "" }, nombreNodo),
      h("p", { class: "cabecera-planta-especie" }, especieNodo),
      planta.esDueno ? null : h("span", { class: "chip chip--riesgo", id: "etiqueta-compartida" }, "Compartida contigo · solo lectura"),
      estadoNodo,
      estadoVivo,
      avisoCabecera.elemento,
    ),
  );

  // Llegó lo fresco de la ficha: si cambió el nombre o la especie se actualizan; si cambió el rol o ya no hay
  // acceso, los paneles que se armaron con lo viejo ya no valen y se vuelve a montar la pantalla.
  if (revalidacion) {
    revalidacion.then(({ fresca, error }) => {
      if (!ctx.vigente()) return;
      if (error) {
        if (error.status === 403 || error.status === 404) {
          invalidarCache();
          recargarVista();
        }
        return; // un fallo de red no tapa lo que ya se ve: el indicador del sondeo lo dirá
      }
      guardarCache(clave, fresca);
      if (fresca.esDueno !== planta.esDueno) {
        recargarVista();
        return;
      }
      planta = fresca;
      nombreNodo.textContent = fresca.apodo;
      especieNodo.textContent = fresca.especie;
    });
  }

  // La ilustración reacciona al diagnóstico vigente: agua = humedad, sol = luz, hojas = estado.
  const ilustracion = crearIlustracionPlanta();
  cabecera.querySelector("#ilustracion-planta").append(ilustracion.nodo);
  // Elemento compartido con la tarjeta del tablero (F28): al volver, esa tarjeta lleva el mismo nombre de transición.
  recordarPlantaActiva(id);
  nombrarParaTransicion(cabecera.querySelector("#ilustracion-planta"));
  let primeraVez = true;
  const ponerEstado = (diagnostico, { cambio = false } = {}) => {
    const estado = diagnostico ? diagnostico.estado : null;
    const aplicar = () => {
      estadoNodo.dataset.estado = estado || "SIN_DIAGNOSTICO";
      estadoNodo.textContent = estado ? ETIQUETAS_ESTADO_GLOBAL[estado] || estado : "Sin diagnóstico";
    };
    // Al abrir la pantalla el agua sube y las hojas se acomodan; al llegar una lectura distinta rebota la píldora.
    if (cambio) cambiarEstado(estadoNodo, aplicar);
    else aplicar();
    ilustracion.aplicar(ilustracion.estadoVisual({ estado, ...nivelesDeDiagnostico(diagnostico) }), { animar: primeraVez || cambio });
    primeraVez = false;
  };

  const vigente = crearPanelVigente(id, ctx, { alCambiarEstado: ponerEstado });
  // El sondeo ya trae la página del historial: de ahí salen las minigráficas (solo la primera, la más reciente).
  const historial = crearPanelHistorial(id, ctx, { alRecibir: (respuesta) => { if (respuesta.pagina === 0) vigente.ponerSerie(respuesta.contenido); } });

  // ---- pestañas (F37): la activa sale de la ruta; las que no se ven quedan con `hidden` ----
  const disponibles = pestanasDePlanta({ esDueno: planta.esDueno });
  const claves = disponibles.map((p) => p.clave);
  let activa = pestanaValida(ctx.entrada && ctx.entrada.pestana, disponibles);
  // Un invitado que abre .../matera (o una pestaña que no le toca) queda en «Hoy», y la URL lo dice.
  if (ctx.entrada && ctx.entrada.pestana !== activa) history.replaceState(null, "", `#${rutaDePestana(id, activa)}`);

  const botones = {};
  const paneles = {};
  for (const p of disponibles) {
    botones[p.clave] = h("a", {
      class: "pestana", role: "tab", id: `pestana-${p.clave}`, href: `#${rutaDePestana(id, p.clave)}`,
      "aria-controls": `panel-${p.clave}`, "data-pestana": p.clave,
    }, p.etiqueta);
    paneles[p.clave] = h("div", { class: "panel-pestana", role: "tabpanel", id: `panel-${p.clave}`, "aria-labelledby": `pestana-${p.clave}`, "data-pestana": p.clave });
  }
  const barraPestanas = h("div", { class: "pestanas", role: "tablist", "aria-label": "Secciones de la planta" }, disponibles.map((p) => botones[p.clave]));

  function aplicarPestana(clave) {
    activa = clave;
    for (const p of disponibles) {
      const es = p.clave === clave;
      botones[p.clave].setAttribute("aria-selected", String(es));
      botones[p.clave].tabIndex = es ? 0 : -1;
      paneles[p.clave].hidden = !es;
    }
    barraPestanas.dataset.activa = clave;
    document.title = `${tituloDePestana(planta.apodo, clave)} — Fitodiagnóstico`;
  }

  // Cambiar de pestaña reemplaza la entrada del historial del navegador: «atrás» sale de la planta (como en
  // una app) en vez de recorrer las pestañas visitadas, y recargar conserva la pestaña.
  const irAPestana = (clave) => ctx.irA(rutaDePestana(id, clave), { reemplazar: true });
  barraPestanas.addEventListener("click", (evento) => {
    const boton = evento.target instanceof Element ? evento.target.closest("[role=tab]") : null;
    if (!boton || evento.metaKey || evento.ctrlKey || evento.shiftKey) return; // abrir en otra pestaña del navegador sigue funcionando
    evento.preventDefault();
    irAPestana(boton.dataset.pestana);
  });
  barraPestanas.addEventListener("keydown", (evento) => {
    const boton = evento.target instanceof Element ? evento.target.closest("[role=tab]") : null;
    if (!boton) return;
    if (evento.key === " ") {
      evento.preventDefault();
      irAPestana(boton.dataset.pestana);
      return;
    }
    const destino = pestanaVecina(claves, boton.dataset.pestana, evento.key);
    if (!destino) return;
    evento.preventDefault();
    botones[destino].focus();
    irAPestana(destino); // activación automática: la pestaña con el foco es la que se ve
  });

  paneles.hoy.append(vigente.elemento);
  paneles.historial.append(historial.elemento);
  aplicarPestana(activa);
  contenedor.append(
    enlaceDeVolver("/plantas", "Mis plantas"),
    cabecera,
    barraPestanas,
    ...disponibles.map((p) => paneles[p.clave]),
  );

  const limpiezas = [balancear(ilustracion.refs.grupoHojas)];
  entrada([cabecera, vigente.elemento, historial.elemento], { escalon: 0.1 });

  // ---- paneles según el rol ----
  let compartir = null;
  let dispositivos = null;
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

    dispositivos = crearPanelDispositivos(planta, ctx);
    paneles.matera.append(dispositivos.elemento);
    const medicion = crearPanelMedicion(planta, ctx, {
      rangos,
      alRegistrar: () => {
        // El POST ya guardó: se pide el vigente y el historial sin esperar al próximo sondeo.
        Promise.all([vigente.cargar({ resaltar: true }), historial.irAPrimera()]);
        irAPestana("hoy"); // el resultado de lo que se acaba de medir se ve en «Hoy»
      },
    });
    compartir = crearPanelCompartir(planta, ctx);
    const edicion = await crearPanelEdicion(planta, ctx, {
      alEditar: (editada) => {
        planta = editada;
        nombreNodo.textContent = editada.apodo;
        especieNodo.textContent = editada.especie;
      },
    });
    if (!ctx.vigente()) return;
    // «Más» son tres secciones plegables, una abierta a la vez (medir a mano, la de más uso, abierta al llegar):
    // así la pestaña cabe en una pantalla y media en vez de tres tarjetas largas apiladas.
    paneles.mas.append(
      seccionPlegable("seccion-medir", "Medir a mano", "Anota una lectura tú mismo.", medicion, { abierta: true }),
      seccionPlegable("seccion-compartir", "Compartir", "Invita a alguien a ver esta planta.", compartir.elemento),
      seccionPlegable("seccion-ajustes", "Ajustes de la planta", "Nombre, especie y eliminar.", edicion),
    );
  } else {
    const avisoRenuncia = crearAviso();
    const botonRenunciar = h("button", { type: "button", class: "boton boton-secundario", id: "btn-renunciar" }, "Dejar de ver esta planta");
    botonRenunciar.addEventListener("click", async () => {
      avisoRenuncia.limpiar();
      if (!(await confirmar(`Dejarás de ver «${planta.apodo}». Para volver a verla necesitarás otra invitación.`, { aceptar: "Dejar de verla", peligro: true }))) return;
      try {
        await conCarga(botonRenunciar, "Saliendo…", () => renunciarAPlanta(id));
        invalidarCache();
        toast("Ya no ves esa planta.");
        ctx.irA("/plantas");
      } catch (error) {
        avisoRenuncia.mostrar(error);
      }
    });
    paneles.mas.append(h("section", { class: "tarjeta" }, h("h2", {}, "Acceso"), h("p", { class: "texto-suave" }, "Ves esta planta porque su dueño te invitó. No puedes modificarla."), avisoRenuncia.elemento, botonRenunciar));
  }

  // ---- datos y sondeo (R6) ----
  await Promise.all([vigente.cargar(), historial.cargar(), compartir ? compartir.cargar() : null, dispositivos ? dispositivos.cargar() : null]);
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
    // Solo se pide lo que la pestaña a la vista muestra (consultasDeSondeo): el vigente siempre, porque pinta
    // el estado de la cabecera; el historial en «Hoy» e «Historial»; los dispositivos en «Matera».
    tarea: () => {
      const pedir = consultasDeSondeo(activa);
      return Promise.all([
        vigente.cargar({ resaltar: true, silencioso: true }),
        pedir.historial ? historial.refrescar() : null,
        pedir.dispositivos && dispositivos ? dispositivos.refrescar() : null,
      ]);
    },
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
    if (dispositivos) dispositivos.actualizarTiempos();
  }, 1000);
  limpiezas.push(() => sondeo.detener(), () => clearInterval(reloj));

  // Si el dueño me quita el acceso o elimina la planta, esta pantalla ya no tiene sentido.
  const alAviso = (evento) => {
    const { tipo, datos } = evento.detail;
    if (tipo === "ACCESO_PERDIDO" && datos && datos.plantaId === id) ctx.irA("/plantas");
  };
  window.addEventListener("fito:aviso", alAviso);
  limpiezas.push(() => window.removeEventListener("fito:aviso", alAviso));

  // Al recuperar el foco o volver la red: consulta ya, sin esperar al próximo ciclo de 5 s.
  limpiezas.push(alVolver(() => sondeo.ahoraMismo()));

  return {
    limpiar: () => limpiezas.forEach((limpiar) => limpiar()),
    // El enrutador llama aquí cuando la ruta nueva es otra pestaña de esta misma planta.
    alCambiarRuta: ({ entrada: destino }) => {
      const nueva = pestanaValida(destino.pestana, disponibles);
      if (nueva === activa) return;
      activa = nueva; // ya: el sondeo que se dispara abajo debe pedir lo de la pestaña nueva
      conTransicion(() => aplicarPestana(nueva));
      // Si la barra de pestañas quedó arriba del borde, se vuelve a ella: la pestaña nueva empieza por su principio.
      const tope = barraPestanas.getBoundingClientRect().top;
      if (tope < 0) window.scrollTo(0, Math.max(0, window.scrollY + tope - 8));
      sondeo.ahoraMismo(); // lo que la pestaña nueva muestra se pone al día ya, sin esperar el ciclo
    },
  };
}

/** Sección plegable de «Más»: <details> con el título en el <summary>; `name` hace que solo una esté abierta. */
function seccionPlegable(id, titulo, pista, contenido, { abierta = false } = {}) {
  return h("details", { class: "plegable", id, name: "mas-planta", open: abierta },
    h("summary", {}, h("span", { class: "plegable-titulo" }, titulo), h("span", { class: "plegable-pista" }, pista)),
    contenido,
  );
}
