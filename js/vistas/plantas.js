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
import { entrada } from "../animaciones.js";
import { h, vaciar, crearAviso, formatearFecha, chipDeEstadoGlobal, esqueletoSiTarda, ETIQUETAS_PARAMETRO } from "../ui.js";
import { crearIlustracionPlanta } from "../componentes/ilustracion-planta.js";
import { iconoDeParametro } from "../componentes/diagnostico.js";
import { nivelesDeDiagnostico, recomendacionesPorParametro } from "../componentes/escala.js";

export const titulo = "Mis plantas";

const INTERVALO_TABLERO_MS = 30000;
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
      h("span", { class: "texto-suave" }, `Registrada ${formatearFecha(planta.registradaEn)}`),
    ),
  );
}

/** Un valor de la tarjeta (humedad, luz o temperatura); sin parámetro es el hueco del esqueleto. */
function valorDeTarjeta(nombre, etiqueta, p) {
  return h("div", { class: `tarjeta-planta-valor ${p ? `valor-${p.estado.toLowerCase()}` : ""}`, "data-parametro": nombre },
    h("span", { class: "tarjeta-planta-etiqueta" }, etiqueta),
    h("strong", {}, p ? `${p.valor} ${p.unidad}` : "—"),
  );
}

/** Tarjeta de una planta propia. Nace con apodo y especie; `completar` le pone la lectura cuando llega. */
function crearTarjeta(planta) {
  const ilustracion = crearIlustracionPlanta({ mini: true });
  const estado = h("span", { class: "tarjeta-planta-estado" });
  const valores = h("div", { class: "tarjeta-planta-valores" });
  const cuando = h("p", { class: "tarjeta-planta-cuando texto-suave" }, "leyendo…");
  const nodo = h("li", { class: "tarjeta-planta-item" },
    h("a", { href: `#/plantas/${planta.id}`, class: "tarjeta-planta", "data-estado": "SIN_DIAGNOSTICO" },
      h("div", { class: "tarjeta-planta-cabeza" },
        h("div", { class: "tarjeta-planta-ilustracion" }, ilustracion.nodo),
        h("div", { class: "tarjeta-planta-nombres" }, h("strong", {}, planta.apodo), h("span", { class: "texto-suave" }, planta.especie), estado),
      ),
      valores,
      cuando,
    ),
  );
  const enlace = nodo.firstElementChild;
  let firma = null;

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
      cuando.textContent = lectura.tipo === "vacio" ? "sin lecturas todavía" : "no se pudo leer la última lectura";
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
    cuando.textContent = `última lectura ${textoHace(registradoEn)}`;
  }

  /** Reloj de pantalla: «hace 40 s» sigue corriendo sin pedir nada. */
  function actualizarTiempo() {
    if (cuando.dataset.registrado) cuando.textContent = `última lectura ${textoHace(cuando.dataset.registrado)}`;
  }

  return { nodo, completar, actualizarTiempo };
}

function mosaico(tipo, etiqueta) {
  const numero = h("strong", { class: "mosaico-numero" }, "0");
  return { nodo: h("div", { class: "mosaico", "data-tipo": tipo }, numero, h("span", { class: "mosaico-etiqueta" }, etiqueta)), numero };
}

export async function montar(contenedor, ctx) {
  const aviso = crearAviso();
  const propias = h("div", { id: "lista-propias" });
  const compartidas = h("div", { id: "lista-compartidas" });

  const mosaicos = {
    total: mosaico("total", "Plantas"),
    SALUDABLE: mosaico("SALUDABLE", "Saludables"),
    EN_RIESGO: mosaico("EN_RIESGO", "En riesgo"),
    CRITICO: mosaico("CRITICO", "Críticas"),
    SIN: mosaico("SIN", "Sin diagnóstico"),
  };
  const resumen = h("section", { class: "resumen", "aria-label": "Resumen de tus plantas", hidden: true }, Object.values(mosaicos).map((m) => m.nodo));
  const listaQueHacer = h("ul", { class: "recom recom--tablero" });
  const queHacer = h("section", { class: "tarjeta", "aria-labelledby": "titulo-que-hacer", hidden: true },
    h("h2", { id: "titulo-que-hacer" }, "Qué hacer hoy"),
    h("p", { class: "texto-suave" }, "Lo que piden tus plantas ahora mismo."),
    listaQueHacer,
  );

  contenedor.append(
    h("div", { class: "encabezado-seccion encabezado-pagina" },
      h("h2", { "data-titulo": "" }, "Mis plantas"),
      h("a", { href: "#/plantas/nueva", class: "boton boton-primario", id: "enlace-nueva-planta" }, "Registrar planta"),
    ),
    aviso.elemento,
    resumen,
    h("section", { class: "bloque-propias", "aria-label": "Tus plantas" }, propias),
    queHacer,
    h("section", { class: "tarjeta" },
      h("h2", {}, "Compartidas conmigo"),
      h("p", { class: "texto-suave" }, "Plantas de otras personas que puedes ver en solo lectura."),
      compartidas,
    ),
  );

  let tarjetas = [];
  let lecturas = new Map(); // id de planta -> lectura
  let mias = [];

  function repintarResumen() {
    const cuenta = { SALUDABLE: 0, EN_RIESGO: 0, CRITICO: 0, SIN: 0 };
    for (const planta of mias) {
      const l = lecturas.get(planta.id);
      if (!l) continue; // aún no llegó: no cuenta en ningún estado
      cuenta[l.tipo === "datos" ? l.registro.diagnostico.estado : "SIN"] += 1;
    }
    resumen.hidden = mias.length === 0;
    mosaicos.total.numero.textContent = String(mias.length);
    for (const clave of ["SALUDABLE", "EN_RIESGO", "CRITICO", "SIN"]) mosaicos[clave].numero.textContent = String(cuenta[clave]);
    mosaicos.SIN.nodo.hidden = cuenta.SIN === 0;
  }

  function repintarQueHacer() {
    vaciar(listaQueHacer);
    queHacer.hidden = mias.length === 0 || lecturas.size < mias.length;
    if (queHacer.hidden) return;
    const pendientes = mias
      .map((planta) => ({ planta, lectura: lecturas.get(planta.id) }))
      .filter(({ lectura }) => lectura.tipo === "datos" && lectura.registro.diagnostico.recomendaciones.length > 0)
      .sort((a, b) => ORDEN_DE_ESTADO[a.lectura.registro.diagnostico.estado] - ORDEN_DE_ESTADO[b.lectura.registro.diagnostico.estado]);
    if (pendientes.length === 0) {
      listaQueHacer.append(h("li", { class: "recom-ok" }, "Todo en orden: ninguna planta necesita nada hoy."));
      return;
    }
    for (const { planta, lectura } of pendientes) {
      const d = lectura.registro.diagnostico;
      for (const { texto, parametro } of recomendacionesPorParametro(d.parametros, d.recomendaciones)) {
        const estado = parametro ? d.parametros.find((p) => p.nombre === parametro).estado : null;
        listaQueHacer.append(
          h("li", { "data-estado": estado, "data-planta": planta.id },
            parametro ? h("span", { class: "recom-icono", title: ETIQUETAS_PARAMETRO[parametro] }, iconoDeParametro(parametro)) : null,
            h("span", {}, h("a", { href: `#/plantas/${planta.id}`, class: "recom-planta" }, planta.apodo), ": ", texto),
          ),
        );
      }
    }
  }

  /** Pide el vigente de cada planta en paralelo; cada tarjeta se completa cuando llega la suya. */
  async function leerTodas() {
    await Promise.all(mias.map(async (planta, i) => {
      const lectura = await leerVigente(planta);
      if (!ctx.vigente()) return;
      // Un fallo transitorio no pisa una lectura buena que ya se tenía.
      if (lectura.tipo === "fallo" && lecturas.get(planta.id)?.tipo === "datos") return;
      lecturas.set(planta.id, lectura);
      tarjetas[i].completar(lectura);
      repintarResumen();
      repintarQueHacer();
    }));
  }

  async function cargar() {
    try {
      const [propiasLista, ajenas] = await Promise.all([listarPlantas(), listarPlantasCompartidas()]);
      if (!ctx.vigente()) return;
      aviso.limpiar();
      mias = propiasLista;
      lecturas = new Map();
      vaciar(propias);
      vaciar(compartidas);
      tarjetas = mias.map(crearTarjeta);
      if (mias.length === 0) propias.append(h("p", { class: "texto-vacio" }, "Todavía no registraste ninguna planta."));
      else propias.append(h("ul", { class: "rejilla-plantas" }, tarjetas.map((t) => t.nodo)));
      compartidas.append(
        ajenas.length === 0
          ? h("p", { class: "texto-vacio" }, "Nadie te ha compartido plantas todavía.")
          : h("ul", { class: "rejilla" }, ajenas.map(tarjetaDeCompartida)),
      );
      repintarResumen();
      repintarQueHacer();
      entrada(tarjetas.map((t) => t.nodo), { y: 14, escalon: 0.06, duracion: 0.4 });
      leerTodas();
    } catch (error) {
      if (ctx.vigente()) aviso.mostrar(error);
    }
  }
  await cargar();

  // Mientras la pantalla esté visible se refrescan los diagnósticos cada 30 s (sondeo.js los pausa con la
  // pestaña oculta); cada tarjeta compara contra lo que ya pintó y no repinta si nada cambió.
  const sondeo = crearSondeo({ tarea: leerTodas, intervaloMs: INTERVALO_TABLERO_MS });
  sondeo.iniciar({ inmediato: false, cargadoEn: Date.now() });
  const reloj = setInterval(() => tarjetas.forEach((t) => t.actualizarTiempo()), 10000);

  // Si pierdo el acceso a una compartida (aviso en vivo), la lista se pone al día sola.
  const alAviso = (evento) => {
    if (evento.detail.tipo === "ACCESO_PERDIDO") cargar();
  };
  window.addEventListener("fito:aviso", alAviso);
  return () => {
    sondeo.detener();
    clearInterval(reloj);
    window.removeEventListener("fito:aviso", alAviso);
  };
}
