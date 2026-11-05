import { test } from "node:test";
import assert from "node:assert/strict";
import { codigoDeQr, modosDeLector, modoDeLector, ladoReducido, MENSAJES_QR } from "../js/qr-lectura.js";

const ok = (codigo) => ({ ok: true, codigo, serial: `fito-${codigo}` });

test("el enlace corto de la pantalla de la matera, con http o https y cualquier host", () => {
  assert.deepEqual(codigoDeQr("http://172.20.10.3:5500/#/v/YUBUD6"), ok("YUBUD6"));
  assert.deepEqual(codigoDeQr("https://172.20.10.3:8444/#/v/yubud6"), ok("YUBUD6"));
  assert.deepEqual(codigoDeQr("http://192.168.43.105:5500/#/v/7K2M9Q"), ok("7K2M9Q"));
  assert.deepEqual(codigoDeQr("https://fito.example/#/v/7k2m9q/"), ok("7K2M9Q"));
});

test("el enlace largo del sticker", () => {
  assert.deepEqual(codigoDeQr("http://localhost:5500/#/vincular?serial=fito-YUBUD6"), ok("YUBUD6"));
  assert.deepEqual(codigoDeQr("https://otro.host:9000/index.html#/vincular?serial=fito-7K2M9Q"), ok("7K2M9Q"));
  assert.deepEqual(codigoDeQr("http://localhost:5500/#/vincular?serial=YUBUD6"), ok("YUBUD6"));
});

test("el código solo, con o sin prefijo, con espacios alrededor", () => {
  assert.deepEqual(codigoDeQr("YUBUD6"), ok("YUBUD6"));
  assert.deepEqual(codigoDeQr("  fito-yubud6 \n"), ok("YUBUD6"));
});

test("un serial que no es de fábrica solo se acepta dentro del enlace de vincular", () => {
  assert.deepEqual(codigoDeQr("http://localhost:5500/#/vincular?serial=matera-de-prueba-01"), { ok: true, codigo: "matera-de-prueba-01", serial: "matera-de-prueba-01" });
  assert.equal(codigoDeQr("matera-de-prueba-01").ok, false);
});

test("un QR ajeno dice que no es de una matera, y nunca se devuelve su enlace", () => {
  for (const ajeno of ["https://example.com", "https://example.com/#/plantas", "http://malo.example/#/perfil?x=/v/YUBUD6", "hola mundo", "tel:+573001234567", "https://example.com/v"]) {
    const r = codigoDeQr(ajeno);
    assert.deepEqual(r, { ok: false, motivo: "ajeno", error: "Ese QR no es de una matera" }, ajeno);
  }
});

test("el QR de Wi-Fi del portal de la matera explica qué es", () => {
  const r = codigoDeQr("WIFI:S:Fito-YUBUD6;T:nopass;;");
  assert.equal(r.ok, false);
  assert.equal(r.motivo, "wifi");
  assert.equal(r.error, "Ese QR es para conectar la matera al Wi-Fi; cuando tenga red mostrará su código");
});

test("vacío o nulo", () => {
  assert.equal(codigoDeQr("").motivo, "vacio");
  assert.equal(codigoDeQr(null).error, MENSAJES_QR.vacio);
});

test("modo: en vivo solo con contexto seguro y getUserMedia; si no, foto; siempre a mano", () => {
  assert.deepEqual(modosDeLector({ contextoSeguro: true, camaraEnVivo: true, foto: true }), ["vivo", "foto", "manual"]);
  assert.equal(modoDeLector({ contextoSeguro: true, camaraEnVivo: true, foto: true }), "vivo");
  // por HTTP desde el celular: no hay contexto seguro, aunque el navegador tenga cámara
  assert.deepEqual(modosDeLector({ contextoSeguro: false, camaraEnVivo: true, foto: true }), ["foto", "manual"]);
  assert.equal(modoDeLector({ contextoSeguro: true, camaraEnVivo: false, foto: true }), "foto");
  assert.deepEqual(modosDeLector({ contextoSeguro: false, camaraEnVivo: false, foto: false }), ["manual"]);
  assert.equal(modoDeLector(), "manual");
});

test("la foto se reduce a 1024 px de lado mayor y nunca se agranda", () => {
  assert.deepEqual(ladoReducido(4032, 3024), { ancho: 1024, alto: 768 });
  assert.deepEqual(ladoReducido(3024, 4032), { ancho: 768, alto: 1024 });
  assert.deepEqual(ladoReducido(640, 480), { ancho: 640, alto: 480 });
  assert.deepEqual(ladoReducido(0, 0), { ancho: 0, alto: 0 });
});
