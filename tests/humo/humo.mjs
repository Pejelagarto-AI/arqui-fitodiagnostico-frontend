// Prueba de humo de punta a punta: front estático + backend real + navegador real.
//
//   1. backend:  FITO_JWT_SECRETO=... FITO_ADMIN_CORREO=admin@fito.test FITO_ADMIN_CONTRASENA=admin-clave-larga \
//                FITO_FRONT_URL='http://localhost:5500/#' ./mvnw spring-boot:run
//   2. front:    python3 -m http.server 5500          (en la raíz del repo del front)
//   3. opcional: docker run -d --rm --name fito-mailpit -p 1025:1025 -p 8025:8025 axllent/mailpit
//   4. esto:     cd tests/humo && npm install && node humo.mjs
//
// Variables: FRONT, FRONT_API, API, MAILPIT, ADMIN_CORREO, ADMIN_CLAVE, CHROME (ruta de Chrome/Chromium).
// Sale con código 1 si algún paso falla. Sin Mailpit se omiten los pasos de correo.
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { pngDeQr } from "./qr-png.mjs";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EVENTO as FRASES_DE_EVENTO } from "../../js/mascota-frases.js";

const FRONT = process.env.FRONT || "http://localhost:5500";
const API = process.env.API || "http://localhost:8080/api/v1";
// FRONT_API: el front resuelve la API por ?api= (o, sin él, localhost:8080). Para correr el humo contra un backend en otro
// puerto (p. ej. 8090, sin tocar una demo en 8080) se pasa FRONT_API=http://localhost:8090/api/v1 y todas las
// páginas se abren con ese parámetro antes del hash. RAIZ es la URL base de la página con y sin ese parámetro.
const FRONT_API = process.env.FRONT_API || "";
const MAILPIT = process.env.MAILPIT || "http://localhost:8025";
const ADMIN_CORREO = process.env.ADMIN_CORREO || "admin@fito.test";
const ADMIN_CLAVE = process.env.ADMIN_CLAVE || "admin-clave-larga";
const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
// F55: el simulador de la matera (simulador/simulador_esp32.py del backend, con su mqtt_minimo.py al lado) para el paso
// de la salud con --falla temperatura. Sin la variable el paso se omite. Ver docs/HUMO.md.
const SIMULADOR = process.env.SIMULADOR || "";

const RAIZ = FRONT_API ? `${FRONT}/?api=${encodeURIComponent(FRONT_API)}` : `${FRONT}/`;

const sufijo = Date.now().toString(36);
const ana = { nombre: "Ana Humo", correo: `ana.${sufijo}@humo.test`, clave: "clave-ana-123" };
const beto = { nombre: "Beto Humo", correo: `beto.${sufijo}@humo.test`, clave: "clave-beto-123" };

const resultados = [];
let navegador;
const erroresDeConsola = [];
// Páginas a las que un paso les corta la red a propósito (route.abort): su ERR_FAILED es esperado.
const redCortada = new Set();

// OMITIR="texto1|texto2": pasos cuyo nombre contiene alguno de esos textos se saltan (con aviso). Sirve contra una base
// ajena donde un paso no se puede cumplir (p. ej. crear especies si la secuencia de ids de la base ya choca).
const OMITIR = (process.env.OMITIR || "").split("|").filter(Boolean);

async function paso(nombre, fn) {
  if (OMITIR.some((x) => nombre.includes(x))) {
    resultados.push({ nombre, ok: true, omitido: true });
    console.log(`  omit ${nombre}`);
    return;
  }
  const t0 = Date.now();
  try {
    await fn();
    resultados.push({ nombre, ok: true });
    console.log(`  ok   ${nombre} (${Date.now() - t0} ms)`);
  } catch (error) {
    resultados.push({ nombre, ok: false, error });
    console.log(`  FALLA ${nombre}\n        ${String(error.message).split("\n").slice(0, 4).join(" / ")}`);
    throw error;
  }
}

async function nuevoContexto(etiqueta, opciones = {}) {
  // bypassCSP: Playwright evalúa con eval() los textos de waitForFunction y la CSP de la página (sin
  // 'unsafe-eval') lo bloquearía. La CSP real se comprueba aparte, en el paso «la CSP no bloquea nada».
  const { tour = false, csp, ...resto } = opciones;
  const contexto = await navegador.newContext({ viewport: { width: 1100, height: 900 }, bypassCSP: csp !== true, ...resto });
  // El recorrido guiado (F39) tapa la pantalla la primera vez: el humo lo apaga con su clave de almacenamiento,
  // salvo en el contexto del paso que lo recorre (`tour: true`).
  if (!tour) await contexto.addInitScript(() => { try { localStorage.setItem("fito.tour", "no"); } catch { /* sin almacenamiento */ } });
  const pagina = await contexto.newPage();
  pagina.on("pageerror", (e) => erroresDeConsola.push(`[${etiqueta}] pageerror: ${e.message}`));
  pagina.on("console", (m) => {
    if (m.type() !== "error" || /status of (4\d\d)/.test(m.text())) return;
    if (redCortada.has(etiqueta) && /ERR_FAILED/.test(m.text())) return;
    erroresDeConsola.push(`[${etiqueta}] ${m.text()}`);
  });
  pagina.etiqueta = etiqueta;
  return pagina;
}

// CAPTURAS=carpeta: en pasos marcados guarda una imagen a 390x844 y otra a 1280x800 (pulido visual). Sin la variable no hace nada.
async function capturar(pagina, nombre, espera = 900) {
  if (!process.env.CAPTURAS) return;
  const original = pagina.viewportSize();
  for (const [tam, v] of [["movil", { width: 390, height: 844 }], ["escritorio", { width: 1280, height: 800 }]]) {
    await pagina.setViewportSize(v);
    await pagina.waitForTimeout(espera);
    await pagina.screenshot({ path: `${process.env.CAPTURAS}/${nombre}-${tam}.png`, fullPage: true });
  }
  await pagina.setViewportSize(original);
}
const hash = (pagina) => new URL(pagina.url()).hash;
// Los enlaces de los correos y de «Compartir» llevan el origen que configuró el backend (FITO_FRONT_URL); el humo los abre
// en el FRONT que está probando, conservando la ruta y el token.
const enElFront = (enlace) => `${RAIZ}${enlace.slice(enlace.indexOf("#"))}`;
const esperarHash = (pagina, patron) => pagina.waitForFunction((p) => new RegExp(p).test(location.hash), patron.source, { timeout: 10000 });
const toast = (pagina, texto) => pagina.locator(".toast", { hasText: texto }).first().waitFor({ timeout: 10000 });
const confirmarDialogo = (pagina) => pagina.locator("dialog[open] [data-confirmar]").click();

async function registrarPorUi(pagina, u) {
  await pagina.goto(`${RAIZ}#/registro`);
  await pagina.fill("#registro-nombre", u.nombre);
  await pagina.fill("#registro-correo", u.correo);
  await pagina.fill("#registro-contrasena", u.clave);
  await pagina.click("#btn-registrar");
  await esperarHash(pagina, /^#\/plantas$/);
}

async function entrarPorUi(pagina, correo, clave) {
  await pagina.goto(`${RAIZ}#/entrar`);
  await pagina.fill("#entrar-correo", correo);
  await pagina.fill("#entrar-contrasena", clave);
  await pagina.click("#btn-entrar");
}

async function tokenDe(pagina) {
  return pagina.evaluate(() => JSON.parse(sessionStorage.getItem("fitodiagnostico.sesion")).token);
}

async function api(token, metodo, ruta, cuerpo) {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await r.text();
  return { status: r.status, cuerpo: texto ? JSON.parse(texto) : null };
}

// El chip: pide un reto y responde base64(HMAC-SHA256(clave = secreto como texto, mensaje = reto como texto)).
const respuestaDelChip = (secreto, reto) => createHmac("sha256", secreto).update(reto).digest("base64");

async function chipPideCredencial({ serial, secreto }) {
  const reto = await api(null, "POST", `/dispositivos/${serial}/reto`);
  assert.equal(reto.status, 200, JSON.stringify(reto.cuerpo));
  return api(null, "POST", `/dispositivos/${serial}/credencial`, { respuesta: respuestaDelChip(secreto, reto.cuerpo.reto) });
}

// El detalle de planta va en pestañas (F37): «Hoy», «Historial», «Matera» y «Más». Lo que no es de la pestaña a la
// vista está oculto, así que antes de usar algo el humo va a su pestaña (y, en «Más», abre su sección plegable).
async function irAPestana(pagina, clave) {
  const boton = pagina.locator(`#pestana-${clave}`);
  await boton.waitFor();
  if ((await boton.getAttribute("aria-selected")) !== "true") await boton.click();
  await pagina.locator(`#panel-${clave}:not([hidden])`).waitFor();
}

async function abrirSeccion(pagina, id) {
  await irAPestana(pagina, "mas");
  const seccion = pagina.locator(`#${id}`);
  await seccion.waitFor();
  if ((await seccion.getAttribute("open")) === null) await seccion.locator("summary").first().click();
}

async function medirPorUi(pagina, h, l, t) {
  await abrirSeccion(pagina, "seccion-medir");
  await pagina.fill("#med-humedad", String(h));
  await pagina.fill("#med-luz", String(l));
  await pagina.fill("#med-temperatura", String(t));
  await pagina.click("#btn-registrar-medicion");
}

async function mailpitDisponible() {
  try {
    return (await fetch(`${MAILPIT}/api/v1/messages`)).ok;
  } catch {
    return false;
  }
}

async function ultimoCorreoPara(correo, asunto) {
  for (let i = 0; i < 20; i++) {
    const lista = await (await fetch(`${MAILPIT}/api/v1/messages`)).json();
    const m = lista.messages.find((x) => x.To.some((d) => d.Address === correo) && (!asunto || x.Subject.includes(asunto)));
    if (m) return (await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json()).Text;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no llegó correo a ${correo}`);
}

async function ejecutar() {
  navegador = await chromium.launch({ executablePath: CHROME, headless: true });
  let plantaId;
  let enlaceInvitacion;
  const hayCorreo = await mailpitDisponible();
  if (!hayCorreo) console.log("  (Mailpit no disponible: se omiten los pasos de correo)");

  const pAna = await nuevoContexto("ana", { permissions: ["clipboard-read", "clipboard-write"] });
  const pBeto = await nuevoContexto("beto");
  // Control del WebSocket de Beto para simular caídas: cada conexión pasa por aquí.
  const controlWs = { bloquear: false, actual: null, cerrar() { this.actual?.close(); } };
  await pBeto.routeWebSocket(/\/ws$/, (ws) => {
    if (controlWs.bloquear) {
      ws.close();
      return;
    }
    ws.connectToServer();
    controlWs.actual = ws;
  });
  const pAdmin = await nuevoContexto("admin");

  console.log("Sin cuenta");
  await paso("la CSP de la página no bloquea nada (sin bypass): suelto + iniciar sesión sin violaciones", async () => {
    const p = await nuevoContexto("csp", { csp: true });
    const violaciones = [];
    p.on("console", (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) violaciones.push(m.text()); });
    // La raíz es la portada (F38): se mira sin violaciones y desde ella «Prueba sin cuenta» lleva al diagnóstico.
    await p.goto(`${RAIZ}`);
    await p.locator("#portada-crear").waitFor();
    await p.locator(".portada-escena .mascota").first().waitFor();
    await p.click("#portada-probar");
    await p.waitForURL(/#\/diagnostico$/); // sin esperarHash: con la CSP puesta no se puede evaluar texto en la página
    await p.locator("#especie-select option[value='helecho']").waitFor({ state: "attached" });
    await p.selectOption("#especie-select", "helecho");
    await p.fill("#suelto-humedad", "65");
    await p.fill("#suelto-luz", "600");
    await p.fill("#suelto-temperatura", "24");
    await p.click("#btn-diagnosticar");
    await p.locator("#zona-resultado .estado-global").waitFor();
    await p.goto(`${RAIZ}#/entrar`);
    await p.locator("#formulario-entrar").waitFor();
    await p.locator("#navegacion").waitFor();
    assert.deepEqual(violaciones, []);
    await p.context().close();
  });
  await paso("diagnóstico suelto funciona sin sesión y muestra el resultado", async () => {
    await pAna.goto(`${RAIZ}#/diagnostico`);
    await pAna.waitForSelector("#especie-select option[value='helecho']", { state: "attached" });
    await pAna.selectOption("#especie-select", "helecho");
    await pAna.fill("#suelto-humedad", "15");
    await pAna.fill("#suelto-luz", "800");
    await pAna.fill("#suelto-temperatura", "22");
    await pAna.click("#btn-diagnosticar");
    await pAna.locator("#zona-resultado .estado-global").waitFor();
    assert.match(await pAna.locator("#zona-resultado .estado-global").innerText(), /riesgo|Crítico|Saludable/i);
  });
  await paso("el diagnóstico suelto muestra el error del backend (campo vacío) junto al campo", async () => {
    await pAna.reload();
    await pAna.waitForSelector("#especie-select option[value='helecho']", { state: "attached" });
    await pAna.selectOption("#especie-select", "helecho");
    await pAna.fill("#suelto-humedad", "-5");
    await pAna.fill("#suelto-luz", "800");
    await pAna.fill("#suelto-temperatura", "22");
    await pAna.click("#btn-diagnosticar");
    await pAna.locator("#suelto-humedad[aria-invalid='true']").waitFor();
    assert.ok((await pAna.locator("#suelto-humedad-error").innerText()).length > 0);
  });
  await paso("una ruta protegida sin sesión manda a iniciar sesión con ?volver=", async () => {
    await pAna.goto(`${RAIZ}#/plantas`);
    await esperarHash(pAna, /^#\/entrar\?volver=/);
  });

  console.log("Sesión");
  await paso("registro por la UI inicia sesión y lleva a Mis plantas", async () => {
    await registrarPorUi(pAna, ana);
    await pAna.locator("#navegacion", { hasText: ana.nombre }).waitFor();
  });
  await paso("correo repetido: 409 con el mensaje del backend junto al campo, sin salir del formulario", async () => {
    const otra = await nuevoContexto("repetido");
    await otra.goto(`${RAIZ}#/registro`);
    await otra.fill("#registro-nombre", "Otra");
    await otra.fill("#registro-correo", ana.correo);
    await otra.fill("#registro-contrasena", "otra-clave-123");
    await otra.click("#btn-registrar");
    // El backend nombra el campo (detalle.campo = correo): el error sale junto a ese campo.
    await otra.locator("#registro-correo[aria-invalid='true']").waitFor();
    assert.match(await otra.locator("#registro-correo-error").innerText(), /ya existe una cuenta/i);
    assert.equal(hash(otra), "#/registro");
    await otra.context().close();
  });
  await paso("recargar (F5) conserva la sesión", async () => {
    await pAna.reload();
    await pAna.locator("#navegacion", { hasText: ana.nombre }).waitFor();
    assert.equal(hash(pAna), "#/plantas");
  });

  console.log("Plantas");
  await paso("registrar planta (solo especies activas) lleva al asistente de vinculación; «Hacerlo después» va al detalle y muestra «sin diagnóstico»", async () => {
    await pAna.click("#enlace-nueva-planta");
    await pAna.fill("#planta-apodo", "Lola");
    await pAna.selectOption("#planta-especie", "helecho");
    await pAna.click("#btn-registrar-planta");
    await esperarHash(pAna, /^#\/plantas\/[0-9a-f-]{36}\/vincular$/);
    plantaId = hash(pAna).split("/")[2];
    await pAna.locator("#btn-asistente-buscar").waitFor();
    assert.match(await pAna.locator("#asistente-paso-titulo").innerText(), /Enciéndela/);
    await pAna.click("#btn-asistente-despues");
    await esperarHash(pAna, /^#\/plantas\/[0-9a-f-]{36}$/);
    await pAna.locator("#sin-diagnostico").waitFor();
  });
  await paso("registrar medición manual actualiza el diagnóstico vigente y el historial", async () => {
    await medirPorUi(pAna, 65, 600, 24);
    // Registrar una medición lleva a «Hoy», donde se ve el resultado.
    await esperarHash(pAna, new RegExp(`^#/plantas/${plantaId}$`));
    await pAna.locator("#diagnostico-vigente .estado-global").waitFor();
    assert.match(await pAna.locator("#diagnostico-vigente .estado-global").innerText(), /Saludable/);
    await irAPestana(pAna, "historial");
    assert.equal(hash(pAna), `#/plantas/${plantaId}/historial`, "la pestaña vive en la URL");
    await pAna.locator("#tabla-historial tbody tr").first().waitFor();
    assert.equal(await pAna.locator("#tabla-historial tbody tr").count(), 1);
  });
  await paso("historial paginado: con 12 registros hay 2 páginas y se navega", async () => {
    const token = await tokenDe(pAna);
    for (let i = 0; i < 11; i++) {
      const r = await api(token, "POST", `/plantas/${plantaId}/mediciones`, { humedad: 62 + i, luz: 600, temperatura: 24 });
      assert.equal(r.status, 201);
    }
    await pAna.reload(); // recargar conserva la pestaña: sigue en «Historial»
    await pAna.locator("#info-pagina").waitFor();
    assert.equal(await pAna.locator("#pestana-historial").getAttribute("aria-selected"), "true");
    assert.match(await pAna.locator("#info-pagina").innerText(), /Página 1 de 2 · 12 lecturas/);
    assert.equal(await pAna.locator("#tabla-historial tbody tr").count(), 10);
    await pAna.click("#btn-pagina-siguiente");
    await pAna.waitForFunction(() => /Página 2 de 2/.test(document.querySelector("#info-pagina")?.textContent || ""));
    assert.equal(await pAna.locator("#tabla-historial tbody tr").count(), 2);
    assert.equal(await pAna.locator("#btn-pagina-siguiente").isDisabled(), true);
  });
  await paso("medición inválida: el error del backend aparece junto al campo", async () => {
    await medirPorUi(pAna, -1, 600, 24);
    await pAna.locator("#med-humedad[aria-invalid='true']").waitFor();
  });
  await paso("editar apodo", async () => {
    await abrirSeccion(pAna, "seccion-ajustes");
    await pAna.fill("#editar-apodo", "Lola la pothos");
    await pAna.click("#btn-guardar-planta");
    await pAna.waitForFunction(() => document.querySelector("#planta-nombre")?.textContent === "Lola la pothos");
  });
  await paso("planta ajena o inexistente: 404 con mensaje visible y enlace de regreso", async () => {
    await pBeto.goto(`${RAIZ}#/registro`);
    await registrarPorUi(pBeto, beto);
    await pBeto.goto(`${RAIZ}#/plantas/${plantaId}`);
    await pBeto.locator("[role=alert]:not([hidden])").first().waitFor();
    assert.match(await pBeto.locator("[role=alert]:not([hidden])").first().innerText(), /no existe|no es tuya|encontr/i);
  });

  console.log("Compartir");
  await paso("generar enlace de invitación y copiarlo al portapapeles", async () => {
    await abrirSeccion(pAna, "seccion-compartir");
    await pAna.click("#btn-generar-enlace");
    await pAna.locator("#valor-enlace").waitFor();
    enlaceInvitacion = await pAna.inputValue("#valor-enlace");
    assert.match(enlaceInvitacion, /#\/invitacion\?token=/);
    await pAna.click("#btn-copiar-enlace");
    await pAna.locator("#enlace-generado .banner-ok:not([hidden])").waitFor();
    assert.equal(await pAna.evaluate(() => navigator.clipboard.readText()), enlaceInvitacion);
    assert.equal(await pAna.locator("#lista-pendientes li").count(), 1);
  });
  await paso("el enlace del backend coincide con la ruta del front y pide aceptar con registro si no hay sesión", async () => {
    const visita = await nuevoContexto("visita");
    await visita.goto(enElFront(enlaceInvitacion));
    await visita.locator("#formulario-invitacion").waitFor();
    await visita.locator("#enlace-entrar-invitacion").waitFor();
    await visita.context().close();
  });
  await paso("aceptar con registro (visita sin cuenta): crea la cuenta, inicia sesión y abre la planta en solo lectura", async () => {
    const carlos = await nuevoContexto("carlos");
    await carlos.goto(enElFront(enlaceInvitacion));
    await carlos.fill("#inv-nombre", "Carlos Invitado");
    await carlos.fill("#inv-correo", `carlos.${sufijo}@humo.test`);
    await carlos.fill("#inv-contrasena", "clave-carlos-1");
    await carlos.click("#btn-aceptar-registro");
    await esperarHash(carlos, new RegExp(`^#/plantas/${plantaId}$`));
    await carlos.locator("#etiqueta-compartida").waitFor();
    await carlos.context().close();
    // El enlace es de un solo uso: ahora está agotado.
    assert.equal((await api(null, "POST", "/invitaciones/aceptar-con-registro", { token: enlaceInvitacion.split("token=")[1], nombre: "X", correo: "x@x.co", contrasena: "clave-x-1234" })).status, 410);
  });
  let enlaceBeto;
  await paso("aceptar con sesión (otro usuario): ve la planta y no tiene botones de modificar", async () => {
    await abrirSeccion(pAna, "seccion-compartir");
    await pAna.click("#btn-generar-enlace");
    await pAna.waitForFunction((anterior) => document.querySelector("#valor-enlace")?.value !== anterior, enlaceInvitacion);
    enlaceBeto = await pAna.inputValue("#valor-enlace");
    await pBeto.goto(enElFront(enlaceBeto));
    await pBeto.click("#btn-aceptar-invitacion");
    await esperarHash(pBeto, new RegExp(`^#/plantas/${plantaId}$`));
    await pBeto.locator("#etiqueta-compartida").waitFor();
    for (const id of ["#btn-registrar-medicion", "#btn-eliminar-planta", "#btn-guardar-planta", "#btn-generar-enlace"]) {
      assert.equal(await pBeto.locator(id).count(), 0, `${id} no debe existir para un invitado`);
    }
    assert.equal(await pBeto.locator("#pestana-matera").count(), 0, "el invitado no tiene la pestaña «Matera»");
    await irAPestana(pBeto, "mas");
    await pBeto.locator("#btn-renunciar").waitFor();
    await irAPestana(pBeto, "historial");
    await pBeto.locator("#tabla-historial").waitFor();
  });
  await paso("la lista «Compartidas conmigo» muestra la planta", async () => {
    await pBeto.goto(`${RAIZ}#/plantas`);
    await pBeto.locator("#lista-compartidas a", { hasText: "Lola la pothos" }).waitFor();
  });
  await paso("un enlace ya usado muestra el mensaje del backend (410) y no rompe la pantalla", async () => {
    await pBeto.goto(enElFront(enlaceBeto));
    await pBeto.click("#btn-aceptar-invitacion");
    await pBeto.locator("[role=alert]:not([hidden])").first().waitFor();
    assert.match(await pBeto.locator("[role=alert]:not([hidden])").first().innerText(), /ya|usad|acept|vigente|no/i);
  });
  await paso("revocar una invitación pendiente", async () => {
    await pAna.reload();
    await abrirSeccion(pAna, "seccion-compartir");
    await pAna.locator("#btn-generar-enlace").waitFor();
    await pAna.click("#btn-generar-enlace");
    await pAna.waitForFunction(() => document.querySelectorAll("#lista-pendientes li").length >= 1);
    const antes = await pAna.locator("#lista-pendientes li").count();
    // F23: revocar no pide confirmación; sale de la lista ya y el toast permite deshacer antes de que salga la petición.
    await pAna.locator("[data-accion=revocar-invitacion]").first().click();
    assert.equal(await pAna.locator("dialog[open]").count(), 0, "revocar una invitación ya no pide confirmación");
    await pAna.locator(".toast--deshacer[role=status]", { hasText: "Invitación revocada" }).waitFor();
    await pAna.waitForFunction((n) => document.querySelectorAll("#lista-pendientes li").length < n || /No hay invitaciones/.test(document.querySelector("#lista-pendientes").textContent), antes);
    await pAna.locator(".toast--deshacer [data-accion=deshacer]").click();
    await pAna.waitForFunction((n) => document.querySelectorAll("#lista-pendientes li").length === n, antes);
    // Sin deshacer, pasado el plazo sale el DELETE y la invitación se va de verdad.
    const peticion = pAna.waitForResponse((r) => r.request().method() === "DELETE" && /\/invitaciones\//.test(r.url()), { timeout: 15000 });
    await pAna.locator("[data-accion=revocar-invitacion]").first().click();
    assert.equal((await peticion).status(), 204);
    await pAna.waitForFunction((n) => document.querySelectorAll("#lista-pendientes li").length < n || /No hay invitaciones/.test(document.querySelector("#lista-pendientes").textContent), antes);
  });

  console.log("Vista en vivo");
  await paso("el indicador de conexión llega a «activa» en el detalle", async () => {
    await pBeto.goto(`${RAIZ}#/plantas/${plantaId}`);
    await pBeto.locator("#indicador-planta[data-estado=conectado]").waitFor({ timeout: 10000 });
    await pAna.locator("#indicador-planta[data-estado=conectado]").waitFor({ timeout: 10000 });
  });
  await paso("una medición del dueño actualiza al invitado SIN recargar la página", async () => {
    await pBeto.evaluate(() => { window.__sinRecarga = "sigo aqui"; });
    const antes = await pBeto.locator("#diagnostico-vigente .estado-global").innerText();
    await medirPorUi(pAna, 5, 60, 5); // fuera de rango en las tres: crítico
    await pBeto.waitForFunction((a) => {
      const t = document.querySelector("#diagnostico-vigente .estado-global")?.textContent;
      return t && t !== a;
    }, antes, { timeout: 15000 });
    assert.match(await pBeto.locator("#diagnostico-vigente .estado-global").innerText(), /Crítico|En riesgo/);
    assert.equal(await pBeto.evaluate(() => window.__sinRecarga), "sigo aqui", "la página se recargó");
    await pBeto.waitForFunction(() => /13 lecturas/.test(document.querySelector("#info-pagina")?.textContent || ""));
  });
  await paso("sondeo: si la API falla el indicador lo dice sin toasts y, al volver, recupera lo que pasó mientras tanto", async () => {
    await pBeto.evaluate(() => { window.__sinRecarga = "sigo aqui"; });
    await medirPorUi(pAna, 65, 600, 24);
    await pBeto.locator("#diagnostico-vigente .estado-global", { hasText: "Saludable" }).waitFor({ timeout: 15000 });
    // La consulta del vigente falla; mientras tanto Ana mide y Beto no se entera.
    redCortada.add(pBeto.etiqueta);
    await pBeto.route(/\/plantas\/[^/]+\/diagnostico$/, (ruta) => ruta.abort());
    await pBeto.locator("#indicador-planta[data-estado=reconectando]").waitFor({ timeout: 15000 });
    await medirPorUi(pAna, 5, 60, 5); // crítico
    await pAna.locator("#diagnostico-vigente .estado-global", { hasText: /Crítico|En riesgo/ }).waitFor();
    assert.match(await pBeto.locator("#diagnostico-vigente .estado-global").innerText(), /Saludable/, "no debía enterarse aún");
    // F55: el aviso en vivo CAMBIO_DE_ESTADO sí trae su toast («cambió de estado»); los del sondeo no deben existir.
    assert.equal(await pBeto.locator(".toast").filter({ hasNotText: "cambió de estado" }).count(), 0, "el sondeo no debe apilar toasts");
    // Vuelve la API: el siguiente sondeo (con espera creciente) trae lo nuevo.
    await pBeto.unroute(/\/plantas\/[^/]+\/diagnostico$/);
    await pBeto.locator("#indicador-planta[data-estado=conectado]").waitFor({ timeout: 30000 });
    redCortada.delete(pBeto.etiqueta); // ya volvió: cualquier ERR_FAILED desde aquí sí es falla
    await pBeto.locator("#diagnostico-vigente .estado-global", { hasText: /Crítico|En riesgo/ }).waitFor({ timeout: 15000 });
    assert.equal(await pBeto.evaluate(() => window.__sinRecarga), "sigo aqui", "la página se recargó");
  });
  const dispositivo = { serial: `fito-H${sufijo.slice(-5).toUpperCase()}`, secreto: null };
  await paso("fábrica: el admin registra un dispositivo por API y el chip aún no recibe credencial (409 sin reclamar)", async () => {
    const sesionAdmin = await api(null, "POST", "/auth/sesion", { correo: ADMIN_CORREO, contrasena: ADMIN_CLAVE });
    assert.equal(sesionAdmin.status, 200);
    const creado = await api(sesionAdmin.cuerpo.token, "POST", "/admin/dispositivos", { serial: dispositivo.serial });
    assert.equal(creado.status, 201);
    assert.equal(creado.cuerpo.serial, dispositivo.serial);
    assert.ok(creado.cuerpo.secreto.length >= 32, "el secreto debe venir en la respuesta");
    dispositivo.secreto = creado.cuerpo.secreto;
    assert.equal((await api(sesionAdmin.cuerpo.token, "POST", "/admin/dispositivos", { serial: dispositivo.serial })).cuerpo.error, "DISPOSITIVO_YA_EXISTE");
    const credencial = await chipPideCredencial(dispositivo);
    assert.equal(credencial.status, 409);
    assert.equal(credencial.cuerpo.error, "DISPOSITIVO_SIN_RECLAMAR");
  });
  await paso("reclamar dispositivo (dueño): escribe el serial, ve «esperando que se conecte», sin token en pantalla; el invitado no ve la sección", async () => {
    await irAPestana(pAna, "matera");
    await pAna.locator("#enlace-asistente").waitFor();   // «Vincular una matera» lleva al asistente
    await pAna.locator("summary", { hasText: "escribir el código a mano" }).click();
    assert.equal(await pAna.locator("#disp-serial").getAttribute("placeholder"), "YUBUD6");
    assert.match(await pAna.locator("label[for=disp-serial]").innerText(), /Código de la matera/);
    await pAna.fill("#disp-serial", "no");
    await pAna.click("#btn-vincular-dispositivo");
    assert.equal((await pAna.locator("#disp-serial-error").innerText()).trim(), "El código tiene 6 letras y números");
    await pAna.fill("#disp-serial", "noexis");
    await pAna.click("#btn-vincular-dispositivo");
    // Serial inexistente (404): el error sale junto al campo si el cuerpo nombra «serial», si no en la zona de alerta.
    await pAna.locator("#disp-serial[aria-invalid=true], #formulario-dispositivo [role=alert]:not([hidden])").first().waitFor();
    // El dueño puede escribir el código como quiera: en minúsculas y con el prefijo, por ejemplo.
    await pAna.fill("#disp-serial", dispositivo.serial.toLowerCase());
    await pAna.click("#btn-vincular-dispositivo");
    const fila = pAna.locator(`#lista-dispositivos li[data-serial="${dispositivo.serial}"]`);
    await fila.waitFor();
    assert.match(await fila.innerText(), /esperando que se conecte/);
    assert.doesNotMatch(await fila.locator("strong").innerText(), /fito-/, "al dueño se le muestra el código, sin prefijo");
    assert.equal((await fila.locator("strong").innerText()).trim(), dispositivo.serial.slice(5));
    assert.equal(await pAna.locator("#valor-token").count(), 0, "el front ya no muestra tokens");
    assert.doesNotMatch(await pAna.locator("#formulario-dispositivo").locator("xpath=..").innerText(), /FITO_TOKEN_DISPOSITIVO/);
    assert.equal(await pBeto.locator("#formulario-dispositivo").count(), 0);
    assert.equal(await pBeto.locator("#lista-dispositivos").count(), 0);
  });
  await paso("el humo hace de chip (reto + HMAC + credencial) y el front pasa a «conectado hace Xs» con el sondeo", async () => {
    const credencial = await chipPideCredencial(dispositivo);
    assert.equal(credencial.status, 200, JSON.stringify(credencial.cuerpo));
    assert.equal(credencial.cuerpo.plantaId, plantaId);
    assert.ok(credencial.cuerpo.token && credencial.cuerpo.expira);
    // El reto es de un solo uso: repetir la misma respuesta ya no sirve.
    const reto = (await api(null, "POST", `/dispositivos/${dispositivo.serial}/reto`)).cuerpo.reto;
    const respuesta = respuestaDelChip(dispositivo.secreto, reto);
    assert.equal((await api(null, "POST", `/dispositivos/${dispositivo.serial}/credencial`, { respuesta })).status, 200);
    assert.equal((await api(null, "POST", `/dispositivos/${dispositivo.serial}/credencial`, { respuesta })).cuerpo.error, "CREDENCIAL_RECHAZADA");
    // Con el token del chip se puede reportar una lectura (como el simulador).
    const lectura = await api(credencial.cuerpo.token, "POST", `/dispositivos/${dispositivo.serial}/lecturas`, { marcaDeTiempo: new Date().toISOString(), humedad: 65, luz: 600, temperatura: 24 });
    assert.ok(lectura.status >= 200 && lectura.status < 300, `lectura ${lectura.status}`);
    // Sin recargar: el sondeo de 5 s trae ultimaCredencialEn.
    await pAna.locator(`#lista-dispositivos li[data-serial="${dispositivo.serial}"]`, { hasText: /conectado hace \d+ s/ }).waitFor({ timeout: 15000 });
  });
  await paso("quitar el acceso al invitado: recibe el aviso en vivo y sale de la planta", async () => {
    await abrirSeccion(pAna, "seccion-compartir");
    await pAna.locator("#lista-invitados li", { hasText: beto.nombre }).locator("[data-accion=revocar-invitado]").click();
    await confirmarDialogo(pAna);
    await esperarHash(pBeto, /^#\/plantas$/);
    await toast(pBeto, "Perdiste el acceso");
  });

  console.log("Solicitudes de especie y administración");
  await paso("un cliente no ve el menú de administración y /admin le dice que no tiene permiso", async () => {
    assert.equal(await pAna.locator("#navegacion a", { hasText: "Administración" }).count(), 0);
    await pAna.goto(`${RAIZ}#/admin/usuarios`);
    await pAna.locator("text=solo para administradores").waitFor();
  });
  await paso("enviar solicitud de especie y verla pendiente", async () => {
    await pAna.goto(`${RAIZ}#/solicitudes`);
    await pAna.fill("#solicitud-nombre", `orquidea-${sufijo}`);
    await pAna.fill("#solicitud-justificacion", "la tengo en casa");
    await pAna.click("#btn-enviar-solicitud");
    await pAna.locator("#lista-solicitudes .solicitud-item", { hasText: `orquidea-${sufijo}` }).waitFor();
    assert.match(await pAna.locator("#lista-solicitudes .solicitud-item").first().innerText(), /Pendiente/);
  });
  await paso("el administrador inicia sesión y ve el menú", async () => {
    await entrarPorUi(pAdmin, ADMIN_CORREO, ADMIN_CLAVE);
    await esperarHash(pAdmin, /^#\/plantas$/);
    await pAdmin.locator("#navegacion a", { hasText: "Administración" }).waitFor();
  });
  await paso("admin: dispositivos de fábrica (lista con estado y planta; registrar muestra serial y secreto una vez con el comando del simulador)", async () => {
    await pAdmin.locator("#navegacion a", { hasText: "Administración" }).click();
    await pAdmin.locator("a[href='#/admin/dispositivos']").click();
    const fila = pAdmin.locator(`#tabla-dispositivos tr[data-serial="${dispositivo.serial}"]`);
    await fila.waitFor();
    assert.match(await fila.innerText(), /Reclamado/);
    assert.match(await fila.innerText(), new RegExp(plantaId));
    assert.match(await fila.innerText(), /conectado/);
    await pAdmin.click("#btn-registrar-dispositivo"); // sin serial: lo genera el servidor
    await pAdmin.locator("#valor-secreto").waitFor();
    const serialNuevo = await pAdmin.inputValue("#valor-serial");
    const secretoNuevo = await pAdmin.inputValue("#valor-secreto");
    assert.match(serialNuevo, /^fito-[A-Z0-9]{6}$/);
    assert.equal(await pAdmin.inputValue("#valor-comando"), `FITO_SERIAL=${serialNuevo} FITO_SECRETO=${secretoNuevo} python3 simulador/simulador_esp32.py --especie helecho`);
    await pAdmin.click("#btn-copiar-secreto");
    await pAdmin.locator("#dispositivo-registrado .banner-ok:not([hidden])").first().waitFor();
    await pAdmin.locator(`#tabla-dispositivos tr[data-serial="${serialNuevo}"]`, { hasText: "Sin reclamar" }).waitFor();
    // Registrar uno con serial repetido: error junto al campo.
    await pAdmin.fill("#fab-serial", serialNuevo);
    await pAdmin.click("#btn-registrar-dispositivo");
    await pAdmin.locator("#fab-serial[aria-invalid=true], #formulario-fabrica [role=alert]:not([hidden])").first().waitFor();
    // Un cliente no entra a esta vista.
    await pAna.goto(`${RAIZ}#/admin/dispositivos`);
    await pAna.locator("text=solo para administradores").waitFor();
  });
  await paso("QR del sticker: el admin registra un dispositivo y Ana lo vincula abriendo #/vincular?serial=", async () => {
    await pAdmin.fill("#fab-serial", "");
    await pAdmin.click("#btn-registrar-dispositivo");
    await pAdmin.locator("#sticker-qr svg.qr path[d]").waitFor();
    assert.equal(await pAdmin.locator("#sticker-qr svg.qr").getAttribute("role"), "img");
    const serialQr = (await pAdmin.locator("#sticker-serial").innerText()).trim();
    assert.match(serialQr, /^fito-[A-Z0-9]{6}$/);
    assert.equal(await pAdmin.locator("#btn-imprimir-sticker").count(), 1);
    await pAna.goto(`${RAIZ}#/vincular?serial=${serialQr}`);
    assert.equal((await pAna.locator("#vincular-serial").innerText()).trim(), serialQr.slice(5), "se muestra el código, sin el prefijo");
    assert.equal(await pAna.locator("#vincular-serial").getAttribute("data-serial"), serialQr);
    await pAna.locator("#vincular-planta").selectOption(plantaId);
    await pAna.click("#btn-vincular-a-planta");
    await esperarHash(pAna, new RegExp(`^#/plantas/${plantaId}$`));
    await irAPestana(pAna, "matera");
    await pAna.locator(`#lista-dispositivos li[data-serial="${serialQr}"]`, { hasText: "esperando que se conecte" }).waitFor();
    // Sin sesión, la ruta manda a entrar y conserva el serial para volver.
    const anonimo = await nuevoContexto("qr-anonimo");
    await anonimo.goto(`${RAIZ}#/vincular?serial=${serialQr}`);
    await esperarHash(anonimo, /^#\/entrar\?volver=/);
    assert.match(decodeURIComponent(hash(anonimo)), /\/vincular\?serial=fito-/);
    await anonimo.context().close();
  });
  console.log("Asistente de vinculación");
  const tokenAdmin = async () => (await api(null, "POST", "/auth/sesion", { correo: ADMIN_CORREO, contrasena: ADMIN_CLAVE })).cuerpo.token;
  let serieMateras = 0;
  async function materaDeFabrica() {
    const serial = `fito-J${sufijo.slice(-4).toUpperCase()}${serieMateras++}`;
    const creado = await api(await tokenAdmin(), "POST", "/admin/dispositivos", { serial });
    assert.equal(creado.status, 201, JSON.stringify(creado.cuerpo));
    return { serial, secreto: creado.cuerpo.secreto };
  }
  // La matera le habla al servidor DESDE el mismo navegador que usa el celular: así comparten dirección de red sin
  // depender de cómo resuelva «localhost» cada cliente.
  const materaHabla = (pagina, serial) => pagina.evaluate(async ([api, s]) => (await fetch(`${api}/dispositivos/${s}/reto`, { method: "POST" })).status, [API, serial]);
  await paso("asistente: sin matera cerca aparece «No encontramos tu matera» con la ayuda y «Escribir el código» siempre funciona", async () => {
    await pAna.goto(`${RAIZ}#/plantas/${plantaId}/vincular?espera=1500`);
    await pAna.click("#btn-asistente-buscar");
    await pAna.locator(".asis-radar").waitFor();
    await pAna.locator("[data-estado=sin-hallazgo], #asistente-enmascarado").first().waitFor({ timeout: 15000 });
    if (await pAna.locator("#asistente-enmascarado").count()) {
      console.log("        (hay una matera real sin dueño cerca: se omite la comprobación de «No encontramos tu matera»)");
      return;
    }
    assert.match(await pAna.locator("#asistente-paso-titulo").innerText(), /No encontramos tu matera/);
    assert.match(await pAna.locator("#asistente-anuncio").innerText(), /No encontramos tu matera/);
    assert.equal(await pAna.locator(".asistente-ayuda-item").count(), 5);
    assert.ok(await pAna.locator(".asis-triste").count() >= 1, "la planta triste");
    await capturar(pAna, "asistente-no-encontramos");
    await pAna.locator("#btn-asistente-reintentar").waitFor();
    await pAna.click("#btn-asistente-escribir");
    await pAna.locator("#asistente-codigo").waitFor();
    assert.match(await pAna.locator("#asistente-paso-titulo").innerText(), /Dinos cuál es tu matera/);
  });
  await paso("asistente: la matera aparece («Encontramos una matera»), se escribe el código y llega «Conexión exitosa»", async () => {
    const matera = await materaDeFabrica();
    await pAna.goto(`${RAIZ}#/plantas/${plantaId}/vincular`);
    await pAna.reload();
    await pAna.click("#btn-asistente-buscar");
    assert.equal(await materaHabla(pAna, matera.serial), 200);
    await pAna.locator("#asistente-enmascarado").waitFor({ timeout: 15000 });
    assert.match((await pAna.locator("#asistente-enmascarado").innerText()).trim(), /^[A-Z0-9]{2}····$/, "enmascarado sin el prefijo fito-");
    assert.match(await pAna.locator("#asistente-encontramos").innerText(), /Encontramos una matera/);
    assert.equal(await pAna.locator("#asistente-codigo").getAttribute("aria-label").then((x) => /6 letras y números/.test(x)), true);
    // Un código de otra matera se rechaza antes de molestar al servidor.
    await pAna.fill("#asistente-codigo", "zzzzzz");
    await pAna.click("#btn-asistente-vincular");
    assert.match(await pAna.locator("#asistente-codigo-error").innerText(), /no es de la matera que encontramos/);
    await pAna.fill("#asistente-codigo", matera.serial.toLowerCase());   // con prefijo y en minúsculas: se normaliza
    assert.equal((await pAna.locator(".casilla").allInnerTexts()).join(""), matera.serial.slice(5));
    await pAna.click("#btn-asistente-vincular");
    await pAna.locator("#asistente-conectando-texto").waitFor();
    assert.equal((await chipPideCredencial(matera)).status, 200);
    await pAna.locator("#btn-asistente-ver").waitFor({ timeout: 20000 });
    assert.match(await pAna.locator("#asistente-paso-titulo").innerText(), /Conexión exitosa/);
    assert.match(await pAna.locator("#asistente-anuncio").innerText(), /Conexión exitosa/);
    await capturar(pAna, "asistente-exito", 2500);
    await pAna.click("#btn-asistente-ver");
    await esperarHash(pAna, new RegExp(`^#/plantas/${plantaId}$`));
    await irAPestana(pAna, "matera");
    await pAna.locator(`#lista-dispositivos li[data-serial="${matera.serial}"]`, { hasText: /conectado/ }).waitFor({ timeout: 15000 });
  });
  await paso("asistente: el QR (#/v/CÓDIGO) con la planta recordada vincula directo y salta a «Conectando»", async () => {
    const matera = await materaDeFabrica();
    await pAna.goto(`${RAIZ}#/plantas/${plantaId}/vincular`);
    await pAna.locator("#btn-asistente-buscar").waitFor();
    await pAna.evaluate((c) => { location.hash = `#/v/${c}`; }, matera.serial.slice(5).toLowerCase());
    await pAna.locator("#asistente-conectando-texto").waitFor({ timeout: 15000 });
    assert.match(hash(pAna), new RegExp(`^#/plantas/${plantaId}/vincular\\?serial=`));
    assert.equal((await chipPideCredencial(matera)).status, 200);
    await pAna.locator("#btn-asistente-ver").waitFor({ timeout: 20000 });
    await pAna.click("#btn-asistente-ver");
    await esperarHash(pAna, new RegExp(`^#/plantas/${plantaId}$`));
  });
  await paso("lector de QR dentro de la app, por el camino de la foto: un QR de Wi-Fi o ajeno se explica y el de la matera vincula sin navegar a su enlace", async () => {
    const matera = await materaDeFabrica();
    const codigo = matera.serial.slice(5);
    await pAna.goto(`${RAIZ}#/plantas/${plantaId}/vincular`);
    await pAna.click("#btn-asistente-a-mano");
    await pAna.click("#opcion-qr");
    await pAna.locator("#lector-foto").waitFor({ state: "attached" });
    await pAna.locator("#btn-lector-foto").waitFor();
    // La «foto» es un PNG de un QR armado aquí mismo (tests/humo/qr-png.mjs).
    const foto = (nombre, texto, opciones) => ({ name: nombre, mimeType: "image/png", buffer: pngDeQr(texto, opciones) });
    await pAna.setInputFiles("#lector-foto", foto("wifi.png", `WIFI:S:Fito-${codigo};T:nopass;;`));
    await pAna.locator("#lector-estado", { hasText: "Wi-Fi de la matera" }).waitFor();
    await pAna.setInputFiles("#lector-foto", foto("ajeno.png", "https://example.com/promo"));
    await pAna.locator("#lector-estado", { hasText: "Ese QR no es de una matera" }).waitFor();
    assert.equal(hash(pAna), `#/plantas/${plantaId}/vincular`, "un QR ajeno no lleva a ningún lado");
    // El QR de la pantalla de la matera, claro sobre oscuro como en la OLED y con otro host: solo se usa su código.
    const reclamo = pAna.waitForResponse((r) => r.request().method() === "POST" && r.url().includes(`/plantas/${plantaId}/dispositivos`));
    await pAna.setInputFiles("#lector-foto", foto("matera.png", `http://192.168.43.105:5500/#/v/${codigo}`, { invertido: true }));
    await pAna.locator("#asistente-conectando-texto").waitFor({ timeout: 15000 });
    assert.match(await pAna.locator("#asistente-conectando-texto").innerText(), new RegExp(codigo));
    assert.equal(hash(pAna), `#/plantas/${plantaId}/vincular`, "no se navega a la URL leída");
    assert.ok((await reclamo).ok(), "el reclamo salió con el código leído del QR");
    assert.equal((await chipPideCredencial(matera)).status, 200);
    await pAna.locator("#btn-asistente-ver").waitFor({ timeout: 20000 });
  });
  await paso("planta carnívora (especie «atrapamoscas»): su mascota es la carnívora, y la tocas para que salude", async () => {
    const especies = (await api(null, "GET", "/especies")).cuerpo;
    if (!especies.some((e) => e.nombre === "atrapamoscas")) {
      console.log("        (la especie «atrapamoscas» no existe en esta base: se omite)");
      return;
    }
    const sesionAna = await tokenDe(pAna);
    const creada = await api(sesionAna, "POST", "/plantas", { apodo: "Chompy", especie: "atrapamoscas" });
    assert.equal(creada.status, 201);
    await pAna.goto(`${RAIZ}#/plantas/${creada.cuerpo.id}`);
    await pAna.locator(".cabecera-planta .mascota--carnivora").first().waitFor();
    assert.equal(await pAna.locator(".cabecera-planta .mascota-toque[role='button'][aria-label^='Saludar a']").count(), 1);
    await pAna.goto(`${RAIZ}#/plantas`);
    await pAna.locator(".tarjeta-planta .mascota--carnivora").first().waitFor();
    assert.equal(await pAna.locator(".tarjeta-planta .mascota:not(.mascota--carnivora)").count() >= 1, true);
    await api(sesionAna, "DELETE", `/plantas/${creada.cuerpo.id}`);
  });
  await paso("tablero: la mascota saluda sin navegar, la tarjeta sí navega, y no hay botón dentro de un enlace (F51)", async () => {
    const sesionAna = await tokenDe(pAna);
    const creada = await api(sesionAna, "POST", "/plantas", { apodo: "Toquecito", especie: "girasol" });
    assert.equal(creada.status, 201);
    await pAna.goto(`${RAIZ}#/plantas`);
    await pAna.reload(); // la planta se creó por la API: sin recargar, el tablero que ya estaba montado no la trae
    const tarjeta = pAna.locator(".tarjeta-planta-item", { hasText: "Toquecito" });
    await tarjeta.locator(".mascota-toque").waitFor();
    assert.equal(await pAna.locator("a [role='button'], a button, a a").count(), 0, "contenido interactivo anidado en un enlace");
    // El enlace es el apodo; su nombre accesible es solo el apodo.
    assert.equal(await tarjeta.locator("a.tarjeta-planta-enlace").innerText(), "Toquecito");
    await tarjeta.locator(".mascota-toque").click();
    await pAna.waitForTimeout(300);
    assert.equal(hash(pAna), "#/plantas", "tocar la mascota no debe navegar");
    await tarjeta.locator(".mascota-toque").focus();
    await pAna.keyboard.press("Enter");
    await pAna.waitForTimeout(300);
    assert.equal(hash(pAna), "#/plantas", "Enter en la mascota no debe navegar");
    // Tab desde la mascota llega al enlace del mismo renglón; Enter navega.
    await pAna.keyboard.press("Tab");
    assert.equal(await pAna.evaluate(() => document.activeElement.className), "tarjeta-planta-enlace");
    await pAna.keyboard.press("Enter");
    await esperarHash(pAna, new RegExp(`^#/plantas/${creada.cuerpo.id}$`));
    // Tocar en cualquier otra parte de la tarjeta (el hueco de las lecturas) también abre el detalle.
    await pAna.goto(`${RAIZ}#/plantas`);
    await pAna.locator(".tarjeta-planta-item", { hasText: "Toquecito" }).locator(".tarjeta-planta-cuando").waitFor();
    await pAna.waitForTimeout(1200); // la entrada escalonada de las tarjetas mueve las cajas: se espera a que se asienten
    // force: Playwright rechaza hacer clic en un nodo tapado por el ::after del enlace, que es justo lo que se comprueba.
    await pAna.locator(".tarjeta-planta-item", { hasText: "Toquecito" }).locator(".tarjeta-planta-cuando").click({ force: true });
    await esperarHash(pAna, new RegExp(`^#/plantas/${creada.cuerpo.id}$`));
    await api(sesionAna, "DELETE", `/plantas/${creada.cuerpo.id}`);
  });
  await paso("carrusel de especies por teclado: Tab llega a la elegida, las flechas cambian la especie y Tab sale del grupo (F52)", async () => {
    await pAna.goto(`${RAIZ}#/diagnostico`);
    await pAna.locator(".carrusel-tarjeta[aria-checked='true']").waitFor();
    assert.equal(await pAna.getByRole("radiogroup").count(), 1);
    assert.equal(await pAna.locator(".carrusel-tarjeta[tabindex='0']").count(), 1, "un solo punto de tabulación (foco itinerante)");
    const antes = await pAna.inputValue("#especie-select");
    await pAna.locator(".carrusel-tarjeta[aria-checked='true']").focus();
    await pAna.keyboard.press("ArrowRight");
    const despues = await pAna.inputValue("#especie-select");
    assert.notEqual(despues, antes, "la flecha derecha elige la siguiente");
    assert.equal(await pAna.evaluate(() => document.activeElement.getAttribute("aria-checked")), "true", "el foco acompaña a la elegida");
    await pAna.keyboard.press("ArrowLeft");
    assert.equal(await pAna.inputValue("#especie-select"), antes);
    await pAna.keyboard.press("Tab");
    assert.equal(await pAna.evaluate(() => !!document.activeElement.closest(".carrusel-pista")), false, "Tab sale del grupo");
  });
  await paso("admin: listar y buscar usuarios, ver detalle con plantas", async () => {
    await pAdmin.goto(`${RAIZ}#/admin/usuarios`);
    await pAdmin.locator("#tabla-usuarios").waitFor();
    await pAdmin.fill("#buscar-usuarios", ana.correo);
    await pAdmin.click("#btn-buscar");
    await pAdmin.waitForFunction(() => document.querySelectorAll("#tabla-usuarios tbody tr").length === 1);
    await pAdmin.locator("#tabla-usuarios a", { hasText: "Ver detalle" }).click();
    await pAdmin.locator("#plantas-usuario", { hasText: "Lola la pothos" }).waitFor();
  });
  await paso("admin: editar usuario y dar / quitar el rol de administrador", async () => {
    await pAdmin.fill("#usuario-nombre", "Ana Editada");
    await pAdmin.click("#btn-guardar-usuario");
    await pAdmin.locator("h2[data-titulo]", { hasText: "Ana Editada" }).waitFor();
    await pAdmin.click("#btn-rol-admin");
    await pAdmin.locator("#roles-usuario", { hasText: "Administrador" }).waitFor();
    await pAdmin.click("#btn-rol-admin");
    await pAdmin.waitForFunction(() => !/Administrador/.test(document.querySelector("#roles-usuario").textContent));
  });
  await paso("admin: no puede quitarse el rol siendo el último administrador (409 visible)", async () => {
    await pAdmin.goto(`${RAIZ}#/admin/usuarios`);
    await pAdmin.fill("#buscar-usuarios", ADMIN_CORREO);
    await pAdmin.click("#btn-buscar");
    await pAdmin.waitForFunction(() => document.querySelectorAll("#tabla-usuarios tbody tr").length === 1);
    await pAdmin.locator("#tabla-usuarios a", { hasText: "Ver detalle" }).click();
    await pAdmin.locator("#btn-rol-admin", { hasText: "Quitar" }).waitFor();
    await pAdmin.click("#btn-rol-admin");
    await pAdmin.locator("[role=alert]:not([hidden])").first().waitFor();
    assert.match(await pAdmin.locator("[role=alert]:not([hidden])").first().innerText(), /último|administrador/i);
  });
  await paso("admin: crear especie, editar rangos, desactivar (ya no sale al registrar planta) y reactivar", async () => {
    await pAdmin.goto(`${RAIZ}#/admin/especies`);
    await pAdmin.locator("#tabla-especies").waitFor();
    const nombre = `monstera-${sufijo}`;
    await pAdmin.fill("#especie-nombre", nombre);
    await pAdmin.fill("#esp-humedad-min", "40");
    await pAdmin.fill("#esp-humedad-max", "70");
    await pAdmin.fill("#esp-luz-min", "300");
    await pAdmin.fill("#esp-luz-max", "1200");
    await pAdmin.fill("#esp-temperatura-min", "18");
    await pAdmin.fill("#esp-temperatura-max", "30");
    await pAdmin.click("#btn-guardar-especie");
    const fila = pAdmin.locator(`tr[data-especie="${nombre}"]`);
    await fila.waitFor();
    await fila.locator("[data-accion=editar]").click();
    await pAdmin.fill("#esp-humedad-max", "75");
    await pAdmin.click("#btn-guardar-especie");
    await pAdmin.locator(`tr[data-especie="${nombre}"]`, { hasText: "40–75 %" }).waitFor();
    await pAdmin.locator(`tr[data-especie="${nombre}"] [data-accion=desactivar]`).click();
    await pAdmin.locator(`tr[data-especie="${nombre}"] [data-accion=reactivar]`).waitFor();
    // Una planta nueva ya no ofrece la especie desactivada.
    await pAna.goto(`${RAIZ}#/plantas/nueva`);
    await pAna.locator("#planta-especie option[value='helecho']").waitFor({ state: "attached" });
    assert.equal(await pAna.locator(`#planta-especie option[value='${nombre}']`).count(), 0);
    await pAdmin.locator(`tr[data-especie="${nombre}"] [data-accion=reactivar]`).click();
    await pAdmin.locator(`tr[data-especie="${nombre}"] [data-accion=desactivar]`).waitFor();
    await pAna.reload();
    await pAna.locator(`#planta-especie option[value='${nombre}']`).waitFor({ state: "attached" });
  });
  await paso("admin aprueba la solicitud con respuesta: Ana recibe el aviso en vivo y ve el estado", async () => {
    await pAna.goto(`${RAIZ}#/solicitudes`);
    await pAna.locator("#indicador-conexion[data-estado=conectado]").waitFor({ timeout: 10000 });
    await pAdmin.goto(`${RAIZ}#/admin/solicitudes`);
    const tarjeta = pAdmin.locator(".solicitud-item", { hasText: `orquidea-${sufijo}` });
    await tarjeta.locator("textarea").fill("agregada, gracias");
    await tarjeta.locator("[data-accion=aprobar]").click();
    await esperarHash(pAdmin, /^#\/admin\/especies\?nueva=/);
    assert.equal(await pAdmin.inputValue("#especie-nombre"), `orquidea-${sufijo}`);
    await toast(pAna, "fue aprobada");
    await pAna.locator("#lista-solicitudes .solicitud-item", { hasText: "Aprobada" }).waitFor();
    assert.match(await pAna.locator("#lista-solicitudes").innerText(), /agregada, gracias/);
  });
  await paso("admin: eliminar un usuario", async () => {
    await pAdmin.goto(`${RAIZ}#/admin/usuarios`);
    await pAdmin.fill("#buscar-usuarios", beto.correo);
    await pAdmin.click("#btn-buscar");
    await pAdmin.waitForFunction(() => document.querySelectorAll("#tabla-usuarios tbody tr").length === 1);
    await pAdmin.locator("#tabla-usuarios a", { hasText: "Ver detalle" }).click();
    await pAdmin.click("#btn-eliminar-usuario");
    await confirmarDialogo(pAdmin);
    await esperarHash(pAdmin, /^#\/admin\/usuarios$/);
  });

  console.log("Perfil");
  await paso("perfil: editar datos", async () => {
    await pAna.goto(`${RAIZ}#/perfil`);
    await pAna.waitForSelector("#perfil-nombre");
    await pAna.fill("#perfil-nombre", "Ana Perfil");
    await pAna.click("#btn-guardar-perfil");
    await pAna.locator("#formulario-perfil .banner-ok:not([hidden])").waitFor();
    await pAna.locator("#navegacion", { hasText: "Ana Perfil" }).waitFor();
  });
  await paso("perfil: contraseña actual incorrecta da 400 junto al campo y NO cierra la sesión", async () => {
    await pAna.fill("#clave-actual", "no-es-esta-clave");
    await pAna.fill("#clave-nueva", "otra-clave-9999");
    await pAna.click("#btn-cambiar-clave");
    await pAna.locator("#formulario-clave [role=alert]:not([hidden]), #clave-actual-error:not(:empty)").first().waitFor();
    assert.equal(hash(pAna), "#/perfil");
    assert.ok(await pAna.evaluate(() => sessionStorage.getItem("fitodiagnostico.sesion")), "se perdió la sesión");
  });
  await paso("perfil: cambiar contraseña correctamente", async () => {
    await pAna.fill("#clave-actual", ana.clave);
    await pAna.fill("#clave-nueva", "ana-clave-nueva-1");
    await pAna.click("#btn-cambiar-clave");
    await pAna.locator("#formulario-clave .banner-ok:not([hidden])").waitFor();
    ana.clave = "ana-clave-nueva-1";
  });

  console.log("Sesión vencida y cierre");
  await paso("token inválido: 401 → vuelve a iniciar sesión con aviso y conserva la ruta", async () => {
    await pAna.evaluate(() => {
      const s = JSON.parse(sessionStorage.getItem("fitodiagnostico.sesion"));
      s.token = s.token.slice(0, -4) + "AAAA";
      sessionStorage.setItem("fitodiagnostico.sesion", JSON.stringify(s));
    });
    await pAna.goto(`${RAIZ}#/plantas`);
    await pAna.reload();
    await esperarHash(pAna, /^#\/entrar\?volver=/);
    await toast(pAna, "sesión caducó");
    await pAna.fill("#entrar-correo", ana.correo);
    await pAna.fill("#entrar-contrasena", ana.clave);
    await pAna.click("#btn-entrar");
    await esperarHash(pAna, /^#\/plantas$/);
  });
  await paso("credenciales incorrectas: 401 de login NO se confunde con sesión vencida", async () => {
    const otra = await nuevoContexto("login-malo");
    await entrarPorUi(otra, ana.correo, "incorrecta-123");
    await otra.locator("[role=alert]:not([hidden])").first().waitFor();
    assert.equal(hash(otra), "#/entrar");
    await otra.context().close();
  });
  await paso("cerrar sesión descarta el token y cierra el WebSocket", async () => {
    await pAna.click("#btn-cerrar-sesion");
    await esperarHash(pAna, /^#\/$/);
    assert.equal(await pAna.evaluate(() => sessionStorage.getItem("fitodiagnostico.sesion")), null);
    await pAna.locator("#navegacion a", { hasText: "Iniciar sesión" }).waitFor();
    // Sin sesión la raíz es la portada, con sus tres acciones.
    await pAna.locator("#portada-titulo").waitFor();
    for (const id of ["#portada-crear", "#portada-entrar", "#portada-probar"]) await pAna.locator(id).waitFor();
  });

  if (hayCorreo) {
    console.log("Correo (Mailpit)");
    await paso("recuperar contraseña: el enlace del correo abre #/restablecer y permite entrar con la nueva", async () => {
      await pAna.goto(`${RAIZ}#/recuperar`);
      await pAna.fill("#recuperar-correo", ana.correo);
      await pAna.click("#btn-recuperar");
      await pAna.locator("#formulario-recuperar ~ .banner-ok:not([hidden])").waitFor();
      const texto = await ultimoCorreoPara(ana.correo, "Restablece"); // con asunto: a Ana también le llegan correos de aviso
      const enlace = texto.match(/https?:\/\/\S+restablecer\?token=\S+/)[0];
      assert.match(enlace, /#\/restablecer\?token=/, "el enlace del backend debe ser de hash (FITO_FRONT_URL termina en #)");
      await pAna.goto(enElFront(enlace));
      await pAna.fill("#restablecer-nueva", "ana-clave-final-1");
      await pAna.fill("#restablecer-repetida", "ana-clave-final-1");
      await pAna.click("#btn-restablecer");
      await esperarHash(pAna, /^#\/entrar/);
      await pAna.fill("#entrar-correo", ana.correo);
      await pAna.fill("#entrar-contrasena", "ana-clave-final-1");
      await pAna.click("#btn-entrar");
      await esperarHash(pAna, /^#\/plantas$/);
      // El mismo enlace ya no sirve: 410 visible y se ofrece pedir otro.
      await pAna.goto(enElFront(enlace));
      await pAna.reload();
      await pAna.fill("#restablecer-nueva", "ana-clave-otra-1");
      await pAna.fill("#restablecer-repetida", "ana-clave-otra-1");
      await pAna.click("#btn-restablecer");
      await pAna.locator("[role=alert]:not([hidden])").first().waitFor();
      await pAna.locator("a", { hasText: "Pedir un enlace nuevo" }).waitFor();
    });
    await paso("invitación por correo: el enlace del correo abre #/invitacion", async () => {
      await pAna.goto(`${RAIZ}#/plantas/${plantaId}/mas`);
      await abrirSeccion(pAna, "seccion-compartir");
      await pAna.fill("#inv-correo-destino", `dani.${sufijo}@humo.test`);
      await pAna.click("#btn-generar-enlace");
      const texto = await ultimoCorreoPara(`dani.${sufijo}@humo.test`, "");
      assert.match(texto, /#\/invitacion\?token=/);
    });
  }

  await paso("enlaces de camino (/invitacion?token=, /restablecer?token=) redirigen a la ruta hash", async () => {
    const p = await nuevoContexto("camino");
    await p.goto(`${FRONT}/invitacion?token=abc_DEF-123`);
    await esperarHash(p, /^#\/invitacion\?token=abc_DEF-123$/);
    await p.goto(`${FRONT}/restablecer?token=xyz`);
    await esperarHash(p, /^#\/restablecer\?token=xyz$/);
    await p.context().close();
  });

  console.log("Recorrido guiado");
  await paso("recorrido guiado: sale la primera vez en el tablero con el foco atrapado, se recorre y no vuelve; en una planta sale el suyo y Esc lo cierra; desde Perfil se repite", async () => {
    // Único contexto del humo con el recorrido encendido (los demás lo apagan con la clave «fito.tour»).
    const p = await nuevoContexto("tour", { tour: true });
    await p.goto(`${RAIZ}#/entrar`);
    await p.fill("#entrar-correo", ana.correo);
    await p.fill("#entrar-contrasena", "ana-clave-final-1");
    await p.click("#btn-entrar");
    await esperarHash(p, /^#\/plantas$/);
    await p.locator("#tour-globo").waitFor({ timeout: 10000 });
    assert.equal(await p.locator("#tour").getAttribute("data-recorrido"), "tablero");
    assert.equal(await p.locator("#tour-globo").getAttribute("role"), "dialog");
    await p.waitForFunction(() => document.activeElement && document.activeElement.id === "btn-tour-siguiente");
    assert.match(await p.locator("#tour-anuncio").textContent(), /^Paso 1 de \d\. /);
    // Foco atrapado: Tab da la vuelta dentro del globo.
    await p.keyboard.press("Tab");
    assert.equal(await p.evaluate(() => document.activeElement.id), "btn-tour-omitir");
    await p.keyboard.press("Tab");
    assert.equal(await p.evaluate(() => document.activeElement.id), "btn-tour-siguiente");
    // El globo nunca tapa lo que explica, en ninguna parada.
    let paradas = 0;
    while (await p.locator("#tour").count()) {
      const seTapan = await p.evaluate(() => {
        const g = document.querySelector("#tour-globo").getBoundingClientRect();
        const f = document.querySelector(".tour-foco").getBoundingClientRect();
        return g.left < f.right && f.left < g.right && g.top < f.bottom && f.top < g.bottom;
      });
      assert.equal(seTapan, false, `el globo tapa el elemento en la parada ${paradas + 1}`);
      await p.click("#btn-tour-siguiente");
      await p.waitForTimeout(400);
      paradas += 1;
      assert.ok(paradas <= 6, "el recorrido no termina");
    }
    assert.ok(paradas >= 3, `solo ${paradas} paradas`);
    assert.equal(await p.evaluate(() => localStorage.getItem("fito.tour.tablero")), "visto");
    await p.reload();
    await p.locator(".tarjeta-planta").first().waitFor();
    await p.waitForTimeout(1500);
    assert.equal(await p.locator("#tour").count(), 0, "ya visto: no vuelve a salir");
    // La primera vez que se abre una planta sale el recorrido del detalle; Esc lo cierra y lo da por visto.
    await p.goto(`${RAIZ}#/plantas/${plantaId}`);
    await p.locator("#tour-globo").waitFor({ timeout: 10000 });
    assert.equal(await p.locator("#tour").getAttribute("data-recorrido"), "detalle");
    await p.keyboard.press("Escape");
    await p.waitForFunction(() => !document.querySelector("#tour"));
    assert.equal(await p.evaluate(() => localStorage.getItem("fito.tour.detalle")), "visto");
    // «Ver el recorrido otra vez», en Perfil.
    await p.goto(`${RAIZ}#/perfil`);
    await p.click("#btn-ver-recorrido");
    await esperarHash(p, /^#\/plantas$/);
    await p.locator("#tour-globo").waitFor({ timeout: 10000 });
    await p.click("#btn-tour-omitir");
    await p.waitForFunction(() => !document.querySelector("#tour"));
    await p.context().close();
  });

  console.log("Mascota y salud de la matera (F54, F55)");
  // Gente y planta propias del bloque: Dora (dueña) y Rita (invitada), una suculenta y su matera.
  const dora = { nombre: "Dora Humo", correo: `dora.${sufijo}@humo.test`, clave: "clave-dora-123" };
  const rita = { nombre: "Rita Humo", correo: `rita.${sufijo}@humo.test`, clave: "clave-rita-123" };
  const materaSalud = { serial: `fito-S${sufijo.slice(-5).toUpperCase()}`, secreto: null };
  let rocio;
  let tokenDora;
  const pDora = await nuevoContexto("dora", { viewport: { width: 390, height: 844 } });
  const pRita = await nuevoContexto("rita", { viewport: { width: 390, height: 844 } });
  await paso("pestaña Mascota: carga ánimo, vitalidad, racha y línea de tiempo; la invitada la ve sin botones", async () => {
    for (const u of [dora, rita]) assert.equal((await api(null, "POST", "/auth/registro", { nombre: u.nombre, correo: u.correo, contrasena: u.clave })).status, 201);
    tokenDora = (await api(null, "POST", "/auth/sesion", { correo: dora.correo, contrasena: dora.clave })).cuerpo.token;
    const tokenRita = (await api(null, "POST", "/auth/sesion", { correo: rita.correo, contrasena: rita.clave })).cuerpo.token;
    rocio = (await api(tokenDora, "POST", "/plantas", { apodo: "Rocío", especie: "suculenta" })).cuerpo;
    // Lecturas parejas (sin salto de humedad: ningún REGADA que confirme solo el «la regué» de más abajo)
    for (let i = 0; i < 3; i++) await api(tokenDora, "POST", `/plantas/${rocio.id}/mediciones`, { humedad: 15, luz: 1200, temperatura: 22 });
    const invitacion = await api(tokenDora, "POST", `/plantas/${rocio.id}/invitaciones`, {});
    assert.equal((await api(tokenRita, "POST", "/invitaciones/aceptar", { token: invitacion.cuerpo.token })).status, 200);
    await entrarPorUi(pDora, dora.correo, dora.clave);
    await esperarHash(pDora, /^#\/plantas$/);
    // el tablero: barra fina de vitalidad y el ánimo en una palabra
    const tarjeta = pDora.locator(`.tarjeta-planta-item[data-planta="${rocio.id}"]`);
    await tarjeta.locator(".tarjeta-planta-mascota:not([hidden]) .vitalidad-barra[aria-valuenow]").waitFor();
    assert.ok((await tarjeta.locator(".tarjeta-planta-animo").innerText()).trim().length > 0);
    await pDora.goto(`${RAIZ}#/plantas/${rocio.id}/mascota`);
    await pDora.locator("#pestana-mascota[aria-selected=true]").waitFor();
    await pDora.locator("#panel-mascota:not([hidden]) #seccion-mascota .mascota--grande").waitFor();
    await pDora.waitForFunction(() => /\d/.test(document.querySelector("#vitalidad-numero").textContent));
    const frase = await pDora.locator("#animo-frase").innerText();
    // F56: el globo dice la frase de la familia (la suculenta, `frases.json` de la OLED), no la genérica larga
    assert.ok(Object.values((await import("../../js/mascota-frases.js")).ANIMO.suculenta).includes(frase.trim()), `frase de la suculenta: «${frase}»`);
    assert.match(await pDora.locator("#racha-texto").innerText(), /sin susto/);
    await pDora.locator("#btn-acariciar").waitFor();
    await pDora.locator("#btn-la-regue").waitFor();
    // la invitada: todo a la vista, sin botones y sin errores
    await entrarPorUi(pRita, rita.correo, rita.clave);
    await esperarHash(pRita, /^#\/plantas$/);
    await pRita.goto(`${RAIZ}#/plantas/${rocio.id}/mascota`);
    await pRita.waitForFunction(() => /\d/.test(document.querySelector("#vitalidad-numero")?.textContent || ""));
    assert.equal(await pRita.locator("#btn-acariciar, #btn-la-regue").count(), 0);
    assert.equal(await pRita.locator("#seccion-mascota [role=alert]:not([hidden])").count(), 0);
  });
  await paso("acariciar: la mascota saluda al instante, crea el evento ACARICIADA y una caricia repetida no agrega otro", async () => {
    // el saludo es local: el cuerpo sube (translate negativo) en los primeros 600 ms, antes de que vuelva la red
    const subio = pDora.waitForFunction(() => /translate\(0 -[3-5]\)/.test(document.querySelector("#seccion-mascota .masc-planta").getAttribute("transform") || ""), null, { timeout: 2000, polling: 20 });
    await pDora.click("#btn-acariciar");
    await subio;
    await pDora.locator('#linea-tiempo li[data-tipo="ACARICIADA"]').first().waitFor();
    await pRita.locator('#linea-tiempo li[data-tipo="ACARICIADA"]').first().waitFor({ timeout: 10000 }); // le llegó en vivo
    await pDora.click("#btn-acariciar"); // dentro de 10 s: el backend responde 200 sin evento
    await pDora.waitForTimeout(1500);
    assert.equal(await pDora.locator('#linea-tiempo li[data-tipo="ACARICIADA"]').count(), 1);
    const eventos = (await api(tokenDora, "GET", `/plantas/${rocio.id}/mascota/eventos?pagina=0&tamano=20`)).cuerpo.contenido;
    assert.equal(eventos.filter((e) => e.tipo === "ACARICIADA").length, 1);
  });
  await paso("«la regué» queda pendiente con la hora límite y no abre otra espera", async () => {
    await pDora.click("#btn-la-regue");
    await pDora.locator("#estado-riego:not([hidden])", { hasText: /Esperando a que la tierra lo confirme, hasta las \d\d:\d\d/ }).waitFor();
    assert.equal(await pDora.locator("#btn-la-regue").isDisabled(), true);
    await pDora.locator('#linea-tiempo li[data-tipo="RIEGO_DECLARADO"]').first().waitFor({ timeout: 10000 });
    // la invitada ve la espera también (consulta o aviso en vivo)
    await pRita.locator("#estado-riego:not([hidden])", { hasText: /Esperando/ }).waitFor({ timeout: 35000 });
    const consulta = (await api(tokenDora, "GET", `/plantas/${rocio.id}/mascota`)).cuerpo;
    assert.equal(consulta.accionPendiente.estado, "PENDIENTE");
    await capturar(pDora, "mascota-pestana");
  });
  await paso("salud: con el simulador en --falla temperatura aparece el aviso con la frase exacta, el diagnóstico atenuado y la mascota preocupada", async () => {
    if (!SIMULADOR) {
      console.log("        (sin SIMULADOR=ruta/simulador_esp32.py: se omite)");
      return;
    }
    const sesionAdmin = await api(null, "POST", "/auth/sesion", { correo: ADMIN_CORREO, contrasena: ADMIN_CLAVE });
    materaSalud.secreto = (await api(sesionAdmin.cuerpo.token, "POST", "/admin/dispositivos", { serial: materaSalud.serial })).cuerpo.secreto;
    assert.equal((await api(tokenDora, "POST", `/plantas/${rocio.id}/dispositivos`, { serial: materaSalud.serial })).status, 201);
    await pDora.goto(`${RAIZ}#/plantas/${rocio.id}`);
    await pDora.locator("#estado-planta").waitFor();
    assert.equal(await pDora.locator("#aviso-salud").isHidden(), true, "con la matera sin noticias todavía no hay aviso");
    const carpeta = mkdtempSync(join(tmpdir(), "fito-sim-"));
    writeFileSync(join(carpeta, "nvs.json"), "{}");
    const api8090 = API.replace(/\/api\/v1$/, "");
    const sim = spawn("python3", [SIMULADOR, "--url", api8090, "--serial", materaSalud.serial, "--secreto", materaSalud.secreto, "--nvs", join(carpeta, "nvs.json"), "--falla", "temperatura", "--intervalo", "2", "--especie", "suculenta"], { stdio: "ignore" });
    try {
      await pDora.locator("#aviso-salud:not([hidden]) #aviso-salud-frase", { hasText: "no te siento la temperatura" }).waitFor({ timeout: 30000 });
      assert.equal(await pDora.locator(".bloque-vigente--atenuado").count(), 1);
      assert.equal(await pDora.locator(".cabecera-planta .mascota").getAttribute("data-estado") !== "SALUDABLE", true, "cara preocupada");
      // la invitada: GET .../dispositivos le trae la salud desde la fase 10 (o el aviso en vivo)
      await pRita.goto(`${RAIZ}#/plantas/${rocio.id}`);
      await pRita.locator("#aviso-salud:not([hidden])", { hasText: "no te siento la temperatura" }).waitFor({ timeout: 15000 });
      await capturar(pDora, "aviso-salud");
      // el tablero: chip «revisa la matera»
      await pDora.goto(`${RAIZ}#/plantas`);
      await pDora.locator(`.tarjeta-planta-item[data-planta="${rocio.id}"] .chip--sin-noticias:not([hidden])`).waitFor({ timeout: 15000 });
    } finally {
      sim.kill();
      rmSync(carpeta, { recursive: true, force: true });
    }
  });

  console.log("Mascota completa (F56)");
  const fraseDeCaricia = FRASES_DE_EVENTO.suculenta.ACARICIADA;
  const tieneSprite = (selector) => `(() => { const e = document.querySelector(${JSON.stringify(selector)}); return Boolean(e && e.getAttribute("d")); })()`;
  await paso("selector de accesorio: solo el dueño, con PATCH, se ve al instante (cabecera y pestaña), por teclado y le llega en vivo a la invitada", async () => {
    await pDora.goto(`${RAIZ}#/plantas/${rocio.id}/mascota`);
    await pDora.locator("#panel-mascota:not([hidden]) #selector-accesorio").waitFor();
    assert.equal(await pDora.locator("#selector-accesorio input[type=radio]").count(), 4, "cuatro opciones");
    assert.equal(await pDora.locator("#selector-accesorio .accesorio-miniatura .mascota").count(), 4, "cada una con la mascota en miniatura");
    await pRita.goto(`${RAIZ}#/plantas/${rocio.id}/mascota`);
    await pRita.locator("#panel-mascota:not([hidden]) #seccion-mascota .mascota--grande").waitFor();
    assert.equal(await pRita.locator("#selector-accesorio").count(), 0, "la invitada no lo ve");
    await pRita.waitForFunction(() => /\d/.test(document.querySelector("#vitalidad-numero")?.textContent || ""));
    assert.equal(await pDora.locator("#seccion-mascota .mascota--grande .masc-accesorio-sprite").getAttribute("d"), "", "sin accesorio todavía");
    // clic en «Sombrero»: se ve en la mascota grande y en la de la cabecera antes de que vuelva la red, y el servidor lo guarda
    await pDora.locator("label.accesorio-opcion", { hasText: "Sombrero" }).click();
    await pDora.waitForFunction(tieneSprite("#seccion-mascota .mascota--grande .masc-accesorio-sprite"), null, { timeout: 1500, polling: 20 });
    await pDora.waitForFunction(tieneSprite(".cabecera-planta .masc-accesorio-sprite"), null, { timeout: 1500, polling: 20 });
    for (let i = 0; i < 30; i++) {
      if ((await api(tokenDora, "GET", `/plantas/${rocio.id}/mascota`)).cuerpo.accesorio === "SOMBRERO") break;
      await pDora.waitForTimeout(100);
    }
    assert.equal((await api(tokenDora, "GET", `/plantas/${rocio.id}/mascota`)).cuerpo.accesorio, "SOMBRERO");
    // la invitada lo ve sin recargar: aviso MASCOTA_ACTUALIZADA
    await pRita.waitForFunction(tieneSprite("#seccion-mascota .mascota--grande .masc-accesorio-sprite"), null, { timeout: 10000 });
    await pRita.waitForFunction(tieneSprite(".cabecera-planta .masc-accesorio-sprite"), null, { timeout: 2000 });
    // por teclado: el radio marcado + flecha derecha = el siguiente (Moño)
    await pDora.locator('#selector-accesorio input[value="SOMBRERO"]').focus();
    await pDora.keyboard.press("ArrowRight");
    for (let i = 0; i < 30; i++) {
      if ((await api(tokenDora, "GET", `/plantas/${rocio.id}/mascota`)).cuerpo.accesorio === "MONO") break;
      await pDora.waitForTimeout(100);
    }
    assert.equal((await api(tokenDora, "GET", `/plantas/${rocio.id}/mascota`)).cuerpo.accesorio, "MONO");
    assert.equal(await pDora.locator('#selector-accesorio input[value="MONO"]').isChecked(), true);
    // y las gafas (con ellas se queda para el tablero)
    await pDora.locator("label.accesorio-opcion", { hasText: "Gafas" }).click();
    for (let i = 0; i < 30; i++) {
      if ((await api(tokenDora, "GET", `/plantas/${rocio.id}/mascota`)).cuerpo.accesorio === "GAFAS") break;
      await pDora.waitForTimeout(100);
    }
    assert.equal((await api(tokenDora, "GET", `/plantas/${rocio.id}/mascota`)).cuerpo.accesorio, "GAFAS");
    await capturar(pDora, "mascota-accesorio");
  });
  await paso("tablero con la mascota del listado: ninguna petición por tarjeta a GET .../mascota ni .../dispositivos, y el accesorio se ve", async () => {
    const pedidas = [];
    const oyente = (r) => { if (/\/plantas\/[^/?]+\/(mascota|dispositivos)(\?|$)/.test(r.url())) pedidas.push(`${r.method()} ${r.url()}`); };
    pDora.on("request", oyente);
    await pDora.goto(`${RAIZ}#/plantas`);
    await pDora.reload();
    const tarjeta = pDora.locator(`.tarjeta-planta-item[data-planta="${rocio.id}"]`);
    await tarjeta.locator(".tarjeta-planta-mascota:not([hidden]) .vitalidad-barra[aria-valuenow]").waitFor();
    await pDora.waitForFunction(tieneSprite(`.tarjeta-planta-item[data-planta="${rocio.id}"] .masc-accesorio-sprite`), null, { timeout: 5000 });
    assert.ok((await tarjeta.locator(".tarjeta-planta-animo").innerText()).trim().length > 0);
    await pDora.waitForTimeout(1500); // el tablero termina de pedir los diagnósticos
    pDora.off("request", oyente);
    assert.deepEqual(pedidas, [], "el listado ya trajo la mascota y la salud");
    await capturar(pDora, "tablero-mascota");
  });
  await paso("backend viejo (sin `mascota` ni `salud` en el listado): el tablero cae en el respaldo, dos peticiones por tarjeta", async () => {
    const pedidas = [];
    const oyente = (r) => { if (/\/plantas\/[^/?]+\/(mascota|dispositivos)(\?|$)/.test(r.url())) pedidas.push(r.url()); };
    const quitarClaves = async (ruta) => {
      const respuesta = await ruta.fetch();
      const json = await respuesta.json();
      for (const planta of Array.isArray(json) ? json : []) { delete planta.mascota; delete planta.salud; }
      await ruta.fulfill({ response: respuesta, json });
    };
    await pDora.route(/\/api\/v1\/plantas(\/compartidas)?$/, quitarClaves);
    pDora.on("request", oyente);
    try {
      await pDora.goto(`${RAIZ}#/plantas`);
      await pDora.reload();
      const tarjeta = pDora.locator(`.tarjeta-planta-item[data-planta="${rocio.id}"]`);
      await tarjeta.locator(".tarjeta-planta-mascota:not([hidden]) .vitalidad-barra[aria-valuenow]").waitFor({ timeout: 15000 });
      assert.ok(pedidas.some((u) => /\/mascota$/.test(u)) && pedidas.some((u) => /\/dispositivos$/.test(u)), `pidió ${pedidas.join(", ")}`);
    } finally {
      pDora.off("request", oyente);
      await pDora.unroute(/\/api\/v1\/plantas(\/compartidas)?$/, quitarClaves);
    }
  });
  await paso("caricia: la propia anima una sola vez (su eco no repite) y la que llega por WebSocket anima a la invitada (corazón y frase)", async () => {
    await pDora.goto(`${RAIZ}#/plantas/${rocio.id}/mascota`);
    await pDora.locator("#panel-mascota:not([hidden]) #seccion-mascota .mascota--grande").waitFor();
    await pDora.waitForTimeout(10500); // el enfriamiento de 10 s de la caricia (la del paso de «acariciar» ya pasó)
    await pRita.goto(`${RAIZ}#/plantas/${rocio.id}/mascota`);
    await pRita.locator("#seccion-mascota .mascota--grande").waitFor();
    await pDora.click("#btn-acariciar");
    // Dora: la frase de la caricia suena YA (no espera a la red) con su corazón, y no vuelve a sonar cuando llega el eco
    await pDora.locator('#animo-frase[data-evento="ACARICIADA"]').waitFor({ timeout: 1500 });
    assert.equal((await pDora.locator("#animo-frase").innerText()).trim(), fraseDeCaricia);
    await pDora.waitForFunction(tieneSprite("#seccion-mascota .mascota--grande .masc-efecto-sprite"), null, { timeout: 1500, polling: 20 });
    // Rita: le llega por el WebSocket y anima igual: la frase de la familia y el corazón
    await pRita.locator('#animo-frase[data-evento="ACARICIADA"]').waitFor({ timeout: 8000 });
    assert.equal((await pRita.locator("#animo-frase").innerText()).trim(), fraseDeCaricia);
    await pRita.waitForFunction(tieneSprite("#seccion-mascota .mascota--grande .masc-efecto-sprite"), null, { timeout: 2000, polling: 20 });
    await capturar(pRita, "mascota-caricia");
    // el turno de 3 s termina y NO vuelve a sonar en Dora (el eco trae el mismo id)
    await pDora.waitForFunction(() => !document.querySelector("#animo-frase[data-evento]"), null, { timeout: 5000 });
    await pDora.waitForTimeout(700);
    assert.equal(await pDora.locator("#animo-frase[data-evento]").count(), 0, "el eco de la caricia propia no anima otra vez");
    await pDora.waitForTimeout(2500);
    assert.equal(await pDora.locator("#animo-frase[data-evento]").count(), 0);
    assert.equal(await pDora.locator('#linea-tiempo li[data-tipo="ACARICIADA"]').count() >= 2, true);
    // la de la invitada también termina sola y vuelve a la frase del ánimo
    await pRita.waitForFunction(() => !document.querySelector("#animo-frase[data-evento]"), null, { timeout: 5000 });
  });
  await paso("caricia desde la matera: anima igual y en la línea de tiempo dice la frase de la familia y «(desde la matera)»", async () => {
    const serial = `fito-M${sufijo.slice(-5).toUpperCase()}`;
    const sesionAdmin = await api(null, "POST", "/auth/sesion", { correo: ADMIN_CORREO, contrasena: ADMIN_CLAVE });
    const secreto = (await api(sesionAdmin.cuerpo.token, "POST", "/admin/dispositivos", { serial })).cuerpo.secreto;
    assert.equal((await api(tokenDora, "POST", `/plantas/${rocio.id}/dispositivos`, { serial })).status, 201);
    const credencial = await chipPideCredencial({ serial, secreto });
    assert.equal(credencial.status, 200, JSON.stringify(credencial.cuerpo));
    await pDora.waitForTimeout(10500); // otra vez el enfriamiento de la planta
    const caricia = await api(credencial.cuerpo.token, "POST", `/dispositivos/${serial}/mascota/acciones`, { tipo: "ACARICIAR" });
    assert.equal(caricia.status, 201, JSON.stringify(caricia.cuerpo));
    // llega en vivo: el globo dice la frase de la familia y el corazón sube, como con la caricia de la app
    await pDora.locator('#animo-frase[data-evento="ACARICIADA"]').waitFor({ timeout: 8000 });
    assert.equal((await pDora.locator("#animo-frase").innerText()).trim(), fraseDeCaricia);
    await pDora.waitForFunction(tieneSprite("#seccion-mascota .mascota--grande .masc-efecto-sprite"), null, { timeout: 2000, polling: 20 });
    await pDora.locator("#linea-tiempo li[data-tipo=ACARICIADA]", { hasText: `${fraseDeCaricia} (desde la matera)` }).first().waitFor({ timeout: 3000 });
    // y la consulta (al recargar) lo dice igual: el origen viaja en el detalle del evento
    await pDora.reload();
    await pDora.locator("#linea-tiempo li[data-tipo=ACARICIADA]", { hasText: "(desde la matera)" }).first().waitFor();
    await pRita.locator("#linea-tiempo li[data-tipo=ACARICIADA]", { hasText: "(desde la matera)" }).first().waitFor({ timeout: 10000 });
  });
  await pDora.context().close();
  await pRita.context().close();

  console.log("Responsive");
  await paso("a 375 px no hay desplazamiento horizontal en las pantallas principales", async () => {
    const movil = await nuevoContexto("movil", { viewport: { width: 375, height: 800 } });
    // La portada (sin sesión) tampoco se sale de ancho.
    await movil.goto(`${RAIZ}`);
    await movil.locator("#portada-crear").waitFor();
    await movil.waitForTimeout(700);
    const portada = await movil.evaluate(() => ({ s: document.documentElement.scrollWidth, w: window.innerWidth }));
    assert.ok(portada.s <= portada.w + 1, `portada: scrollWidth ${portada.s} > ${portada.w}`);
    await movil.goto(`${RAIZ}#/entrar`);
    await movil.fill("#entrar-correo", ana.correo);
    await movil.fill("#entrar-contrasena", "ana-clave-final-1");
    await movil.click("#btn-entrar");
    await esperarHash(movil, /^#\/plantas$/);
    for (const ruta of ["/diagnostico", "/plantas", `/plantas/${plantaId}`, `/plantas/${plantaId}/mascota`, `/plantas/${plantaId}/historial`, `/plantas/${plantaId}/matera`, `/plantas/${plantaId}/mas`, "/plantas/nueva", "/perfil", "/solicitudes"]) {
      await movil.goto(`${RAIZ}#${ruta}`);
      await movil.waitForTimeout(700);
      const ancho = await movil.evaluate(() => ({ s: document.documentElement.scrollWidth, w: window.innerWidth }));
      assert.ok(ancho.s <= ancho.w + 1, `${ruta}: scrollWidth ${ancho.s} > ${ancho.w}`);
    }
    await movil.context().close();
  });
}

let codigo = 0;
try {
  await ejecutar();
} catch {
  codigo = 1;
} finally {
  await navegador?.close();
}
if (erroresDeConsola.length) {
  console.log("\nErrores de consola del navegador:");
  for (const e of erroresDeConsola) console.log("  -", e);
  codigo = 1;
}
const fallos = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length - fallos}/${resultados.length} pasos ok${codigo ? " — HAY FALLAS" : ""}`);
process.exit(codigo);
