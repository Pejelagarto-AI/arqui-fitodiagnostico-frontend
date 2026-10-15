import test from "node:test";
import assert from "node:assert/strict";
import { parsearHash, resolver } from "../js/rutas.js";

const tabla = [
  { patron: "/", id: "inicio" },
  { patron: "/plantas", id: "plantas" },
  { patron: "/plantas/nueva", id: "nueva" },
  { patron: "/plantas/:id", id: "planta" },
  { patron: "/admin/usuarios/:id", id: "usuario" },
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
