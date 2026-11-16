// La mascota como la usan las vistas: dibujo de la familia de la especie, botón del toque con su aria-label y teclado,
// y el toque que no navega dentro de un enlace.
import { test } from "node:test";
import assert from "node:assert/strict";
import { instalarDom } from "./dom-minimo.mjs";

instalarDom();
const { crearMascotaVista } = await import("../js/componentes/mascota-vista.js");

const planta = (v) => v.mascota.nodo.buscar((e) => e.atributos.get("class") === "masc-planta")[0];

test("la vista escoge la mascota por la especie (familiaDe), o por la familia si viene", () => {
  assert.equal(crearMascotaVista({ especie: "Girasol enano", animar: false }).familia, "girasol");
  assert.equal(crearMascotaVista({ especie: "atrapamoscas", animar: false }).familia, "carnivora");
  assert.equal(crearMascotaVista({ especie: "rosa", animar: false }).familia, "generica");
  assert.equal(crearMascotaVista({ especie: "rosa", familia: "helecho", animar: false }).familia, "helecho");
  assert.equal(crearMascotaVista({ animar: false }).familia, "generica", "sin especie: la planta común");
});

test("sin toque, el nodo es el SVG decorativo; con toque, un botón con aria-label y foco por teclado", () => {
  const sin = crearMascotaVista({ especie: "cactus", animar: false });
  assert.equal(sin.nodo, sin.mascota.nodo);
  const con = crearMascotaVista({ especie: "cactus", nombre: "Pancho", toque: true, animar: false });
  assert.equal(con.nodo.getAttribute("role"), "button");
  assert.equal(con.nodo.getAttribute("tabindex"), "0");
  assert.equal(con.nodo.getAttribute("aria-label"), "Saludar a Pancho");
  assert.equal(con.nodo.hijos[0], con.mascota.nodo);
  assert.equal(con.mascota.nodo.getAttribute("aria-hidden"), "true", "el dibujo no se lee dos veces");
  assert.equal(crearMascotaVista({ toque: true, animar: false }).nodo.getAttribute("aria-label"), "Saludar a tu planta");
});

test("el clic y Enter o Espacio saludan; las demás teclas no; y nada navega ni sube al enlace", () => {
  let toques = 0;
  const v = crearMascotaVista({ especie: "girasol", toque: true, animar: false, alTocar: () => toques++ });
  const clic = v.nodo.disparar("click");
  assert.ok(clic.impedido && clic.detenido, "dentro de un <a> el clic no abre el detalle");
  for (const key of ["Enter", " "]) {
    const e = v.nodo.disparar("keydown", { key });
    assert.ok(e.impedido && e.detenido, `«${key}» no se propaga ni hace scroll`);
  }
  const tab = v.nodo.disparar("keydown", { key: "Tab" });
  assert.equal(tab.impedido, false);
  assert.equal(toques, 3);
});

test("sin GSAP (movimiento reducido) el saludo es solo expresión: la planta no sube", async () => {
  const v = crearMascotaVista({ especie: "cactus", estado: "CRITICO", toque: true, animar: false });
  v.nodo.disparar("click");
  assert.equal(planta(v).getAttribute("transform"), "matrix(1 0 0.00000 1 0.0000 0)");
  assert.equal(v.mascota.nodo.buscar((e) => e.atributos.get("class") === "masc-ceja").length, 0, "crítica pero con cara contenta un instante");
});

test("aplicar cambia el estado y repinta quieto; null es sin diagnóstico (se dibuja saludable)", () => {
  const v = crearMascotaVista({ especie: "helecho", animar: false });
  assert.equal(v.mascota.nodo.getAttribute("data-estado"), "SIN_DIAGNOSTICO");
  v.aplicar("CRITICO");
  assert.equal(v.mascota.nodo.getAttribute("data-estado"), "CRITICO");
  assert.equal(v.mascota.nodo.buscar((e) => e.atributos.get("class") === "masc-lagrima").length, 1);
  v.aplicar(null);
  assert.equal(v.mascota.nodo.getAttribute("data-estado"), "SIN_DIAGNOSTICO");
  assert.doesNotThrow(() => { v.parar(); v.parar(); });
});
