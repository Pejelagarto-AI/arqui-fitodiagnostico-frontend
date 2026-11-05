// Qué clase de planta es una especie, para escoger su dibujo. Puro (sin DOM): se prueba con Node.

/** Las especies con «atrapamoscas» o «carniv» en el nombre se dibujan como planta carnívora. */
export function esCarnivora(especie) {
  return /atrapamoscas|carniv/i.test(String(especie ?? ""));
}
