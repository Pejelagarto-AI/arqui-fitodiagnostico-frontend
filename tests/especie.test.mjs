import test from "node:test";
import assert from "node:assert/strict";
import { familiaDe, cambiaElDibujo, CLAVES_DE_FAMILIA, FAMILIAS } from "../js/componentes/especie.js";

test("familiaDe usa las claves del firmware (D110): cada una lleva a su familia", () => {
  const casos = {
    atrapamoscas: "carnivora", "Atrapamoscas gigante": "carnivora", "carnivora": "carnivora", "Planta carnivora": "carnivora",
    girasol: "girasol", "Girasol enano": "girasol", GIRASOL: "girasol",
    cactus: "cactus", "Cacto de San Pedro": "cactus",
    suculenta: "suculenta", "Echeveria elegans": "suculenta",
    helecho: "helecho", "Helecho de Boston": "helecho",
  };
  for (const [nombre, familia] of Object.entries(casos)) assert.equal(familiaDe(nombre), familia, nombre);
});

test("familiaDe NO quita tildes, igual que pantalla.cpp (tolower solo toca A-Z): «carnívora» y «echevéria» no coinciden", () => {
  // En el firmware el nombre llega en UTF-8 y la tilde es un byte que `tolower` deja igual: «carní» no contiene «carniv».
  // Antes (F41) el front las quitaba y la app dibujaba una carnívora donde la matera dibujaba la planta común.
  assert.equal(familiaDe("Planta carnívora"), "generica");
  assert.equal(familiaDe("echevéria"), "generica");
  assert.equal(familiaDe("Atrapamoscas"), "carnivora", "la del catálogo no lleva tilde: sigue siendo carnívora");
  assert.equal(familiaDe("CARNIVORA"), "carnivora", "mayúsculas A-Z sí se igualan");
  assert.equal(familiaDe("ÁRBOL GIRASOL"), "girasol", "una tilde mayúscula en otra parte del nombre no estorba");
});

test("las cinco especies del catálogo (D118) caen cada una en su familia", () => {
  assert.deepEqual(["girasol", "cactus", "suculenta", "helecho", "atrapamoscas"].map(familiaDe), ["girasol", "cactus", "suculenta", "helecho", "carnivora"]);
});

test("cambiaElDibujo compara familias, no especies", () => {
  assert.equal(cambiaElDibujo("girasol", "cactus"), true);
  assert.equal(cambiaElDibujo("Girasol enano", "girasol"), false);
  assert.equal(cambiaElDibujo("rosa", "orquidea"), false, "dos desconocidas son la genérica las dos");
  assert.equal(cambiaElDibujo("rosa", "helecho"), true);
  assert.equal(cambiaElDibujo(null, "atrapamoscas"), true);
});

test("familiaDe cae en la genérica sin coincidencia, con vacío o con algo que no es texto", () => {
  for (const nombre of ["potos", "orquidea", "rosa del desierto", "", null, undefined, 42, {}]) assert.equal(familiaDe(nombre), "generica", String(nombre));
});

test("familiaDe: gana la primera clave de la tabla, como en el firmware", () => {
  assert.equal(familiaDe("cactus carnivoro"), "carnivora");
  assert.equal(familiaDe("helecho suculenta"), "suculenta");
  assert.equal(familiaDe("cactus girasol"), "girasol", "gana el orden de la tabla, no el del nombre");
});

test("la tabla de claves es la del firmware, en su orden, y toda familia tiene dibujo", () => {
  assert.deepEqual(CLAVES_DE_FAMILIA.map(([clave]) => clave), ["atrapamoscas", "carniv", "girasol", "cactus", "cacto", "suculenta", "echeveria", "helecho"]);
  for (const [, familia] of CLAVES_DE_FAMILIA) assert.ok(FAMILIAS.includes(familia), familia);
  assert.ok(FAMILIAS.includes("generica"));
});
