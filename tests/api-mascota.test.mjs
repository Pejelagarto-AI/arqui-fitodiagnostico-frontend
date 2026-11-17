// F56: el contrato nuevo de la fase 13 del backend en js/api.js, con `fetch` falso: PATCH del accesorio y el listado con
// `mascota` y `salud`. (api.js lee `window.location` y `sessionStorage`: se arman antes de importarlo.)
import { test } from "node:test";
import assert from "node:assert/strict";

const guardado = new Map();
globalThis.window = {
  location: { search: "?api=http://api.test/api/v1", protocol: "http:", hostname: "localhost", host: "localhost:5700", origin: "http://localhost:5700" },
  sessionStorage: { getItem: (k) => guardado.get(k) ?? null, setItem: (k, v) => guardado.set(k, v), removeItem: (k) => guardado.delete(k) },
  addEventListener() {},
};
guardado.set("fitodiagnostico.sesion", JSON.stringify({ token: "jwt-de-prueba", expiraEn: new Date(Date.now() + 3600000).toISOString(), usuario: { id: "u", nombre: "U" } }));

const llamadas = [];
let respuesta = { status: 200, cuerpo: {} };
globalThis.fetch = async (url, opciones) => {
  llamadas.push({ url, metodo: opciones.method, cuerpo: opciones.body ? JSON.parse(opciones.body) : undefined, cabeceras: opciones.headers });
  return { ok: respuesta.status < 400, status: respuesta.status, text: async () => JSON.stringify(respuesta.cuerpo) };
};

const api = await import("../js/api.js");

test("PATCH /plantas/{id}/mascota {accesorio} con el token, y devuelve la vista que ya trae `accesorio`", async () => {
  respuesta = { status: 200, cuerpo: { plantaId: "p 1", vitalidad: 64, animo: "FELIZ", accesorio: "SOMBRERO" } };
  const vista = await api.cambiarAccesorioDeMascota("p 1", "SOMBRERO");
  const l = llamadas.at(-1);
  assert.equal(l.metodo, "PATCH");
  assert.equal(l.url, "http://api.test/api/v1/plantas/p%201/mascota");
  assert.deepEqual(l.cuerpo, { accesorio: "SOMBRERO" });
  assert.equal(l.cabeceras.Authorization, "Bearer jwt-de-prueba");
  assert.equal(l.cabeceras["Content-Type"], "application/json");
  assert.equal(vista.accesorio, "SOMBRERO");
});

test("PATCH: el 403 del invitado y el 400 de un accesorio raro llegan como ErrorApi con su estado", async () => {
  respuesta = { status: 403, cuerpo: { error: "OPERACION_NO_PERMITIDA", mensaje: "Solo el dueño" } };
  await assert.rejects(api.cambiarAccesorioDeMascota("p", "MONO"), (e) => e.status === 403 && e.codigo === "OPERACION_NO_PERMITIDA");
  respuesta = { status: 400, cuerpo: { error: "PARAMETRO_INVALIDO", mensaje: "accesorio" } };
  await assert.rejects(api.cambiarAccesorioDeMascota("p", "CORONA"), (e) => e.status === 400);
});

test("el listado trae mascota y salud por planta, tal cual (null cuando no hay)", async () => {
  const lista = [
    { id: "a", apodo: "Pepa", mascota: { vitalidad: 64, animo: "FELIZ", racha: 3, accesorio: "GAFAS" }, salud: { estado: "FALLA", mensaje: "no te siento la temperatura" } },
    { id: "b", apodo: "Rama", mascota: null, salud: null },
  ];
  respuesta = { status: 200, cuerpo: lista };
  assert.deepEqual(await api.listarPlantas(), lista);
  assert.equal(llamadas.at(-1).url, "http://api.test/api/v1/plantas");
  assert.deepEqual(await api.listarPlantasCompartidas(), lista);
  assert.equal(llamadas.at(-1).url, "http://api.test/api/v1/plantas/compartidas");
});

test("GET .../mascota sigue siendo una consulta de lectura y la caricia devuelve el estado con el id del evento", async () => {
  respuesta = { status: 201, cuerpo: { id: "e1", tipo: "ACARICIADA", ocurridoEn: "2026-11-16T15:00:00Z" } };
  const r = await api.acariciarMascota("p");
  assert.equal(r.status, 201);
  assert.equal(r.cuerpo.id, "e1");
});
