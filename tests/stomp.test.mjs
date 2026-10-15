import test from "node:test";
import assert from "node:assert/strict";
import { codificar, decodificar } from "../js/stomp.js";

test("codifica CONNECT sin escapar y termina en NUL", () => {
  const t = codificar("CONNECT", { "accept-version": "1.2", Authorization: "Bearer a.b:c" });
  assert.equal(t, "CONNECT\naccept-version:1.2\nAuthorization:Bearer a.b:c\n\n\0");
});

test("codifica SUBSCRIBE y decodifica lo mismo", () => {
  const t = codificar("SUBSCRIBE", { id: "sub-1", destination: "/user/queue/avisos" });
  const [trama] = decodificar(t);
  assert.equal(trama.comando, "SUBSCRIBE");
  assert.deepEqual(trama.cabeceras, { id: "sub-1", destination: "/user/queue/avisos" });
  assert.equal(trama.cuerpo, "");
});

test("decodifica un MESSAGE con cuerpo JSON", () => {
  const texto =
    'MESSAGE\ndestination:/user/queue/plantas/x\nsubscription:sub-2\ncontent-type:application/json\n\n{"tipo":"DIAGNOSTICO_NUEVO"}\0';
  const [trama] = decodificar(texto);
  assert.equal(trama.comando, "MESSAGE");
  assert.equal(trama.cabeceras.subscription, "sub-2");
  assert.deepEqual(JSON.parse(trama.cuerpo), { tipo: "DIAGNOSTICO_NUEVO" });
});

test("ignora latidos y separa varias tramas en un mensaje", () => {
  const texto = "\nCONNECTED\nversion:1.2\n\n\0\nMESSAGE\nsubscription:a\n\n{}\0\n";
  const tramas = decodificar(texto);
  assert.deepEqual(tramas.map((t) => t.comando), ["CONNECTED", "MESSAGE"]);
});

test("desescapa cabeceras de ERROR y respeta la primera cabecera repetida", () => {
  const texto = "ERROR\nmessage:falla\\cuno\\ndos\nmessage:otra\n\n\0";
  const [trama] = decodificar(texto);
  assert.equal(trama.cabeceras.message, "falla:uno\ndos");
});
