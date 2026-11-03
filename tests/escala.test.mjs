// Cálculos puros de la presentación del diagnóstico: escala, porcentaje, serie y recomendaciones.
import test from "node:test";
import assert from "node:assert/strict";
import { escalaDe, porcentaje, numeroLegible, serieDeParametro, recomendacionesPorParametro } from "../js/componentes/escala.js";

test("escalaDe usa la escala física y se ensancha si el valor o el rango se salen", () => {
  assert.deepEqual(escalaDe("humedad", [40, 70], 32), [0, 100]);
  assert.deepEqual(escalaDe("luz", [300, 1200], 5000), [0, 5000]);
  assert.deepEqual(escalaDe("temperatura", [18, 30], -5), [-5, 40]);
});

test("porcentaje acota a 0..100 y no divide por cero", () => {
  assert.equal(porcentaje(50, [0, 100]), 50);
  assert.equal(porcentaje(-3, [0, 100]), 0);
  assert.equal(porcentaje(300, [0, 100]), 100);
  assert.equal(porcentaje(5, [3, 3]), 0);
});

test("numeroLegible quita ceros sobrantes", () => {
  assert.equal(numeroLegible(40), "40");
  assert.equal(numeroLegible(7.56), "7.6");
});

const registro = (id, humedad) => ({ id, diagnostico: { parametros: [{ nombre: "humedad", valor: humedad }] } });

test("serieDeParametro invierte el orden (viejo primero) y respeta el máximo", () => {
  const pagina = [registro("c", 30), registro("b", 20), registro("a", 10)];
  assert.deepEqual(serieDeParametro(pagina, "humedad"), [10, 20, 30]);
  assert.deepEqual(serieDeParametro(pagina, "humedad", 2), [20, 30]);
  assert.deepEqual(serieDeParametro(pagina, "luz"), []);
  assert.deepEqual(serieDeParametro(null, "humedad"), []);
});

test("recomendacionesPorParametro asocia por orden solo si las cuentas coinciden", () => {
  const parametros = [
    { nombre: "humedad", estado: "BAJO" },
    { nombre: "luz", estado: "OPTIMO" },
    { nombre: "temperatura", estado: "ALTO" },
  ];
  assert.deepEqual(recomendacionesPorParametro(parametros, ["a", "b"]), [
    { texto: "a", parametro: "humedad" },
    { texto: "b", parametro: "temperatura" },
  ]);
  assert.deepEqual(recomendacionesPorParametro(parametros, ["solo una"]), [{ texto: "solo una", parametro: null }]);
});
