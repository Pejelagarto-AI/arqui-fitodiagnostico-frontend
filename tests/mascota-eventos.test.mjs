// F56: la cola de eventos de la mascota y los tiempos de sus animaciones (js/mascota-eventos.js), con los mismos guiones a
// mano y el mismo modelo al azar que `firmware/test/probar_nucleo.py` (sección 10 del backend, fase 14).
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../js/mascota-eventos.js";

// Como el `arnes cola`: cada paso es "<ms>" o "<ms>+<tipo>,<tipo>..." (números de FITO_EV_*); imprime "tipo:ms/fila".
function cola(hay, pasos, base = 0) {
  const q = E.crearCola(base);
  const salida = [];
  for (const paso of pasos) {
    const [ms, tipos = ""] = paso.split("+");
    const ahora = (base + Number(ms)) >>> 0;
    for (const t of tipos.split(",").filter((x) => x !== "")) q.empujar(E.EVENTOS_DE_MASCOTA[Number(t)]);
    const a = q.avanzar(ahora);
    salida.push(a ? `${E.EVENTOS_DE_MASCOTA.indexOf(a.tipo)}:${a.t}/${q.fila(ahora, hay)}` : `-:0/${q.fila(ahora, hay)}`);
  }
  return `${salida.join(" ")} descartados=${q.descartados} esperando=${q.esperando}`;
}

test("la cola: sin eventos la fila alterna cada 3 s y empieza por el estado", () => {
  assert.equal(cola(1, ["0", "2999", "3000", "5999", "6000", "9000"]), "-:0/0 -:0/0 -:0/1 -:0/1 -:0/0 -:0/1 descartados=0 esperando=0");
});

test("la cola: sin mascota (servidor viejo) siempre es el estado", () => {
  assert.equal(cola(0, ["0", "3000", "9000"]), "-:0/0 -:0/0 -:0/0 descartados=0 esperando=0");
});

test("la cola: un evento ocupa su turno de 3 s y vuelve al ciclo por el estado", () => {
  assert.equal(cola(1, ["1000+4", "3999", "4000", "6999", "7000"]), "4:0/2 4:2999/2 -:0/0 -:0/0 -:0/1 descartados=0 esperando=0");
});

test("la cola: tres eventos de a uno, en el orden en que llegaron", () => {
  assert.equal(cola(1, ["0+0,1,4", "2999", "3000", "5999", "6000", "8999", "9000", "12000"]),
    "0:0/2 0:2999/2 1:0/2 1:2999/2 4:0/2 4:2999/2 -:0/0 -:0/1 descartados=0 esperando=0");
});

test("la cola: RIEGO_DECLARADO y los tipos desconocidos no entran y no estorban", () => {
  assert.equal(cola(1, ["0+6,-1,9,42", "100"]), "-:0/0 -:0/0 descartados=0 esperando=0");
  assert.equal(cola(1, ["0+6,7,6,-1,8", "3000"]), "7:0/2 8:0/2 descartados=0 esperando=0");
  const q = E.crearCola(0);
  assert.equal(q.empujar("RIEGO_DECLARADO"), false);
  assert.equal(q.empujar("TERREMOTO"), false);
  assert.equal(q.empujar("REGADA"), true);
});

test("la cola: un bucle lento no recupera el tiempo perdido", () => {
  assert.equal(cola(1, ["0+0,1", "10000", "12999", "13000"]), "0:0/2 1:0/2 1:2999/2 -:0/0 descartados=0 esperando=0");
});

test("la cola: diez de golpe suenan en orden, 3 s cada uno (30 s), y no se pierde ninguno", () => {
  const diez = [0, 1, 2, 3, 4, 5, 7, 8, 0, 1];
  const pasos = [`0+${diez.join(",")}`];
  for (let k = 0; k < 10; k++) pasos.push(String(3000 * k), String(3000 * k + 2999));
  pasos.push("30000", "33000");
  const salida = cola(1, pasos).split(" ");
  const sonaron = Array.from({ length: 10 }, (_, k) => Number(salida[1 + 2 * k].split(":")[0]));
  assert.deepEqual(sonaron, diez);
  assert.equal(salida.at(-5), "1:2999/2");
  assert.equal(salida.slice(-4, -2).join(" "), "-:0/0 -:0/1");
  assert.equal(salida.slice(-2).join(" "), "descartados=0 esperando=0");
});

test("la cola: once de golpe, se pierde el más antiguo (y se cuenta); mientras suena uno, el que suena no se corta", () => {
  const diez = [0, 1, 2, 3, 4, 5, 7, 8, 0, 1];
  const once = [...diez, 2];
  assert.equal(cola(1, [`0+${once.join(",")}`]).split(" ")[0], "1:0/2", "el primero se perdió: suena el segundo");
  assert.equal(cola(1, [`0+${once.join(",")}`]).split(" ").slice(1).join(" "), "descartados=1 esperando=9");
  assert.equal(cola(1, ["0+5", `100+${diez.join(",")}`]), "5:0/2 5:100/2 descartados=0 esperando=10");
  assert.equal(cola(1, ["0+5", `100+${once.join(",")}`]).split(" ").slice(1).join(" "), "5:100/2 descartados=1 esperando=10");
});

test("la cola: el reloj que da la vuelta (uint32) no cambia lo que se ve", () => {
  const guion = ["0+4,1", "2999", "3000", "5999", "6000", "9000"];
  assert.equal(cola(1, guion), cola(1, guion, 2 ** 32 - 400));
});

// El modelo independiente de probar_nucleo.py (lista en vez de anillo), con guiones al azar de un generador con semilla.
function modelo(hay, pasos, base) {
  const espera = [];
  let activo = null, desde = 0, ciclo = base >>> 0, desc = 0;
  const salida = [];
  for (const [ms, tipos] of pasos) {
    const ahora = (base + ms) >>> 0;
    for (const t of tipos) {
      if (t < 0 || t > 8 || t === 6) continue;
      if (espera.length === 10) { espera.shift(); desc += 1; }
      espera.push(t);
    }
    if (activo !== null && ((ahora - desde) >>> 0) >= 3000) { activo = null; ciclo = ahora; }
    if (activo === null && espera.length) { activo = espera.shift(); desde = ahora; }
    const fila = activo !== null ? 2 : hay ? Math.floor(((ahora - ciclo) >>> 0) / 3000) % 2 : 0;
    salida.push(activo !== null ? `${activo}:${(ahora - desde) >>> 0}/${fila}` : `-:0/${fila}`);
  }
  return `${salida.join(" ")} descartados=${desc} esperando=${espera.length}`;
}

function generador(semilla) { // mulberry32
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("la cola contra un modelo independiente: 60 guiones al azar de 40 pasos", () => {
  const azar = generador(14);
  const elegir = (lista) => lista[Math.floor(azar() * lista.length)];
  for (let i = 0; i < 60; i++) {
    const base = elegir([0, 1000, 2 ** 32 - 5000, 2 ** 32 - 1]);
    const hay = elegir([0, 1, 1]);
    let t = 0;
    const pasos = [];
    for (let k = 0; k < 40; k++) {
      t += elegir([0, 16, 50, 500, 2999, 3000, 3001, 7000]);
      const tipos = Array.from({ length: elegir([0, 0, 0, 1, 2, 4, 11]) }, () => elegir([-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
      pasos.push([t, tipos]);
    }
    const texto = pasos.map(([ms, tipos]) => `${ms}${tipos.length ? `+${tipos.join(",")}` : ""}`);
    assert.equal(cola(hay, texto, base), modelo(hay, pasos, base), `guion ${i}`);
  }
});

test("el reproductor: avanzar dos veces en el mismo instante no cambia nada y cada arranque trae un turno nuevo", () => {
  let ahora = 5000;
  const r = E.crearReproductor({ reloj: () => ahora });
  assert.equal(r.avanzar(), null);
  r.empujar("ACARICIADA");
  r.empujar("RACHA");
  ahora = 5100;
  const a = r.avanzar();
  assert.deepEqual({ ...r.avanzar() }, { ...a });
  assert.equal(a.tipo, "ACARICIADA");
  ahora = 8100;
  const b = r.avanzar();
  assert.equal(b.tipo, "RACHA");
  assert.equal(b.turno, a.turno + 1);
  assert.equal(r.fila(true), E.FILA_EVENTO);
  ahora = 11100;
  assert.equal(r.avanzar(), null);
  assert.equal(r.fila(true), E.FILA_ESTADO);
  ahora = 14100;
  assert.equal(r.fila(true), E.FILA_ANIMO);
});

test("los cuadros de rayos, corazón, destellos y estrella: ms por cuadro, cuadros por vuelta y vueltas", () => {
  for (const [tipo, ms, cuadros, vueltas] of [["SALIO_AL_SOL", 250, 3, 2], ["ACARICIADA", 300, 2, 3], ["REVIVIO", 200, 3, 2], ["RACHA", 300, 3, 2]]) {
    const total = ms * cuadros * vueltas;
    assert.equal(E.animacionMs(tipo), total, tipo);
    for (let t = 0; t < total; t += 50) assert.equal(E.efectoDe(tipo, t).cuadro, Math.floor(t / ms) % cuadros, `${tipo} a ${t}`);
    assert.equal(E.efectoDe(tipo, total - 1).cuadro, (cuadros - 1), `${tipo} último cuadro`);
    assert.equal(E.efectoDe(tipo, total), null, `${tipo} ya terminó`);
    assert.ok(total <= E.FRASE_EVENTO_MS, `${tipo} cabe en su turno`);
  }
  assert.equal(E.efectoDe("REGADA", 0), null);
  assert.equal(E.efectoDe("DESMAYO", 0), null);
  assert.deepEqual([E.RAYOS_MS, E.CORAZON_MS, E.DESTELLOS_MS, E.ESTRELLA_MS, E.DESMAYO_MS], [1500, 1800, 1200, 1800, 600]);
});

test("el desmayo: cae 0 0 1 1 2 2 px en 600 ms y queda 2 px abajo; las duraciones de la parte animada", () => {
  const esperado = [0, 0, 1, 1, 2, 2];
  for (let k = 0; k < 6; k++) for (const t of [100 * k, 100 * k + 99]) assert.equal(E.desmayoDy(t), esperado[k], `t=${t}`);
  assert.equal(E.desmayoDy(600), 2);
  assert.equal(E.desmayoDy(100000), E.DESMAYADA_DY);
  for (const tipo of ["REGADA", "RIEGO_CONFIRMADO", "RIEGO_DESMENTIDO", "RIEGO_DECLARADO", "NUEVO"]) assert.equal(E.animacionMs(tipo), 0, tipo);
  assert.equal(E.animacionMs("DESMAYO"), 600);
  assert.ok(E.haceSaludo("ACARICIADA") && E.haceSaludo("REVIVIO") && !E.haceSaludo("RACHA") && !E.haceSaludo("DESMAYO"));
});

test("la barra de vitalidad: (v * 78 + 50) / 100 y fuera de rango se recorta", () => {
  assert.equal(E.barraPx(0, 78), 0);
  assert.equal(E.barraPx(100, 78), 78);
  assert.equal(E.barraPx(64, 78), 50); // (64*78+50)/100 = 50
  assert.equal(E.barraPx(-5, 78), 0);
  assert.equal(E.barraPx(300, 78), 78);
});

test("las caricias propias: el eco con el mismo id no anima otra vez, llegue antes o después de la respuesta", () => {
  const r = E.crearRegistroDeCaricias();
  // la respuesta llega antes que el aviso
  r.empezar();
  r.terminar("abc");
  assert.equal(r.esEco("abc", "PERSONA"), true);
  assert.equal(r.esEco("otra", "PERSONA"), false, "una caricia ajena sí anima");
  // el aviso llega antes que la respuesta
  r.empezar();
  assert.equal(r.esEco("xyz", "PERSONA"), true);
  r.terminar("xyz");
  assert.equal(r.esEco("xyz", "PERSONA"), true);
  // una caricia de la matera nunca es eco, ni en vuelo
  r.empezar();
  assert.equal(r.esEco("m1", "MATERA"), false);
  r.terminar(null); // 200 repetida: sin id
  assert.equal(r.esEco("m1", "MATERA"), false);
});
