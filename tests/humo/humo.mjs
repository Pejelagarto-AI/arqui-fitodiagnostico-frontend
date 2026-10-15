// Prueba de humo de punta a punta: front estático + backend real + navegador real.
//
//   1. backend:  FITO_JWT_SECRETO=... FITO_ADMIN_CORREO=admin@fito.test FITO_ADMIN_CONTRASENA=admin-clave-larga \
//                FITO_FRONT_URL='http://localhost:5500/#' ./mvnw spring-boot:run
//   2. front:    python3 -m http.server 5500          (en la raíz del repo del front)
//   3. opcional: docker run -d --rm --name fito-mailpit -p 1025:1025 -p 8025:8025 axllent/mailpit
//   4. esto:     cd tests/humo && npm install && node humo.mjs
//
// Variables: FRONT, API, MAILPIT, ADMIN_CORREO, ADMIN_CLAVE, CHROME (ruta de Chrome/Chromium).
// Sale con código 1 si algún paso falla. Sin Mailpit se omiten los pasos de correo.
import { chromium } from "playwright-core";
import assert from "node:assert/strict";

const FRONT = process.env.FRONT || "http://localhost:5500";
const API = process.env.API || "http://localhost:8080/api/v1";
const MAILPIT = process.env.MAILPIT || "http://localhost:8025";
const ADMIN_CORREO = process.env.ADMIN_CORREO || "admin@fito.test";
const ADMIN_CLAVE = process.env.ADMIN_CLAVE || "admin-clave-larga";
const CHROME = process.env.CHROME || "/usr/bin/google-chrome";

const sufijo = Date.now().toString(36);
const ana = { nombre: "Ana Humo", correo: `ana.${sufijo}@humo.test`, clave: "clave-ana-123" };
const beto = { nombre: "Beto Humo", correo: `beto.${sufijo}@humo.test`, clave: "clave-beto-123" };

const resultados = [];
let navegador;
const erroresDeConsola = [];

async function paso(nombre, fn) {
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
  const contexto = await navegador.newContext({ viewport: { width: 1100, height: 900 }, bypassCSP: opciones.csp !== true, ...opciones });
  const pagina = await contexto.newPage();
  pagina.on("pageerror", (e) => erroresDeConsola.push(`[${etiqueta}] pageerror: ${e.message}`));
  pagina.on("console", (m) => {
    if (m.type() === "error" && !/status of (4\d\d)/.test(m.text())) erroresDeConsola.push(`[${etiqueta}] ${m.text()}`);
  });
  pagina.etiqueta = etiqueta;
  return pagina;
}

const hash = (pagina) => new URL(pagina.url()).hash;
const esperarHash = (pagina, patron) => pagina.waitForFunction((p) => new RegExp(p).test(location.hash), patron.source, { timeout: 10000 });
const toast = (pagina, texto) => pagina.locator(".toast", { hasText: texto }).first().waitFor({ timeout: 10000 });
const confirmarDialogo = (pagina) => pagina.locator("dialog[open] [data-confirmar]").click();

async function registrarPorUi(pagina, u) {
  await pagina.goto(`${FRONT}/#/registro`);
  await pagina.fill("#registro-nombre", u.nombre);
  await pagina.fill("#registro-correo", u.correo);
  await pagina.fill("#registro-contrasena", u.clave);
  await pagina.click("#btn-registrar");
  await esperarHash(pagina, /^#\/plantas$/);
}

async function entrarPorUi(pagina, correo, clave) {
  await pagina.goto(`${FRONT}/#/entrar`);
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

async function medirPorUi(pagina, h, l, t) {
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
    await p.goto(`${FRONT}/`);
    await p.locator("#especie-select option[value='potos']").waitFor({ state: "attached" });
    await p.selectOption("#especie-select", "potos");
    await p.fill("#suelto-humedad", "50");
    await p.fill("#suelto-luz", "600");
    await p.fill("#suelto-temperatura", "24");
    await p.click("#btn-diagnosticar");
    await p.locator("#zona-resultado .estado-global").waitFor();
    await p.goto(`${FRONT}/#/entrar`);
    await p.locator("#formulario-entrar").waitFor();
    await p.locator("#navegacion").waitFor();
    assert.deepEqual(violaciones, []);
    await p.context().close();
  });
  await paso("diagnóstico suelto funciona sin sesión y muestra el resultado", async () => {
    await pAna.goto(`${FRONT}/`);
    await pAna.waitForSelector("#especie-select option[value='potos']", { state: "attached" });
    await pAna.selectOption("#especie-select", "potos");
    await pAna.fill("#suelto-humedad", "15");
    await pAna.fill("#suelto-luz", "800");
    await pAna.fill("#suelto-temperatura", "22");
    await pAna.click("#btn-diagnosticar");
    await pAna.locator("#zona-resultado .estado-global").waitFor();
    assert.match(await pAna.locator("#zona-resultado .estado-global").innerText(), /riesgo|Crítico|Saludable/i);
  });
  await paso("el diagnóstico suelto muestra el error del backend (campo vacío) junto al campo", async () => {
    await pAna.reload();
    await pAna.waitForSelector("#especie-select option[value='potos']", { state: "attached" });
    await pAna.selectOption("#especie-select", "potos");
    await pAna.fill("#suelto-humedad", "-5");
    await pAna.fill("#suelto-luz", "800");
    await pAna.fill("#suelto-temperatura", "22");
    await pAna.click("#btn-diagnosticar");
    await pAna.locator("#suelto-humedad[aria-invalid='true']").waitFor();
    assert.ok((await pAna.locator("#suelto-humedad-error").innerText()).length > 0);
  });
  await paso("una ruta protegida sin sesión manda a iniciar sesión con ?volver=", async () => {
    await pAna.goto(`${FRONT}/#/plantas`);
    await esperarHash(pAna, /^#\/entrar\?volver=/);
  });

  console.log("Sesión");
  await paso("registro por la UI inicia sesión y lleva a Mis plantas", async () => {
    await registrarPorUi(pAna, ana);
    await pAna.locator("#navegacion", { hasText: ana.nombre }).waitFor();
  });
  await paso("correo repetido: 409 con el mensaje del backend junto al campo, sin salir del formulario", async () => {
    const otra = await nuevoContexto("repetido");
    await otra.goto(`${FRONT}/#/registro`);
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
  await paso("registrar planta (solo especies activas) lleva al detalle y muestra «sin diagnóstico»", async () => {
    await pAna.click("#enlace-nueva-planta");
    await pAna.fill("#planta-apodo", "Lola");
    await pAna.selectOption("#planta-especie", "potos");
    await pAna.click("#btn-registrar-planta");
    await esperarHash(pAna, /^#\/plantas\/[0-9a-f-]{36}$/);
    plantaId = hash(pAna).split("/").pop();
    await pAna.locator("#sin-diagnostico").waitFor();
  });
  await paso("registrar medición manual actualiza el diagnóstico vigente y el historial", async () => {
    await medirPorUi(pAna, 55, 600, 24);
    await pAna.locator("#diagnostico-vigente .estado-global").waitFor();
    assert.match(await pAna.locator("#diagnostico-vigente .estado-global").innerText(), /Saludable/);
    await pAna.locator("#tabla-historial tbody tr").first().waitFor();
    assert.equal(await pAna.locator("#tabla-historial tbody tr").count(), 1);
  });
  await paso("historial paginado: con 12 registros hay 2 páginas y se navega", async () => {
    const token = await tokenDe(pAna);
    for (let i = 0; i < 11; i++) {
      const r = await api(token, "POST", `/plantas/${plantaId}/mediciones`, { humedad: 50 + i, luz: 600, temperatura: 24 });
      assert.equal(r.status, 201);
    }
    await pAna.reload();
    await pAna.locator("#info-pagina").waitFor();
    assert.match(await pAna.locator("#info-pagina").innerText(), /Página 1 de 2 · 12 registros/);
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
    await pAna.fill("#editar-apodo", "Lola la pothos");
    await pAna.click("#btn-guardar-planta");
    await pAna.waitForFunction(() => document.querySelector("#planta-nombre")?.textContent === "Lola la pothos");
  });
  await paso("planta ajena o inexistente: 404 con mensaje visible y enlace de regreso", async () => {
    await pBeto.goto(`${FRONT}/#/registro`);
    await registrarPorUi(pBeto, beto);
    await pBeto.goto(`${FRONT}/#/plantas/${plantaId}`);
    await pBeto.locator("[role=alert]:not([hidden])").first().waitFor();
    assert.match(await pBeto.locator("[role=alert]:not([hidden])").first().innerText(), /no existe|no es tuya|encontr/i);
  });

  console.log("Compartir");
  await paso("generar enlace de invitación y copiarlo al portapapeles", async () => {
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
    await visita.goto(enlaceInvitacion);
    await visita.locator("#formulario-invitacion").waitFor();
    await visita.locator("#enlace-entrar-invitacion").waitFor();
    await visita.context().close();
  });
  await paso("aceptar con registro (visita sin cuenta): crea la cuenta, inicia sesión y abre la planta en solo lectura", async () => {
    const carlos = await nuevoContexto("carlos");
    await carlos.goto(enlaceInvitacion);
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
    await pAna.click("#btn-generar-enlace");
    await pAna.waitForFunction((anterior) => document.querySelector("#valor-enlace")?.value !== anterior, enlaceInvitacion);
    enlaceBeto = await pAna.inputValue("#valor-enlace");
    await pBeto.goto(enlaceBeto);
    await pBeto.click("#btn-aceptar-invitacion");
    await esperarHash(pBeto, new RegExp(`^#/plantas/${plantaId}$`));
    await pBeto.locator("#etiqueta-compartida").waitFor();
    for (const id of ["#btn-registrar-medicion", "#btn-eliminar-planta", "#btn-guardar-planta", "#btn-generar-enlace"]) {
      assert.equal(await pBeto.locator(id).count(), 0, `${id} no debe existir para un invitado`);
    }
    await pBeto.locator("#btn-renunciar").waitFor();
    await pBeto.locator("#tabla-historial").waitFor();
  });
  await paso("la lista «Compartidas conmigo» muestra la planta", async () => {
    await pBeto.goto(`${FRONT}/#/plantas`);
    await pBeto.locator("#lista-compartidas a", { hasText: "Lola la pothos" }).waitFor();
  });
  await paso("un enlace ya usado muestra el mensaje del backend (410) y no rompe la pantalla", async () => {
    await pBeto.goto(enlaceBeto);
    await pBeto.click("#btn-aceptar-invitacion");
    await pBeto.locator("[role=alert]:not([hidden])").first().waitFor();
    assert.match(await pBeto.locator("[role=alert]:not([hidden])").first().innerText(), /ya|usad|acept|vigente|no/i);
  });
  await paso("revocar una invitación pendiente", async () => {
    await pAna.reload();
    await pAna.locator("#btn-generar-enlace").waitFor();
    await pAna.click("#btn-generar-enlace");
    await pAna.waitForFunction(() => document.querySelectorAll("#lista-pendientes li").length >= 1);
    const antes = await pAna.locator("#lista-pendientes li").count();
    await pAna.locator("[data-accion=revocar-invitacion]").first().click();
    await confirmarDialogo(pAna);
    await pAna.waitForFunction((n) => document.querySelectorAll("#lista-pendientes li").length < n || /No hay invitaciones/.test(document.querySelector("#lista-pendientes").textContent), antes);
  });

  console.log("Vista en vivo");
  await paso("el indicador de conexión llega a «activa» en el detalle", async () => {
    await pBeto.goto(`${FRONT}/#/plantas/${plantaId}`);
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
    }, antes, { timeout: 10000 });
    assert.match(await pBeto.locator("#diagnostico-vigente .estado-global").innerText(), /Crítico|En riesgo/);
    assert.equal(await pBeto.evaluate(() => window.__sinRecarga), "sigo aqui", "la página se recargó");
    await pBeto.waitForFunction(() => /13 registros/.test(document.querySelector("#info-pagina")?.textContent || ""));
  });
  await paso("reconexión: se corta el WebSocket, el indicador lo refleja, vuelve solo y recupera lo que pasó mientras tanto", async () => {
    await pBeto.evaluate(() => { window.__sinRecarga = "sigo aqui"; });
    await medirPorUi(pAna, 55, 600, 24);
    await pBeto.locator("#diagnostico-vigente .estado-global", { hasText: "Saludable" }).waitFor({ timeout: 10000 });
    // Cae la conexión y, mientras se rechazan los reintentos, Ana mide: Beto no recibe ese aviso en vivo.
    controlWs.bloquear = true;
    controlWs.cerrar();
    await pBeto.locator("#indicador-planta[data-estado=reconectando]").waitFor({ timeout: 10000 });
    await medirPorUi(pAna, 5, 60, 5); // crítico
    await pAna.locator("#diagnostico-vigente .estado-global", { hasText: /Crítico|En riesgo/ }).waitFor();
    assert.match(await pBeto.locator("#diagnostico-vigente .estado-global").innerText(), /Saludable/, "no debía enterarse aún");
    // Vuelve la conexión: el cliente reintenta con espera y, al reconectar, consulta de nuevo.
    controlWs.bloquear = false;
    await pBeto.locator("#indicador-planta[data-estado=conectado]").waitFor({ timeout: 30000 });
    await pBeto.locator("#diagnostico-vigente .estado-global", { hasText: /Crítico|En riesgo/ }).waitFor({ timeout: 10000 });
    assert.equal(await pBeto.evaluate(() => window.__sinRecarga), "sigo aqui", "la página se recargó");
    // Y los avisos en vivo vuelven a llegar.
    await medirPorUi(pAna, 55, 600, 24);
    await pBeto.locator("#diagnostico-vigente .estado-global", { hasText: "Saludable" }).waitFor({ timeout: 10000 });
  });
  await paso("quitar el acceso al invitado: recibe el aviso en vivo y sale de la planta", async () => {
    await pAna.locator("#lista-invitados li", { hasText: beto.nombre }).locator("[data-accion=revocar-invitado]").click();
    await confirmarDialogo(pAna);
    await esperarHash(pBeto, /^#\/plantas$/);
    await toast(pBeto, "Perdiste el acceso");
  });

  console.log("Solicitudes de especie y administración");
  await paso("un cliente no ve el menú de administración y /admin le dice que no tiene permiso", async () => {
    assert.equal(await pAna.locator("#navegacion a", { hasText: "Administración" }).count(), 0);
    await pAna.goto(`${FRONT}/#/admin/usuarios`);
    await pAna.locator("text=solo para administradores").waitFor();
  });
  await paso("enviar solicitud de especie y verla pendiente", async () => {
    await pAna.goto(`${FRONT}/#/solicitudes`);
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
  await paso("admin: listar y buscar usuarios, ver detalle con plantas", async () => {
    await pAdmin.goto(`${FRONT}/#/admin/usuarios`);
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
    await pAdmin.goto(`${FRONT}/#/admin/usuarios`);
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
    await pAdmin.goto(`${FRONT}/#/admin/especies`);
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
    await pAna.goto(`${FRONT}/#/plantas/nueva`);
    await pAna.locator("#planta-especie option[value='potos']").waitFor({ state: "attached" });
    assert.equal(await pAna.locator(`#planta-especie option[value='${nombre}']`).count(), 0);
    await pAdmin.locator(`tr[data-especie="${nombre}"] [data-accion=reactivar]`).click();
    await pAdmin.locator(`tr[data-especie="${nombre}"] [data-accion=desactivar]`).waitFor();
    await pAna.reload();
    await pAna.locator(`#planta-especie option[value='${nombre}']`).waitFor({ state: "attached" });
  });
  await paso("admin aprueba la solicitud con respuesta: Ana recibe el aviso en vivo y ve el estado", async () => {
    await pAna.goto(`${FRONT}/#/solicitudes`);
    await pAna.locator("#indicador-conexion[data-estado=conectado]").waitFor({ timeout: 10000 });
    await pAdmin.goto(`${FRONT}/#/admin/solicitudes`);
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
    await pAdmin.goto(`${FRONT}/#/admin/usuarios`);
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
    await pAna.goto(`${FRONT}/#/perfil`);
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
    await pAna.goto(`${FRONT}/#/plantas`);
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
  });

  if (hayCorreo) {
    console.log("Correo (Mailpit)");
    await paso("recuperar contraseña: el enlace del correo abre #/restablecer y permite entrar con la nueva", async () => {
      await pAna.goto(`${FRONT}/#/recuperar`);
      await pAna.fill("#recuperar-correo", ana.correo);
      await pAna.click("#btn-recuperar");
      await pAna.locator("#formulario-recuperar ~ .banner-ok:not([hidden])").waitFor();
      const texto = await ultimoCorreoPara(ana.correo, "");
      const enlace = texto.match(/https?:\/\/\S+restablecer\?token=\S+/)[0];
      assert.match(enlace, /#\/restablecer\?token=/, "el enlace del backend debe ser de hash (FITO_FRONT_URL termina en #)");
      await pAna.goto(enlace);
      await pAna.fill("#restablecer-nueva", "ana-clave-final-1");
      await pAna.fill("#restablecer-repetida", "ana-clave-final-1");
      await pAna.click("#btn-restablecer");
      await esperarHash(pAna, /^#\/entrar/);
      await pAna.fill("#entrar-correo", ana.correo);
      await pAna.fill("#entrar-contrasena", "ana-clave-final-1");
      await pAna.click("#btn-entrar");
      await esperarHash(pAna, /^#\/plantas$/);
      // El mismo enlace ya no sirve: 410 visible y se ofrece pedir otro.
      await pAna.goto(enlace);
      await pAna.reload();
      await pAna.fill("#restablecer-nueva", "ana-clave-otra-1");
      await pAna.fill("#restablecer-repetida", "ana-clave-otra-1");
      await pAna.click("#btn-restablecer");
      await pAna.locator("[role=alert]:not([hidden])").first().waitFor();
      await pAna.locator("a", { hasText: "Pedir un enlace nuevo" }).waitFor();
    });
    await paso("invitación por correo: el enlace del correo abre #/invitacion", async () => {
      await pAna.goto(`${FRONT}/#/plantas/${plantaId}`);
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

  console.log("Responsive");
  await paso("a 375 px no hay desplazamiento horizontal en las pantallas principales", async () => {
    const movil = await nuevoContexto("movil", { viewport: { width: 375, height: 800 } });
    await movil.goto(`${FRONT}/#/entrar`);
    await movil.fill("#entrar-correo", ana.correo);
    await movil.fill("#entrar-contrasena", "ana-clave-final-1");
    await movil.click("#btn-entrar");
    await esperarHash(movil, /^#\/plantas$/);
    for (const ruta of ["/", "/plantas", `/plantas/${plantaId}`, "/perfil", "/solicitudes"]) {
      await movil.goto(`${FRONT}/#${ruta}`);
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
