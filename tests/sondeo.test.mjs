import test from "node:test";
import assert from "node:assert/strict";
import { crearSondeo, textoActualizado, INTERVALO_SONDEO_MS } from "../js/sondeo.js";

// Documento de mentira: solo lo que usa el sondeo.
function documentoFalso() {
  const oyentes = new Set();
  return {
    visibilityState: "visible",
    addEventListener: (_, fn) => oyentes.add(fn),
    removeEventListener: (_, fn) => oyentes.delete(fn),
    cambiar(estado) {
      this.visibilityState = estado;
      for (const fn of [...oyentes]) fn();
    },
    oyentes: () => oyentes.size,
  };
}

const esperar = () => new Promise((r) => setImmediate(r));

test("consulta cada intervalo y avisa «activo» con la hora del último éxito", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  let llamadas = 0;
  const estados = [];
  const sondeo = crearSondeo({ tarea: async () => { llamadas += 1; }, alCambiar: (e) => estados.push(e.estado), documento: documentoFalso() });
  sondeo.iniciar({ inmediato: false });
  assert.equal(llamadas, 0);
  t.mock.timers.tick(INTERVALO_SONDEO_MS);
  await esperar();
  assert.equal(llamadas, 1);
  t.mock.timers.tick(INTERVALO_SONDEO_MS);
  await esperar();
  assert.equal(llamadas, 2);
  assert.deepEqual(estados, ["activo", "activo"]);
  sondeo.detener();
});

test("pausa con la pestaña oculta, consulta al volver y detener limpia el oyente", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const documento = documentoFalso();
  let llamadas = 0;
  const estados = [];
  const sondeo = crearSondeo({ tarea: async () => { llamadas += 1; }, alCambiar: (e) => estados.push(e.estado), documento });
  sondeo.iniciar({ inmediato: false });
  documento.cambiar("hidden");
  t.mock.timers.tick(INTERVALO_SONDEO_MS * 3);
  await esperar();
  assert.equal(llamadas, 0, "oculta: no debe consultar");
  documento.cambiar("visible");
  t.mock.timers.tick(0);
  await esperar();
  assert.equal(llamadas, 1, "al volver consulta de inmediato");
  assert.deepEqual(estados, ["pausado", "activo"]);
  sondeo.detener();
  assert.equal(documento.oyentes(), 0);
  t.mock.timers.tick(INTERVALO_SONDEO_MS * 3);
  await esperar();
  assert.equal(llamadas, 1, "detenido: no debe consultar");
});

test("un fallo avisa «error» y reintenta con espera creciente; al recuperarse vuelve a «activo»", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  let falla = true;
  let llamadas = 0;
  const estados = [];
  const sondeo = crearSondeo({
    tarea: async () => { llamadas += 1; if (falla) throw Object.assign(new Error("red"), { status: null }); },
    alCambiar: (e) => estados.push(e.estado),
    documento: documentoFalso(),
  });
  sondeo.iniciar();
  t.mock.timers.tick(0);
  await esperar();
  assert.equal(llamadas, 1);
  t.mock.timers.tick(INTERVALO_SONDEO_MS); // la espera tras el primer fallo es el doble
  await esperar();
  assert.equal(llamadas, 1);
  falla = false;
  t.mock.timers.tick(INTERVALO_SONDEO_MS);
  await esperar();
  assert.equal(llamadas, 2);
  assert.deepEqual(estados, ["error", "activo"]);
  sondeo.detener();
});

test("403 y 404 detienen el sondeo sin reintentar", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  let llamadas = 0;
  const estados = [];
  const sondeo = crearSondeo({
    tarea: async () => { llamadas += 1; throw Object.assign(new Error("no"), { status: 404 }); },
    alCambiar: (e) => estados.push(e.estado),
    documento: documentoFalso(),
  });
  sondeo.iniciar();
  t.mock.timers.tick(0);
  await esperar();
  t.mock.timers.tick(INTERVALO_SONDEO_MS * 10);
  await esperar();
  assert.equal(llamadas, 1);
  assert.deepEqual(estados, ["detenido"]);
});

test("no solapa consultas: la siguiente espera a que termine la anterior", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  let llamadas = 0;
  let terminar;
  const sondeo = crearSondeo({
    tarea: () => { llamadas += 1; return new Promise((r) => { terminar = r; }); },
    documento: documentoFalso(),
  });
  sondeo.iniciar();
  t.mock.timers.tick(0);
  t.mock.timers.tick(INTERVALO_SONDEO_MS * 3);
  await esperar();
  assert.equal(llamadas, 1);
  terminar();
  sondeo.detener();
});

test("textoActualizado", () => {
  const t0 = 1_000_000;
  assert.equal(textoActualizado(null), "actualizando…");
  assert.equal(textoActualizado(t0, t0 + 500), "actualizado ahora");
  assert.equal(textoActualizado(t0, t0 + 7000), "actualizado hace 7 s");
  assert.equal(textoActualizado(t0, t0 + 125000), "actualizado hace 2 min");
  assert.equal(textoActualizado(t0, t0 + 3 * 3600000), "actualizado hace 3 h");
});
