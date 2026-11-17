// La mascota se arma y se pinta con un DOM mínimo (sin navegador): qué pose se ve por estado, el saludo del toque,
// el mordisco, el cambio de dibujo por familia y lo que pasa con movimiento reducido.
import { test } from "node:test";
import assert from "node:assert/strict";
import { instalarDom, serializar } from "./dom-minimo.mjs";

instalarDom();
const { crearMascota } = await import("../js/componentes/mascota.js");
const { FAMILIAS, familiaDe, cambiaElDibujo } = await import("../js/componentes/especie.js");
const T = await import("../js/componentes/mascota-tiempo.js");

const ESTADOS = ["SALUDABLE", "EN_RIESGO", "CRITICO"];
const cuerpos = (m) => m.nodo.buscar((e) => e.atributos.get("class") === "masc-cuerpo-pose");
const visibles = (m) => cuerpos(m).filter((e) => !e.hasAttribute("display"));
const cara = (m) => m.nodo.buscar((e) => e.atributos.get("class") === "masc-cara")[0];
const planta = (m) => m.nodo.buscar((e) => e.atributos.get("class") === "masc-planta")[0];
const clases = (m, c) => cara(m).buscar((e) => e.atributos.get("class") === c);

test("las seis familias se arman en los tres estados, con una sola pose a la vista", () => {
  for (const familia of FAMILIAS) {
    for (const estado of ESTADOS) {
      const m = crearMascota(familia, { estado });
      for (const t of [0, 50, 400, 1000, 3000, 5000, 9000]) m.pintar(t);
      assert.equal(m.familia, familia);
      assert.equal(m.nodo.getAttribute("data-estado"), estado);
      assert.equal(visibles(m).length, 1, `${familia} ${estado}`);
      assert.equal(m.nodo.getAttribute("aria-hidden"), "true", "el dibujo es decorativo");
    }
  }
});

test("una familia desconocida se dibuja como la genérica", () => {
  assert.equal(crearMascota("rosa").familia, "generica");
  assert.equal(crearMascota(undefined).familia, "generica");
});

test("cada estado muestra una pose distinta del mismo personaje (en riesgo y crítico ya no son aproximaciones)", () => {
  for (const familia of FAMILIAS) {
    const m = crearMascota(familia, { estado: "SALUDABLE" });
    const firmas = new Set();
    for (const estado of ESTADOS) {
      m.ponerEstado(estado);
      m.pintar(0, { reposo: true });
      assert.equal(visibles(m).length, 1);
      firmas.add(serializar(visibles(m)[0]));
    }
    assert.equal(firmas.size, 3, `${familia}: tres poses distintas`);
  }
});

test("cuántas poses tiene cada familia: los sprites de la OLED (cuadros de idle incluidos)", () => {
  // girasol 4 (los tres estados y el dormido de F49), cactus 3, genérica 3; suculenta 4 (saludable inflada);
  // helecho 6 (dos cuadros por estado); carnívora 5 (tres bocas saludable + riesgo + crítico)
  const esperadas = { girasol: 4, cactus: 3, suculenta: 4, helecho: 6, carnivora: 5, generica: 3 };
  for (const [familia, n] of Object.entries(esperadas)) assert.equal(cuerpos(crearMascota(familia)).length, n, familia);
});

test("el detalle cambia de dibujo cuando cambia la familia de la especie, y solo entonces", () => {
  const dibujo = (especie) => serializar(crearMascota(familiaDe(especie)).nodo);
  assert.notEqual(dibujo("girasol"), dibujo("cactus"));
  assert.notEqual(dibujo("atrapamoscas"), dibujo("Girasol"));
  assert.equal(dibujo("Girasol enano"), dibujo("girasol"), "mismo personaje, el nombre no cambia el dibujo");
  assert.equal(dibujo("rosa"), dibujo("orquidea"), "dos desconocidas: la misma genérica");
  assert.equal(cambiaElDibujo("girasol", "cactus"), dibujo("girasol") !== dibujo("cactus"));
  assert.equal(cambiaElDibujo("rosa", "orquidea"), dibujo("rosa") !== dibujo("orquidea"));
});

test("cara por estado: ojos, cejas y boca de la OLED; la lágrima solo en crítico", () => {
  const m = crearMascota("girasol", { estado: "SALUDABLE" });
  m.pintar(0, { reposo: true });
  assert.equal(clases(m, "masc-ojo").length, 2);
  assert.equal(clases(m, "masc-ceja").length, 0, "contenta: sin cejas");
  assert.equal(clases(m, "masc-lagrima").length, 0);
  m.ponerEstado("CRITICO");
  m.pintar(0, { reposo: true });
  assert.equal(clases(m, "masc-ceja").length, 2, "las cejas preocupadas");
  assert.equal(clases(m, "masc-lagrima").length, 1, "lágrima a 0 ms del ciclo de 4,2 s");
  m.pintar(2000);
  m.pintar(2000);
  assert.equal(clases(m, "masc-lagrima").length, 0, "fuera de los primeros 900 ms del ciclo no hay lágrima");
});

test("la carnívora saludable parpadea y muerde: la boca es el cuerpo y los ojos bajan", () => {
  const m = crearMascota("carnivora");
  m.pintar(0, { reposo: true, cuadro: 0 });
  const abierta = visibles(m)[0];
  const ojosY = () => Number(clases(m, "masc-ojo")[0].getAttribute("y"));
  const y0 = ojosY();
  m.pintar(0, { reposo: true, cuadro: 2 });
  assert.notEqual(visibles(m)[0], abierta, "boca cerrada: otro cuerpo");
  assert.ok(ojosY() > y0, "con la boca cerrada los ojos van más abajo (fila 16 en vez de 9)");
  // un mordisco por lectura nueva (`morder`): abierta, media, cerrada (+2), media (+1), abierta (-1)
  const b = crearMascota("carnivora");
  b.pintar(1000);
  b.morder();
  const bocas = [];
  for (const t of [1000, 1100, 1200, 1300, 1400, 1500]) {
    b.pintar(t);
    bocas.push(cuerpos(b).indexOf(visibles(b)[0]));
  }
  assert.deepEqual(bocas, [0, 1, 2, 1, 0, 0]);
});

test("solo la carnívora saludable muerde: en riesgo, `morder` no cambia nada", () => {
  const m = crearMascota("carnivora", { estado: "EN_RIESGO" });
  m.pintar(1000);
  m.morder();
  m.pintar(1200);
  assert.equal(cuerpos(m).indexOf(visibles(m)[0]), 3, "la cabeza triste, cerrada");
  const g = crearMascota("girasol");
  g.pintar(1000);
  g.morder();
  g.pintar(1200);
  assert.equal(visibles(g).length, 1);
});

test("SALUDO: el cuerpo entero sube 5 px y baja, parpadea dos veces y sonríe, en 600 ms", () => {
  const m = crearMascota("cactus", { estado: "CRITICO" });
  m.pintar(1000);
  const dy = () => (planta(m).getAttribute("transform").match(/^translate\(0 (-?\d+)\)/) || [, "0"])[1];
  assert.equal(dy(), "0");
  m.saludar();
  const pasos = [];
  for (let t = 1000; t < 1650; t += 50) {
    m.pintar(t);
    pasos.push(Number(dy()));
  }
  assert.deepEqual(pasos.slice(0, 12), [...T.SALUDO.DY]);
  assert.equal(pasos[12], 0, "a los 600 ms terminó");
  // durante el saludo la cara es la contenta, aunque la planta esté crítica: sin cejas, boca de sonrisa
  m.saludar();
  m.pintar(1700);
  assert.equal(clases(m, "masc-ceja").length, 0, "sin cejas durante el saludo");
  m.pintar(1700 + 700);
  assert.equal(clases(m, "masc-ceja").length, 2, "pasado el saludo vuelve la cara de crítico");
});

test("SALUDO: el parpadeo doble cierra los ojos en los cuadros 3 y 7", () => {
  const m = crearMascota("girasol");
  m.pintar(0);
  m.saludar();
  const altos = [];
  for (let k = 0; k < 12; k++) {
    m.pintar(k * 50);
    altos.push(Number(clases(m, "masc-ojo")[0].getAttribute("height")));
  }
  const cerrado = altos.reduce((a, h, i) => (h <= 1 ? [...a, i] : a), []);
  assert.deepEqual(cerrado, [3, 7]);
});

test("el saludo de la genérica y el helecho NO mueve su cara: va en la matera", () => {
  for (const familia of ["generica", "helecho"]) {
    const m = crearMascota(familia);
    m.pintar(0);
    m.saludar();
    m.pintar(150);
    assert.equal(cara(m).getAttribute("transform"), "", familia);
    assert.match(planta(m).getAttribute("transform"), /^translate\(0 -5\)/, "pero el cuerpo sí sube");
  }
});

test("movimiento reducido: quieta, y el saludo es solo un cambio de expresión que se deshace", async () => {
  const m = crearMascota("suculenta", { estado: "EN_RIESGO" });
  m.pintar(0, { reposo: true });
  const antes = serializar(m.nodo);
  assert.equal(clases(m, "masc-ceja").length, 2);
  m.saludar({ reducido: true });
  assert.equal(clases(m, "masc-ceja").length, 0, "cambia la expresión");
  assert.equal(planta(m).getAttribute("transform"), "matrix(1 0 0.00000 1 0.0000 0)", "sin salto");
  assert.equal(visibles(m).length, 1);
  await new Promise((r) => setTimeout(r, T.SALUDO.REDUCIDO_MS + 100));
  assert.equal(serializar(m.nodo), antes, "vuelve a su pose");
});

// F54: REGADA. La suculenta hace lo de `pintarSuculenta` del firmware; las demás, un parpadeo doble.
const gotaD = (m) => m.nodo.buscar((e) => e.atributos.get("class") === "masc-gota")[0].getAttribute("d") || "";

test("RIEGO: a la suculenta le cae la gota (500 ms), se infla y sonríe hasta los 1600 ms", () => {
  const m = crearMascota("suculenta", { estado: "SALUDABLE" });
  m.pintar(1000);
  const quieta = visibles(m)[0];
  m.regar();
  m.pintar(1100);
  assert.notEqual(gotaD(m), "", "cae la gota");
  const y1 = Number(gotaD(m).match(/^M\d+ (-?\d+)/)[1]);
  m.pintar(1400);
  const y2 = Number(gotaD(m).match(/^M\d+ (-?\d+)/)[1]);
  assert.ok(y2 > y1, "la gota baja");
  m.pintar(1600);
  assert.equal(gotaD(m), "", "ya cayó");
  assert.notEqual(visibles(m)[0], quieta, "inflada: el segundo cuadro de la suculenta");
  m.pintar(2700);
  assert.equal(gotaD(m), "");
});

test("RIEGO: la suculenta en riesgo da un saltito de 1 px y sonríe (sin cejas de pena); después vuelve", () => {
  const m = crearMascota("suculenta", { estado: "EN_RIESGO" });
  m.pintar(1000);
  assert.equal(clases(m, "masc-ceja").length, 2);
  m.regar();
  m.pintar(1600);
  assert.match(planta(m).getAttribute("transform"), /^translate\(0 -1\)/, "saltito");
  m.pintar(1900);
  assert.doesNotMatch(planta(m).getAttribute("transform"), /^translate/, "el saltito dura 300 ms");
  const boca = clases(m, "masc-boca")[0];
  assert.ok(boca, "sonríe");
  m.pintar(1000 + T.RIEGO.DURACION_MS + 450);
  assert.equal(clases(m, "masc-ceja").length, 2, "vuelve la cara de en riesgo");
});

test("RIEGO: las familias sin animación de riego en la OLED no hacen nada (F56 quitó el parpadeo doble inventado): solo la frase", () => {
  for (const familia of ["girasol", "cactus", "helecho", "carnivora", "generica"]) {
    const m = crearMascota(familia);
    m.pintar(0);
    m.regar();
    const altos = [];
    for (let k = 0; k < 12; k++) {
      m.pintar(k * 50);
      altos.push(Number(clases(m, "masc-ojo")[0].getAttribute("height")));
    }
    assert.equal(gotaD(m), "", familia);
    assert.ok(Math.min(...altos) > 1 || familia === "carnivora", `${familia}: sin parpadeo doble`);
    assert.doesNotMatch(planta(m).getAttribute("transform"), /^translate/, `${familia}: no salta`);
  }
});

test("RIEGO con movimiento reducido: sin gota ni salto; la suculenta solo sonríe un momento", () => {
  const m = crearMascota("suculenta", { estado: "EN_RIESGO" });
  m.pintar(0, { reposo: true });
  m.regar({ reducido: true });
  assert.equal(gotaD(m), "");
  assert.equal(clases(m, "masc-ceja").length, 0, "cambia la expresión");
  const g = crearMascota("girasol");
  g.pintar(0, { reposo: true });
  const antes = serializar(g.nodo);
  g.regar({ reducido: true });
  assert.equal(serializar(g.nodo), antes, "las demás no hacen nada");
});

test("en reposo no hay balanceo ni parpadeo y la flor del cactus está abierta", () => {
  const m = crearMascota("cactus");
  m.pintar(700, { reposo: true });
  assert.equal(planta(m).getAttribute("transform"), "matrix(1 0 0.00000 1 0.0000 0)");
  assert.equal(m.nodo.buscar((e) => e.atributos.get("class") === "masc-flor-petalo").length, 5);
  assert.equal(clases(m, "masc-ojo")[0].getAttribute("height"), "5");
});

test("el cuadro de idle de reposo elige corona girada, suculenta inflada y segundo cuadro del helecho", () => {
  const g = crearMascota("girasol");
  g.pintar(0, { reposo: true, cuadro: 1 });
  assert.equal(g.nodo.buscar((e) => e.atributos.get("class") === "masc-corona")[0].getAttribute("transform"), "rotate(15 24 17)");
  const s = crearMascota("suculenta");
  s.pintar(0, { reposo: true, cuadro: 0 });
  const a = visibles(s)[0];
  s.pintar(0, { reposo: true, cuadro: 1 });
  assert.notEqual(visibles(s)[0], a);
  const h = crearMascota("helecho", { estado: "CRITICO" });
  h.pintar(0, { reposo: true, cuadro: 0 });
  const h0 = visibles(h)[0];
  h.pintar(0, { reposo: true, cuadro: 1 });
  assert.notEqual(visibles(h)[0], h0);
});

test("la mascota no usa estilos en línea (CSP): solo atributos de presentación y clases", () => {
  for (const familia of FAMILIAS) {
    const m = crearMascota(familia);
    m.pintar(1000);
    m.saludar();
    m.pintar(1100);
    assert.equal(m.nodo.buscar((e) => e.hasAttribute("style")).length, 0, familia);
  }
});
