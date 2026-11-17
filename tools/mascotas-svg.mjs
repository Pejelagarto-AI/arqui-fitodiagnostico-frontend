// Vuelca las mascotas del front como SVG estático (en reposo, un cuadro por pose) y las piezas de su cara, en JSON, para
// que `tools/comparar-mascotas.py` las ponga junto a los sprites de la OLED. Sin navegador: usa el DOM mínimo de
// tests/dom-minimo.mjs.   Uso: node tools/mascotas-svg.mjs > mascotas.json
import { instalarDom, serializar } from "../tests/dom-minimo.mjs";

instalarDom();
const { crearMascota } = await import("../js/componentes/mascota.js");
const { FAMILIAS } = await import("../js/componentes/especie.js");

const ESTADOS = ["SALUDABLE", "EN_RIESGO", "CRITICO"];
// cuadros de idle que se comparan: [estado, cuadro]; el resto de los estados tiene uno solo salvo el helecho (dos)
const CUADROS = {
  girasol: { SALUDABLE: [0, 1] },
  suculenta: { SALUDABLE: [0, 1] },
  helecho: { SALUDABLE: [0, 1], EN_RIESGO: [0, 1], CRITICO: [0, 1] },
  carnivora: { SALUDABLE: [0, 1, 2] },
};

const salida = {};
for (const familia of FAMILIAS) {
  salida[familia] = {};
  for (const estado of ESTADOS) {
    for (const cuadro of CUADROS[familia]?.[estado] ?? [0]) {
      const m = crearMascota(familia, { estado });
      m.pintar(0, { reposo: true, cuadro });
      m.nodo.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      salida[familia][`${estado}#${cuadro}`] = { svg: serializar(m.nodo), cara: m.piezas() };
    }
  }
}
// F49: la pose dormida (de noche, en los tres estados) y los 12 cuadros del saludo, en los mismos instantes que
// `noche_y_saludo()` de firmware/sprites/previsualizar.py: dormida a los 2500 ms (respiración abajo, tres zetas) y el
// saludo empezando a los 2500 ms, un cuadro cada 50 ms (se pinta a la mitad del cuadro, como la OLED a 20 fps).
const T_DORMIDA = 2500;
const T_SALUDO = 2500;
const svgDe = (m) => {
  m.nodo.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return { svg: serializar(m.nodo), cara: m.piezas() };
};
salida.noche = {};
salida.saludo = {};
for (const familia of FAMILIAS) {
  salida.noche[familia] = {};
  for (const estado of ESTADOS) {
    const m = crearMascota(familia, { estado, periodo: "NOCHE" });
    m.pintar(T_DORMIDA);
    salida.noche[familia][estado] = svgDe(m);
  }
  const m = crearMascota(familia, { estado: "SALUDABLE" });
  m.pintar(T_SALUDO);
  m.saludar();
  salida.saludo[familia] = [];
  for (let k = 0; k < 12; k++) {
    m.pintar(T_SALUDO + 50 * k);
    salida.saludo[familia].push(svgDe(m));
  }
}

// F56: la mascota completa de la fase 14 (frases, constantes de tiempo, efectos, ojos en «x» y accesorios) para compararla con el
// firmware: `comparar-mascotas.py` lee `frases.json`, `fito_mascota.h`, `pantalla.cpp` y `arte/*.txt` del backend con git show.
const F = await import("../js/mascota-frases.js");
const E = await import("../js/mascota-eventos.js");
const sprites = await import("../js/componentes/mascota-sprites.js");
const buscar = (m, clase) => m.nodo.buscar((e) => e.atributos.get("class") === clase)[0];
const f14 = { frases: { maximo: F.MAXIMO, animo: F.ANIMO, evento: F.EVENTO }, efectos: [], accesorios: [], ojosX: [], imagenes: { accesorios: {}, desmayada: {}, efectos: {} } };
// Los nombres son los de fito_mascota.h (los #define); `FITO_DESMAYO_DY` es el arreglo de fito_mascota.c.
f14.constantes = {
  FITO_FRASE_ALTERNA_MS: E.FRASE_ALTERNA_MS, FITO_FRASE_EVENTO_MS: E.FRASE_EVENTO_MS, FITO_COLA_EV_MAX: E.COLA_EV_MAX,
  FITO_RAYOS_CUADRO_MS: E.RAYOS.CUADRO_MS, FITO_RAYOS_CUADROS: E.RAYOS.CUADROS, FITO_RAYOS_VUELTAS: E.RAYOS.VUELTAS, FITO_RAYOS_MS: E.RAYOS_MS,
  FITO_CORAZON_CUADRO_MS: E.CORAZON.CUADRO_MS, FITO_CORAZON_CUADROS: E.CORAZON.CUADROS, FITO_CORAZON_VUELTAS: E.CORAZON.VUELTAS, FITO_CORAZON_MS: E.CORAZON_MS,
  FITO_DESTELLOS_CUADRO_MS: E.DESTELLOS.CUADRO_MS, FITO_DESTELLOS_CUADROS: E.DESTELLOS.CUADROS, FITO_DESTELLOS_VUELTAS: E.DESTELLOS.VUELTAS, FITO_DESTELLOS_MS: E.DESTELLOS_MS,
  FITO_ESTRELLA_CUADRO_MS: E.ESTRELLA.CUADRO_MS, FITO_ESTRELLA_CUADROS: E.ESTRELLA.CUADROS, FITO_ESTRELLA_VUELTAS: E.ESTRELLA.VUELTAS, FITO_ESTRELLA_MS: E.ESTRELLA_MS,
  FITO_DESMAYO_CUADRO_MS: E.DESMAYO_CUADRO_MS, FITO_DESMAYO_CUADROS: E.DESMAYO_DY.length, FITO_DESMAYO_MS: E.DESMAYO_MS, FITO_DESMAYADA_DY: E.DESMAYADA_DY,
  FITO_DESMAYO_DY: [...E.DESMAYO_DY],
};
// Cada cuadro de cada efecto, pintado por la mascota con su cola de eventos y un reloj falso (el cuadro `c` empieza a `c * ms` del evento).
const TIEMPOS = { SALIO_AL_SOL: ["rayos", E.RAYOS], ACARICIADA: ["corazon", E.CORAZON], REVIVIO: ["destellos", E.DESTELLOS], RACHA: ["estrella", E.ESTRELLA] };
for (const [tipo, [efecto, tabla]] of Object.entries(TIEMPOS)) {
  for (let cuadro = 0; cuadro < tabla.CUADROS; cuadro++) {
    let ahora = 1000;
    const r = E.crearReproductor({ reloj: () => ahora });
    const m = crearMascota("girasol", { estado: "SALUDABLE", eventos: r });
    m.pintar(0);
    r.empujar(tipo);
    m.pintar(0); // el evento arranca en el primer cuadro que se pinta
    ahora = 1000 + cuadro * tabla.CUADRO_MS + 1;
    m.pintar(cuadro * tabla.CUADRO_MS + 1);
    const grupo = buscar(m, "masc-efecto");
    f14.efectos.push({ efecto, cuadro, sprite: grupo.hijos[1].getAttribute("d"), aureola: grupo.hijos[0].getAttribute("d") });
    f14.imagenes.efectos[`${efecto}_${cuadro}`] = svgDe(m).svg;
  }
}
// Accesorios: cada familia x nivel x accesorio (la carnívora saludable en sus tres cuadros de boca) en reposo, sin balanceo ni salto.
const CASOS = [["SALUDABLE", null, 0], ["EN_RIESGO", null, 1], ["CRITICO", null, 2], ["SALUDABLE", "NOCHE", 3]];
for (const familia of FAMILIAS) {
  f14.imagenes.accesorios[familia] = {};
  for (const accesorio of ["NINGUNO", "SOMBRERO", "MONO", "GAFAS"]) {
    for (const [estado, periodo, nivel] of CASOS) {
      for (const cuadro of familia === "carnivora" && nivel === 0 ? [0, 1, 2] : [0]) {
        const m = crearMascota(familia, { estado, periodo: periodo || "DIA", accesorio });
        m.pintar(2500, { reposo: true, cuadro });
        const grupo = buscar(m, "masc-accesorio");
        if (accesorio !== "NINGUNO") f14.accesorios.push({ familia, accesorio, nivel, cuadro, sprite: grupo.hijos[1].getAttribute("d"), aureola: grupo.hijos[0].getAttribute("d") });
        if (nivel === 0 && cuadro === 0) f14.imagenes.accesorios[familia][accesorio] = svgDe(m).svg;
      }
    }
  }
}
// Ojos en «x» de la pose de desmayo (nivel crítico)
for (const familia of FAMILIAS) {
  const m = crearMascota(familia, { estado: "CRITICO" });
  m.ponerDesmayada(true);
  m.pintar(2500, { reposo: true });
  f14.ojosX.push({ familia, pixeles: m.piezas().ojosX.map((o) => o.pixeles) });
  const sano = crearMascota(familia, { estado: "SALUDABLE" });
  sano.ponerDesmayada(true);
  sano.pintar(2500, { reposo: true });
  f14.imagenes.desmayada[familia] = svgDe(sano).svg;
}
// Los accesorios como los deja `previsualizar.py` (fase 14, `mascota_completa`): familia x columna (saludable, en riesgo, crítico y
// «dormida», que ahí es crítico de noche) a los 2500 ms de una escena tranquila, con el balanceo del momento. Con `--oled`
// `comparar-mascotas.py` los pone contra los recortes `mascota/acc_<accesorio>_<familia>_<columna>.png` de la OLED.
f14.accesorios2500 = [];
for (const familia of FAMILIAS) {
  for (const accesorio of ["SOMBRERO", "MONO", "GAFAS"]) {
    for (let col = 0; col < 4; col++) {
      const estado = ["SALUDABLE", "EN_RIESGO", "CRITICO"][Math.min(col, 2)];
      const m = crearMascota(familia, { estado, periodo: col === 3 ? "NOCHE" : "DIA", accesorio });
      for (const t of [0, 500, 1000, 1500, 2000, 2500]) m.pintar(t);
      const g = buscar(m, "masc-accesorio");
      f14.accesorios2500.push({ familia, accesorio, col, sprite: g.hijos[1].getAttribute("d"), aureola: g.hijos[0].getAttribute("d"), transform: g.getAttribute("transform") || "" });
    }
  }
}
salida.fase14 = f14;
process.stdout.write(JSON.stringify(salida));
