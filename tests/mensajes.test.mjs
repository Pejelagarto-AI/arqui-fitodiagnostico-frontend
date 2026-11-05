import { test } from "node:test";
import assert from "node:assert/strict";
import { mensajeParaPersona, comoFrase } from "../js/mensajes.js";

test("sin red no se habla de la API ni del backend: se dice qué hacer", () => {
  const error = { codigo: "API_NO_DISPONIBLE", mensaje: "No se pudo conectar con la API en http://localhost:8080/api/v1/plantas. Verifica que el backend este corriendo." };
  assert.equal(mensajeParaPersona(error), "No pudimos conectarnos. Revisa tu internet y vuelve a intentar.");
});

test("una respuesta rara o un error sin explicación no muestran jerga", () => {
  assert.equal(mensajeParaPersona({ codigo: "RESPUESTA_INVALIDA", mensaje: "La API respondio con error 502 y un cuerpo que no es JSON valido." }), "Algo falló de nuestro lado. Intenta de nuevo en un momento.");
  assert.equal(mensajeParaPersona({ codigo: "ERROR_DESCONOCIDO", mensaje: "Ocurrio un error inesperado consultando la API." }), "Algo falló de nuestro lado. Intenta de nuevo en un momento.");
  assert.equal(mensajeParaPersona(null), "Algo falló de nuestro lado. Intenta de nuevo en un momento.");
});

test("el mensaje del servidor se muestra como frase: mayúscula inicial y punto final", () => {
  assert.equal(mensajeParaPersona({ codigo: "PLANTA_NO_ENCONTRADA", mensaje: "la planta no existe o no es tuya" }), "La planta no existe o no es tuya.");
  assert.equal(mensajeParaPersona({ codigo: "ERROR_DESCONOCIDO", mensaje: "ya existe una especie con ese nombre" }), "Ya existe una especie con ese nombre.");
  assert.equal(mensajeParaPersona(new Error("falló algo")), "Falló algo.");
  assert.equal(mensajeParaPersona("El enlace está incompleto."), "El enlace está incompleto.");
});

test("comoFrase no duplica el punto ni rompe signos de cierre", () => {
  assert.equal(comoFrase("¿seguro?"), "¿seguro?");
  assert.equal(comoFrase("listo."), "Listo.");
  assert.equal(comoFrase("  "), "");
});
