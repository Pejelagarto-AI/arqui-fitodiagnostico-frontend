// Mascotas por familia de especie (F41): el MISMO personaje que la matera pinta en su OLED (fase 7 del firmware,
// D110 a D117), en vector plano con los tokens del front. Familias: girasol, cactus, suculenta, helecho, carnívora
// y genérica (respaldo). El SVG usa el sistema de coordenadas del sprite de la OLED (48x64, borde de la matera en
// la fila 46), así cada número de `mascota-tiempo.js` (centro de la cara, amplitud del balanceo, flor del cactus)
// se aplica tal cual. El cuerpo se dibuja una vez; la CARA va aparte (`.masc-cara`) y se repinta por cuadro con
// las piezas que calcula `piezasDeCara`, como `caraGrande` en el chip: ojos, cejas, boca y lágrima por estado.
// Se construye con createElementNS (`svg()`); los colores salen de clases del CSS, nunca de estilos en línea.
import { svg } from "../ui.js";
import { HOJAS_CARNIVORA, crearCabeza, ABIERTA_SUP, ABIERTA_INF } from "./ilustracion-planta.js";
import { FAMILIAS } from "./especie.js";
import * as T from "./mascota-tiempo.js";

/**
 * Hoja puntiaguda que sale de (x, y) hacia `grados` (0 = derecha, -90 = arriba), de largo `largo` y medio ancho
 * `ancho`. Devuelve el trazo. Puro.
 */
export function hojaPuntiaguda(x, y, grados, largo, ancho) {
  const r = (grados * Math.PI) / 180;
  const ux = Math.cos(r);
  const uy = Math.sin(r);
  const n = (v) => Number(v.toFixed(2));
  const punta = [x + ux * largo, y + uy * largo];
  const medio = [x + ux * largo * 0.5, y + uy * largo * 0.5];
  const c1 = [medio[0] - uy * ancho * 2, medio[1] + ux * ancho * 2];
  const c2 = [medio[0] + uy * ancho * 2, medio[1] - ux * ancho * 2];
  return `M${n(x)} ${n(y)}Q${n(c1[0])} ${n(c1[1])} ${n(punta[0])} ${n(punta[1])}Q${n(c2[0])} ${n(c2[1])} ${n(x)} ${n(y)}Z`;
}

const hoja = (clase, x, y, grados, largo, ancho) => svg("path", { class: `ilu-hoja ${clase}`, d: hojaPuntiaguda(x, y, grados, largo, ancho) });

// ---------- cuerpos, calcados de firmware/sprites/arte/<familia>_saludable*.txt ----------

/** Girasol: corona de 12 pétalos (r 10 a 17,5) y disco de radio 10 con la cara en el centro (24, 17); tallo y dos hojas. */
function girasol() {
  const petalos = Array.from({ length: 12 }, (_, i) =>
    svg("ellipse", { class: `masc-petalo${i % 2 ? " masc-petalo--b" : ""}`, cx: 24, cy: 3.4, rx: 3.1, ry: 4.6, transform: `rotate(${i * 30} 24 17)` }));
  const corona = svg("g", { class: "masc-corona" }, petalos);
  const cabeza = svg("g", { class: "masc-cabeza" }, corona,
    svg("circle", { class: "masc-disco", cx: 24, cy: 17, r: 10.2 }),
    svg("circle", { class: "masc-disco-borde", cx: 24, cy: 17, r: 8.8 }));
  const hojas = svg("g", { class: "masc-hojas" },
    hoja("hoja-b", 24, 40, -37, 20, 3.4),
    hoja("hoja-a", 24, 42, -151, 20.6, 3.6));
  return {
    planta: [svg("path", { class: "ilu-tallo", d: "M24 46V27", "stroke-width": 2.6, "stroke-linecap": "round" }), hojas, cabeza],
    refs: { corona, cabeza, hojas },
    geo: T.GEO_CHICA,
  };
}

/** Cactus: columna de 19 px (x 15 a 34) con cúpula en la fila 9, brazo izquierdo bajo y derecho alto, costillas. */
function cactus() {
  const izq = svg("g", { class: "masc-brazo" },
    svg("path", { class: "masc-cuerpo", d: "M15.5 34H9a4 4 0 0 1-4-4V19.5a3.5 3.5 0 0 1 7 0V27h3.5Z" }),
    svg("path", { class: "masc-costilla", d: "M8.5 19V31" }));
  const der = svg("g", { class: "masc-brazo" },
    svg("path", { class: "masc-cuerpo", d: "M33.5 31H39.5a4 4 0 0 0 4-4V14.8a3.75 3.75 0 0 0-7.5 0V24h-2.5Z" }),
    svg("path", { class: "masc-costilla", d: "M39.75 14V29" }));
  const columna = svg("g", { class: "masc-columna" },
    svg("path", { class: "masc-cuerpo", d: "M15 46V19a9.5 9.5 0 0 1 19 0V46Z" }),
    svg("path", { class: "masc-costilla", d: "M19.5 36V46M24.5 36V46M29.5 36V46" }));
  const flor = svg("g", { class: "masc-flor" });
  return { planta: [izq, der, columna], arriba: [flor], refs: { izq, der, columna, flor }, geo: T.GEO_CACTUS };
}

/** Suculenta: roseta (filas 16 a 45) de siete hojas carnosas y un corazón con la cara en (24, 36). */
function suculenta() {
  const sucu = (clase, grados, largo, ancho) => svg("path", { class: `masc-sucu ${clase}`, d: hojaPuntiaguda(24, 39, grados, largo, ancho) });
  const roseta = svg("g", { class: "masc-roseta" },
    sucu("masc-sucu--a", 180, 20, 2.6), sucu("masc-sucu--a", 0, 20, 2.6),
    sucu("masc-sucu--b", -155, 21, 2.4), sucu("masc-sucu--b", -25, 21, 2.4),
    sucu("masc-sucu--c", -125, 21, 2.2), sucu("masc-sucu--c", -55, 21, 2.2),
    sucu("masc-sucu--c", -90, 23, 2.4),
    svg("ellipse", { class: "masc-cuerpo masc-sucu--corazon", cx: 24, cy: 36.5, rx: 9.6, ry: 8.6 }));
  return { planta: [roseta], refs: { roseta }, geo: T.GEO_CHICA };
}

/** Una fronda: raquis curvo desde la base y folíolos que se achican hacia la punta. */
function fronda(grados, largo) {
  const n = 7;
  const hijos = [svg("path", { class: "masc-raquis", d: `M24 45Q25.6 ${(45 - largo * 0.55).toFixed(1)} 24 ${45 - largo}` })];
  for (let k = 1; k <= n; k++) {
    const y = 45 - (largo * (k + 0.4)) / (n + 1);
    const tam = 4.2 * (1 - k / (n + 2)) + 1;
    for (const lado of [-1, 1]) {
      const cx = (24 + lado * tam * 0.6).toFixed(2);
      hijos.push(svg("ellipse", { class: `ilu-hoja ${(k + (lado > 0 ? 1 : 0)) % 2 ? "hoja-a" : "hoja-b"}`, cx, cy: y.toFixed(2), rx: (tam * 0.62).toFixed(2), ry: 0.9, transform: `rotate(${-28 * lado} ${cx} ${y.toFixed(2)})` }));
    }
  }
  const mecible = svg("g", { class: "masc-fronda" }, hijos);
  return { nodo: svg("g", { transform: `rotate(${grados + 90} 24 45)` }, mecible), mecible, grados };
}

/** Helecho: cinco frondas en abanico (puntas en (0,24), (4,6), (23,1), (41,5), (47,25)); la cara va en la matera. */
function helecho() {
  const frondas = [[-139, 32], [-117, 44], [-90, 44], [-67, 43], [-41, 31]].map(([g, l]) => fronda(g, l));
  return { planta: frondas.map((f) => f.nodo), refs: { frondas }, caraEnMatera: true };
}

/** Carnívora: la cabeza de trampa del front (F36), llevada a las coordenadas del sprite (la matera de 120 a 32 px). */
function carnivora() {
  const cabeza = crearCabeza();
  const hojas = HOJAS_CARNIVORA.map(([d, ox, oy, clase]) => svg("path", { class: `ilu-hoja ${clase}`, d, "data-ox": ox, "data-oy": oy }));
  const desplazable = svg("g", { class: "masc-trampa" }, cabeza.grupo);
  const escala = svg("g", { transform: "matrix(0.26667 0 0 0.26667 -10.667 8.667)" },
    svg("path", { class: "ilu-tallo", d: "M130 150V98", "stroke-width": 7, "stroke-linecap": "round" }),
    ...hojas,
    desplazable);
  const ojos = [...cabeza.superior.querySelectorAll(".ilu-ojo, .ilu-pupila")];
  return { planta: [escala], refs: { cabeza, hojas, desplazable, ojos }, sinCara: true };
}

/** Genérica (respaldo): la planta común de la OLED, tres hojas grandes y una chica; la cara va en la matera. */
function generica() {
  const hojas = [
    [hoja("hoja-a", 22, 42, -126, 32, 4.4), 22, 42],
    [hoja("hoja-b", 26, 42, -61, 33, 4.4), 26, 42],
    [hoja("hoja-a", 24, 44, -92, 43, 5.2), 24, 44],
    [hoja("hoja-b", 27, 44, -33, 16, 2.6), 27, 44],
  ];
  return { planta: [svg("path", { class: "ilu-tallo", d: "M24 46V30", "stroke-width": 2, "stroke-linecap": "round" }), ...hojas.map(([h]) => h)], refs: { hojas }, caraEnMatera: true };
}

const DIBUJOS = { girasol, cactus, suculenta, helecho, carnivora, generica };

// ---------- la cara, repintada por cuadro ----------

function nodosDeCara(piezas) {
  const nodos = [];
  for (const o of piezas.ojos) {
    nodos.push(svg("rect", { class: "masc-ojo", x: o.x, y: o.y, width: o.ancho, height: o.alto, rx: o.radio }));
    if (o.brillo) nodos.push(svg("rect", { class: "masc-brillo", x: o.brillo.x, y: o.brillo.y, width: 1, height: 1 }));
  }
  for (const c of piezas.cejas) {
    const puntos = c.medio ? `${c.x1 + 0.5},${c.y1 + 0.5} ${c.medio.x + 0.5},${c.medio.y + 0.5} ${c.x2 + 0.5},${c.y2 + 0.5}` : `${c.x1 + 0.5},${c.y1 + 0.5} ${c.x2 + 0.5},${c.y2 + 0.5}`;
    nodos.push(svg("polyline", { class: "masc-ceja", points: puntos }));
  }
  if (piezas.boca.length) nodos.push(svg("polyline", { class: "masc-boca", points: piezas.boca.map((p) => `${p.x + 0.5},${p.y + 0.5}`).join(" ") }));
  if (piezas.lagrima) nodos.push(svg("rect", { class: "masc-lagrima", x: piezas.lagrima.x, y: piezas.lagrima.y, width: 1, height: piezas.lagrima.alto }));
  return nodos;
}

// Poses de en riesgo y crítico. La OLED tiene un sprite por estado; aquí se aproxima con transformaciones que
// llevan la cabeza al centro de cara del firmware (CARA_<FAMILIA>[nivel]). Ver F41: es lo que queda por calcar.
const CAIDA = [0, 10, 22];

function aplicarPose(familia, refs, nivel) {
  const pon = (nodo, t) => (t ? nodo.setAttribute("transform", t) : nodo.removeAttribute("transform"));
  if (familia === "girasol") {
    const p = T.CARA_GIRASOL[nivel];
    pon(refs.hojas, nivel ? `rotate(${CAIDA[nivel] / 2} 24 42)` : null);
    refs.poseCabeza = nivel ? `translate(${p.x - 24} ${p.y - 17}) rotate(${nivel * 25} 24 17)` : "";
  } else if (familia === "cactus") {
    const abajo = nivel ? "matrix(1 0 0 -0.7 0 52)" : null; // brazos colgando (espejo sobre la fila 30)
    pon(refs.izq, abajo);
    pon(refs.der, abajo);
    const baja = T.CARA_CACTUS[nivel].y - T.CARA_CACTUS[0].y;
    pon(refs.columna, baja ? `translate(0 ${baja})` : null);
  } else if (familia === "suculenta") {
    pon(refs.roseta, nivel ? `translate(0 ${46 * (1 - [1, 0.94, 0.86][nivel])}) scale(1 ${[1, 0.94, 0.86][nivel]})` : null);
  } else if (familia === "helecho") {
    refs.frondas.forEach((f) => (f.caida = Math.sign(f.grados + 90) * [0, 12, 30][nivel]));
  } else if (familia === "generica") {
    refs.hojas.forEach(([h, x, y], i) => pon(h, nivel ? `rotate(${(i === 0 || i === 2 ? -1 : 1) * CAIDA[nivel] * (i === 2 ? 0.3 : 1)} ${x} ${y})` : null));
  } else if (familia === "carnivora") {
    refs.hojas.forEach((h, i) => pon(h, nivel ? `rotate(${(i % 2 ? 1 : -1) * CAIDA[nivel]} ${h.dataset.ox} ${h.dataset.oy})` : null));
    pon(refs.cabeza.grupo, nivel ? `rotate(${CAIDA[nivel]} 130 100)` : null);
  }
}

/**
 * Crea la mascota de una familia. Devuelve { nodo, familia, ponerEstado(estado), pintar(ahora, { reposo }) }.
 * `pintar` dibuja el cuadro de `ahora` (ms) con las reglas del chip; `reposo` deja la pose quieta (sin balanceo,
 * sin parpadeo, la flor del cactus abierta), que es lo que se ve con movimiento reducido. `nodo` es decorativo
 * (aria-hidden): quien lo muestra pone el nombre de la especie en texto. Familia desconocida: la genérica.
 */
export function crearMascota(familia, { estado = "SALUDABLE", clase = "" } = {}) {
  const nombre = FAMILIAS.includes(familia) ? familia : "generica";
  const dibujo = DIBUJOS[nombre]();
  const refs = dibujo.refs;
  const planta = svg("g", { class: "masc-planta" }, dibujo.planta);
  const cara = svg("g", { class: "masc-cara" });
  const nodo = svg("svg", { class: `mascota mascota--${nombre}${clase ? ` ${clase}` : ""}`, viewBox: "0 0 48 64", "aria-hidden": "true", focusable: "false", "data-familia": nombre },
    planta,
    ...(dibujo.arriba || []),
    svg("rect", { class: "ilu-borde", x: 8, y: 46, width: 32, height: 4, rx: 1 }),
    svg("path", { class: "ilu-matera", d: "M11 51H37L34 64H14Z" }),
    cara,
  );

  // Estado del «chip»: nivel y desde cuándo, cara en transición, parpadeo y mordisco.
  let nivel = 0;
  let nivelDesde = 0;
  let caraDesde = T.CARA_NIVEL[0];
  let caraHasta = T.CARA_NIVEL[0];
  let caraT0 = -Infinity;
  let reloj = 0; // último `ahora` pintado
  let proximoParpadeo = null;
  let parpadeoDesde = -Infinity;
  let proximoMordisco = null;
  let mordiscoDesde = -Infinity;
  let firmaCara = "";
  let ultimaFlor = "";

  function ponerEstado(nuevo) {
    const n = T.nivelDe(nuevo);
    nodo.dataset.estado = nuevo || "SIN_DIAGNOSTICO";
    if (n === nivel && caraT0 !== -Infinity) return;
    caraDesde = caraT0 === -Infinity ? T.CARA_NIVEL[n] : T.caraEn(caraDesde, caraHasta, reloj - caraT0);
    caraHasta = T.CARA_NIVEL[n];
    caraT0 = reloj;
    nivel = n;
    nivelDesde = reloj;
    aplicarPose(nombre, refs, nivel);
  }

  function pintarFlor(ahora, reposo) {
    const f = reposo ? (nivel === 0 ? { boton: false, d: 3 } : null) : T.florCactus(ahora - nivelDesde, nivel);
    const firma = f ? `${f.boton}-${f.d}` : "";
    if (firma === ultimaFlor) return;
    ultimaFlor = firma;
    const y = T.CACTUS_Y_FLOR;
    if (!f) refs.flor.replaceChildren();
    else if (f.boton) refs.flor.replaceChildren(svg("rect", { class: "masc-flor-petalo", x: 23, y: y + 1, width: 3, height: 2, rx: 0.8 }));
    else {
      const d = f.d;
      const c = (x, yy) => svg("circle", { class: "masc-flor-petalo", cx: x + 0.5, cy: yy + 0.5, r: 1.5 });
      refs.flor.replaceChildren(c(24, y - d), c(24 - d, y - 1), c(24 + d, y - 1), c(24 - d + 1, y + d - 1), c(24 + d - 1, y + d - 1),
        svg("rect", { class: "masc-flor-centro", x: 23.5, y: y - 0.5, width: 2, height: 2, rx: 1 }));
    }
  }

  /** Pinta el cuadro de `ahora` (ms). */
  function pintar(ahora, { reposo = false } = {}) {
    reloj = ahora;
    if (caraT0 === -Infinity) caraT0 = ahora - T.TRANSICION_MS;
    const seno = reposo ? 0 : T.senoBalanceo(ahora);
    const amp = T.amplitud(nombre, nivel);
    planta.setAttribute("transform", T.matrizBalanceo(seno, amp));

    // parpadeo cada 3 a 5 s (150 ms)
    let parpadeo = 1;
    if (!reposo) {
      if (proximoParpadeo === null) proximoParpadeo = ahora + T.esperaDeParpadeo();
      if (ahora >= proximoParpadeo) { parpadeoDesde = ahora; proximoParpadeo = ahora + T.esperaDeParpadeo(); }
      parpadeo = T.factorParpadeo(ahora - parpadeoDesde);
    }
    const c = reposo ? caraHasta : T.caraEn(caraDesde, caraHasta, ahora - caraT0);
    let piezas = null;
    let dx = 0;
    let dy = 0;

    if (nombre === "girasol") {
      const p = T.CARA_GIRASOL[nivel];
      const pose = reposo ? { cuadro: 0, dy: 0, mira: 0 } : T.poseGirasol(ahora, nivel);
      refs.corona.setAttribute("transform", pose.cuadro ? "rotate(15 24 17)" : "");
      refs.cabeza.setAttribute("transform", `${refs.poseCabeza || ""} translate(0 ${pose.dy.toFixed(2)})`);
      dx = pose.mira + T.desv(p.y, seno, amp);
      dy = pose.dy;
      piezas = T.piezasDeCara(c, parpadeo, p.x, p.y, T.GEO_CHICA, { nivel, ahora });
    } else if (nombre === "cactus") {
      const p = T.CARA_CACTUS[nivel];
      dx = T.desv(p.y, seno, amp);
      piezas = T.piezasDeCara(c, parpadeo, p.x, p.y, T.GEO_CACTUS, { nivel, ahora });
      pintarFlor(ahora, reposo);
      refs.flor.setAttribute("transform", `translate(${T.desv(T.CACTUS_Y_FLOR, seno, amp).toFixed(2)} 0)`);
    } else if (nombre === "suculenta") {
      const p = T.CARA_SUCULENTA[nivel];
      const inflada = !reposo && T.suculentaInflada(ahora, nivel);
      // suculenta_saludable_1: la roseta crece de 40x30 a 44x32 px con la base quieta en la fila 45.
      if (nivel === 0) refs.roseta.setAttribute("transform", inflada ? "translate(-2.4 -3.15) scale(1.1 1.07)" : "");
      dx = T.desv(p.y, seno, amp);
      piezas = T.piezasDeCara(c, parpadeo, p.x, p.y, T.GEO_CHICA, { nivel, ahora });
    } else if (nombre === "helecho") {
      const cuadro = reposo ? 0 : T.cuadroHelecho(ahora, nivel);
      // Dos cuadros que alternan (HELECHO_MS): en el segundo cada fronda se corre hacia el lado contrario a su vecina.
      refs.frondas.forEach((f, i) => f.mecible.setAttribute("transform", `rotate(${((f.caida || 0) + (cuadro ? (i % 2 ? 5 : -5) : 0)).toFixed(1)} 24 45)`));
      piezas = T.piezasDeCaraMatera(c, parpadeo, { nivel, ahora });
    } else if (nombre === "generica") {
      piezas = T.piezasDeCaraMatera(c, parpadeo, { nivel, ahora });
    } else {
      // carnívora: saludable muerde sola cada 6 a 10 s; al cerrar entrecierra los ojos. Parpadea como todas.
      let boca = 0;
      let dyBoca = 0;
      if (!reposo && nivel === 0) {
        if (proximoMordisco === null) proximoMordisco = T.proximoMordisco(ahora);
        if (ahora >= proximoMordisco && ahora - mordiscoDesde >= T.MORDISCO_MS) { mordiscoDesde = ahora; proximoMordisco = T.proximoMordisco(ahora); }
        const paso = T.pasoMordisco(ahora - mordiscoDesde);
        if (paso) { boca = paso.boca; dyBoca = paso.dy; }
      }
      const abertura = [1, 0.5, 0][boca];
      refs.cabeza.superior.setAttribute("transform", `translate(0 ${ABIERTA_SUP * abertura})`);
      refs.cabeza.inferior.setAttribute("transform", `translate(0 ${ABIERTA_INF * abertura})`);
      refs.desplazable.setAttribute("transform", `translate(0 ${(dyBoca / 0.26667).toFixed(2)})`);
      const ojo = c.abierto * parpadeo * (boca === 2 ? 0.3 : 1);
      const f = Math.max(0.15, ojo).toFixed(2);
      for (const o of refs.ojos) o.setAttribute("transform", `translate(0 ${o.getAttribute("cy")}) scale(1 ${f}) translate(0 ${-o.getAttribute("cy")})`);
    }

    cara.setAttribute("transform", dx || dy ? `translate(${dx.toFixed(2)} ${dy.toFixed(2)})` : "");
    if (piezas) {
      const firma = JSON.stringify(piezas);
      if (firma !== firmaCara) {
        firmaCara = firma;
        cara.replaceChildren(...nodosDeCara(piezas));
      }
    }
  }

  ponerEstado(estado);
  pintar(0, { reposo: true });
  return { nodo, familia: nombre, ponerEstado, pintar };
}
