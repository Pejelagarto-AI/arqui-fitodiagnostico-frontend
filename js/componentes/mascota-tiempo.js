// Tiempos y caras de las mascotas, calcados de `firmware/src/pantalla.cpp` (fase 7 del backend, D110 a D117).
// Regla: la mascota del front se ve y se mueve IGUAL que la de la OLED. Por eso todo lo que decide la pose de un
// cuadro (balanceo, parpadeo, cara por estado, corona del girasol, flor del cactus, respiración de la suculenta,
// frondas del helecho, mordisco de la carnívora) está aquí con los mismos números, en píxeles de la OLED (el
// sprite es de 48x64 y el SVG de la mascota usa ese mismo sistema de coordenadas). Puro: se prueba con Node.
// Si cambia un número en pantalla.cpp, cambia aquí (y en tests/mascota-tiempo.test.mjs).

export const Y_MATERA = 46; // desde aquí el sprite no se balancea
export const PERIODO_BALANCEO_MS = 2800;
export const AMPLITUD = [2.2, 1.5, 0.8]; // px en la punta por nivel: saludable, en riesgo, crítico
// FACTOR_BALANCEO[] del firmware, por familia (el orden del enum allá: Comun, Carnivora, Girasol, Cactus, Suculenta, Helecho).
export const FACTOR_BALANCEO = { generica: 1.0, carnivora: 1.0, girasol: 1.3, cactus: 0.4, suculenta: 0.4, helecho: 1.2 };
export const TRANSICION_MS = 400;

// Cara por nivel: ojos abiertos 0..1, cejas 0..1, boca -1..1 (sonrisa > 0), ondulación de la boca 0..1.
export const CARA_NIVEL = [
  { abierto: 1.0, inclina: 0.0, boca: 1.0, onda: 0.0 },
  { abierto: 0.55, inclina: 0.6, boca: -0.5, onda: 0.7 },
  { abierto: 0.6, inclina: 1.0, boca: -1.0, onda: 0.0 },
];

// Geometria del firmware: separación de ojos, alto del ojo, media boca, fila de la boca, curva, fila de la ceja, columna de la lágrima.
export const GEO_TRAMPA = { separacion: 9, altoOjo: 7, semiBoca: 7, yBoca: 2, curvaBoca: 4.0, yCeja: -6, xLagrima: 13 };
export const GEO_CHICA = { separacion: 4, altoOjo: 5, semiBoca: 4, yBoca: 4, curvaBoca: 2.0, yCeja: -4, xLagrima: 7 };
export const GEO_CACTUS = { separacion: 5, altoOjo: 5, semiBoca: 5, yBoca: 4, curvaBoca: 2.0, yCeja: -5, xLagrima: 8 };

// Centro de la cara por nivel (sigue a la cabeza del sprite).
export const CARA_GIRASOL = [{ x: 24, y: 17 }, { x: 28, y: 22 }, { x: 31, y: 29 }];
export const CARA_CACTUS = [{ x: 24, y: 22 }, { x: 24, y: 23 }, { x: 24, y: 29 }];
export const CARA_SUCULENTA = [{ x: 24, y: 36 }, { x: 24, y: 37 }, { x: 24, y: 39 }];

export const GIRASOL_CUADRO_MS = 400; // la corona alterna medio pétalo cada 400 ms
export const GIRASOL_CABECEO_MS = 1600; // cabecea 0,6 px
export const GIRASOL_MIRA_MS = 5000; // mira a los lados 1,5 px
export const CACTUS_Y_FLOR = 4;
export const CACTUS_ESPERA_FLOR_MS = 600;
export const CACTUS_CRECE_FLOR_MS = 1500;
export const SUCULENTA_RESPIRA_MS = 4500; // se infla 500 ms cada 4,5 s
export const SUCULENTA_INFLADA_MS = 500;
export const HELECHO_MS = [450, 700, 1100]; // alterna las frondas: más lento cuanto peor está
export const LAGRIMA_CICLO_MS = 4200;
export const LAGRIMA_CAE_MS = 900;
// Mordisco de la carnívora: (hasta ms, cuadro de boca 0 abierta / 1 media / 2 cerrada, desplazamiento vertical).
export const MORDISCO = [
  { hasta: 90, boca: 0, dy: 0 },
  { hasta: 170, boca: 1, dy: 0 },
  { hasta: 290, boca: 2, dy: 2 },
  { hasta: 380, boca: 1, dy: 1 },
  { hasta: 460, boca: 0, dy: -1 },
];
export const MORDISCO_MS = 460;

/** Nivel 0, 1 o 2 desde el estado del diagnóstico (sin diagnóstico se dibuja como saludable, igual que la matera). */
export function nivelDe(estado) {
  return estado === "EN_RIESGO" ? 1 : estado === "CRITICO" ? 2 : 0;
}

export function suave(t) {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

const mezcla = (a, b, k) => a + (b - a) * k;

/** `lroundf` de C: redondea las mitades lejos del cero (Math.round(-0.5) da 0, lroundf da -1). */
export function lround(v) {
  return Math.sign(v) * Math.round(Math.abs(v)) + 0;
}

/** Cara a `ms` de haber empezado la transición de `desde` a `hasta` (400 ms con suavizado, como `caraEn`). */
export function caraEn(desde, hasta, ms) {
  const k = suave(ms / TRANSICION_MS);
  return { abierto: mezcla(desde.abierto, hasta.abierto, k), inclina: mezcla(desde.inclina, hasta.inclina, k), boca: mezcla(desde.boca, hasta.boca, k), onda: mezcla(desde.onda, hasta.onda, k) };
}

/** Seno del balanceo en `ahora` (ms). */
export function senoBalanceo(ahora) {
  return Math.sin((2 * Math.PI * (ahora % PERIODO_BALANCEO_MS)) / PERIODO_BALANCEO_MS);
}

/** Amplitud del balanceo de una familia en un nivel (px en la punta). */
export function amplitud(familia, nivel) {
  return AMPLITUD[nivel] * (FACTOR_BALANCEO[familia] ?? 1);
}

/** Desplazamiento horizontal de la fila y (crece hacia arriba: la planta se dobla). Igual que `desv`, sin redondear. */
export function desv(y, seno, amp) {
  return y < Y_MATERA ? (amp * seno * (Y_MATERA - y)) / Y_MATERA : 0;
}

/**
 * El balanceo como transformación SVG: cada fila y se corre desv(y), o sea un cizallamiento con eje en la matera.
 * x' = x + c (46 - y), con c = amp·seno/46. Devuelve el `matrix(...)`.
 */
export function matrizBalanceo(seno, amp) {
  const c = (amp * seno) / Y_MATERA;
  return `matrix(1 0 ${(-c).toFixed(5)} 1 ${(c * Y_MATERA).toFixed(4)} 0)`;
}

/** Factor de parpadeo a `t` ms de empezado: medio cerrado, cerrado, medio cerrado (150 ms). */
export function factorParpadeo(t) {
  if (t < 0) return 1;
  return t < 50 ? 0.5 : t < 100 ? 0 : t < 150 ? 0.5 : 1;
}

/** Cuánto esperar hasta el próximo parpadeo: 3 a 5 s, como `3000 + random(2001)`. */
export function esperaDeParpadeo(azar = Math.random()) {
  return 3000 + Math.floor(azar * 2001);
}

/** Fila de la boca en la columna x (curva y ondulación), como `yBoca` del firmware. */
export function yBoca(x, cx, semi, y0, curva, cara) {
  const u = (x - cx) / semi;
  return y0 - lround(cara.boca * curva * u * u) + lround(cara.onda * 0.9 * Math.sin(x * 2.3));
}

/**
 * Las piezas de una cara grande (`caraGrande`) en píxeles: dos ojos (rectángulos de 5 de ancho), su brillo, las
 * cejas si hay preocupación, los puntos de la boca y la lágrima del crítico. `tLagrima` es `ahora` (ms) o null.
 */
export function piezasDeCara(cara, parpadeo, cx, cy, geo, { conBoca = true, nivel = 0, ahora = 0 } = {}) {
  const a = cara.abierto * parpadeo;
  const h = Math.max(1, lround(geo.altoOjo * a));
  const ojos = [];
  const cejas = [];
  for (const lado of [-1, 1]) {
    const ex = cx + geo.separacion * lado;
    const top = cy - Math.floor(h / 2);
    ojos.push({ x: ex - 2, y: top, ancho: 5, alto: h, radio: h >= 4 ? 2 : h >= 2 ? 1 : 0, brillo: h >= 5 ? { x: ex - 1, y: top + 1 } : null });
    if (cara.inclina > 0.2) {
      cejas.push({ x1: ex + 4 * lado, y1: cy + geo.yCeja + lround(cara.inclina), x2: ex - 3 * lado, y2: cy + geo.yCeja - lround(2 * cara.inclina) });
    }
  }
  const boca = [];
  let lagrima = null;
  if (conBoca) {
    for (let x = cx - geo.semiBoca; x <= cx + geo.semiBoca; x++) boca.push({ x, y: yBoca(x, cx, geo.semiBoca, cy + geo.yBoca, geo.curvaBoca, cara) });
    if (nivel === 2) {
      const fase = ahora % LAGRIMA_CICLO_MS;
      if (fase < LAGRIMA_CAE_MS) lagrima = { x: cx + geo.xLagrima, y: cy + geo.yBoca + 1 + Math.floor((fase * 7) / LAGRIMA_CAE_MS), alto: 2 };
    }
  }
  return { ojos, cejas, boca, lagrima };
}

/** La cara de la matera (planta común y helecho): ojos de 3x3, cejas de tres puntos, boca de 6 px (`caraMatera`). */
export function piezasDeCaraMatera(cara, parpadeo, { nivel = 0, ahora = 0 } = {}) {
  const a = cara.abierto * parpadeo;
  const h = a >= 0.85 ? 3 : a >= 0.4 ? 2 : 1;
  const ojos = [17, 28].map((ex) => ({ x: ex, y: 58 - h, ancho: 3, alto: h, radio: 0, brillo: null }));
  const cejas = [];
  if (cara.inclina > 0.2) {
    const dentro = 53 - lround(cara.inclina);
    const medio = 53 - (cara.inclina > 0.5 ? 1 : 0);
    cejas.push({ x1: 17, y1: 53, x2: 19, y2: dentro, medio: { x: 18, y: medio } }, { x1: 30, y1: 53, x2: 28, y2: dentro, medio: { x: 29, y: medio } });
  }
  const boca = [];
  for (let x = 21; x <= 26; x++) {
    const y = yBoca(x, 23.5, 2.5, 60, 1.2, cara);
    boca.push({ x, y: y < 59 ? 59 : y > 62 ? 62 : y });
  }
  let lagrima = null;
  if (nivel === 2) {
    const fase = ahora % LAGRIMA_CICLO_MS;
    if (fase < LAGRIMA_CAE_MS) lagrima = { x: 31, y: 56 + Math.floor((fase * 5) / LAGRIMA_CAE_MS), alto: 3 };
  }
  return { ojos, cejas, boca, lagrima };
}

/** Girasol saludable: cuadro de la corona (0 o 1), cabeceo (px) y mirada (px) a `ahora` ms. */
export function poseGirasol(ahora, nivel) {
  if (nivel !== 0) return { cuadro: 0, dy: 0, mira: 0 };
  return {
    cuadro: Math.floor(ahora / GIRASOL_CUADRO_MS) % 2,
    dy: 0.6 * Math.sin((2 * Math.PI * (ahora % GIRASOL_CABECEO_MS)) / GIRASOL_CABECEO_MS),
    mira: 1.5 * Math.sin((2 * Math.PI * (ahora % GIRASOL_MIRA_MS)) / GIRASOL_MIRA_MS),
  };
}

/**
 * Flor del cactus a `desdeNivel` ms de haber llegado a saludable: null (aún no), un botón, o cinco pétalos a
 * distancia d del centro. Como `florCactus` con k = suave(...).
 */
export function florCactus(desdeNivel, nivel) {
  if (nivel !== 0 || desdeNivel <= CACTUS_ESPERA_FLOR_MS) return null;
  const k = suave(Math.min(1, (desdeNivel - CACTUS_ESPERA_FLOR_MS) / CACTUS_CRECE_FLOR_MS));
  if (k <= 0) return null;
  if (k < 0.3) return { boton: true, k };
  return { boton: false, k, d: 1 + Math.round(2 * k) };
}

/** Suculenta: ¿está inflada (respira) a `ahora` ms? Solo saludable. */
export function suculentaInflada(ahora, nivel) {
  return nivel === 0 && ahora % SUCULENTA_RESPIRA_MS < SUCULENTA_INFLADA_MS;
}

/** Helecho: cuál de los dos cuadros de frondas toca a `ahora` ms. */
export function cuadroHelecho(ahora, nivel) {
  return Math.floor(ahora / HELECHO_MS[nivel]) % 2;
}

/** Carnívora: cuadro de boca y desplazamiento a `t` ms de empezado un mordisco (null si ya terminó). */
export function pasoMordisco(t) {
  if (t < 0 || t >= MORDISCO_MS) return null;
  return MORDISCO.find((p) => t < p.hasta);
}

/** Próximo mordisco espontáneo: `ahora + 6000 + (ahora % 4000)`, como el firmware. */
export function proximoMordisco(ahora) {
  return ahora + 6000 + (ahora % 4000);
}
