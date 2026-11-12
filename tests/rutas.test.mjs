import test from "node:test";
import assert from "node:assert/strict";
import { parsearHash, resolver } from "../js/rutas.js";

const tabla = [
  { patron: "/", id: "inicio" },
  { patron: "/plantas", id: "plantas" },
  { patron: "/plantas/nueva", id: "nueva" },
  { patron: "/plantas/:id", id: "planta" },
  { patron: "/admin/usuarios/:id", id: "usuario" },
  { patron: "/admin/dispositivos", id: "dispositivos" },
  { patron: "/vincular", id: "vincular" },
];

test("parsearHash separa ruta y query", () => {
  const { ruta, query } = parsearHash("#/invitacion?token=a-b_c&x=1");
  assert.equal(ruta, "/invitacion");
  assert.equal(query.get("token"), "a-b_c");
});

test("sin hash la ruta es la raíz; quita barra final", () => {
  assert.equal(parsearHash("").ruta, "/");
  assert.equal(parsearHash("#/plantas/").ruta, "/plantas");
});

test("resolver prefiere la ruta literal sobre la parametrizada", () => {
  assert.equal(resolver(tabla, "/plantas/nueva").entrada.id, "nueva");
  const r = resolver(tabla, "/plantas/abc-123");
  assert.equal(r.entrada.id, "planta");
  assert.deepEqual(r.params, { id: "abc-123" });
});

test("resolver devuelve null si nada coincide", () => {
  assert.equal(resolver(tabla, "/nada/por/aqui"), null);
});

test("resolver encuentra la vista de dispositivos de fábrica", () => {
  assert.equal(resolver(tabla, "/admin/dispositivos").entrada.id, "dispositivos");
});

test("resolver encuentra /vincular y parsearHash conserva el serial del QR", () => {
  const { ruta, query } = parsearHash("#/vincular?serial=fito-7K2M9Q");
  assert.equal(resolver(tabla, ruta).entrada.id, "vincular");
  assert.equal(query.get("serial"), "fito-7K2M9Q");
});

test("enlace corto: el código pasa a mayúsculas y lleva el prefijo fito-", async () => {
  const { destinoDeEnlaceCorto } = await import("../js/rutas.js");
  assert.equal(destinoDeEnlaceCorto("7k2m9q"), "/vincular?serial=fito-7K2M9Q");
  assert.equal(destinoDeEnlaceCorto("7K2M9Q"), "/vincular?serial=fito-7K2M9Q");
});

test("enlace corto: rechaza códigos vacíos, con símbolos o desmedidos", async () => {
  const { destinoDeEnlaceCorto } = await import("../js/rutas.js");
  for (const malo of ["", "  ", undefined, "ab", "7K2M/9Q", "7K2M9Q&x=1", "A".repeat(13)]) {
    assert.equal(destinoDeEnlaceCorto(malo), null, String(malo));
  }
});

test("resolver encuentra /v/:codigo y entrega el código", () => {
  const t = [...tabla, { patron: "/v/:codigo", id: "corto" }];
  const r = resolver(t, parsearHash("#/v/7K2M9Q").ruta);
  assert.equal(r.entrada.id, "corto");
  assert.deepEqual(r.params, { codigo: "7K2M9Q" });
});
