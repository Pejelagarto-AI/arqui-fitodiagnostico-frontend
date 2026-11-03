// formatearFechaRelativa: hoy, ayer, día de la semana y fecha completa. `ahora` se inyecta.
import test from "node:test";
import assert from "node:assert/strict";
import { formatearFechaRelativa } from "../js/ui.js";

const ahora = new Date(2026, 10, 3, 17, 0).getTime(); // 3 nov 2026, 5:00 p. m. (hora local)
const iso = (...partes) => new Date(...partes).toISOString();

test("el mismo día dice «hoy» con la hora", () => {
  assert.match(formatearFechaRelativa(iso(2026, 10, 3, 16, 33), ahora), /^hoy 4:33\sp\.\sm\.$/);
});

test("el día anterior dice «ayer», incluso cruzando la medianoche", () => {
  assert.match(formatearFechaRelativa(iso(2026, 10, 2, 23, 50), ahora), /^ayer 11:50\sp\.\sm\.$/);
});

test("entre 2 y 6 días usa el día de la semana abreviado", () => {
  assert.match(formatearFechaRelativa(iso(2026, 9, 30, 9, 5), ahora), /^vie\.? ?9:05\sa\.\sm\.$/i);
});

test("con más de una semana muestra la fecha completa", () => {
  assert.match(formatearFechaRelativa(iso(2026, 9, 10, 9, 5), ahora), /2026/);
});

test("vacío o inválido no revienta", () => {
  assert.equal(formatearFechaRelativa(null, ahora), "");
  assert.equal(formatearFechaRelativa("no-es-fecha", ahora), "no-es-fecha");
});
