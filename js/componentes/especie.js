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

function normalizar(texto) {
  return String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Familia de la mascota para un nombre de especie: girasol | cactus | suculenta | helecho | carnivora | generica. */
export function familiaDe(especie) {
  const nombre = normalizar(especie);
  if (!nombre) return "generica";
  for (const [clave, familia] of CLAVES_DE_FAMILIA) if (nombre.includes(clave)) return familia;
  return "generica";
}

/** Las especies con «atrapamoscas» o «carniv» (con o sin tilde) en el nombre se dibujan como planta carnívora. */
export function esCarnivora(especie) {
  return familiaDe(especie) === "carnivora";
}
