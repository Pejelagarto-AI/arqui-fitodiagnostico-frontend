// Los sprites nuevos de la fase 14 (efectos de los eventos, ojos en "x" y accesorios) y la tabla de anclas de los
// accesorios, calcados de `firmware/sprites/arte/*.txt` y de `ANCLA_ACCESORIO` de `firmware/src/pantalla.cpp` (D195, D197;
// los números están en `docs/fase14/IMPLEMENTACION.md`, «Anclas de los accesorios»). Cada sprite es de 1 bit: «#» encendido,
// «.» transparente. Se dibujan con el mismo pipeline que los demás (`pixelesD`, un cuadrito de 1x1 por píxel) y con la
// aureola negra de 1 px de la OLED (`bitmapConHalo`: los 8 vecinos del sprite en negro y el sprite encima en blanco).
// `tests/mascota-sprites.test.mjs` los compara con el arte del backend (si está) y `tools/comparar-mascotas.py` también.
// Puro: sin DOM.

export const RAYOS = Object.freeze([
  Object.freeze([".....#.....", ".....#.....", "...........", "...........", "....###....", "##..###..##", "....###....", "...........", "...........", ".....#.....", ".....#....."]),
  Object.freeze(["...........", ".#.......#.", "..#.....#..", "...........", "....###....", "....###....", "....###....", "...........", "..#.....#..", ".#.......#.", "..........."]),
  Object.freeze([".....#.....", ".....#.....", "..#..#..#..", "...........", "....###....", "###.###.###", "....###....", "...........", "..#..#..#..", ".....#.....", ".....#....."])
]);

export const CORAZON = Object.freeze([
  Object.freeze([".........", ".........", "..##.##..", ".#######.", ".#######.", "..#####..", "...###...", "....#...."]),
  Object.freeze([".##...##.", "####.####", "#########", "#########", ".#######.", "..#####..", "...###...", "....#...."])
]);

export const DESTELLOS = Object.freeze([
  Object.freeze(["...........", "...#.......", "...#.......", ".#####.....", "...#.......", "...#.......", "........#..", ".......###.", "........#..", "...........", "..........."]),
  Object.freeze(["...........", "...........", "...#.......", "..###...#..", "...#....#..", "......#####", "........#..", "........#..", "....#......", "...###.....", "....#......"]),
  Object.freeze(["...........", ".......#...", "......###..", ".......#...", "...........", "...#.......", "...#.......", ".#####.....", "...#.....#.", "...#....###", ".........#."])
]);

export const ESTRELLA = Object.freeze([
  Object.freeze(["...........", "...........", "...........", ".....#.....", "....###....", ".....#.....", "....#.#....", "...........", "...........", "...........", "..........."]),
  Object.freeze([".....#.....", ".....#.....", "....###....", ".#########.", "..#######..", "...#####...", "...#####...", "..###.###..", "..##...##..", "..#.....#..", "..........."]),
  Object.freeze([".....#.....", ".....#.....", "....#.#....", ".###...###.", "..#.....#..", "...#...#...", "...#.#.#...", "..#.#.#.#..", "..##...##..", "..#.....#..", "..........."])
]);

/** Ojos en "x" del desmayo (D194): 5x5 en la cara grande, 3x3 en la matera; negro sobre el cuerpo. */
export const OJO_X_5 = Object.freeze(["#...#", ".#.#.", "..#..", ".#.#.", "#...#"]);
export const OJO_X_3 = Object.freeze(["#.#", ".#.", "#.#"]);

/** Los accesorios (16x8, 10x8, 14x6, 24x7 la ancha de la carnívora). */
export const ACCESORIO_SPRITE = Object.freeze({
  SOMBRERO: Object.freeze(["......####......", ".....######.....", ".....######.....", ".....######.....", ".....#....#.....", "..############..", "################", ".##############."]),
  MONO: Object.freeze(["##......##", "###....###", "####..####", "##########", "##########", "####..####", "###....###", "##......##"]),
  GAFAS: Object.freeze([".####....####.", "######..######", "##..######..##", "##..##..##..##", "######..######", ".####....####."]),
  GAFAS_ANCHA: Object.freeze(["..####............####..", ".######..........######.", "##....##........##....##", "##....############....##", "##....##........##....##", ".######..........######.", "..####............####.."]),
});
/** `ANCLA_ACCESORIO[familia][nivel][accesorio]` de pantalla.cpp: (dx, dy) desde el punto de la cara hasta la esquina superior izquierda del
 * sprite. Nivel: 0 saludable, 1 en riesgo, 2 crítico, 3 dormida (solo el girasol y la carnívora cambian de cuerpo dormidos; las demás repiten su nivel 0).
 * Accesorio: 0 sombrero, 1 moño, 2 gafas. Orden de las familias: el del enum `Familia` del firmware. */
export const ANCLAS = Object.freeze({
  generica: Object.freeze([[[-8, -56], [2, -39], [-6, -3]], [[-8, -47], [2, -40], [-6, -3]], [[-8, -32], [2, -32], [-6, -3]], [[-8, -56], [2, -39], [-6, -3]]]),
  carnivora: Object.freeze([[[-8, -9], [2, -9], [-12, -3]], [[-8, -18], [2, -17], [-12, -3]], [[-8, -18], [2, -17], [-12, -3]], [[-8, -14], [2, -13], [-12, -3]]]),
  girasol: Object.freeze([[[-8, -17], [2, -17], [-7, -3]], [[-8, -20], [2, -17], [-7, -3]], [[-8, -19], [2, -12], [-7, -3]], [[-8, -21], [2, -18], [-7, -3]]]),
  cactus: Object.freeze([[[-8, -19], [2, -16], [-7, -3]], [[-8, -19], [2, -16], [-7, -3]], [[-8, -18], [2, -15], [-7, -3]], [[-8, -19], [2, -16], [-7, -3]]]),
  suculenta: Object.freeze([[[-8, -28], [2, -22], [-7, -3]], [[-8, -22], [2, -18], [-7, -3]], [[-8, -14], [2, -11], [-7, -3]], [[-8, -28], [2, -22], [-7, -3]]]),
  helecho: Object.freeze([[[-8, -56], [2, -41], [-6, -3]], [[-8, -43], [2, -48], [-6, -3]], [[-8, -36], [2, -35], [-6, -3]], [[-8, -56], [2, -41], [-6, -3]]]),
});
/** `CARA_MATERA` de pantalla.cpp: el punto de la cara de la planta común y el helecho (sus ojos están en la matera). */
export const CARA_MATERA = Object.freeze({ x: 23, y: 56 });
/** `CARA_GIRASOL_DORMIDO`: la cabeza caída del girasol saludable de noche (F49). */
export const CARA_GIRASOL_DORMIDO = Object.freeze({ x: 23, y: 21 });

/** Qué sprite lleva cada accesorio del servidor en una familia (la carnívora usa las gafas anchas: sus ojos están a 18 px). */
export function spriteDeAccesorio(accesorio, familia) {
  if (accesorio === "SOMBRERO") return ACCESORIO_SPRITE.SOMBRERO;
  if (accesorio === "MONO") return ACCESORIO_SPRITE.MONO;
  if (accesorio === "GAFAS") return familia === "carnivora" ? ACCESORIO_SPRITE.GAFAS_ANCHA : ACCESORIO_SPRITE.GAFAS;
  return null;
}

const INDICE_DE_ACCESORIO = { SOMBRERO: 0, MONO: 1, GAFAS: 2 };

/**
 * Dónde queda un accesorio: esquina superior izquierda del sprite = punto de la cara + ancla. `cara` es el punto tal como
 * está en el sprite (sin balanceo ni salto) y `nivel` el de la tabla (0 a 3). Devuelve { x, y, w, h, filas, sobreLaPlanta }:
 * `sobreLaPlanta` es la regla de `pintarAccesorio` (centro del sprite, `y + h / 2` entero, sobre la matera, y < Y_MATERA):
 * lo que queda ahí se balancea y sube y baja con el cuerpo; lo que queda en la matera (las gafas de la común y el helecho)
 * no se mueve, como su cara. Sin accesorio (NINGUNO o uno nuevo del servidor) devuelve null.
 */
export function colocarAccesorio({ accesorio, familia, nivel, cara, yMatera = 46 }) {
  const i = INDICE_DE_ACCESORIO[accesorio];
  const filas = spriteDeAccesorio(accesorio, familia);
  if (i === undefined || !filas) return null;
  const tabla = ANCLAS[familia] || ANCLAS.generica;
  const [dx, dy] = tabla[Math.max(0, Math.min(3, nivel))][i];
  const w = filas[0].length;
  const h = filas.length;
  const x = cara.x + dx;
  const y = cara.y + dy;
  return { x, y, w, h, filas, sobreLaPlanta: y + Math.trunc(h / 2) < yMatera };
}

/** Los píxeles [x, y] encendidos de un sprite con su esquina en (x0, y0). */
export function pixelesDeSprite(filas, x0 = 0, y0 = 0) {
  const lista = [];
  filas.forEach((fila, y) => {
    for (let x = 0; x < fila.length; x++) if (fila[x] === "#") lista.push([x0 + x, y0 + y]);
  });
  return lista;
}

/**
 * La aureola de `bitmapConHalo`: los 8 vecinos de cada píxel del sprite, en negro (lo que la OLED pinta antes de poner el
 * sprite encima en blanco). Devuelve los píxeles de la aureola sin repetir y SIN los del propio sprite (se ven encima).
 */
export function aureolaDe(pixeles) {
  const propios = new Set(pixeles.map(([x, y]) => `${x},${y}`));
  const vistos = new Set();
  const lista = [];
  for (const [x, y] of pixeles) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const clave = `${x + dx},${y + dy}`;
        if (propios.has(clave) || vistos.has(clave)) continue;
        vistos.add(clave);
        lista.push([x + dx, y + dy]);
      }
    }
  }
  return lista;
}
