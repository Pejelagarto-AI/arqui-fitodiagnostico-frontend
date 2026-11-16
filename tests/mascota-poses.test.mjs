// Las poses salen de los números de firmware/sprites/dibujar.py: si cambian allá, esta prueba lo recuerda.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as P from "../js/componentes/mascota-poses.js";

const numeros = (d) => (d.match(/-?\d+\.?\d*/g) || []).map(Number);

test("curvaQ pasa por los extremos y por el punto medio de la curva cuadrática", () => {
  const pts = P.curvaQ([0, 0], [10, 20], [20, 0]);
  assert.equal(pts.length, 13);
  assert.deepEqual(pts[0], [0, 0]);
  assert.deepEqual(pts[12], [20, 0]);
  assert.deepEqual(P.puntoCuadratico([0, 0], [10, 20], [20, 0], 0.5), [10, 10]);
  assert.equal(P.talloD([24, 47], [24, 36], [24, 25]), "M24 47Q24 36 24 25");
});

test("lente: 30 puntos (15 por lado), cerrada, y la vena solo en hojas grandes", () => {
  const grande = P.lente([24, 38], [4, 16], 6, { curva: -3 });
  assert.equal(grande.d.split("L").length, 30);
  assert.ok(grande.d.startsWith("M") && grande.d.endsWith("Z"));
  assert.ok(grande.vena, "largo >= 13 y ancho >= 3: lleva vena");
  assert.equal(numeros(grande.vena).length / 2, 9, "puntos 2 a 10 de 14");
  assert.equal(P.lente([24, 44], [7, 36], 4, { curva: -2, vena: false }).vena, null);
  assert.equal(P.lente([24, 44], [30, 44], 4).vena, null, "una hoja chica (largo < 13) no lleva vena");
  // las puntas de la lenteja son la base y la punta
  const [x0, y0] = numeros(P.lente([10, 10], [30, 10], 3).d);
  assert.ok(Math.abs(x0 - 10) < 1e-6 && Math.abs(y0 - 10) < 1e-6);
});

test("petalosDe: 12 en la corona sana, huecos donde se pide y las puntas caen en riesgo y crítico", () => {
  const sana = P.petalosDe(P.GIRASOL[0].corona);
  assert.equal(sana.length, 12);
  const riesgo = P.petalosDe(P.GIRASOL[1].corona);
  assert.equal(riesgo.length, 11 - 2, "once pétalos menos los índices 2 y 7");
  assert.ok(!riesgo.some((p) => p.i === 2 || p.i === 7));
  const critico = P.petalosDe(P.GIRASOL[2].corona);
  assert.equal(critico.length, 10 - 3);
  // la corona sana es simétrica: el pétalo 0 (a la derecha) y el 6 (a la izquierda) quedan a la misma altura
  assert.equal(sana[0].cy, sana[6].cy);
  // en la crítica, `caida` 1 baja las puntas: sus centros quedan más abajo que sin caída
  const sinCaida = P.petalosDe({ ...P.GIRASOL[2].corona, caida: 0 });
  const mas = critico.filter((p) => sinCaida.find((q) => q.i === p.i).cy < p.cy).length;
  assert.equal(mas, critico.length);
});

test("tablas de dibujar.py: girasol, cactus y suculenta por estado", () => {
  assert.deepEqual(P.GIRASOL.map((p) => p.disco), [{ cx: 24, cy: 17, r: 10 }, { cx: 28, cy: 22, r: 9 }, { cx: 31, cy: 29, r: 9 }]);
  assert.deepEqual(P.GIRASOL.map((p) => p.corona.cantidad), [12, 11, 10]);
  assert.ok(P.GIRASOL[2].suelo && !P.GIRASOL[0].suelo && !P.GIRASOL[1].suelo, "solo el crítico deja un pétalo en el suelo");
  assert.deepEqual(P.CACTUS.map((p) => p.cima), [9, 10, 17]);
  assert.deepEqual(P.CACTUS[0].brazos, [[[5, 16, 11, 34], [6, 28, 18, 34]], [[37, 11, 43, 30], [30, 24, 42, 30]]]);
  assert.ok(P.CACTUS[2].espinaCaida);
  assert.deepEqual(P.SUCULENTA.map((p) => [p.cy, p.ancho, p.centro]), [[36, 6, 9], [37, 5, 9], [39, 3, 8]]);
  assert.deepEqual(P.SUCULENTA.map((p) => p.atras.length + p.medio.length), [11, 9, 6]);
});

test("suculenta: la inflada (cuadro 1) crece 1 px de ancho y 2 de largo; la crítica deja caer las puntas", () => {
  const normal = P.hojasDeSuculenta(0, false);
  const inflada = P.hojasDeSuculenta(0, true);
  assert.equal(normal.hojas.length, 11);
  assert.equal(inflada.centro, normal.centro + 1);
  assert.notEqual(inflada.hojas[0].d, normal.hojas[0].d);
  const maxY = (h) => Math.max(...h.hojas.flatMap((x) => numeros(x.d).filter((_, i) => i % 2))); // y de cada punto
  assert.ok(maxY(P.hojasDeSuculenta(2)) > 39 + 6 - 1, "las puntas del crítico bajan 6 px");
});

test("helecho: cinco frondas (cuatro en crítico), dos cuadros, y los foliolos se abren más en el cuadro 1", () => {
  assert.deepEqual([0, 1, 2].map((n) => P.helecho(n, 0).frondas.length), [5, 5, 4]);
  assert.deepEqual([0, 1, 2].map((n) => [P.helecho(n, 0).abre, P.helecho(n, 1).abre]), [[58, 68], [55, 63], [45, 51]]);
  assert.deepEqual([0, 1, 2].map((n) => P.helecho(n, 0).decae), [0, 0.35, 0.9]);
  assert.equal(P.helecho(2, 0).paso, 3.3);
  assert.ok(P.helecho(2, 0).suelo, "un foliolo en el suelo");
  // el cuadro 1 mueve las puntas a la derecha (m = +1) y el 0 a la izquierda (m = -1)
  assert.deepEqual(P.helecho(0, 0).frondas[0][2], [23, 1]);
  assert.deepEqual(P.helecho(0, 1).frondas[0][2], [25, 1]);
});

test("frondaD: raquis de 41 puntos y dos foliolos por paso, que se achican hacia la punta", () => {
  const f = P.frondaD([24, 46], [24, 24], [24, 1], 6, 58);
  assert.equal(numeros(f.raquis).length / 2, 41);
  const segs = f.foliolos.split("M").filter(Boolean);
  assert.ok(segs.length > 10 && segs.length % 2 === 0, "de a pares, uno a cada lado");
  const largo = (s) => { const [x0, y0, x1, y1] = numeros(s); return Math.hypot(x1 - x0, y1 - y0); };
  assert.ok(largo(segs[0]) > largo(segs[segs.length - 1]), "el de la base es más largo que el de la punta");
  // con decae el folíolo se dobla hacia abajo
  const cae = P.frondaD([24, 46], [24, 24], [24, 1], 6, 58, 0.9).foliolos.split("M").filter(Boolean);
  const bajada = (s) => { const [, y0, , y1] = numeros(s); return y1 - y0; };
  assert.ok(bajada(cae[0]) > bajada(segs[0]));
});

test("genérica y carnívora triste", () => {
  assert.deepEqual(P.GENERICA.map((p) => p.hojas.length), [5, 4, 4]);
  assert.deepEqual(P.CARNIVORA_TRISTE, [{ cy: 26, desv: 0, cara: 25 }, { cy: 31, desv: 4, cara: 30 }]);
  assert.deepEqual(P.CARNIVORA_BOCA_G, [14, 7, 0]);
});

test("cabezaDeTrampa: abierta tiene lente y nueve dientes; cerrada, el zigzag de 14 puntos", () => {
  const abierta = P.cabezaDeTrampa(14);
  assert.equal(abierta.dientes.split("Z").filter(Boolean).length, 9, "cinco arriba y cuatro abajo");
  assert.deepEqual(abierta.lente, { cx: 24, cy: 21, rx: 19.5, ry: 7.5 });
  assert.equal(abierta.cabeza.ry, (37 - 1 + 1) / 2, "filas 1 a 37 (sup = 21 - 13 - 7, inf = 21 + 9 + 7)");
  const cerrada = P.cabezaDeTrampa(0);
  assert.equal(cerrada.lente, null);
  assert.equal(numeros(cerrada.zigzag.split("M")[2]).length / 2, 14);
  assert.ok(abierta.inf > P.cabezaDeTrampa(7).inf && P.cabezaDeTrampa(7).inf > cerrada.inf);
});

test("decoración de la matera por familia: puntos, zigzag y banda", () => {
  assert.equal(P.decoracionDeMatera("girasol").length, 20, "diez columnas, dos píxeles cada una");
  assert.equal(P.decoracionDeMatera("cactus").length, 30);
  assert.equal(P.decoracionDeMatera("carnivora").length, 22 + 5);
  assert.deepEqual(P.decoracionDeMatera("helecho"), []);
  assert.equal(P.pixelesD([[1, 2], [3, 4]]), "M1 2h1v1h-1zM3 4h1v1h-1z");
});
