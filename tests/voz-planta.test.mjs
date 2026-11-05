import { test } from "node:test";
import assert from "node:assert/strict";
import { fraseDePlanta, textoDeRangoIdeal, AYUDA_DE_MAGNITUD } from "../js/voz-planta.js";

const d = (h, l, t) => ({ parametros: [{ nombre: "humedad", estado: h }, { nombre: "luz", estado: l }, { nombre: "temperatura", estado: t }] });

test("todo en rango: la planta está bien", () => {
  assert.equal(fraseDePlanta(d("OPTIMO", "OPTIMO", "OPTIMO")), "Estoy bien. Hoy no necesito nada.");
});

test("una sola queja", () => {
  assert.equal(fraseDePlanta(d("BAJO", "OPTIMO", "OPTIMO")), "Tengo sed.");
  assert.equal(fraseDePlanta(d("ALTO", "OPTIMO", "OPTIMO")), "Tengo demasiada agua.");
  assert.equal(fraseDePlanta(d("OPTIMO", "BAJO", "OPTIMO")), "Me falta luz.");
  assert.equal(fraseDePlanta(d("OPTIMO", "OPTIMO", "ALTO")), "Tengo calor.");
});

test("dos y tres quejas se unen como habla una persona", () => {
  assert.equal(fraseDePlanta(d("BAJO", "BAJO", "OPTIMO")), "Tengo sed y me falta luz.");
  assert.equal(fraseDePlanta(d("BAJO", "ALTO", "BAJO")), "Tengo sed, me da demasiada luz y tengo frío.");
});

test("sin diagnóstico o con datos raros no revienta", () => {
  assert.equal(fraseDePlanta(null), "Todavía no sé cómo estoy.");
  assert.equal(fraseDePlanta({}), "Todavía no sé cómo estoy.");
  assert.equal(fraseDePlanta({ parametros: [{ nombre: "ph", estado: "BAJO" }] }), "Estoy bien. Hoy no necesito nada.");
});

test("el rango ideal se dice con el nombre de la planta", () => {
  assert.equal(textoDeRangoIdeal({ min: 40, max: 70, unidad: "%" }, "potos"), "Para un potos lo ideal es de 40 a 70 %.");
  assert.equal(textoDeRangoIdeal({ min: 1000, max: 3000, unidad: "lux" }, "lavanda"), "Para una lavanda lo ideal es de 1000 a 3000 lux.");
  assert.equal(textoDeRangoIdeal({ min: 15, max: 32, unidad: "°C" }), "Para esta planta lo ideal es de 15 a 32 °C.");
  assert.equal(textoDeRangoIdeal(null, "potos"), "");
});

test("cada magnitud tiene su ayuda, y la de la luz trae un ejemplo cotidiano", () => {
  assert.deepEqual(Object.keys(AYUDA_DE_MAGNITUD), ["humedad", "luz", "temperatura"]);
  assert.match(AYUDA_DE_MAGNITUD.luz, /300 a 500 lux/);
});
