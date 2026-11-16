// Mascotas por familia de especie (F41): el MISMO personaje que la matera pinta en su OLED (fase 7 del firmware,
// D110 a D117), en vector plano con los tokens del front. Familias: girasol, cactus, suculenta, helecho, carnívora
// y genérica (respaldo). El SVG usa el sistema de coordenadas del sprite de la OLED (48x64, borde de la matera en
// la fila 46), así cada número de `mascota-tiempo.js` (centro de la cara, amplitud del balanceo, flor del cactus)
// se aplica tal cual. El cuerpo se dibuja una vez; la CARA va aparte (`.masc-cara`) y se repinta por cuadro con
// las piezas que calcula `piezasDeCara`, como `caraGrande` en el chip: ojos, cejas, boca y lágrima por estado.
// Se construye con createElementNS (`svg()`); los colores salen de clases del CSS, nunca de estilos en línea.
import { svg } from "../ui.js";
import { FAMILIAS } from "./especie.js";
import * as T from "./mascota-tiempo.js";
import * as P from "./mascota-poses.js";

// ---------- cuerpos, calcados de firmware/sprites/dibujar.py (mascota-poses.js trae los números) ----------
// Cada familia devuelve `cuerpos[nivel][cuadro]`: un <g> por pose de la OLED (un sprite por estado y, donde lo
// hay, su segundo cuadro de idle). Se dibujan todos y se muestra solo el vigente (atributo `display`, sin estilos
// en línea). dibujar.py pone sus trazos, elipses y polígonos en centros de píxel: eso va dentro de `centrado()`,
// corrido medio píxel; los rectángulos y píxeles sueltos (brazos del cactus, espinas, decoración) van en bordes.

const cuerpo = (...hijos) => svg("g", { class: "masc-cuerpo-pose", display: "none" }, ...hijos);
const centrado = (...hijos) => svg("g", { transform: `translate(${P.CORRIMIENTO} ${P.CORRIMIENTO})` }, ...hijos);
const trazo = (clase, d) => svg("path", { class: clase, d });
const tallo = (puntos, grosor) => svg("path", { class: "ilu-tallo", d: P.talloD(...puntos), fill: "none", "stroke-width": grosor, "stroke-linecap": "round" });

/** Hoja con su vena (los nervios de las hojas grandes del sprite). `clase` es hoja-a o hoja-b. */
function hojaDe(clase, h) {
  const l = P.lente(h.base, h.tip, h.ancho, { curva: h.curva || 0, vena: h.vena !== false });
  return [trazo(`ilu-hoja ${clase}`, l.d), l.vena ? trazo("masc-vena", l.vena) : null];
}
const hojasDe = (lista) => lista.map((h, i) => hojaDe(i % 2 ? "hoja-b" : "hoja-a", h));
const sueloDe = (s) => (s ? hojaDe("hoja-b", { ...s, vena: false }) : null);

/** Girasol: tallo, dos hojas, corona de pétalos y disco con la cara en el centro (CARA_GIRASOL). */
function girasol() {
  let corona0 = null;
  const pose = (p) => {
    const petalos = P.petalosDe(p.corona).map((e) =>
      svg("ellipse", { class: `masc-petalo${e.i % 2 ? " masc-petalo--b" : ""}`, cx: e.cx, cy: e.cy, rx: e.rx, ry: e.ry, transform: `rotate(${e.giro} ${e.cx} ${e.cy})` }));
    const corona = svg("g", { class: "masc-corona" }, petalos);
    const { cx, cy, r } = p.disco;
    return { corona, g: cuerpo(centrado(tallo(p.tallo, 3), hojasDe(p.hojas), sueloDe(p.suelo), corona,
      svg("circle", { class: "masc-disco", cx, cy, r: r + 0.5 }),
      svg("circle", { class: "masc-disco-borde", cx, cy, r: r - 1.2 }))) };
  };
  const cuerpos = P.GIRASOL.map((p, nivel) => {
    const { corona, g } = pose(p);
    if (nivel === 0) corona0 = corona;
    return [g];
  });
  // F49: dormido (saludable de noche) tiene su propio sprite en la OLED, `girasol_dormido`.
  return { cuerpos, dormido: pose(P.GIRASOL_DORMIDO).g, refs: { corona: corona0 }, geo: T.GEO_CHICA };
}

/** Cactus: columna de 19 px con cúpula, dos brazos (dos rectángulos redondeados cada uno), costillas y espinas de 1 px. */
function cactus() {
  const rect = ([x0, y0, x1, y1], rx) => svg("rect", { class: "masc-cuerpo", x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1, rx });
  const cuerpos = P.CACTUS.map((p) => {
    const costillas = [];
    const brazos = p.brazos.map(([vertical, horizontal]) => {
      const x = Math.floor((vertical[0] + vertical[2]) / 2);
      costillas.push(`M${x} ${vertical[1] + 3}V${vertical[3] - 3}`);
      return [rect(vertical, 3), rect(horizontal, 3)];
    });
    for (const x of [19, 24, 29]) costillas.push(`M${x} ${p.costillaDesde}V46`);
    const espinas = [];
    for (let y = p.cima + 6; y < 46; y += 5) espinas.push([14, y], [34, y + 2]);
    for (const [vertical] of p.brazos) for (let y = vertical[1] + 3; y < vertical[3] - 2; y += 5) espinas.push([vertical[0] - 1, y], [vertical[2] + 1, y + 2]);
    const caida = p.espinaCaida ? svg("path", { class: "masc-costilla", d: `M${p.espinaCaida[0][0]} ${p.espinaCaida[0][1]}L${p.espinaCaida[1][0]} ${p.espinaCaida[1][1]}` }) : null;
    return [cuerpo(brazos, svg("rect", { class: "masc-cuerpo", x: 15, y: p.cima, width: 19, height: 48 - p.cima, rx: 9 }),
      trazo("masc-cuerpo", P.pixelesD(espinas)), centrado(trazo("masc-costilla", costillas.join("")), caida))];
  });
  return { cuerpos, refs: { flor: svg("g", { class: "masc-flor" }) }, geo: T.GEO_CACTUS, arriba: true };
}

/** Suculenta: roseta de hojas gruesas (las de atrás y las del medio) alrededor del corazón liso con la cara. Saludable tiene un segundo cuadro inflado. */
function suculenta() {
  const cuerpos = P.SUCULENTA.map((p, nivel) => (nivel === 0 ? [false, true] : [false]).map((inflada) => {
    const { hojas, centro, cx, cy } = P.hojasDeSuculenta(nivel, inflada);
    return cuerpo(centrado(
      hojas.map((h) => trazo(`masc-sucu masc-sucu--${h.capa === "a" ? "a" : "b"}`, h.d)),
      p.suelo ? trazo("masc-sucu masc-sucu--b", P.lente(p.suelo.base, p.suelo.tip, p.suelo.ancho, { perfil: 0.7, vena: false }).d) : null,
      svg("circle", { class: "masc-sucu masc-sucu--corazon", cx, cy, r: centro + 0.5 })));
  }));
  return { cuerpos, refs: {}, geo: T.GEO_CHICA };
}

/** Helecho: cinco frondas de pluma (cuatro en crítico), en sus dos cuadros por estado; la cara va en la matera. */
function helecho() {
  const cuerpos = [0, 1, 2].map((nivel) => [0, 1].map((c) => {
    const p = P.helecho(nivel, c);
    const frondas = p.frondas.map(([p0, p1, p2, largo]) => P.frondaD(p0, p1, p2, largo, p.abre, p.decae, { paso: p.paso }));
    return cuerpo(centrado(trazo("masc-raquis", frondas.map((f) => f.raquis).join("")), trazo("masc-foliolos", frondas.map((f) => f.foliolos).join("")), sueloDe(p.suelo)));
  }));
  return { cuerpos, refs: {}, caraEnMatera: true };
}

/** Genérica (respaldo): la planta común de la OLED, tallo y hojas por estado; la cara va en la matera. */
function generica() {
  const cuerpos = P.GENERICA.map((p) => [cuerpo(centrado(tallo(p.tallo, 3), hojasDe(p.hojas)))]);
  return { cuerpos, refs: {}, caraEnMatera: true };
}

/**
 * Carnívora. Saludable: la trampa de `trampa()` en dibujar.py (elipse de 45 px, boca en lente con dientes y, cerrada, el
 * zigzag de los dientes entrelazados) en sus tres cuadros de boca (abierta, media, cerrada: carni_abierta_0, carni_media,
 * carni_cerrada); los ojos los pinta el código, como en la OLED. En riesgo y crítico: la cabeza cerrada y lisa
 * (carni_riesgo_0, carni_critico_0) sobre su tallo, con la cara triste que dibuja el código (boca, cejas, lágrima).
 */
function carnivora() {
  const abiertas = P.CARNIVORA_BOCA_G.map((g) => {
    const t = P.cabezaDeTrampa(g);
    return cuerpo(centrado(
      tallo([[24, 47], [24, 42], [24, t.inf - 2]], 5),
      hojasDe(P.CARNIVORA_HOJAS_SALUDABLE),
      svg("ellipse", { class: "ilu-cabeza masc-trampa-cerrada", cx: t.cabeza.cx, cy: t.cabeza.cy, rx: t.cabeza.rx, ry: t.cabeza.ry }),
      t.lente ? svg("ellipse", { class: "ilu-boca-interior", cx: t.lente.cx, cy: t.lente.cy, rx: t.lente.rx, ry: t.lente.ry }) : null,
      t.dientes ? trazo("ilu-diente", t.dientes) : null,
      t.zigzag ? trazo("masc-costilla", t.zigzag) : null));
  });
  const tristes = P.CARNIVORA_TRISTE.map((p) => cuerpo(centrado(
    tallo([[24, 47], [24 - p.desv, 42], [24, p.cy + 9 - 2]], 5),
    hojasDe(P.CARNIVORA_HOJAS),
    svg("ellipse", { class: "ilu-cabeza masc-trampa-cerrada", cx: 24, cy: p.cy - 2, rx: 22.5, ry: 11.5 }))));
  return { cuerpos: [abiertas, [tristes[0]], [tristes[1]]], refs: {}, geo: T.GEO_TRAMPA };
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

/**
 * Crea la mascota de una familia. Devuelve { nodo, familia, ponerEstado(estado), ponerPeriodo(periodo),
 * pintar(ahora, { reposo }), saludar(), morder() }. `pintar` dibuja el cuadro de `ahora` (ms) con las reglas del chip; `reposo` deja la pose quieta (sin
 * balanceo, sin parpadeo, la flor del cactus abierta), que es lo que se ve con movimiento reducido. `nodo` es
 * decorativo (aria-hidden): quien lo muestra pone el nombre de la especie en texto. Familia desconocida: la genérica.
 *
 * `saludar()` es el toque (F44): un salto y un parpadeo doble de `T.SALUDO.DURACION_MS`, con cara de contenta; con
 * `{ reducido: true }` (movimiento reducido) la pose queda quieta y solo cambia la expresión.
 * `morder()` es el mordisco de la OLED cuando llega una lectura (solo carnívora saludable, como `mordisco()`).
 */
export function crearMascota(familia, { estado = "SALUDABLE", periodo = "DIA", clase = "" } = {}) {
  const nombre = FAMILIAS.includes(familia) ? familia : "generica";
  const dibujo = DIBUJOS[nombre]();
  const refs = dibujo.refs;
  const planta = svg("g", { class: "masc-planta" }, dibujo.cuerpos.flat(), dibujo.dormido || null);
  const cara = svg("g", { class: "masc-cara" });
  const zzz = svg("g", { class: "masc-zzz" }); // F49: el "zzz" de la planta dormida (no respira ni se balancea)
  const gota = trazo("masc-gota", ""); // F54: la gota que cae sobre la suculenta regada (icono_gota de la OLED)
  const nodo = svg("svg", { class: `mascota mascota--${nombre}${clase ? ` ${clase}` : ""}`, viewBox: "0 0 48 64", "aria-hidden": "true", focusable: "false", "data-familia": nombre },
    planta,
    ...(dibujo.arriba ? [refs.flor] : []),
    svg("rect", { class: "ilu-borde", x: 8, y: 46, width: 32, height: 4, rx: 1 }),
    svg("path", { class: "ilu-matera", d: "M11 51H37L34 64H14Z" }),
    trazo("masc-deco", P.pixelesD(P.decoracionDeMatera(nombre))), // los píxeles apagados del borde y la banda de la matera
    cara,
    zzz,
    gota,
  );

  // Estado del «chip»: nivel y desde cuándo, cara en transición, parpadeo, mordisco y saludo.
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
  let saludoDesde = -Infinity;
  let saludoQuieto = false;
  let temporizadorSaludo = null;
  let firmaCara = "";
  let ultimaFlor = "";
  let vigente = null; // el <g> que se ve
  let ultimasPiezas = null; // las de la cara del último cuadro (para las herramientas de comparación)
  let noche = false; // F49: el diagnóstico dijo periodo NOCHE
  let ultimoZzz = -1;
  let regadoDesde = -Infinity; // F54: evento REGADA (la suculenta infla y sonríe; las demás, parpadeo doble)
  let dobleDesde = -Infinity;
  let ultimaGota = "";

  /** Muestra la pose (nivel, cuadro) y esconde las demás. `g` fuerza un cuerpo (el girasol dormido). */
  function mostrar(cuadro, g = dibujo.cuerpos[nivel][Math.min(cuadro, dibujo.cuerpos[nivel].length - 1)]) {
    if (g === vigente) return;
    if (vigente) vigente.setAttribute("display", "none");
    g.removeAttribute("display");
    vigente = g;
  }

  function ponerEstado(nuevo) {
    const n = T.nivelDe(nuevo);
    nodo.dataset.estado = nuevo || "SIN_DIAGNOSTICO";
    if (n === nivel && caraT0 !== -Infinity) return;
    caraDesde = caraT0 === -Infinity ? T.CARA_NIVEL[n] : T.caraEn(caraDesde, caraHasta, reloj - caraT0);
    caraHasta = T.CARA_NIVEL[n];
    caraT0 = reloj;
    nivel = n;
    nivelDesde = reloj;
    mostrar(0);
  }

  /** F49: de noche o de día. Solo cambia lo que se pinta en el próximo cuadro; la cara no salta. */
  function ponerPeriodo(periodo) {
    noche = T.esNoche(periodo);
    nodo.dataset.periodo = noche ? "NOCHE" : "DIA";
  }

  /** El "zzz": `cuadro` + 1 zetas (0 a 2); -1 las quita. */
  function pintarZzz(cuadro) {
    if (cuadro === ultimoZzz) return;
    ultimoZzz = cuadro;
    zzz.replaceChildren(...T.NOCHE.ZZZ.slice(0, cuadro + 1).map((z) => trazo("masc-zeta", T.zetaD(z))));
  }

  function pintarFlor(ahora, reposo, duerme = false) {
    const f = duerme ? null : reposo ? (nivel === 0 ? { boton: false, d: 3 } : null) : T.florCactus(ahora - nivelDesde, nivel);
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

  /**
   * Pinta el cuadro de `ahora` (ms). Con `reposo` la pose queda quieta; en ese caso `cuadro` elige el cuadro de idle que
   * se deja fijo (girasol: corona girada, suculenta: inflada, helecho: segundo cuadro de frondas, carnívora: 0 boca
   * abierta, 1 media, 2 cerrada). Sirve a la herramienta de comparación con los sprites y a las pruebas.
   */
  function pintar(ahora, { reposo = false, cuadro = 0 } = {}) {
    reloj = ahora;
    if (caraT0 === -Infinity) caraT0 = ahora - T.TRANSICION_MS;
    const senoReloj = reposo ? 0 : T.senoBalanceo(ahora);
    const amp = T.amplitud(nombre, nivel);

    // saludo (el toque): salto y parpadeo doble con la cara contenta; con reposo solo la expresión
    const saludo = reposo ? null : T.pasoSaludo(ahora - saludoDesde);
    const contenta = saludo || saludoQuieto;
    // F49: de noche duerme (el saludo la despierta un momento): ojos cerrados, quieta, respira y flota el "zzz".
    const duerme = noche && !contenta;
    const seno = duerme ? 0 : senoReloj;
    // `nivel` para la lágrima: dormida no llora (el resto de la cara sí sigue al estado)
    const nivelCara = duerme ? 0 : nivel;

    // parpadeo cada 3 a 5 s (150 ms); en el saludo manda el parpadeo doble; dormida, los ojos cerrados
    let parpadeo = duerme ? 0 : 1;
    if (!reposo) {
      if (proximoParpadeo === null) proximoParpadeo = ahora + T.esperaDeParpadeo();
      if (ahora >= proximoParpadeo) { parpadeoDesde = ahora; proximoParpadeo = ahora + T.esperaDeParpadeo(); }
      if (!duerme) parpadeo = saludo ? saludo.ojos : T.factorParpadeo(ahora - parpadeoDesde);
      const doble = saludo ? null : T.ojosDeParpadeoDoble(ahora - dobleDesde);
      if (doble !== null) parpadeo = doble; // F54: el parpadeo doble del riego (también despierta un momento)
    }
    let c = contenta ? T.SALUDO.CARA : reposo ? caraHasta : T.caraEn(caraDesde, caraHasta, ahora - caraT0);
    let piezas = null;
    let dx = 0;
    // el cuerpo entero (todo lo que está sobre la matera) sube y baja: el salto del saludo o la respiración dormida
    let dy = saludo ? saludo.dy : duerme && !reposo ? T.respiraDy(ahora) : 0;
    let caraDy = dy;

    if (nombre === "girasol") {
      const dormido = duerme && nivel === 0;
      const p = dormido ? T.NOCHE.CARA_GIRASOL : T.CARA_GIRASOL[nivel];
      const pose = reposo || duerme ? { cuadro: 0, dy: 0, mira: 0 } : T.poseGirasol(ahora, nivel);
      if (nivel === 0) refs.corona.setAttribute("transform", (reposo ? cuadro : pose.cuadro) && !duerme ? "rotate(15 24 17)" : "");
      if (nivel === 0) mostrar(0, dormido ? dibujo.dormido : undefined);
      if (!saludo && !duerme) { dy = pose.dy; caraDy = dy; }
      dx = pose.mira + T.desv(p.y, seno, amp);
      piezas = T.piezasDeCara(c, parpadeo, p.x, p.y, T.GEO_CHICA, { nivel: nivelCara, ahora });
    } else if (nombre === "cactus") {
      const p = T.CARA_CACTUS[nivel];
      dx = T.desv(p.y, seno, amp);
      piezas = T.piezasDeCara(c, parpadeo, p.x, p.y, T.GEO_CACTUS, { nivel: nivelCara, ahora });
      pintarFlor(ahora, reposo, duerme); // de noche la flor se cierra
      refs.flor.setAttribute("transform", `translate(${T.desv(T.CACTUS_Y_FLOR, seno, amp).toFixed(2)} ${dy})`);
    } else if (nombre === "suculenta") {
      const p = T.CARA_SUCULENTA[nivel];
      // F54: regada (pintarSuculenta del firmware): cae la gota, después se infla (o da un saltito) y sonríe
      const riego = reposo ? null : T.pasoRiego(ahora - regadoDesde, nivel, p.y);
      if (riego && riego.sonrie && !contenta) c = T.caraRegada(c);
      if (riego) { dy += riego.dy; caraDy = dy; }
      gotaEn(riego ? riego.gotaY : null);
      mostrar(riego && riego.inflada ? 1 : duerme ? 0 : reposo ? cuadro : T.suculentaInflada(ahora, nivel) ? 1 : 0);
      dx = T.desv(p.y, seno, amp);
      piezas = T.piezasDeCara(c, parpadeo, p.x, p.y, T.GEO_CHICA, { nivel: nivelCara, ahora });
    } else if (nombre === "helecho") {
      mostrar(duerme ? 0 : reposo ? cuadro : T.cuadroHelecho(ahora, nivel));
      piezas = T.piezasDeCaraMatera(c, parpadeo, { nivel: nivelCara, ahora });
      caraDy = 0; // la cara va en la matera: no sube con el salto
    } else if (nombre === "generica") {
      piezas = T.piezasDeCaraMatera(c, parpadeo, { nivel: nivelCara, ahora });
      caraDy = 0;
    } else {
      // carnívora: saludable muerde sola cada 6 a 10 s; el cuadro de boca decide dónde van los ojos (fila 9, 12 o 16).
      // En riesgo y crítico la cabeza va cerrada y lisa (la cara triste con boca la pone el código).
      let boca = duerme && nivel === 0 ? 2 : reposo && nivel === 0 ? cuadro : 0; // dormida: la trampa cerrada
      let dyBoca = 0;
      if (!reposo && !duerme && nivel === 0) {
        if (proximoMordisco === null) proximoMordisco = T.proximoMordisco(ahora);
        if (ahora >= proximoMordisco && ahora - mordiscoDesde >= T.MORDISCO_MS) { mordiscoDesde = ahora; proximoMordisco = T.proximoMordisco(ahora); }
        const paso = T.pasoMordisco(ahora - mordiscoDesde);
        if (paso) { boca = paso.boca; dyBoca = paso.dy; }
      }
      mostrar(boca); // el cuadro de boca es el cuerpo: abierta, media o cerrada
      dy += dyBoca;
      caraDy = dy;
      const yo = nivel === 0 ? T.CARNIVORA_OJOS_Y[boca] : P.CARNIVORA_TRISTE[nivel - 1].cara;
      const cm = boca === 2 ? { ...c, abierto: c.abierto * 0.3 } : c;
      dx = T.desv(yo, seno, amp);
      piezas = T.piezasDeCara(cm, parpadeo, 24, yo, T.GEO_TRAMPA, { conBoca: nivel > 0, nivel: nivelCara, ahora });
    }
    pintarZzz(duerme ? (reposo ? 2 : T.cuadroZzz(ahora)) : -1);

    ultimasPiezas = piezas;
    planta.setAttribute("transform", `${dy ? `translate(0 ${dy}) ` : ""}${T.matrizBalanceo(seno, amp)}`);
    cara.setAttribute("transform", dx || caraDy ? `translate(${dx.toFixed(2)} ${caraDy})` : "");
    if (piezas) {
      const firma = JSON.stringify(piezas);
      if (firma !== firmaCara) {
        firmaCara = firma;
        cara.replaceChildren(...nodosDeCara(piezas));
      }
    }
  }

  /** F54: la gota de la suculenta regada con su esquina en (X_GOTA, y); null la quita. No se balancea. */
  function gotaEn(y) {
    const d = y === null ? "" : P.pixelesD(T.pixelesDeGota(T.RIEGO.X_GOTA, y));
    if (d === ultimaGota) return;
    ultimaGota = d;
    gota.setAttribute("d", d);
  }

  /**
   * F54: la regaron (evento REGADA). La suculenta hace lo de la OLED (gota, se infla, sonríe); las demás familias, que
   * en la OLED no reaccionan al riego, un parpadeo doble. Con `reducido` no hay movimiento: solo la suculenta sonríe
   * un momento, como el saludo quieto.
   */
  function regar({ reducido = false } = {}) {
    if (reducido) {
      if (nombre === "suculenta") saludar({ reducido: true });
      return;
    }
    if (nombre === "suculenta") regadoDesde = reloj;
    else dobleDesde = reloj;
  }

  /** El toque: la mascota saluda. Sin `reducido` es el salto con parpadeo doble; con `reducido`, solo la expresión. */
  function saludar({ reducido = false } = {}) {
    if (reducido) {
      saludoQuieto = true;
      pintar(reloj, { reposo: true });
      clearTimeout(temporizadorSaludo);
      temporizadorSaludo = setTimeout(() => {
        saludoQuieto = false;
        pintar(reloj, { reposo: true });
      }, T.SALUDO.REDUCIDO_MS);
      return;
    }
    saludoDesde = reloj;
  }

  /** Mordisco por lectura nueva (`mordisco()` del firmware): solo la carnívora saludable, y despierta. */
  function morder() {
    if (nombre !== "carnivora" || nivel > 0 || noche) return;
    mordiscoDesde = reloj;
    proximoMordisco = T.proximoMordisco(reloj);
  }

  ponerEstado(estado);
  ponerPeriodo(periodo);
  pintar(0, { reposo: true });
  return { nodo, familia: nombre, ponerEstado, ponerPeriodo, pintar, saludar, morder, regar, piezas: () => ultimasPiezas };
}
