// F56: la tabla de frases del front (js/mascota-frases.js) es la de la OLED. La fuente de verdad es
// `firmware/sprites/frases.json` del repo del backend: la ruta se cambia con FRASES_JSON; por defecto es la del checkout
// hermano. Si el archivo no existe la comparación se salta con aviso (el resto de las pruebas corre igual).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import * as F from "../js/mascota-frases.js";
import { ANIMOS, EVENTOS_DE_MASCOTA } from "../js/mascota-eventos.js";
import { FAMILIAS } from "../js/componentes/especie.js";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RUTA = process.env.FRASES_JSON || resolve(RAIZ, "../fitodiagnostico-backend/firmware/sprites/frases.json");

test("la tabla del front es igual, frase por frase, a frases.json del backend", (t) => {
  if (!existsSync(RUTA)) {
    t.skip(`AVISO: no hay ${RUTA}; no se comparó con el JSON del backend (pon FRASES_JSON=ruta)`);
    return;
  }
  const json = JSON.parse(readFileSync(RUTA, "utf8"));
  assert.equal(F.MAXIMO, json.maximo);
  assert.deepEqual(JSON.parse(JSON.stringify(F.ANIMO)), json.animo);
  assert.deepEqual(JSON.parse(JSON.stringify(F.EVENTO)), json.evento);
});

test("la tabla tiene las 6 familias x 11 ánimos y x 8 eventos (sin RIEGO_DECLARADO), ASCII y hasta 13 caracteres", () => {
  assert.deepEqual(Object.keys(F.ANIMO).sort(), [...FAMILIAS].sort());
  assert.deepEqual(Object.keys(F.EVENTO).sort(), [...FAMILIAS].sort());
  for (const familia of FAMILIAS) {
    assert.deepEqual(Object.keys(F.ANIMO[familia]), [...ANIMOS], familia);
    assert.deepEqual(Object.keys(F.EVENTO[familia]), EVENTOS_DE_MASCOTA.filter((e) => e !== "RIEGO_DECLARADO"), familia);
    for (const frase of [...Object.values(F.ANIMO[familia]), ...Object.values(F.EVENTO[familia])]) {
      assert.ok(frase.length > 0 && frase.length <= F.MAXIMO, `${familia}: «${frase}»`);
      assert.match(frase, /^[\x20-\x7e]+$/, `${familia}: «${frase}» ASCII`);
    }
  }
});

test("la frase de la familia; una especie sin mascota usa generica y un ánimo o evento nuevo no tiene frase", () => {
  assert.equal(F.fraseDeAnimoDe("girasol", "FELIZ"), "todo bello!");
  assert.equal(F.fraseDeAnimoDe("cactus", "DESMAYADA"), "x_x");
  assert.equal(F.fraseDeAnimoDe("sin-familia", "FELIZ"), F.ANIMO.generica.FELIZ);
  assert.equal(F.fraseDeAnimoDe("girasol", "VOLANDO"), null);
  assert.equal(F.fraseDeEventoDe("girasol", "ACARICIADA"), "jiji");
  assert.equal(F.fraseDeEventoDe("sin-familia", "RACHA"), F.EVENTO.generica.RACHA);
  assert.equal(F.fraseDeEventoDe("girasol", "RIEGO_DECLARADO"), null);
  assert.equal(F.fraseDeEventoDe("girasol", "toString"), null, "no se cuelan las claves del prototipo");
});
