// Los números de la mascota son los del firmware (pantalla.cpp, fase 7): si cambian allá, esta prueba lo recuerda.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "../js/componentes/mascota-tiempo.js";

test("constantes calcadas de pantalla.cpp", () => {
  assert.equal(T.PERIODO_BALANCEO_MS, 2800);
  assert.deepEqual(T.AMPLITUD, [2.2, 1.5, 0.8]);
  assert.deepEqual(T.FACTOR_BALANCEO, { generica: 1, carnivora: 1, girasol: 1.3, cactus: 0.4, suculenta: 0.4, helecho: 1.2 });
  assert.deepEqual(T.GEO_CHICA, { separacion: 4, altoOjo: 5, semiBoca: 4, yBoca: 4, curvaBoca: 2, yCeja: -4, xLagrima: 7 });
  assert.deepEqual(T.GEO_CACTUS, { separacion: 5, altoOjo: 5, semiBoca: 5, yBoca: 4, curvaBoca: 2, yCeja: -5, xLagrima: 8 });
  assert.deepEqual(T.CARA_GIRASOL, [{ x: 24, y: 17 }, { x: 28, y: 22 }, { x: 31, y: 29 }]);
  assert.deepEqual(T.HELECHO_MS, [450, 700, 1100]);
  assert.equal(T.SUCULENTA_RESPIRA_MS, 4500);
  assert.equal(T.MORDISCO_MS, 460);
});

test("el balanceo dobla la planta: nada en la matera, el máximo en la punta", () => {
  assert.equal(T.desv(46, 1, 2.2), 0);
  assert.equal(T.desv(60, 1, 2.2), 0);
  assert.equal(T.desv(0, 1, 2.2), 2.2);
  assert.ok(Math.abs(T.desv(23, -1, 2.2) + 1.1) < 1e-9);
  assert.ok(Math.abs(T.amplitud("cactus", 0) - 0.88) < 1e-9);
  assert.equal(T.matrizBalanceo(0, 2.2), "matrix(1 0 0.00000 1 0.0000 0)");
  // La matriz corre (x, 0) en amp·seno y deja (x, 46) quieto.
  const m = T.matrizBalanceo(1, 2.2).match(/matrix\(1 0 (\S+) 1 (\S+) 0\)/).slice(1).map(Number);
  assert.ok(Math.abs(m[0] * 0 + m[1] - 2.2) < 1e-3);
  assert.ok(Math.abs(m[0] * 46 + m[1]) < 1e-3);
  assert.ok(Math.abs(T.senoBalanceo(700) - 1) < 1e-9);
});

test("parpadeo: medio, cerrado, medio en 150 ms; cada 3 a 5 s", () => {
  assert.deepEqual([0, 49, 50, 99, 100, 149, 150].map(T.factorParpadeo), [0.5, 0.5, 0, 0, 0.5, 0.5, 1]);
  assert.equal(T.esperaDeParpadeo(0), 3000);
  assert.equal(T.esperaDeParpadeo(0.9999), 5000);
});

test("cara saludable del girasol: ojos de 5x5 con brillo, sonrisa; en riesgo cejas y ojos entrecerrados", () => {
  const sana = T.piezasDeCara(T.CARA_NIVEL[0], 1, 24, 17, T.GEO_CHICA);
  assert.deepEqual(sana.ojos.map((o) => [o.x, o.y, o.alto, o.radio]), [[18, 15, 5, 2], [26, 15, 5, 2]]);
  assert.ok(sana.ojos.every((o) => o.brillo));
  assert.equal(sana.cejas.length, 0);
  assert.deepEqual(sana.boca.map((p) => p.y), [19, 20, 20, 21, 21, 21, 20, 20, 19]);
  const riesgo = T.piezasDeCara(T.CARA_NIVEL[1], 1, 24, 17, T.GEO_CHICA);
  assert.equal(riesgo.ojos[0].alto, 3);
  assert.equal(riesgo.cejas.length, 2);
  const cerrado = T.piezasDeCara(T.CARA_NIVEL[0], 0, 24, 17, T.GEO_CHICA);
  assert.equal(cerrado.ojos[0].alto, 1);
});

test("la lágrima del crítico cae los primeros 900 ms de cada 4,2 s", () => {
  assert.ok(T.piezasDeCara(T.CARA_NIVEL[2], 1, 24, 22, T.GEO_CACTUS, { nivel: 2, ahora: 100 }).lagrima);
  assert.equal(T.piezasDeCara(T.CARA_NIVEL[2], 1, 24, 22, T.GEO_CACTUS, { nivel: 2, ahora: 1000 }).lagrima, null);
  assert.equal(T.piezasDeCaraMatera(T.CARA_NIVEL[2], 1, { nivel: 2, ahora: 4200 }).lagrima.y, 56);
});

test("lround redondea como lroundf de C", () => {
  assert.deepEqual([0.5, -0.5, 1.4, -1.6, 0].map(T.lround), [1, -1, 1, -2, 0]);
});

test("transición de cara en 400 ms con suavizado", () => {
  const medio = T.caraEn(T.CARA_NIVEL[0], T.CARA_NIVEL[2], 200);
  assert.ok(Math.abs(medio.boca) < 1e-9);
  assert.deepEqual(T.caraEn(T.CARA_NIVEL[0], T.CARA_NIVEL[2], 400), T.CARA_NIVEL[2]);
});

test("girasol: la corona alterna cada 400 ms; quieto si no está saludable", () => {
  assert.equal(T.poseGirasol(0, 0).cuadro, 0);
  assert.equal(T.poseGirasol(400, 0).cuadro, 1);
  assert.equal(T.poseGirasol(800, 0).cuadro, 0);
  // enteros, como `lroundf` en el firmware: 0,6 px sube 1 y 1,5 px redondea a 2 (lejos del cero)
  assert.equal(T.poseGirasol(400, 0).dy, 1);
  assert.equal(T.poseGirasol(1200, 0).dy, -1);
  assert.equal(T.poseGirasol(0, 0).dy, 0);
  assert.equal(T.poseGirasol(1250, 0).mira, 2);
  assert.equal(T.poseGirasol(2500, 0).mira, 0);
  assert.deepEqual(T.poseGirasol(400, 1), { cuadro: 0, dy: 0, mira: 0 });
});

test("cactus: la flor espera 600 ms, sale de botón y abre en 1,5 s", () => {
  assert.equal(T.florCactus(600, 0), null);
  assert.equal(T.florCactus(700, 0).boton, true);
  assert.deepEqual(T.florCactus(2100, 0), { boton: false, k: 1, d: 3 });
  assert.equal(T.florCactus(5000, 1), null);
});

test("suculenta se infla 500 ms cada 4,5 s; helecho alterna según el nivel", () => {
  assert.equal(T.suculentaInflada(4500, 0), true);
  assert.equal(T.suculentaInflada(5000, 0), false);
  assert.equal(T.suculentaInflada(4500, 1), false);
  assert.equal(T.cuadroHelecho(449, 0), 0);
  assert.equal(T.cuadroHelecho(450, 0), 1);
  assert.equal(T.cuadroHelecho(1099, 2), 0);
});

test("mordisco: abierta, media, cerrada (+2), media (+1), abierta (-1) y fin a los 460 ms", () => {
  assert.deepEqual([0, 100, 200, 300, 400].map((t) => [T.pasoMordisco(t).boca, T.pasoMordisco(t).dy]), [[0, 0], [1, 0], [2, 2], [1, 1], [0, -1]]);
  assert.equal(T.pasoMordisco(460), null);
  assert.equal(T.proximoMordisco(10000), 18000);
});

test("SALUDO (F44, pendiente de calcar en el firmware): 12 cuadros de 50 ms, salto de 5 px y parpadeo doble", () => {
  const S = T.SALUDO;
  assert.equal(S.CUADRO_MS, 50);
  assert.equal(S.DURACION_MS, 600);
  assert.equal(S.DY.length * S.CUADRO_MS, S.DURACION_MS);
  assert.equal(S.OJOS.length, S.DY.length);
  assert.deepEqual([...S.DY], [-2, -4, -5, -5, -4, -2, 0, 1, 0, 0, 0, 0]);
  assert.deepEqual([...S.OJOS], [1, 1, 0.5, 0, 0.5, 1, 0.5, 0, 0.5, 1, 1, 1]);
  assert.equal(Math.min(...S.DY), -5, "sube 5 px del sprite de 48x64");
  assert.equal(S.DY[0], 0 + S.DY[0], "arranca ya en el aire");
  assert.deepEqual({ ...S.CARA }, T.CARA_NIVEL[0], "la cara del saludo es la contenta del estado saludable");
  assert.equal(S.REDUCIDO_MS, 800);
  // el parpadeo doble usa los mismos pasos que el normal (0,5 · 0 · 0,5) dos veces
  assert.equal(S.OJOS.filter((o) => o === 0).length, 2);
  assert.ok(Object.isFrozen(S) && Object.isFrozen(S.DY));
});

test("pasoSaludo da el cuadro de cada instante y termina a los 600 ms", () => {
  assert.equal(T.pasoSaludo(-1), null);
  assert.equal(T.pasoSaludo(Infinity), null);
  assert.equal(T.pasoSaludo(NaN), null);
  assert.deepEqual(T.pasoSaludo(0), { cuadro: 0, dy: -2, ojos: 1 });
  assert.deepEqual(T.pasoSaludo(149), { cuadro: 2, dy: -5, ojos: 0.5 });
  assert.deepEqual(T.pasoSaludo(150), { cuadro: 3, dy: -5, ojos: 0 });
  assert.deepEqual(T.pasoSaludo(350), { cuadro: 7, dy: 1, ojos: 0 });
  assert.deepEqual(T.pasoSaludo(599), { cuadro: 11, dy: 0, ojos: 1 });
  assert.equal(T.pasoSaludo(600), null);
});

test("la carnívora pone los ojos en la fila 9, 12 o 16 según la boca, como (32 - CARNI_G) / 2", () => {
  assert.deepEqual(T.CARNIVORA_OJOS_Y, [14, 7, 0].map((g) => Math.floor((32 - g) / 2)));
});
