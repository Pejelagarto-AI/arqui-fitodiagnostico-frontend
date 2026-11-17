// La pestaña «Mascota» del detalle de planta (F54): la mascota grande, su ánimo en primera persona, la vitalidad, la
// racha, acariciar y «la regué» (solo el dueño) y la línea de tiempo de eventos, paginada. Los datos vienen de la
// fase 9 del backend (GET .../mascota, GET .../mascota/eventos, POST .../mascota/acciones) y de los avisos en vivo
// EVENTO_DE_MASCOTA, que reparte planta-detalle.js. Las palabras salen de mascota-animo.js (puro, con pruebas).
//
// El dibujo es el de la OLED y solo cambia a poses que la OLED tiene (la pose la decide planta-detalle con
// `poseDeMascota`); vitalidad, racha y línea de tiempo van alrededor, en texto.
//
// F56 (fase 14 del backend): la mascota habla con la personalidad de su familia (`mascota-frases.js`), los eventos suenan
// de a uno en una cola de 3000 ms por turno (`mascota-eventos.js`, la misma regla que `fito_mascota.c`), el dueño elige el
// accesorio, y la fila de abajo de la OLED (estado / frase cada 3 s) tiene su equivalente aquí: una línea bajo el dibujo.
//
// Vitalidad: la OLED dibuja una línea de 78x1 px en (50, 45) solo mientras muestra una frase (D193), porque ahí no cabe otra
// cosa. Aquí la barra con `role="meter"` y su número están siempre al lado del dibujo: es la UI equivalente y no se
// duplica con una segunda línea de píxeles; el número es el del servidor (`vitalidad`) sin tocarlo.
import { obtenerMascota, obtenerEventosDeMascota, acariciarMascota, declararRiego, cambiarAccesorioDeMascota } from "../api.js";
import { h, svg, vaciar, crearAviso, formatearFechaRelativa } from "../ui.js";
import { crearMascotaVista } from "./mascota-vista.js";
import { hayMovimiento } from "../animaciones.js";
import { crearReproductor, crearRegistroDeCaricias, haceSaludo, ACCESORIOS } from "../mascota-eventos.js";
import {
  fraseDeLaMascota, fraseDeEventoDeLaMascota, textoDeFila, hayFraseDeAnimo, textoDeCausa, vitalidadValida, nivelDeVitalidad, textoDeRacha,
  fraseDeEvento, iconoDeEventoClave, estadoDeRiego, accionDesdeEvento, eventoDesdeAviso, juntarEventos, caricia,
} from "../mascota-animo.js";

const TAMANO_PAGINA = 10;
// Tras un aviso se vuelve a pedir la consulta (racha con su fecha, causa) un momento después; si llegan varios, una vez.
const RESINCRONIZAR_MS = 1500;
// Un «la regué» vencido lo resuelve el servidor en su minuto: se pregunta de nuevo pasado este margen.
const MARGEN_DE_VENCIMIENTO_MS = 20000;
// La caricia es de la planta: el servidor responde «repetida» (200) si llega otra dentro de 10 s (D172 del backend). Dentro de
// ese lapso un toque solo saluda (como el BOOT de la OLED) en vez de encolar otro corazón que el servidor no va a contar.
const ENFRIAMIENTO_DE_CARICIA_MS = 10000;
// La cola de eventos y su texto se miran cada 250 ms (la cola avanza con el reloj, no con el dibujo: también sirve con movimiento reducido).
const REFRESCO_DE_TEXTO_MS = 250;
const OPCIONES_DE_ACCESORIO = Object.freeze([["NINGUNO", "Ninguno"], ["SOMBRERO", "Sombrero"], ["MONO", "Moño"], ["GAFAS", "Gafas"]]);

const ICONOS = {
  gota: [["path", { d: "M8 2.5c2.3 3 3.6 5 3.6 6.8A3.6 3.6 0 0 1 4.4 9.3C4.4 7.5 5.7 5.5 8 2.5z" }]],
  sol: [["circle", { cx: 8, cy: 8, r: 2.6 }], ["path", { d: "M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1" }]],
  desmayo: [["path", { d: "M8 2.5v8M4.8 7.6 8 10.8l3.2-3.2M4 13.5h8" }]],
  revivio: [["path", { d: "M8 13.5v-8M4.8 8.4 8 5.2l3.2 3.2M4 2.5h8" }]],
  corazon: [["path", { d: "M8 13.2S2.6 9.8 2.6 6.2A2.7 2.7 0 0 1 8 5a2.7 2.7 0 0 1 5.4 1.2c0 3.6-5.4 7-5.4 7z" }]],
  racha: [["path", { d: "M8 1.8l1.8 3.9 4.2.5-3.1 2.9.8 4.2L8 11.2l-3.7 2.1.8-4.2L2 6.2l4.2-.5z" }]],
  reloj: [["circle", { cx: 8, cy: 8, r: 5.6 }], ["path", { d: "M8 4.8V8l2.2 1.4" }]],
  confirmado: [["circle", { cx: 8, cy: 8, r: 5.6 }], ["path", { d: "M5.4 8.2 7.2 10l3.4-3.8" }]],
  desmentido: [["circle", { cx: 8, cy: 8, r: 5.6 }], ["path", { d: "M6 6l4 4M10 6l-4 4" }]],
  punto: [["circle", { cx: 8, cy: 8, r: 2.4 }]],
};

/** Icono de 16x16 de un tipo de evento (decorativo: la frase dice lo mismo). */
export function iconoDeEvento(tipo) {
  const clave = iconoDeEventoClave(tipo);
  return svg("svg", { viewBox: "0 0 16 16", class: `evento-icono evento-icono--${clave}`, "aria-hidden": "true", focusable: "false" },
    ICONOS[clave].map(([etiqueta, atributos]) => svg(etiqueta, atributos)));
}

/**
 * Barra de vitalidad reutilizable (la grande de la pestaña y la fina del tablero): { nodo, poner(vitalidad) }.
 * `role="meter"` con su valor: el número también se ve en texto al lado (la grande) o en el `title` (la fina).
 */
export function crearBarraDeVitalidad({ clase = "", etiqueta = "Vitalidad" } = {}) {
  const relleno = h("span", { class: "vitalidad-relleno" });
  const nodo = h("span", { class: `vitalidad-barra ${clase}`.trim(), role: "meter", "aria-label": etiqueta, "aria-valuemin": "0", "aria-valuemax": "100", "data-nivel": "SIN_DIAGNOSTICO" }, relleno);
  function poner(valor) {
    const v = vitalidadValida(valor);
    nodo.dataset.nivel = nivelDeVitalidad(v);
    if (v === null) {
      nodo.removeAttribute("aria-valuenow");
      nodo.setAttribute("aria-valuetext", "sin dato");
    } else {
      nodo.setAttribute("aria-valuenow", String(v));
      nodo.setAttribute("aria-valuetext", `${v} de 100`);
    }
    // CSSOM (no el atributo style): la CSP lo permite, como las barras de los parámetros en diagnostico.js.
    relleno.style.width = `${v === null ? 0 : v}%`;
  }
  return { nodo, poner };
}

/**
 * Crea la pestaña. `especie` y `apodo` escogen el dibujo; `esDueno` decide si hay botones. `alCambiar(datos)` avisa a
 * planta-detalle cuando cambia el ánimo (para recalcular la pose de las dos mascotas). Devuelve
 * { elemento, mascota, cargar(), refrescar(), alEvento(aviso), parar() }.
 */
export function crearPanelMascota(planta, ctx, { esDueno, alCambiar = () => {}, alDisparar = () => {} }) {
  const id = planta.id;
  let datos = null; // la última consulta, con lo que los avisos le fueron cambiando
  let carga = "cargando"; // cargando | listo | fallo (para el globo mientras no hay datos)
  let accesorio = "NINGUNO"; // el que se ve (el elegido, aunque el servidor no haya confirmado todavía)
  let accesorioConfirmado = "NINGUNO"; // el último que el servidor dijo
  let accesorioEnVuelo = false;
  let accesorioSiguiente = null;
  let estadoDelDiagnostico = null; // lo que dice la fila de estado (D191)
  let ultimaCaricia = -Infinity;
  const reproductor = crearReproductor(); // la cola de eventos de a uno: la comparten las mascotas de la cabecera y de esta pestaña
  const caricias = crearRegistroDeCaricias(); // para no animar dos veces la caricia propia que vuelve como evento
  let accion = null; // el «la regué» vigente (o el último resuelto, para decir qué pasó)
  let eventos = [];
  let pagina = 0;
  let totalDePaginas = 0;
  let resincronizacion = null;
  let revisionDeVencimiento = null;

  const mascota = crearMascotaVista({
    especie: planta.especie, nombre: planta.apodo, toque: true, clase: "mascota--grande", eventos: reproductor,
    alToque: esDueno ? () => tocar() : null,
  });
  mascota.nodo.setAttribute("aria-label", esDueno ? `Acariciar a ${planta.apodo}` : `Saludar a ${planta.apodo}`);

  // El globo: la frase del ánimo con la personalidad de la familia y, 3 s, la del evento que acaba de llegar (D191).
  const frase = h("p", { class: "animo-frase", id: "animo-frase", "aria-live": "polite" }, "…");
  // La fila de abajo de la OLED (D191): alterna cada 3 s el estado y la frase; con un evento, su frase. Es decorativa
  // (`aria-hidden`): lo mismo ya está dicho en el globo y en el aviso de estado, y un texto vivo que cambia cada 3 s
  // sería ruido para un lector de pantalla.
  const filaDeEstado = h("p", { class: "mascota-fila", id: "mascota-fila", "aria-hidden": "true" });
  const numero = h("strong", { class: "vitalidad-numero", id: "vitalidad-numero" }, "—");
  const barra = crearBarraDeVitalidad({ etiqueta: "Vitalidad" });
  const causa = h("p", { class: "vitalidad-causa texto-suave", id: "vitalidad-causa", hidden: true });
  const racha = h("p", { class: "racha", id: "racha-texto" });
  const aviso = crearAviso();

  const botonAcariciar = h("button", { type: "button", class: "boton boton-secundario", id: "btn-acariciar" }, "Acariciar");
  const botonRegue = h("button", { type: "button", class: "boton boton-primario", id: "btn-la-regue" }, "La regué");
  const estadoRiego = h("p", { class: "estado-riego", id: "estado-riego", "aria-live": "polite", hidden: true });
  botonAcariciar.addEventListener("click", () => {
    mascota.saludar(); // lo mismo que tocar la mascota: `alToque` (tocar) encola la caricia y llama al servidor
  });
  botonRegue.addEventListener("click", () => regar());

  const lista = h("ol", { class: "linea-tiempo", id: "linea-tiempo" });
  const vacio = h("p", { class: "texto-vacio", id: "linea-tiempo-vacia", hidden: true }, "Todavía no me ha pasado nada. Cuando me rieguen, salga al sol o me acaricies, lo verás aquí.");
  const botonMas = h("button", { type: "button", class: "boton boton-secundario boton-chico", id: "btn-mas-eventos", hidden: true }, "Cargar más");
  botonMas.addEventListener("click", () => cargarMas());

  const selector = esDueno ? crearSelectorDeAccesorio() : null;

  const elemento = h("section", { class: "tarjeta panel-mascota", id: "seccion-mascota", "aria-labelledby": "titulo-mascota" },
    h("h2", { id: "titulo-mascota", class: "titulo-bloque" }, "Cómo se siente"),
    h("div", { class: "mascota-escena" },
      h("div", { class: "mascota-escena-dibujo" }, mascota.nodo, filaDeEstado),
      h("div", { class: "mascota-escena-texto" },
        frase,
        h("div", { class: "vitalidad" },
          h("span", { class: "vitalidad-etiqueta" }, "Vitalidad"),
          barra.nodo,
          h("span", { class: "vitalidad-valor" }, numero, h("span", { class: "texto-suave" }, " / 100")),
        ),
        causa,
        racha,
      ),
    ),
    aviso.elemento,
    esDueno ? h("div", { class: "mascota-acciones" }, botonAcariciar, botonRegue) : null,
    selector ? selector.elemento : null,
    estadoRiego,
    h("h3", { class: "titulo-linea-tiempo" }, "Lo que me ha pasado"),
    vacio,
    lista,
    botonMas,
  );

  // ---- pintar ----

  /**
   * El globo y la fila de estado, con la cola de eventos: mientras suena un evento (3000 ms) los dos dicen la frase del
   * evento; después el globo vuelve a la del ánimo y la fila alterna cada 3 s el estado y la frase (`fito_fila`).
   */
  function pintarTexto() {
    const sonando = reproductor.avanzar();
    const familia = mascota.familia;
    const animo = datos ? datos.animo : null;
    const fraseDelEvento = sonando ? fraseDeEventoDeLaMascota(familia, sonando.tipo) : null;
    const globo = fraseDelEvento ?? (datos ? fraseDeLaMascota(familia, animo) : carga === "fallo" ? fraseDeLaMascota(familia, "SIN_DATOS") : "…");
    if (frase.textContent !== globo) frase.textContent = globo;
    frase.dataset.animo = (datos && datos.animo) || "SIN_DATOS";
    if (sonando) frase.dataset.evento = sonando.tipo;
    else delete frase.dataset.evento;
    const fila = reproductor.fila(Boolean(datos) && hayFraseDeAnimo(familia, animo));
    const { texto, esFrase } = textoDeFila({ familia, animo, estado: estadoDelDiagnostico, fila, tipoDeEvento: sonando ? sonando.tipo : null });
    if (filaDeEstado.textContent !== texto) filaDeEstado.textContent = texto;
    filaDeEstado.dataset.frase = String(esFrase);
  }

  function pintarDatos() {
    if (!datos) return;
    pintarTexto();
    const v = vitalidadValida(datos.vitalidad);
    numero.textContent = v === null ? "—" : String(v);
    barra.poner(v);
    const texto = textoDeCausa(datos.causa);
    causa.hidden = !texto;
    causa.textContent = texto || "";
    racha.textContent = textoDeRacha(datos.racha);
  }

  function pintarRiego() {
    const r = estadoDeRiego(accion);
    estadoRiego.hidden = r.fase === "ninguna";
    estadoRiego.textContent = r.texto;
    estadoRiego.dataset.fase = r.fase;
    botonRegue.disabled = r.bloquea;
    clearTimeout(revisionDeVencimiento);
    if (r.fase === "pendiente" || r.fase === "vencida") {
      // Si el aviso en vivo no llega (red caída), se pregunta otra vez pasado el plazo.
      const vence = new Date(accion.venceEn).getTime();
      const espera = Number.isFinite(vence) ? Math.max(vence - Date.now(), 0) + MARGEN_DE_VENCIMIENTO_MS : 60000;
      revisionDeVencimiento = setTimeout(() => { if (ctx.vigente()) refrescar(); }, espera);
    }
  }

  function filaDeEvento(evento) {
    return h("li", { class: "evento", "data-tipo": evento.tipo, "data-id": evento.id || "" },
      h("span", { class: "evento-marca" }, iconoDeEvento(evento.tipo)),
      h("span", { class: "evento-texto" },
        h("span", { class: "evento-frase" }, fraseDeEvento(evento, mascota.familia)),
        evento.ocurridoEn ? h("time", { class: "evento-cuando texto-suave", datetime: evento.ocurridoEn }, formatearFechaRelativa(evento.ocurridoEn)) : null),
    );
  }

  function pintarEventos() {
    vaciar(lista);
    lista.append(...eventos.map(filaDeEvento));
    vacio.hidden = eventos.length > 0;
    botonMas.hidden = pagina + 1 >= totalDePaginas;
  }

  // ---- datos ----

  function tomar(consulta) {
    datos = consulta;
    accesorioConfirmado = ACCESORIOS.includes(consulta.accesorio) ? consulta.accesorio : "NINGUNO"; // un servidor viejo no lo manda
    if (!accesorioEnVuelo) accesorio = accesorioConfirmado;
    marcarAccesorio();
    accion = consulta.accionPendiente || (accion && accion.estado !== "PENDIENTE" ? accion : null);
    carga = "listo";
    pintarDatos();
    pintarRiego();
    emitir();
  }

  /** Lo que ve planta-detalle: la última consulta con el accesorio que se ve (para la pose de las dos mascotas). */
  function emitir() {
    alCambiar({ ...(datos || {}), accesorio });
  }

  async function cargar() {
    try {
      const [consulta, linea] = await Promise.all([obtenerMascota(id), obtenerEventosDeMascota(id, 0, TAMANO_PAGINA)]);
      if (!ctx.vigente()) return;
      aviso.limpiar();
      tomar(consulta);
      eventos = juntarEventos(eventos, linea.contenido || []);
      pagina = 0;
      totalDePaginas = linea.totalDePaginas || 0;
      pintarEventos();
    } catch (error) {
      if (!ctx.vigente()) return;
      // Un backend sin la fase 9 (404 de ruta) o una red caída: la pestaña lo dice y el resto de la planta sigue.
      carga = "fallo";
      pintarTexto();
      aviso.mostrar(error);
    }
  }

  /** Solo la consulta (vitalidad, ánimo, racha, pendiente). En silencio: un fallo no muestra nada. */
  async function refrescar() {
    try {
      const consulta = await obtenerMascota(id);
      if (!ctx.vigente()) return;
      aviso.limpiar();
      tomar(consulta);
    } catch {
      // el próximo aviso o la próxima vuelta lo intentará otra vez
    }
  }

  async function cargarMas() {
    try {
      botonMas.disabled = true;
      const linea = await obtenerEventosDeMascota(id, pagina + 1, TAMANO_PAGINA);
      if (!ctx.vigente()) return;
      pagina = linea.pagina;
      totalDePaginas = linea.totalDePaginas || totalDePaginas;
      eventos = juntarEventos(eventos, linea.contenido || []);
      pintarEventos();
    } catch (error) {
      if (ctx.vigente()) aviso.mostrar(error);
    } finally {
      botonMas.disabled = false;
    }
  }

  function resincronizarPronto() {
    clearTimeout(resincronizacion);
    resincronizacion = setTimeout(() => { if (ctx.vigente()) refrescar(); }, RESINCRONIZAR_MS);
  }

  // ---- acciones del dueño ----

  /**
   * El toque del dueño (y el botón «Acariciar»): la caricia suena YA en la cola (saludo, corazón y la frase «jiji») sin
   * esperar a la red, y se le avisa al servidor. El evento ACARICIADA que vuelve por el aviso en vivo lleva el id de esta
   * misma caricia y no se anima otra vez (el firmware sí repite, D198: la matera no distingue la suya; aquí sí). Dentro de
   * los 10 s de enfriamiento del servidor solo saluda, sin otro corazón que el servidor no contaría.
   */
  function tocar() {
    const ahora = Date.now();
    if (ahora - ultimaCaricia >= ENFRIAMIENTO_DE_CARICIA_MS) {
      ultimaCaricia = ahora;
      disparar("ACARICIADA");
    } else {
      mascota.saludarSolo();
    }
    acariciar();
  }

  /** Pone un evento en la cola de las mascotas (la de la cabecera comparte la misma) y lo dice ya. */
  function disparar(tipo) {
    if (!reproductor.empujar(tipo)) return;
    // Con movimiento reducido no hay cuadros: el saludo queda como un cambio de expresión (como el toque de F47)
    if (!hayMovimiento() && haceSaludo(tipo)) mascota.saludarSolo();
    alDisparar(tipo);
    pintarTexto();
  }

  /** Avisa al servidor. Un 200 (caricia repetida) no hace nada más. */
  async function acariciar() {
    caricias.empezar();
    let id = null;
    try {
      const resultado = caricia(await acariciarMascota(id));
      if (resultado.nueva) id = resultado.id;
      caricias.terminar(id);
      if (!ctx.vigente() || !resultado.nueva) return;
      eventos = juntarEventos(eventos, [{ id: resultado.id, tipo: "ACARICIADA", ocurridoEn: resultado.en || new Date().toISOString(), detalle: { origen: "PERSONA" } }]);
      pintarEventos();
    } catch (error) {
      caricias.terminar(null);
      if (!ctx.vigente()) return;
      if (error && error.status === 403) { ocultarAcciones(); return; } // perdió la propiedad: sin error, sin botones
      aviso.mostrar(error);
    }
  }

  async function regar() {
    aviso.limpiar();
    botonRegue.disabled = true;
    try {
      const respuesta = await declararRiego(id);
      if (!ctx.vigente()) return;
      accion = respuesta;
      pintarRiego();
      // CONFIRMADA: el servidor también manda el evento RIEGO_CONFIRMADO, que llega a la cola con su frase (la OLED no hace más)
      resincronizarPronto();
    } catch (error) {
      if (!ctx.vigente()) return;
      if (error && error.status === 403) { ocultarAcciones(); return; }
      aviso.mostrar(error);
      pintarRiego();
    }
  }

  function ocultarAcciones() {
    const acciones = elemento.querySelector(".mascota-acciones");
    if (acciones) acciones.hidden = true;
  }

  /** El riego desmentido: la mascota no cambia (la OLED no tiene esa cara); el texto se «encoge de hombros». */
  function encogerse() {
    estadoRiego.classList.remove("estado-riego--encoge");
    if (!hayMovimiento()) return;
    void estadoRiego.offsetWidth; // reinicia la animación de CSS
    estadoRiego.classList.add("estado-riego--encoge");
  }

  // ---- avisos en vivo (EVENTO_DE_MASCOTA) ----

  /**
   * Un evento llegó por el WebSocket: vitalidad y ánimo del aviso al instante, el evento arriba en la línea de tiempo y
   * a la cola de la mascota (animación y frase, de a uno, 3000 ms cada uno). Una caricia propia que vuelve como evento no
   * se anima otra vez (ver `tocar`). Devuelve true si el evento entró a la cola.
   */
  function alEvento(avisoEnVivo) {
    const d = avisoEnVivo.datos || {};
    const evento = eventoDesdeAviso(avisoEnVivo);
    if (!evento) return false;
    datos = { ...(datos || {}), animo: d.animo || (datos && datos.animo) || null };
    if (d.vitalidad !== undefined) datos.vitalidad = d.vitalidad;
    if (evento.tipo === "RACHA" && evento.detalle.dias) datos.racha = { ...(datos.racha || {}), dias: Number(evento.detalle.dias) };
    pintarDatos();
    emitir();

    const nueva = accionDesdeEvento(evento.tipo, evento.detalle, evento.ocurridoEn);
    if (nueva) {
      accion = nueva;
      pintarRiego();
      if (nueva.estado === "DESMENTIDA") encogerse();
    }

    eventos = juntarEventos(eventos, [evento]);
    pintarEventos();
    resincronizarPronto();

    const eco = evento.tipo === "ACARICIADA" && caricias.esEco(evento.id, d.origen);
    if (eco) return false;
    disparar(evento.tipo);
    return true;
  }

  // ---- el accesorio (F56) ----

  /** Los cuatro accesorios como un grupo de radios: cada uno con la mascota en miniatura llevándolo. Solo el dueño. */
  function crearSelectorDeAccesorio() {
    const grupo = `accesorio-${id}`;
    const radios = new Map();
    const minis = [];
    const opciones = OPCIONES_DE_ACCESORIO.map(([valor, etiqueta]) => {
      // La misma mascota de la planta, quieta y saludable, con el accesorio puesto (no anima: es una vista previa).
      const mini = crearMascotaVista({ familia: mascota.familia, estado: "SALUDABLE", clase: "mascota--mini", accesorio: valor, animar: false });
      minis.push(mini);
      const input = h("input", { type: "radio", name: grupo, value: valor, id: `${grupo}-${valor}`, class: "accesorio-radio" });
      radios.set(valor, input);
      input.addEventListener("change", () => { if (input.checked) elegirAccesorio(valor); });
      return h("label", { class: "accesorio-opcion", for: input.id }, input,
        h("span", { class: "accesorio-miniatura", "aria-hidden": "true" }, mini.nodo),
        h("span", { class: "accesorio-nombre" }, etiqueta));
    });
    const elemento = h("fieldset", { class: "accesorios", id: "selector-accesorio" },
      h("legend", { class: "accesorios-titulo" }, "Accesorio"),
      h("div", { class: "accesorios-opciones" }, opciones));
    return { elemento, radios };
  }

  /** Marca en el selector el accesorio que se ve. */
  function marcarAccesorio() {
    if (!selector) return;
    for (const [valor, input] of selector.radios) input.checked = valor === accesorio;
  }

  /** Aplica al instante en las mascotas y lo guarda; si el servidor no lo acepta, vuelve al que tenía. */
  async function elegirAccesorio(valor) {
    if (valor === accesorio) return;
    aviso.limpiar();
    accesorio = valor;
    marcarAccesorio();
    emitir();
    if (accesorioEnVuelo) { accesorioSiguiente = valor; return; } // se manda el último elegido cuando termine el que va
    accesorioEnVuelo = true;
    let objetivo = valor;
    try {
      for (;;) {
        const vista = await cambiarAccesorioDeMascota(id, objetivo);
        if (!ctx.vigente()) return;
        accesorioConfirmado = ACCESORIOS.includes(vista.accesorio) ? vista.accesorio : objetivo;
        if (accesorioSiguiente === null) break;
        objetivo = accesorioSiguiente;
        accesorioSiguiente = null;
      }
      accesorioEnVuelo = false;
      accesorio = accesorioConfirmado;
      if (datos) datos = { ...datos, accesorio };
      marcarAccesorio();
      emitir();
    } catch (error) {
      accesorioEnVuelo = false;
      accesorioSiguiente = null;
      if (!ctx.vigente()) return;
      accesorio = accesorioConfirmado;
      marcarAccesorio();
      emitir();
      if (error && error.status === 403) { if (selector) selector.elemento.hidden = true; return; } // perdió la propiedad
      aviso.mostrar(error);
    } finally {
      accesorioEnVuelo = false;
    }
  }

  /** El aviso en vivo MASCOTA_ACTUALIZADA (otra pestaña o el dueño en otro aparato cambió el accesorio). */
  function alAccesorio(avisoEnVivo) {
    const nuevo = avisoEnVivo && avisoEnVivo.datos && avisoEnVivo.datos.accesorio;
    if (!ACCESORIOS.includes(nuevo) || accesorioEnVuelo) return; // el de esta pestaña ya lo sabe: el aviso es su propio eco
    accesorioConfirmado = nuevo;
    accesorio = nuevo;
    if (datos) datos = { ...datos, accesorio: nuevo };
    marcarAccesorio();
    emitir();
  }

  // El texto y la cola se miran cada 250 ms: la cola avanza con el reloj, no con los cuadros del dibujo.
  const relojDeTexto = setInterval(() => { if (ctx.vigente()) pintarTexto(); }, REFRESCO_DE_TEXTO_MS);

  // El riego pendiente cuenta la hora límite; cada 30 s se repinta por si venció.
  const reloj = setInterval(() => { if (accion && accion.estado === "PENDIENTE") pintarRiego(); }, 30000);

  marcarAccesorio();
  pintarTexto();

  return {
    elemento,
    mascota,
    reproductor,
    cargar,
    refrescar,
    alEvento,
    alAccesorio,
    /** El estado del diagnóstico vigente (SALUDABLE, EN_RIESGO, CRITICO o null): lo que dice la fila de estado. */
    ponerEstadoDelDiagnostico: (estado) => { estadoDelDiagnostico = estado; pintarTexto(); },
    datos: () => datos,
    parar: () => {
      mascota.parar();
      clearInterval(reloj);
      clearInterval(relojDeTexto);
      clearTimeout(resincronizacion);
      clearTimeout(revisionDeVencimiento);
    },
  };
}
