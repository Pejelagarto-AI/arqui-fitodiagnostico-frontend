import test from "node:test";
import assert from "node:assert/strict";
import { esCarnivora } from "../js/componentes/especie.js";

test("esCarnivora reconoce atrapamoscas y carnívoras sin importar mayúsculas ni tildes de la palabra clave", () => {
  assert.equal(esCarnivora("atrapamoscas"), true);
  assert.equal(esCarnivora("Atrapamoscas gigante"), true);
  assert.equal(esCarnivora("Planta carnívora"), true);
  assert.equal(esCarnivora("carnivora"), true);
  assert.equal(esCarnivora("potos"), false);
  assert.equal(esCarnivora(""), false);
  assert.equal(esCarnivora(null), false);
});
