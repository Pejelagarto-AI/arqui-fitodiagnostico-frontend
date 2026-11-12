import test from "node:test";
import assert from "node:assert/strict";
import { textoHace, estadoDeDispositivo } from "../js/tiempo.js";

const ahora = Date.parse("2026-11-03T12:00:00Z");

test("textoHace pasa de segundos a minutos y horas", () => {
  assert.equal(textoHace("2026-11-03T11:59:56Z", ahora), "hace 4 s");
  assert.equal(textoHace("2026-11-03T11:57:00Z", ahora), "hace 3 min");
  assert.equal(textoHace("2026-11-03T09:00:00Z", ahora), "hace 3 h");
  assert.equal(textoHace("2026-11-03T12:00:05Z", ahora), "hace 0 s", "un reloj adelantado no da negativos");
});

test("sin ultimaCredencialEn el dispositivo está esperando; con ella, conectado", () => {
  assert.equal(estadoDeDispositivo({ serial: "fito-7K2M9Q" }, ahora), "esperando que se conecte");
  assert.equal(estadoDeDispositivo({ ultimaCredencialEn: null }, ahora), "esperando que se conecte");
  assert.equal(estadoDeDispositivo({ ultimaCredencialEn: "2026-11-03T11:59:57Z" }, ahora), "conectado hace 3 s");
});
