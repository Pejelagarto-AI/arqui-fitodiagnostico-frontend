// Revisión de accesibilidad con axe-core (instalado en tests/humo, inyectado desde el disco porque la CSP del front
// no deja cargarlo de un CDN). Recorre las vistas principales a 390x844 y 1280x800 y lista las violaciones.
//   FRONT=http://localhost:5700 FRONT_API=http://localhost:8090/api/v1 API=$FRONT_API node a11y.mjs
// Sale con código 1 si hay violaciones. Usa bypassCSP para poder inyectar el script (la CSP real la prueba humo.mjs).
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const FRONT = process.env.FRONT || "http://localhost:5500";
const API = process.env.API || "http://localhost:8080/api/v1";
const RAIZ = process.env.FRONT_API ? `${FRONT}/?api=${encodeURIComponent(process.env.FRONT_API)}` : `${FRONT}/`;
const ADMIN = { correo: process.env.ADMIN_CORREO || "admin@fito.test", clave: process.env.ADMIN_CLAVE || "admin-clave-larga" };
const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
const axe = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

async function api(token, metodo, ruta, cuerpo) {
  const r = await fetch(`${API}${ruta}`, { method: metodo, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const t = await r.text();
  return { status: r.status, cuerpo: t ? JSON.parse(t) : null };
}
const sufijo = Date.now().toString(36);
const cuenta = { nombre: "Ana Axe", correo: `ana.${sufijo}@axe.test`, contrasena: "clave-ana-123" };
const reg = await api(null, "POST", "/auth/registro", cuenta);
const token = reg.cuerpo.token || (await api(null, "POST", "/auth/sesion", { correo: cuenta.correo, contrasena: cuenta.contrasena })).cuerpo.token;
const plantas = [];
for (const [apodo, especie, m] of [["Solecito", "girasol", { humedad: 55, luz: 30000, temperatura: 23 }], ["Espinoso", "cactus", { humedad: 40, luz: 30000, temperatura: 25 }], ["Chompy", "atrapamoscas", { humedad: 5, luz: 100, temperatura: 5 }]]) {
  const p = await api(token, "POST", "/plantas", { apodo, especie });
  await api(token, "POST", `/plantas/${p.cuerpo.id}/mediciones`, m);
  plantas.push(p.cuerpo);
}

const navegador = await chromium.launch({ executablePath: CHROME, headless: true });
let total = 0;
async function revisar(pagina, nombre) {
  await pagina.waitForTimeout(1200);
  await pagina.addScriptTag({ content: axe });
  const r = await pagina.evaluate(() => axe.run(document, { resultTypes: ["violations"] }));
  for (const v of r.violations) {
    total += v.nodes.length;
    console.log(`  [${v.impact}] ${nombre}: ${v.id} (${v.nodes.length}) ${v.help}`);
    for (const n of v.nodes.slice(0, 3)) console.log(`      ${n.target.join(" ")}  ${(n.failureSummary || "").split("\n")[1] || ""}`.slice(0, 260));
  }
  if (!r.violations.length) console.log(`  ok ${nombre}`);
}
async function entrar(contexto, correo, clave) {
  const p = await contexto.newPage();
  await p.goto(`${RAIZ}#/entrar`);
  await p.fill("#entrar-correo", correo);
  await p.fill("#entrar-contrasena", clave);
  await p.click("#btn-entrar");
  await p.waitForFunction(() => location.hash !== "#/entrar", null, { timeout: 10000 });
  return p;
}
for (const [tam, viewport] of Object.entries({ movil: { width: 390, height: 844 }, escritorio: { width: 1280, height: 800 } })) {
  console.log(tam);
  const nuevo = async () => {
    const c = await navegador.newContext({ viewport, bypassCSP: true });
    await c.addInitScript(() => { try { localStorage.setItem("fito.tour", "no"); } catch {} });
    return c;
  };
  const c1 = await nuevo();
  const a = await c1.newPage();
  for (const [r, n] of [["", "portada"], ["#/diagnostico", "diagnostico"], ["#/registro", "registro"], ["#/entrar", "entrar"], ["#/recuperar", "recuperar"]]) {
    await a.goto(`${RAIZ}${r}`); await revisar(a, n);
  }
  await a.goto(`${RAIZ}#/diagnostico`); await a.selectOption("#especie-select", "cactus");
  await a.fill("#suelto-humedad", "30"); await a.fill("#suelto-luz", "20000"); await a.fill("#suelto-temperatura", "24");
  await a.click("#btn-diagnosticar"); await a.waitForSelector("#zona-resultado .estado-global"); await revisar(a, "diagnostico-resultado");
  await c1.close();
  const c2 = await nuevo();
  const p = await entrar(c2, cuenta.correo, cuenta.contrasena);
  await p.goto(`${RAIZ}#/plantas`); await p.waitForSelector(".tarjeta-planta"); await revisar(p, "tablero");
  for (const k of ["", "/mascota", "/historial", "/matera", "/mas"]) { await p.goto(`${RAIZ}#/plantas/${plantas[1].id}${k}`); await p.waitForSelector("[role=tab]"); await revisar(p, `detalle${k || "/hoy"}`); }
  for (const [r, n] of [["plantas/nueva", "planta-nueva"], [`plantas/${plantas[1].id}/vincular`, "asistente-vinculacion"], ["perfil", "perfil"], ["solicitudes", "solicitudes"]]) {
    await p.goto(`${RAIZ}#/${r}`); await revisar(p, n);
  }
  await c2.close();
  const c3 = await nuevo();
  const ad = await entrar(c3, ADMIN.correo, ADMIN.clave);
  for (const r of ["admin", "admin/usuarios", "admin/dispositivos", "admin/especies", "admin/solicitudes"]) { await ad.goto(`${RAIZ}#/${r}`); await revisar(ad, r); }
  await c3.close();
}
await navegador.close();
console.log(total ? `${total} nodos con violaciones` : "sin violaciones");
process.exit(total ? 1 : 0);
