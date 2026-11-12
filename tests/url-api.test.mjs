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

test("por HTTPS la API es del mismo origen que la página (con su puerto)", () => {
  assert.equal(apiPorDefecto({ protocol: "https:", hostname: "172.20.10.3", host: "172.20.10.3:8444", origin: "https://172.20.10.3:8444" }), "https://172.20.10.3:8444/api/v1");
  assert.equal(apiPorDefecto({ protocol: "https:", hostname: "fito.example", host: "fito.example", origin: "https://fito.example" }), "https://fito.example/api/v1");
  // sin `origin` (objeto mínimo) se arma con el host
  assert.equal(apiPorDefecto({ protocol: "https:", hostname: "fito.example", host: "fito.example:8443" }), "https://fito.example:8443/api/v1");
});

test("por HTTP sigue en el puerto 8080 del mismo host, aunque el front vaya por otro puerto", () => {
  assert.equal(apiPorDefecto({ protocol: "http:", hostname: "172.20.10.3", host: "172.20.10.3:5600", origin: "http://172.20.10.3:5600" }), "http://172.20.10.3:8080/api/v1");
});
