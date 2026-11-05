import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizarCodigo,
  limpiarEntradaDeCodigo,
  codigoVisible,
  enmascaradoVisible,
  coincideConEncontradas,
  plantaRecordada,
  recordarPlanta,
  estadoInicial,
  transicion,
  anuncioDePaso,
  ERROR_CODIGO,
  esperaSinHallazgoMs,
  TIEMPO_SIN_HALLAZGO_MS,
  AYUDAS,
} from "../js/vinculacion.js";

test("normalizarCodigo: todas las formas de escribir el código dan fito-YUBUD6", () => {
  for (const forma of ["YUBUD6", "yubud6", "YUB UD6", "YUB-UD6", "fito-YUBUD6", "FITO-yubud6", "  fito YUBUD6 ", "Fito_yubud6"]) {
    const r = normalizarCodigo(forma);
    assert.equal(r.ok, true, forma);
    assert.equal(r.serial, "fito-YUBUD6", forma);
    assert.equal(r.codigo, "YUBUD6", forma);
  }
});

test("normalizarCodigo: un código que empieza por FITO sigue siendo un código de 6", () => {
  assert.equal(normalizarCodigo("fito12").serial, "fito-FITO12");
  assert.equal(normalizarCodigo("fito-fito12").serial, "fito-FITO12");
});

test("normalizarCodigo: menos o más de 6 es un error junto al campo", () => {
  for (const mala of ["", "   ", "YUBUD", "YU", "YUBUD67", "fito-YUBUD", "fito-YUBUD67", "YU BUD"]) {
    const r = normalizarCodigo(mala);
    assert.equal(r.ok, false, mala);
    assert.equal(r.error, ERROR_CODIGO, mala);
  }
  assert.equal(ERROR_CODIGO, "El código tiene 6 letras y números");
});

test("normalizarCodigo: un serial que no es de fábrica se acepta completo, tal cual", () => {
  const r = normalizarCodigo("esp32-sala-01");
  assert.deepEqual(r, { ok: true, codigo: "esp32-sala-01", serial: "esp32-sala-01" });
  assert.equal(normalizarCodigo("matera.balcon").serial, "matera.balcon");
  assert.equal(normalizarCodigo("con espacios largos").ok, false);
});

test("limpiarEntradaDeCodigo: mayúsculas, sin separadores, pegar el serial entero, tope de 6", () => {
  assert.equal(limpiarEntradaDeCodigo("yub-ud6"), "YUBUD6");
  assert.equal(limpiarEntradaDeCodigo("fito-yubud6"), "YUBUD6");
  assert.equal(limpiarEntradaDeCodigo("FITO-YUBUD6extra"), "YUBUD6");
  assert.equal(limpiarEntradaDeCodigo("yubud6789"), "YUBUD6");
  assert.equal(limpiarEntradaDeCodigo("fito1"), "FITO1");
  assert.equal(limpiarEntradaDeCodigo(null), "");
});

test("codigoVisible y enmascaradoVisible quitan el prefijo solo de los seriales de fábrica", () => {
  assert.equal(codigoVisible("fito-YUBUD6"), "YUBUD6");
  assert.equal(codigoVisible("esp32-sala-01"), "esp32-sala-01");
  assert.equal(enmascaradoVisible("fito-YU····"), "YU····");
  assert.equal(enmascaradoVisible("esp····"), "esp····");
  assert.equal(codigoVisible(undefined), "");
});

test("coincideConEncontradas compara las letras que el enmascarado deja ver", () => {
  const e = [{ serialEnmascarado: "fito-YU····" }];
  assert.equal(coincideConEncontradas("YUBUD6", e), true);
  assert.equal(coincideConEncontradas("ABCDEF", e), false);
  assert.equal(coincideConEncontradas("ABCDEF", []), true);
  assert.equal(coincideConEncontradas("ABCDEF", [...e, { serialEnmascarado: "fito-AB····" }]), true);
});

test("plantaRecordada: vale 30 min y rechaza basura", () => {
  const t0 = 1_000_000;
  assert.equal(plantaRecordada(recordarPlanta("abc", t0), t0 + 1000), "abc");
  assert.equal(plantaRecordada(recordarPlanta("abc", t0), t0 + 31 * 60 * 1000), null);
  assert.equal(plantaRecordada(recordarPlanta("abc", t0), t0 - 1), null);
  assert.equal(plantaRecordada("no es json", t0), null);
  assert.equal(plantaRecordada(null, t0), null);
  assert.equal(plantaRecordada(JSON.stringify({ plantaId: 5, en: t0 }), t0), null);
});

test("máquina de pasos: el camino feliz", () => {
  let s = estadoInicial();
  assert.equal(s.paso, "enciende");
  s = transicion(s, { tipo: "BUSCAR" });
  assert.equal(s.paso, "buscando");
  s = transicion(s, { tipo: "ENCONTRADAS", encontradas: [] });
  assert.equal(s.paso, "buscando");
  s = transicion(s, { tipo: "ENCONTRADAS", encontradas: [{ serialEnmascarado: "fito-YU····" }] });
  assert.equal(s.paso, "confirma");
  assert.equal(s.encontradas.length, 1);
  s = transicion(s, { tipo: "VINCULAR" });
  assert.equal(s.paso, "conectando");
  s = transicion(s, { tipo: "CONECTADA" });
  assert.equal(s.paso, "exito");
  assert.equal(anuncioDePaso(s.paso), "Paso 5 de 5: Conexión exitosa");
});

test("máquina de pasos: a mano, fallos, reintentos y atrás", () => {
  let s = transicion(estadoInicial(), { tipo: "ESCRIBIR_A_MANO" });
  assert.equal(s.paso, "confirma");
  s = transicion(s, { tipo: "VINCULAR" });
  s = transicion(s, { tipo: "FALLO", error: "no existe" });
  assert.equal(s.paso, "confirma");
  assert.equal(s.error, "no existe");
  s = transicion(s, { tipo: "ATRAS" });
  assert.equal(s.paso, "buscando");
  s = transicion(s, { tipo: "ATRAS" });
  assert.equal(s.paso, "enciende");
  // eventos que no aplican no mueven nada
  assert.equal(transicion(s, { tipo: "CONECTADA" }).paso, "enciende");
  assert.equal(transicion(s, { tipo: "FALLO" }).paso, "enciende");
  assert.equal(transicion(estadoInicial({ directo: true }), { tipo: "CONECTADA" }).paso, "exito");
  // la lista actualizada en «confirma» no mueve al usuario
  let c = transicion(transicion(estadoInicial(), { tipo: "ESCRIBIR_A_MANO" }), { tipo: "ENCONTRADAS", encontradas: [{ serialEnmascarado: "x" }] });
  assert.equal(c.paso, "confirma");
  assert.equal(c.encontradas.length, 1);
  assert.equal(transicion(s, { tipo: "NOSE" }), s);
});

test("esperaSinHallazgoMs: 25 s por defecto y el parámetro interno solo puede bajarlo", () => {
  assert.equal(TIEMPO_SIN_HALLAZGO_MS, 25000);
  assert.equal(esperaSinHallazgoMs(null), 25000);
  assert.equal(esperaSinHallazgoMs("abc"), 25000);
  assert.equal(esperaSinHallazgoMs("60000"), 25000);
  assert.equal(esperaSinHallazgoMs("50"), 25000);
  assert.equal(esperaSinHallazgoMs("1500"), 1500);
});

test("la ayuda tiene los cinco puntos, cada uno con icono", () => {
  assert.equal(AYUDAS.length, 5);
  assert.ok(AYUDAS.every((a) => a.icono && a.titulo && a.detalle));
});
