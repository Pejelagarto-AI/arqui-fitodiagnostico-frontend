import test from "node:test";
import assert from "node:assert/strict";
import { esCarnivora, familiaDe, CLAVES_DE_FAMILIA, FAMILIAS } from "../js/componentes/especie.js";

test("esCarnivora reconoce atrapamoscas y carnívoras sin importar mayúsculas ni tildes de la palabra clave", () => {
  assert.equal(esCarnivora("atrapamoscas"), true);
  assert.equal(esCarnivora("Atrapamoscas gigante"), true);
  assert.equal(esCarnivora("Planta carnívora"), true);
  assert.equal(esCarnivora("carnivora"), true);
  assert.equal(esCarnivora("potos"), false);
  assert.equal(esCarnivora(""), false);
  assert.equal(esCarnivora(null), false);
});

test("familiaDe usa las claves del firmware (D110): cada una lleva a su familia", () => {
  const casos = {
    atrapamoscas: "carnivora", "Planta carnívora": "carnivora",
    girasol: "girasol", "Girasol enano": "girasol",
    cactus: "cactus", "Cacto de San Pedro": "cactus",
    suculenta: "suculenta", "Echeveria elegans": "suculenta", "echevéria": "suculenta",
    helecho: "helecho", "Helecho de Boston": "helecho",
  };
  for (const [nombre, familia] of Object.entries(casos)) assert.equal(familiaDe(nombre), familia, nombre);
});

test("familiaDe cae en la genérica sin coincidencia, con vacío o con algo que no es texto", () => {
  for (const nombre of ["potos", "orquidea", "rosa del desierto", "", null, undefined, 42]) assert.equal(familiaDe(nombre), "generica", String(nombre));
});

test("familiaDe: gana la primera clave de la tabla, como en el firmware", () => {
  assert.equal(familiaDe("cactus carnivoro"), "carnivora");
  assert.equal(familiaDe("helecho suculenta"), "suculenta");
});

test("la tabla de claves es la del firmware, en su orden, y toda familia tiene dibujo", () => {
  assert.deepEqual(CLAVES_DE_FAMILIA.map(([clave]) => clave), ["atrapamoscas", "carniv", "girasol", "cactus", "cacto", "suculenta", "echeveria", "helecho"]);
  for (const [, familia] of CLAVES_DE_FAMILIA) assert.ok(FAMILIAS.includes(familia), familia);
  assert.ok(FAMILIAS.includes("generica"));
});
