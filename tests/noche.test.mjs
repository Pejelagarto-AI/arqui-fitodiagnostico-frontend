// F49: la planta dormida y el saludo, calcados de la fase 11 del firmware (fito_nucleo.c, pantalla.cpp,
// previsualizar.py). Los números se fijan aquí y en firmware/test/probar_nucleo.py del backend: si cambian en uno,
// cambian en el otro. También: `periodo` llega a la mascota y la ficha de luz va en gris de noche.
import { test } from "node:test";
import assert from "node:assert/strict";
import { instalarDom } from "./dom-minimo.mjs";

instalarDom();
const T = await import("../js/componentes/mascota-tiempo.js");
const P = await import("../js/componentes/mascota-poses.js");
const { crearMascota } = await import("../js/componentes/mascota.js");
const { crearMascotaVista } = await import("../js/componentes/mascota-vista.js");
const { crearVistaDeDiagnostico, luzDelDia, luzNoCuenta, DE_NOCHE_NO_CUENTA } = await import("../js/componentes/diagnostico.js");
const { FAMILIAS } = await import("../js/componentes/especie.js");

const ESTADOS = ["SALUDABLE", "EN_RIESGO", "CRITICO"];
const porClase = (raiz, c) => raiz.buscar((e) => (e.atributos.get("class") ?? "").split(" ").includes(c));
const cuerpos = (m) => porClase(m.nodo, "masc-cuerpo-pose");
const visible = (m) => cuerpos(m).filter((e) => !e.hasAttribute("display"));
const ojos = (m) => porClase(m.nodo, "masc-ojo");
const zetas = (m) => porClase(m.nodo, "masc-zeta");
const planta = (m) => porClase(m.nodo, "masc-planta")[0];
const texto = (nodo) => (nodo.texto !== undefined ? nodo.texto : (nodo.hijos || []).map(texto).join(""));

// ---------------------------------------------------------------- números (los de fito_nucleo.c)

test("NOCHE: respiración de 3 s que sube 1 px en la mitad central (750 a 2249 ms), igual que fito_respira_dy", () => {
  assert.equal(T.NOCHE.RESPIRA_MS, 3000);
  const casos = [[0, 0], [749, 0], [750, -1], [1500, -1], [2249, -1], [2250, 0], [2999, 0], [3000, 0], [3750, -1], [4294967295, 0]];
  for (const [t, dy] of casos) assert.equal(T.respiraDy(t), dy, `t=${t}`);
  // la regla entera es lround(0.5 - 0.5 cos) salvo en los dos bordes exactos
  for (let t = 0; t < 3000; t += 10) {
    if (t === 750 || t === 2250) continue;
    assert.equal(T.respiraDy(t), 0 - T.lround(0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 3000)), `t=${t}`);
  }
});

test("NOCHE: el zzz son tres cuadros de 1 s con zetas de 3, 4 y 5 px en la esquina de arriba a la derecha", () => {
  for (const [t, c] of [[0, 0], [999, 0], [1000, 1], [2500, 2], [3000, 0], [4294967295, 2]]) assert.equal(T.cuadroZzz(t), c, `t=${t}`);
  assert.deepEqual(T.NOCHE.ZZZ.map((z) => [z.x, z.y, z.lado]), [[37, 10, 3], [40, 5, 4], [43, 0, 5]]);
  for (const z of T.NOCHE.ZZZ) assert.ok(z.x + z.lado <= 48, "cabe en el sprite de 48 px");
  assert.equal(T.zetaD({ x: 37, y: 10, lado: 3 }), "M37.5 10.5H39.5L37.5 12.5H39.5");
});

test("SALUDO: los números que copió el firmware (FITO_SALUDO_DY y FITO_SALUDO_OJOS)", () => {
  assert.deepEqual([...T.SALUDO.DY], [-2, -4, -5, -5, -4, -2, 0, 1, 0, 0, 0, 0]);
  assert.deepEqual([...T.SALUDO.OJOS], [1, 1, 0.5, 0, 0.5, 1, 0.5, 0, 0.5, 1, 1, 1]);
  assert.equal(T.SALUDO.CUADRO_MS * T.SALUDO.DY.length, T.SALUDO.DURACION_MS);
  for (let k = 0; k < 12; k++) for (const d of [0, 25, 49]) assert.deepEqual(T.pasoSaludo(50 * k + d), { cuadro: k, dy: T.SALUDO.DY[k], ojos: T.SALUDO.OJOS[k] });
  assert.equal(T.pasoSaludo(600), null);
});

test("el girasol dormido es el de dibujar.py: cabeza en (23, 21), corona entera, y la cara va ahí", () => {
  assert.deepEqual(P.GIRASOL_DORMIDO.disco, { cx: 23, cy: 21, r: 10 });
  assert.equal(P.GIRASOL_DORMIDO.corona.cantidad, 12);
  assert.equal(P.GIRASOL_DORMIDO.corona.quitar, undefined, "no le faltan pétalos: duerme, no está mal");
  assert.deepEqual(T.NOCHE.CARA_GIRASOL, { x: 23, y: 21 });
  assert.deepEqual(P.GIRASOL_DORMIDO.tallo.at(-1), [23, 29], "el tallo llega a (cx, cy + 8), como curva_q");
});

test("esNoche: solo NOCHE; sin campo (servidor viejo o diagnóstico sin cuenta) es de día", () => {
  assert.equal(T.esNoche("NOCHE"), true);
  for (const p of ["DIA", undefined, null, "noche"]) assert.equal(T.esNoche(p), false);
});

// ---------------------------------------------------------------- la mascota dormida

test("de noche las seis familias duermen en sus tres estados: ojos de 1 px, zzz y sin lágrima", () => {
  for (const familia of FAMILIAS) {
    for (const estado of ESTADOS) {
      const m = crearMascota(familia, { estado, periodo: "NOCHE" });
      for (const t of [100, 2500, 4300 + 100]) {
        m.pintar(t);
        assert.equal(visible(m).length, 1, `${familia} ${estado}`);
        assert.ok(ojos(m).length === 2 && ojos(m).every((o) => o.getAttribute("height") === "1"), `${familia} ${estado}: ojos cerrados`);
        assert.equal(m.piezas().lagrima, null, `${familia} ${estado}: dormida no llora`);
      }
      m.pintar(2500);
      assert.equal(zetas(m).length, 3, "a los 2,5 s se ven las tres zetas");
      m.pintar(500);
      assert.equal(zetas(m).length, 1);
      assert.equal(m.nodo.getAttribute("data-periodo"), "NOCHE");
    }
  }
});

test("dormida no se balancea y respira: el cuerpo sube 1 px en la mitad central de los 3 s", () => {
  const m = crearMascota("cactus", { periodo: "NOCHE" });
  m.pintar(1500);
  assert.match(planta(m).getAttribute("transform"), /^translate\(0 -1\) matrix\(1 0 -?0\.00000 1 0\.0000 0\)$/);
  m.pintar(2600);
  assert.equal(planta(m).getAttribute("transform"), T.matrizBalanceo(0, 1), "abajo y sin balanceo");
  assert.equal(porClase(m.nodo, "masc-flor")[0].hijos.length, 0, "de noche la flor del cactus se cierra");
});

test("cada familia duerme en su cuerpo: girasol con la cabeza caída, carnívora con la trampa cerrada", () => {
  const g = crearMascota("girasol", { periodo: "NOCHE" });
  g.pintar(2500);
  const dia = crearMascota("girasol");
  dia.pintar(2500, { reposo: true });
  assert.equal(cuerpos(g).indexOf(visible(g)[0]), 3, "el cuarto cuerpo: el dormido");
  assert.equal(cuerpos(dia).indexOf(visible(dia)[0]), 0);
  const ojoG = ojos(g)[0];
  assert.equal(Number(ojoG.getAttribute("x")), 23 - 4 - 2, "la cara sigue a la cabeza caída (23, 21)");
  assert.equal(Number(ojoG.getAttribute("y")), 21);

  const c = crearMascota("carnivora", { periodo: "NOCHE" });
  for (const t of [0, 7000, 12000, 20000]) {
    c.pintar(t);
    assert.equal(cuerpos(c).indexOf(visible(c)[0]), 2, "boca cerrada (carni_cerrada) y no muerde");
  }
  c.morder();
  c.pintar(20010);
  assert.equal(cuerpos(c).indexOf(visible(c)[0]), 2, "una lectura nueva no la despierta");
});

test("el saludo despierta a la planta dormida y luego vuelve a dormir", () => {
  const m = crearMascota("girasol", { periodo: "NOCHE" });
  m.pintar(1000);
  m.saludar();
  m.pintar(1000 + 50 * 2 + 10);
  assert.equal(zetas(m).length, 0, "saludando no hay zzz");
  assert.equal(ojos(m)[0].getAttribute("height"), String(T.lround(5 * 0.5)), "los ojos del saludo, no los dormidos");
  assert.equal(cuerpos(m).indexOf(visible(m)[0]), 0, "despierta: el cuerpo de saludable");
  m.pintar(1000 + 600 + 10);
  assert.equal(ojos(m)[0].getAttribute("height"), "1");
  assert.ok(zetas(m).length > 0);
});

test("con movimiento reducido duerme quieta: ojos cerrados y las tres zetas fijas", () => {
  const m = crearMascota("suculenta", { periodo: "NOCHE" });
  m.pintar(1500, { reposo: true });
  assert.equal(ojos(m)[0].getAttribute("height"), "1");
  assert.equal(zetas(m).length, 3);
  assert.doesNotMatch(planta(m).getAttribute("transform"), /translate/, "sin respirar");
});

test("de día no hay zzz y la mascota sigue igual que antes", () => {
  const m = crearMascota("helecho", { periodo: "DIA" });
  m.pintar(2500);
  assert.equal(zetas(m).length, 0);
  assert.equal(m.nodo.getAttribute("data-periodo"), "DIA");
  m.ponerPeriodo("NOCHE");
  m.pintar(2550);
  assert.equal(zetas(m).length, 3);
  m.ponerPeriodo(undefined);
  m.pintar(2600);
  assert.equal(zetas(m).length, 0, "sin dato vuelve a ser de día");
});

// ---------------------------------------------------------------- `periodo` llega a la mascota

test("la vista pasa el periodo del diagnóstico a la mascota, al crearla y en cada aplicar", () => {
  const v = crearMascotaVista({ especie: "girasol", estado: "SALUDABLE", periodo: "NOCHE", animar: false });
  assert.equal(v.mascota.nodo.getAttribute("data-periodo"), "NOCHE");
  v.aplicar("EN_RIESGO", "DIA");
  assert.equal(v.mascota.nodo.getAttribute("data-periodo"), "DIA");
  v.aplicar("SALUDABLE", "NOCHE");
  assert.equal(v.mascota.nodo.getAttribute("data-periodo"), "NOCHE");
  assert.equal(zetas(v.mascota).length, 3, "sin idle corriendo repinta la pose quieta, ya dormida");
  v.aplicar(null);
  assert.equal(v.mascota.nodo.getAttribute("data-periodo"), "DIA", "sin diagnóstico, de día");
});

// ---------------------------------------------------------------- la ficha de luz

const parametros = [
  { nombre: "humedad", valor: 55, unidad: "%", estado: "OPTIMO", rangoOptimo: [40, 70] },
  { nombre: "luz", valor: 3, unidad: "lx", estado: "BAJO", rangoOptimo: [800, 2500] },
  { nombre: "temperatura", valor: 21, unidad: "°C", estado: "OPTIMO", rangoOptimo: [15, 30] },
];
const exposicion = { base: "ACUMULADA", horasObservadas: 24, horasDeLuz: 7.5, luxPromedioEnLuz: 1480.2, luxEfectivo: 1480.2, horasEnOscuridad: 9.25 };
const burbujaDe = (vista, nombre) => vista.burbujas.find((b) => b.parametro.nombre === nombre).nodo;

test("de noche la ficha de luz va en gris con «de noche no cuenta» en vez del estado; las otras no cambian", () => {
  const vista = crearVistaDeDiagnostico({ estado: "SALUDABLE", periodo: "NOCHE", exposicionLuminica: exposicion, parametros, recomendaciones: [] });
  const luz = burbujaDe(vista, "luz");
  assert.equal(luz.getAttribute("data-noche"), "true");
  assert.equal(porClase(luz, "chip--noche").length, 1);
  assert.equal(texto(porClase(luz, "chip--noche")[0]), DE_NOCHE_NO_CUENTA);
  assert.equal(porClase(luz, "chip--bajo").length, 0, "no se marca como problema");
  assert.equal(burbujaDe(vista, "humedad").getAttribute("data-noche"), null);
  assert.equal(porClase(burbujaDe(vista, "humedad"), "chip--optimo").length, 1);
});

test("con historial la ficha de luz dice el número de ahora y la luz del día (horas y lux efectivo)", () => {
  assert.deepEqual(luzDelDia({ exposicionLuminica: exposicion }), { horas: 7.5, lux: 1480.2, texto: "Hoy: 7,5 h de luz, 1.480,2 lx efectivos" });
  for (const d of ["DIA", "NOCHE"]) {
    const vista = crearVistaDeDiagnostico({ estado: "SALUDABLE", periodo: d, exposicionLuminica: exposicion, parametros, recomendaciones: [] });
    const luz = burbujaDe(vista, "luz");
    assert.equal(texto(porClase(luz, "burbuja-dia")[0]), "Hoy: 7,5 h de luz, 1.480,2 lx efectivos");
    assert.match(texto(porClase(luz, "num")[0]), /lx ahora$/);
    assert.equal(porClase(burbujaDe(vista, "humedad"), "burbuja-dia").length, 0, "solo la luz");
  }
});

test("sin historial (INSTANTANEA, o un servidor sin el campo) no se muestran horas y la luz es de día", () => {
  const instantanea = { base: "INSTANTANEA", horasObservadas: null, horasDeLuz: null, luxPromedioEnLuz: null, luxEfectivo: null, horasEnOscuridad: null };
  assert.equal(luzDelDia({ exposicionLuminica: instantanea }), null);
  assert.equal(luzDelDia({}), null);
  assert.equal(luzNoCuenta({}), false);
  assert.equal(luzNoCuenta(null), false);
  const vista = crearVistaDeDiagnostico({ estado: "EN_RIESGO", periodo: "DIA", exposicionLuminica: instantanea, parametros, recomendaciones: [] });
  const luz = burbujaDe(vista, "luz");
  assert.equal(porClase(luz, "burbuja-dia").length, 0);
  assert.equal(luz.getAttribute("data-noche"), null);
  assert.equal(porClase(luz, "chip--bajo").length, 1, "de día la luz baja sí se marca");
});
