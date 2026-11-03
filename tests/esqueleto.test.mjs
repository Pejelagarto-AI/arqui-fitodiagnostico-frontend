// esqueletoSiTarda: el esqueleto nace invisible («espera») y solo se vuelve visible si la carga pasa del umbral.
import { test } from "node:test";
import assert from "node:assert/strict";
import { esqueletoSiTarda, RETRASO_ESQUELETO_MS } from "../js/ui.js";

function nodoFalso() {
  const atributos = new Map();
  return { setAttribute: (k, v) => atributos.set(k, v), removeAttribute: (k) => atributos.delete(k), get: (k) => atributos.get(k) };
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

test("el umbral es de 300 ms", () => {
  assert.equal(RETRASO_ESQUELETO_MS, 300);
});

test("una carga rápida nunca muestra el esqueleto", async () => {
  const nodo = nodoFalso();
  const cancelar = esqueletoSiTarda(nodo, { ms: 30 });
  assert.equal(nodo.get("data-esqueleto"), "espera");
  cancelar();
  assert.equal(nodo.get("data-esqueleto"), undefined);
  await esperar(60);
  assert.equal(nodo.get("data-esqueleto"), undefined, "no debe reaparecer tras cancelar");
});

test("una carga lenta lo hace visible y cancelar lo quita", async () => {
  const nodo = nodoFalso();
  const cancelar = esqueletoSiTarda(nodo, { ms: 20 });
  await esperar(50);
  assert.equal(nodo.get("data-esqueleto"), "visible");
  cancelar();
  cancelar();
  assert.equal(nodo.get("data-esqueleto"), undefined);
});
