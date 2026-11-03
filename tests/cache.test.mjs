import { test } from "node:test";
import assert from "node:assert/strict";
import { leerCache, guardarCache, invalidarCache, sonIguales, alVolver } from "../js/cache.js";

test("guarda, lee e invalida", () => {
  assert.equal(leerCache("planta:1"), undefined);
  guardarCache("planta:1", { apodo: "Lola" });
  assert.deepEqual(leerCache("planta:1"), { apodo: "Lola" });
  invalidarCache();
  assert.equal(leerCache("planta:1"), undefined);
});

test("sonIguales compara el contenido, no la identidad", () => {
  assert.equal(sonIguales([{ id: 1 }], [{ id: 1 }]), true);
  assert.equal(sonIguales([{ id: 1 }], [{ id: 2 }]), false);
});

test("alVolver revalida con foco o red, no en ráfaga, y se puede quitar", () => {
  const oyentes = new Map();
  const objetivo = {
    addEventListener: (n, f) => oyentes.set(n, f),
    removeEventListener: (n) => oyentes.delete(n),
  };
  let reloj = 0;
  let veces = 0;
  const quitar = alVolver(() => { veces += 1; }, { objetivo, ahora: () => reloj, espera: 3000 });
  oyentes.get("focus")();
  assert.equal(veces, 0, "recién abierta: todavía es fresca");
  reloj = 3500;
  oyentes.get("online")();
  assert.equal(veces, 1);
  reloj = 4000;
  oyentes.get("focus")();
  assert.equal(veces, 1, "ráfaga: no repite");
  reloj = 7000;
  oyentes.get("focus")();
  assert.equal(veces, 2);
  quitar();
  assert.equal(oyentes.size, 0);
});
