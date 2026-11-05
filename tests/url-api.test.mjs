import test from "node:test";
import assert from "node:assert/strict";
import { apiPorDefecto } from "../js/url-api.js";

test("en localhost apunta a localhost:8080 (igual que antes)", () => {
  assert.equal(apiPorDefecto({ protocol: "http:", hostname: "localhost" }), "http://localhost:8080/api/v1");
});

test("desde el celular apunta a la IP del portátil que sirve el front", () => {
  assert.equal(apiPorDefecto({ protocol: "http:", hostname: "192.168.43.105" }), "http://192.168.43.105:8080/api/v1");
});

test("en file:// o sin hostname cae en localhost", () => {
  assert.equal(apiPorDefecto({ protocol: "file:", hostname: "" }), "http://localhost:8080/api/v1");
  assert.equal(apiPorDefecto({ protocol: "http:", hostname: "" }), "http://localhost:8080/api/v1");
  assert.equal(apiPorDefecto(undefined), "http://localhost:8080/api/v1");
});

test("IPv6 va entre corchetes", () => {
  assert.equal(apiPorDefecto({ protocol: "http:", hostname: "::1" }), "http://[::1]:8080/api/v1");
});
