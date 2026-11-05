// Qué clase de planta es una especie, para escoger su dibujo. Puro (sin DOM): se prueba con Node.

/** Las especies con «atrapamoscas» o «carniv» (con o sin tilde) en el nombre se dibujan como planta carnívora. */
export function esCarnivora(especie) {
  const sinTildes = String(especie ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  return /atrapamoscas|carniv/i.test(sinTildes);
}
