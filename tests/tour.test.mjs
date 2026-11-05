import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RECORRIDOS, paradasDisponibles, recorridoApagado, crearMemoria, tocaMostrar, siguienteParada, paradaAnterior,
  anuncioDeParada, topeDeseado, colocar, claveDeVisto, CLAVE_APAGADO,
} from "../js/tour.js";

test("los dos recorridos tienen entre 4 y 5 paradas con título y una o dos frases", () => {
  for (const [nombre, paradas] of Object.entries(RECORRIDOS)) {
    assert.ok(paradas.length >= 4 && paradas.length <= 5, nombre);
    for (const p of [...paradas, ...paradas.map((x) => x.respaldo).filter(Boolean)]) {
      assert.ok(p.selector && p.titulo.length <= 30, p.clave);
      assert.ok(p.texto.length <= 125 && p.texto.split(". ").length <= 2, `${p.clave}: «${p.texto}» es largo`);
    }
  }
});

test("solo quedan las paradas cuyo elemento está; la de los valores usa su respaldo si la planta no tiene lecturas", () => {
  const todo = () => true;
  assert.deepEqual(paradasDisponibles(RECORRIDOS.detalle, todo).map((p) => p.clave), ["estado", "pestanas", "valores", "matera", "que-hacer"]);
  // invitado (sin pestaña Matera) y planta sin lecturas (sin burbujas ni «Qué hacer hoy»)
  const existe = (selector) => !["#pestana-matera", "#panel-hoy .burbuja", "#panel-hoy .que-hacer"].includes(selector);
  assert.deepEqual(paradasDisponibles(RECORRIDOS.detalle, existe).map((p) => p.clave), ["estado", "pestanas", "sin-valores"]);
  assert.deepEqual(paradasDisponibles(RECORRIDOS.tablero, () => false), []);
});

test("se apaga con ?tour=no (antes o después del #) o con la clave de almacenamiento", () => {
  assert.equal(recorridoApagado({}), false);
  assert.equal(recorridoApagado({ busqueda: "?tour=no" }), true);
  assert.equal(recorridoApagado({ consultaDelHash: "serial=x&tour=no" }), true);
  assert.equal(recorridoApagado({ almacenado: "no" }), true);
  assert.equal(recorridoApagado({ busqueda: "?tour=si", almacenado: "visto" }), false);
});

test("recuerda lo visto en el almacén y permite volver a verlo", () => {
  const datos = new Map();
  const almacen = { getItem: (k) => (datos.has(k) ? datos.get(k) : null), setItem: (k, v) => datos.set(k, v), removeItem: (k) => datos.delete(k) };
  const memoria = crearMemoria(almacen);
  assert.equal(memoria.visto("tablero"), false);
  memoria.marcarVisto("tablero");
  assert.equal(datos.get(claveDeVisto("tablero")), "visto");
  assert.equal(memoria.visto("tablero"), true);
  assert.equal(memoria.visto("detalle"), false);
  // otra visita, mismo almacén: sigue visto
  assert.equal(crearMemoria(almacen).visto("tablero"), true);
  memoria.olvidar();
  assert.equal(memoria.visto("tablero"), false);
  assert.equal(datos.has(claveDeVisto("tablero")), false);
  datos.set(CLAVE_APAGADO, "no");
  assert.equal(memoria.apagado(), "no");
});

test("sin almacenamiento (o si revienta) funciona igual con la memoria de la pestaña", () => {
  const roto = { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("bloqueado"); }, removeItem: () => { throw new Error("bloqueado"); } };
  for (const almacen of [null, roto]) {
    const memoria = crearMemoria(almacen);
    assert.equal(memoria.visto("detalle"), false);
    memoria.marcarVisto("detalle");
    assert.equal(memoria.visto("detalle"), true);
    memoria.olvidar();
    assert.equal(memoria.visto("detalle"), false);
    assert.equal(memoria.apagado(), null);
  }
});

test("solo se muestra si no está apagado, no se vio, no hay otro abierto y hay al menos dos paradas", () => {
  const base = { apagado: false, visto: false, abierto: false, paradas: 4 };
  assert.equal(tocaMostrar(base), true);
  assert.equal(tocaMostrar({ ...base, apagado: true }), false);
  assert.equal(tocaMostrar({ ...base, visto: true }), false);
  assert.equal(tocaMostrar({ ...base, abierto: true }), false);
  assert.equal(tocaMostrar({ ...base, paradas: 1 }), false);
});

test("avanzar termina en la última parada y retroceder no pasa de la primera", () => {
  assert.equal(siguienteParada(0, 5), 1);
  assert.equal(siguienteParada(4, 5), null);
  assert.equal(paradaAnterior(3), 2);
  assert.equal(paradaAnterior(0), 0);
  assert.equal(anuncioDeParada({ titulo: "Tu matera", texto: "Aquí ves si está conectada." }, 3, 5), "Paso 4 de 5. Tu matera. Aquí ves si está conectada.");
});

test("antes de enfocar, el elemento se centra con su globo si caben; si no, queda arriba", () => {
  assert.equal(topeDeseado({ altoObjetivo: 100, altoGlobo: 180, altoVentana: 844 }), 276);
  assert.equal(topeDeseado({ altoObjetivo: 900, altoGlobo: 180, altoVentana: 844 }), 16);
});

const seCruzan = (a, b) => a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

test("el globo nunca tapa el elemento que explica y no se sale de la ventana", () => {
  const ventana = { ancho: 390, alto: 844 };
  const globo = { ancho: 340, alto: 190 };
  const casos = [
    { top: 100, left: 12, width: 366, height: 120 },   // arriba: globo debajo
    { top: 640, left: 12, width: 366, height: 110 },   // abajo: globo encima
    { top: 781, left: 0, width: 390, height: 63 },     // la barra inferior
    { top: 20, left: 12, width: 366, height: 1200 },   // más alto que la pantalla
    { top: 300, left: 250, width: 130, height: 48 },   // un botón a la derecha
    { top: 60, left: 250, width: 90, height: 48 },     // una pestaña
  ];
  for (const objetivo of casos) {
    const r = colocar({ objetivo, ventana, globo });
    const cajaGlobo = { ...r.globo, width: globo.ancho, height: globo.alto };
    assert.equal(seCruzan(cajaGlobo, r.foco), false, JSON.stringify(objetivo));
    assert.ok(cajaGlobo.top >= 0 && cajaGlobo.top + cajaGlobo.height <= ventana.alto, `vertical ${JSON.stringify(objetivo)}`);
    assert.ok(cajaGlobo.left >= 0 && cajaGlobo.left + cajaGlobo.width <= ventana.ancho, `horizontal ${JSON.stringify(objetivo)}`);
    assert.ok(r.foco.left >= 0 && r.foco.left + r.foco.width <= ventana.ancho && r.foco.top >= 0 && r.foco.top + r.foco.height <= ventana.alto);
    assert.ok(r.flecha >= 22 && r.flecha <= globo.ancho - 22);
  }
  assert.equal(colocar({ objetivo: casos[0], ventana, globo }).lado, "abajo");
  assert.equal(colocar({ objetivo: casos[1], ventana, globo }).lado, "arriba");
});

test("a 1280 el globo queda centrado bajo el elemento y la flecha lo señala", () => {
  const r = colocar({ objetivo: { top: 150, left: 136, width: 330, height: 140 }, ventana: { ancho: 1280, alto: 800 }, globo: { ancho: 360, alto: 180 } });
  assert.equal(r.lado, "abajo");
  assert.equal(r.globo.left, Math.round(136 - 6 + (330 + 12) / 2 - 180));
  assert.equal(r.flecha, 180);
});
