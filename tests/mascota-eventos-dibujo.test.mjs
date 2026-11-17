// F56: lo que la mascota DIBUJA con la cola de eventos, el desmayo y los accesorios (js/componentes/mascota.js), con el DOM
// mínimo. Los números son los de la fase 14 (docs/fase14/IMPLEMENTACION.md), vía js/mascota-eventos.js y mascota-sprites.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { instalarDom } from "./dom-minimo.mjs";

instalarDom();
const { crearMascota } = await import("../js/componentes/mascota.js");
const { crearReproductor } = await import("../js/mascota-eventos.js");
const { FAMILIAS } = await import("../js/componentes/especie.js");
const S = await import("../js/componentes/mascota-sprites.js");
const P = await import("../js/componentes/mascota-poses.js");
const T = await import("../js/componentes/mascota-tiempo.js");

const buscar = (m, clase) => m.nodo.buscar((e) => e.atributos.get("class") === clase);
const planta = (m) => buscar(m, "masc-planta")[0];
const dyDe = (m) => { const t = planta(m).getAttribute("transform"); const r = /^translate\(0 (-?\d+)\)/.exec(t); return r ? Number(r[1]) : 0; };
const trazo = (m, clase) => buscar(m, clase)[0].getAttribute("d");
const efecto = (m) => trazo(m, "masc-efecto-sprite");
const hayZzz = (m) => buscar(m, "masc-zeta").length > 0;
const ojos = (m) => buscar(m, "masc-ojo").length;

function conReloj(familia, opciones = {}) {
  let ahora = 10000;
  const reproductor = crearReproductor({ reloj: () => ahora });
  const m = crearMascota(familia, { eventos: reproductor, ...opciones });
  return { m, r: reproductor, poner: (t) => { ahora = t; }, hora: () => ahora };
}

test("DESMAYADA (el ánimo): ojos en «x», cuerpo crítico, 2 px abajo, sin balanceo, parpadeo ni lágrima, en las seis familias", () => {
  for (const familia of FAMILIAS) {
    const m = crearMascota(familia, { estado: "SALUDABLE" });
    m.ponerDesmayada(true);
    for (const t of [0, 700, 1400, 2100, 5000]) {
      m.pintar(t);
      assert.equal(m.pose().desmayo, true, familia);
      assert.equal(m.pose().nivel, 2, `${familia}: la pose crítica`);
      assert.equal(m.nodo.getAttribute("data-estado"), "CRITICO", `${familia}: hojas de la crítica`);
      assert.equal(buscar(m, "masc-ojo masc-ojo-x").length, 2, `${familia}: dos ojos en «x»`);
      assert.equal(ojos(m), 0, `${familia}: ninguno de los ojos normales`);
      assert.equal(dyDe(m), 2, `${familia}: DESMAYADA_DY`);
      assert.equal(planta(m).getAttribute("transform").includes("matrix(1 0 0.00000 1 0.0000 0)"), true, `${familia}: sin balanceo`);
      assert.equal(buscar(m, "masc-lagrima").length, 0, `${familia}: no llora`);
      if (t >= 700) assert.ok(buscar(m, "masc-ceja").length >= 1 && buscar(m, "masc-boca").length >= 1, `${familia}: cejas y boca siguen al estado crítico (tras la transición de 400 ms)`);
    }
    // se levanta: vuelve a su estado
    m.ponerDesmayada(false);
    m.pintar(6000);
    assert.equal(m.pose().desmayo, false);
    assert.equal(m.nodo.getAttribute("data-estado"), "SALUDABLE");
    assert.equal(buscar(m, "masc-ojo masc-ojo-x").length, 0);
  }
});

test("los ojos en «x» son ojo_x_5 en (ex - 2, cy - 2) en la cara grande y ojo_x_3 en (17, 55) y (28, 55) en la matera", () => {
  const g = crearMascota("girasol", { estado: "SALUDABLE" });
  g.ponerDesmayada(true);
  g.pintar(0, { reposo: true });
  // en reposo la desmayada también se ve: su cara va en la pose crítica, CARA_GIRASOL[2] = (31, 29), separación 4
  const esperado = [27, 35].map((ex) => P.pixelesD(S.pixelesDeSprite(S.OJO_X_5, ex - 2, 29 - 2)));
  assert.deepEqual(buscar(g, "masc-ojo masc-ojo-x").map((e) => e.getAttribute("d")), esperado);
  const c = crearMascota("generica", { estado: "EN_RIESGO" });
  c.ponerDesmayada(true);
  c.pintar(0, { reposo: true });
  assert.deepEqual(buscar(c, "masc-ojo masc-ojo-x").map((e) => e.getAttribute("d")), [17, 28].map((ex) => P.pixelesD(S.pixelesDeSprite(S.OJO_X_3, ex, 55))));
});

test("DESMAYADA gana a la noche (no hay zzz) y el saludo gana a DESMAYADA (salta 600 ms y vuelve a la pose)", () => {
  const m = crearMascota("cactus", { estado: "CRITICO", periodo: "NOCHE" });
  m.ponerDesmayada(true);
  m.pintar(2500);
  assert.equal(hayZzz(m), false, "no es sueño");
  assert.equal(dyDe(m), 2);
  m.saludar();
  m.pintar(2600);
  assert.equal(m.pose().desmayo, false, "mientras saluda no está desmayada");
  assert.ok(ojos(m) > 0);
  assert.ok(dyDe(m) < 0, "salta");
  m.pintar(2600 + T.SALUDO.DURACION_MS + 50);
  assert.equal(m.pose().desmayo, true);
  assert.equal(dyDe(m), 2);
});

test("el evento DESMAYO: cae 0, 0, 1, 1, 2, 2 px en 600 ms con ojos en «x», se queda abajo su turno de 3000 ms y se levanta", () => {
  const { m, r, poner } = conReloj("girasol", { estado: "SALUDABLE" });
  poner(10000);
  m.pintar(0);
  assert.equal(dyDe(m), 0);
  r.empujar("DESMAYO");
  poner(10000);
  m.pintar(0); // el evento arranca en el primer cuadro que se pinta, como en la OLED
  const esperados = [0, 0, 1, 1, 2, 2];
  for (let k = 0; k < 6; k++) {
    poner(10000 + 100 * k + 50);
    m.pintar(100 * k);
    assert.equal(m.evento().tipo, "DESMAYO");
    assert.equal(dyDe(m), esperados[k], `cuadro ${k}`);
    assert.equal(buscar(m, "masc-ojo masc-ojo-x").length, 2);
  }
  poner(10000 + 2500);
  m.pintar(2500);
  assert.equal(dyDe(m), 2, "queda abajo el resto del turno (D194)");
  poner(10000 + 3000);
  m.pintar(3000);
  assert.equal(m.evento(), null);
  assert.equal(m.pose().desmayo, false);
  assert.equal(dyDe(m), 0);
  assert.equal(buscar(m, "masc-ojo masc-ojo-x").length, 0);
});

test("SALIO_AL_SOL: rayos_0..2 en (37, 0), 250 ms por cuadro, 2 vueltas (1500 ms), y el turno sigue 3000 ms", () => {
  const { m, r, poner } = conReloj("girasol");
  m.pintar(0);
  assert.equal(efecto(m), "");
  r.empujar("SALIO_AL_SOL");
  const cuadros = [];
  for (let t = 0; t < 1500; t += 250) {
    poner(10000 + t);
    m.pintar(t);
    cuadros.push(efecto(m));
  }
  const esperados = [0, 1, 2, 0, 1, 2].map((c) => P.pixelesD(S.pixelesDeSprite(S.RAYOS[c], 37, 0)));
  assert.deepEqual(cuadros, esperados);
  assert.equal(trazo(m, "masc-halo"), "", "(el primer halo es el del accesorio, que no hay)");
  poner(10000 + 1500);
  m.pintar(1500);
  assert.equal(efecto(m), "", "la animación terminó");
  assert.equal(m.evento().tipo, "SALIO_AL_SOL", "pero el turno sigue (la frase)");
  poner(10000 + 3000);
  m.pintar(3000);
  assert.equal(m.evento(), null);
});

test("ACARICIADA: saludo de 600 ms y el corazón en (38, 1): corazon_0 y corazon_1, 300 ms por cuadro, 3 latidos (1800 ms)", () => {
  const { m, r, poner } = conReloj("cactus");
  m.pintar(0);
  r.empujar("ACARICIADA");
  const vistos = [];
  let dys = [];
  for (let t = 0; t < 1800; t += 300) {
    poner(10000 + t);
    m.pintar(t);
    vistos.push(efecto(m));
    dys.push(dyDe(m));
  }
  const c = (k) => P.pixelesD(S.pixelesDeSprite(S.CORAZON[k], 38, 1));
  assert.deepEqual(vistos, [c(0), c(1), c(0), c(1), c(0), c(1)]);
  assert.ok(dys[0] < 0, "el saludo arranca con el evento");
  assert.equal(dys[2], 0, "a los 600 ms ya terminó el saludo");
  assert.equal(S.CORAZON[0].length, 8);
});

test("REVIVIO: saludo y destellos_0..2 cada 200 ms, 2 vueltas; RACHA: estrella_0..2 cada 300 ms, 2 vueltas (en (37, 0))", () => {
  const rev = conReloj("helecho");
  rev.m.pintar(0);
  rev.r.empujar("REVIVIO");
  const vistos = [];
  for (let t = 0; t < 1200; t += 200) { rev.poner(10000 + t); rev.m.pintar(t); vistos.push(efecto(rev.m)); }
  assert.deepEqual(vistos, [0, 1, 2, 0, 1, 2].map((k) => P.pixelesD(S.pixelesDeSprite(S.DESTELLOS[k], 37, 0))));
  rev.poner(10000 + 1200); rev.m.pintar(1200);
  assert.equal(efecto(rev.m), "");

  const rac = conReloj("suculenta");
  rac.m.pintar(0);
  rac.r.empujar("RACHA");
  const e = [];
  for (let t = 0; t < 1800; t += 300) { rac.poner(10000 + t); rac.m.pintar(t); e.push(efecto(rac.m)); }
  assert.deepEqual(e, [0, 1, 2, 0, 1, 2].map((k) => P.pixelesD(S.pixelesDeSprite(S.ESTRELLA[k], 37, 0))));
});

test("REGADA, RIEGO_CONFIRMADO y RIEGO_DESMENTIDO no tienen efecto ni pose propia: solo frase (REGADA, la gota de la suculenta)", () => {
  for (const tipo of ["REGADA", "RIEGO_CONFIRMADO", "RIEGO_DESMENTIDO"]) {
    const { m, r, poner } = conReloj("girasol", { estado: "EN_RIESGO" });
    m.pintar(0);
    r.empujar(tipo);
    for (const t of [0, 300, 1000, 2000]) {
      poner(10000 + t);
      m.pintar(t);
      assert.equal(m.evento().tipo, tipo);
      assert.equal(efecto(m), "");
      assert.equal(m.pose().desmayo, false);
      assert.equal(dyDe(m), 0);
    }
  }
  const { m, r, poner } = conReloj("suculenta");
  m.pintar(0);
  r.empujar("REGADA");
  poner(10200);
  m.pintar(200);
  assert.notEqual(trazo(m, "masc-gota"), "", "la gota cae");
});

test("los eventos suenan de a uno, 3000 ms cada uno, en el orden en que llegaron; RIEGO_DECLARADO no entra", () => {
  const { m, r, poner } = conReloj("girasol");
  m.pintar(0);
  r.empujar("RACHA");
  r.empujar("RIEGO_DECLARADO");
  r.empujar("SALIO_AL_SOL");
  poner(10000); m.pintar(0);
  assert.equal(m.evento().tipo, "RACHA");
  poner(12999); m.pintar(2999);
  assert.equal(m.evento().tipo, "RACHA");
  poner(13000); m.pintar(3000);
  assert.equal(m.evento().tipo, "SALIO_AL_SOL");
  assert.equal(m.evento().t, 0);
  poner(16000); m.pintar(6000);
  assert.equal(m.evento(), null);
});

test("de noche un evento con animación la despierta solo lo que dura la parte animada; los de solo frase la dejan dormida", () => {
  const sol = conReloj("girasol", { estado: "SALUDABLE", periodo: "NOCHE" });
  sol.m.pintar(0);
  assert.equal(hayZzz(sol.m), true, "duerme");
  sol.r.empujar("SALIO_AL_SOL");
  sol.poner(10000); sol.m.pintar(0);
  assert.equal(hayZzz(sol.m), false, "despierta con los rayos");
  sol.poner(11499); sol.m.pintar(1499);
  assert.equal(hayZzz(sol.m), false);
  sol.poner(11500); sol.m.pintar(1500);
  assert.equal(hayZzz(sol.m), true, "a los 1500 ms vuelve a dormir aunque el turno siga");
  const frase = conReloj("girasol", { estado: "SALUDABLE", periodo: "NOCHE" });
  frase.m.pintar(0);
  frase.r.empujar("RIEGO_CONFIRMADO");
  frase.poner(10100); frase.m.pintar(100);
  assert.equal(hayZzz(frase.m), true, "solo frase: sigue dormida");
});

test("con movimiento reducido (reposo) no hay cola ni efectos; la desmayada y el accesorio sí se ven quietos", () => {
  const { m, r, poner } = conReloj("cactus");
  m.pintar(0, { reposo: true });
  r.empujar("SALIO_AL_SOL");
  poner(10100);
  m.pintar(0, { reposo: true });
  assert.equal(efecto(m), "");
  assert.equal(m.evento(), null);
  m.ponerDesmayada(true);
  m.ponerAccesorio("GAFAS");
  m.pintar(0, { reposo: true });
  assert.equal(dyDe(m), 2);
  assert.notEqual(trazo(m, "masc-accesorio-sprite"), "");
});

test("accesorio: el sprite en el punto de la cara + el ancla, con aureola, en las seis familias y los tres accesorios", () => {
  const cara = { girasol: { x: 24, y: 17 }, cactus: { x: 24, y: 22 }, suculenta: { x: 24, y: 36 }, helecho: S.CARA_MATERA, generica: S.CARA_MATERA, carnivora: { x: 24, y: 9 } };
  for (const familia of FAMILIAS) {
    for (const accesorio of ["SOMBRERO", "MONO", "GAFAS"]) {
      const m = crearMascota(familia, { estado: "SALUDABLE", accesorio });
      m.pintar(0, { reposo: true, cuadro: 0 });
      const lugar = S.colocarAccesorio({ accesorio, familia, nivel: 0, cara: cara[familia] });
      const pixeles = S.pixelesDeSprite(lugar.filas, lugar.x, lugar.y);
      assert.equal(trazo(m, "masc-accesorio-sprite"), P.pixelesD(pixeles), `${familia} ${accesorio}`);
      const aureola = buscar(m, "masc-accesorio")[0].hijos[0].getAttribute("d");
      assert.equal(aureola, P.pixelesD(S.aureolaDe(pixeles)), `${familia} ${accesorio}: aureola`);
    }
  }
  const sin = crearMascota("girasol", { estado: "SALUDABLE" });
  sin.pintar(0, { reposo: true });
  assert.equal(trazo(sin, "masc-accesorio-sprite"), "");
  sin.ponerAccesorio("CORONA");
  sin.pintar(0, { reposo: true });
  assert.equal(trazo(sin, "masc-accesorio-sprite"), "", "uno nuevo del servidor no dibuja nada");
});

test("el accesorio sigue al cuerpo: balanceo, salto del saludo y respiración dormida; las gafas de la común no se mueven", () => {
  const m = crearMascota("girasol", { estado: "SALUDABLE", accesorio: "SOMBRERO" });
  m.pintar(700); // el seno del balanceo no es 0
  const g = () => buscar(m, "masc-accesorio")[0].getAttribute("transform");
  assert.match(g(), /^translate\(-?\d+\.\d\d -?\d+\)$/);
  const sinSaludo = g();
  m.saludar();
  m.pintar(750 + 100); // 2.º cuadro del saludo: dy -4
  assert.notEqual(g(), sinSaludo);
  assert.match(g(), / -(3|4|5)\)$/, "sube con el cuerpo");
  const noche = crearMascota("girasol", { estado: "SALUDABLE", periodo: "NOCHE", accesorio: "MONO" });
  noche.pintar(1500); // respira: sube 1 px
  assert.match(buscar(noche, "masc-accesorio")[0].getAttribute("transform") || "", /-1\)$/);
  const gafas = crearMascota("generica", { estado: "SALUDABLE", accesorio: "GAFAS" });
  gafas.pintar(700);
  gafas.saludar();
  gafas.pintar(850);
  assert.equal(buscar(gafas, "masc-accesorio")[0].getAttribute("transform") || "", "", "las gafas de la común van en la matera");
  const sombrero = crearMascota("generica", { estado: "SALUDABLE", accesorio: "SOMBRERO" });
  sombrero.pintar(700);
  assert.notEqual(buscar(sombrero, "masc-accesorio")[0].getAttribute("transform") || "", "", "el sombrero sí se balancea");
});

test("el accesorio de la desmayada baja con el cuerpo (el ancla sigue a la pose crítica) y sin balanceo", () => {
  const m = crearMascota("cactus", { estado: "SALUDABLE", accesorio: "SOMBRERO" });
  m.ponerDesmayada(true);
  m.pintar(700);
  assert.equal(buscar(m, "masc-accesorio")[0].getAttribute("transform"), "translate(0.00 2)");
  const lugar = S.colocarAccesorio({ accesorio: "SOMBRERO", familia: "cactus", nivel: 2, cara: { x: 24, y: 29 } });
  assert.equal(trazo(m, "masc-accesorio-sprite"), P.pixelesD(S.pixelesDeSprite(lugar.filas, lugar.x, lugar.y)));
});

test("el accesorio y el efecto van en un <svg> anidado de 48x64 que recorta, como la pantalla", () => {
  const m = crearMascota("girasol", { accesorio: "SOMBRERO" });
  const r = buscar(m, "masc-recorte")[0];
  assert.equal(r.etiqueta, "svg");
  assert.deepEqual(["x", "y", "width", "height"].map((k) => r.getAttribute(k)), ["0", "0", "48", "64"]);
});
