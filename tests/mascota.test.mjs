import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.document = undefined; // ui.js se importa sin DOM; solo se usan las funciones puras
const { hojaPuntiaguda } = await import("../js/componentes/mascota.js");

test("hojaPuntiaguda sale de la base y llega a la punta en la dirección pedida", () => {
  const d = hojaPuntiaguda(24, 46, -90, 20, 3);
  assert.ok(d.startsWith("M24 46Q"));
  assert.match(d, / 24 26Q/, "hacia arriba, la punta está 20 más arriba");
  assert.ok(d.endsWith(" 24 46Z"));
});
