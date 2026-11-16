// Guion de la escena viva de la portada (F38): lógica pura, sin DOM (tests/portada.test.mjs).
// La planta «habla»: cada momento trae su estado, lo que dice y lo que marcan los tres sensores. La portada
// los recorre en bucle; así quien llega entiende sin leer nada más que la matera mide y la planta avisa.

/** Cuánto dura cada momento en pantalla. */
export const DURACION_MOMENTO_MS = 3800;

/**
 * planta: la familia de la mascota (F44), una de las cinco especies del catálogo: "girasol" | "cactus" | "suculenta" |
 * "helecho" | "carnivora" (la atrapamoscas). estado: el del diagnóstico (pose y cara de la mascota, como en la OLED).
 * valores: lo que marcan los tres sensores. alerta: el sensor que pide atención ("agua" | "luz" | null).
 */
export const MOMENTOS = [
  { planta: "girasol", estado: "SALUDABLE", frase: "Estoy bien. Hoy no necesito nada.", valores: { agua: "62 %", luz: "850 lux", temperatura: "23 °C" }, alerta: null },
  { planta: "girasol", estado: "EN_RIESGO", frase: "Tengo sed. Riégame un poco.", valores: { agua: "16 %", luz: "850 lux", temperatura: "24 °C" }, alerta: "agua" },
  { planta: "girasol", estado: "SALUDABLE", frase: "Gracias. Ya me siento mejor.", valores: { agua: "68 %", luz: "850 lux", temperatura: "23 °C" }, alerta: null },
  { planta: "cactus", estado: "SALUDABLE", frase: "Soy cactus: poca agua me basta.", valores: { agua: "22 %", luz: "9000 lux", temperatura: "27 °C" }, alerta: null },
  { planta: "suculenta", estado: "EN_RIESGO", frase: "Me falta luz. Llévame a la ventana.", valores: { agua: "35 %", luz: "300 lux", temperatura: "22 °C" }, alerta: "luz" },
  { planta: "helecho", estado: "CRITICO", frase: "Estoy seco. Necesito agua ya.", valores: { agua: "5 %", luz: "600 lux", temperatura: "29 °C" }, alerta: "agua" },
  { planta: "carnivora", estado: "SALUDABLE", frase: "Soy carnívora: me encanta el sol.", valores: { agua: "80 %", luz: "12000 lux", temperatura: "26 °C" }, alerta: null, muerde: true },
];

/** Las familias que recorre el guion, en orden de aparición (sin repetir). */
export function familiasDelGuion(momentos = MOMENTOS) {
  return [...new Set(momentos.map((m) => m.planta))];
}

/** El momento que sigue, en bucle. */
export function siguienteMomento(indice, total = MOMENTOS.length) {
  return total > 0 ? (indice + 1) % total : 0;
}

/** Los tres pasos de «Así funciona». */
export const PASOS = [
  { icono: "conecta", titulo: "Conecta la matera", texto: "Enciéndela y escribe el código que muestra su pantalla." },
  { icono: "mira", titulo: "Mira cómo está", texto: "Agua, luz y temperatura, al día, en tu celular." },
  { icono: "haz", titulo: "Haz lo que te pide", texto: "Riégala o muévela a la luz: te decimos qué y cuándo." },
];
