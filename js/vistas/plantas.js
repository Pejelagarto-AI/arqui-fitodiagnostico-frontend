// RF-D2 y RF-E4: mis plantas (como un tablero) y las compartidas conmigo.
//
// El tablero: un resumen por estado, una tarjeta por planta propia con su ilustración, su estado y
// los tres valores de la última lectura, y un «Qué hacer hoy» que junta las recomendaciones de todas.
// GET /plantas no trae el estado, así que se pide el diagnóstico vigente de cada planta en paralelo
// (Promise.allSettled) y cada tarjeta se completa cuando llega el suyo; la rejilla se pinta antes, con
// apodo y especie, para que nunca quede en blanco. Evolución recomendada: que el backend devuelva el
// estado vigente en GET /plantas y se evite el N+1 (F22).
import { listarPlantas, listarPlantasCompartidas, obtenerDiagnosticoVigente } from "../api.js";
import { textoHace } from "../tiempo.js";
import { crearSondeo } from "../sondeo.js";
import { recordarPlantaActiva, esPlantaActiva, nombrarParaTransicion, quitarNombreDeTransicion } from "../transiciones.js";
import { leerCache, guardarCache, sonIguales, alVolver } from "../cache.js";
import { entrada, balancear } from "../animaciones.js";
import * as sesion from "../sesion.js";
import { conTransicion } from "../transiciones.js";
import { FILTROS, cuentaPorEstado, pasaElFiltro, filtroVigente, plegar } from "../tablero.js";
import { recomendacionEnPalabras } from "../voz-planta.js";
import { lanzarRecorridoSiToca } from "../componentes/recorrido.js";
import { h, vaciar, crearAviso, chipDeEstadoGlobal, esqueletoSiTarda, ETIQUETAS_PARAMETRO } from "../ui.js";
import { crearIlustracionPlanta } from "../componentes/ilustracion-planta.js";
import { esCarnivora } from "../componentes/especie.js";
import { iconoDeParametro } from "../componentes/diagnostico.js";
import { nivelesDeDiagnostico, recomendacionesPorParametro } from "../componentes/escala.js";

export const titulo = "Mis plantas";

const INTERVALO_TABLERO_MS = 30000;
const CLAVE_CACHE = "plantas:tablero";
const PARAMETROS = [["humedad", "Humedad"], ["luz", "Luz"], ["temperatura", "Temp."]];
// Las críticas primero en «Qué hacer hoy».
const ORDEN_DE_ESTADO = { CRITICO: 0, EN_RIESGO: 1, SALUDABLE: 2 };

/** Un 404 es «sin diagnóstico»; cualquier otro fallo se marca como no disponible. */
async function leerVigente(planta) {
  try {
    const respuesta = await obtenerDiagnosticoVigente(planta.id);
    return respuesta.hayDiagnostico ? { tipo: "datos", registro: respuesta.diagnostico } : { tipo: "vacio" };
  } catch (error) {
    return error && error.status === 404 ? { tipo: "vacio" } : { tipo: "fallo" };
  }
}

function tarjetaDeCompartida(planta) {
  return h("li", { class: "planta-item" },
    h("a", { href: `#/plantas/${planta.id}`, class: "planta-enlace" },
      h("strong", {}, planta.apodo),
      h("span", { class: "texto-suave" }, planta.especie),
      h("span", { class: "chip chip--compartida" }, "Te la compartieron"),
    ),
  );
}

/** Un valor de la tarjeta (humedad, luz o temperatura); sin parámetro es el hueco del esqueleto. */
function valorDeTarjeta(nombre, etiqueta, p) {
  return h("div", { class: `tarjeta-planta-valor ${p ? `valor-${p.estado.toLowerCase()}` : ""}`, "data-parametro": nombre },
    iconoDeParametro(nombre),
    h("span", { class: "solo-lector" }, `${etiqueta}: `),
    h("strong", {}, p ? `${p.valor} ${p.unidad}` : "—"),
  );
}

/** Tarjeta de una planta propia. Nace con apodo y especie; `completar` le pone la lectura cuando llega. */
function crearTarjeta(planta) {
  const ilustracion = crearIlustracionPlanta({ mini: true, carnivora: esCarnivora(planta.especie) });
  const estado = h("span", { class: "tarjeta-planta-estado" });
  const valores = h("div", { class: "tarjeta-planta-valores" });
  const cuando = h("p", { class: "tarjeta-planta-cuando texto-suave" }, "Leyendo…");
  const nodo = h("li", { class: "tarjeta-planta-item", "data-planta": planta.id },
    h("a", { href: `#/plantas/${planta.id}`, class: "tarjeta-planta", "data-estado": "SIN_DIAGNOSTICO" },
      h("div", { class: "tarjeta-planta-ilustracion" }, ilustracion.nodo),
      h("div", { class: "tarjeta-planta-nombres" }, h("strong", {}, planta.apodo), h("span", { class: "texto-suave" }, planta.especie)),
      estado,
      valores,
      cuando,
    ),
  );
  const enlace = nodo.firstElementChild;
  const cajaIlustracion = nodo.querySelector(".tarjeta-planta-ilustracion");
  let firma = null;

  // Elemento compartido con la cabecera del detalle (F28): la ilustración «viaja» de una a otra. El nombre
  // de la transición solo lo lleva UNA tarjeta (los nombres son únicos en la página): la de la planta que se abre.
  if (esPlantaActiva(planta.id)) nombrarParaTransicion(cajaIlustracion);
  enlace.addEventListener("click", () => {
    for (const otra of document.querySelectorAll(".tarjeta-planta-ilustracion")) quitarNombreDeTransicion(otra);
    recordarPlantaActiva(planta.id);
    nombrarParaTransicion(cajaIlustracion);
  });

  // Hasta que llega la primera lectura la tarjeta es su propio esqueleto: los mismos tres valores con
  // «—», en gris si la espera pasa de 300 ms. `completar` los reemplaza por los reales.
  for (const [nombre, etiqueta] of PARAMETROS) valores.append(valorDeTarjeta(nombre, etiqueta, null));
  let cancelarEsqueleto = esqueletoSiTarda(enlace);

  function completar(lectura) {
    if (cancelarEsqueleto) {
      cancelarEsqueleto();
      cancelarEsqueleto = null;
    }
    const nueva = lectura.tipo === "datos" ? lectura.registro.id : lectura.tipo;
    if (nueva === firma) return;
    firma = nueva;
    vaciar(estado);
    vaciar(valores);
    if (lectura.tipo !== "datos") {
      enlace.dataset.estado = "SIN_DIAGNOSTICO";
      ilustracion.aplicar(ilustracion.estadoVisual({ estado: null }));
      cuando.textContent = lectura.tipo === "vacio" ? "Aún sin lecturas" : "No pudimos leer cómo está";
      cuando.removeAttribute("data-registrado");
      return;
    }
    const { diagnostico, registradoEn } = lectura.registro;
    enlace.dataset.estado = diagnostico.estado;
    ilustracion.aplicar(ilustracion.estadoVisual({ estado: diagnostico.estado, ...nivelesDeDiagnostico(diagnostico) }));
    estado.append(chipDeEstadoGlobal(diagnostico.estado));
    for (const [nombre, etiqueta] of PARAMETROS) {
      valores.append(valorDeTarjeta(nombre, etiqueta, diagnostico.parametros.find((x) => x.nombre === nombre)));
    }
    cuando.dataset.registrado = registradoEn;
    cuando.textContent = `Leída ${textoHace(registradoEn)}`;
  }

  /** Reloj de pantalla: «hace 40 s» sigue corriendo sin pedir nada. */
  function actualizarTiempo() {
    if (cuando.dataset.registrado) cuando.textContent = `Leída ${textoHace(cuando.dataset.registrado)}`;
  }

  return { nodo, completar, actualizarTiempo };
}

/** «Camila Rojas» -> «Camila». Sin nombre, cadena vacía. */
function primerNombre(nombre) {
  return String(nombre ?? "").trim().split(/\s+/)[0] || "";
}

/** Un mosaico del resumen: es un botón que filtra las plantas por ese estado (aria-pressed dice cuál está puesto). */
function mosaico(tipo, etiqueta) {
  const numero = h("strong", { class: "mosaico-numero" }, "0");
  return { nodo: h("button", { type: "button", class: "mosaico", "data-tipo": tipo, "aria-pressed": "false" }, numero, h("span", { class: "mosaico-etiqueta" }, etiqueta)), numero };
}

export async function montar(contenedor, ctx) {
  const aviso = crearAviso();
  const propias = h("div", { id: "lista-propias" });
  const compartidas = h("div", { id: "lista-compartidas" });

  const mosaicos = {
    total: mosaico("total", "Todas"),
    SALUDABLE: mosaico("SALUDABLE", "Saludables"),
    EN_RIESGO: mosaico("EN_RIESGO", "En riesgo"),
    CRITICO: mosaico("CRITICO", "Críticas"),
    SIN: mosaico("SIN", "Sin lecturas"),
  };
  const resumen = h("section", { class: "resumen", id: "resumen-plantas", role: "group", "aria-label": "Tus plantas por estado. Toca uno para ver solo esas.", hidden: true }, FILTROS.map((clave) => mosaicos[clave].nodo));
  const listaQueHacer = h("ul", { class: "recom recom--tablero", id: "lista-que-hacer" });
  const verTodas = h("button", { type: "button", class: "boton boton-secundario boton-chico", id: "btn-ver-pendientes", "aria-controls": "lista-que-hacer", "aria-expanded": "false", hidden: true });
  const queHacer = h("section", { class: "tarjeta que-hacer-tablero", id: "que-hacer-hoy", "aria-labelledby": "titulo-que-hacer", hidden: true },
    h("h2", { id: "titulo-que-hacer" }, "Qué hacer hoy"),
    listaQueHacer,
    verTodas,
  );
  let filtro = "total";
  let desplegado = false;

  // Un solo enlace «agregar planta»: vive en el encabezado y, la primera vez (cero plantas), en la bienvenida.
  const enlaceNueva = h("a", { href: "#/plantas/nueva", class: "boton boton-primario", id: "enlace-nueva-planta" }, "Agregar planta");
  const tituloPagina = h("h2", { "data-titulo": "" }, "Mis plantas");
  const encabezado = h("div", { class: "encabezado-seccion encabezado-pagina" }, tituloPagina, enlaceNueva);

  // ---- primera vez (F38): en vez de un tablero vacío, una bienvenida con un solo paso que dar ----
  const nombre = primerNombre(sesion.usuario() && sesion.usuario().nombre);
  const ilustracionBienvenida = crearIlustracionPlanta();
  ilustracionBienvenida.aplicar(ilustracionBienvenida.estadoVisual({ estado: "SALUDABLE", humedadPct: 62, luzPct: 75 }));
  const tituloBienvenida = h("h2", { class: "bienvenida-titulo", id: "bienvenida-titulo" }, nombre ? `Hola, ${nombre}.` : "Hola.");
  const accionBienvenida = h("div", { class: "bienvenida-accion" });
  const bienvenida = h("section", { class: "tarjeta bienvenida", id: "bienvenida", "aria-labelledby": "bienvenida-titulo", hidden: true },
    h("div", { class: "bienvenida-dibujo", "aria-hidden": "true" }, ilustracionBienvenida.nodo),
    tituloBienvenida,
    h("p", { class: "bienvenida-bajada" }, "Empecemos por tu primera planta."),
    h("ol", { class: "bienvenida-pasos" },
      h("li", {}, h("span", {}, h("strong", {}, "Dinos qué planta es"), " y ponle un nombre.")),
      h("li", {}, h("span", {}, h("strong", {}, "Conecta su matera"), " con el código de su pantalla.")),
      h("li", {}, h("span", {}, h("strong", {}, "Mira cómo está"), " y qué necesita cada día.")),
    ),
    accionBienvenida,
    h("p", { class: "texto-suave bienvenida-nota" }, "¿Aún no tienes matera? Igual puedes agregarla y anotar las mediciones a mano."),
  );
  const pararBalanceo = balancear(ilustracionBienvenida.refs.grupoHojas);

  const bloquePropias = h("section", { class: "bloque-propias", "aria-label": "Tus plantas" }, propias);
  const bloqueCompartidas = h("section", { class: "tarjeta", id: "bloque-compartidas" },
    h("h2", {}, "Compartidas conmigo"),
    h("p", { class: "texto-suave" }, "Plantas de otras personas que te invitaron a verlas. Puedes mirarlas, no cambiarlas."),
    compartidas,
  );
  contenedor.append(bienvenida, encabezado, aviso.elemento, resumen, bloquePropias, queHacer, bloqueCompartidas);

  /** Con cero plantas propias se ve la bienvenida; con alguna, el tablero. Lo compartido solo aparece si hay algo. */
  function acomodar(primeraVez, hayCompartidas) {
    bienvenida.hidden = !primeraVez;
    encabezado.hidden = primeraVez;
    bloquePropias.hidden = primeraVez;
    bloqueCompartidas.hidden = !hayCompartidas;
    // El título de la pantalla (al que va el foco al llegar) es el de lo que se está viendo.
    if (primeraVez) {
      tituloPagina.removeAttribute("data-titulo");
      tituloBienvenida.setAttribute("data-titulo", "");
      enlaceNueva.textContent = "Agregar mi primera planta";
      accionBienvenida.append(enlaceNueva);
    } else {
      tituloBienvenida.removeAttribute("data-titulo");
      tituloPagina.setAttribute("data-titulo", "");
      enlaceNueva.textContent = "Agregar planta";
      encabezado.append(enlaceNueva);
    }
  }

  let tarjetas = [];
  let lecturas = new Map(); // id de planta -> lectura
  let mias = [];
  let pintada = null; // lo último que se pintó de las listas

  function repintarResumen() {
    const cuenta = cuentaPorEstado(mias, lecturas);
    // Con una sola planta el resumen no dice nada que la tarjeta no diga ya.
    resumen.hidden = mias.length < 2;
    filtro = filtroVigente(filtro, cuenta);
    for (const clave of FILTROS) {
      const { nodo, numero } = mosaicos[clave];
      numero.textContent = String(cuenta[clave]);
      nodo.setAttribute("aria-pressed", String(clave === filtro));
      nodo.disabled = clave !== "total" && cuenta[clave] === 0;
    }
    mosaicos.SIN.nodo.hidden = cuenta.SIN === 0;
    aplicarFiltro();
  }

  /** Deja a la vista solo las tarjetas del estado elegido. */
  function aplicarFiltro() {
    mias.forEach((planta, i) => {
      if (tarjetas[i]) tarjetas[i].nodo.hidden = !pasaElFiltro(lecturas.get(planta.id), filtro);
    });
  }
  resumen.addEventListener("click", (evento) => {
    const boton = evento.target instanceof Element ? evento.target.closest(".mosaico") : null;
    if (!boton || boton.disabled) return;
    // Tocar el que ya está puesto lo quita (vuelve a «Todas»).
    filtro = boton.dataset.tipo === filtro ? "total" : boton.dataset.tipo;
    conTransicion(() => {
      for (const clave of FILTROS) mosaicos[clave].nodo.setAttribute("aria-pressed", String(clave === filtro));
      aplicarFiltro();
    });
  });

  function repintarQueHacer() {
    vaciar(listaQueHacer);
    queHacer.hidden = mias.length === 0 || lecturas.size < mias.length;
    if (queHacer.hidden) return;
    const pendientes = mias
      .map((planta) => ({ planta, lectura: lecturas.get(planta.id) }))
      .filter(({ lectura }) => lectura.tipo === "datos" && lectura.registro.diagnostico.recomendaciones.length > 0)
      .sort((a, b) => ORDEN_DE_ESTADO[a.lectura.registro.diagnostico.estado] - ORDEN_DE_ESTADO[b.lectura.registro.diagnostico.estado]);
    if (pendientes.length === 0) {
      verTodas.hidden = true;
      listaQueHacer.append(h("li", { class: "recom-ok" }, "Todo en orden: ninguna planta necesita nada hoy."));
      return;
    }
    // Cada pendiente dice primero qué hacer y con cuál planta; el porqué va después, más chico.
    const renglones = [];
    for (const { planta, lectura } of pendientes) {
      const d = lectura.registro.diagnostico;
      for (const { texto, parametro } of recomendacionesPorParametro(d.parametros, d.recomendaciones)) {
        const p = parametro ? d.parametros.find((x) => x.nombre === parametro) : null;
        const { accion, detalle } = recomendacionEnPalabras(texto, p);
        renglones.push(
          h("li", { "data-estado": p ? p.estado : null, "data-planta": planta.id },
            parametro ? h("span", { class: "recom-icono", title: ETIQUETAS_PARAMETRO[parametro] }, iconoDeParametro(parametro)) : null,
            h("span", { class: "recom-texto" },
              h("a", { href: `#/plantas/${planta.id}`, class: "recom-planta" }, planta.apodo), ": ",
              h("strong", { class: "recom-accion" }, accion),
              detalle ? h("span", { class: "recom-detalle" }, ` ${detalle}`) : null),
          ),
        );
      }
    }
    // Plegado a los primeros (los más graves van arriba): con muchas plantas esto no vuelve a ser un scroll largo.
    const { visibles, plegados } = plegar(renglones);
    for (const renglon of plegados) renglon.hidden = !desplegado;
    listaQueHacer.append(...visibles, ...plegados);
    verTodas.hidden = plegados.length === 0;
    verTodas.setAttribute("aria-expanded", String(desplegado));
    verTodas.textContent = desplegado ? "Ver menos" : `Ver todo (${renglones.length})`;
  }
  verTodas.addEventListener("click", () => {
    desplegado = !desplegado;
    repintarQueHacer();
  });

  // Recorrido guiado (F39): la primera vez que se ve el tablero con plantas, cuando ya llegaron sus lecturas
  // y terminó la entrada de las tarjetas (así el foco cae sobre algo quieto y con su tamaño final).
  let esperaDelRecorrido = null;
  function quizasRecorrido() {
    if (mias.length === 0) return;
    clearTimeout(esperaDelRecorrido);
    esperaDelRecorrido = setTimeout(() => lanzarRecorridoSiToca("tablero", { vigente: ctx.vigente }), 700);
  }

  /** Pide el vigente de cada planta en paralelo; cada tarjeta se completa cuando llega la suya. */
  async function leerTodas() {
    await leerCadaUna();
    if (ctx.vigente()) quizasRecorrido();
  }

  async function leerCadaUna() {
    await Promise.all(mias.map(async (planta, i) => {
      const tarjeta = tarjetas[i]; // la de ESTA pasada: si la lista se repinta mientras tanto, no se mezclan
      const lectura = await leerVigente(planta);
      if (!ctx.vigente()) return;
      // Un fallo transitorio no pisa una lectura buena que ya se tenía.
      if (lectura.tipo === "fallo" && lecturas.get(planta.id)?.tipo === "datos") return;
      lecturas.set(planta.id, lectura);
      tarjeta.completar(lectura);
      repintarResumen();
      repintarQueHacer();
    }));
  }

  /** Pinta las dos listas (propias y compartidas) y pide el vigente de cada propia. */
  function pintarListas(propiasLista, ajenas) {
    aviso.limpiar();
    pintada = { propias: propiasLista, ajenas };
    mias = propiasLista;
    // Se conservan las lecturas de las plantas que siguen: la revalidación no las borra (siempre se vuelven a pedir).
    lecturas = new Map([...lecturas].filter(([id]) => mias.some((p) => p.id === id)));
    vaciar(propias);
    vaciar(compartidas);
    tarjetas = mias.map(crearTarjeta);
    for (const [i, planta] of mias.entries()) if (lecturas.has(planta.id)) tarjetas[i].completar(lecturas.get(planta.id));
    acomodar(mias.length === 0, ajenas.length > 0);
    if (mias.length > 0) propias.append(h("ul", { class: "rejilla-plantas" }, tarjetas.map((t) => t.nodo)));
    if (ajenas.length > 0) compartidas.append(h("ul", { class: "rejilla" }, ajenas.map(tarjetaDeCompartida)));
    repintarResumen();
    repintarQueHacer();
    entrada(tarjetas.map((t) => t.nodo), { y: 14, escalon: 0.06, duracion: 0.4 });
    leerTodas();
  }

  /**
   * Stale-while-revalidate (F26): si ya se vio esta pantalla, las listas salen al instante de la caché y se
   * revalidan por detrás (solo se repinta si cambiaron). El estado de cada planta (el diagnóstico vigente)
   * NO se cachea: se pide siempre, y la tarjeta muestra su esqueleto hasta que llega.
   */
  async function revalidar() {
    try {
      const [propiasLista, ajenas] = await Promise.all([listarPlantas(), listarPlantasCompartidas()]);
      if (!ctx.vigente()) return;
      const fresca = guardarCache(CLAVE_CACHE, { propias: propiasLista, ajenas });
      if (pintada && sonIguales(pintada, fresca)) {
        aviso.limpiar();
        leerTodas(); // las listas no cambiaron: solo se refrescan los estados
        return;
      }
      pintarListas(propiasLista, ajenas);
    } catch (error) {
      // Con algo ya pintado desde la caché, un fallo de red no lo tapa con un aviso: el sondeo lo dirá.
      if (ctx.vigente() && !pintada) aviso.mostrar(error);
    }
  }

  async function cargar() {
    const guardado = leerCache(CLAVE_CACHE);
    if (guardado) {
      pintarListas(guardado.propias, guardado.ajenas);
      revalidar(); // sin esperar: la pantalla ya está lista
      return;
    }
    await revalidar();
  }
  await cargar();

  // Mientras la pantalla esté visible se refrescan los diagnósticos cada 30 s (sondeo.js los pausa con la
  // pestaña oculta); cada tarjeta compara contra lo que ya pintó y no repinta si nada cambió.
  const sondeo = crearSondeo({ tarea: leerTodas, intervaloMs: INTERVALO_TABLERO_MS });
  sondeo.iniciar({ inmediato: false, cargadoEn: Date.now() });
  const reloj = setInterval(() => tarjetas.forEach((t) => t.actualizarTiempo()), 10000);

  // Si pierdo el acceso a una compartida (aviso en vivo), la lista se pone al día sola.
  const alAviso = (evento) => {
    if (evento.detail.tipo === "ACCESO_PERDIDO") revalidar();
  };
  window.addEventListener("fito:aviso", alAviso);
  // Al recuperar el foco o volver la red: listas y estados al día sin esperar al próximo ciclo.
  const quitarRevalidacion = alVolver(revalidar);
  return () => {
    clearTimeout(esperaDelRecorrido);
    pararBalanceo();
    quitarRevalidacion();
    sondeo.detener();
    clearInterval(reloj);
    window.removeEventListener("fito:aviso", alAviso);
  };
}
