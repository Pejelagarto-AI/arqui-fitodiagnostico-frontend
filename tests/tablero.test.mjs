import { test } from "node:test";
import assert from "node:assert/strict";
import { cuentaPorEstado, pasaElFiltro, filtroVigente, plegar, claveDeLectura } from "../js/tablero.js";

const datos = (estado) => ({ tipo: "datos", registro: { diagnostico: { estado } } });
const plantas = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }];
const lecturas = new Map([["a", datos("SALUDABLE")], ["b", datos("CRITICO")], ["c", { tipo: "vacio" }], ["d", { tipo: "fallo" }]]);

test("el resumen cuenta por estado; sin lectura o con fallo van a «sin»; lo que no ha llegado no cuenta", () => {
  assert.deepEqual(cuentaPorEstado(plantas, lecturas), { total: 5, SALUDABLE: 1, EN_RIESGO: 0, CRITICO: 1, SIN: 2 });
  assert.equal(claveDeLectura(undefined), null);
});

test("el filtro deja ver solo las plantas de ese estado, y «total» las deja todas", () => {
  assert.equal(pasaElFiltro(lecturas.get("b"), "CRITICO"), true);
  assert.equal(pasaElFiltro(lecturas.get("a"), "CRITICO"), false);
  assert.equal(pasaElFiltro(lecturas.get("c"), "SIN"), true);
  assert.equal(pasaElFiltro(undefined, "total"), true);
  assert.equal(pasaElFiltro(undefined, "SALUDABLE"), false);
});

test("un filtro que se queda sin plantas vuelve a mostrar todas", () => {
  const cuenta = cuentaPorEstado(plantas, lecturas);
  assert.equal(filtroVigente("CRITICO", cuenta), "CRITICO");
  assert.equal(filtroVigente("EN_RIESGO", cuenta), "total");
  assert.equal(filtroVigente("cualquiera", cuenta), "total");
});

test("«Qué hacer hoy» muestra los tres primeros y pliega el resto, salvo que sobre uno solo", () => {
  assert.deepEqual(plegar([1, 2, 3]), { visibles: [1, 2, 3], plegados: [] });
  assert.deepEqual(plegar([1, 2, 3, 4]), { visibles: [1, 2, 3, 4], plegados: [] });
  assert.deepEqual(plegar([1, 2, 3, 4, 5]), { visibles: [1, 2, 3], plegados: [4, 5] });
});

// ---- F56: el tablero en una llamada ----
import { traeResumen, plantasSinResumen, sinResumen, chipDeSaludDelListado } from "../js/tablero.js";

test("el tablero en una llamada: con las claves (aunque sean null) no se piden mascota ni dispositivos; sin ellas, el camino de antes", () => {
  const nueva = { id: "a", apodo: "Pepa", especie: "girasol", mascota: { vitalidad: 64, animo: "FELIZ", racha: 3, accesorio: "SOMBRERO" }, salud: null };
  const sinLecturas = { id: "b", apodo: "Rama", especie: "cactus", mascota: null, salud: null };
  const vieja = { id: "c", apodo: "Vieja", especie: "helecho" };
  assert.equal(traeResumen(nueva), true);
  assert.equal(traeResumen(sinLecturas), true, "null es «el servidor dice que no hay»: no se pide nada más");
  assert.equal(traeResumen(vieja), false);
  assert.deepEqual(plantasSinResumen([nueva, sinLecturas, vieja]).map((p) => p.id), ["c"], "solo la de un backend viejo usa el respaldo");
  assert.deepEqual(plantasSinResumen([nueva, sinLecturas]), [], "backend nuevo: cero peticiones extra por tarjeta");
  assert.equal(traeResumen(null), false);
});

test("el listado que solo cambió en vitalidad o salud no es una lista nueva: no se repintan las tarjetas", () => {
  const antes = [{ id: "a", apodo: "Pepa", especie: "girasol", mascota: { vitalidad: 64, animo: "FELIZ", racha: 3, accesorio: "NINGUNO" }, salud: null }];
  const despues = [{ id: "a", apodo: "Pepa", especie: "girasol", mascota: { vitalidad: 40, animo: "SEDIENTA", racha: 0, accesorio: "GAFAS" }, salud: { estado: "FALLA", mensaje: "no te siento la luz" } }];
  assert.deepEqual(sinResumen(antes), sinResumen(despues));
  assert.deepEqual(sinResumen(antes), [{ id: "a", apodo: "Pepa", especie: "girasol" }]);
  assert.notDeepEqual(sinResumen(antes), sinResumen([{ ...despues[0], apodo: "Otra" }]));
});

test("el chip de salud del listado: FALLA «revisa la matera», SIN_NOTICIAS «sin noticias», OK o sin salud, ninguno", () => {
  assert.deepEqual(chipDeSaludDelListado({ estado: "FALLA", mensaje: "no te siento la humedad" }), { mala: true, texto: "revisa la matera", estado: "FALLA" });
  assert.deepEqual(chipDeSaludDelListado({ estado: "SIN_NOTICIAS", mensaje: "no sé de la matera" }), { mala: true, texto: "sin noticias", estado: "SIN_NOTICIAS" });
  assert.equal(chipDeSaludDelListado({ estado: "OK" }).mala, false);
  assert.equal(chipDeSaludDelListado(null).mala, false);
});
