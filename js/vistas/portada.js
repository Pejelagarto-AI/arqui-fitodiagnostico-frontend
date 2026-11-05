// Portada (F38): lo primero que ve quien llega sin sesión. En un pantallazo de teléfono dice qué es el
// producto (una matera con sensores que te cuenta cómo está tu planta) y qué hacer (crear cuenta, entrar o
// probar sin cuenta). La protagonista es la misma ilustración reactiva del detalle: aquí recorre un guion
// (js/portada-guion.js) en el que la planta «habla» según lo que miden los sensores.
import { h, svg } from "../ui.js";
import { crearIlustracionPlanta } from "../componentes/ilustracion-planta.js";
import { iconoDeParametro } from "../componentes/diagnostico.js";
import { balancear, cambiarEstado, entrada, movimientoReducido, orquestarPortada } from "../animaciones.js";
import { MOMENTOS, PASOS, DURACION_MOMENTO_MS, siguienteMomento } from "../portada-guion.js";

export const titulo = "Tu planta te dice cómo está";

const SENSORES = [["agua", "humedad", "Agua"], ["luz", "luz", "Luz"], ["temperatura", "temperatura", "Temperatura"]];

/** Ilustraciones chicas de «Así funciona»: SVG propio, colores por clase (tokens del tema). */
function iconoDePaso(nombre) {
  const base = { viewBox: "0 0 48 48", "aria-hidden": "true", focusable: "false", class: "paso-icono" };
  if (nombre === "conecta") {
    return svg("svg", base,
      svg("path", { class: "pi-matera", d: "M13 24h22l-2.6 16H15.6z" }),
      svg("rect", { class: "pi-borde", x: 11, y: 21, width: 26, height: 5, rx: 2 }),
      svg("path", { class: "pi-tallo", d: "M24 21v-8", "stroke-width": 2.4, "stroke-linecap": "round", fill: "none" }),
      svg("path", { class: "pi-hoja", d: "M24 15c-4.5 0-7-2.6-7-6.5 4.5 0 7 2.6 7 6.5Z" }),
      svg("path", { class: "pi-onda", d: "M31 9.5a7 7 0 0 1 9.5 0M33.2 12.7a3.8 3.8 0 0 1 5.1 0", "stroke-width": 2.2, "stroke-linecap": "round", fill: "none" }),
      svg("circle", { class: "pi-punto", cx: 35.75, cy: 15.6, r: 1.4 }),
    );
  }
  if (nombre === "mira") {
    return svg("svg", base,
      [[10, "pi-agua", 20], [21, "pi-sol", 28], [32, "pi-calor", 15]].flatMap(([y, clase, ancho]) => [
        svg("rect", { class: "pi-pista", x: 7, y, width: 34, height: 7, rx: 3.5 }),
        svg("rect", { class: clase, x: 7, y, width: ancho, height: 7, rx: 3.5 }),
      ]),
    );
  }
  return svg("svg", base,
    svg("path", { class: "pi-agua", d: "M24 5c6.5 8.5 11 13.8 11 20.5a11 11 0 0 1-22 0C13 18.8 17.5 13.5 24 5Z" }),
    svg("path", { class: "pi-chulo", d: "M18.5 26.5l4 4 7.5-8.5", "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round", fill: "none" }),
  );
}

export async function montar(contenedor) {
  // ---- escena viva ----
  const plantas = {
    comun: crearIlustracionPlanta(),
    carnivora: crearIlustracionPlanta({ carnivora: true }),
  };
  const cajas = {
    comun: h("div", { class: "portada-planta", "data-planta": "comun" }, plantas.comun.nodo),
    carnivora: h("div", { class: "portada-planta", "data-planta": "carnivora", hidden: true }, plantas.carnivora.nodo),
  };
  const frase = h("p", { class: "portada-frase" });
  const globo = h("div", { class: "portada-globo" }, frase);
  const lecturas = SENSORES.map(([clave, parametro, etiqueta]) => {
    const valor = h("strong", {});
    return { clave, valor, nodo: h("span", { class: "portada-lectura", "data-sensor": clave }, iconoDeParametro(parametro), h("span", { class: "solo-lector" }, `${etiqueta}: `), valor) };
  });
  const pausa = h("button", { type: "button", class: "portada-pausa", id: "btn-portada-pausa", "aria-pressed": "false", "aria-label": "Pausar la animación" },
    svg("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false" },
      svg("path", { class: "pausa-barras", d: "M8 6v12M16 6v12", "stroke-width": 3, "stroke-linecap": "round", fill: "none" }),
      svg("path", { class: "pausa-triangulo", d: "M8 5.5v13l11-6.5z" }),
    ));
  // La escena es decorativa y se mueve sola: para lectores de pantalla queda una sola frase que la resume.
  const escena = h("div", { class: "portada-escena" },
    h("div", { class: "portada-escena-vivo", "aria-hidden": "true" }, cajas.comun, cajas.carnivora, globo, h("div", { class: "portada-lecturas" }, lecturas.map((l) => l.nodo))),
    h("p", { class: "solo-lector" }, "Ilustración: una planta en su matera cuenta cómo está. Dice «Tengo sed» cuando le falta agua, «Me falta luz» cuando está a oscuras y «Estoy bien» cuando no necesita nada."),
    pausa,
  );

  let indice = 0;
  let visible = "comun";
  function pintarMomento(i, { animar = true } = {}) {
    const m = MOMENTOS[i];
    const ilustracion = plantas[m.planta];
    if (m.planta !== visible) {
      cajas[visible].hidden = true;
      cajas[m.planta].hidden = false;
      visible = m.planta;
      if (animar) entrada(cajas[m.planta], { y: 10, duracion: 0.35 });
    }
    ilustracion.aplicar(ilustracion.estadoVisual({ estado: m.estado, humedadPct: m.humedad, luzPct: m.luz }), { animar });
    if (animar && m.muerde) ilustracion.morder();
    const aplicar = () => {
      frase.textContent = m.frase;
      globo.dataset.estado = m.estado;
    };
    if (animar) cambiarEstado(globo, aplicar);
    else aplicar();
    for (const l of lecturas) {
      l.valor.textContent = m.valores[l.clave];
      if (m.alerta === l.clave) l.nodo.dataset.alerta = "";
      else delete l.nodo.dataset.alerta;
    }
  }
  pintarMomento(0, { animar: false });

  // ---- mensaje y acciones ----
  const titular = h("h2", { class: "portada-titulo", "data-titulo": "" }, "Tu planta te dice cómo está");
  const bajada = h("p", { class: "portada-bajada" }, "Fitodiagnóstico es una matera con sensores. Mide el agua, la luz y la temperatura, y te avisa qué necesita tu planta.");
  const acciones = h("div", { class: "portada-acciones" },
    h("a", { href: "#/registro", class: "boton boton-primario", id: "portada-crear" }, "Crear cuenta"),
    h("a", { href: "#/entrar", class: "boton boton-secundario", id: "portada-entrar" }, "Ya tengo cuenta"),
  );
  const probar = h("p", { class: "portada-probar" }, "¿Todavía no tienes matera? ", h("a", { href: "#/diagnostico", id: "portada-probar" }, "Prueba sin cuenta"));
  const mensaje = h("div", { class: "portada-mensaje" }, titular, bajada, acciones, probar);

  // ---- así funciona ----
  const pasos = PASOS.map((paso, i) =>
    h("li", { class: "portada-paso" },
      h("div", { class: "portada-paso-dibujo" }, iconoDePaso(paso.icono)),
      h("div", { class: "portada-paso-texto" }, h("h3", {}, h("span", { class: "portada-paso-numero", "aria-hidden": "true" }, String(i + 1)), paso.titulo), h("p", {}, paso.texto)),
    ));
  const comoFunciona = h("section", { class: "portada-como", "aria-labelledby": "titulo-como" },
    h("h2", { id: "titulo-como", class: "portada-subtitulo" }, "Así funciona"),
    h("ol", { class: "portada-pasos" }, pasos),
  );

  contenedor.append(h("div", { class: "portada" }, h("section", { class: "portada-heroe", "aria-labelledby": "portada-titulo" }, escena, mensaje), comoFunciona));
  titular.id = "portada-titulo";

  // ---- vida: entrada orquestada, balanceo y el guion en bucle (pausable; con movimiento reducido, quieta) ----
  const limpiezas = [
    orquestarPortada({ escena, planta: plantas.comun.refs.grupoPlanta, globo, lecturas: lecturas.map((l) => l.nodo), textos: [titular, bajada, acciones, probar], pasos }),
    balancear(plantas.comun.refs.grupoHojas),
    balancear(plantas.carnivora.refs.grupoHojas),
  ];
  let reloj = null;
  const avanzar = () => {
    if (document.visibilityState === "hidden") return;
    indice = siguienteMomento(indice);
    pintarMomento(indice);
  };
  const arrancar = () => { if (!reloj) reloj = setInterval(avanzar, DURACION_MOMENTO_MS); };
  const detener = () => { clearInterval(reloj); reloj = null; };
  if (movimientoReducido()) {
    pausa.hidden = true; // nada se mueve solo: no hay nada que pausar
  } else {
    arrancar();
    pausa.addEventListener("click", () => {
      const pausada = pausa.getAttribute("aria-pressed") !== "true";
      pausa.setAttribute("aria-pressed", String(pausada));
      pausa.setAttribute("aria-label", pausada ? "Reanudar la animación" : "Pausar la animación");
      if (pausada) detener();
      else arrancar();
    });
  }
  limpiezas.push(detener);
  return () => limpiezas.forEach((limpiar) => limpiar());
}
