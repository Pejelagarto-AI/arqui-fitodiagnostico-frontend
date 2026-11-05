import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PESTANAS_PLANTA, pestanasDePlanta, rutaDePestana, patronesDePestanas, pestanaValida, pestanaVecina, consultasDeSondeo, tituloDePestana,
} from "../js/pestanas.js";
import { resolver, parsearHash, mismaPantalla } from "../js/rutas.js";

const claves = (lista) => lista.map((p) => p.clave);

test("el dueño ve las cuatro pestañas y el invitado no ve Matera", () => {
  assert.deepEqual(claves(pestanasDePlanta({ esDueno: true })), ["hoy", "historial", "matera", "mas"]);
  assert.deepEqual(claves(pestanasDePlanta({ esDueno: false })), ["hoy", "historial", "mas"]);
});

test("cada pestaña tiene su ruta y «Hoy» es la ruta corta de la planta", () => {
  assert.equal(rutaDePestana("abc", "hoy"), "/plantas/abc");
  assert.equal(rutaDePestana("abc", "historial"), "/plantas/abc/historial");
  assert.equal(rutaDePestana("abc", "matera"), "/plantas/abc/matera");
  assert.equal(rutaDePestana("abc", "mas"), "/plantas/abc/mas");
  assert.equal(rutaDePestana("abc", "no-existe"), "/plantas/abc");
  assert.equal(rutaDePestana("a/b", "mas"), "/plantas/a%2Fb/mas");
});

test("los patrones del enrutador resuelven cada pestaña y no le quitan la ruta al asistente ni a «nueva»", () => {
  const tabla = [
    { patron: "/plantas/nueva", vista: "nueva" },
    { patron: "/plantas/:id/vincular", vista: "asistente" },
    ...patronesDePestanas().map((p) => ({ ...p, familia: "planta" })),
  ];
  const de = (hash) => resolver(tabla, parsearHash(hash).ruta);
  assert.equal(de("#/plantas/7").entrada.pestana, "hoy");
  assert.equal(de("#/plantas/7/historial").entrada.pestana, "historial");
  assert.equal(de("#/plantas/7/matera").entrada.pestana, "matera");
  assert.equal(de("#/plantas/7/mas").entrada.pestana, "mas");
  assert.equal(de("#/plantas/7/mas").params.id, "7");
  assert.equal(de("#/plantas/7/vincular").entrada.vista, "asistente");
  assert.equal(de("#/plantas/nueva").entrada.vista, "nueva");
  assert.equal(de("#/plantas/7/otra"), null);
});

test("una pestaña que esa persona no tiene cae en «Hoy»", () => {
  const invitado = pestanasDePlanta({ esDueno: false });
  assert.equal(pestanaValida("matera", invitado), "hoy");
  assert.equal(pestanaValida("historial", invitado), "historial");
  assert.equal(pestanaValida(undefined, invitado), "hoy");
  assert.equal(pestanaValida("matera", pestanasDePlanta({ esDueno: true })), "matera");
});

test("las flechas recorren las pestañas con vuelta; Inicio y Fin van a los extremos", () => {
  const lista = claves(PESTANAS_PLANTA);
  assert.equal(pestanaVecina(lista, "hoy", "ArrowRight"), "historial");
  assert.equal(pestanaVecina(lista, "mas", "ArrowRight"), "hoy");
  assert.equal(pestanaVecina(lista, "hoy", "ArrowLeft"), "mas");
  assert.equal(pestanaVecina(lista, "matera", "Home"), "hoy");
  assert.equal(pestanaVecina(lista, "hoy", "End"), "mas");
  assert.equal(pestanaVecina(lista, "hoy", "Enter"), null);
  assert.equal(pestanaVecina(lista, "no-existe", "ArrowRight"), null);
  // el invitado salta de Historial a Más: Matera no está en su lista
  assert.equal(pestanaVecina(["hoy", "historial", "mas"], "historial", "ArrowRight"), "mas");
});

test("el sondeo solo pide lo que la pestaña muestra; el vigente va siempre", () => {
  assert.deepEqual(consultasDeSondeo("hoy"), { vigente: true, historial: true, dispositivos: false });
  assert.deepEqual(consultasDeSondeo("historial"), { vigente: true, historial: true, dispositivos: false });
  assert.deepEqual(consultasDeSondeo("matera"), { vigente: true, historial: false, dispositivos: true });
  assert.deepEqual(consultasDeSondeo("mas"), { vigente: true, historial: false, dispositivos: false });
});

test("el título del navegador nombra la pestaña, menos en «Hoy»", () => {
  assert.equal(tituloDePestana("Lola", "hoy"), "Lola");
  assert.equal(tituloDePestana("Lola", "historial"), "Lola · Historial");
  assert.equal(tituloDePestana("Lola", "mas"), "Lola · Más");
});

test("cambiar de pestaña en la misma planta es la misma pantalla; otra planta u otra familia, no", () => {
  const planta = (id, pestana) => ({ entrada: { familia: "planta", pestana }, params: { id } });
  assert.equal(mismaPantalla(planta("7", "hoy"), planta("7", "historial")), true);
  assert.equal(mismaPantalla(planta("7", "hoy"), planta("8", "hoy")), false);
  assert.equal(mismaPantalla(planta("7", "hoy"), { entrada: { patron: "/plantas" }, params: {} }), false);
  assert.equal(mismaPantalla({ entrada: { patron: "/perfil" }, params: {} }, { entrada: { patron: "/perfil" }, params: {} }), false);
  assert.equal(mismaPantalla(null, planta("7", "hoy")), false);
});
