// La pestaña «Mascota» del detalle de planta (F54): la mascota grande, su ánimo en primera persona, la vitalidad, la
// racha, acariciar y «la regué» (solo el dueño) y la línea de tiempo de eventos, paginada. Los datos vienen de la
// fase 9 del backend (GET .../mascota, GET .../mascota/eventos, POST .../mascota/acciones) y de los avisos en vivo
// EVENTO_DE_MASCOTA, que reparte planta-detalle.js. Las palabras salen de mascota-animo.js (puro, con pruebas).
//
// El dibujo es el de la OLED y solo cambia a poses que la OLED tiene (la pose la decide planta-detalle con
// `poseDeMascota`); vitalidad, racha y línea de tiempo van alrededor, en texto.
import { obtenerMascota, obtenerEventosDeMascota, acariciarMascota, declararRiego } from "../api.js";
import { h, svg, vaciar, crearAviso, formatearFechaRelativa } from "../ui.js";
import { crearMascotaVista } from "./mascota-vista.js";
import { hayMovimiento } from "../animaciones.js";
import {
  fraseDeAnimo, textoDeCausa, vitalidadValida, nivelDeVitalidad, textoDeRacha, fraseDeEvento, iconoDeEventoClave,
  estadoDeRiego, accionDesdeEvento, eventoDesdeAviso, juntarEventos, animacionDeEvento, caricia,
} from "../mascota-animo.js";

const TAMANO_PAGINA = 10;
// Tras un aviso se vuelve a pedir la consulta (racha con su fecha, causa) un momento después; si llegan varios, una vez.
const RESINCRONIZAR_MS = 1500;
// Un «la regué» vencido lo resuelve el servidor en su minuto: se pregunta de nuevo pasado este margen.
const MARGEN_DE_VENCIMIENTO_MS = 20000;

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
export function crearPanelMascota(planta, ctx, { esDueno, alCambiar = () => {} }) {
  const id = planta.id;
  let datos = null; // la última consulta, con lo que los avisos le fueron cambiando
  let accion = null; // el «la regué» vigente (o el último resuelto, para decir qué pasó)
  let eventos = [];
  let pagina = 0;
  let totalDePaginas = 0;
  let saludoLocalEn = -Infinity;
  let resincronizacion = null;
  let revisionDeVencimiento = null;

  const mascota = crearMascotaVista({
    especie: planta.especie, nombre: planta.apodo, toque: true, clase: "mascota--grande",
    alTocar: esDueno ? () => acariciar() : null,
  });
  mascota.nodo.setAttribute("aria-label", esDueno ? `Acariciar a ${planta.apodo}` : `Saludar a ${planta.apodo}`);

  const frase = h("p", { class: "animo-frase", id: "animo-frase", "aria-live": "polite" }, "…");
  const numero = h("strong", { class: "vitalidad-numero", id: "vitalidad-numero" }, "—");
  const barra = crearBarraDeVitalidad({ etiqueta: "Vitalidad" });
  const causa = h("p", { class: "vitalidad-causa texto-suave", id: "vitalidad-causa", hidden: true });
  const racha = h("p", { class: "racha", id: "racha-texto" });
  const aviso = crearAviso();

  const botonAcariciar = h("button", { type: "button", class: "boton boton-secundario", id: "btn-acariciar" }, "Acariciar");
  const botonRegue = h("button", { type: "button", class: "boton boton-primario", id: "btn-la-regue" }, "La regué");
  const estadoRiego = h("p", { class: "estado-riego", id: "estado-riego", "aria-live": "polite", hidden: true });
  botonAcariciar.addEventListener("click", () => {
    mascota.saludar(); // el saludo es local e inmediato; `alTocar` hace la llamada
  });
  botonRegue.addEventListener("click", () => regar());

  const lista = h("ol", { class: "linea-tiempo", id: "linea-tiempo" });
  const vacio = h("p", { class: "texto-vacio", id: "linea-tiempo-vacia", hidden: true }, "Todavía no me ha pasado nada. Cuando me rieguen, salga al sol o me acaricies, lo verás aquí.");
  const botonMas = h("button", { type: "button", class: "boton boton-secundario boton-chico", id: "btn-mas-eventos", hidden: true }, "Cargar más");
  botonMas.addEventListener("click", () => cargarMas());

  const elemento = h("section", { class: "tarjeta panel-mascota", id: "seccion-mascota", "aria-labelledby": "titulo-mascota" },
    h("h2", { id: "titulo-mascota", class: "titulo-bloque" }, "Cómo se siente"),
    h("div", { class: "mascota-escena" },
      h("div", { class: "mascota-escena-dibujo" }, mascota.nodo),
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
    estadoRiego,
    h("h3", { class: "titulo-linea-tiempo" }, "Lo que me ha pasado"),
    vacio,
    lista,
    botonMas,
  );

  // ---- pintar ----

  function pintarDatos() {
    if (!datos) return;
    frase.textContent = fraseDeAnimo(datos.animo);
    frase.dataset.animo = datos.animo || "SIN_DATOS";
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
        h("span", { class: "evento-frase" }, fraseDeEvento(evento)),
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
    accion = consulta.accionPendiente || (accion && accion.estado !== "PENDIENTE" ? accion : null);
    pintarDatos();
    pintarRiego();
    alCambiar(datos);
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
      frase.textContent = "Todavía no sé cómo estoy";
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

  /** Llamado por el toque y el botón, DESPUÉS del saludo local. Un 200 (caricia repetida) no hace nada más. */
  async function acariciar() {
    saludoLocalEn = Date.now();
    try {
      const resultado = caricia(await acariciarMascota(id));
      if (!ctx.vigente() || !resultado.nueva) return;
      eventos = juntarEventos(eventos, [{ id: resultado.id, tipo: "ACARICIADA", ocurridoEn: resultado.en || new Date().toISOString(), detalle: {} }]);
      pintarEventos();
    } catch (error) {
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
      if (respuesta.estado === "CONFIRMADA") celebrar();
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

  function celebrar() {
    mascota.saludarSolo();
    estadoRiego.classList.remove("estado-riego--encoge");
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
   * la animación que toque. Devuelve el nombre de la animación ("regar" | "saludar" | null) para que planta-detalle la
   * repita en la mascota de la cabecera.
   */
  function alEvento(avisoEnVivo) {
    const d = avisoEnVivo.datos || {};
    const evento = eventoDesdeAviso(avisoEnVivo);
    if (!evento) return null;
    datos = { ...(datos || {}), animo: d.animo || (datos && datos.animo) || null };
    if (d.vitalidad !== undefined) datos.vitalidad = d.vitalidad;
    if (evento.tipo === "RACHA" && evento.detalle.dias) datos.racha = { ...(datos.racha || {}), dias: Number(evento.detalle.dias) };
    pintarDatos();
    alCambiar(datos);

    const nueva = accionDesdeEvento(evento.tipo, evento.detalle, evento.ocurridoEn);
    if (nueva) {
      accion = nueva;
      pintarRiego();
      if (nueva.estado === "DESMENTIDA") encogerse();
    }

    eventos = juntarEventos(eventos, [evento]);
    pintarEventos();
    resincronizarPronto();

    let animacion = animacionDeEvento(evento.tipo);
    // La caricia propia ya saludó al tocar: el eco del servidor no saluda dos veces.
    if (evento.tipo === "ACARICIADA" && Date.now() - saludoLocalEn < 4000) animacion = null;
    if (animacion === "regar") mascota.regar();
    if (animacion === "saludar") celebrar();
    return animacion;
  }

  // El riego pendiente cuenta la hora límite; cada 30 s se repinta por si venció.
  const reloj = setInterval(() => { if (accion && accion.estado === "PENDIENTE") pintarRiego(); }, 30000);

  return {
    elemento,
    mascota,
    cargar,
    refrescar,
    alEvento,
    datos: () => datos,
    parar: () => {
      mascota.parar();
      clearInterval(reloj);
      clearTimeout(resincronizacion);
      clearTimeout(revisionDeVencimiento);
    },
  };
}
