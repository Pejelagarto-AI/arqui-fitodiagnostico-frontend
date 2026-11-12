// Partes puras del QR del sticker: la URL que codifica y el trazo del SVG.
import { test } from "node:test";
import assert from "node:assert/strict";
globalThis.document = undefined; // ui.js se importa sin DOM; solo se usan las funciones puras
const { urlDeVinculacion, rutaDeModulos } = await import("../js/componentes/qr.js");

test("la URL del sticker es absoluta y lleva el serial", () => {
  assert.equal(urlDeVinculacion("fito-7K2M9Q", "http://localhost:5500", "/"), "http://localhost:5500/#/vincular?serial=fito-7K2M9Q");
  assert.equal(urlDeVinculacion("a b", "https://x.co", "/app/"), "https://x.co/app/#/vincular?serial=a%20b");
});

test("rutaDeModulos dibuja un cuadrado por módulo oscuro, con zona quieta de 4", () => {
  const oscuro = (f, c) => f === c; // diagonal de 3x3
  assert.equal(rutaDeModulos(oscuro, 3), "M4 4h1v1h-1zM5 5h1v1h-1zM6 6h1v1h-1z");
  assert.equal(rutaDeModulos(() => false, 3), "");
});
