// retrasar: la petición solo sale si pasa el plazo sin que el usuario deshaga.
import { test } from "node:test";
import assert from "node:assert/strict";
import { retrasar, TIEMPO_DESHACER_MS } from "../js/deshacer.js";

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

test("el plazo está entre 5 y 10 s", () => {
  assert.ok(TIEMPO_DESHACER_MS >= 5000 && TIEMPO_DESHACER_MS <= 10000);
});

test("pasado el plazo ejecuta una sola vez y avisa sin error", async () => {
  let veces = 0;
  let resultado;
  const r = retrasar(async () => { veces += 1; }, { ms: 20, alTerminar: (e) => { resultado = e; } });
  assert.equal(r.pendiente(), true);
  await esperar(60);
  assert.equal(veces, 1);
  assert.equal(resultado, null);
  assert.equal(r.pendiente(), false);
  assert.equal(r.deshacer(), false, "ya salió: no se puede deshacer");
});

test("deshacer a tiempo evita la petición", async () => {
  let veces = 0;
  const r = retrasar(async () => { veces += 1; }, { ms: 30 });
  assert.equal(r.deshacer(), true);
  assert.equal(r.deshacer(), false);
  await esperar(70);
  assert.equal(veces, 0);
});

test("si la petición falla lo cuenta en alTerminar", async () => {
  let recibido;
  retrasar(async () => { throw new Error("boom"); }, { ms: 10, alTerminar: (e) => { recibido = e; } });
  await esperar(50);
  assert.equal(recibido.message, "boom");
});
