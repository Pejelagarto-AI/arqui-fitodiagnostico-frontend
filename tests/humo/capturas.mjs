// Capturas de las vistas principales a 390x844 y 1280x800 para revisarlas a ojo (pulido visual).
//   FRONT=http://localhost:5700 FRONT_API=http://localhost:8090/api/v1 API=$FRONT_API node capturas.mjs [carpeta]
// Siembra una cuenta con tres plantas (saludable, en riesgo, crítica) y guarda las imágenes en docs/capturas/.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const FRONT = process.env.FRONT || "http://localhost:5500";
const API = process.env.API || "http://localhost:8080/api/v1";
const RAIZ = process.env.FRONT_API ? `${FRONT}/?api=${encodeURIComponent(process.env.FRONT_API)}` : `${FRONT}/`;
const ADMIN = { correo: process.env.ADMIN_CORREO || "admin@fito.test", clave: process.env.ADMIN_CLAVE || "admin-clave-larga" };
const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
const SALIDA = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), "../../docs/capturas");
mkdirSync(SALIDA, { recursive: true });

async function api(token, metodo, ruta, cuerpo) {
  const r = await fetch(`${API}${ruta}`, { method: metodo, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const t = await r.text();
  return { status: r.status, cuerpo: t ? JSON.parse(t) : null };
}

const sufijo = Date.now().toString(36);
const cuenta = { nombre: "Ana Capturas", correo: `ana.${sufijo}@captura.test`, contrasena: "clave-ana-123" };
const reg = await api(null, "POST", "/auth/registro", cuenta);
const token = reg.cuerpo.token || (await api(null, "POST", "/auth/sesion", { correo: cuenta.correo, contrasena: cuenta.contrasena })).cuerpo.token;
const plantas = [];
for (const [apodo, especie, m] of [
  ["Solecito", "girasol", { humedad: 55, luz: 30000, temperatura: 23 }],
  ["Espinoso", "cactus", { humedad: 40, luz: 30000, temperatura: 25 }],
  ["Chompy", "atrapamoscas", { humedad: 5, luz: 100, temperatura: 5 }],
]) {
  const p = await api(token, "POST", "/plantas", { apodo, especie });
  await api(token, "POST", `/plantas/${p.cuerpo.id}/mediciones`, m);
  plantas.push(p.cuerpo);
}

const navegador = await chromium.launch({ executablePath: CHROME, headless: true });
const TAMANOS = { movil: { width: 390, height: 844 }, escritorio: { width: 1280, height: 800 } };

async function sesionEn(contexto, correo, clave) {
  const p = await contexto.newPage();
  await p.goto(`${RAIZ}#/entrar`);
  await p.fill("#entrar-correo", correo);
  await p.fill("#entrar-contrasena", clave);
  await p.click("#btn-entrar");
  await p.waitForFunction(() => location.hash !== "#/entrar", null, { timeout: 10000 });
  return p;
}

for (const [tam, viewport] of Object.entries(TAMANOS)) {
  const guardar = async (pagina, nombre, completa = true) => {
    await pagina.waitForTimeout(900);
    await pagina.screenshot({ path: path.join(SALIDA, `${nombre}-${tam}.png`), fullPage: completa });
    console.log("captura", `${nombre}-${tam}`);
  };
  const nuevo = async () => {
    const c = await navegador.newContext({ viewport, deviceScaleFactor: 1, hasTouch: tam === "movil", bypassCSP: true });
    await c.addInitScript(() => { try { localStorage.setItem("fito.tour", "no"); localStorage.setItem("fito.tour.tablero", "visto"); localStorage.setItem("fito.tour.detalle", "visto"); } catch {} });
    return c;
  };
  // sin cuenta
  const c1 = await nuevo();
  const a = await c1.newPage();
  await a.goto(RAIZ); await a.waitForSelector("#portada-crear"); await guardar(a, "portada");
  await a.goto(`${RAIZ}#/diagnostico`); await a.waitForSelector("#especie-select", { state: "attached" }); await guardar(a, "diagnostico-sin-cuenta");
  await a.selectOption("#especie-select", "cactus"); await a.fill("#suelto-humedad", "30"); await a.fill("#suelto-luz", "20000"); await a.fill("#suelto-temperatura", "24");
  await a.click("#btn-diagnosticar"); await a.waitForSelector("#zona-resultado .estado-global"); await guardar(a, "diagnostico-resultado");
  await a.goto(`${RAIZ}#/registro`); await guardar(a, "registro");
  await a.goto(`${RAIZ}#/entrar`); await guardar(a, "entrar");
  await c1.close();
  // con cuenta
  const c2 = await nuevo();
  const p = await sesionEn(c2, cuenta.correo, cuenta.contrasena);
  await p.goto(`${RAIZ}#/plantas`); await p.waitForSelector(".tarjeta-planta, [data-planta-id], a[href*='#/plantas/']"); await guardar(p, "tablero");
  const id = plantas[1].id;
  await p.goto(`${RAIZ}#/plantas/${id}`); await p.waitForSelector("[role=tab]");
  const pestanas = await p.$$eval("[role=tab]", (e) => e.map((x) => x.dataset.pestana));
  for (const k of pestanas) { await p.goto(`${RAIZ}#/plantas/${id}${k === "hoy" ? "" : "/" + k}`); await p.waitForSelector("[role=tab]"); await guardar(p, `detalle-${k}`); }
  await p.goto(`${RAIZ}#/plantas/${plantas[2].id}`); await p.waitForSelector("[role=tab]"); await guardar(p, "detalle-hoy-critica");
  await p.goto(`${RAIZ}#/plantas/nueva`); await guardar(p, "planta-nueva");
  await p.goto(`${RAIZ}#/plantas/${id}/vincular`); await guardar(p, "asistente-vinculacion");
  await p.goto(`${RAIZ}#/perfil`); await guardar(p, "perfil");
  await c2.close();
  // admin
  const c3 = await nuevo();
  const ad = await sesionEn(c3, ADMIN.correo, ADMIN.clave);
  for (const [r, n] of [["admin", "admin-inicio"], ["admin/usuarios", "admin-usuarios"], ["admin/dispositivos", "admin-dispositivos"], ["admin/especies", "admin-especies"]]) {
    await ad.goto(`${RAIZ}#/${r}`); await guardar(ad, n);
  }
  await c3.close();
}
await navegador.close();
