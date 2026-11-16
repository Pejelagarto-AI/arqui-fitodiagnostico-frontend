// Poses de las mascotas, calcadas de `firmware/sprites/dibujar.py` (fase 7 del backend, D112 y D115): los mismos
// números con los que el firmware dibuja cada sprite de 48x64, convertidos a trazos SVG. Puro (sin DOM): devuelve
// cadenas `d` y listas de números que `mascota.js` convierte en nodos. Si cambia un número en dibujar.py, cambia aquí
// (y en tests/mascota-poses.test.mjs).
//
// Los puntos de dibujar.py son centros de píxel de PIL; el SVG los usa desplazados medio píxel (CORRIMIENTO), que es
// donde de verdad cae el trazo de un píxel. Quien arme la pose envuelve todo en `translate(CORRIMIENTO CORRIMIENTO)`.

export const CORRIMIENTO = 0.5;

const n = (v) => Number(v.toFixed(2));
const grados = (v) => (v * Math.PI) / 180;

/** Punto de una curva cuadrática de Bézier (p0, p1, p2) en t. `curva_q` de dibujar.py. */
export function puntoCuadratico(p0, p1, p2, t) {
  return [(1 - t) ** 2 * p0[0] + 2 * t * (1 - t) * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * t * (1 - t) * p1[1] + t * t * p2[1]];
}

/** Polilínea de la curva cuadrática en n+1 puntos, como `curva_q`. */
export function curvaQ(p0, p1, p2, pasos = 12) {
  return Array.from({ length: pasos + 1 }, (_, i) => puntoCuadratico(p0, p1, p2, i / pasos));
}

/** Tallo: la curva cuadrática como trazo (se pinta con trazo redondo del grosor de `tallo()`). */
export function talloD(p0, p1, p2) {
  return `M${n(p0[0])} ${n(p0[1])}Q${n(p1[0])} ${n(p1[1])} ${n(p2[0])} ${n(p2[1])}`;
}

const pts = (lista) => lista.map(([x, y]) => `${n(x)} ${n(y)}`);

/**
 * Contorno de una hoja en forma de lenteja entre `base` y `tip`, de medio ancho `ancho`, arqueada `curva` px.
 * `perfil` es el exponente del seno (0,85 en `hoja()`, 0,7 en `lente()`). Devuelve { d, vena } con `vena` la línea
 * central (puntos 2 a 10 de 14, solo si la hoja es grande: largo >= 13 y ancho >= 3) o null.
 */
export function lente(base, tip, ancho, { curva = 0, perfil = 0.85, vena = true } = {}) {
  const [bx, by] = base;
  const dx = tip[0] - bx;
  const dy = tip[1] - by;
  const largo = Math.hypot(dx, dy);
  const ux = dx / largo;
  const uy = dy / largo;
  const px = -uy;
  const py = ux;
  const izq = [];
  const der = [];
  const centro = [];
  const pasos = 14;
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos;
    const a = ancho * Math.sin(Math.PI * t) ** perfil;
    const c = curva * Math.sin(Math.PI * t);
    const cx = bx + dx * t + px * c;
    const cy = by + dy * t + py * c;
    centro.push([cx, cy]);
    izq.push([cx + px * a, cy + py * a]);
    der.push([cx - px * a, cy - py * a]);
  }
  const contorno = [...izq, ...der.reverse()];
  const d = `M${pts(contorno).join("L")}Z`;
  const conVena = vena && largo >= 13 && ancho >= 3;
  return { d, vena: conVena ? `M${pts(centro.slice(2, 11)).join("L")}` : null, largo };
}

/**
 * Corona de `cantidad` pétalos (`petalos()` de dibujar.py): cada uno sale del radio `rIn` y llega al `rOut`; `caida`
 * (0 a 1) dobla las puntas hacia abajo y `quitar` deja huecos. Devuelve cada pétalo como elipse: centro, medios
 * ejes (rx de ancho, ry de largo) y el giro en grados que lleva su eje largo de la base a la punta.
 */
export function petalosDe({ cx, cy, rIn, rOut, cantidad, fase, quitar = [], caida = 0, ancho = 3.2 }) {
  const lista = [];
  for (let i = 0; i < cantidad; i++) {
    if (quitar.includes(i)) continue;
    const a = grados(fase + (i * 360) / cantidad);
    const bx = cx + rIn * Math.cos(a);
    const by = cy + rIn * Math.sin(a);
    const tx = cx + rOut * Math.cos(a);
    const ty = cy + rOut * Math.sin(a) + caida * (rOut - rIn) * (1 - Math.abs(Math.sin(a))) * 0.9 + caida * 2;
    const largo = Math.hypot(tx - bx, ty - by);
    lista.push({ i, cx: n((bx + tx) / 2), cy: n((by + ty) / 2), rx: ancho, ry: n(largo / 2 + 0.6), giro: n((Math.atan2(ty - by, tx - bx) * 180) / Math.PI + 90) });
  }
  return lista;
}

/**
 * Fronda de helecho como una pluma (`fronda()` de dibujar.py): un raquis en curva y foliolos de 1 px a los dos
 * lados que se achican hacia la punta. `abre` es el ángulo de los foliolos respecto al raquis y `decae` (0 a 1) los
 * dobla hacia abajo. Devuelve { raquis, foliolos }, dos cadenas `d`.
 */
export function frondaD(p0, p1, p2, largo, abre, decae = 0, { desde = 0.2, paso = 2.2 } = {}) {
  const puntos = curvaQ(p0, p1, p2, 40);
  const acum = [0];
  let total = 0;
  for (let i = 1; i < puntos.length; i++) {
    total += Math.hypot(puntos[i][0] - puntos[i - 1][0], puntos[i][1] - puntos[i - 1][1]);
    acum.push(total);
  }
  const foliolos = [];
  let s = total * desde;
  while (s < total - 1) {
    let k = acum.findIndex((v) => v >= s);
    k = Math.min(Math.max(k, 1), puntos.length - 1);
    const [x0, y0] = puntos[k - 1];
    const [x1, y1] = puntos[k];
    const m0 = Math.hypot(x1 - x0, y1 - y0) || 1;
    const tx = (x1 - x0) / m0;
    const ty = (y1 - y0) / m0;
    const tam = largo * (1 - (0.75 * (s / total - desde)) / (1 - desde));
    for (const lado of [-1, 1]) {
      const ang = grados(abre) * lado;
      const dx = tx * Math.cos(ang) - ty * Math.sin(ang);
      const dy = ty * Math.cos(ang) + tx * Math.sin(ang) + decae;
      const m = Math.hypot(dx, dy);
      foliolos.push(`M${n(x1)} ${n(y1)}L${n(x1 + (dx / m) * tam)} ${n(y1 + (dy / m) * tam)}`);
    }
    s += paso;
  }
  return { raquis: `M${pts(puntos).join("L")}`, foliolos: foliolos.join("") };
}

// ---------- tablas por familia y nivel (0 saludable, 1 en riesgo, 2 crítico), números de dibujar.py ----------

/** Girasol: tallo, dos hojas, disco (centro y radio) y corona de pétalos. Cabeza de crítico: la que cuelga. */
export const GIRASOL = [
  {
    tallo: [[24, 47], [24, 36], [24, 25]],
    hojas: [{ base: [24, 40], tip: [7, 31], ancho: 5, curva: -3 }, { base: [24, 36], tip: [41, 28], ancho: 5, curva: 3 }],
    disco: { cx: 24, cy: 17, r: 10 },
    corona: { cx: 24, cy: 17, rIn: 9, rOut: 17, cantidad: 12, fase: 0 },
  },
  {
    tallo: [[24, 47], [23, 32], [26, 28]],
    hojas: [{ base: [24, 41], tip: [8, 42], ancho: 5, curva: 4 }, { base: [24, 37], tip: [40, 40], ancho: 5, curva: -4 }],
    disco: { cx: 28, cy: 22, r: 9 },
    corona: { cx: 28, cy: 22, rIn: 8, rOut: 15, cantidad: 11, fase: 8, quitar: [2, 7], caida: 0.5 },
  },
  {
    tallo: [[22, 47], [20, 18], [28, 20]],
    hojas: [{ base: [21, 42], tip: [6, 46], ancho: 4, curva: 2, vena: false }, { base: [21, 38], tip: [10, 40], ancho: 3, curva: -2, vena: false }],
    disco: { cx: 31, cy: 29, r: 9 },
    corona: { cx: 31, cy: 29, rIn: 8, rOut: 15, cantidad: 10, fase: 18, quitar: [1, 5, 8], caida: 1.0, ancho: 2.8 },
    suelo: { base: [40, 61], tip: [47, 62], ancho: 2 }, // un pétalo caído
  },
];

/** Cactus: cima del cuerpo y los dos brazos (rectángulo vertical, rectángulo horizontal), como `rounded_rectangle`. */
export const CACTUS = [
  { cima: 9, brazos: [[[5, 16, 11, 34], [6, 28, 18, 34]], [[37, 11, 43, 30], [30, 24, 42, 30]]], costillaDesde: 37 },
  { cima: 10, brazos: [[[4, 30, 10, 42], [5, 30, 18, 36]], [[38, 27, 44, 39], [30, 27, 43, 33]]], costillaDesde: 37 },
  { cima: 17, brazos: [[[3, 36, 8, 45], [4, 34, 18, 39]], [[40, 33, 45, 42], [30, 31, 44, 36]]], costillaDesde: 41, espinaCaida: [[40, 61], [43, 58]] },
];

/** Suculenta: centro (cx, cy), hojas de atrás y del medio como [grados, largo], medio ancho, radio del corazón. */
export const SUCULENTA = [
  { cx: 24, cy: 36, atras: [[200, 21], [232, 21], [270, 21], [308, 21], [340, 21]], medio: [[176, 21], [214, 18], [250, 16], [290, 16], [326, 18], [4, 21]], ancho: 6, centro: 9 },
  { cx: 24, cy: 37, atras: [[194, 21], [228, 19], [270, 17], [312, 19], [346, 21]], medio: [[172, 21], [208, 18], [332, 18], [8, 21]], ancho: 5, centro: 9 },
  { cx: 24, cy: 39, atras: [[190, 18], [222, 15], [318, 15], [350, 18]], medio: [[168, 19], [12, 19]], ancho: 3, centro: 8, caidas: 6, suelo: { base: [38, 62], tip: [47, 60], ancho: 2 } },
];

/** Hojas de la suculenta de un nivel: lista de { capa: "a" | "b", d } y el radio del corazón. `inflada`: el cuadro 1. */
export function hojasDeSuculenta(nivel, inflada = false) {
  const p = SUCULENTA[nivel];
  const g = inflada ? 1 : 0;
  const hojas = [];
  for (const [capa, lista] of [["a", p.atras], ["b", p.medio]]) {
    for (const [ang, largo] of lista) {
      const a = grados(ang);
      const tip = [p.cx + (largo + g * 2) * Math.cos(a), p.cy + (largo + g * 2) * Math.sin(a) + (p.caidas || 0)];
      hojas.push({ capa, d: lente([p.cx, p.cy], tip, p.ancho + g, { perfil: 0.7, vena: false }).d });
    }
  }
  return { hojas, centro: p.centro + g, cx: p.cx, cy: p.cy };
}

/** Helecho: frondas [p0, p1, p2, largo] de cada nivel y cuadro `c` (0 o 1), ángulo de los foliolos, caída y paso. */
export function helecho(nivel, c) {
  const m = c ? 1 : -1;
  if (nivel === 0) {
    return { abre: 58 + 10 * c, decae: 0, paso: 2.2, frondas: [
      [[24, 46], [24, 24], [24 + m, 1], 6], [[23, 46], [16, 22], [5 + m, 6], 5], [[25, 46], [32, 22], [43 + m, 6], 5],
      [[22, 46], [9, 36], [1, 25 + m], 5], [[26, 46], [39, 36], [47, 25 - m], 5]] };
  }
  if (nivel === 1) {
    return { abre: 55 + 8 * c, decae: 0.35, paso: 2.2, frondas: [
      [[24, 46], [25, 20], [34, 12 + m], 5], [[23, 46], [14, 18], [4, 26 + m], 5], [[25, 46], [34, 18], [44, 26 - m], 5],
      [[22, 46], [6, 34], [1, 46 + m], 4], [[26, 46], [42, 34], [47, 46 - m], 4]] };
  }
  return { abre: 45 + 6 * c, decae: 0.9, paso: 3.3, suelo: { base: [39, 62], tip: [46, 61], ancho: 2 }, frondas: [
    [[24, 46], [22, 24], [34, 28 + m], 4], [[23, 46], [10, 28], [3, 45 + m], 4], [[25, 46], [38, 28], [45, 45 - m], 4], [[22, 46], [5, 40], [2, 58], 3]] };
}

/** Planta común (la genérica), cuadro 0 de `planta()`: tallo y hojas por nivel. */
export const GENERICA = [
  { tallo: [[24, 47], [24, 38], [23, 26]], hojas: [
    { base: [23, 28], tip: [22, 2], ancho: 7, curva: -1.5 }, { base: [24, 38], tip: [4, 16], ancho: 6, curva: -3 }, { base: [24, 35], tip: [42, 13], ancho: 6, curva: 3 },
    { base: [24, 44], tip: [7, 36], ancho: 4, curva: -2, vena: false }, { base: [24, 44], tip: [41, 35], ancho: 4, curva: 2, vena: false }] },
  { tallo: [[24, 47], [24, 34], [29, 25]], hojas: [
    { base: [29, 26], tip: [41, 36], ancho: 6, curva: -4 }, { base: [25, 37], tip: [5, 39], ancho: 6, curva: 5 }, { base: [27, 33], tip: [46, 42], ancho: 5, curva: -5 },
    { base: [28, 28], tip: [14, 17], ancho: 4, curva: 4, vena: false }] },
  { tallo: [[24, 47], [22, 30], [32, 30]], hojas: [
    { base: [32, 31], tip: [36, 44], ancho: 5, curva: -2 }, { base: [24, 38], tip: [14, 44], ancho: 4, curva: 3, vena: false }, { base: [26, 35], tip: [20, 45], ancho: 4, curva: -3, vena: false },
    { base: [37, 61], tip: [47, 59], ancho: 2, curva: 1, vena: false }] },
];

/** Carnívora triste (carni_riesgo_0, carni_critico_0): centro de la cabeza, desvío del tallo y las dos hojitas. */
export const CARNIVORA_TRISTE = [
  { cy: 26, desv: 0, cara: 25 },
  { cy: 31, desv: 4, cara: 30 },
];
export const CARNIVORA_HOJAS = [{ base: [23, 46], tip: [4, 40], ancho: 3, curva: -2, vena: false }, { base: [25, 46], tip: [44, 40], ancho: 3, curva: 2, vena: false }];

/** Las dos hojitas de la carnívora saludable (carni_abierta_0): igual que las de riesgo pero más cortas y altas. */
export const CARNIVORA_HOJAS_SALUDABLE = [{ base: [22, 46], tip: [6, 39], ancho: 3, curva: -2, vena: false }, { base: [26, 46], tip: [42, 39], ancho: 3, curva: 2, vena: false }];

/** Decoración del borde de la matera por familia (`matera(deco=...)`): lista de píxeles [x, y] que se apagan. */
export function decoracionDeMatera(familia) {
  const lista = [];
  if (familia === "girasol") for (let x = 10; x < 39; x += 3) lista.push([x, 47], [x + 1, 48]);
  else if (familia === "cactus") for (let x = 9; x < 39; x++) lista.push([x, 47 + (Math.floor(x / 2) % 2)]);
  else if (familia === "carnivora") {
    for (let x = 13; x <= 34; x++) lista.push([x, 58]);
    for (let x = 14; x < 34; x += 4) lista.push([x, 60]);
  }
  return lista;
}

/** Píxeles como un solo trazo de cuadritos de 1x1 (`d` con un `h1v1h-1z` por píxel). */
export function pixelesD(lista) {
  return lista.map(([x, y]) => `M${x} ${y}h1v1h-1z`).join("");
}

// ---------- carnívora saludable: la trampa de `trampa()` y `carnivora("feliz")` de dibujar.py ----------

/** Abertura de la boca de cada cuadro (carni_abierta_0, carni_media, carni_cerrada): `CARNI_G[]` de pantalla.cpp. */
export const CARNIVORA_BOCA_G = [14, 7, 0];
export const CARNIVORA_CY = 21; // centro de la boca de la carnívora saludable

/**
 * La cabeza de trampa con la boca en `g` px de abertura, centrada en (24, cy): la elipse de la cabeza (centro y radios
 * en coordenadas de trazo, o sea ya sin el medio píxel), la boca en lente con sus dientes (abierta) o el zigzag de los
 * dientes entrelazados (cerrada), y el punto donde termina la cabeza (para el tallo).
 */
export function cabezaDeTrampa(g, cy = CARNIVORA_CY) {
  const sup = cy - 13 - g / 2;
  const inf = cy + 9 + g / 2;
  const cabeza = { cx: 24, cy: (sup + inf) / 2, rx: 22.5, ry: (inf - sup + 1) / 2 };
  if (g > 0) {
    const L = g >= 10 ? 5 : 3;
    const borde = (x) => (g / 2) * Math.sqrt(Math.max(0, 1 - ((x - 24) / 19) ** 2));
    const dientes = [];
    for (const off of [-12, -6, 0, 6, 12]) {
      const x = 24 + off;
      const yb = cy - borde(x);
      dientes.push(`M${n(x - 3)} ${n(yb - 1)}L${n(x + 3)} ${n(yb - 1)}L${n(x)} ${n(yb + L)}Z`);
    }
    for (const off of [-9, -3, 3, 9]) {
      const x = 24 + off;
      const yb = cy + borde(x);
      dientes.push(`M${n(x - 3)} ${n(yb + 1)}L${n(x + 3)} ${n(yb + 1)}L${n(x)} ${n(yb - L)}Z`);
    }
    return { cabeza, inf, lente: { cx: 24, cy, rx: 19.5, ry: g / 2 + 0.5 }, dientes: dientes.join(""), zigzag: null };
  }
  const zig = Array.from({ length: 14 }, (_, i) => [5 + i * 3, cy + (i % 2 ? 2 : -2)]);
  return { cabeza, inf, lente: null, dientes: null, zigzag: `M5 ${cy}L6 ${cy}M${pts(zig).join("L")}` };
}
