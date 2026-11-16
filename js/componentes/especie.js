// Qué clase de planta es una especie, para escoger su dibujo. Puro (sin DOM): se prueba con Node.

/**
 * Palabras clave de cada familia, en el MISMO orden que `CLAVES[]` de `firmware/src/pantalla.cpp` (D110 del
 * backend): se busca cada texto dentro del nombre y gana la primera coincidencia. Si se agrega una clave en el
 * firmware, se agrega aquí (y al revés), para que la matera y la app muestren la misma mascota.
 */
export const CLAVES_DE_FAMILIA = Object.freeze([
  ["atrapamoscas", "carnivora"],
  ["carniv", "carnivora"],
  ["girasol", "girasol"],
  ["cactus", "cactus"],
  ["cacto", "cactus"],
  ["suculenta", "suculenta"],
  ["echeveria", "suculenta"],
  ["helecho", "helecho"],
]);

/** Las familias que tienen dibujo propio; «generica» es el respaldo de cualquier otra especie. */
export const FAMILIAS = Object.freeze(["girasol", "cactus", "suculenta", "helecho", "carnivora", "generica"]);

/**
 * Minúsculas de A a Z y nada más, como `tolower` en el firmware (que recorre bytes y deja intactos los de UTF-8): no se
 * quitan tildes ni se tocan otras letras. Así «Planta carnívora» (con í) NO coincide con «carniv», igual que en la matera.
 */
function minusculasAscii(texto) {
  return String(texto).replace(/[A-Z]/g, (letra) => letra.toLowerCase());
}

/**
 * Familia de la mascota para un nombre de especie: girasol | cactus | suculenta | helecho | carnivora | generica.
 * Idéntica a `familiaDe` de pantalla.cpp: busca cada clave dentro del nombre (sin distinguir A-Z de a-z, sin quitar
 * tildes) y gana la primera de la tabla; sin nombre o sin coincidencia, la genérica (la «común» del firmware).
 */
export function familiaDe(especie) {
  if (especie === null || especie === undefined) return "generica";
  const nombre = minusculasAscii(especie);
  for (const [clave, familia] of CLAVES_DE_FAMILIA) if (nombre.includes(clave)) return familia;
  return "generica";
}

/** ¿Cambiar de una especie a otra cambia el dibujo? Es decir, ¿son de familias distintas? */
export function cambiaElDibujo(antes, despues) {
  return familiaDe(antes) !== familiaDe(despues);
}
