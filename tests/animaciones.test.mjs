// interpolar debe ser interrumpible: la segunda animación parte del valor vivo de la primera.
import { test } from "node:test";
import assert from "node:assert/strict";

const llamadas = [];
globalThis.matchMedia = () => ({ matches: false });
globalThis.gsap = {
  to(proxy, vars) {
    const tween = { proxy, vars, muerto: false, kill() { this.muerto = true; } };
    llamadas.push(tween);
    return tween;
  },
};
const { interpolar } = await import("../js/animaciones.js");

test("al interrumpir, la nueva animación arranca del valor actual y no del destino anterior", () => {
  const clave = {};
  const vistos = [];
  assert.equal(interpolar(clave, { caida: 0 }, { caida: 22 }, (v) => vistos.push(v)), true);
  const primera = llamadas.at(-1);
  primera.proxy.caida = 9; // la animación va por la mitad
  assert.equal(interpolar(clave, { caida: 22 }, { caida: 0 }, (v) => vistos.push(v)), true);
  const segunda = llamadas.at(-1);
  assert.equal(primera.muerto, true, "la anterior se mata");
  assert.equal(segunda.proxy.caida, 9, "parte de 9, no de 22");
  assert.equal(segunda.vars.caida, 0);
});

test("sin animación previa parte de `desde`", () => {
  assert.equal(interpolar({}, { x: 3 }, { x: 5 }, () => {}), true);
  assert.equal(llamadas.at(-1).proxy.x, 3);
});
