import { test } from "node:test";
import assert from "node:assert/strict";
import { MOMENTOS, PASOS, siguienteMomento, DURACION_MOMENTO_MS } from "../js/portada-guion.js";
import { decidirAcceso, RUTA_DE_INICIO_CON_SESION } from "../js/rutas.js";

test("ruta inicial: sin sesión la raíz muestra la portada; con sesión lleva al tablero", () => {
  assert.deepEqual(decidirAcceso("anonima", { haySesion: false, esAdmin: false }), { accion: "mostrar" });
  assert.deepEqual(decidirAcceso("anonima", { haySesion: true, esAdmin: false }), { accion: "ir", ruta: "/plantas" });
  assert.equal(RUTA_DE_INICIO_CON_SESION, "/plantas");
});

test("lo público se muestra siempre (el diagnóstico sin cuenta, los enlaces de los correos)", () => {
  assert.deepEqual(decidirAcceso("publica", { haySesion: false, esAdmin: false }), { accion: "mostrar" });
  assert.deepEqual(decidirAcceso("publica", { haySesion: true, esAdmin: true }), { accion: "mostrar" });
});

test("lo privado sin sesión manda a entrar y recuerda a dónde se quería ir", () => {
  assert.deepEqual(decidirAcceso("sesion", { haySesion: false, esAdmin: false, rutaPedida: "/plantas/7/historial" }), { accion: "ir", ruta: "/entrar?volver=%2Fplantas%2F7%2Fhistorial" });
  assert.deepEqual(decidirAcceso("admin", { haySesion: false, esAdmin: false, rutaPedida: "/admin" }), { accion: "ir", ruta: "/entrar?volver=%2Fadmin" });
  assert.deepEqual(decidirAcceso("sesion", { haySesion: true, esAdmin: false }), { accion: "mostrar" });
});

test("administración: con sesión pero sin el rol no pasa; con el rol sí", () => {
  assert.deepEqual(decidirAcceso("admin", { haySesion: true, esAdmin: false }), { accion: "sin-permiso" });
  assert.deepEqual(decidirAcceso("admin", { haySesion: true, esAdmin: true }), { accion: "mostrar" });
});

test("el guion de la portada da la vuelta y cada momento está completo", () => {
  assert.equal(siguienteMomento(0), 1);
  assert.equal(siguienteMomento(MOMENTOS.length - 1), 0);
  assert.equal(siguienteMomento(0, 0), 0);
  assert.ok(DURACION_MOMENTO_MS >= 3000, "cada frase alcanza a leerse");
  for (const m of MOMENTOS) {
    assert.ok(["comun", "carnivora"].includes(m.planta));
    assert.ok(["SALUDABLE", "EN_RIESGO", "CRITICO"].includes(m.estado));
    assert.ok(m.frase.length <= 40, `«${m.frase}» no cabe en el globo`);
    assert.deepEqual(Object.keys(m.valores), ["agua", "luz", "temperatura"]);
    assert.ok(m.alerta === null || m.alerta in m.valores);
    // quien pide algo no está saludable, y al revés
    assert.equal(m.alerta !== null, m.estado !== "SALUDABLE");
  }
  assert.ok(MOMENTOS.some((m) => m.planta === "carnivora") && MOMENTOS.some((m) => m.planta === "comun"), "salen las dos plantas");
});

test("«Así funciona» son tres pasos cortos", () => {
  assert.equal(PASOS.length, 3);
  for (const p of PASOS) assert.ok(p.titulo.length <= 22 && p.texto.length <= 60, p.titulo);
});
