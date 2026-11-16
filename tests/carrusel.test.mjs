import { test } from "node:test";
import assert from "node:assert/strict";
import { resumenDeRangos, opcionesDeEspecies, cargarOpciones, indiceTrasTecla, indiceMasCercano, desplazamientoParaCentrar } from "../js/componentes/carrusel-estado.js";

const RANGOS = { humedad: { min: 40, max: 70 }, luz: { min: 1000, max: 10000 }, temperatura: { min: 18, max: 27.5 } };

test("el resumen de rangos dice las tres magnitudes con su unidad", () => {
  assert.equal(resumenDeRangos(RANGOS), "Humedad 40–70 % · Luz 1.000–10.000 lux · 18–27,5 °C");
  assert.equal(resumenDeRangos(null), "");
});

test("la lista sale de la API, en su orden, con la familia de cada una", async () => {
  const api = async () => [
    { nombre: "girasol", rangos: RANGOS },
    { nombre: "orquidea", rangos: RANGOS },
    { nombre: "atrapamoscas", rangos: RANGOS },
  ];
  const opciones = await cargarOpciones(api);
  assert.deepEqual(opciones.map((o) => [o.valor, o.familia]), [["girasol", "girasol"], ["orquidea", "generica"], ["atrapamoscas", "carnivora"]]);
  assert.ok(opciones.every((o) => !o.descontinuada && o.resumen));
});

test("sin especies en la API no hay tarjetas: nada escrito a mano", async () => {
  assert.deepEqual(await cargarOpciones(async () => []), []);
  assert.deepEqual(opcionesDeEspecies(null), []);
});

test("si la API falla, el error sale para que la vista lo muestre", async () => {
  await assert.rejects(cargarOpciones(async () => { throw new Error("sin red"); }), /sin red/);
});

test("la especie actual descontinuada va primero y marcada; si sigue activa no se repite", () => {
  const api = [{ nombre: "cactus", rangos: RANGOS }];
  const con = opcionesDeEspecies(api, { actual: "lavanda" });
  assert.deepEqual(con.map((o) => [o.valor, o.descontinuada]), [["lavanda", true], ["cactus", false]]);
  assert.equal(opcionesDeEspecies(api, { actual: "cactus" }).length, 1);
});

test("teclado: flechas sin dar la vuelta, Home y End; otras teclas no son del carrusel", () => {
  assert.equal(indiceTrasTecla(0, "ArrowRight", 5), 1);
  assert.equal(indiceTrasTecla(4, "ArrowRight", 5), 4);
  assert.equal(indiceTrasTecla(0, "ArrowLeft", 5), 0);
  assert.equal(indiceTrasTecla(3, "ArrowUp", 5), 2);
  assert.equal(indiceTrasTecla(2, "Home", 5), 0);
  assert.equal(indiceTrasTecla(2, "End", 5), 4);
  assert.equal(indiceTrasTecla(-1, "ArrowRight", 5), 0);
  assert.equal(indiceTrasTecla(2, "a", 5), null);
  assert.equal(indiceTrasTecla(0, "ArrowRight", 0), null);
});

test("al soltar, gana la tarjeta más cercana al centro; centrar no se pasa de los bordes", () => {
  assert.equal(indiceMasCercano([100, 300, 500], 320), 1);
  assert.equal(indiceMasCercano([], 10), -1);
  assert.equal(desplazamientoParaCentrar(600, 200, 400, 1000), 500);
  assert.equal(desplazamientoParaCentrar(10, 200, 400, 1000), 0);
  assert.equal(desplazamientoParaCentrar(2000, 200, 400, 1000), 1000);
});
