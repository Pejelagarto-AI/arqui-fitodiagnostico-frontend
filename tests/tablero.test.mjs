import { test } from "node:test";
import assert from "node:assert/strict";
import { cuentaPorEstado, pasaElFiltro, filtroVigente, plegar, claveDeLectura } from "../js/tablero.js";

const datos = (estado) => ({ tipo: "datos", registro: { diagnostico: { estado } } });
const plantas = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }];
const lecturas = new Map([["a", datos("SALUDABLE")], ["b", datos("CRITICO")], ["c", { tipo: "vacio" }], ["d", { tipo: "fallo" }]]);

test("el resumen cuenta por estado; sin lectura o con fallo van a «sin»; lo que no ha llegado no cuenta", () => {
  assert.deepEqual(cuentaPorEstado(plantas, lecturas), { total: 5, SALUDABLE: 1, EN_RIESGO: 0, CRITICO: 1, SIN: 2 });
  assert.equal(claveDeLectura(undefined), null);
});

test("el filtro deja ver solo las plantas de ese estado, y «total» las deja todas", () => {
  assert.equal(pasaElFiltro(lecturas.get("b"), "CRITICO"), true);
  assert.equal(pasaElFiltro(lecturas.get("a"), "CRITICO"), false);
  assert.equal(pasaElFiltro(lecturas.get("c"), "SIN"), true);
  assert.equal(pasaElFiltro(undefined, "total"), true);
  assert.equal(pasaElFiltro(undefined, "SALUDABLE"), false);
});

test("un filtro que se queda sin plantas vuelve a mostrar todas", () => {
  const cuenta = cuentaPorEstado(plantas, lecturas);
  assert.equal(filtroVigente("CRITICO", cuenta), "CRITICO");
  assert.equal(filtroVigente("EN_RIESGO", cuenta), "total");
  assert.equal(filtroVigente("cualquiera", cuenta), "total");
});

test("«Qué hacer hoy» muestra los tres primeros y pliega el resto, salvo que sobre uno solo", () => {
  assert.deepEqual(plegar([1, 2, 3]), { visibles: [1, 2, 3], plegados: [] });
  assert.deepEqual(plegar([1, 2, 3, 4]), { visibles: [1, 2, 3, 4], plegados: [] });
  assert.deepEqual(plegar([1, 2, 3, 4, 5]), { visibles: [1, 2, 3], plegados: [4, 5] });
});
