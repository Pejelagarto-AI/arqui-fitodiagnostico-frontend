import { test } from "node:test";
import assert from "node:assert/strict";
import { codigoDeQr, modosDeLector, modoDeLector, ladoReducido, planDeLectura, MENSAJES_QR } from "../js/qr-lectura.js";

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

test("planDeLectura: cuatro pasadas en ciclo sobre un cuadro de 1920x1080", () => {
  assert.deepEqual(planDeLectura(0, 1920, 1080), { sx: 0, sy: 0, sw: 1920, sh: 1080, ancho: 640, alto: 360 });
  assert.deepEqual(planDeLectura(1, 1920, 1080), { sx: 0, sy: 0, sw: 1920, sh: 1080, ancho: 1280, alto: 720 });
  assert.deepEqual(planDeLectura(2, 1920, 1080), { sx: 480, sy: 270, sw: 960, sh: 540, ancho: 960, alto: 540 });
  assert.deepEqual(planDeLectura(3, 1920, 1080), { sx: 672, sy: 378, sw: 576, sh: 324, ancho: 576, alto: 324 });
  assert.deepEqual(planDeLectura(4, 1920, 1080), planDeLectura(0, 1920, 1080));
  assert.deepEqual(planDeLectura(7, 1920, 1080), planDeLectura(3, 1920, 1080));
});

test("planDeLectura: no agranda un video chico y sirve en vertical", () => {
  assert.deepEqual(planDeLectura(1, 640, 480), { sx: 0, sy: 0, sw: 640, sh: 480, ancho: 640, alto: 480 });
  const vertical = planDeLectura(3, 1080, 1920);
  assert.deepEqual(vertical, { sx: 378, sy: 672, sw: 324, sh: 576, ancho: 324, alto: 576 });
});

test("planDeLectura: los recortes quedan dentro del cuadro y centrados", () => {
  for (const [w, a] of [[1920, 1080], [1280, 720], [4032, 3024], [321, 241]]) {
    for (let i = 0; i < 8; i++) {
      const p = planDeLectura(i, w, a);
      assert.ok(p.sx >= 0 && p.sy >= 0 && p.sx + p.sw <= w && p.sy + p.sh <= a, `${w}x${a} #${i}`);
      assert.ok(Math.max(p.ancho, p.alto) <= (i % 4 === 0 ? 640 : 1280));
      assert.ok(Math.abs(p.sx - (w - p.sw - p.sx)) <= 1 && Math.abs(p.sy - (a - p.sh - p.sy)) <= 1);
    }
  }
});

test("planDeLectura: índices raros no revientan", () => {
  assert.deepEqual(planDeLectura(-1, 1920, 1080), planDeLectura(3, 1920, 1080));
  assert.deepEqual(planDeLectura(NaN, 1920, 1080), planDeLectura(0, 1920, 1080));
});
