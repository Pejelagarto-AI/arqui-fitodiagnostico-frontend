// Asistente de vinculación «a lo Chromecast» (F36): #/plantas/:id/vincular. Cinco pasos: Enciéndela, Buscando
// tu matera (radar), Confirma que es la tuya (código de 6 casillas o QR), Conectando y Conexión exitosa.
// La matera, apenas tiene Wi-Fi, le habla al servidor; el servidor dice cuáles sin dueño están en la misma red que
// este celular (GET /dispositivos/cercanos) y aquí se muestran enmascaradas. El usuario nunca teclea «fito-»: el
// prefijo lo pone el front al llamar a la API (vinculacion.js). Sin innerHTML: todo con h() y svg().
import { buscarDispositivosCercanos, listarDispositivos, obtenerPlanta, vincularDispositivo } from "../api.js";
import { invalidarCache } from "../cache.js";
import { crearSondeo } from "../sondeo.js";
import { entrada, radar, girar, exito, balancear } from "../animaciones.js";
import { h, enlaceDeVolver, crearAviso } from "../ui.js";
import { crearIlustracionPlanta } from "../componentes/ilustracion-planta.js";
import { esCarnivora } from "../componentes/especie.js";
import { ilustracionEnciende, ilustracionRadar, ilustracionQr, anilloDeEspera, escenaDeExito, iconoDeAyuda } from "../componentes/asistente-ilustraciones.js";
import { crearLectorQr } from "../componentes/lector-qr.js";
import {
  AYUDAS,
  ESPERA_MAXIMA_CONEXION_MS,
  INTERVALO_BUSQUEDA_MS,
  PASOS,
  TITULOS,
  anuncioDePaso,
  codigoVisible,
  coincideConEncontradas,
  enmascaradoVisible,
  esperaSinHallazgoMs,
  estadoInicial,
  limpiarEntradaDeCodigo,
  normalizarCodigo,
  plantaRecordada,
  recordarPlanta,
  transicion,
} from "../vinculacion.js";

export const titulo = "Vincula tu matera";

export const CLAVE_PLANTA_RECORDADA = "fito.asistente.planta";
const INTERVALO_CONEXION_MS = 2000;

function guardarRecuerdo(plantaId) {
  try {
    sessionStorage.setItem(CLAVE_PLANTA_RECORDADA, recordarPlanta(plantaId));
  } catch {
    // sin sessionStorage el asistente funciona igual; solo el QR no sabrá a qué planta ir
  }
}

export function olvidarPlantaRecordada() {
  try {
    sessionStorage.removeItem(CLAVE_PLANTA_RECORDADA);
  } catch {
    // nada que olvidar
  }
}

export function leerPlantaRecordada() {
  try {
    return plantaRecordada(sessionStorage.getItem(CLAVE_PLANTA_RECORDADA));
  } catch {
    return null;
  }
}

export async function montar(contenedor, ctx) {
  const id = ctx.params.id;
  let planta;
  try {
    planta = await obtenerPlanta(id);
  } catch (error) {
    if (!ctx.vigente()) return;
    const aviso = crearAviso();
    aviso.mostrar(error);
    contenedor.append(enlaceDeVolver("/plantas", "Mis plantas"), h("section", { class: "tarjeta tarjeta--angosta" }, h("h2", { "data-titulo": "" }, "Vincula tu matera"), aviso.elemento));
    return;
  }
  if (!ctx.vigente()) return;
  if (planta.esDueno === false) {
    contenedor.append(enlaceDeVolver(`/plantas/${id}`, planta.apodo), h("section", { class: "tarjeta tarjeta--angosta" }, h("h2", { "data-titulo": "" }, "Vincula tu matera"), h("p", {}, "Solo la persona dueña de la planta puede vincularle una matera.")));
    return;
  }
  guardarRecuerdo(id);

  const esperaHallazgo = esperaSinHallazgoMs(ctx.query.get("espera"));
  const carnivora = esCarnivora(planta.especie);
  const directo = ctx.query.get("serial");
  let serialObjetivo = null;
  let estado = estadoInicial();
  let errorDirecto = null;
  if (directo) {
    const r = normalizarCodigo(directo);
    if (r.ok) {
      serialObjetivo = r.serial;
      estado = estadoInicial({ directo: true });
    } else {
      estado = transicion(estadoInicial(), { tipo: "ESCRIBIR_A_MANO" });
      errorDirecto = r.error;
    }
  }

  let limpiezaPaso = () => {};
  let sinHallazgo = false;
  let vivo = true;

  // ---- estructura fija ----
  const anuncio = h("p", { class: "solo-lector", role: "status", "aria-live": "polite", id: "asistente-anuncio" });
  const puntos = h("ol", { class: "asistente-puntos", "aria-label": "Pasos del asistente" },
    PASOS.map((p) => h("li", { "data-paso": p }, h("span", { class: "solo-lector" }, TITULOS[p]))));
  const etiquetaPaso = h("p", { class: "asistente-etiqueta" });
  const cuerpo = h("div", { class: "asistente-cuerpo", id: "asistente-cuerpo" });
  const pie = h("div", { class: "asistente-pie" });
  const tarjeta = h("section", { class: "tarjeta tarjeta--angosta asistente", "aria-labelledby": "asistente-titulo", "data-paso": estado.paso },
    h("h2", { id: "asistente-titulo", "data-titulo": "", class: "asistente-titulo" }, "Vincula tu matera"),
    h("p", { class: "texto-suave asistente-planta" }, `para ${planta.apodo}`),
    puntos, etiquetaPaso, anuncio, cuerpo, pie);
  contenedor.append(enlaceDeVolver(`/plantas/${id}`, planta.apodo), tarjeta);

  function irADetalle() {
    olvidarPlantaRecordada();
    invalidarCache();
    ctx.irA(`/plantas/${id}`);
  }

  function despachar(evento) {
    const antes = estado.paso;
    estado = transicion(estado, evento);
    if (estado.paso !== antes) {
      sinHallazgo = false;
      pintarPaso();
    }
  }

  function hacerlo() {
    return h("button", { type: "button", class: "boton boton-secundario boton-chico", id: "btn-asistente-despues", onclick: irADetalle }, "Hacerlo después");
  }

  function pintarPie() {
    pie.replaceChildren();
    if (estado.paso === "exito") return;
    const botones = [];
    if (estado.paso === "enciende" || estado.paso === "buscando") {
      botones.push(h("button", { type: "button", class: "asistente-enlace", id: "btn-asistente-a-mano", onclick: () => { despachar({ tipo: "ESCRIBIR_A_MANO" }); } }, "¿No aparece? Escribe el código a mano"));
    }
    botones.push(hacerlo());
    pie.append(...botones);
  }

  function pintarPaso() {
    limpiezaPaso();
    limpiezaPaso = () => {};
    cuerpo.replaceChildren();
    tarjeta.dataset.paso = estado.paso;
    const n = PASOS.indexOf(estado.paso);
    puntos.querySelectorAll("li").forEach((li, i) => {
      li.dataset.estado = i < n ? "hecho" : i === n ? "activo" : "pendiente";
      if (i === n) li.setAttribute("aria-current", "step");
      else li.removeAttribute("aria-current");
    });
    etiquetaPaso.textContent = `Paso ${n + 1} de ${PASOS.length}`;
    const construir = { enciende: pasoEnciende, buscando: pasoBuscando, confirma: pasoConfirma, conectando: pasoConectando, exito: pasoExito }[estado.paso];
    const { nodos, limpiar, titulo: tituloPaso, anunciar, enfocar } = construir();
    limpiezaPaso = limpiar || (() => {});
    const encabezado = h("h3", { class: "asistente-paso-titulo", id: "asistente-paso-titulo", tabindex: "-1" }, tituloPaso || TITULOS[estado.paso]);
    cuerpo.append(encabezado, ...nodos);
    anuncio.textContent = anunciar || anuncioDePaso(estado.paso);
    pintarPie();
    entrada([...cuerpo.children], { y: 10, duracion: 0.35, escalon: 0.06 });
    if (ctx.vigente()) (enfocar ? enfocar() : encabezado.focus({ preventScroll: true }));
  }

  // ---- paso 1 ----
  function pasoEnciende() {
    return {
      nodos: [
        ilustracionEnciende(),
        h("p", {}, "Conecta la matera a la corriente. Su pantalla va a mostrar un cuadro blanco y negro (el QR) y un código de 6 letras y números."),
        h("details", { class: "asistente-ayuda-wifi" },
          h("summary", {}, "Mi pantalla dice «Conéctate al Wi-Fi Fito-…»"),
          h("ol", {},
            h("li", {}, "En los ajustes de Wi-Fi del celular, únete a la red que dice la pantalla."),
            h("li", {}, "Se abre sola una página de la matera: elige tu red y escribe su clave."),
            h("li", {}, "Cuando la pantalla muestre el cuadro y el código, vuelve aquí."))),
        h("button", { type: "button", class: "boton boton-primario asistente-accion", id: "btn-asistente-buscar", onclick: () => despachar({ tipo: "BUSCAR" }) }, "Buscar mi matera"),
      ],
    };
  }

  // ---- paso 2 ----
  function pasoBuscando() {
    const limpiezas = [];
    const sondeo = crearSondeo({
      tarea: async () => {
        const lista = await buscarDispositivosCercanos();
        if (!vivo || !ctx.vigente()) return;
        if (lista.length > 0) despachar({ tipo: "ENCONTRADAS", encontradas: lista });
      },
      intervaloMs: INTERVALO_BUSQUEDA_MS,
    });
    sondeo.iniciar();
    limpiezas.push(() => sondeo.detener());

    const zona = h("div", { class: "asistente-busqueda", "data-estado": sinHallazgo ? "sin-hallazgo" : "buscando" });
    if (sinHallazgo) {
      zona.append(...ayudaSinHallazgo(limpiezas));
    } else {
      const r = ilustracionRadar();
      limpiezas.push(radar({ ondas: r.ondas, barrido: r.barrido }));
      zona.append(r.nodo, h("p", { class: "asistente-estado" }, "Buscando materas encendidas cerca de ti…"), h("p", { class: "texto-suave" }, "Debe ser una matera nueva, sin dueño, en el mismo Wi-Fi que este celular."));
      const temporizador = setTimeout(() => {
        if (!vivo || estado.paso !== "buscando") return;
        sinHallazgo = true;
        pintarPaso();
      }, esperaHallazgo);
      limpiezas.push(() => clearTimeout(temporizador));
    }
    return {
      titulo: sinHallazgo ? "No encontramos tu matera" : TITULOS.buscando,
      anunciar: sinHallazgo ? "No encontramos tu matera. Revisa estos puntos, o escribe el código a mano." : undefined,
      nodos: [zona],
      limpiar: () => limpiezas.forEach((l) => l()),
    };
  }

  function ayudaSinHallazgo(limpiezas) {
    const triste = crearIlustracionPlanta({ carnivora });
    triste.nodo.classList.add("asis-ilustracion", "asis-triste");
    triste.aplicar(triste.estadoVisual({ estado: "CRITICO", humedadPct: 25, luzPct: 30 }));
    limpiezas.push(balancear(triste.refs.grupoHojas));
    return [
      triste.nodo,
      h("p", { class: "asistente-estado" }, "Todavía no la vemos. Revisa esto:"),
      h("ul", { class: "asistente-ayuda lista-limpia" }, AYUDAS.map((a) =>
        h("li", { class: "asistente-ayuda-item" }, iconoDeAyuda(a.icono), h("div", {}, h("strong", {}, a.titulo), h("span", {}, ` ${a.detalle}`))))),
      h("p", { class: "texto-suave" }, "Seguimos buscando: si aparece, te avisamos aquí."),
      h("div", { class: "asistente-botones" },
        h("button", { type: "button", class: "boton boton-secundario asistente-accion", id: "btn-asistente-reintentar", onclick: () => { sinHallazgo = false; pintarPaso(); } }, "Buscar otra vez"),
        h("button", { type: "button", class: "boton boton-primario asistente-accion", id: "btn-asistente-escribir", onclick: () => despachar({ tipo: "ESCRIBIR_A_MANO" }) }, "Escribir el código")),
    ];
  }

  // ---- paso 3 ----
  function pasoConfirma() {
    const encontradas = estado.encontradas;
    const hay = encontradas.length > 0;
    const aviso = crearAviso();
    if (estado.error || errorDirecto) aviso.mostrar(estado.error || errorDirecto);
    errorDirecto = null;

    const cabecera = hay
      ? [
          h("p", { class: "asistente-estado", id: "asistente-encontramos" }, encontradas.length === 1 ? "Encontramos una matera" : `Encontramos ${encontradas.length} materas`),
          h("p", { class: "serial-grande asistente-enmascarado", id: "asistente-enmascarado", "aria-label": `Empieza por ${[...codigoVisible(encontradas[0].serialEnmascarado).replace(/·/g, "")].join(" ")}` }, encontradas.map((e) => enmascaradoVisible(e.serialEnmascarado)).join("   ")),
          h("p", { class: "texto-suave" }, "¿Es la tuya? Confírmalo con el código que muestra su pantalla."),
        ]
      : [h("p", { class: "texto-suave" }, "La pantalla de la matera muestra un código de 6 letras y números y, al lado, un cuadro QR. Usa el que prefieras.")];

    // Código: un solo campo para lectores de pantalla; las seis casillas son su reflejo visual.
    const casillas = Array.from({ length: 6 }, () => h("span", { class: "casilla", "aria-hidden": "true" }));
    const entradaCodigo = h("input", {
      id: "asistente-codigo", name: "serial", class: "casillas-input", type: "text", inputmode: "text", autocapitalize: "characters",
      autocomplete: "off", autocorrect: "off", spellcheck: "false", "aria-label": "Código de la matera, 6 letras y números",
      "aria-describedby": "asistente-codigo-error asistente-codigo-ayuda", placeholder: "YUBUD6",
    });
    const errorCodigo = h("p", { class: "error-campo", id: "asistente-codigo-error", "aria-live": "polite" });
    const pintarCasillas = () => {
      const valor = entradaCodigo.value;
      const activa = document.activeElement === entradaCodigo ? Math.min(valor.length, 5) : -1;
      casillas.forEach((c, i) => {
        c.textContent = valor[i] || "";
        c.dataset.llena = valor[i] ? "si" : "no";
        c.dataset.activa = i === activa ? "si" : "no";
      });
    };
    entradaCodigo.addEventListener("input", () => {
      entradaCodigo.value = limpiarEntradaDeCodigo(entradaCodigo.value);
      errorCodigo.textContent = "";
      entradaCodigo.removeAttribute("aria-invalid");
      pintarCasillas();
    });
    entradaCodigo.addEventListener("focus", pintarCasillas);
    entradaCodigo.addEventListener("blur", pintarCasillas);

    const boton = h("button", { type: "submit", class: "boton boton-primario asistente-accion", id: "btn-asistente-vincular" }, "Vincular mi matera");
    const formulario = h("form", { id: "formulario-asistente", novalidate: true, class: "asistente-codigo" },
      h("label", { for: "asistente-codigo", class: "asistente-etiqueta-campo" }, "Código de la matera"),
      h("div", { class: "casillas" }, casillas, entradaCodigo),
      h("p", { class: "rango-optimo", id: "asistente-codigo-ayuda" }, "Escríbelo o pégalo: las letras se ponen en mayúscula solas."),
      errorCodigo, aviso.elemento, boton);
    formulario.addEventListener("submit", (evento) => {
      evento.preventDefault();
      aviso.limpiar();
      const r = normalizarCodigo(entradaCodigo.value);
      const fallo = (texto) => {
        errorCodigo.textContent = texto;
        entradaCodigo.setAttribute("aria-invalid", "true");
        entradaCodigo.focus();
      };
      if (!r.ok) return fallo(r.error);
      if (!coincideConEncontradas(r.codigo, encontradas)) {
        return fallo(`Ese código no es de la matera que encontramos (${enmascaradoVisible(encontradas[0].serialEnmascarado)}). Revisa la pantalla.`);
      }
      serialObjetivo = r.serial;
      despachar({ tipo: "VINCULAR" });
    });

    const panelCodigo = h("div", { class: "asistente-panel", id: "panel-codigo", role: "tabpanel", "aria-labelledby": "opcion-codigo" }, formulario);
    // El QR se lee aquí mismo (F40): cámara en vivo si el navegador la permite, una foto si no. Del QR solo se
    // saca el código y se sigue por el mismo camino que al escribirlo.
    const lector = crearLectorQr({
      reposo: ilustracionQr(),
      alLeer: ({ codigo, serial }) => {
        if (!coincideConEncontradas(codigo, encontradas)) {
          return `Ese QR es de otra matera, no de la que encontramos (${enmascaradoVisible(encontradas[0].serialEnmascarado)}). Revisa cuál tienes enfrente.`;
        }
        serialObjetivo = serial;
        setTimeout(() => despachar({ tipo: "VINCULAR" }), 0); // cuando el lector ya apagó la cámara
        return true;
      },
    });
    const comoLeer = {
      vivo: "Apunta la cámara al cuadro blanco y negro de la pantalla de la matera. Lo leemos aquí mismo.",
      foto: "Tómale una foto al cuadro blanco y negro de la pantalla de la matera. La leemos aquí mismo.",
      manual: "Para leer el QR hace falta la cámara. Mejor escribe el código.",
    }[lector.modos[0]];
    const panelQr = h("div", { class: "asistente-panel", id: "panel-qr", role: "tabpanel", "aria-labelledby": "opcion-qr", hidden: true },
      h("p", { id: "lector-como" }, comoLeer),
      lector.nodo,
      h("p", { class: "texto-suave" }, `Al leerlo, la matera se vincula a «${planta.apodo}» sin preguntarte nada más.`));
    const opciones = [["codigo", "Escribir el código", panelCodigo], ["qr", "Usar el QR", panelQr]];
    const botonesOpcion = opciones.map(([clave, texto, panel]) => h("button", {
      type: "button", role: "tab", class: "asistente-opcion", id: `opcion-${clave}`, "aria-controls": panel.id, "aria-selected": clave === "codigo" ? "true" : "false",
      onclick: () => {
        botonesOpcion.forEach((b, i) => { b.setAttribute("aria-selected", b === botonesOpcion[opciones.findIndex((o) => o[0] === clave)] ? "true" : "false"); opciones[i][2].hidden = opciones[i][0] !== clave; });
        if (clave !== "qr") lector.detener(); // la cámara no sigue prendida detrás de la otra opción
      },
    }, texto));
    const selector = h("div", { class: "asistente-opciones", role: "tablist", "aria-label": "Cómo confirmar" }, botonesOpcion);

    const atras = h("button", { type: "button", class: "asistente-enlace", id: "btn-asistente-atras", onclick: () => despachar({ tipo: "ATRAS" }) }, "Volver a buscar");
    return {
      titulo: hay ? "Confirma que es la tuya" : "Dinos cuál es tu matera",
      anunciar: hay ? `${anuncioDePaso("confirma")}. ${encontradas.length === 1 ? "Encontramos una matera." : `Encontramos ${encontradas.length} materas.`}` : undefined,
      nodos: [...cabecera, selector, panelCodigo, panelQr, atras],
      limpiar: () => lector.destruir(), // al salir del paso o de la pantalla, la cámara se apaga
      enfocar: () => document.getElementById("asistente-paso-titulo")?.focus({ preventScroll: true }),
    };
  }

  // ---- paso 4 ----
  function pasoConectando() {
    const { nodo, arco } = anilloDeEspera();
    const parar = girar(arco);
    const texto = h("p", { class: "asistente-estado", id: "asistente-conectando-texto" }, `Conectando con tu matera ${codigoVisible(serialObjetivo)}…`);
    const detalle = h("p", { class: "texto-suave" }, "Tu matera se está presentando. Tarda unos segundos.");
    const acciones = h("div", { class: "asistente-botones", hidden: true });
    let cancelado = false;
    let temporizador = null;
    const limpiar = () => {
      cancelado = true;
      clearTimeout(temporizador);
      parar();
    };

    async function esperarConexion() {
      const limite = Date.now() + ESPERA_MAXIMA_CONEXION_MS;
      acciones.hidden = true;
      acciones.replaceChildren();
      const consultar = async () => {
        if (cancelado || !ctx.vigente()) return;
        try {
          const lista = await listarDispositivos(id);
          if (cancelado || !ctx.vigente()) return;
          const mio = lista.find((d) => d.serial === serialObjetivo);
          if (mio && mio.ultimaCredencialEn) {
            invalidarCache();
            despachar({ tipo: "CONECTADA" });
            return;
          }
        } catch {
          // un fallo suelto de red no corta la espera: se reintenta hasta el límite
        }
        if (Date.now() >= limite) {
          texto.textContent = "La matera tarda más de lo normal.";
          detalle.textContent = "Ya está vinculada a tu planta. Revisa que tenga Wi-Fi; en cuanto se conecte lo verás en su detalle.";
          acciones.hidden = false;
          acciones.append(
            h("button", { type: "button", class: "boton boton-secundario asistente-accion", id: "btn-asistente-seguir", onclick: () => { texto.textContent = `Conectando con tu matera ${codigoVisible(serialObjetivo)}…`; detalle.textContent = "Seguimos esperando a que la matera pida su acceso."; esperarConexion(); } }, "Seguir esperando"),
            h("button", { type: "button", class: "boton boton-primario asistente-accion", id: "btn-asistente-ver-igual", onclick: irADetalle }, "Ver mi planta"));
          anuncio.textContent = "La matera tarda más de lo normal. Puedes seguir esperando o ver tu planta.";
          return;
        }
        temporizador = setTimeout(consultar, INTERVALO_CONEXION_MS);
      };
      consultar();
    }

    (async () => {
      try {
        await vincularDispositivo(id, serialObjetivo);
        invalidarCache();
      } catch (error) {
        if (cancelado || !ctx.vigente()) return;
        despachar({ tipo: "FALLO", error: error.status === 404 ? "No encontramos una matera con ese código. Revisa la pantalla y que esté encendida." : error.mensaje || "No se pudo vincular." });
        return;
      }
      if (cancelado || !ctx.vigente()) return;
      esperarConexion();
    })();

    return { nodos: [nodo, texto, detalle, acciones], limpiar };
  }

  // ---- paso 5 ----
  function pasoExito() {
    olvidarPlantaRecordada();
    const escena = escenaDeExito({ carnivora });
    const ver = h("button", { type: "button", class: "boton boton-primario asistente-accion", id: "btn-asistente-ver", onclick: irADetalle }, "Ver mi planta");
    queueMicrotask(() => exito({ aro: escena.aro, planta: escena.planta, hojas: escena.hojas, chulo: escena.chulo, insignia: escena.insignia }));
    const detenerBalanceo = balancear(escena.ilustracion.refs.grupoHojas);
    return {
      titulo: "Conexión exitosa",
      anunciar: `Conexión exitosa. ${planta.apodo} ya está conectada a su matera ${codigoVisible(serialObjetivo)}.`,
      nodos: [escena.nodo, h("p", { class: "asistente-estado" }, `${planta.apodo} ya está conectada a su matera ${codigoVisible(serialObjetivo)}.`), h("p", { class: "texto-suave" }, "En unos segundos verás sus lecturas en el detalle de la planta."), ver],
      limpiar: detenerBalanceo,
      enfocar: () => ver.focus({ preventScroll: true }),
    };
  }

  pintarPaso();
  return () => {
    vivo = false;
    limpiezaPaso();
  };
}
