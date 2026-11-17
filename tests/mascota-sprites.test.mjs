// F56: los sprites nuevos (efectos, ojos en «x», accesorios) y la tabla de anclas de js/componentes/mascota-sprites.js
// son los del firmware. Se comparan con `firmware/sprites/arte/*.txt` y con `ANCLA_ACCESORIO` de `firmware/src/pantalla.cpp`
// del repo del backend (ruta con BACKEND; por defecto el checkout hermano). Sin ese repo, esas comparaciones se saltan con aviso.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import * as S from "../js/componentes/mascota-sprites.js";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BACKEND = process.env.BACKEND || resolve(RAIZ, "../fitodiagnostico-backend");
const arte = (nombre) => readFileSync(resolve(BACKEND, "firmware/sprites/arte", `${nombre}.txt`), "utf8").split("\n").filter(Boolean);

test("cada sprite del front es el .txt del firmware (efectos, ojos en «x», accesorios)", (t) => {
  if (!existsSync(resolve(BACKEND, "firmware/sprites/arte"))) return t.skip(`AVISO: no hay ${BACKEND}/firmware/sprites/arte; no se comparó con el arte`);
  const pares = {
    rayos_0: S.RAYOS[0], rayos_1: S.RAYOS[1], rayos_2: S.RAYOS[2], corazon_0: S.CORAZON[0], corazon_1: S.CORAZON[1],
    destellos_0: S.DESTELLOS[0], destellos_1: S.DESTELLOS[1], destellos_2: S.DESTELLOS[2],
    estrella_0: S.ESTRELLA[0], estrella_1: S.ESTRELLA[1], estrella_2: S.ESTRELLA[2], ojo_x_5: S.OJO_X_5, ojo_x_3: S.OJO_X_3,
    accesorio_sombrero: S.ACCESORIO_SPRITE.SOMBRERO, accesorio_mono: S.ACCESORIO_SPRITE.MONO, accesorio_gafas: S.ACCESORIO_SPRITE.GAFAS,
    accesorio_gafas_ancha: S.ACCESORIO_SPRITE.GAFAS_ANCHA,
  };
  for (const [nombre, filas] of Object.entries(pares)) assert.deepEqual([...filas], arte(nombre), nombre);
});

test("los tamaños de la fase 14: efectos de 11x11 (el corazón 9x8), ojos 5x5 y 3x3, accesorios 16x8, 10x8, 14x6 y 24x7", () => {
  const tam = (f) => [f[0].length, f.length];
  for (const f of [...S.RAYOS, ...S.DESTELLOS, ...S.ESTRELLA]) assert.deepEqual(tam(f), [11, 11]);
  for (const f of S.CORAZON) assert.deepEqual(tam(f), [9, 8]);
  assert.deepEqual(tam(S.OJO_X_5), [5, 5]);
  assert.deepEqual(tam(S.OJO_X_3), [3, 3]);
  assert.deepEqual(tam(S.ACCESORIO_SPRITE.SOMBRERO), [16, 8]);
  assert.deepEqual(tam(S.ACCESORIO_SPRITE.MONO), [10, 8]);
  assert.deepEqual(tam(S.ACCESORIO_SPRITE.GAFAS), [14, 6]);
  assert.deepEqual(tam(S.ACCESORIO_SPRITE.GAFAS_ANCHA), [24, 7]);
});

test("la tabla de anclas es la ANCLA_ACCESORIO de pantalla.cpp (6 familias x 4 niveles x 3 accesorios)", (t) => {
  const ruta = resolve(BACKEND, "firmware/src/pantalla.cpp");
  if (!existsSync(ruta)) return t.skip(`AVISO: no hay ${ruta}; no se comparó con el firmware`);
  const fuente = readFileSync(ruta, "utf8");
  const cuerpo = fuente.match(/const Ancla ANCLA_ACCESORIO\[6\]\[4\]\[3\] = \{([\s\S]*?)\n\};/)[1];
  const lineas = cuerpo.split("\n").filter((l) => l.includes("//"));
  const familias = ["generica", "carnivora", "girasol", "cactus", "suculenta", "helecho"];
  assert.equal(lineas.length, 6);
  familias.forEach((familia, i) => {
    const comentario = lineas[i].split("//")[1].trim();
    assert.equal(comentario, familia === "generica" ? "comun" : familia, "el orden del enum del firmware");
    const numeros = (lineas[i].split("//")[0].match(/-?\d+/g) || []).map(Number);
    const esperado = S.ANCLAS[familia].flat(2);
    assert.deepEqual(numeros, esperado, familia);
  });
});

test("anclas de docs/fase14 a mano: el sombrero del girasol saludable, el moño del cactus crítico y las gafas anchas de la carnívora", () => {
  const girasol = S.colocarAccesorio({ accesorio: "SOMBRERO", familia: "girasol", nivel: 0, cara: { x: 24, y: 17 } });
  assert.deepEqual([girasol.x, girasol.y, girasol.w, girasol.h], [16, 0, 16, 8]); // (24 - 8, 17 - 17): pegado al borde de arriba
  const cactus = S.colocarAccesorio({ accesorio: "MONO", familia: "cactus", nivel: 2, cara: { x: 24, y: 29 } });
  assert.deepEqual([cactus.x, cactus.y], [26, 14]);
  const carni = S.colocarAccesorio({ accesorio: "GAFAS", familia: "carnivora", nivel: 0, cara: { x: 24, y: 9 } });
  assert.deepEqual([carni.x, carni.y, carni.w, carni.h], [12, 6, 24, 7], "las gafas anchas");
  const comun = S.colocarAccesorio({ accesorio: "GAFAS", familia: "generica", nivel: 0, cara: S.CARA_MATERA });
  assert.deepEqual([comun.x, comun.y, comun.w], [17, 53, 14], "las de la común: en la matera, a la altura de los ojos");
  assert.equal(comun.sobreLaPlanta, false, "no se mueve, como su cara");
  assert.equal(girasol.sobreLaPlanta, true);
  const sombreroComun = S.colocarAccesorio({ accesorio: "SOMBRERO", familia: "generica", nivel: 0, cara: S.CARA_MATERA });
  assert.deepEqual([sombreroComun.x, sombreroComun.y], [15, 0]);
  assert.equal(S.colocarAccesorio({ accesorio: "NINGUNO", familia: "girasol", nivel: 0, cara: { x: 24, y: 17 } }), null);
  assert.equal(S.colocarAccesorio({ accesorio: "CORONA", familia: "girasol", nivel: 0, cara: { x: 24, y: 17 } }), null, "un accesorio nuevo no rompe");
  assert.equal(S.spriteDeAccesorio("GAFAS", "girasol"), S.ACCESORIO_SPRITE.GAFAS);
  assert.equal(S.spriteDeAccesorio("GAFAS", "carnivora"), S.ACCESORIO_SPRITE.GAFAS_ANCHA);
});

test("la aureola es el borde de 1 px del sprite (sus 8 vecinos) y no incluye los píxeles del propio sprite", () => {
  const sprite = S.pixelesDeSprite(["#"], 5, 5);
  const aureola = S.aureolaDe(sprite);
  assert.equal(aureola.length, 8);
  assert.ok(!aureola.some(([x, y]) => x === 5 && y === 5));
  const dos = S.pixelesDeSprite(["##"], 0, 0);
  const a2 = S.aureolaDe(dos);
  assert.equal(a2.length, 10, "3x4 de caja menos los 2 píxeles");
  const clave = new Set(a2.map(([x, y]) => `${x},${y}`));
  assert.equal(clave.size, a2.length, "sin repetidos");
  assert.deepEqual(S.pixelesDeSprite(S.CORAZON[0], 38, 1).length, 27, "el corazón chico tiene 27 píxeles");
});
