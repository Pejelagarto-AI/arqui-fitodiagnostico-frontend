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

import { recomendacionEnPalabras } from "../js/voz-planta.js";

test("la recomendación del servidor se parte en la acción y el porqué, con las palabras de la app", () => {
  const humedad = { nombre: "humedad", valor: 30, unidad: "%", rangoOptimo: [40, 70], estado: "BAJO" };
  assert.deepEqual(
    recomendacionEnPalabras("Humedad del sustrato 30 % por debajo del rango óptimo 40–70 %: regar moderadamente.", humedad),
    { accion: "Regar moderadamente.", detalle: "La tierra está en 30 %; lo ideal es de 40 a 70 %." },
  );
  const luz = { nombre: "luz", valor: 800, unidad: "lux", rangoOptimo: [3000, 20000], estado: "BAJO" };
  assert.deepEqual(
    recomendacionEnPalabras("Luz 800 lux por debajo del rango óptimo 3000–20000 lux: acercar a una fuente de luz.", luz),
    { accion: "Acercar a una fuente de luz.", detalle: "Le llegan 800 lux; lo ideal es de 3000 a 20000 lux." },
  );
  const calor = { nombre: "temperatura", valor: 36.25, unidad: "°C", rangoOptimo: [15, 32], estado: "ALTO" };
  assert.equal(recomendacionEnPalabras("Temperatura 36.25 °C por encima del rango óptimo 15–32 °C: alejar del calor.", calor).detalle, "Está a 36.3 °C; lo ideal es de 15 a 32 °C.");
});

test("si no se sabe de qué parámetro es o el texto tiene otra forma, se deja tal cual", () => {
  assert.deepEqual(recomendacionEnPalabras("Revisar la planta.", null), { accion: "Revisar la planta.", detalle: "" });
  assert.deepEqual(recomendacionEnPalabras("Sin dos puntos", { nombre: "humedad", valor: 1, unidad: "%", rangoOptimo: [2, 3] }), { accion: "Sin dos puntos", detalle: "" });
  assert.deepEqual(recomendacionEnPalabras("ph 4 bajo: abonar.", { nombre: "ph", valor: 4, unidad: "", rangoOptimo: [5, 7] }), { accion: "Abonar.", detalle: "" });
});
